/**
 * Firestore write-guard enforcing the 2-state location model at the function
 * layer (rules are the first line; this is the backstop that can also normalise
 * legacy values and hard-delete forbidden persistent-tracking writes).
 *
 * liveShareSessions/{circleId}/{sosId}
 *   { active, startedAt, expiresAt, lastPoint, sosId, mode }
 *
 * Any session that is not a valid SOS-bound live share (see validateLiveShare)
 * is deleted immediately and logged. This guarantees no code path can quietly
 * create a continuous person stream outside an SOS.
 */
import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { LocationShareMode, SOS_LIVE_MAX_MS } from "./constants/sharing";
import { validateLiveShare } from "./lib/sharingLogic";

const toMs = (v: unknown): number => {
  if (v instanceof admin.firestore.Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return NaN;
};

export const guardLiveShareWrite = onDocumentWritten(
  "liveShareSessions/{circleId}/sessions/{sosId}",
  async (event) => {
    const after = event.data?.after;
    if (!after || !after.exists) return; // deletion — nothing to guard
    const data = after.data() as Record<string, unknown>;

    const result = validateLiveShare(
      {
        mode: (data.mode as string) ?? LocationShareMode.SOS_LIVE,
        sosId: (data.sosId as string) ?? (event.params.sosId as string),
        startedAt: toMs(data.startedAt),
        expiresAt: toMs(data.expiresAt),
      },
      SOS_LIVE_MAX_MS
    );

    if (!result.ok) {
      logger.error("Rejected illegal live share session; deleting", {
        path: after.ref.path,
        reason: result.error,
      });
      await after.ref.delete();
    }
  }
);
