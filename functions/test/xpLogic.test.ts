import {
  amountFor,
  computeLevel,
  eventIdFor,
  newlyEarnedBadges,
} from "../src/lib/xpLogic";
import { XpEventType } from "../src/constants/xp";

describe("XP amounts (v1.1 table)", () => {
  it("rewards accuracy over volume", () => {
    expect(amountFor(XpEventType.REPORT_CORROBORATED)).toBe(15);
    expect(amountFor(XpEventType.REPORT_WIDELY_CORROBORATED)).toBe(10);
    expect(amountFor(XpEventType.POST_ALRT)).toBe(10);
    expect(amountFor(XpEventType.ONBOARDING_COMPLETE)).toBe(20);
    expect(amountFor(XpEventType.REFERRAL_COMPLETE)).toBe(25);
  });

  it("penalises false reports and reverses removed posts", () => {
    expect(amountFor(XpEventType.FALSE_REPORT)).toBe(-15);
    expect(amountFor(XpEventType.POST_ALRT_REVERSED)).toBe(-10);
  });
});

describe("idempotency keys", () => {
  it("uses type-only key for once-per-user events (ignores refId)", () => {
    expect(eventIdFor(XpEventType.ONBOARDING_COMPLETE, "anything")).toBe("onboarding_complete");
    expect(eventIdFor(XpEventType.FIRST_ALRT, "r1")).toBe("first_alrt");
  });
  it("scopes repeatable events by refId", () => {
    expect(eventIdFor(XpEventType.REPORT_CORROBORATED, "report_42")).toBe("report_corroborated:report_42");
    expect(eventIdFor(XpEventType.REPORT_CORROBORATED, "report_43")).not.toBe(
      eventIdFor(XpEventType.REPORT_CORROBORATED, "report_42")
    );
  });
});

describe("level thresholds", () => {
  it("maps XP to level", () => {
    expect(computeLevel(0)).toBe(1);
    expect(computeLevel(49)).toBe(1);
    expect(computeLevel(50)).toBe(2);
    expect(computeLevel(360)).toBe(5);
    expect(computeLevel(999999)).toBe(10);
  });
});

describe("badges (v1.1 — accuracy only, never revoked)", () => {
  it("awards corroboration and accuracy badges at thresholds", () => {
    expect(newlyEarnedBadges({ corroborationsReceived: 25, accurateReports: 0 }, [])).toContain(
      "corroborated_25"
    );
    expect(newlyEarnedBadges({ corroborationsReceived: 0, accurateReports: 5 }, [])).toContain(
      "accurate_5"
    );
  });
  it("does not re-award a badge already held", () => {
    expect(
      newlyEarnedBadges({ corroborationsReceived: 100, accurateReports: 0 }, ["corroborated_25"])
    ).toEqual(["corroborated_100"]);
  });
  it("never returns retired badges", () => {
    const all = newlyEarnedBadges({ corroborationsReceived: 999, accurateReports: 999 }, []);
    expect(all).not.toContain("streak_7");
    expect(all).not.toContain("first_vote");
    expect(all).not.toContain("first_confirm");
  });
});
