# Hearth worksession — real 7shifts visible schedule capture

- **Status:** ACCEPTANCE PROVED — ready for independent review
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/d169-visible-schedule-capture`
- **Baseline SHA:** `d87e2dee28113542ae07005f3907cb425566f6f9`
- **Head SHA:** working tree
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development

## Household outcome

Jonathan can explicitly capture the employee-visible 7shifts week grid into his encrypted Development evidence vault even when 7shifts renders the schedule from page state instead of making a fresh response after extension enablement.

## Budget delta (5)

`+1` — improves the evidence that preloads a later Shift attendance review; it does not post hours, tips, sales, staffing, or money.

## Engagement delta (3)

`+1` — one explicit companion action replaces brittle hidden-response timing.

## Verified baseline

- `origin/main@d87e2dee28113542ae07005f3907cb425566f6f9` is deployed.
- The unpacked companion is installed from this worktree with extension id `deddlafofoddkacaedocpmnkaocbkjij`.
- Pairing and tab enablement succeed on Jonathan's authenticated 7shifts schedule.
- The populated week grid is server/page-state rendered; navigating weeks clears the current document's explicit capture session and no eligible response reached Hearth.

## Scope

### In scope

- Explicit user-gesture DOM projection of visible coworker names, roles, dates, stations, and schedule windows.
- Existing one-use capability, credential sanitization, encrypted Development upload, and schedule-as-outlook semantics.
- Local focused tests and a real authenticated Development capture smoke.

### Out of scope

- Cookies, tokens, request headers/bodies, background scraping, non-7shifts origins, worked-hours authority, automatic money posting, Production, secrets, schema, push, merge, or deploy.

## Acceptance evidence

- [x] Fixed-field schedule projection excludes unrelated DOM and credentials.
- [x] Existing credential/path guards remain green.
- [x] Extractor creates coworker schedule outlook rows from the projection.
- [x] Jonathan reloaded the unpacked companion and completed one real encrypted Development capture.
- [x] The hosted Development vault shows the browser capture as `ready_to_review`.

## Plan

- [x] Reproduce the missing capture against the authenticated populated week.
- [x] Identify page-state rendering as the boundary.
- [x] Implement and test the explicit visible-schedule capture.
- [x] Reload, pair, capture, and verify the hosted Development result.

## Evidence log

- Chrome was inspected through the user-authorized browser surface. Only public script configuration and bounded DOM structure were examined; no cookies, storage, headers, passwords, or tokens were read.
- Live projection dry-run against the populated week: 33 visible employee rows, 76 shifts, 76 parsed starts, 60 parsed ends, and 16 closing-time labels retained with unknown end time.
- Focused proof: `pnpm exec vitest run test/evidence-extension.test.ts test/evidence-extraction.test.ts test/work-coworkers.test.ts` — 27/27 passed.
- `pnpm exec tsc --noEmit` and `git diff --check` passed.
- `pnpm check` reached 1100 passed / 2 skipped / 2 unrelated failures: unchanged Windows `spawnSync bash ENOENT` and unchanged Hercules rig timing assertion. Direct TypeScript, Vite production build, and Hercules Pro UI build passed afterward.
- Real companion screen capture reached the hosted Development vault as a 73 KB `screenshot` in `ready_to_review`, proving pairing, encryption, upload, and queue derivation. The original schedule click never created a `browser-structured` item because the already-loaded page lacked the newly registered helper.
- Follow-up repair executes the fixed visible-grid projection directly from the explicit popup click, sanitizes it in the popup, awaits the capability upload response, and reports the actual HTTP outcome. It no longer depends on an already-loaded content-script acknowledgement. Focused proof remained 27/27; TypeScript and diff check passed.
- Real authenticated smoke at `2026-08-29T00:59:05.790Z`: the encrypted `browser-structured` item reached the Development vault at 11,386 bytes and advanced to `ready_to_review`.
- Hosted extraction produced exactly 76 derivatives and 76 distinct canonical schedule keys with parser `hearth-s7-extract-v2`. All 76 retained date, coworker, role, and start facts; 60 retained exact end and scheduled-minute facts; 16 closing labels remained unknown rather than being inferred. Only counts and non-identifying status were used for this verification.

## Decisions

- D-169 keeps schedule facts as Personal outlook. The visible grid cannot establish worked time or earnings.
- The capture uses a fixed positive projection rather than generic DOM serialization.

## Remaining uncertainty

- This one real week proves the current visible schedule shape end to end. Future 7shifts layout changes may require a new bounded projection fixture.
- Published schedule remains Personal outlook. A separate employee-visible punch/timesheet capture is still required to prove worked hours.

## Handoff

The D-169 acceptance smoke is complete. Next owner is an independent reviewer of the exact local diff; push, merge, and deploy remain separate decisions.
