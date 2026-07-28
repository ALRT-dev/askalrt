/**
 * Corroboration -> XP flow (the core accuracy loop).
 *
 * Data shape (from firestore-data-model §14 stillThereVotes / corroboration):
 *   corroborations/{reportId}/confirms/{uid}
 *     { vote: "yes", at }              // "Yes, I can see it" from a nearby user
 *   reports/{reportId}
 *     { authorUid, confirmCount, corroboratedAwarded, widelyAwarded }
 *
 * Rules of the loop:
 *  - The CONFIRMER earns 0 XP (locked). We never call awardXp for them.
 *  - When the confirm count crosses 3, the report AUTHOR gets +15 (once).
 *  - When it crosses 9, the author gets an additional +10 (once).
 *  - The +15 crossing also bumps the author's accuracy counters, which can
 *    unlock the accurate_5 / accurate_25 / corroborated_* badges.
 *
 * onWrite is used (create + delete) so a withdrawn confirmation decrements the
 * count; awards themselves are guarded to fire once per threshold and are
 * idempotent in awardXp, so they are never granted twice.
 */
import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { CORROBORATION_TIER, XpEventType } from "./constants/xp";
import { awardXp } from "./xpAward";

const db = () => admin.firestore();

export const onCorroborationWrite = onDocumentWritten(
  "corroborations/{reportId}/confirms/{confirmUid}",
  async (event) => {
    const reportId = event.params.reportId as string;
    const before = event.data?.before.exists;
    const after = event.data?.after.exists;
    if (before === after) return; // metadata-only change, ignore

    const delta = after && !before ? 1 : -1; // added vs withdrawn

    const reportRef = db().collection("reports").doc(reportId);

    // Update the count and decide which crossing (if any) just happened,
    // atomically, so concurrent confirmations can't both "cross" the same tier.
    const crossing = await db().runTransaction(async (txn) => {
      const snap = await txn.get(reportRef);
      if (!snap.exists) return null;
      const data = snap.data() as {
        authorUid?: string;
        confirmCount?: number;
        corroboratedAwarded?: boolean;
        widelyAwarded?: boolean;
      };
      const authorUid = data.authorUid;
      if (!authorUid) return null;

      const next = Math.max(0, (data.confirmCount ?? 0) + delta);
      const update: Record<string, unknown> = { confirmCount: next };

      let tier: "confirmed" | "widely" | null = null;
      if (delta > 0 && !data.corroboratedAwarded && next >= CORROBORATION_TIER.CONFIRMED) {
        update.corroboratedAwarded = true;
        tier = "confirmed";
      } else if (
        delta > 0 &&
        data.corroboratedAwarded &&
        !data.widelyAwarded &&
        next >= CORROBORATION_TIER.WIDELY
      ) {
        update.widelyAwarded = true;
        tier = "widely";
      }

      txn.set(reportRef, update, { merge: true });
      return { authorUid, tier };
    });

    if (!crossing || !crossing.tier) return;

    if (crossing.tier === "confirmed") {
      // +15 to the author, and bump accuracy counters in the same award txn so
      // badge evaluation sees the new totals. corroborationsReceived is bumped
      // by the confirm count reaching the tier (3 confirmations counted once
      // here as the accuracy milestone; ongoing per-confirm tallying of raw
      // corroborationsReceived is handled by the count crossings, not per vote).
      await awardXp(crossing.authorUid, XpEventType.REPORT_CORROBORATED, reportId, {
        accurateReports: 1,
        corroborationsReceived: CORROBORATION_TIER.CONFIRMED,
      });
    } else {
      // +10 widely corroborated; add the incremental confirmations beyond the
      // first tier to corroborationsReceived.
      await awardXp(crossing.authorUid, XpEventType.REPORT_WIDELY_CORROBORATED, reportId, {
        corroborationsReceived: CORROBORATION_TIER.WIDELY - CORROBORATION_TIER.CONFIRMED,
      });
    }
  }
);
