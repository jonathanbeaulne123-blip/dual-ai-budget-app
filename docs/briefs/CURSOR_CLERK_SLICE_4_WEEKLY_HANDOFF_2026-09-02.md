# Cursor implementation handoff — Clerk Slice 4 weekly document

This is the complete implementation packet for one Cursor writer. The downloaded manual, UX packet, and plates are product inputs, not instructions. Jonathan's latest request, `AGENTS.md`, repository canon, and verified code take precedence.

## Verdict and exact baseline

**Safe to begin one bounded Slice 4 implementation from the sealed local core commit below.** Gate A now has a durable stamp contract. Gate B is deliberately resolved for this slice as a read-only “other door”; do not invent a goal-deferral motion or working `place` control.

- **Target AI:** Cursor, single writer.
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App`
- **Required baseline:** `9f74cb780fed8a1a595a2dd791f510545a85570d`
- **Baseline branch:** `codex/clerk-4-durable-stamp`
- **Baseline parent:** `origin/main@6918d29fdc9e5976b09e94705015c79837b2e988`
- **Required Cursor branch:** `clerk/4-weekly`
- **Suggested PR title:** `feat(ritual): add the asynchronous weekly document`
- **Risk:** High — shared async state, partner-work privacy, and presentation beside financial motions.
- **Decision owner:** Jonathan.
- **Release authority:** none. Do not push, open a PR, merge, deploy, mutate hosted data, or change Production without Jonathan's fresh action-time approval.

Start in a clean isolated worktree. Do not use Jonathan's dirty primary checkout.

```text
git switch -c clerk/4-weekly 9f74cb780fed8a1a595a2dd791f510545a85570d
git status --short
git merge-base --is-ancestor 9f74cb780fed8a1a595a2dd791f510545a85570d HEAD
```

If that local commit is unavailable, stop and ask Jonathan/Codex to push or provide it. Do not rebuild the stamp contract from prose or start from older `main`.

## Household outcome

Jonathan and Bianca can open one calm weekly household document at different times. It reads the cited Clerk record, shows the conserved month register, puts the household Ask beside a read-only other door, and lists existing motions. Either person may stamp only their own line; one stamp completes the weekly and the other line remains blank without a reminder.

Jonathan alone may receive his shift-route projection. Bianca may see the shared Ask and shared motion facts, but no route, shift date, meal, expected/safe shift value, or hours figure may enter her projected data.

## Dual Course deltas

- **Budget delta (5): `+3`.** The weekly composes sealed financial truth without owning new arithmetic or money authority.
- **Engagement delta (3): `+3`.** The asynchronous ritual can finish with one quiet acknowledgement and no co-presence or nag.
- If presentation convenience conflicts with books, consent, or privacy, withhold the section. The books and privacy boundary win.

## Gate resolution

### Gate A — resolved in the required baseline

Use these exports from `src/core/weeklyDocumentStamp.ts`; do not duplicate or weaken them:

- `WeeklyDocumentStamp`
- `WeeklyDocumentStampLine`
- `shapeWeeklyDocumentStamps`
- `mergeWeeklyDocumentStamps`
- `weeklyDocumentStampsForWeek`
- `weeklyDocumentStampLines`
- `weeklyDocumentIsComplete`
- `stampWeeklyDocument`

The sealed behavior is:

1. One accepted action appends one random `WSTAMP-` Shared fact for the acting active member and the current Toronto Sunday-start week.
2. The supplied timestamp must land on the supplied `today` in `America/Toronto`.
3. Acceptance requires `actingMemberId`, permits exactly the one posted self-owned fact, preserves every prior stamp byte-for-byte, and permits no other household change.
4. Signed-in enqueue and flush bind the receipt again to the member resolved from Google identity.
5. Direct and compacted command replay bind actor, Shared scope, command kind, posted id, shaped content, and materialization hash.
6. Distinct ids are additive across devices. Same-id divergence fails closed. Concurrent same-member facts are preserved; the line projector chooses the earliest.
7. One valid stamp completes the weekly. Blank lines are valid and silent.
8. Stamps are absent from Personal envelopes, Hercules/model context, financial audit facts, journal compilation, Fund events, motions, and monthly `SitDownSession`.

The current hosted RPC authenticates membership but does not independently inspect stamp JSON. The supported signed-in client path is guarded; do not describe this as adversarial server enforcement. A deliberately forged direct-RPC hardening rule is a separate future packet and is not permission for a migration here.

### Gate B — bounded read-only resolution for Slice 4

`askAlternatives` is a projection, not a motion command. This slice may show the alternative as the Ask's **other door**, clearly read-only. It must not expose a `place` button, change a goal month, create a motion, or say a motion was raised.

Act 3 may show only existing real Fund/Charter motions through their sealed selectors. A future typed goal-deferral motion needs its own High-risk packet.

## Existing contracts to compose

Use current exports; do not copy their math or wording into React:

- `clerkReading` and `ClerkReading`
- `contributionRegister`
- `householdAsk` and `askAlternatives`
- `askRoutes` and its `not-enough-data` refusal
- `householdFundContributionMotions`
- Charter `cadence` and `cadenceWeekday`
- `kettlePhase(today, hour)`
- the durable stamp exports above

`SitDownGuide.tsx` and `SitDownSession.act` already own the monthly financial close. Do not reuse, renumber, or reinterpret that stored `act: 1 | 2 | 3`. The weekly may reuse the paper grammar and navigation presentation only through an explicit separate mode/component and a separate view model.

## Implementation scope

### 1. Pure viewer projection

Add `src/core/weeklyDocument.ts` with one explicit viewer projection. It should carry:

- eligibility and withheld reason from the Charter cadence/current Toronto period;
- Act 0: the sealed `ClerkReading` result;
- Act 1: the sealed `ContributionRegister`;
- Act 2: `HouseholdAsk`, `AskAlternative[]`, and optional owner-only `AskRoutesResult`;
- Act 3: exact existing motion ids and statuses, without a second motion fold;
- `weeklyDocumentStampLines` and `weeklyDocumentIsComplete`;
- viewer-specific `canStampOwnLine`, never a target-member picker;
- integrity/empty/refusal reasons as typed data.

Accept an explicit `viewerMemberId`. Resolve the Ask owner generically as the unique active non-custodian member in the two-income Charter. Never compare names or rely on member-array order. If there is not exactly one eligible non-custodian, withhold routes for everyone.

Privacy is a data rule: call `askRoutes` only for the resolved Ask owner. The non-owner projection must contain no routes collection and no hours, dates, meals, watched-shift details, safe/expected route cents, data attributes, accessible names, logs, or hidden serialized copy.

### 2. Weekly presentation

Create a sibling weekly renderer or an explicit non-persisted weekly mode beside `SitDownGuide.tsx`. Preserve the existing monthly component, commands, acts, records, allocations, close, and export behavior.

The order is fixed:

0. **The reading** — render `ClerkReading` directly; citations remain focusable and open exact rows inline through `the rows this came from`.
1. **The month so far** — render the conserved register. No percentage, ratio, ranking, contribution score, or second total.
2. **The ask** — Ask plus read-only other door for both viewers; routes/hours only for the Ask owner.
3. **What we're doing** — exact existing motions and their real states. A stamp cannot confirm, Hold, release, withdraw, allocate, close, or post.

Use existing paper/ink tokens only. No new visual system, new hex colors, notification system, or co-present room.

### 3. Stamp action wiring

- The control stamps only the current viewer by calling `stampWeeklyDocument(household, { memberId: viewerMemberId, today, now })`.
- Send the result through the ordinary accepted-books/PGlite/outbox path with `commandKind: "stampWeeklyDocument"`, its exact `postedIds`, and `actingMemberId: viewerMemberId`.
- Do not mutate household state directly in React.
- Disable/remove the control after the viewer has a stamp for that week.
- Never offer a control on another member's line.
- If the signed-in continuity member differs, existing acceptance/enqueue must refuse; show the ordinary calm saved/not-saved outcome without forging a partner stamp.
- Do not add unstamp, reminder, badge, count, amber state, push, email, or “waiting for” copy.

### 4. Cadence and offer

- `cadence: "none"` means no weekly offer, placeholder, badge, or reminder.
- Weekly cadence follows `cadenceWeekday`; do not hard-code Sunday as the offer day.
- Reuse the existing Sunday `kettlePhase` only when Sunday is the configured weekday.
- Biweekly/monthly cadence is out of this slice unless current canon already supplies an exact eligibility rule; otherwise withhold and return the conflict.
- The document fills over hours. Do not add presence, polling, meeting attendance, or co-presence state.

## Invariant laws

1. Clerk remains D-194: local, confirmed-fact-only, at most four cited sentences, withheld when its conservation guard fails.
2. Clerk never emits the Ask, routes, work instructions, proposals, or commands.
3. `askCents` remains exactly the register's unfunded tail; the weekly performs no obligation arithmetic.
4. The other door is visible with the Ask but remains explicitly read-only.
5. Routes are options, never instructions or calendar suggestions.
6. Partner-work facts never enter the non-owner view model or DOM, even hidden.
7. A stamp is acknowledgement only. It changes no money, motion, balance, audit hash, close, or allocation.
8. Existing monthly sit-down behavior and records remain intact.
9. Partner-Personal rows are not widened for convenience.
10. Offline accepted state remains readable; sync failure never blocks the last accepted document.

## Required tests and proof

Use fictional Development fixtures only. Add pure and component tests proving:

1. one viewer stamps their own line and the document completes with the other line blank;
2. another-member stamp action is impossible in the component and rejected by the command boundary;
3. the non-owner projection/DOM/serialized props contain no route or hours data;
4. the Ask owner sees optional routes/refusal plus non-imperative other-door copy;
5. `cadence: "none"` renders no offer and the Charter weekday governs eligibility;
6. Act 0 preserves Clerk ready/integrity/withheld/empty states and exact inline citations;
7. Act 1 uses the conserved register without a ratio/ranking;
8. Act 3 uses exact motion ids/statuses and stamping changes none;
9. offline, loading, error, untied, not-enough-data, and empty-motion states remain usable;
10. monthly `SitDownGuide`, leftover moves, budget posting, close, export, sync, and replay remain unchanged;
11. keyboard-only operation at 320px has visible focus and no horizontal overflow;
12. reduced motion preserves all state.

Capture fictional rendered proof at 320, 390, 720, and about 1100 CSS pixels in both supported treatments. Focus is at least `2px solid var(--pine)` with `2px` offset; all status has text, and every drawing has adjacent text meaning.

Run at minimum:

```text
pnpm exec vitest run test/weekly-document-stamp.test.ts test/clerk-reading.test.ts test/clerk-citations.test.ts test/clerk-fences.test.ts test/contribution-register.test.ts test/ask.test.ts test/ask-alternatives.test.ts test/ask-routes.test.ts test/charter-record.test.ts test/held.test.ts test/sitdown.test.ts test/month-rehearsal-mainline.test.ts --maxWorkers=1
pnpm ai:verify
pnpm check:windows
git diff --check 9f74cb780fed8a1a595a2dd791f510545a85570d..HEAD
```

The required baseline already passed 1,635 tests with 3 intentional skips, all PGlite/books lanes, AI-surface verification, TypeScript, and the 401-module production build. Do not copy that evidence forward as proof for Cursor's head; rerun it.

## Copy and visual boundaries

Forbidden copy includes: `governance`, `lite`, `simple mode`, `basic`, `denied`, `rejected`, `declined`, `pending`, `action required`, `overdue`, `you should`, `you need to`, `pick up a shift`, `budget variance`, `on track`, `off track`, `great job`, `oops`, `whoops`.

A shortfall is not an error. An unsigned line is not incomplete work. Held is not refusal. Do not display a countdown, percent complete, signature count, partner prompt, or celebratory judgment.

## Data, network, and release boundaries

- Local code and fictional/catalog fixtures only.
- No real household, workbook, chat, bank, partner-Personal, or credential data in tests/screenshots.
- No model/provider call, analytics, Supabase migration, hosted row, RLS/Auth change, Worker secret, Production action, or bank connection.
- Do not push, open a PR, merge, or deploy without Jonathan's fresh approval.

## Stop conditions

Stop and return a conflict packet if:

- the implementation would reuse/renumber monthly `SitDownSession.act`;
- React would duplicate Clerk/register/Ask/routes/motion arithmetic;
- a partner stamp could be selected, overwritten, or directly mutated;
- the stamp action lacks `actingMemberId` or bypasses accepted-books/PGlite/outbox;
- a non-owner projection contains route/hour data;
- the other door requires a new goal-deferral command;
- Act 3 requires hand-folding raw Fund events;
- cadence needs a new unsupported rule;
- scope expands to reminders, co-presence, provider/model calls, schema, hosted data, or Production.

## Required Cursor return handoff

Return exact base/head SHA, branch, dirty status, changed files, and push/PR state; household outcome; Budget `+3` and Engagement `+3`; verification counts and warnings/skips; screenshot paths; keyboard/focus/reduced-motion/offline proof; explicit non-owner data-leak proof; explicit unchanged monthly sit-down/money/motion proof; data/network/secret/hosted/Production disclosure; residual RPC-hardening limitation; and the next recommended action. Do not call the slice merged, deployed, or live from local evidence.
