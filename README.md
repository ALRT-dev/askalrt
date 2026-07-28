# ALRT V2 — Backend Updates

Portable Firebase package building the ALRT V2 server side from the
`design_handoff_alrt_v2` specs, in two passes:

- **Pass 1 — reconciliation** (the two open items from `reconciliation-notes.md`):
  XP v1.1 tiers/badges and the family-sharing 2-state model.
- **Pass 2 — core safety functions** (§2): SOS lifecycle, snapshot proximity,
  RevenueCat entitlements webhook, and free-cap/seat enforcement, plus the pure
  logic they depend on (proximity §32, seat accounting §22, emergency-number
  resolution §16, snapshot lifecycle §30).

## Pass 1 — reconciliation items

Verified against the live prototype:

1. **XP v1.1 event types** — the prototype shows `+15` (report corroborated),
   `+10` (widely corroborated) and "earns no points" on the corroboration
   sheet. This implements the v1.1 points table, badges, and the
   corroboration-driven award flow. See `functions/src/constants/xp.ts`.
2. **Family-sharing 2-state model** — the prototype only ever exposes
   `snapshot` + SOS-only `live share`. This narrows the legacy 4-level enum to
   the locked 2-state model and rejects any persistent/continuous person-tracking
   at both the function layer and in `firestore.rules`. See
   `functions/src/constants/sharing.ts`.

Two locked product rules are enforced structurally, not just by convention:

- **No leaderboard.** XP, level and corroboration counts are private and
  own-user-only. There is no rankable public projection, no collection-group
  ordering, and no cross-user XP read path. Points reward accuracy, never
  volume (product-rules §9).
- **No persistent person monitoring.** The only continuous location stream is
  the SOS live share (owner-initiated, circle-only, hard 4h cap). Any write
  attempting a `continuous`/`persistent` person share is rejected.

## Pass 2 — core safety functions (§2)

| Function | Trigger | Does |
|---|---|---|
| `onSnapshotWrite` | create `snapshots/{c}/items/{id}` | evaluate active official ACTION/CRITICAL alerts against the point (§32); push ONE age-aware near-alert notice to the circle |
| `onSosStart` | create `sosEvents/{c}/events/{id}` | create the SOS-bound live-share session (4h cap); fan out time-sensitive push to all other members |
| `onSosEnd` | update (endedAt set) | delete the live session (last point gone, not archived); push "SOS ended" |
| `autoStopExpiredLiveShares` | schedule, every 5 min | hard-stop any live session past its 4h cap |
| `revenuecatWebhook` | HTTPS | verify signature, upsert `entitlements/{uid}` (client never writes plan) |
| `enforceSavedLocationLimit` | create `savedLocations/{uid}/items/{id}` | delete adds over the free cap (1, grandfathered) |
| `enforceSeatLimit` | create `memberships/{c}/members/{uid}` | delete memberships over the host's seat cap (§22) |

## Layout (Firebase-canonical — drop into your repo or commit as-is)

```
firebase.json            emulator + deploy + remoteconfig config
firestore.rules          2-state sharing, private-XP/no-leaderboard, circles/SOS/entitlements
firestore.indexes.json   composite indexes for the two aggregate queries
remoteconfig.template.json  kill-switches (§8), proximity_radii (§32), emergency_numbers (§16)
functions/
  src/
    constants/  xp.ts  sharing.ts  proximity.ts  seats.ts
    lib/        PURE, unit-tested: xpLogic, sharingLogic, geo, proximityLogic,
                seatLogic, emergencyLogic, snapshotLogic
    xpAward.ts corroboration.ts sharingGuard.ts   (pass 1)
    snapshots.ts sos.ts entitlements.ts limits.ts messaging.ts  (pass 2)
    types.ts  index.ts
  test/         Jest unit tests for every lib/* module (no emulator needed)
```

## Pass 3 — Ask ALRT assistant (library-first, minimal AI)

`askAlrt` answers in three tiers, using AI as little as possible:

1. **Pre-written library** (`askalrt/entries.ts` + `matching.ts`) — a keyword/
   phrase matcher answers common questions with ZERO AI. Unlimited, no quota.
2. **Emergency-number lookup** — country + intent detected locally and answered
   from the resolved number table. ZERO AI, unlimited.
3. **AI fallback** (`claude-haiku-4-5`, the cheapest model) — only the long tail
   that tiers 1–2 miss. This is the **only** path that spends money or the quota.

