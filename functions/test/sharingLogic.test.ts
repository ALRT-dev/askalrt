import {
  ForbiddenSharingError,
  isValidShareMode,
  normaliseSharingMode,
  validateLiveShare,
} from "../src/lib/sharingLogic";
import { LocationShareMode, SOS_LIVE_MAX_MS } from "../src/constants/sharing";

describe("2-state model", () => {
  it("accepts exactly the two canonical states", () => {
    expect(isValidShareMode("snapshot")).toBe(true);
    expect(isValidShareMode("sos_live")).toBe(true);
    expect(isValidShareMode("approximate")).toBe(false);
    expect(isValidShareMode("continuous")).toBe(false);
  });
});

describe("legacy 4-level -> 2-state normalisation", () => {
  it("maps snapshot and temporary(SOS) forward", () => {
    expect(normaliseSharingMode("snapshot")).toBe(LocationShareMode.SNAPSHOT);
    expect(normaliseSharingMode("temporary")).toBe(LocationShareMode.SOS_LIVE);
  });
  it("treats 'none' as not-sharing (null)", () => {
    expect(normaliseSharingMode("none")).toBeNull();
  });
  it("THROWS on any persistent/continuous person tracking", () => {
    expect(() => normaliseSharingMode("continuous")).toThrow(ForbiddenSharingError);
    expect(() => normaliseSharingMode("persistent")).toThrow(ForbiddenSharingError);
    expect(() => normaliseSharingMode("always")).toThrow(ForbiddenSharingError);
  });
});

describe("live share validation (SOS-only, capped)", () => {
  const t0 = 1_700_000_000_000;
  it("accepts an SOS-bound share within the 4h cap", () => {
    expect(
      validateLiveShare(
        { mode: "sos_live", sosId: "sos_1", startedAt: t0, expiresAt: t0 + SOS_LIVE_MAX_MS },
        SOS_LIVE_MAX_MS
      ).ok
    ).toBe(true);
  });
  it("rejects a live share with no SOS binding", () => {
    const r = validateLiveShare(
      { mode: "sos_live", sosId: null, startedAt: t0, expiresAt: t0 + 1000 },
      SOS_LIVE_MAX_MS
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/active SOS/);
  });
  it("rejects anything longer than the 4h cap", () => {
    const r = validateLiveShare(
      { mode: "sos_live", sosId: "sos_1", startedAt: t0, expiresAt: t0 + SOS_LIVE_MAX_MS + 1 },
      SOS_LIVE_MAX_MS
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/cap/);
  });
  it("rejects a snapshot masquerading as a live share", () => {
    expect(
      validateLiveShare(
        { mode: "snapshot", sosId: "sos_1", startedAt: t0, expiresAt: t0 + 1000 },
        SOS_LIVE_MAX_MS
      ).ok
    ).toBe(false);
  });
});
