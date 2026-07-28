/**
 * Ask ALRT — library-first assistant (minimise AI).
 *
 * Answer order:
 *   1. Pre-written library (matching.ts + entries.ts) — ZERO AI, unlimited.
 *   2. Emergency-number lookup from the resolved table — ZERO AI, unlimited.
 *   3. AI fallback (claude-haiku-4-5) — only for the long tail, and rate limited
 *      to 3/day (free) or 20/day (ALRT+). This is the only path that spends money
 *      or the daily quota.
 *
 * Locked-rule enforcement carried over: App Check required, refusal handling,
 * no transcript logging (content-free counts only, §18), the assistant cannot
 * see the live feed (alert facts must be passed in as `context`).
 */
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import Anthropic from "@anthropic-ai/sdk";
import { ASK_ALRT_SYSTEM_PROMPT } from "./systemPrompt";
import { loadEntries } from "./entriesLoader";
import { bestMatch, detectEmergencyLookup } from "./matching";
import { EMERGENCY_NUMBERS } from "../lib/emergencyLogic";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const db = () => admin.firestore();

/** Cheapest model — the library handles the common questions; AI is the tail. */
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 1000;

/** Daily AI-question caps. Canned/library answers do NOT count. */
export const AI_DAILY_LIMIT = { free: 3, plus: 20 } as const;

const MAX_QUESTION_CHARS = 2000;
const MAX_HISTORY_TURNS = 10;

/** Display names for the zero-AI emergency lookup. */
const ISO_NAMES: Record<string, string> = {
  AU: "Australia",
  NZ: "New Zealand",
  GB: "the United Kingdom",
  US: "the United States",
  CA: "Canada",
  IE: "Ireland",
  FR: "France",
  DE: "Germany",
};

interface AskRequest {
  question: string;
  history?: { role: "user" | "assistant"; content: string }[];
  emergencyNumber?: string;
  context?: string;
  language?: string;
}

type Plan = "free" | "plus";
type Source = "library" | "emergency_lookup" | "ai";

function yyyymmdd(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

async function planFor(uid: string): Promise<Plan> {
  const ent = await db().collection("entitlements").doc(uid).get();
  return (ent.data()?.plan as Plan | undefined) === "plus" ? "plus" : "free";
}

/** Atomic AI-quota check + increment. Throws resource-exhausted at the cap. */
async function consumeAiQuota(uid: string, plan: Plan): Promise<void> {
  const limit = AI_DAILY_LIMIT[plan];
  const ref = db().collection("agentUsage").doc(uid).collection("days").doc(yyyymmdd(new Date()));
  await db().runTransaction(async (txn) => {
    const snap = await txn.get(ref);
    const count = (snap.data()?.aiCount as number | undefined) ?? 0;
    if (count >= limit) {
      throw new HttpsError(
        "resource-exhausted",
        plan === "plus"
          ? "You have reached today's limit of 20 assistant questions. Try again tomorrow."
          : "You have reached today's limit of 3 assistant questions. ALRT+ raises this to 20 per day."
      );
    }
    txn.set(ref, { aiCount: count + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
}

function emergencyAnswer(iso: string): string | null {
  const number = EMERGENCY_NUMBERS[iso];
  if (!number) return null;
  const name = ISO_NAMES[iso] ?? iso;
  return `In ${name}, the emergency number is ${number}. If you are in danger, call it now. ALRT is a helper, it does not contact emergency services for you.`;
}

function contextBlock(data: AskRequest): string {
  const lines = ["Context for this question (not shown to the user):"];
  lines.push(
    data.emergencyNumber
      ? `- Resolved local emergency number: ${data.emergencyNumber}. Use this exact number when directing the user to emergency services.`
      : "- No emergency number was resolved for this user. Direct them to their local emergency number by region."
  );
  lines.push(
    data.context && data.context.trim()
      ? `- Nearby alerts the app is showing: ${data.context.trim()}`
      : "- No live alert context was provided. Do not state whether any area is affected; send the user to their in-app alerts and the live map."
  );
  if (data.language) lines.push(`- Answer in this language: ${data.language}.`);
  return lines.join("\n");
}

export const askAlrt = onCall(
  { secrets: [ANTHROPIC_API_KEY], enforceAppCheck: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in to use Ask ALRT.");

    const data = request.data as AskRequest;
    const question = (data?.question ?? "").trim();
    if (!question) throw new HttpsError("invalid-argument", "A question is required.");
    if (question.length > MAX_QUESTION_CHARS) throw new HttpsError("invalid-argument", "Question is too long.");

    // 1. Pre-written library (no AI, no quota). Seed + Firestore overrides.
    const entries = await loadEntries();
    const match = bestMatch(question, entries);
    if (match) {
      logger.info("ask_alrt_answered", { uid, source: "library" as Source, entry: match.entry.id });
      return { answer: match.entry.answer, source: "library" as Source, usedAI: false };
    }

    // 2. Emergency-number lookup from the resolved table (no AI, no quota).
    const lookup = detectEmergencyLookup(question);
    if (lookup) {
      const answer = emergencyAnswer(lookup.iso);
      if (answer) {
        logger.info("ask_alrt_answered", { uid, source: "emergency_lookup" as Source, iso: lookup.iso });
        return { answer, source: "emergency_lookup" as Source, usedAI: false };
      }
    }

    // 3. AI fallback — the only path that costs money or the daily quota.
    const plan = await planFor(uid);
    await consumeAiQuota(uid, plan);

    const history = (data.history ?? [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_HISTORY_TURNS);

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    let response;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          { type: "text", text: ASK_ALRT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          { type: "text", text: contextBlock(data) },
        ],
        messages: [...history, { role: "user", content: question }],
      });
    } catch (err) {
      logger.error("Ask ALRT model call failed", { uid, error: (err as Error).message });
      throw new HttpsError("internal", "Ask ALRT is unavailable right now. Please try again.");
    }

    if (response.stop_reason === "refusal") {
      const category =
        (response as { stop_details?: { category?: string | null } }).stop_details?.category ?? null;
      logger.info("ask_alrt_refusal", { uid, category });
      return {
        answer:
          "I can't help with that one. If you're in danger, call your local emergency services now. For anything else about using ALRT, email contact@safetyalrt.com.",
        source: "ai" as Source,
        usedAI: true,
        refused: true,
      };
    }

    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    logger.info("ask_alrt_answered", { uid, source: "ai" as Source, plan });
    return { answer, source: "ai" as Source, usedAI: true, refused: false };
  }
);
