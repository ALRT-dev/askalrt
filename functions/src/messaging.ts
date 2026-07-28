/**
 * Push fan-out helper. Per-user device tokens (§5): no circle topics — the
 * function reads circle membership and fans out to each member's tokens.
 *
 * Token source: pushTokens/{uid} = { tokens: string[] }.
 * Membership source: memberships/{circleId}/members/{uid}.
 */
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";

const db = () => admin.firestore();

export interface PushPayload {
  title: string;
  body: string;
  /** Data keys must be strings (FCM requirement). */
  data?: Record<string, string>;
  /** iOS interruption level; SOS/critical use "time-sensitive"/"critical". */
  level?: "active" | "time-sensitive" | "critical";
}

export async function memberUids(circleId: string, excludeUid?: string): Promise<string[]> {
  const snap = await db().collection("memberships").doc(circleId).collection("members").get();
  return snap.docs.map((d) => d.id).filter((uid) => uid !== excludeUid);
}

async function tokensForUsers(uids: string[]): Promise<string[]> {
  if (!uids.length) return [];
  const refs = uids.map((uid) => db().collection("pushTokens").doc(uid));
  const docs = await db().getAll(...refs);
  const tokens: string[] = [];
  for (const doc of docs) {
    const arr = (doc.data()?.tokens as string[] | undefined) ?? [];
    tokens.push(...arr);
  }
  return Array.from(new Set(tokens));
}

/** Fan a notification out to every member of a circle. Returns tokens targeted. */
export async function fanOutToCircle(
  circleId: string,
  payload: PushPayload,
  excludeUid?: string
): Promise<number> {
  const uids = await memberUids(circleId, excludeUid);
  const tokens = await tokensForUsers(uids);
  if (!tokens.length) {
    logger.info("No device tokens for circle fan-out", { circleId });
    return 0;
  }

  const apnsLevel = payload.level ?? "active";
  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data ?? {},
    apns: {
      payload: { aps: { "interruption-level": apnsLevel } },
    },
    android: {
      priority: apnsLevel === "active" ? "normal" : "high",
    },
  });

  if (res.failureCount) {
    logger.warn("Some pushes failed", { circleId, failureCount: res.failureCount });
  }
  return tokens.length;
}
