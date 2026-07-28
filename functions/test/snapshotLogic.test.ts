import { ageState, computeExpiresAtMs, isExpired } from "../src/lib/snapshotLogic";

const MIN = 60 * 1000;

describe("snapshot lifecycle (§30)", () => {
  const t0 = 1_700_000_000_000;

  it("expires exactly 60 minutes after creation", () => {
    expect(computeExpiresAtMs(t0)).toBe(t0 + 60 * MIN);
  });

  it("walks the visible decay states", () => {
    expect(ageState(t0 + 0, t0)).toBe("fresh");
    expect(ageState(t0 + 29 * MIN, t0)).toBe("fresh");
    expect(ageState(t0 + 30 * MIN, t0)).toBe("ageing");
    expect(ageState(t0 + 54 * MIN, t0)).toBe("expiring");
    expect(ageState(t0 + 60 * MIN, t0)).toBe("expired");
  });

  it("isExpired flips at the 60 minute boundary", () => {
    expect(isExpired(t0 + 59 * MIN, t0)).toBe(false);
    expect(isExpired(t0 + 60 * MIN, t0)).toBe(true);
  });
});
