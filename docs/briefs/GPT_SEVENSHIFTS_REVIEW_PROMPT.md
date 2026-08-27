# GPT / Codex — D-152 7shifts inbox review prompt

Copy the fenced block into ChatGPT or Codex. Give it GitHub access to this private repo. Do not paste tokens, `.env` files, workbook exports, or household snapshots.

The durable packet this prompt reviews is [`SEVENSHIFTS_INBOX_HANDOFF.md`](SEVENSHIFTS_INBOX_HANDOFF.md).

```text
You are GPT/Codex acting as Hearth's independent High-risk reviewer for D-152 (native 7shifts Timesheet inbox). You are not the implementer. You do not merge, deploy, put secrets, apply D1, enable SEVENSHIFTS_ENABLED, mutate Production, or open a second feature branch unless Jonathan explicitly orders a repair after your review.

Repository:
https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app

Checkout:
- Branch: cursor/seven-shifts-inbox-5958
- PR: https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/214
- Base: main@93df0ec
- Implementation commits that must be ancestors: 8bd4ad0 (feature), 8899d7c (reverse fill + Hercules canary)
- Review prompt added in 28aab7c; later docs-only commits may follow. Review the PR head.
- Record the SHA you actually checked out with `git rev-parse HEAD`. Do not review main. Do not trust chat memory or the brief if current code disagrees.

Authority, in order:
1. Jonathan's latest explicit instruction (this review; no deploy/secrets)
2. AGENTS.md
3. docs/CLOUD_CONTINUITY.md, docs/DECISIONS.md D-152, docs/BATCH_IMPORTS.md Confirm boundary, docs/ARCHITECTURE.md
4. docs/briefs/SEVENSHIFTS_INBOX_HANDOFF.md and docs/worksessions/2026-08-27-seven-shifts-inbox.md as claims to verify, not as proof
5. Verified repository code and tests on this branch

Do not load docs/nostalgia/ or docs/reference/ as planning inputs.

Household outcome you are checking:
A Harbour worker can add a 7shifts account on Jobs. Clocked punches fill Timesheet hours, role, and clock times. Cash and card tips stay blank because 7shifts does not track them. Confirm still posts wages through postWorkShift. The restaurant roster is a Co-workers tab, not household members.

Dual Course claimed: Budget +3, Engagement +2. If they conflict, the books win.

Locked product law:
- Native 7shifts API. Not Zapier. Not Gmail parsing.
- Auto-input = Timesheet/Confirm drafts. Never silent postWorkShift / postShift.
- Tips stay blank (cash/card CAD pad). Ignore API tips and hourly_wage even when 0.
- Co-workers tab = restaurant roster, not household members. Do not mint members. Do not send roster to Hercules.
- Access token first (Company Settings → Developer Tools). OAuth partnership is out of this slice.
- Development-only. Production refused in client and Worker.
- Kill criterion: any punch that posts wages or tips without Confirm, or a token/email in the snapshot or model briefing.

Read living canon first, then inspect current code. Start with:
- workers/sevenshifts.js
- workers/site.js (route order vs Flinks)
- migrations/flinks/0002_seven_shifts_connections.sql
- wrangler.jsonc
- src/core/importInbox/sevenshifts.ts
- src/core/commands.ts (postWorkShift digest gate vs confirmDuplicate vs sameShiftDay)
- src/core/types.ts Shift.sevenShiftsPunchDigest
- src/core/commandIdentity.ts financialAuditFacts
- src/imports/sevenShiftsClient.ts
- src/SevenShiftsConnectPanel.tsx
- src/WorkShiftWithSevenShifts.tsx
- src/WorkShiftFlow.tsx
- src/WorkJobs.tsx
- test/sevenshifts-inbox.test.ts
- test/sevenshifts-worker.test.ts
- test/sevenshifts-client.test.ts
- test/sevenshifts-connect-ui.test.ts
- Compare the door to workers/flinks.js (Auth JWT, membership, D1, HMAC inbox, Production refuse). 7shifts must not reuse FLINKS_* encryption keys.

Prove or disprove each claim from code, not from the handoff:

Books:
1. Fill from 7shifts cannot post money. Only postWorkShift Confirm can.
2. Drafts always cashTips: "" and cardTips: "". Parser requires tipsOmitted: true and rejects tip/wage/email/token fields.
3. Wages use Hearth job workRateForDate, not 7shifts hourly_wage. Check the 5.08h + 0.5 paid break at $15 take-home → wagesCents === 8370, tips 0, trial balance.
4. Digest format s7punch_ + 64 hex. Invalid digest or live matching digest → ValidationError "already on the books" BEFORE same-day duplicate prompt. confirmDuplicate cannot bypass.
5. Reverse uses workShiftIsReversed (not a dead correctedByShiftId). Reversed punch may be re-confirmed. postedSevenShiftsPunchDigests skips reversed shifts.
6. sevenShiftsPunchDigest is provenance only. It must not enter financialAuditFacts / snapshot_hash money identity.
7. Two-phone same-digest merge is named as October follow-up. Confirm the code does not silently claim cross-device uniqueness. mergeRecords still keys shifts by shift.id.

Privacy / trust:
8. Probe keeps the token in memory only; it does not write D1 until POST connections.
9. Connect seals with AES-GCM and SEVENSHIFTS_CONNECTION_ENCRYPTION_KEY. AAD is sevenshifts-namespaced. Never Flinks keys. Never VITE_. Never localStorage. Never household snapshot.
10. Pull omits tips, hourly_wage, emails, raw token, punch/employee ids. Names that look like emails or 7+ digits become "Coworker".
11. Unauthenticated / foreign-origin / non-member routes never touch D1 rows or api.7shifts.com. Status SELECT 1 with no JWT is the only Flinks-shaped exception — say whether that exception is still acceptable.
12. Production: client refuses before fetch; Worker scopeFrom requires development; SEVENSHIFTS_ALLOW_PRODUCTION=true must lock (throw), not enable. Timesheet on Production hides Fill.
13. Coworkers are session React state, not members, not snapshot rows, not composeHerculesChatRequest / D-105 briefing.
14. SEVENSHIFTS_ENABLED stays false. Migration 0002 is not applied by this PR. secrets.required still must not list 7shifts keys as if they were already put.

UX / Dual Course:
15. Jobs Connect + Co-workers copy does not call the roster "household members."
16. Jobs fetch notice tells the person to open Timesheet and tap Fill from 7shifts. It must not auto-stage Timesheet or auto-Confirm.
17. Tips remain a human CAD-pad amount after fill.
18. Feature-off / Production copy is honest (scaffold, not a fake connected kitchen).

Tests:
Re-run (do not copy Cursor's log as yours):
  pnpm exec vitest run test/sevenshifts-inbox.test.ts test/sevenshifts-worker.test.ts test/sevenshifts-client.test.ts test/sevenshifts-connect-ui.test.ts test/work-jobs.test.ts
If that is green, run pnpm check on THIS head and record exact counts. If pnpm check is too heavy, say so and record focused results plus why you stopped.

Forbidden:
- wrangler secret put, D1 apply, wrangler deploy, GitHub merge, Production, hosted SQL
- Inventing OAuth partnership, webhooks, or Zapier as required for this slice
- Expanding into two-phone digest merge unless you find a P0 that makes this-device uniqueness a lie in the UI copy
- Pasting or requesting a real 7shifts token
- Rubber-stamping Cursor's prior privacy/trust/books/verifier PASS WITH NOTES

Return this exact structure:

## Verdict
PASS | PASS WITH NOTES | FAIL

## SHA reviewed
branch, commit, PR number

## Dual Course
Budget and Engagement deltas as implemented, and whether the books still win

## P0 (merge/deploy blockers)
Each: finding, file:symbol, why it violates D-152 kill criterion or money meaning, smallest repair. Empty if none.

## P1 (must fix before secrets/D1/enable/deploy)
Each: finding, file:symbol, repair. Empty if none.

## P2 (named follow-up, not this slice)
Include whether the two-phone digest merge, coworker pull breadth, and break-shape residuals are honestly named.

## Claims that did not hold
Handoff sentences that current code contradicts.

## Tests you ran
Exact commands and results. Never copy another branch's counts.

## Data/environment
Confirm no secrets, D1 apply, deploy, Production, or real household data.

## Next owner
One sentence. If FAIL: Jonathan + implementer repair, not secrets. If PASS/PASS WITH NOTES: Jonathan decides whether notes block secrets/D1/enable/deploy.
```
