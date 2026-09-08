# Mobile C5 — attached claim actions

LOCALLY VERIFIED on codex/mobile-c5-claim-rows; exact base/pre-implementation HEAD923ca35286724c47cb18c8ace0e0536a61f6dc6c(C4,PR395). High; Budget(5)+2; Engagement(3)+2. One writer root.

Keep Claude’s action attached to its exact claim row, with horizontal reveal and named Review transfer/Confirm. Use ClaimsTray plus existing phone Calendar→Appointments Owed rows, without changing Home’s fixed board. Public card labels stay in explicit UI, never substituted into journal notes.

Current App picks an account at execution and omits amount. New reviewed remainder fixes amount, destination/date, source graph and scope through queue/authority. Because the underlying settlement writer bypasses transfer account-scope checks and corrected claim counters are not rebuilt, the reviewed path conservatively requires coherent Shared source/account/history and refuses corrections or unsupported private-account lineage. Do not infer or repair counter history within this UX slice. Existing raw command remains compatible.


## Implementation and proof

ClaimsTray and the phone Appointments → Owed list use Claude's attached RowReveal. Motion never writes; the existing named review requires an explicit receiving account before enabling Record the transfer. Exact remainder, date, source history and destination are bound at review, queue execution and authoritative replay. Shared-only supported history refuses private/corrected/malformed/future lineage. Public card labels stay in the UI; wire resources are constant-name hashes, not copied notes. Existing raw command remains compatible.

Optional Confirm review now protects non-destructive financial reviews too. Independent verification caught and repaired the stale Prise Return-to-entries dismissal. Modal cancellation returns focus to its invoker; accepted row removal falls back to its surviving claim list. Phone controls keep 44px targets, 5px cards and 3px controls. Enlarged modal copy scrolls to keep title, destination, Cancel and Confirm reachable.

High quick gate command in `/tmp/c5-gate1.log`: `pnpm test -- --risk=high --base=923ca35286724c47cb18c8ace0e0536a61f6dc6c --focus=test/claim-settlement-review.test.ts --focus=test/claim-row-ui.test.ts --focus=test/confirm-danger-ui.test.ts --focus=test/duplicate-prise-ui.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="C5 exact claim remainder and chosen receiving account survive queue, authoritative replay and scope; shared review compatibility and reachable Owed rows"`. TypeScript, AI surface, diff and116 selected tests passed123.569s; fingerprint4b91a3a212dc1bf8b1985fc1c23a115167e347245a0eb2160932110c9720a913, no five-minute breach. This fingerprint precedes the final CSS-only target/overflow refinement, verified below.

Six pure/actual authority cases, two row UI cases, three new mounted App cases accepted/source-change/room-roundtrip; App suite57pass. Exact transfer legs, remote partials, account changes, actor binding, correction graphs, malformed and future dates, incoming mates and quiet-label wire privacy covered. Local capture intentionally contains source basis; only serialized wire is asserted label-free. No dedicated delayed claim-acceptance or midnight App case: those paths source-reviewed.

Ten final browser cases at320/390/720/1100, long200%bodyzoom, empty, busy, rejected, stale and actual Owed host passed without page errors/horizontal overflow. Explicit empty destination, disabled Confirm, named acceptance, cancel/accepted focus and44px controls verified. Two native touch cases preserve reveal/cancel/no-write and vertical scroll0→203/204px. `/tmp/hearth-mobile-c5-evidence`, `/tmp/c5-browser4.log`, `/tmp/c5-gesture1.log`. Initial Owed36px controls and clipped enlarged modal were found and repaired; bodyzoom is not native pinch-zoom certification.

Independent model, UX and verifier reviews clear. Fictional local model/component/authority proof; App transport mocked. No hosted, physical, exhaustive, merge/deployment/schema/Production claim. HEAD is the commit carrying this file; stacked draft PR follows, then C6.