**AI-question limits:** 3/day free, 20/day ALRT+ (`AI_DAILY_LIMIT` in
`askAlrt.ts`; counted in `agentUsage/{uid}/days/{yyyymmdd}.aiCount`). Library and
emergency-lookup answers never count against it.

- The **system prompt was tightened**: the hardcoded "000 in Australia" is gone
  (the emergency number is passed in per request per §16), and an explicit
  "no en-dashes" output rule was added (§9). See `askalrt/systemPrompt.ts`.
- Enforced: **App Check** required, **refusal handling** (`stop_reason`), and
  **no transcript logging** — only content-free counts (§18 privacy).
- The assistant **cannot see the live feed** — the app must pass any alert facts
  in `context`; the prompt forbids inventing others.
- **Editing answers without a release:** the seed library lives in code today;
  move it to a Firestore collection / Remote Config and merge over the seed when
  you want to add answers without shipping a build.

## Deploy prerequisites (pass 2 & 3)

- **RevenueCat secret** — the webhook checks the `Authorization` header:
  ```bash
  firebase functions:secrets:set REVENUECAT_AUTH
  ```
  then set the same value as the Authorization header in the RevenueCat dashboard.
- **Anthropic API key** — for Ask ALRT:
  ```bash
  firebase functions:secrets:set ANTHROPIC_API_KEY
  ```
  Model is `claude-opus-5`; the system prompt is prompt-cached, so repeat
  questions are cheaper. App Check must be configured for the app to call it.
- **Firestore TTL** — the 60-min snapshot delete and 4h live-share expiry rely on
  a TTL policy, not code. Enable TTL on `snapshots` `expiresAt` (and optionally
  `liveShareSessions` `expiresAt`) via console or:
  ```bash
  gcloud firestore fields ttls update expiresAt --collection-group=items --enable-ttl
  ```
- **Indexes** — `firebase deploy --only firestore:indexes` (the two composite
  indexes are required by `autoStopExpiredLiveShares` and `onSnapshotWrite`).

## Build, test, commit

```bash
cd functions
npm install
npm run build      # tsc — must pass clean
npm test           # jest unit tests (pure logic, no emulator)
```

Rules + trigger integration test against the emulator (optional):

```bash
firebase emulators:start --only firestore,functions
```

Then `git add . && git commit` from the folder you dropped this into.

## What this deliberately does NOT do

- No streaks, no upvote mechanic, no `first_confirm`/`first_vote` badges
  (retired in v1.1; already-earned badges are grandfathered, never revoked).
- The confirmer of a corroboration earns **0 XP** — only the report author is
  rewarded, and only when the 3rd / 9th confirmation lands.
- Does not build the non-safety §14–§20 adoption/localisation/widget surfaces,
  the Ask ALRT assistant, share-link OG pages, Route Check/Travel Mode, or the
  parked IoT layer (§33). Those remain available as a later pass.

## Assumptions flagged for review

- The **legacy 4-level enum** values are not enumerated in the handoff, so
  `constants/sharing.ts` infers them (`none | snapshot | temporary | continuous`)
  and maps them to the 2-state model. If your live data uses different legacy
  labels, adjust `LEGACY_SHARING_MAP` — the canonical target states do not change.
- **Level thresholds** (levels 1–10) are carried from v1.0 as configurable
  constants; the handoff notes they may need tuning after 4 weeks of live data.
- **Counters have a single writer.** `corroborationsReceived` / `accurateReports`
  are written only by `awardXp` (via `counterDeltas`), so they advance at the
  award milestones (3rd and 9th confirmation) rather than being re-tallied on
  every individual confirm. This keeps the write path atomic and free of
  double-counting; if you later want an exact running total per confirmation,
  move the tally into the corroboration transaction and make it the sole writer
  of those fields.
- **Concrete subcollection names.** The handoff's path notation is loose
  (e.g. `snapshots/{circleId}/{snapId}`). This package pins concrete
  subcollections — `snapshots/{circleId}/items/{snapId}`,
  `liveShareSessions/{circleId}/sessions/{sosId}`,
  `xpEvents/{uid}/events/{eventId}`,
  `corroborations/{reportId}/confirms/{uid}` — kept consistent across the
  triggers and `firestore.rules`. Rename in one place if your schema differs.

## Verification status

Written and statically reviewed. **Not compiled/tested on this machine** — it
has no Node toolchain installed. Run `npm install && npm run build && npm test`
in `functions/` (Node 20) to confirm before committing; the unit tests
(7 suites covering every `lib/*` module) need no emulator. The Firestore-facing
triggers are best exercised against the emulator (`npm run serve`).
