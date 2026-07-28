/**
 * Seat & limit constants — product-rules §5, §22, §13 corrections.
 *
 * HOST PAYS. Seats are consumed ONLY by memberships in circles the user HOSTS
 * (including the host's own seat). Joining someone else's circle is free and
 * unlimited and grants no seats. A person in two of the same host's circles
 * consumes two seats.
 */

/** ALRT+ grants 8 seats, spendable across up to 4 named circles the user hosts. */
export const SEATS_PER_PLUS = 8;
export const MAX_HOSTED_CIRCLES = 4;

/**
 * Free-tier saved-location cap. §13 correction: 3 -> 1 (Home only). Existing
 * free users above the cap are GRANDFATHERED via `legacy_locations` on the user
 * doc; enforcement applies to NEW adds only. ALRT+ is unlimited.
 */
export const FREE_SAVED_LOCATIONS = 1;

export type Plan = "free" | "plus";
