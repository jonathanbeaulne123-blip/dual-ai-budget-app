# Hearth worksession — onboarding Chapter 6 Household Fund

- **Status:** CLOSED; LOCAL QUICK-GATE + BUILD + UX VERIFIED
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/15-ch6-fund`
- **Baseline SHA:** `cd4c660a0aebc0bc71cc8f88f9dc2c4bd862ab44`
- **Head SHA:** working tree
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none; synthetic local Development fixtures only

## Household outcome

Bianca can configure the existing Household Fund from its real surface, and
each household member can review and approve the same configuration revision
on their own device. Chapter 6 completes only when both current approvals tie
to that revision. Configuration and approval never move money or post a row.

## Budget delta (5)

`+3` — the Fund's custodian, Shared operating accounts, custody rules, and
same-revision approvals become typed household evidence without changing the
Fund projection or Confirm boundary.

## Engagement delta (3)

`+3` — Hercules routes each person to one clear next action on the existing
Fund surface, explains what approval does not do, and turns stale or mismatched
consent into a calm review path instead of a dead end.

## Verified baseline

- `origin/main` and branch HEAD were `cd4c660a0aebc0bc71cc8f88f9dc2c4bd862ab44` at branch creation.
- Worktree was clean and the branch did not exist locally or remotely.
- `HouseholdFundConfig` had no revision-bound approvals.
- `configureHouseholdFund` already required the custodian and refused a Charter custody mismatch.
- `projectHouseholdFund` reads Fund financial facts and does not require a setup approval.
- Chapter 6's projector accepted a bare configuration, so one person's setup could complete the chapter.
- Inference to prove: revision-bound approvals can live on the Shared Fund config without entering money projection or leaking the private backing account.

## Scope

### In scope

- A shaped, merge-safe Fund configuration revision and member-owned approval rows.
- A reviewed command that approves only the actor's own view of the current revision.
- Chapter 6 evidence for custodian, privacy-safe backing description, active Shared operating accounts, rules, and approval dates.
- Empty, one-approval, same-revision-complete, mismatched-revision stale, and Charter-custody-conflict states.
- Direct routing to the existing Household Fund surface and a self-owned approval control there.
- Focused command, evidence, merge, source-fence, projection-equality, UI, copy, and accessibility tests.
- D-214 decision, AI handoff, and responsive browser evidence.

### Out of scope

- Moving money, posting a journal/Fund event, changing Fund arithmetic, or relaxing custody.
- Publishing a Personal backing-account id, name, balance, or provider detail into Shared evidence.
- A new Fund surface, bank feed, schema, hosted mutation, provider, secret, Production change, push, PR, merge, or deployment.

## Acceptance evidence

- [x] Configure creates one current custodian approval and no money fact.
- [x] Partner approval is self-owned, revision-bound, and merge-safe.
- [x] One approval remains pending; both current approvals complete.
- [x] Different approval revisions return stale.
- [x] Charter/Fund custody mismatch returns the exact refusal.
- [x] `projectHouseholdFund` is deeply equal before and after approval.
- [x] Shared evidence contains no Personal account identifier or balance.
- [x] Existing Fund surface carries configure/review/approve; onboarding creates no replacement form.
- [x] 320 / 390 / 720 / about 1100 px, keyboard, focus, reduced motion, empty, stale, conflict, and inherited offline acceptance behavior verified.
- [x] Change-focused High quick gate and production build pass.

## Plan

- [x] Seal the typed revision/approval fold and merge rule.
- [x] Add the self-owned approval command and focused scenarios.
- [x] Tighten Chapter 6 evidence and acknowledgement.
- [x] Wire Fund-surface routing, copy, approval UX, and witness transition.
- [x] Run focused tests, responsive/accessibility review, quick gate, and build.
- [x] Close docs and commit the exact verified tree.

## Evidence log

- Baseline High quick gate: 6/6 custody-fence tests plus AI surface and
  TypeScript passed before implementation.
- Slice suite: `test/onboarding-fund.test.ts` passed 9/9, covering same-revision
  completion, self-ownership, stale rejection, replica merge, custody conflict,
  acknowledgement, private backing-account exclusion, projection/hash equality,
  and the real Fund-surface control.
- Live actual-component browser pass: empty, one-approval, stale, complete, and
  custody-conflict states; 320/390/720/1100 px; no horizontal overflow; Slice
  controls 44–48 px. Tab remained trapped between the chapter's actions, Enter
  moved focus to `fund-proof`, and mouse activation changed one approval into
  accepted evidence and Next. The pass caught and repaired the non-custodian
  falling back to an actionless witness after approval. Temporary fixtures were
  removed. `src/onboarding.css` retains its reduced-motion transition removal.
- Production `pnpm build` passed TypeScript and Vite (460 modules), followed by
  a separately confirmed Hercules Pro UI build and redirect sanitizer. Existing
  PGlite browser-external/eval and chunk-size warnings remain.
- The final code-and-contract High quick gate passed 132 fast + 7 serial tests
  in 182.9 seconds. A prior cold attempt timed
  out only the first PGlite proof at its fixed 15-second host limit; the
  prescribed isolated `--testTimeout=30000` rerun passed 7/7 in 12.9 seconds,
  then the unchanged exact gate passed on the warmed runtime.
- The existing online-required Shared acceptance boundary remains the offline
  behavior; Slice 15 adds no cached/local acceptance shortcut.

## Decisions

- D-214 reserved for revision-bound Household Fund setup approvals.
- A Shared approval may disclose that the custodian selected a Personal savings
  backing account, but never which account or what it contains.

## Remaining uncertainty

- The live two-device hosted acknowledgement path is release evidence and is
  not authorized by this local slice.

## Handoff

Local implementation and verification are complete. Jonathan owns review,
push, merge, and deployment decisions; hosted two-device acknowledgement proof
remains a later release check.
