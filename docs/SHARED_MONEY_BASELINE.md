# Shared Money capability baseline

> **SF-01 result:** originally reconciled on 2026-08-30; continuity truth updated for the local D-180 pilot from exact `origin/main@3e48bcc3ca3919d8663c2f1ab1dfbd5a5cfda7cf` on 2026-08-31 (Toronto).
>
> **Machine-readable companion:** [`shared-money-baseline.json`](shared-money-baseline.json).
> **Evidence rule:** “shipped” requires current-main code and tests plus named runtime evidence for a hosted or live claim. A flag, migration file, or historical deployment is not by itself current runtime proof.

This baseline separates what Hearth can prove today from D-174’s future Shared Money direction. It does not authorize a provider, bank feed, account, card, standing rule, schema apply, Production mutation, money movement, or background financial post.

## Executive finding

Hearth already has a strong local books and Development continuity spine: visible Confirm, typed commands, balanced PGlite journals, durable local persistence/outbox, authenticated membership-scoped transport, atomic Shared plus Personal publication, Development Realtime, and command-log support. The recorded Development two-phone Realtime smoke met the 100–500 ms target, and G6/T1-S6 evidence is complete.

The product is not yet a shared bank account app. Opening truth is absent; Production continuity has no runtime proof; D-180's complete two-account matrix and fourteen-day rehearsal are still open; current D-141 import code has not been verified in the currently served bundle; D-162 Fund-specific connected evidence remains read-only and Release-gated; notifications have no consented delivery fabric; and D-172 still requires visible Confirm for every financial write.

| Capability | Current status | Development truth | Production truth | Nearest blocker |
| --- | --- | --- | --- | --- |
| Identity | Partial | Google Auth and exact-subject bind recorded live | Build path exists; identity/recovery runtime unverified | Complete signed-in lifecycle and negative smoke |
| Membership | SF-02 Development-verified; deploy-gated | Migration 017 applied; two-principal hosted authority matrix passed and rolled back; semantic access UI passed at 320/390/720/1100 | Schema present with 0 Production households at apply; no Production identity/recovery proof | Merge/deploy, live-origin sign-in/access panel, rendered keyboard/screen-reader proof |
| Continuity | D-180 implemented locally; live pilot gate open | Command-normal path, explicit same-fact review, redacted diagnostic, historical Realtime/G6 evidence; new 100-event matrix and fourteen-day rehearsal pending | Pilot build gate is off; discovery/transport/Realtime refused; no Production smoke | Approved Development deploy, full live matrix, fourteen-day exit gate |
| Opening truth | Absent | No accepted opening-books command | Absent | SF-04 semantics, UX, journal, provenance, and correction proof |
| Batch imports | Current-main, review-only | D-130 live history; D-141 code on current main; current served bundle unverified | Selected-file review only; no feed or credentials | Verify served bundle and combined import smoke |
| Household Fund / connected evidence | Practice plus read-only evidence | D-161 Fund and D-148 Flinks inbox recorded live; D-162 Fund-specific use gated | Fund remains virtual; Flinks refused | Institution support, exact-match privacy proof, separate Release approval |
| Notifications | Local/client only | In-app Calendar, ICS, optional Google event | Same client surface; no Web Push, email, or SMS fabric | SF-03 consent, delivery, privacy, receipts, quiet hours |
| Financial writes | Visible Confirm boundary | D-172 supersedes D-159 automatic posting | Same law; no rules, auto-settlement, or rail | Later explicit authority decision after controls and proof |

## End-to-end traces

### Identity and membership

`App` and the Supabase Google session establish an environment-scoped JWT. `Pairing` and membership clients call owner/member RPCs for issue, redeem, revoke, leave, delete, or Development reset. Applied migrations 006, 010, 015, and 016 bind access to authenticated membership and RLS. None of these paths posts a journal entry.

The two-device QR flow passed historically. SF-02 implements co-owner/ordinary-member invitations, session-backed device inventory and revoke, protected co-owner/last-owner transitions, voluntary leave/rejoin consequences, metadata-only access audit, and an Auth phone identity lock. Migration 017 is applied, and a transactional hosted smoke with two distinct Google principals passed invite replacement/replay, anonymous and wrong-household denial, RLS isolation, device/member revoke, Personal-seat reuse denial, leave/last-owner behavior, and sanitized audit before rolling back all synthetic state. Semantic access-panel tests passed at 320/390/720/1100 px. Rendered live-origin, keyboard, screen-reader, and full two-device recovery remain narrower runtime evidence. Development delete/reset remains separate and explicitly refused in Production.

