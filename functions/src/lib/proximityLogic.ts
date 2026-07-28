/**
 * PURE proximity evaluation — product-rules §32. No Firestore.
 *
 * Order of evaluation:
 *  1. POLYGON CONTAINMENT. If the alert has geometry and the point is inside
 *     it, it qualifies with NO radius applied.
 *  2. RADIUS FALLBACK by hazard class, used only where no geometry exists.
 *
 * LIST vs PUSH:
 *  - qualifiesForList: contained OR within LIST_RADIUS_KM (10 km), any tier/source.
 *  - qualifiesForPush: severity-gated (official + ACTION|CRITICAL) AND
 *    (contained OR within the class PUSH radius). Advice tier and community
 *    reports are LISTED but NEVER pushed, regardless of distance.
 */
import { haversineKm, LatLng, PolygonRings, pointInPolygon } from "./geo";
import {
  AlertSource,
  AlertTier,
  DEFAULT_HAZARD_CLASS,
  HAZARD_CLASS,
  HazardClass,
  LIST_RADIUS_KM,
  PUSHABLE_TIERS,
  PUSH_RADIUS_KM,
} from "../constants/proximity";

export interface AlertGeo {
  source: AlertSource;
  tier: AlertTier;
  /** Hazard category key (see HAZARD_CLASS); unknown -> AREA fallback. */
  hazard?: string;
  /** Optional polygon geometry (rings of [lng, lat]). Preferred when present. */
  geometry?: PolygonRings | null;
  /** Representative point, used only for the radius fallback. */
  center?: LatLng | null;
}

export function hazardClassFor(hazard?: string): HazardClass {
  if (!hazard) return DEFAULT_HAZARD_CLASS;
  return HAZARD_CLASS[hazard] ?? DEFAULT_HAZARD_CLASS;
}

/** True if the point is inside the alert's polygon (if it has one). */
function contained(point: LatLng, alert: AlertGeo): boolean {
  return !!alert.geometry && alert.geometry.length > 0 && pointInPolygon(point, alert.geometry);
}

/**
 * LIST qualification: contained, or within the flat 10 km list radius of the
 * representative point. Applies to every tier and source.
 */
export function qualifiesForList(point: LatLng, alert: AlertGeo, listRadiusKm = LIST_RADIUS_KM): boolean {
  if (contained(point, alert)) return true;
  if (!alert.center) return false;
  return haversineKm(point, alert.center) <= listRadiusKm;
}

/** Severity gate: only official ACTION/CRITICAL may push. */
export function isPushableSeverity(alert: AlertGeo): boolean {
  return alert.source === "official" && PUSHABLE_TIERS.has(alert.tier);
}

/**
 * PUSH qualification: severity-gated, then contained OR within the hazard
 * class radius. Community/global/sensor and non-ACTION/CRITICAL never push.
 */
export function qualifiesForPush(
  point: LatLng,
  alert: AlertGeo,
  radii: Record<HazardClass, number> = PUSH_RADIUS_KM
): boolean {
  if (!isPushableSeverity(alert)) return false;
  if (contained(point, alert)) return true;
  if (!alert.center) return false;
  const radius = radii[hazardClassFor(alert.hazard)];
  return haversineKm(point, alert.center) <= radius;
}
