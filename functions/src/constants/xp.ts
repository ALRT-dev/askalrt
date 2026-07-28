/**
 * XP & Badge constants — Points & Badge Logic v1.1 (reconciliation addendum).
 *
 * Locked rule: points reward ACCURATE CONTRIBUTION, never activity volume.
 * Consequences baked in here:
 *  - Corroborating (the trust sheet) earns the confirmer ZERO XP.
 *  - Streaks and the upvote mechanic do not exist.
 *  - Retired badges are simply never awarded (already-earned ones are
 *    grandfathered elsewhere and never revoked).
 *  - There is NO leaderboard: nothing in this file exposes a rankable,
 *    cross-user projection of XP or counts.
 */

/** Every event that can move XP in v1.1. This enum IS the whitelist. */
export enum XpEventType {
  ONBOARDING_COMPLETE = "onboarding_complete", // 20, once
  POST_ALRT = "post_alrt", // 10, on submission (reversible)
  POST_ALRT_REVERSED = "post_alrt_reversed", // -10, moderation removal
  FIRST_ALRT = "first_alrt", // 10, once
  REPORT_CORROBORATED = "report_corroborated", // +15, once per post (>=3 confirms)
  REPORT_WIDELY_CORROBORATED = "report_widely_corroborated", // +10, once per post (>=9)
  ADD_SAVED_PLACE = "add_saved_place", // 5 (cap 3 free / unlimited plus)
  COMPLETE_PROFILE = "complete_profile", // 10, once
  JOIN_GROUP = "join_group", // 10, once
  REFERRAL_COMPLETE = "referral_complete", // 25, per referred user
  FALSE_REPORT = "false_report", // -15, moderated false report (product-rules §9)
}

/** Canonical XP amounts. Single source of truth; do not hardcode elsewhere. */
export const XP_AMOUNT: Record<XpEventType, number> = {
  [XpEventType.ONBOARDING_COMPLETE]: 20,
  [XpEventType.POST_ALRT]: 10,
  [XpEventType.POST_ALRT_REVERSED]: -10,
  [XpEventType.FIRST_ALRT]: 10,
  [XpEventType.REPORT_CORROBORATED]: 15,
  [XpEventType.REPORT_WIDELY_CORROBORATED]: 10,
  [XpEventType.ADD_SAVED_PLACE]: 5,
  [XpEventType.COMPLETE_PROFILE]: 10,
  [XpEventType.JOIN_GROUP]: 10,
  [XpEventType.REFERRAL_COMPLETE]: 25,
  [XpEventType.FALSE_REPORT]: -15,
};

/**
 * Events that may be awarded at most once per user, ever. For these the
 * idempotency key is the type alone (no refId), so re-triggering is a no-op.
 */
export const ONCE_PER_USER: ReadonlySet<XpEventType> = new Set([
  XpEventType.ONBOARDING_COMPLETE,
  XpEventType.FIRST_ALRT,
  XpEventType.COMPLETE_PROFILE,
]);

/** Corroboration thresholds (config-tunable in Remote Config later). */
export const CORROBORATION_TIER = {
  /** >= this many "Yes, I can see it" from nearby users -> +15 to the author. */
  CONFIRMED: 3,
  /** >= this many -> the additional +10 "widely corroborated". */
  WIDELY: 9,
} as const;

/**
 * Level thresholds (cumulative XP for levels 1..10). Carried from v1.0.
 * v1.1 note: with fewer earn events these may need tuning after ~4 weeks live.
 */
export const LEVEL_THRESHOLDS: readonly number[] = [
  0, // Lv1
  50, // Lv2
  120, // Lv3
  220, // Lv4
  360, // Lv5
  550, // Lv6
  800, // Lv7
  1150, // Lv8
  1600, // Lv9
  2200, // Lv10
];

export interface BadgeDef {
  id: string;
  label: string;
  /** Which counter drives it and the value at which it unlocks. */
  metric: "corroborationsReceived" | "accurateReports";
  threshold: number;
}

/**
 * v1.1 active badges only. Retired badges (streak_7, streak_30, first_vote,
 * first_confirm, correct_clear_5, the upvote badges) are intentionally absent —
 * they are never awarded here and never revoked where already earned.
 */
export const BADGES: readonly BadgeDef[] = [
  { id: "corroborated_25", label: "Community Hero", metric: "corroborationsReceived", threshold: 25 },
  { id: "corroborated_100", label: "Crowd Favourite", metric: "corroborationsReceived", threshold: 100 },
  { id: "accurate_5", label: "Trusted Reporter", metric: "accurateReports", threshold: 5 },
  { id: "accurate_25", label: "Proven Eyes", metric: "accurateReports", threshold: 25 },
];
