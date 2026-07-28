/**
 * Location sharing — the LOCKED 2-state model (product-rules §2, §30).
 *
 * There are exactly two ways a person's location can be shared. There is no
 * third, and there is no "off" state stored as a share record (not sharing =
 * no snapshot doc exists). Persistent monitoring is a PLACES feature only and
 * is never applied to a person under any label.
 */

/** The only two person-location sharing states that may exist. */
export enum LocationShareMode {
  /**
   * Single point, explicit send, expires + hard-deleted at 60 min.
   * Never auto-refreshes, never extends, never historised.
   */
  SNAPSHOT = "snapshot",
  /**
   * Continuous stream that exists ONLY inside an active SOS (onSosStart).
   * Ends on stop or the 4-hour cap; last point deleted on end.
   */
  SOS_LIVE = "sos_live",
}

export const SNAPSHOT_TTL_MS = 60 * 60 * 1000; // 60 minutes
export const SOS_LIVE_MAX_MS = 4 * 60 * 60 * 1000; // 4 hours hard cap

/** Valid `source` values on a snapshot doc (all still expire at 60 min). */
export const SNAPSHOT_SOURCES = ["checkin", "request", "sos"] as const;
export type SnapshotSource = (typeof SNAPSHOT_SOURCES)[number];

/**
 * Legacy 4-level enum -> 2-state model.
 *
 * NOTE: the handoff does not enumerate the legacy values, so these labels are
 * INFERRED from the spec's language. Adjust the keys to match live data if
 * needed — the two canonical target states must not change.
 *
 *  - "none"       : not a share at all -> no share record. Callers should not
 *                   persist this; it maps to null (delete/skip).
 *  - "snapshot"   : -> SNAPSHOT.
 *  - "temporary"  : short-lived live share -> only legal inside an SOS, so it
 *                   maps to SOS_LIVE (the guard additionally requires an sosId).
 *  - "continuous" : persistent person tracking -> FORBIDDEN. Never maps to a
 *                   valid state; normalisation throws.
 */
export const LEGACY_SHARING_MAP: Record<string, LocationShareMode | null> = {
  none: null,
  snapshot: LocationShareMode.SNAPSHOT,
  temporary: LocationShareMode.SOS_LIVE,
  continuous: null, // sentinel; normaliseSharingMode throws for this one
};

/** Legacy values that represent forbidden persistent person-tracking. */
export const FORBIDDEN_LEGACY_VALUES: ReadonlySet<string> = new Set(["continuous", "persistent", "always"]);
