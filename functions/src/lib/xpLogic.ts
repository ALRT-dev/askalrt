/**
 * PURE XP logic — no Firestore, no side effects. Fully unit-testable.
 * The Firestore-facing code in ../xpAward.ts and ../corroboration.ts calls
 * into this module and only handles I/O + idempotency.
 */
import {
  BADGES,
  LEVEL_THRESHOLDS,
  ONCE_PER_USER,
  XP_AMOUNT,
  XpEventType,
} from "../constants/xp";

/**
 * Deterministic idempotency key for an award. Same (type, refId) always yields
 * the same id, so a re-fired trigger can never double-award.
 *
 * Once-per-user events ignore refId entirely (the type alone is the key).
 */
export function eventIdFor(type: XpEventType, refId: string | null): string {
  if (ONCE_PER_USER.has(type)) return type;
  return refId ? `${type}:${refId}` : type;
}

/** XP amount for an event type. */
export function amountFor(type: XpEventType): number {
  return XP_AMOUNT[type];
}

/** Cumulative-threshold level lookup. Returns 1..LEVEL_THRESHOLDS.length. */
export function computeLevel(xpTotal: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xpTotal >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

export interface BadgeCounters {
  corroborationsReceived: number;
  accurateReports: number;
}

/**
 * Given the user's current counters and the badges they already hold, return
 * the badge ids they have newly earned (never revokes; only adds).
 */
export function newlyEarnedBadges(counters: BadgeCounters, existing: readonly string[]): string[] {
  const have = new Set(existing);
  const earned: string[] = [];
  for (const badge of BADGES) {
    if (have.has(badge.id)) continue;
    if (counters[badge.metric] >= badge.threshold) earned.push(badge.id);
  }
  return earned;
}
