# D-152 — Native 7shifts Timesheet inbox handoff

**Status:** Implementation is on branch `cursor/seven-shifts-inbox-5958`, PR **#214**, ready for independent GPT review. Not merged. Not deployed. Not live verified. No secrets put. D1 table not applied.

This packet lets a fresh AI review the work from the named SHA without private chat memory. It is not permission to merge, deploy, put Worker secrets, apply D1, enable `SEVENSHIFTS_ENABLED`, or mutate Production.

**Paste-ready GPT review:** [`GPT_SEVENSHIFTS_REVIEW_PROMPT.md`](GPT_SEVENSHIFTS_REVIEW_PROMPT.md)

## Baseline

| Field | Value |
|---|---|
| Repository | https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app |
| Base | `main@93df0ec` |
| Branch | `cursor/seven-shifts-inbox-5958` |
| Implementation | `8bd4ad0` (feature), `8899d7c` (reverse fill + Hercules canary) |
| PR | https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/214 |
| Worksession | [`docs/worksessions/2026-08-27-seven-shifts-inbox.md`](../worksessions/2026-08-27-seven-shifts-inbox.md) |
| Decision | D-152 in [`docs/DECISIONS.md`](../DECISIONS.md) |
| Target AI | GPT / Codex as **independent High-risk reviewer**, not a second implementer |
| Decision owner | Jonathan |
| Risk | **High** (provider token, coworker PII, work hours → wage drafts) |
| Environment | Development client/Worker code only |

Confirm the SHA you actually checked out with `git rev-parse HEAD` on this branch. Do not review `main`.

## Household outcome

A Harbour worker can add a 7shifts account on Jobs. Clocked punches fill Timesheet hours, role, and clock times. Cash and card tips stay blank because 7shifts does not track them. Confirm still posts wages through `postWorkShift`. The restaurant roster is a Co-workers tab, not household members.

## Dual Course

- **Budget delta (5):** `+3` — hours arrive as a reviewable draft so wage Confirm is the remaining tap. **On this device**, a live 7shifts punch digest cannot post twice.
- **Engagement delta (3):** `+2` — Timesheet opens from the restaurant clock; Jobs shows who was on the floor. Hercules never receives the roster or the token.
- **If they conflicted:** no silent posting, no 7shifts `tips`/`hourly_wage` into the books, no minted members, no Hercules coworker dump.

## Why now

Jonathan asked for native 7shifts auto-input except tips. Zapier and Gmail parsing are refused. Access token first (Company Settings → Developer Tools). Partner OAuth and webhooks are out of this slice.

## Facts versus inferences

**Facts**

- D-127 job Timesheet / `postWorkShift` is already on `main`. 7shifts was out of that packet.
- Flinks (`/bank/flinks/*`, D-148) is the Worker template: Auth JWT + `continuity_memberships`, encrypted D1, HMAC-redacted inbox, Development-only, Production refused.
- 7shifts self-serve auth is a long-lived company Bearer token. OAuth clients are vetted partners only.
- Product law: ignore API `tips` and `hourly_wage`; Hearth job rates and the CAD pad own money meaning.
- `SEVENSHIFTS_ENABLED` is `"false"` in `wrangler.jsonc`. `SEVENSHIFTS_ALLOW_PRODUCTION` is `"false"`; setting it `true` **locks** the feature (Worker throws).
- `migrations/flinks/0002_seven_shifts_connections.sql` is reviewed input. It is not applied.
- 7shifts secrets are **not** in `wrangler.jsonc` `secrets.required`. They must never reuse Flinks keys or appear as `VITE_`.

**Inferences**

- Harbour’s live company id / user ids are unknown here; tests use fictional fixtures.
- Break objects besides `in`/`out`/`start`/`end`/`paid` may appear on a real pull.
- Two phones that Confirm the same punch before sync still merge by shift id (named October follow-up).

## What landed

| Area | Files |
|---|---|
| Worker door | `workers/sevenshifts.js`, routed from `workers/site.js` **before** Flinks: `/work/7shifts/*` |
| Routes | `GET status`, `POST probe`, `POST connections`, `GET connections`, `POST connections/:id/pull`, `DELETE connections/:id` |
| Encryption | AES-GCM AAD `sevenshifts:v1:...` with `SEVENSHIFTS_CONNECTION_ENCRYPTION_KEY`; HMAC `SEVENSHIFTS_DIGEST_KEY`; D1 table `seven_shifts_connections` on existing `hearth-flinks-development` (`FLINKS_DB`) |
| Parser | `src/core/importInbox/sevenshifts.ts` — hours, display names, empty tips, forbidden keys |
| Posting | `src/core/commands.ts` `postWorkShift` optional `sevenShiftsPunchDigest` (`s7punch_` + 64 hex) |
| Types | `src/core/types.ts` `Shift.sevenShiftsPunchDigest` — provenance only; not in `financialAuditFacts` |
| Client | `src/imports/sevenShiftsClient.ts` — Production refuses before `fetch`; Vite proxy `/work/7shifts` |
| UI | `src/SevenShiftsConnectPanel.tsx` on Jobs; `src/WorkShiftWithSevenShifts.tsx` wraps Timesheet; `src/WorkShiftFlow.tsx` optional `inboxDraft` |
| Tests | `test/sevenshifts-inbox.test.ts`, `test/sevenshifts-worker.test.ts`, `test/sevenshifts-client.test.ts`, `test/sevenshifts-connect-ui.test.ts`, plus existing `test/work-jobs.test.ts` |