### Continuity

The accepted path is:

`visible Confirm -> typed command -> PGlite journal/hash -> durable local snapshot/outbox -> migration 012 atomic snapshot or migration 013 command event -> Development Realtime 014 -> inbound PGlite acceptance`.

Development has recorded atomic Shared+Personal, Realtime, command-log, freshness, G6, and historical two-phone latency evidence. D-180 makes command events the normal pilot path and reserves snapshots for creation, catch-up, revision gaps, and integrity repair. Four-second polling remains a fallback, not the primary Development path. True same-fact divergence preserves both versions for explicit review.

The local D-180 deployment workflow bakes Google Auth, Development Realtime, and command log on while baking `VITE_PRODUCTION_CONTINUITY=0`. The runtime policy refuses all Production continuity and pilot diagnostics. This branch is not deployed, and no Production restore/write smoke is recorded. The exact live matrix and rehearsal are in [`SYNC_PILOT.md`](SYNC_PILOT.md).

### Opening truth

There is no opening-balance UI, typed command, accepted PGlite journal path, outbox event, hosted RPC, or runtime proof. Statement opening values and the D-161 Fund’s zero opening do not establish account opening truth. SF-04 must define immutable provenance, balanced opening-equity semantics, correction by adjustment/reversal, and first-run proof before this status can change.

### Batch imports

The current path is:

`Books Import -> on-device QFX/OFX or user-selected image -> staged reconciliation -> final Confirm -> ordinary postEntry/postTransfer -> accepted books and continuity`.

D-130’s review flow has named deployment history. D-141 exact statement/receipt reconciliation is present on current main, including available-balance equations and exact unique payment matching, but SF-01 did not prove it is in the currently served bundle. Imports remain selected-file, review-first inputs; they do not add bank credentials or a feed.

### Household Fund and Flinks evidence

D-161 is an append-only virtual operating subledger. Money remains in Bianca’s savings; Hearth does not hold or move it. Fund proposals and confirmed events project through PGlite and Shared/Personal continuity with the established custodian and privacy rules.

The Development Flinks Connect inbox from D-148 is separately recorded live behind authenticated member scope, encrypted D1 storage, and Worker secrets. `FLINKS_ENABLED=true`, `FLINKS_ALLOW_PRODUCTION=false`, and `EVIDENCE_AUTOMATION_ENABLED=false`. D-162 does not disable all provider evidence; it keeps Fund-specific connected use read-only, institution/account-specific, and Release-gated. An unmatched row never creates or changes money.

### Notifications

Hearth can derive recurrence and Calendar facts into an in-app preview, an optional Google Calendar event, or an ICS export. It has no Web Push subscription/service-worker delivery fabric, email or SMS delivery, per-member channel consent ledger, quiet hours, redaction policy, delivery receipts, or escalation model. A reminder is attention only and never financial authority.

### Financial writes

Current law is:

`draft -> visible Confirm -> typed command -> balanced journal/PGlite/hash/persist -> authenticated idempotent transport`.

D-172 supersedes D-159 automatic posting. `EVIDENCE_AUTOMATION_ENABLED=false`, and D-174 adds no execution flag. No schedule, OCR result, AI suggestion, provider callback, notification, or background job may post money. Corrections append reversal/repost work; they do not silently rewrite history.

## Environment, owner, and rollback truth

- Development and Production remain different ledger environments. Development runtime evidence never proves Production.
- Jonathan owns every Production, provider, authority-expansion, and Release decision. Household owners control invite/revoke; members may leave; Bianca remains D-161 custodian.
- Rollback preserves accepted local books and outbox. Feature flags may disable hosted transport, Realtime, command log, or Development Flinks without rewriting journals.
- Staged imports can be discarded before Confirm. Confirmed mistakes use reversal/repost.
- Unknowns remain explicit in the machine-readable matrix; they are not inferred from adjacent code or older deployment history.

## SF-02 Development result and next gate

SF-02 is implemented and its hosted Development authority matrix is verified without widening financial-write authority. Migration 017 was applied while the shared project contained 2 Development and 0 Production households; the smoke left 0 synthetic households, 0 registered sessions, and 0 audit events. The final release gate is the already-authorized merge/deploy plus live-origin Google configuration and signed-in access-panel verification. Rendered keyboard and screen-reader evidence remains explicit follow-through, not a reason to overstate the transactional authority smoke. The next feature packet is **SF-03 — consented attention and notification fabric**.
