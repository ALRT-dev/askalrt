/**
 * Proximity constants — product-rules §32 / firestore-data-model §32.
 *
 * Two thresholds, never one:
 *  - LIST radius: generous, the user opened the screen.
 *  - PUSH radius: tiered by hazard class AND severity-gated.
 * All values are config-tunable in Remote Config (`proximity_radii`,
 * `list_radius_km`) without a release; these are the shipped defaults.
 */

export type AlertTier = "INFO" | "MONITOR" | "ACTION" | "CRITICAL";
export type AlertSource = "official" | "community" | "global" | "sensor";

/** Hazard movement class drives the PUSH radius fallback when no geometry. */
export type HazardClass = "moving" | "area" | "static";

/** LIST radius (km) — same for every tier/source. */
export const LIST_RADIUS_KM = 10;

/** PUSH radius (km) fallback by hazard class, used only when no geometry. */
export const PUSH_RADIUS_KM: Record<HazardClass, number> = {
  moving: 5, // bushfire, grass fire, flood, cyclone, smoke/chemical plume
  area: 3, // severe weather, air quality, public health, civil unrest, UNCLASSIFIED
  static: 1, // structure fire, police incident, crash, road closure, utility outage
};

/** Map of known hazard categories -> movement class (extend as needed). */
export const HAZARD_CLASS: Record<string, HazardClass> = {
  bushfire: "moving",
  grass_fire: "moving",
  flood: "moving",
  cyclone: "moving",
  smoke: "moving",
  chemical: "moving",
  severe_weather: "area",
  air_quality: "area",
  public_health: "area",
  civil_unrest: "area",
  structure_fire: "static",
  police_incident: "static",
  crash: "static",
  road_closure: "static",
  utility_outage: "static",
};

/** Unknown/unclassified hazards fall back to the AREA (3 km) class. */
export const DEFAULT_HAZARD_CLASS: HazardClass = "area";

/** Only these tiers may ever push, and only from official sources. */
export const PUSHABLE_TIERS: ReadonlySet<AlertTier> = new Set<AlertTier>(["ACTION", "CRITICAL"]);
