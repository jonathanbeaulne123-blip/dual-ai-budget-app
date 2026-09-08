# Mobile C7 — the receipt Undo window

LOCALLY VERIFIED on codex/mobile-c7-undo-window, exact baseadc44df6af82e6df6ad30032550f5b3e47b80025(C6,PR397). High; Budget(5)+2; Engagement(3)+2. One writer root.

Claude's paper background shrinks through the exact ten-second receipt window while its named44px Undo remains stationary. LIFO and changed purchase state disable the action. Scope/auth generation guards pre-enqueue, drain and accepted delivery; expiry applies before writer starts, not after acceptance. Global Undo remains independent of receipt expiry. C6 exposed unmanaged toast timers; cancel both exact-ID timers on unmount.


## Proof and review

Two focused window cases cover exact expiry/current strip, LIFO, owner/Shared/type/duplicate/reversal refusals, named click, disabled expiry and timer cleanup. Four mounted App interleavings pass: expired callback, room roundtrip, queued expiry, and accepted Undo arriving after expiry. The fixture now models the real client's accepted receipt lookup; its prior mismatched preview/receipt IDs explained the initial delayed-case refusal. `/tmp/c7-app3.log`4pass5.68s. `/tmp/c7-focused1.log`37pass5.31s before final eligibility additions.

Eight browser cases at320/390/720/1100 plus LIFO,busy,200%bodyzoom and a full10second expiry pass. Named44px Undo stays stationary; the paper shrinks; no horizontal overflow. `/tmp/hearth-mobile-c7-evidence`, `/tmp/c7-browser1.log`, inspected320LIFO. No native pinch/physical proof.

Independent money/verifier clear after removing an invalid Transaction field and requiring the member's current Shared nonduplicate expense. Toast timers track exact IDs, refuse scheduling after unmount, and clean up on unmount. Global Undo keeps its LIFO and funded/ordinary routes without the short-window expiry.

Final High quick gate `/tmp/c7-gate3.log` passed TypeScript/AI/diff and selected tests152.988s; fingerprint908303d24514b2f486a2e1ac420f3da9ac7f05a46520ce62918ad8aa7918b028, no five-minute breach. Exact command uses baseadc44df and focus swipe-undo-window,swipe,till,app-startup-p1,month-rehearsal-mainline,onboarding-app-stale-seat,onboarding-entry-integration; reason C7 quick Undo expiry/LIFO/scope and C6 post-unmount timers. Includes the C6 failed test set: no unhandled timer errors. Gate1 stopped prematurely; gate2 failed test-fixture TypeScript40.466s, corrected before final gate.

Fictional local/component/App proof, mocked transport. Auth-only replacement and late different-room acceptance are source-reviewed, not dedicated new C7 fixtures. No hosted/exhaustive/physical/merge/deployment/schema claim. HEAD is this commit; stacked draft PR then C8.