Auto-input means **Timesheet / Confirm drafts**, never silent `postWorkShift` / `postShift`.

## Invariant laws

1. No punch posts wages or tips without Confirm.
2. Drafts always have `cashTips: ""` and `cardTips: ""`. Parser requires `tipsOmitted: true` and throws on tip fields, emails in coworker names, and forbidden keys (`token`, `hourly_wage`, email, phone, …).
3. Wages come from Hearth job `workRateForDate`, not 7shifts wage. Fixture: 5.08h + 0.5 paid break at $15 take-home → `wagesCents === 8370`, tips 0, trial balance holds.
4. Token never in `VITE_`, `localStorage`, household snapshot, or Hercules payload. Password input is cleared after connect.
5. Auth: same-origin/CORS + Google JWT + `continuity_memberships` (exact env/household/member/auth_user, active) before D1 **row** access and before `api.7shifts.com`. Status `SELECT 1` with no JWT is the Flinks-shaped exception.
6. Production is refused in client and Worker. Timesheet on Production renders plain `WorkShiftFlow` (no Fill).
7. Co-workers are a restaurant roster (display name + role + scheduled/punched). Do not mint members. Display names that look like emails or 7+ digits become `"Coworker"`.
8. **This-device** duplicate: a live matching digest refuses a second post; `confirmDuplicate` cannot bypass. Reverse uses `workShiftIsReversed` and restores the draft.
9. Kill criterion (D-152): any punch that posts wages or tips without Confirm, or a token/email in the snapshot or model briefing.

## Verification already recorded (do not copy as your own)

Cursor recorded:

```text
pnpm exec vitest run test/sevenshifts-inbox.test.ts test/sevenshifts-worker.test.ts test/sevenshifts-client.test.ts test/sevenshifts-connect-ui.test.ts test/work-jobs.test.ts
```

→ **25 passed** on this branch.

`pnpm check` on `8bd4ad0`: `pnpm ai:verify` green; **892 passed / 2 skipped**; `tsc --noEmit` + `vite build` green (`index-Dz5bvHKm.js`).

Cursor subagent reviews at implementation time: privacy / trust / books / verifier all **PASS WITH NOTES**. GPT must re-inspect code and tests, not rubber-stamp those notes.

## Out of scope (do not silently expand)

- Silent auto-post, Zapier, Gmail parsing
- Reading 7shifts `tips` or `hourly_wage` into the books
- Minting household members from the roster
- Hercules coworker dump or token in any model payload
- OAuth partnership, webhooks, Production flag
- `wrangler secret put`, remote D1 apply, kitchen deploy
- Two-phone digest merge (`canAbsorbDisjointSharedMoney`) — named October follow-up

## Named residuals

1. **Two-phone digest merge (October):** two devices Confirm the same punch before sync → two shift ids, same digest, both wages survive `mergeRecords` by `shift.id`. D-152 claim is **this-device**.
2. **Coworker pull breadth:** Worker lists company shifts for 14 days, cap 40 names. Not limited to the member’s location/worked days. Session-only React state.
3. **Live smoke gated:** Jonathan must put `SEVENSHIFTS_CONNECTION_ENCRYPTION_KEY` and `SEVENSHIFTS_DIGEST_KEY`, apply D1 `0002`, set `SEVENSHIFTS_ENABLED=true`, then deploy, then paste a Harbour Developer Tools token.
4. **Break shapes:** only `in`/`out`/`start`/`end`/`paid` handled.
5. **No live UI proof:** feature is off on the kitchen; local Vite proxies `/work/7shifts` to the live Worker, which does not have these routes until deploy. Do not claim 320/390/720/1100 visual proof.

## Data and environment disclosure

- Development client/Worker code only
- No Production, no hosted SQL, no `wrangler secret put`, no kitchen deploy
- Tests use fictional Harbour fixtures
- Token never committed
- D1 migration is reviewed input, not applied
- Reuses Development D1 `hearth-flinks-development` for the **table only**; encryption keys stay `SEVENSHIFTS_*`

## Next owner

1. **Now:** GPT / Codex independent review using [`GPT_SEVENSHIFTS_REVIEW_PROMPT.md`](GPT_SEVENSHIFTS_REVIEW_PROMPT.md).
2. **After a PASS (or PASS WITH NOTES that Jonathan accepts):** Jonathan puts secrets, applies D1 `0002`, enables the flag, deploys, then Harbour token smoke.
3. Do not merge as shipped. Do not call the kitchen live until deploy + token smoke.

## Expected return from GPT

A written review that a fresh implementer can act on: verdict, P0/P1/P2 findings with file paths, Dual Course check, confirmation that named residuals were **not** silently expanded, and the smallest next action. Do not open a second implementation branch unless Jonathan orders a repair.
