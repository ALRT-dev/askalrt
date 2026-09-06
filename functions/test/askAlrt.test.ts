import { AI_DAILY_LIMIT, planFromEntitlementData, quotaExceededMessage } from "../src/askalrt/askAlrt";

// Pins the confirmed commercial decision (5/day free, 30/day ALRT+) and the
// free/plus entitlement distinction Ask ALRT's own separate RevenueCat
// webhook (entitlements.ts, entitlements/{uid}) feeds into. A regression in
// either silently changes how many questions a real user gets today.
describe("AI_DAILY_LIMIT", () => {
  it("is exactly 5 free / 30 ALRT+", () => {
    expect(AI_DAILY_LIMIT).toEqual({ free: 5, plus: 30 });
  });
});

describe("planFromEntitlementData", () => {
  it("reads plus only from an explicit plan: \"plus\"", () => {
    expect(planFromEntitlementData({ plan: "plus" })).toBe("plus");
  });

  it("treats a missing entitlements/{uid} document as free (never subscribed)", () => {
    expect(planFromEntitlementData(undefined)).toBe("free");
  });

  it("treats an explicit plan: \"free\" as free (lapsed/expired)", () => {
    expect(planFromEntitlementData({ plan: "free" })).toBe("free");
  });

  it("treats any other/unexpected value as free, never as plus", () => {
    expect(planFromEntitlementData({ plan: "premium" })).toBe("free");
    expect(planFromEntitlementData({})).toBe("free");
  });
});

describe("quotaExceededMessage", () => {
  it("names the free cap and points to ALRT+", () => {
    const message = quotaExceededMessage("free");
    expect(message).toContain("5 assistant questions");
    expect(message).toContain("30 per day");
  });

  it("names the ALRT+ cap with no upsell", () => {
    const message = quotaExceededMessage("plus");
    expect(message).toContain("30 assistant questions");
    expect(message).not.toContain("ALRT+");
  });
});
