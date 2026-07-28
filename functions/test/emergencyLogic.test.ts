import {
  countryFromLocale,
  resolveEmergencyNumber,
} from "../src/lib/emergencyLogic";

describe("emergency number resolution (§16)", () => {
  it("prefers SIM country over region and locale", () => {
    expect(
      resolveEmergencyNumber({ simCountry: "AU", deviceRegion: "US", locale: "en-GB" })
    ).toBe("000");
  });
  it("falls through SIM -> region -> locale", () => {
    expect(resolveEmergencyNumber({ simCountry: null, deviceRegion: "NZ" })).toBe("111");
    expect(resolveEmergencyNumber({ locale: "en-GB" })).toBe("999");
  });
  it("falls back to 112 when nothing resolves", () => {
    expect(resolveEmergencyNumber({})).toBe("112");
    expect(resolveEmergencyNumber({ simCountry: "ZZ" })).toBe("112");
  });
  it("parses the region subtag from a locale", () => {
    expect(countryFromLocale("en-AU")).toBe("AU");
    expect(countryFromLocale("zh-Hans-CN")).toBe("CN");
    expect(countryFromLocale("en")).toBeNull();
    expect(countryFromLocale(null)).toBeNull();
  });
});
