# Hearth worksession — Kitchen desk release

- **Status:** OPEN — release authorized; remote gates pending
- **Opened:** 2026-08-29 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex (GPT), release coordinator
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/kitchen-desk-integration`
- **Baseline SHA:** `4b2f40064b526541ef7a20d6e99fc99ca5647baa`
- **Verified candidate SHA:** `264848bf1d2e0dc100d945bf5a16a704ad7dba0d`
- **PR or issue:** new integration PR pending; source UX draft PR #244
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** Production website code; no Production ledger data, schema, secrets, or provider configuration

## Household outcome

Publish one Hearth kitchen in which the paper desk, Personal Books, Kitty Banks, Shift mail, Evidence, attendance, Bibles, boot recovery, and Confirm-only money boundary work together.

## Budget delta (5)

`+5` — scoped Books presentation/export, accepted-snapshot writes, double-entry truth, and visible Confirm survive the integrated release.

## Engagement delta (3)

`+2` — the existing desk grammar gains Shift mail and current-main instruments without becoming a second product skin.

## Verified baseline

- Jonathan explicitly instructed Codex to `push merge and deploy` on 2026-08-29.
- `origin/main` was re-fetched immediately before authorization and remained `4b2f40064b526541ef7a20d6e99fc99ca5647baa`.
- Candidate `264848bf1d2e0dc100d945bf5a16a704ad7dba0d` contains both exact ancestors: current main and UX head `ed708dc358ed808fbc5a9ec89b6c95bdb9a55a60`.
- Books, privacy, UX, trust, and verifier reviews found no open P0–P2.
- Final local `pnpm check`: 175 test files passed / 1 skipped; 1182 tests passed / 2 skipped; TypeScript, Vite, Hercules Pro UI, and `_redirects` absence passed.
- Browser proof used fictional local Development demo data only at 1100, 720, 390, and 320 px.

## Scope

### In scope

- Run a fresh exact-SHA release review and secret/private-artifact scan.
- Push the reviewed branch, open a reviewable PR, confirm GitHub checks, merge to `main`, and verify the Cloudflare publication and live kitchen.
- Record exact remote SHAs, workflow/deployment evidence, and live HTTP/UI evidence.

### Out of scope

- Supabase or D1 migrations, `books:apply`, secret changes, provider permission changes, Production ledger data, hosted household rows, credential rotation, or clasp.
- Feature edits beyond a release-blocking repair that would require a new exact-SHA review.

## Acceptance evidence

- [x] Local exact-SHA implementation, books, privacy, UX, trust, and verifier gates complete.
- [x] Full local test/build gate green.
- [ ] Diff and tracked-file private-artifact/secret scan green on the release SHA.
- [ ] Branch pushed and PR checks green on the same reviewed SHA.
- [ ] PR merged to the then-current `main` without skipping newer work.
- [ ] Cloudflare deployment green and live kitchen verified from the merged SHA.
- [ ] No schema, secret, provider configuration, or household-data mutation occurred.

## Plan

- [x] Record Jonathan's release authority and current exact SHAs.
- [ ] Commit this release record and obtain a read-only release verdict.
- [ ] Push branch and open PR.
- [ ] Wait for GitHub checks; merge only on green exact evidence.
- [ ] Verify deploy workflow, Cloudflare/live HTTP, and visible kitchen.
- [ ] Close the release record with exact remote evidence.

## Evidence log

- Local integration worksession: [`2026-08-29-kitchen-desk-main-integration.md`](2026-08-29-kitchen-desk-main-integration.md).
- No remote mutation had occurred when this release worksession opened.

## Decisions

- Jonathan's explicit `push merge and deploy` instruction authorizes these remote actions after the release gates.
- Provider credentials, permissions, migrations, secrets, and household data remain separately gated and will not be changed to force a deployment.

## Remaining uncertainty

GitHub PR/check state, Cloudflare provider permission, deployment workflow result, and live publication are not proven until observed on the remote merged SHA.

## Handoff

Codex remains release coordinator until the remote merge and live publication are either verified or truthfully blocked.
