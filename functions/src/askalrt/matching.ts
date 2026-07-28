/**
 * PURE local matching for Ask ALRT — no AI, no Firestore. Unit-testable.
 *
 * Goal (per Sarah): answer from a pre-written library wherever possible so the
 * paid AI model is only used for the genuine long tail. This module scores a
 * user's question against library entries and against the emergency-number
 * table, and returns a canned answer when it is confident enough.
 */

/** One pre-written answer with the phrases/words that should surface it. */
export interface KnowledgeEntry {
  id: string;
  /** Multi-word phrases; a substring hit is a strong signal (weight 10). */
  triggers: string[];
  /** Single keywords; each overlap adds 1. */
  keywords: string[];
  /** The exact answer shown to the user. */
  answer: string;
}

export interface MatchResult {
  entry: KnowledgeEntry;
  score: number;
}

/** Lowercase, strip punctuation to spaces, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

/** Score one entry against a normalized question + its token set. */
export function scoreEntry(normQuestion: string, questionTokens: Set<string>, entry: KnowledgeEntry): number {
  let score = 0;
  for (const t of entry.triggers) {
    if (normQuestion.includes(normalize(t))) score += 10;
  }
  for (const k of entry.keywords) {
    if (questionTokens.has(normalize(k))) score += 1;
  }
  return score;
}

/**
 * Best library match, or null if nothing clears the threshold. A phrase hit
 * (10) alone clears the default; keyword-only matches need several to clear,
 * which keeps weak/ambiguous questions routing to the AI fallback.
 */
export function bestMatch(
  question: string,
  entries: readonly KnowledgeEntry[],
  minScore = 6
): MatchResult | null {
  const norm = normalize(question);
  const tokens = new Set(tokenize(question));
  let best: MatchResult | null = null;
  for (const entry of entries) {
    const score = scoreEntry(norm, tokens, entry);
    if (score >= minScore && (!best || score > best.score)) {
      best = { entry, score };
    }
  }
  return best;
}

/** Country-name -> ISO for the zero-AI emergency-number path. */
export const COUNTRY_ALIASES: Record<string, string> = {
  australia: "AU",
  aussie: "AU",
  "new zealand": "NZ",
  nz: "NZ",
  "united kingdom": "GB",
  uk: "GB",
  britain: "GB",
  england: "GB",
  "united states": "US",
  usa: "US",
  us: "US",
  america: "US",
  canada: "CA",
  ireland: "IE",
  france: "FR",
  germany: "DE",
};

const EMERGENCY_INTENT = ["emergency number", "police", "ambulance", "fire brigade", "call for help", "999", "911", "112", "000"];

/**
 * If the question is clearly asking for a country's emergency number and names
 * a known country, return the ISO + intent flag so the caller can answer from
 * the emergency table with no AI. Otherwise null.
 */
export function detectEmergencyLookup(question: string): { iso: string } | null {
  const norm = normalize(question);
  const hasIntent = EMERGENCY_INTENT.some((p) => norm.includes(normalize(p)));
  if (!hasIntent) return null;
  for (const [name, iso] of Object.entries(COUNTRY_ALIASES)) {
    if (norm.includes(normalize(name))) return { iso };
  }
  return null;
}
