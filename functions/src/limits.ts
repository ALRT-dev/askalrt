/**
 * enforceLimits (§2.6). Server-side backstop to security rules for the free
 * caps that rules cannot count cheaply:
 *  - savedLocations free cap (§13: 1 Home; grandfathered via legacy_locations)
 *  - seat cap on membership creation in a HOSTED circle (§22 host-pays)
 *
 * Both handlers DELETE the offending doc on violation and log; the rules are
 * the first line of defence, this catches what rules can't aggregate.
 */
import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { FREE_SAVED_LOCATIONS, Plan } from "./constants/seats";
import { canAddMember, HostedCircle } from "./lib/seatLogic";

const db = () => admin.firestore();

async function planFor(uid: string): Promise<Plan> {
  const ent = await db().collection("entitlements").doc(uid).get();
  return (ent.data()?.plan as Plan | undefined) === "plus" ? "plus" : "free";
}

/** Free users are capped at FREE_SAVED_LOCATIONS unless grandfathered. */
export const enforceSavedLocationLimit = onDocumentCreated(
  "savedLocations/{uid}/items/{locId}",
  async (event) => {
    const { uid } = event.params as { uid: string };
    const plan = await planFor(uid);
    if (plan === "plus") return; // unlimited

    const userDoc = await db().collection("users").doc(uid).get();
    if (userDoc.data()?.legacy_locations === true) return; // grandfathered

    const existing = await db().collection("savedLocations").doc(uid).collection("items").get();
    if (existing.size > FREE_SAVED_LOCATIONS) {
      await event.data?.ref.delete();
      logger.warn("Rejected saved location over free cap", { uid, cap: FREE_SAVED_LOCATIONS });
    }
  }
);

/**
 * Seat backstop: when a member is added to a circle, verify the HOST has a free
 * seat across all circles they host. If not, remove the membership.
 */
export const enforceSeatLimit = onDocumentCreated(
  "memberships/{circleId}/members/{memberUid}",
  async (event) => {
    const { circleId } = event.params as { circleId: string };

    const circle = await db().collection("circles").doc(circleId).get();
    const hostUid = circle.data()?.hostUid as string | undefined;
    if (!hostUid) return;

    const plan = await planFor(hostUid);

    // All circles this host hosts, with current member counts.
    const hostedCirclesSnap = await db().collection("circles").where("hostUid", "==", hostUid).get();
    const hosted: HostedCircle[] = [];
    for (const c of hostedCirclesSnap.docs) {
      const members = await db().collection("memberships").doc(c.id).collection("members").get();
      hosted.push({ circleId: c.id, memberCount: members.size });
    }

    // hosted already includes the just-created membership. canAddMember checks
    // there is at least one free seat; since the new member is counted, a
    // violation means capacity was already exceeded.
    if (!canAddMember(plan, hosted.map((h) => ({ ...h, memberCount: h.memberCount - (h.circleId === circleId ? 1 : 0) })))) {
      await event.data?.ref.delete();
      logger.warn("Rejected membership over seat cap", { circleId, hostUid, plan });
    }
  }
);
