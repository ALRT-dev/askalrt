/**
 * SOS lifecycle (§2.2, §2.3, §4, §21). The ONLY code path that begins a
 * continuous location stream is onSosStart. Live share is bound to the SOS,
 * capped at 4h, and its last point is deleted on end (never archived).
 *
 * Data model:
 *   sosEvents/{circleId}/events/{sosId}
 *     { uid, startedAt, endedAt, endedBy, snapshotAtTrigger, acknowledgements[] }
 *   liveShareSessions/{circleId}/sessions/{sosId}
 *     { uid, active, startedAt, expiresAt, lastPoint, mode:"sos_live", sosId }
 */
import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { LocationShareMode, SOS_LIVE_MAX_MS } from "./constants/sharing";
import { fanOutToCircle } from "./messaging";

const db = () => admin.firestore();
const now = () => admin.firestore.Timestamp.now();

/** Create the live-share session + fan out the time-sensitive SOS push. */
export const onSosStart = onDocumentCreated(
  "sosEvents/{circleId}/events/{sosId}",
  async (event) => {
    const { circleId, sosId } = event.params as { circleId: string; sosId: string };
    const data = event.data?.data() as { uid?: string; snapshotAtTrigger?: unknown } | undefined;
    const uid = data?.uid;
    if (!uid) {
      logger.error("sosEvent created without uid", { circleId, sosId });
      return;
    }

    const startedAt = now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(startedAt.toMillis() + SOS_LIVE_MAX_MS);

    // Single live-share doc, bound to this SOS, capped at 4h. Passes the
    // guardLiveShareWrite validation (mode sos_live + sosId + cap).
    await db()
      .collection("liveShareSessions")
      .doc(circleId)
      .collection("sessions")
      .doc(sosId)
      .set({
        uid,
        active: true,
        startedAt,
        expiresAt,
        mode: LocationShareMode.SOS_LIVE,
        sosId,
        lastPoint: data?.snapshotAtTrigger ?? null,
      });

    // Fan out to every OTHER member simultaneously (no escalation chains).
    await fanOutToCircle(
      circleId,
      {
        title: "SOS",
        body: "A member of your circle has sent an SOS.",
        level: "time-sensitive",
        data: { type: "sos", circleId, sosId },
      },
      uid
    );
  }
);

/**
 * When an sosEvent gains an endedAt (user stop or auto), close it: delete the
 * live-share session (last point deleted, not archived) and push "SOS ended".
 */
export const onSosEnd = onDocumentUpdated(
  "sosEvents/{circleId}/events/{sosId}",
  async (event) => {
    const { circleId, sosId } = event.params as { circleId: string; sosId: string };
    const before = event.data?.before.data() as { endedAt?: unknown } | undefined;
    const after = event.data?.after.data() as { endedAt?: unknown; uid?: string } | undefined;
    if (before?.endedAt || !after?.endedAt) return; // only the first transition to ended

    await db()
      .collection("liveShareSessions")
      .doc(circleId)
      .collection("sessions")
      .doc(sosId)
      .delete();

    await fanOutToCircle(circleId, {
      title: "SOS ended",
      body: "The SOS has been stood down.",
      level: "active",
      data: { type: "sos_ended", circleId, sosId },
    });
  }
);

/**
 * Hard 4-hour auto-stop. Runs every 5 minutes; any live session past its
 * expiresAt is ended regardless of client state, and its parent sosEvent is
 * marked ended (endedBy "auto"), which triggers onSosEnd for cleanup + push.
 */
export const autoStopExpiredLiveShares = onSchedule("every 5 minutes", async () => {
  const cutoff = now();
  const expired = await db()
    .collectionGroup("sessions")
    .where("active", "==", true)
    .where("expiresAt", "<=", cutoff)
    .get();

  for (const sessionDoc of expired.docs) {
    // sessions live at liveShareSessions/{circleId}/sessions/{sosId}
    const circleId = sessionDoc.ref.parent.parent?.id;
    const sosId = sessionDoc.id;
    if (!circleId) continue;
    const sosRef = db().collection("sosEvents").doc(circleId).collection("events").doc(sosId);
    const sosSnap = await sosRef.get();
    if (sosSnap.exists && !sosSnap.data()?.endedAt) {
      await sosRef.set({ endedAt: cutoff, endedBy: "auto" }, { merge: true });
    } else {
      // sosEvent already ended/missing — clean the orphan session directly.
      await sessionDoc.ref.delete();
    }
    logger.info("Auto-stopped expired live share", { circleId, sosId });
  }
});
