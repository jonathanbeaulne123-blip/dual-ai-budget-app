# Mobile Phase 2 Development release

Owner: Jonathan. Risk: Release. Budget (5) +0; Engagement (3) +1 through availability of the completed mobile experience. Explicit instruction: “ok push merge and deploy, make sure its reversible.”

Release the full 35-commit Phase 2 stack from codex/mobile-phase2-integration, based on main 6fb15c7a98f3336862bb743b836aa96a358a35b9. Preserve Claude’s exact design and the approved Fund/receipt/scope decisions. PR 406 is retargeted to main so one merge deploys the full stack. No schema application, data reset or Production activation.

The pre-release source is preserved remotely as annotated tag mobile-phase2-before-20260908. The currently deployed historical Worker is 47e8de95-a516-4a71-869d-f7a81fc1c51f (deployment 58b8fff5-da4a-4402-a06a-4756dffebe49). A raw rollback to it is unsafe after Phase 2: it predates reviewed-command resource enforcement and Personal goal partition checks. Use the compatibility rollback branch codex/mobile-phase2-safe-rollback, retaining new core/ledgerSync protections and Count receipt recovery while restoring the previous shell. Preserve all cloud/local books, outboxes and session drafts.

Independent money audit identified and reviewed those rollback constraints. The release-wide quick gate first reproduced two trailing blank-line failures missed by per-slice comparisons; both are removed without behavioral change. Final focused tests, rollback build verification, exact hosted version and live browser proof will be recorded in the release receipt.

Existing device gates remain: blank Count entry is 14 taps against an under-10 target; physical OAuth, QR, camera, background, pinch and sync certification remain open. The two-week sheet-build gate was explicitly waived. Jonathan authorized this Development release with those recorded limits.
