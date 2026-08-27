# T0-S1 — Three-view breakpoint

Add `OfficeBreakpoint` phone | tablet | computer. `WIDE_BREAKPOINT` stays 720; `COMPUTER_BREAKPOINT = 1280`. Phone and tablet render `OfficePhone`. Computer uses `hearth.office.<env>.computer`; soft-migrate `wide`. Hercules `desktopFly` only at `innerWidth >= 1280`.

```text
Implement T0-S1 from docs/briefs/office/T0-S1-three-view-breakpoint.md.

Add OfficeBreakpoint phone|tablet|computer. WIDE_BREAKPOINT stays 720 for phone vs not-phone; COMPUTER_BREAKPOINT = 1280. Office.tsx: phone and tablet render OfficePhone; computer renders the computer room (T1+). officeLayoutKey: tablet uses phone key; computer uses hearth.office.<env>.computer; soft-migrate hearth.office.<env>.wide JSON into computer. Hercules desktopFly / wander only at innerWidth >= 1280.

Tests: breakpoint helper; layout key migration; 719/720/1279/1280. Rewrite test/desktop-office.test.ts 900px warmth fence to: no 10px Bloomberg names; computer column may exceed 900 later; do not require 1280 lobby chrome.

Forbidden: restyling OfficePhone Draft C structure; changing postEntry. pnpm test.
```
