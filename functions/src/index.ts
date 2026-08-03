/**
 * Ask ALRT — function exports.
 *
 * This package hosts ONLY the Ask ALRT assistant and its supporting
 * entitlement webhook. The app's backend (hazards, family, SOS, XP,
 * sharing, proximity) is the REST service in `ALRT-dev/backendV2`
 * (api.safetyalrt.com) — the earlier duplicate implementations of those
 * domains were removed from this repo in the Aug 2026 repo audit.
 */
import * as admin from "firebase-admin";

admin.initializeApp();

// RevenueCat → entitlements/{uid} (plan free/plus). Used here only to pick
// the Ask ALRT daily quota (3 free / 20 paid).
export { revenuecatWebhook } from "./entitlements";

// Ask ALRT assistant (library-first, minimal AI).
export { askAlrt } from "./askalrt/askAlrt";
