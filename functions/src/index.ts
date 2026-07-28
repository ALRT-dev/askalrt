/**
 * ALRT V2 backend — function exports.
 *
 * Pass 1 (reconciliation): XP v1.1 + family-sharing 2-state model.
 * Pass 2 (core safety): SOS lifecycle, snapshot proximity, entitlements, limits.
 */
import * as admin from "firebase-admin";

admin.initializeApp();

// --- Pass 1: reconciliation items -------------------------------------------
export { onCorroborationWrite } from "./corroboration";
export { guardLiveShareWrite } from "./sharingGuard";
export { awardXp } from "./xpAward";

// --- Pass 2: core safety functions (§2) -------------------------------------
export { onSnapshotWrite } from "./snapshots";
export { onSosStart, onSosEnd, autoStopExpiredLiveShares } from "./sos";
export { revenuecatWebhook } from "./entitlements";
export { enforceSavedLocationLimit, enforceSeatLimit } from "./limits";

// --- Pass 3: Ask ALRT assistant ---------------------------------------------
export { askAlrt } from "./askalrt/askAlrt";
