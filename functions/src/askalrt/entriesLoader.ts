/**
 * Loads the Ask ALRT answer library from Firestore so Sarah can add or edit
 * answers WITHOUT an app release, while the bundled seed (entries.ts) stays as a
 * permanent fallback. Firestore docs merge OVER the seed by id: edit a seed
 * answer by using the same id, add new answers with new ids, or hide one by
 * setting `enabled: false`.
 *
 * Firestore shape — collection `askAlrtEntries/{id}`:
 *   { triggers: string[], keywords: string[], answer: string, enabled?: bool }
 *
 * The pure helpers (sanitizeEntry, mergeEntries) are unit-tested; loadEntries
 * adds Firestore I/O and a short in-memory cache on top.
 */
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { KnowledgeEntry } from "./matching";
import { KNOWLEDGE_BASE } from "./entries";

/** A raw Firestore doc as it may arrive (untrusted shape). */
export interface RawEntry {
  triggers?: unknown;
  keywords?: unknown;
  answer?: unknown;
  enabled?: unknown;
}

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];

/**
 * Validate one raw doc into a KnowledgeEntry, or null if unusable. Requires a
 * non-empty answer and at least one trigger or keyword to match on.
 */
export function sanitizeEntry(id: string, raw: RawEntry): KnowledgeEntry | null {
  if (!id) return null;
  const answer = typeof raw.answer === "string" ? raw.answer.trim() : "";
  if (!answer) return null;
  const triggers = asStringArray(raw.triggers);
  const keywords = asStringArray(raw.keywords);
  if (triggers.length === 0 && keywords.length === 0) return null;
  return { id, triggers, keywords, answer };
}

/**
 * Merge Firestore docs over the seed by id. `enabled === false` removes a seed
 * entry; a valid doc replaces or adds one. Order is not significant to matching.
 */
export function mergeEntries(
  seed: readonly KnowledgeEntry[],
  docs: readonly { id: string; raw: RawEntry }[]
): KnowledgeEntry[] {
  const map = new Map<string, KnowledgeEntry>(seed.map((e) => [e.id, e]));
  for (const { id, raw } of docs) {
    if (raw.enabled === false) {
      map.delete(id);
      continue;
    }
    const entry = sanitizeEntry(id, raw);
    if (entry) map.set(id, entry);
  }
  return [...map.values()];
}

// Short in-memory cache — a warm function instance reuses it across calls.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; entries: KnowledgeEntry[] } | null = null;

/**
 * Current answer library: seed merged with Firestore overrides. Falls back to
 * the seed alone on any read error, and caches for 5 minutes.
 */
export async function loadEntries(): Promise<KnowledgeEntry[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.entries;

  try {
    const snap = await admin.firestore().collection("askAlrtEntries").get();
    const docs = snap.docs.map((d) => ({ id: d.id, raw: d.data() as RawEntry }));
    const entries = mergeEntries(KNOWLEDGE_BASE, docs);
    cache = { at: now, entries };
    return entries;
  } catch (err) {
    logger.warn("askAlrtEntries load failed; using bundled seed", { error: (err as Error).message });
    return [...KNOWLEDGE_BASE];
  }
}
