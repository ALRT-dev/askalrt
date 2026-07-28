import {
  canAddMember,
  canCreateCircle,
  canTakeOverHost,
  seatsFree,
  seatsUsed,
} from "../src/lib/seatLogic";

describe("seat accounting (§22 host-pays)", () => {
  it("the spec worked example holds", () => {
    // host + child in own circle = 2 of 8 used, 6 free
    const hosted = [{ circleId: "own", memberCount: 2 }];
    expect(seatsUsed(hosted)).toBe(2);
    expect(seatsFree("plus", hosted)).toBe(6);
  });

  it("free users cannot host (0 capacity)", () => {
    expect(seatsFree("free", [])).toBe(0);
    expect(canCreateCircle("free", [])).toBe(false);
    expect(canAddMember("free", [])).toBe(false);
  });

  it("a person in two of the host's circles consumes two seats", () => {
    const hosted = [
      { circleId: "family", memberCount: 3 },
      { circleId: "sitecrew", memberCount: 3 },
    ];
    expect(seatsUsed(hosted)).toBe(6);
    expect(seatsFree("plus", hosted)).toBe(2);
  });

  it("blocks adding a member when seats are full", () => {
    const full = [{ circleId: "c", memberCount: 8 }];
    expect(seatsFree("plus", full)).toBe(0);
    expect(canAddMember("plus", full)).toBe(false);
  });

  it("caps hosted circles at 4", () => {
    const four = [1, 2, 3, 4].map((n) => ({ circleId: `c${n}`, memberCount: 1 }));
    expect(canCreateCircle("plus", four)).toBe(false);
    expect(canCreateCircle("plus", four.slice(0, 3))).toBe(true);
  });

  it("host takeover needs enough free seats to absorb the circle", () => {
    const hosted = [{ circleId: "own", memberCount: 5 }]; // 3 free
    expect(canTakeOverHost("plus", hosted, 3)).toBe(true);
    expect(canTakeOverHost("plus", hosted, 4)).toBe(false);
    expect(canTakeOverHost("free", [], 1)).toBe(false);
  });
});
