# Hearth worksession — Gmail 7shifts review and confirmed shift writing

- **Status:** CLOSED; MERGED #239; LIVE
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** Hearth / Budget App
- **Branch:** `codex/gmail-shift-review`
- **Baseline SHA:** `7e5dc88917e07dfb513d8bf578ac3f244377a78b` after current-main reconciliation
- **Head SHA:** reviewed `51dd716`; merged `d85ba80`
- **PR or issue:** D-163 (renumbered from local D-161 during current-main reconciliation)
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** Development and Production Evidence schema parity; app/Worker deployment

## Household outcome

Jonathan can explicitly connect Gmail read-only, import only genuine 7shifts messages into his encrypted member Evidence vault, ask Hercules Pro to review the reduced shift facts, and explicitly confirm an eligible worked shift through Hearth's ordinary work and double-entry commands. Published schedules remain outlook only.

## Budget delta (5)

`+5` — reviewed worked evidence can reach the ordinary job-rate, overtime, tip-out, receivable, audit-hash, command-receipt, and PGlite-compatible household path.

## Engagement delta (3)

`+3` — the flow begins with a natural Hercules request and ends with a sealed, human-confirmed shift preview instead of a second financial UI.

## Verified baseline

- `origin/main@3740c5c3c78f1f874c5b7ce38c1b572a6e465d06` is the clean branch baseline.
- Hearth already requests Gmail with `gmail.readonly`, has the encrypted Evidence D1/R2/Queue plane, and has sealed Hercules Pro transaction previews.
- Read-only browser review found 33 7shifts schedule-publication messages in 2026, 25 approval/trade/time-off notifications, no 7shifts attachments, and no worked timesheet/tip report in that bounded search.
- A representative schedule publication contained four FOH server outlook shifts. Exact private schedule details are intentionally not committed.

## Scope

### In scope

- Direct Gmail API import initiated by Jonathan in Hearth.
- Exact 7shifts sender verification, pagination bounds, cancellation, raw-message encryption, and digest deduplication.
- Schedule-email extraction as outlook-only Evidence.
- Hercules Pro reduced email-evidence review.
- Sealed preview and explicit confirmation for eligible worked Evidence bundles only.
- Adversarial and regression proof.

### Out of scope

- Cloudflare Email Routing, forwarding aliases, mailbox rules, background mailbox surveillance, Gmail modify/send scopes, passwords, cookies, or bearer-token capture.
- Treating schedule, trade, time-off, notification email, OCR alone, or model interpretation as worked-time or money authority.
- Production activation, secrets, hosted schema application, deploy, push, or merge without the relevant gate.

## Acceptance evidence

- [x] Gmail importer adds only Gmail read access to the existing Google session, uses a fixed 7shifts query, exact sender-domain validation, bounded pagination, and abort propagation.
- [x] Imported RFC822 is encrypted in the member vault and duplicate raw messages do not create duplicate captures.
- [x] Schedule messages normalize to outlook facts and cannot become eligible worked bundles.
- [x] Hercules receives reduced facts without raw mail, names, notes, hashes, provider ids, or Evidence object ids.
- [x] Eligible worked bundles can be prepared but cannot post before an explicit sealed confirmation.
- [x] Shift confirmation uses `postWorkShift`, command identity, audit hash, ordinary snapshot publication, and exactly-once receipt recovery.
- [x] Full local proof set and release review are recorded.

## Plan

- [x] Reconcile on current `origin/main` and open a clean branch.
- [x] Bound and record the historical read-only Gmail review.
- [x] Implement direct Gmail import and Evidence deduplication.
- [x] Implement schedule-email extraction and reduced Hercules review.
- [x] Implement sealed eligible-shift preview and confirmation.
- [x] Verify and prepare the gated release handoff.

## Evidence log

