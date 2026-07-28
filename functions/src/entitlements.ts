/**
 * revenuecatWebhook (§2.4, §5). Entitlements are written ONLY here. The client
 * never writes plan state (enforced in rules). RevenueCat is configured to send
 * a shared Authorization header value which we verify against a secret.
 *
 * entitlements/{uid} = { plan, source:"revenuecat", updatedAt }
 */
import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";

const db = () => admin.firestore();

/** Set with: firebase functions:secrets:set REVENUECAT_AUTH */
const REVENUECAT_AUTH = defineSecret("REVENUECAT_AUTH");

/** RevenueCat event types that map to an active entitlement. */
const ACTIVE_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "TRIAL_STARTED",
  "SUBSCRIPTION_EXTENDED",
]);
const INACTIVE_TYPES = new Set(["EXPIRATION", "CANCELLATION", "BILLING_ISSUE"]);

export const revenuecatWebhook = onRequest(
  { secrets: [REVENUECAT_AUTH] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }
    // RevenueCat sends the configured value in the Authorization header.
    if (req.get("Authorization") !== REVENUECAT_AUTH.value()) {
      logger.warn("Rejected RevenueCat webhook: bad Authorization");
      res.status(401).send("Unauthorized");
      return;
    }

    const evt = req.body?.event as
      | { type?: string; app_user_id?: string; expiration_at_ms?: number }
      | undefined;
    const uid = evt?.app_user_id;
    const type = evt?.type;
    if (!uid || !type) {
      res.status(400).send("Malformed event");
      return;
    }

    let plan: "free" | "plus" | null = null;
    if (ACTIVE_TYPES.has(type)) plan = "plus";
    else if (INACTIVE_TYPES.has(type)) plan = "free";

    if (plan === null) {
      // Unhandled event type (e.g. TRANSFER, TEST) — ack without change.
      res.status(200).send("Ignored");
      return;
    }

    await db().collection("entitlements").doc(uid).set(
      {
        plan,
        source: "revenuecat",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info("Entitlement updated", { uid, plan, type });
    res.status(200).send("OK");
  }
);
