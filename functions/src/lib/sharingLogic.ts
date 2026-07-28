/**
 * PURE sharing logic — no Firestore. Enforces the locked 2-state model.
 */
import {
  FORBIDDEN_LEGACY_VALUES,
  LEGACY_SHARING_MAP,
  LocationShareMode,
  SNAPSHOT_SOURCES,
  SnapshotSource,
} from "../constants/sharing";

export class ForbiddenSharingError extends Error {
  constructor(value: string) {
    super(
      `Persistent/continuous person location sharing is forbidden (got "${value}"). ` +
        `Only "${LocationShareMode.SNAPSHOT}" and "${LocationShareMode.SOS_LIVE}" are permitted.`
    );
    this.name = "ForbiddenSharingError";
  }
}

/** True if a value is one of the two canonical states. */
export function isValidShareMode(value: unknown): value is LocationShareMode {
  return value === LocationShareMode.SNAPSHOT || value === LocationShareMode.SOS_LIVE;
}

/**
 * Normalise any incoming sharing value (canonical or legacy) to the 2-state
 * model. Returns null when the value represents "not sharing". Throws
 * ForbiddenSharingError for any persistent/continuous person-tracking value.
 */
export function normaliseSharingMode(value: string): LocationShareMode | null {
  if (FORBIDDEN_LEGACY_VALUES.has(value)) throw new ForbiddenSharingError(value);
  if (isValidShareMode(value)) return value;
  if (value in LEGACY_SHARING_MAP) {
    const mapped = LEGACY_SHARING_MAP[value];
    // "continuous" lives in the map as a sentinel null but is caught above;
    // any other null is a genuine "not sharing".
    return mapped;
  }
  throw new Error(`Unknown sharing value "${value}"`);
}

export function isValidSnapshotSource(value: unknown): value is SnapshotSource {
  return typeof value === "string" && (SNAPSHOT_SOURCES as readonly string[]).includes(value);
}

export interface LiveShareCandidate {
  mode: string;
  /** The SOS event this live share is bound to. Required for SOS_LIVE. */
  sosId?: string | null;
  startedAt: number;
  expiresAt: number;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * A live share is legal ONLY if it is SOS_LIVE, bound to an sosId, and capped
 * at <= 4h from start. Anything else is rejected — this is the single guard
 * that keeps "live share" from becoming general person tracking.
 */
export function validateLiveShare(c: LiveShareCandidate, maxMs: number): ValidationResult {
  let normalised: LocationShareMode | null;
  try {
    normalised = normaliseSharingMode(c.mode);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (normalised !== LocationShareMode.SOS_LIVE) {
    return { ok: false, error: `Live share must be "${LocationShareMode.SOS_LIVE}", got "${c.mode}"` };
  }
  if (!c.sosId) {
    return { ok: false, error: "Live share must be bound to an active SOS (sosId required)" };
  }
  if (c.expiresAt - c.startedAt > maxMs) {
    return { ok: false, error: `Live share exceeds the ${maxMs / 3_600_000}h cap` };
  }
  if (c.expiresAt <= c.startedAt) {
    return { ok: false, error: "expiresAt must be after startedAt" };
  }
  return { ok: true };
}
