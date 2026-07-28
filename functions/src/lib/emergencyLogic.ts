/**
 * PURE emergency-number resolution — product-rules §16 / firestore-data-model §16.
 *
 * Resolution order: SIM country (telephony) > device region > locale-derived
 * country > "112" (GSM global fallback). The number is rendered wherever the
 * {EMERGENCY_NUMBER} placeholder appears; copy never hard-codes 000.
 */

/** Remote Config `emergency_numbers` {ISO: number}. Shipped defaults. */
export const EMERGENCY_NUMBERS: Record<string, string> = {
  AU: "000",
  NZ: "111",
  GB: "999",
  US: "911",
  CA: "911",
  IE: "112",
  FR: "112",
  DE: "112",
  // EU members not listed individually resolve via 112 fallback anyway.
};

export const GSM_GLOBAL_FALLBACK = "112";

export interface EmergencyContext {
  /** ISO country from the SIM (telephony API). Highest priority. */
  simCountry?: string | null;
  /** ISO country from device region settings. */
  deviceRegion?: string | null;
  /** BCP-47 locale, e.g. "en-AU". Country is parsed from the region subtag. */
  locale?: string | null;
}

/** Parse the region subtag (e.g. "en-AU" -> "AU"). Returns null if absent. */
export function countryFromLocale(locale?: string | null): string | null {
  if (!locale) return null;
  const parts = locale.replace("_", "-").split("-");
  const region = parts.find((p) => /^[A-Za-z]{2}$/.test(p) && p === p.toUpperCase());
  return region ?? null;
}

/**
 * Resolve the emergency number for a context. Always returns a dialable string
 * (never null) — falls back to 112.
 */
export function resolveEmergencyNumber(
  ctx: EmergencyContext,
  table: Record<string, string> = EMERGENCY_NUMBERS
): string {
  const candidates = [
    ctx.simCountry,
    ctx.deviceRegion,
    countryFromLocale(ctx.locale),
  ];
  for (const iso of candidates) {
    if (iso && table[iso.toUpperCase()]) return table[iso.toUpperCase()];
  }
  return GSM_GLOBAL_FALLBACK;
}
