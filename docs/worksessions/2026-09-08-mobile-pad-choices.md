# Mobile C1 — all pad choices

Status LOCALLY VERIFIED; branch codex/mobile-c1-pad-choices. Exact base/pre-implementation HEAD56d516171cdf47f5b78cc920c0de0011f2acc935 (B9, PR391). Sole writer root. Medium risk; Budget(5)+1; Engagement(3)+1.

Claude's original tweak removes hard truncation from CalculatorPad while retaining the first6accounts/8categories. Named More accounts/More categories disclose remaining incoming active choices. Selected eligible tail items remain visible when collapsed; amount and all other draft fields remain unchanged. Disclosure resets by actual viewer environment/household/member/view/mode. Missing/removed selection prompts a choice without silently changing its ID or recovering a private label from full books. Existing Add/Confirm remains the writer.

Proof: actual mounted draft identity/amount, selection past limits, canary removal, scope reset, zero writes on disclosure, transfer unchanged. Browser320/390/720/1100, keyboard/44px/longtext/busy/empty. Focused Medium gate with required App/rehearsal checks. Independent read-only final review. Separate draft PR; no merge/deploy.


## Verification and delivery

Mounted two-assertion-group proof passed2.59s (`/tmp/c1-focused.log`): last of9accounts/12categories selected with exact unchanged amount, disclosure makes zero draft/post calls, tail selection retained, removed labels gone, scope reset, busy/transfer behavior.

`pnpm test -- --risk=medium --base=56d516171cdf47f5b78cc920c0de0011f2acc935 --focus=test/calculator-choices.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Pad disclosure preserves exact draft IDs and amount, removes unavailable choices, and retains ordinary Add and rehearsal"` passed61/61plus TypeScript/AI/diff in95.880s. Fingerprint`39f6dd4209dbb14cfc7706ba744fa788709017be508317ff2d11c4d8717494e8`; no five-minute breach (`/tmp/c1-gate.log`).

All-main-CSS browser7cases passed320/390/720/1100 plus320long200%body zoom/empty/busy. Keyboard Enter opens disclosure, chosen IDs and12.34amount survive collapse, zero posting, all changed buttons44px and no horizontal overflow/page errors. Evidence`/tmp/hearth-mobile-c1-evidence/verify.mjs`, `/tmp/c1-browser2.log`; inspected390screenshot. First driver incorrectly retained a More-named locator after its label became Fewer; corrected the driver, no product change. Existing pad visual styling retained; no ledger-style redesign in this fix. Body zoom is not proof of native user-zoom permission.

Independent UX and verifier source reviews clear. Fictional local component/App tests with mocked acceptance transport; no physical, hosted or exhaustive proof. Implementation HEAD is the Git commit carrying this file. Separate stacked draft PR follows; no merge/deploy/schema. Next Codex C2 uses honestly labelled household suggestions in the existing Swipe grid.
