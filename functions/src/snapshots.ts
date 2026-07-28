/**
 * onSnapshotWrite (§2.1, §30). When a snapshot lands, evaluate active official
 * ACTION/CRITICAL alerts against the snapshot POINT and, if one qualifies to
 * push, send ONE near-alert notice to the circle. The copy must state the age
 * of the position ("...where James was N minutes ago. He may have moved since").
 *
 * No standing geofence is created — evaluation happens once, on write. Ongoing
 * re-evaluation while the snapshot is live is handled by alert-side triggers
 * (out of scope for this pass); this covers the "issued near a live snapshot"
 * case at creation time.
 *
 * TTL: the 60-min hard delete is a Firestore TTL policy on `expiresAt`
 * (configured out-of-band; see README). This function does not delete.
 */
import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { AlertGeo, qualifiesForPush } from "./lib/proximityLogic";
import { LatLng } from "./lib/geo";
import { fanOutToCircle } from "./messaging";

const db = () => admin.firestore();

interface AlertDoc extends AlertGeo {
  title?: string;
}

export const onSnapshotWrite = onDocumentCreated(
  "snapshots/{circleId}/items/{snapId}",
  async (event) => {
    const { circleId } = event.params as { circleId: string };
    const snap = event.data?.data() as
      | { uid?: string; lat?: number; lng?: number; createdAt?: admin.firestore.Timestamp }
      | undefined;
    if (!snap || typeof snap.lat !== "number" || typeof snap.lng !== "number") return;

    const point: LatLng = { lat: snap.lat, lng: snap.lng };

    // Active alerts that are even eligible to push (official ACTION/CRITICAL).
    const alertsSnap = await db()
      .collection("alerts")
      .where("status", "==", "active")
      .where("source", "==", "official")
      .where("tier", "in", ["ACTION", "CRITICAL"])
      .get();

    const near = alertsSnap.docs
      .map((d) => d.data() as AlertDoc)
      .find((alert) => qualifiesForPush(point, alert));

    if (!near) return;

    const createdMs = snap.createdAt?.toMillis() ?? Date.now();
    const ageMin = Math.max(0, Math.round((Date.now() - createdMs) / 60000));
    const ageClause =
      ageMin <= 0 ? "just now" : `${ageMin} minute${ageMin === 1 ? "" : "s"} ago`;

    await fanOutToCircle(circleId, {
      title: near.title ?? "Alert near a shared location",
      body: `A ${near.tier === "CRITICAL" ? "critical warning" : "Watch and Act"} was issued near where a member shared their location ${ageClause}. They may have moved since.`,
      level: near.tier === "CRITICAL" ? "critical" : "time-sensitive",
      data: { type: "snapshot_near_alert", circleId },
    });

    logger.info("Pushed near-alert notice for snapshot", { circleId, tier: near.tier });
  }
);