- 2026-08-28: clean baseline and branch confirmed at `3740c5c3c78f1f874c5b7ce38c1b572a6e465d06`.
- 2026-08-28: live Gmail review was read-only except Gmail's normal unread-to-read effect when a message was opened. No mail was sent, deleted, labeled, archived, forwarded, or committed.
- 2026-08-28: focused Gmail/Evidence/Hercules/work proof passed: 8 files, 51 tests.
- 2026-08-28: TypeScript and AI-surface verification passed.
- 2026-08-28: full suite completed with 1,043 passed and 2 skipped. Its two failures reproduce current unrelated baselines: the Office source-shape assertion and the Windows credential-scrubber subprocess environment.
- 2026-08-28: direct Vite production build and Hercules Pro UI build passed. Wrangler dry-run passed without deployment. `git diff --check origin/main` passed with line-ending notices only.
- 2026-08-28: `origin/main` remained exactly `3740c5c3c78f1f874c5b7ce38c1b572a6e465d06` at final reconciliation.
- 2026-08-28: current main advanced through Household Fund PR #237. D-161/D-162 were preserved for that packet; Gmail was renumbered D-163 and rebased cleanly onto `main@7e5dc88`.
- 2026-08-28: post-rebase combined Gmail/Evidence/Hercules/books/Fund proof passed: 12 files, 78 tests. TypeScript, AI-surface verification, production app/Hercules UI build, Wrangler dry-run, and diff integrity passed.
- 2026-08-28: post-rebase full suite completed with 1,071 passed and 2 skipped. The only failure is the unchanged Windows credential-scrubber subprocess environment in `test/api.test.ts`; D-163 does not modify that test or script.
- 2026-08-28: Jonathan explicitly approved push, merge, Evidence migration 0003, and deployment. Cloudflare Email Routing remains out of scope and `EVIDENCE_EMAIL_ENABLED=false`.
- 2026-08-28: PR #239 merged as `d85ba80f82c1625d2217e2ea72fd493ae4b9878c`. GitHub CI and Cloudflare Workers workflows both completed successfully.
- 2026-08-28: `0003_gmail_capture_dedup.sql` applied successfully to isolated Development `EVIDENCE_DB` and Production `EVIDENCE_PRODUCTION_DB`; both migration ledgers now report no pending work and both databases expose the scoped unique digest index.
- 2026-08-28: Worker version `f30b0c54-d83d-4c27-8778-14ca7c8f637c` deployed. Live status reports both Evidence environments available; the live bundle contains direct Gmail capture and no forwarding-alias UI. `EVIDENCE_EMAIL_ENABLED=false` remains deployed.
- 2026-08-28: first real scrub exposed two activation defects. Google initially refused the request because `gmail.googleapis.com` was disabled for OAuth project `118841732569`; Jonathan's authenticated Google Cloud session enabled that single API. The next run discovered all 330 scoped messages.
- 2026-08-28: overlapping live scrubs encrypted all 330 messages but one visible run stopped at 194 on the scoped Gmail-digest unique index. Remote read-only evidence counts then showed 330 encrypted captures, 321 stuck `deriving`, 3 `ready`, and 6 `ready_to_review`. Multipart plain-text/HTML copies were producing the same canonical derivative key, and the queue correctly refused the duplicate row but had no stale recovery path.
- 2026-08-28: repair branch `codex/d163-gmail-dedupe` starts from `origin/main@341756d`. It treats a raced digest insert as the already-saved winner after deleting the orphan R2 object/reservation, coalesces same-message canonical records while retaining every source-located observation/drift fact, and lets a later scrub requeue only `ready`/`deriving` captures stale for at least five minutes. Focused Gmail/Evidence proof is 29/29 and TypeScript/diff integrity pass.
- 2026-08-28: PR #241 merged as `63da0c937ed541bb3408447ca76c4ad4e9d36d21`; merged-main CI and Cloudflare build/deploy both passed. The authenticated recovery rechecked all 330 messages with 0 rejected and advanced 314 to `ready_to_review`, but 16 exhausted retries while still `deriving`.
- 2026-08-28: live Worker error tracing identified `Exceeded CPU Limit` on multi-message Evidence Queue invocations. D-165 limits the Development consumer to one evidence item per invocation and adds a configuration regression assertion; the Production consumer configuration is unchanged.

## Decisions

- Direct Gmail replaces the planned Cloudflare forwarding channel.
- Gmail access stays on-device and short-lived. Hearth stores encrypted selected 7shifts messages, not a durable Google refresh token.
- Hercules reviews only server-reduced Evidence. It never receives or requests a Gmail token.
- Email schedule facts may populate outlook, but only eligible non-email worked evidence may enter a shift-write preview.

## Remaining uncertainty

- Google may require restricted-scope verification before broader distribution because Hearth transmits Gmail-derived bytes to its encrypted Evidence service.
- The D-165 one-message Development queue repair requires focused/full proof, merge/deploy, and a final authenticated idempotent scrub proving all 330 captures terminal.

## Handoff

D-163's digest and canonical-derivative repair is live, and all 330 matching Gmail messages remain encrypted in Development. The authenticated recovery proved 314 complete and isolated the remaining 16 to Cloudflare's per-invocation CPU ceiling. D-165 narrows the Development Queue batch to one so those preserved captures can finish without altering Gmail permissions, raw data, Production, or money authority.
