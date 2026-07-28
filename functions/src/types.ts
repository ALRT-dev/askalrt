import type { firestore } from "firebase-admin";
import { XpEventType } from "./constants/xp";

/** users/{uid} — the private profile totals. Never exposed cross-user. */
export interface UserProfile {
  xpTotal: number;
  level: number;
  badges: string[];
  /** Number of "Yes, I can see it" confirmations this user's reports received. */
  corroborationsReceived: number;
  /** Number of this user's reports that reached corroborated (>=3) status. */
  accurateReports: number;
}

/** xpEvents/{uid}/{eventId} — append-only ledger, Cloud Function writes only. */
export interface XpEvent {
  type: XpEventType;
  amount: number;
  /** The entity the award is scoped to (reportId, referredUid, etc.). */
  refId: string | null;
  createdAt: firestore.FieldValue | firestore.Timestamp;
}

/** Result of applying an award, returned for logging/testing. */
export interface AwardResult {
  applied: boolean;
  reason: "applied" | "duplicate" | "zero_amount";
  eventId: string;
  amount: number;
}
