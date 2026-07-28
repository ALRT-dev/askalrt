import {
  AlertGeo,
  hazardClassFor,
  isPushableSeverity,
  qualifiesForList,
  qualifiesForPush,
} from "../src/lib/proximityLogic";
import { haversineKm, pointInPolygon } from "../src/lib/geo";

const MELBOURNE = { lat: -37.8136, lng: 144.9631 };
const SYDNEY = { lat: -33.8688, lng: 151.2093 };

describe("geo primitives", () => {
  it("haversine Melbourne<->Sydney is ~713 km", () => {
    expect(haversineKm(MELBOURNE, SYDNEY)).toBeGreaterThan(700);
    expect(haversineKm(MELBOURNE, SYDNEY)).toBeLessThan(730);
  });
  it("point-in-polygon (with a hole)", () => {
    // outer 0..10 square, hole 4..6 square, [lng, lat] order
    const rings = [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
    ];
    expect(pointInPolygon({ lat: 1, lng: 1 }, rings)).toBe(true);
    expect(pointInPolygon({ lat: 5, lng: 5 }, rings)).toBe(false); // in the hole
    expect(pointInPolygon({ lat: 20, lng: 20 }, rings)).toBe(false);
  });
});

describe("hazard classification", () => {
  it("classes known hazards and defaults unknown to AREA", () => {
    expect(hazardClassFor("bushfire")).toBe("moving");
    expect(hazardClassFor("crash")).toBe("static");
    expect(hazardClassFor("severe_weather")).toBe("area");
    expect(hazardClassFor("something_new")).toBe("area");
    expect(hazardClassFor(undefined)).toBe("area");
  });
});

describe("severity gate", () => {
  it("only official ACTION/CRITICAL may push", () => {
    expect(isPushableSeverity({ source: "official", tier: "CRITICAL" })).toBe(true);
    expect(isPushableSeverity({ source: "official", tier: "ACTION" })).toBe(true);
    expect(isPushableSeverity({ source: "official", tier: "MONITOR" })).toBe(false);
    expect(isPushableSeverity({ source: "community", tier: "CRITICAL" })).toBe(false);
  });
});

describe("LIST vs PUSH", () => {
  const near: AlertGeo = { source: "official", tier: "ACTION", hazard: "crash", center: MELBOURNE };

  it("polygon containment qualifies with no radius", () => {
    const bigPoly: AlertGeo = {
      source: "official",
      tier: "ACTION",
      hazard: "crash", // static, 1km push radius — but containment ignores radius
      geometry: [[[140, -40], [150, -40], [150, -35], [140, -35], [140, -40]]],
    };
    expect(qualifiesForPush(MELBOURNE, bigPoly)).toBe(true);
    expect(qualifiesForList(MELBOURNE, bigPoly)).toBe(true);
  });

  it("community reports never push but do list within 10km", () => {
    const community: AlertGeo = { source: "community", tier: "CRITICAL", hazard: "bushfire", center: MELBOURNE };
    expect(qualifiesForPush(MELBOURNE, community)).toBe(false);
    expect(qualifiesForList(MELBOURNE, community)).toBe(true);
  });

  it("static hazard pushes within 1km, not at 3km", () => {
    const p1km = { lat: MELBOURNE.lat + 0.008, lng: MELBOURNE.lng }; // ~0.9 km
    const p3km = { lat: MELBOURNE.lat + 0.027, lng: MELBOURNE.lng }; // ~3 km
    expect(qualifiesForPush(p1km, near)).toBe(true);
    expect(qualifiesForPush(p3km, near)).toBe(false);
  });

  it("advice tier lists but never pushes", () => {
    const advice: AlertGeo = { source: "official", tier: "MONITOR", hazard: "flood", center: MELBOURNE };
    expect(qualifiesForPush(MELBOURNE, advice)).toBe(false);
    expect(qualifiesForList(MELBOURNE, advice)).toBe(true);
  });
});
