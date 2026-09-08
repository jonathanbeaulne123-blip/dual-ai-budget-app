# Mobile C6 — truthful Till empty copy

FOCUSED PROOF COMPLETE; ADJACENT GATE FAILURE RECORDED on codex/mobile-c6-till-empty, exact base1c724a2608f5b403c03e84d3c5159e5fd86e906f(C5,PR396). Medium; Budget(5)+1; Engagement(3)+1. One writer root.

Claude's tweak gates both empty claims on actual nonduplicate month activity in the supplied scoped household, preserving the existing spend projection and composition. Zero-net refunds and transfers count as activity. No command or scope changes.


Active current-month Fund movements are included through canonical activeHouseholdFundEvents/householdFundOperatingDelta; a proposal or Hold is not money received. Independent verifier caught that event-only source, then cleared the repair. Fourteen Till tests pass including refund-to-zero, transfer, Held/proposal and confirmed-contribution cases. Eight320/390/720/1100 empty/spent browser cases pass with no horizontal overflow; `/tmp/hearth-mobile-c6-evidence`, `/tmp/c6-browser1.log`.

Final attempted Medium quick gate command `/tmp/c6-gate2.log`: `pnpm test -- --risk=medium --base=1c724a2608f5b403c03e84d3c5159e5fd86e906f --focus=test/till.test.ts --focus-reason="C6 empty state includes actual scoped month transactions and confirmed Fund movements, excluding proposals and preserving spend totals"`. TypeScript/AI/diff and87 assertions pass, but overall gate FAILED121.713s because three existing App toast callbacks at App.tsx3924 fired after jsdom unmount (window undefined). Fingerprint9d5144d3a5260c8597b594e837d74197e35a77990c7708c68a7547a228586d14; no five-minute breach. Superseded gate1 was terminated after adding the Fund source; it is not completion evidence. C7 owns the timer/scope lifecycle repair and rerun. No claim of a clean gate.

No visual restyling, accounting mutation, hosted/physical/exhaustive proof, merge or deploy. Exact HEAD is the commit carrying this file. Draft PR remains dependent on C7 closing adjacent lifecycle verification.
