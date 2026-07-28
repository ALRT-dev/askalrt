/**
 * PURE snapshot lifecycle logic — product-rules §30. No Firestore.
 * A snapshot is a single point that expires and is hard-deleted at 60 min.
 * It never auto-refreshes and never extends. Ageing has visible decay states.
 */
import { SNAPSHOT_TTL_MS } from "../constants/sharing";

export type SnapshotAgeState = "fresh" | "ageing" | "expiring" | "expired";

/** expiresAt is always createdAt + 60 min. There is no other value. */
export function computeExpiresAtMs(createdAtMs: number): number {
  return createdAtMs + SNAPSHOT_TTL_MS;
}

/**
 * Visual decay state (§30):
 *  0 to ~30 min   -> fresh (full opacity, purple ring)
 *  ~30 to 54 min  -> ageing (opacity steps down)
 *  final ~6 min   -> expiring (amber ring, tap-to-refresh affordance)
 *  >= 60 min      -> expired (pin removed, coordinates deleted)
 */
export function ageState(nowMs: number, createdAtMs: number): SnapshotAgeState {
  const age = nowMs - createdAtMs;
  if (age >= SNAPSHOT_TTL_MS) return "expired";
  if (age >= 54 * 60 * 1000) return "expiring";
  if (age >= 30 * 60 * 1000) return "ageing";
  return "fresh";
}

export function isExpired(nowMs: number, createdAtMs: number): boolean {
  return nowMs - createdAtMs >= SNAPSHOT_TTL_MS;
}
