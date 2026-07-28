import { mergeEntries, sanitizeEntry } from "../src/askalrt/entriesLoader";
import { KnowledgeEntry } from "../src/askalrt/matching";

const seed: KnowledgeEntry[] = [
  { id: "a", triggers: ["seed a"], keywords: ["a"], answer: "seed answer a" },
  { id: "b", triggers: ["seed b"], keywords: ["b"], answer: "seed answer b" },
];

describe("sanitizeEntry", () => {
  it("accepts a well-formed doc", () => {
    expect(
      sanitizeEntry("x", { triggers: ["hi"], keywords: ["yo"], answer: " hello " })
    ).toEqual({ id: "x", triggers: ["hi"], keywords: ["yo"], answer: "hello" });
  });
  it("rejects docs with no answer or no way to match", () => {
    expect(sanitizeEntry("x", { triggers: ["hi"], answer: "" })).toBeNull();
    expect(sanitizeEntry("x", { answer: "hello" })).toBeNull(); // no triggers/keywords
    expect(sanitizeEntry("", { triggers: ["hi"], answer: "hello" })).toBeNull();
  });
  it("drops non-string array members", () => {
    expect(
      sanitizeEntry("x", { triggers: ["ok", 3, null], keywords: [], answer: "a" })
    ).toEqual({ id: "x", triggers: ["ok"], keywords: [], answer: "a" });
  });
});

describe("mergeEntries (Firestore over seed)", () => {
  it("returns the seed unchanged when there are no docs", () => {
    expect(mergeEntries(seed, [])).toHaveLength(2);
  });
  it("overrides a seed entry by id", () => {
    const merged = mergeEntries(seed, [
      { id: "a", raw: { triggers: ["new a"], keywords: [], answer: "edited a" } },
    ]);
    expect(merged.find((e) => e.id === "a")?.answer).toBe("edited a");
  });
  it("adds a new entry", () => {
    const merged = mergeEntries(seed, [
      { id: "c", raw: { triggers: ["c"], keywords: [], answer: "new c" } },
    ]);
    expect(merged.map((e) => e.id).sort()).toEqual(["a", "b", "c"]);
  });
  it("hides a seed entry with enabled:false", () => {
    const merged = mergeEntries(seed, [{ id: "b", raw: { enabled: false } }]);
    expect(merged.map((e) => e.id)).toEqual(["a"]);
  });
  it("ignores an invalid override and keeps the seed", () => {
    const merged = mergeEntries(seed, [{ id: "a", raw: { answer: "" } }]);
    expect(merged.find((e) => e.id === "a")?.answer).toBe("seed answer a");
  });
});
