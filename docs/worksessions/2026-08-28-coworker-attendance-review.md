# Hearth worksession — coworker attendance review

- **Decision:** D-168 (renumbered from local D-167 after current `main` assigned D-167 to blank-household boot recovery)

- **Status:** REVIEW FIXES VERIFIED; INDEPENDENT RE-REVIEW REQUIRED
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Branch:** `codex/d167-attendance-review`
- **Baseline SHA:** `1cb2044161d69a57cd8277080488620d74136a08`
- **Risk:** High
- **Environment impact:** none; local code only

## Household outcome

After an OCR or shift-report draft, Jonathan sees the coworkers scheduled for that job and date, turns off absences, and adds surprise helpers before the ordinary Shift Confirm.

## Boundaries

- Published schedule is outlook only and remains in the member-Personal envelope.
- Attendance is private, non-financial context attached to the confirmed shift.
- Coworkers remain `coworkerId` records, never Hearth members.
- Names and source schedule keys remain outside Shared sync, default Hercules/AI context, financial audit facts, and PGlite journal facts.
- Attendance never fills `staffingCount`, sales, tips, hours, weather, role authority, or money.

## Dual Course

- Budget delta (5): `0` — no financial calculation changes.
- Engagement delta (3): `+2` — a faster, legible post-shift review with less retyping.

## Current implementation

- Personal-only dated coworker schedule sidecar with bounded protected shift-instance keys.
- Exact date/job preload; exact shift windows use a one-hour overlap margin and fall back to the date when no overlap exists.
- Scheduled coworkers begin present and can be explicitly marked absent or present.
- Surprise helpers are created as private workplace identities.
- One visible Shift Confirm commits the ordinary work result and reviewed attendance in one household acceptance result.
- Undo removes the confirmed shift and its private attendance/surprise-helper sidecars together, so no orphan context remains.
- Partial schedule captures stay additive. A member-reviewed complete date range may retire omitted schedule windows; those removals carry Personal tombstones across replicas.
- A refreshed schedule revision resets the attendance review even when its stable schedule id is unchanged.

## Evidence log

- Final focused coworker, disclosure, Evidence extraction, Shift camera, sync, work-books, tip-covariate, duplicate-retry, Undo, and complete-range replacement proof: 97/97.
- Command proof covers Personal-only schedule material, exact job/location attribution, exact surprise-helper reuse, ambiguous-name atomic refusal, attendance replacement/tombstones, duplicate retry, a balanced compiled journal, and exclusion from PGlite books-integrity facts.
- Direct UI proof covers scheduled preload, explicit absence, empty schedule, surprise-helper add/remove, and the visible Confirm boundary.
- Responsive local browser proof at 320/390/720/1100 found no horizontal overflow or console errors; keyboard Tab reaches Add helper. The existing reduced-motion rules remain intact.
- Full repository suite: 1099 passed / 2 skipped / 1 unchanged Windows-only failure (`test/api.test.ts`, `spawnSync bash ENOENT`).
- TypeScript, AI surface verification, production Vite build, Hercules Pro UI build, missing-`_redirects` guard, diff check, secret scan, and artifact-name scan: pass.
- Push, PR, merge, deployment, schema, secrets, feature flags, and hosted data: untouched.

## Remaining release gate

High-risk review requires the independent reviewers to inspect the exact reconciled fix SHA. Jonathan has authorized push and PR only after that PASS. Merge and deployment remain separate actions. No hosted migration or activation is needed for this slice.
