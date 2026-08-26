# Working memory — current kitchen recap

This file is a **chat-thread orientation**, not a second canon and not a license to skip GitHub.

**GitHub is the durable project context (D-095).** Read [DECISIONS.md](DECISIONS.md), merged PRs, living specs, [nostalgia/](nostalgia/), and [reference/](reference/). Do not treat unfinished chat as `main`. Do not tell another model to ignore museum folders — they are history to read, never the next plan.

Living plan: Jonathan's latest instruction → [CLOUD_CONTINUITY.md](CLOUD_CONTINUITY.md) → [HEARTH_ROADMAP.md](HEARTH_ROADMAP.md) → [STRATEGY.md](STRATEGY.md).

Branch tip when this was rewritten: **`cursor/atomic-continuity-tx-7270`** (D-148 T1-S1/S2 atomic Personal+Shared on PR #159 lineage; not yet merged to `main`). Kitchen: Development. No clasp. No production Sheet. Dual Course: books **5**, engagement **3**, books win.

Household-only files (`Project Context.txt`, ODS, credentials) stay **local** (D-018).

---

## What is true now (not #53-era)

- **Auth/RLS:** Migration **006 is applied**. Anon household REST is revoked. Access is membership-bound. Do **not** say hosted RLS is still `USING (true)`.
- **Continuity:** Google sign-in is the ordinary door (D-114/D-117/D-143/D-147). Automatic transport requires `transportRequested` from a continuity membership path; `linked` alone does not publish. Phrase / Hearth Pass / legacy Publish are **Advanced recovery** (Auth-off only).
- **CAS / atomic push:** Development `publish_household_snapshot` is live (D-122). **Auth sessions** use Migration **012** `publish_continuity_snapshot` — Shared + Personal in one SQL TX (D-148 T1-S1/S2). Auth-off Advanced recovery keeps the two-trip bridge; partial Personal failure must not ack (D-147). Auth/continuity paths refuse legacy GET-compare-POST when CAS/012 RPC is missing.
- **Hercules talk:** **Model-first** for unmatched journal talk (D-104) through the locked Worker; grounded on-device talk is the fallback. **18-row** visibility-filtered ledger excerpt (D-105). Member-scoped disclosure projection (D-115/D-116). FIGURES are grounded CAD only (D-112).
- **Office / mobile:** Phone `<720px` is glance + one-tap (`OfficePhone`); wide is the customizable office. Theme packet: [HEARTH_UI_THEME.md](HEARTH_UI_THEME.md).
- **Rate limit:** 60/IP/UTC day (D-121). KV binding is the durable production path; create + paste ids per [HERCULES_KV_BINDING.md](HERCULES_KV_BINDING.md). Isolate memory is fallback, not a global hard cap.
- **Branch protection:** Not yet applied in GitHub. Owner steps: [GITHUB_BRANCH_PROTECTION.md](GITHUB_BRANCH_PROTECTION.md).

---

## Orientation — last five capability chapters (use roadmap for full list)

1. **U-08 Hercules AI Phase 1** — model-first intent, 18-row excerpt, typed memory. Evidence on roadmap.
2. **U-09 Google-account cloud continuity** — discovery, outbox, membership, Personal scope, Dev CAS, **atomic 012 push (Auth)**. Still finishing Create/invite smoke and two-device E2E.
3. **U-10 Command states** — honest Confirm chrome (PR #76).
4. **D-127 job-based work** — Timesheet / Confirm / Calendar settlement.
5. **D-130/D-137 batch import + reconciliation** — QFX/OFX + selected images; exact receipt math.

Kill criteria still in force: milk one Confirm; phone five objects; leftover is not month net; Hercules never posts money.

---

## Still true

- Hercules never `postEntry`. Confirm still posts.
- Leftover formula frozen (D-083). Vault is a destination.
- Transfers are not income/expense. Card paydown is a transfer.
- Void deletes nothing (D-085).
- Widget layout is this-phone (or this Google identity’s desk JSON). Never the household snapshot.
- Bank / Interac / issued cards wait on Auth + RLS foundation + their own gates.
- Third-party model keys: Worker secrets only, never `VITE_`.
- America/Toronto books civil. CAD integer cents. Jonathan is product owner.

---

## Open Phase 0 leftovers (after D-147 client/docs)

- Jonathan: create `HERCULES_RATE` KV + deploy Worker with real ids.
- Jonathan: apply GitHub ruleset from [GITHUB_BRANCH_PROTECTION.md](GITHUB_BRANCH_PROTECTION.md).
- Live two-browser continuity E2E; signed-in Create/invite smoke.
- Merge PR #159 (D-148 Tier 1: atomic 012 + Realtime T1-S3) or land T1-S1/S2 alone if Realtime should wait.

## Next recommended action

Review PR #159 / `cursor/atomic-continuity-tx-7270`. Confirm Migration 012 is applied on Dev if not already. Create KV + apply branch protection when ready. Default experiments to Development. Do not clasp. Do not touch Production without explicit approval.
