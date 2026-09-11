# Hearth worksession — Personal Calendar cloud authority

- Owner / decision owner: Jonathan
- Assignee: Codex
- Branch: codex/personal-plan-cloud-authority
- Baseline: 29d4718d4ea6f794cfbef1f2089cee13a18ea21a
- Risk: High (private writes)
- Environment: Development
- Status: Verification in progress

## Household outcome
Saving a Personal potential expense reaches the existing authenticated cloud command authority instead of failing the App's preference-only Personal allowlist.

## Budget delta (5)
Only a single actor-owned Calendar plan and its reviewed private expense receipt may cross this exception. Other household fields, partner plans, Shared plans and unrelated transactions remain rejected. Existing domain and server validation, Confirm, integer cents and private envelope rules remain authoritative.

## Engagement delta (3)
Personal Calendar saves work through the actual App path. Prior core-only plan tests and synthetic Calendar display proof did not cover the App write checkpoint; add App-to-authority regression coverage.

## Scope
Add bounded personalCalendarUpdateAllowed to assertMemberPersonalUpdate. Cover create, edit, move, dismiss, remove and reviewed post. No schema, Google access, Production activation or user data mutations.

## Evidence and release
Unit lifecycle and negative mutation tests pass initially. App cloud-path integration and scoped quick gate pending. Independent read-only review requested. Earlier push/merge/deploy instruction authorizes this ongoing Development repair. Revert and redeploy this client guard if regression; no data migration.

- High-risk quick gate passed 204 tests in 17 files plus TypeScript and AI surface, in 77.3 seconds. Exact focus files: personal-calendar-authority, potential-expenses, app-startup-p1, ledger-sync-authority, month-rehearsal-mainline; relevant mapped boundary tests also ran. Full suite was not requested.
- Real App integration reproduces the Calendar callback, passes its private-write checkpoint, calls prepareCommand and verifies accepted private state is adopted and absent from Shared. This is synthetic authenticated-authority code proof, not a real user-account write.
- Vite build passed in 15.65 seconds with existing PGlite and chunk warnings. No visual layout changed; prior theme/viewport proof remains relevant and App integration covers this changed behavior.
- Independent review found Fund-backed Personal posting is mixed-scope, not a Personal-only update. Such postings now follow the same ordinary ledger authority as funded postEntry. New authority test proves private receipt/plan redaction and successful Fund allocation; 31 focused plan/Fund tests passed after this correction. The first Fund test had an incorrect helper import, corrected before passing.
- Conditional release review: scoped tests/build pass, privacy boundaries preserved, no real household data written. Proceed with previously authorized Development release after final CI.
