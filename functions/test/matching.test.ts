import {
  bestMatch,
  detectEmergencyLookup,
  normalize,
  scoreEntry,
  tokenize,
} from "../src/askalrt/matching";
import { KNOWLEDGE_BASE } from "../src/askalrt/entries";

describe("text normalisation", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalize("How do I send an SOS?!")).toBe("how do i send an sos");
    expect(tokenize("SOS, now!")).toEqual(["sos", "now"]);
  });
});

describe("library matching (zero AI)", () => {
  it("matches common questions to the right entry", () => {
    expect(bestMatch("how do i send an sos", KNOWLEDGE_BASE)?.entry.id).toBe("send_sos");
    expect(bestMatch("how much does it cost?", KNOWLEDGE_BASE)?.entry.id).toBe("pricing");
    expect(bestMatch("can you track someone all the time", KNOWLEDGE_BASE)?.entry.id).toBe("live_tracking");
    expect(bestMatch("how do i delete my account", KNOWLEDGE_BASE)?.entry.id).toBe("delete_account");
    expect(bestMatch("do you collect phone numbers", KNOWLEDGE_BASE)?.entry.id).toBe("phone_numbers");
  });

  it("returns null for questions the library does not cover (routes to AI)", () => {
    expect(bestMatch("what's the best hiking trail near a bushfire", KNOWLEDGE_BASE)).toBeNull();
    expect(bestMatch("tell me a joke", KNOWLEDGE_BASE)).toBeNull();
  });

  it("a phrase hit outweighs stray keyword overlap", () => {
    const entry = { id: "x", triggers: ["send an sos"], keywords: ["sos"], answer: "a" };
    expect(scoreEntry("how do i send an sos", new Set(tokenize("how do i send an sos")), entry)).toBeGreaterThanOrEqual(10);
  });
});

describe("emergency-number lookup (zero AI)", () => {
  it("detects country + emergency intent", () => {
    expect(detectEmergencyLookup("what's the emergency number in Japan")).toBeNull(); // Japan not in alias table -> AI
    expect(detectEmergencyLookup("emergency number in New Zealand")).toEqual({ iso: "NZ" });
    expect(detectEmergencyLookup("who do i call, police in the UK")).toEqual({ iso: "GB" });
    expect(detectEmergencyLookup("emergency number in australia")).toEqual({ iso: "AU" });
    expect(detectEmergencyLookup("what is 000")).toBeNull(); // intent but no country named -> AI
  });

  it("returns null without emergency intent", () => {
    expect(detectEmergencyLookup("what is the weather in australia")).toBeNull();
  });
});
