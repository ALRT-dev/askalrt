/**
 * PURE seat accounting — product-rules §22. No Firestore.
 *
 * Worked example from the spec (must hold):
 *   host + child in own circle = 2 of 8 used, 6 free.
 *   A friend adding the host to the friend's circle costs 1 of the FRIEND's
 *   seats, 0 of the host's. The host is now in 2 circles with 6 seats free.
 */
import { MAX_HOSTED_CIRCLES, Plan, SEATS_PER_PLUS } from "../constants/seats";

/** One circle the user HOSTS, with its current member count (incl. the host). */
export interface HostedCircle {
  circleId: string;
  memberCount: number;
}

/** Seats used = sum of member counts across circles the user hosts. */
export function seatsUsed(hosted: readonly HostedCircle[]): number {
  return hosted.reduce((sum, c) => sum + Math.max(0, c.memberCount), 0);
}

export function seatCapacity(plan: Plan): number {
  return plan === "plus" ? SEATS_PER_PLUS : 0;
}

export function seatsFree(plan: Plan, hosted: readonly HostedCircle[]): number {
  return Math.max(0, seatCapacity(plan) - seatsUsed(hosted));
}

/** May the host add one more member to a circle they host? */
export function canAddMember(plan: Plan, hosted: readonly HostedCircle[]): boolean {
  return seatsFree(plan, hosted) >= 1;
}

/**
 * May the user create/host another circle? Requires a plus plan, fewer than
 * MAX_HOSTED_CIRCLES hosted, and at least one free seat (the host's own seat).
 */
export function canCreateCircle(plan: Plan, hosted: readonly HostedCircle[]): boolean {
  if (plan !== "plus") return false;
  if (hosted.length >= MAX_HOSTED_CIRCLES) return false;
  return seatsFree(plan, hosted) >= 1;
}

/**
 * Eligibility to TAKE OVER a vacant host (§29/§31): active plus subscription
 * and enough free seats to absorb the circle's current members.
 */
export function canTakeOverHost(
  plan: Plan,
  hosted: readonly HostedCircle[],
  circleMemberCount: number
): boolean {
  if (plan !== "plus") return false;
  if (hosted.length >= MAX_HOSTED_CIRCLES) return false;
  return seatsFree(plan, hosted) >= circleMemberCount;
}
