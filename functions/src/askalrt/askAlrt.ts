/**
 * Ask ALRT — the assistant backend (spec → working feature).
 *
 * A callable endpoint that takes the user's question plus optional per-request
 * context (the resolved emergency number, a nearby-alerts summary, language),
 * sends it to Claude with the Ask ALRT system prompt, and returns the answer.
 *
 * Design choices tied to the locked product rules:
 *  - The assistant CANNOT see the live feed. Any alert facts must be passed in
 *    by the app as `context`; the prompt forbids inventing others (§ stay in lane).
 *  - The emergency number is region-resolved by the app (§16) and passed in, not
 *    hardcoded. It is injected as a second system block AFTER the cached prompt.
 *  - Privacy (§18 voice posture): the question/answer text is NEVER logged. Only
 *    a content-free daily usage counter and an analytics count are kept.
 *  - Rate limiting via agentUsage/{uid}/{yyyymmdd} (firestore-data-model §1).
 *  - App Check enforced (firestore-data-model §3: App Check on callables).
 */
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import Anthropic from "@anthropic-ai/sdk";
import { ASK_ALRT_SYSTEM_PROMPT } from "./systemPrompt";

/** Set with: firebase functions:secrets:set ANTHROPIC_API_KEY */
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

const db = () => admin.firestore();

const MODEL = "claude-opus-5";
const MAX_TOKENS = 1500;
/** Free daily question cap per user (tune in Remote Config later). */
const DAILY_LIMIT = 40;
const MAX_QUESTION_CHARS = 2000;
const MAX_HISTORY_TURNS = 10;

interface AskRequest {
  question: string;
  /** Prior turns for context; capped and trimmed. */
  history?: { role: "user" | "assistant"; content: string }[];
  /** Region-resolved emergency number for the user (§16). */
  emergencyNumber?: string;
  /** App-supplied summary of nearby alerts (the assistant can't see the feed). */
  context?: string;
  /** BCP-47 language to answer in, e.g. "en", "zh-Hans". */
  language?: string;
}

function yyyymmdd(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

/** Atomic daily rate-limit check + increment. Throws resource-exhausted at cap. */
async function enforceRateLimit(uid: string): Promise<void> {
  const ref = db().collection("agentUsage").doc(uid).collection("days").doc(yyyymmdd(new Date()));
  await db().runTransaction(async (txn) => {
    const snap = await txn.get(ref);
    const count = (snap.data()?.count as number | undefined) ?? 0;
    if (count >= DAILY_LIMIT) {
      throw new HttpsError("resource-exhausted", "Daily Ask ALRT limit reached. Try again tomorrow.");
    }
    txn.set(ref, { count: count + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
}

/** Build the per-request context block (kept OUT of the cached system prefix). */
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
    if (question.length > MAX_QUESTION_CHARS) {
      throw new HttpsError("invalid-argument", "Question is too long.");
    }

    await enforceRateLimit(uid);

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
          // Block 1: stable prompt — cached across requests (prefix match).
          { type: "text", text: ASK_ALRT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          // Block 2: volatile per-request context — sits AFTER the cache breakpoint.
          { type: "text", text: contextBlock(data) },
        ],
        messages: [...history, { role: "user", content: question }],
      });
    } catch (err) {
      // Never log question/answer content; log only the error shape.
      logger.error("Ask ALRT model call failed", { uid, error: (err as Error).message });
      throw new HttpsError("internal", "Ask ALRT is unavailable right now. Please try again.");
    }

    // Opus 5 safety classifiers can decline: check stop_reason before reading content.
    if (response.stop_reason === "refusal") {
      // stop_details is populated on refusals; not yet in this SDK's base typings.
      const category =
        (response as { stop_details?: { category?: string | null } }).stop_details?.category ?? null;
      logger.info("Ask ALRT refusal", { uid, category });
      return {
        answer:
          "I can't help with that one. If you're in danger, call your local emergency services now. For anything else about using ALRT, email contact@safetyalrt.com.",
        refused: true,
      };
    }

    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Content-free analytics only (§18): count, never transcript.
    logger.info("agent_question", { uid, chars: question.length });

    return { answer, refused: false };
  }
);
