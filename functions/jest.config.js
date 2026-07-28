/** Unit tests target the PURE logic modules only (src/lib/*) — no emulator required. */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.test.ts"],
  // Some modules pull in firebase-admin at import time (no handles opened by our
  // pure tests). forceExit keeps the run from hanging on that module graph.
  forceExit: true,
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
};
