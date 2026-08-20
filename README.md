# Ask ALRT — assistant service

Firebase package hosting the **Ask ALRT assistant** (and the RevenueCat
entitlement webhook that sets its paid quota). This is the only thing this
repo does.

> **The app's backend is `ALRT-dev/backendV2`** (api.safetyalrt.com) — hazards,
> family circles, SOS, XP/scoring, location sharing and proximity alerts all
> live there. Earlier duplicate Firebase implementations of those domains were
> removed from this repo in the Aug 2026 repo audit (see git history if you
> ever need them back).

## Ask ALRT assistant (library-first, minimal AI)

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

- The system prompt passes the emergency number in per request (never hardcodes
  "000"), and enforces a "no en-dashes" output rule. See `askalrt/systemPrompt.ts`.
- Enforced: **App Check** required, **refusal handling** (`stop_reason`), and
  **no transcript logging** — only content-free counts.
- The assistant **cannot see the live feed** — the app must pass any alert facts
  in `context`; the prompt forbids inventing others.

### Editing answers without an app release

The seed library ships in code as a permanent fallback; **Firestore overrides
merge over it**, so you can add/edit answers from the Firebase Console with no
build. Collection `askAlrtEntries`, one document per answer:

| Field | Type | Notes |
|---|---|---|
| (document id) | — | Reuse a seed id (e.g. `pricing`) to edit that answer; a new id adds a new one |
| `triggers` | array of strings | Phrases that should surface this answer (a phrase hit is a strong match) |
| `keywords` | array of strings | Single words; several overlapping words also match |
| `answer` | string | The exact text shown to the user |
| `enabled` | boolean | Set `false` to hide a seed answer |

Merge/validation is in `askalrt/entriesLoader.ts` (unit-tested); the library is
cached ~5 minutes, so edits take effect within a few minutes. A malformed doc is
ignored and the seed answer is kept.

## Entitlements webhook

`revenuecatWebhook` (HTTPS) verifies the `Authorization` header and upserts
`entitlements/{uid}` with plan `free`/`plus`. Here it is used **only** to pick
the Ask ALRT daily quota. The app-facing ALRT+ entitlement (gating who can host
a family circle) must live in `backendV2` — see `widget/MASTER_HANDOFF.md`.

## Layout

```
firebase.json               emulator + deploy + remoteconfig config
firestore.rules             entitlements, agentUsage, askAlrtEntries only
firestore.indexes.json      (none needed)
remoteconfig.template.json  agent_enabled kill-switch
functions/
  src/
    askalrt/    askAlrt.ts entries.ts entriesLoader.ts matching.ts systemPrompt.ts
    lib/        emergencyLogic.ts
    entitlements.ts  index.ts
  test/         Jest unit tests (no emulator needed)
```

## Deploy prerequisites

- **RevenueCat secret** — the webhook checks the `Authorization` header:
  ```bash
  firebase functions:secrets:set REVENUECAT_AUTH
  ```
  then set the same value as the Authorization header in the RevenueCat dashboard.
- **Anthropic API key** — for Ask ALRT:
  ```bash
  firebase functions:secrets:set ANTHROPIC_API_KEY
  ```
  Model is `claude-haiku-4-5`; the system prompt is prompt-cached, so repeat
  questions are cheaper. App Check must be configured for the app to call it.

## Build, test

```bash
cd functions
npm install
npm run build      # tsc — must pass clean
npm test           # jest unit tests (pure logic, no emulator)
```

## Verification status

Statically reviewed; run `npm install && npm run build && npm test` in
`functions/` (Node 20) to confirm before deploying.
