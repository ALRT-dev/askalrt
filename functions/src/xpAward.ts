/**
 * Idempotent XP award writer. The ONLY code path that writes xpEvents and
 * mutates profile totals. Clients never write these (enforced in rules).
 */
import * as admin from "firebase-admin";
import { XpEventType } from "./constants/xp";
import { amountFor, computeLevel, eventIdFor, newlyEarnedBadges } from "./lib/xpLogic";
import { AwardResult, UserProfile } from "./types";

const db = () => admin.firestore();

const DEFAULT_PROFILE: UserProfile = {
  xpTotal: 0,
  level: 1,
  badges: [],
  corroborationsReceived: 0,
  accurateReports: 0,
};

/**
 * Award XP for a single event, idempotently.
 *
 * Idempotency: the xpEvent doc id is deterministic (eventIdFor). Inside a
 * transaction we create it only if absent; if it already exists we no-op.
 * This makes retries, duplicate triggers and at-least-once delivery safe.
 *
 * @param counterDeltas optional counter increments applied in the SAME txn
 *        (used by corroboration to bump corroborationsReceived / accurateReports
 *        atomically with the award), then re-evaluated for new badges.
 */
export async function awardXp(
  uid: string,
  type: XpEventType,
  refId: string | null,
  counterDeltas?: Partial<Pick<UserProfile, "corroborationsReceived" | "accurateReports">>
): Promise<AwardResult> {
  const amount = amountFor(type);
  const eventId = eventIdFor(type, refId);
  const eventRef = db().collection("xpEvents").doc(uid).collection("events").doc(eventId);
  const profileRef = db().collection("users").doc(uid);

  return db().runTransaction(async (txn) => {
    const [eventSnap, profileSnap] = await Promise.all([txn.get(eventRef), txn.get(profileRef)]);

    if (eventSnap.exists) {
      return { applied: false, reason: "duplicate", eventId, amount: 0 } as AwardResult;
    }

    const current: UserProfile = { ...DEFAULT_PROFILE, ...(profileSnap.data() as Partial<UserProfile> | undefined) };

    const corroborationsReceived = current.corroborationsReceived + (counterDeltas?.corroborationsReceived ?? 0);
    const accurateReports = current.accurateReports + (counterDeltas?.accurateReports ?? 0);
    const xpTotal = current.xpTotal + amount;
    const level = computeLevel(xpTotal);
    const badges = [
      ...current.badges,
      ...newlyEarnedBadges({ corroborationsReceived, accurateReports }, current.badges),
    ];

    txn.set(eventRef, {
      type,
      amount,
      refId: refId ?? null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    txn.set(
      profileRef,
      { xpTotal, level, badges, corroborationsReceived, accurateReports },
      { merge: true }
    );

    return {
      applied: true,
      reason: amount === 0 ? "zero_amount" : "applied",
      eventId,
      amount,
    } as AwardResult;
  });
}
