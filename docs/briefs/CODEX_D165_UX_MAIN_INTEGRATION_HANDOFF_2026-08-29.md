# Codex integration handoff — kitchen desk UX + current `main`

**Use this as the contract for one Codex/GPT writer.** Do not continue a Cursor implementation thread. Do not restyle the desk. Do not reopen product law.

Jonathan’s instruction (2026-08-29): GPT added features on `main` while Cursor built the kitchen desk. Merge those lineages into **one organism**. Stay inside the same strict boundaries Cursor had. You may **suggest placement and layout**. You may **not** leave the product feeling. The UX has a vibe: add onto it and polish it. Do not replace it.

---

## Status and exact baseline

- **Target AI:** Codex (GPT), as the single integration writer. One writer per checkout.
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Packet branch (this document):** `cursor/shared-ledger-story-aef7`
- **UX head (bring this):** `ed708dc358ed808fbc5a9ec89b6c95bdb9a55a60` — draft PR [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244)
- **Current `origin/main` at packet time (land onto this, then re-fetch):** `4b2f40064b526541ef7a20d6e99fc99ca5647baa` — includes PR #251 companion-label mint
- **Shared merge-base:** `871e6607b4bc6a5d653f9e9bbcc9131f9a07dc65`
- **Implementation branch:** create a **fresh** `codex/` or `cursor/` branch from the then-current `origin/main`. Record that exact SHA before editing. Do **not** rebase or force-push `#244`.
- **This packet:** documentation only on `#244`. **Not merged, not deployed, not live.**
- **Risk:** **High** (ledger-mode presentation + Shift/Evidence/Auth boot + decision-ID collision).
- **Decision owner:** Jonathan.
- **Independent reviewers after the integrated tree exists:** books, privacy, UX (vibe lock), trust. Then verifier. Do not self-audit the merge you just wrote.

Re-fetch `origin/main` before branching. If `main` moved past `4b2f400`, land onto the **new** tip and record it. Do not skip newer main work to make the merge easier.

---

## Household outcome

Jonathan and Bianca open **one kitchen**. Shared Home is the paper desk: wax seals, mosaic, stage, Kitty Banks. Personal Books is the serious account floor. Shift still collects 7shifts envelopes, attendance, Bibles, and Evidence — but those instruments sit in the **existing paper room**, not a second product skin.

The result is one Hearth organism:

- Cursor’s desk grammar and leftover-spend / Personal-floor truth stay.
- Codex’s D-166–D-172 Shift/Evidence/companion work stays.
- Blank-kitchen boot (D-167) still cannot empty `#root`.
- Confirm still posts money. D-172 still forbids silent 7shifts/Gmail/OCR/schedule posts.
- Partner-personal rooms stay off Shared, off the Personal Books floor, off Hercules, and off export.

---

## Why now

The two lineages forked at `871e660`. Neither is wrong. `#244` is the kitchen they sit in. `main` is the Shift/Evidence mesh they use at work. Leaving them as parallel PRs would ship two Hearths.

This packet exists so Codex can integrate without inventing a third visual system or re-litigating leftover spend, Fund math, or coworker privacy.

---

## Dual Course result

- **Budget delta (5): `+5`.** An integrated kitchen that quotes accepted-books CAD, keeps leftover spend honest, keeps Confirm as the writer, and keeps D-172 collection-only automation is more useful than either branch alone.
- **Engagement delta (3): `+2`.** Shift mail, envelopes, and companion chrome may be placed with care. They must not outshout seals, mosaic, or fat banks.
- If they conflict, **the books win.** Cut a flourish, a new card chrome, or a Shift hero before changing leftover meaning, exposing partner-personal rooms, posting without Confirm, or restyling the desk.

---

## Decision IDs — mandatory collision repair

`#244` assigned **D-165** to the kitchen desk (one Shared pool, Personal Books floor, leftover spend, fat banks).

Concurrent `origin/main` assigned **D-165** to Evidence Queue `max_batch_size: 1`, then continued:

| ID on `origin/main@4b2f400` | Law |
|---|---|
| D-165 | Development Evidence consumes one encrypted capture per Queue invocation |
| D-166 | 7shifts coworker identity is a member-owned workplace directory, never household membership or money |
| D-167 | A household open must never blank `#root` |
| D-168 | Coworker attendance review is a non-financial sidecar on visible Shift Confirm |
| D-169 | Visible 7shifts published-week grid capture (employee-visible fields only) |
| D-170 | Visible My Timesheets capture; wages excluded; Confirm still posts |
| D-171 | Approved punch may prefill an editable Shift draft; missingness stays missing |
| D-172 | Near-autonomy is collection and prefill, not money. D-159 automatic posting is superseded. Visible Confirm writes books + attendance + ShiftBible |

**Required on the integration branch:**

1. Keep `main`’s D-165 through D-172 numbers and product text.
2. Re-home `#244` kitchen-desk law as **D-173** (next unused ID after D-172 on `main@4b2f400`). If `main` already took D-173, take the next free ID and record why.
3. Do not change kitchen-desk **product text**. Only the number moves.
4. Update `docs/DECISIONS.md`, `docs/HEARTH_ROADMAP.md`, `docs/AI_HANDOFF.md`, `docs/ACCOUNTS.md`, and worksessions so no living file claims two D-165s.
5. Leave `#244` history as-is. Renumber on the **integration** branch only.

---

## Two lineages — what each already owns

### A. Kitchen desk (`#244` @ `ed708dc`) — **feel lock; do not restyle**

Implemented D-164 Shared Story / Personal Folio, then Jonathan’s 2026-08-29 kitchen-desk confirm.

**Law (becomes D-173 on `main`):**

1. Shared is **one pool**, not a daily room list. Kitty Banks on Shared are sub-accounts. Fund surplus still goes to **existing** shared goals (D-161). No new envelope formula.
2. Personal Books is the account floor: household-visible rooms + this member’s rooms. **Never partner-personal.** Figtree / serious type. `personalBooksFloor(household, memberId)` — not `scopedHousehold`.
3. Home seals, Shared and Personal: **Money in** = posted income this Toronto month; **Money out** = posted expenses only (unpaid recurrences out); **Leftover spend** = in − out (may be negative). Sit-down leftover (`leftoverProjection`) is a **different number**. Empty month `$0.00`. Leftover tap → Plan. iPhone `OfficePhone` mosaic otherwise unchanged.
4. Kitty Banks fatten from `savedCents` in 10% steps (`kittyBankStep` 0–10). Shared copy = sub-accounts; Personal copy = goals. Fund contribute uses Confirm.
5. Personal Books Confirm CAD uses `walletForListedAccounts(booksHousehold, listedIds, today)` against **accepted** books, not the floor clone.
6. Home / dashboard / Hercules / export stay on `projectLedgerExperience` → `scopedHousehold`. Do not dump the household journal into `scopedHousehold`.
7. Writers: accepted `booksHousehold` + `restoreAcceptedSnapshot`. Confirm still posts. Widgets never `postEntry`.

**Feel (locked):**

- Cream paper (`--paper` `#f3eee4`, `--card` `#fffaf2`, `--ink` `#1b1712`). Pine / copper / gold. **Not** glassmorphism, SaaS dashboard, or game HUD.
- Figtree body; Fraunces money and names where already used. Sentence-case finance words.
- Wide Home at **`>=900px`:** grid `seals / mosaic / stage / banks`. **720–899 stacks** (documented; do not “fix” to three columns at 720 without Jonathan).
- Wax seals: Money in / Money out / Leftover spend.
- Fat SVG `PaperBank` on the right. Collapsible setup **closed** (`CollapsibleCard` real `open` state; React ignores `defaultOpen` on `<details>`).
- Gold chrome lives in the **Drawer**. Weather temperature lives **in the glass**, not a duplicate sill strip.
- Calendar colour by **kind**, not person. Second tap grows below-grid detail.
- Posted cash/card/wage **bubbles under Tip climate** on Shift. Confirm still posts.
- Hercules: opaque **cream bubble**; chips only after How can I help; leftover CAD fenced off Personal Ask.
- Personal Books hero: *“Rooms I can manage. Partner-personal rooms stay off this floor. The figure is accepted-books position, not a partner-hidden envelope.”*
- Shared Wallet: Shared pool card + Kitty Banks, not a room list.

**Proof already on `#244` (do not throw away):**

- `pnpm check` at `ed708dc` → **1116 passed / 2 skipped**, `ai:verify` + Vite build green.
- Focused: `test/ledger-experience.test.ts`, `test/ledger-story-ui.test.ts`, `test/ledger-story-dom.test.ts`, `test/kitty-banks.test.ts`, `test/office-wide.test.ts`, `test/shared-ledger-story.test.ts`.
- Visual (fictional Development demo as Jonathan): leftover spend `$5,404.04 − $2,846.20 = $2,557.84`; Personal Books rooms; Plan Confirm this bank; OfficePhone 320/390 seals.

### B. Current `main` (`4b2f400`) — **keep the work; place it into the desk**

Do not drop or silently disable:

- D-167 blank-household boot, GIS identity skip, `KitchenErrorBoundary`, Sign out clearing member session (`test/app-kitchen-boot.test.ts`).
- D-166 private coworker roster; D-168 attendance sidecar on Confirm.
- D-169 / D-170 visible schedule and timesheet capture; wage column excluded.
- D-171 approved-punch Shift draft; blank ≠ zero.
- D-172 autonomous envelopes, Shift mail, confirmed Bibles, historical weather as fail-soft context, seven-day evidence purge. **D-159 automatic posting is off.** Worker automation routes fail closed.
- Development capture gates and companion registration labels (PR #251 — mint **concrete** labels, do not regress to placeholders).
- Evidence Queue CPU limit (D-165 on `main`).

Canon on `main`: `docs/SEVEN_SHIFTS_EVIDENCE.md`, `docs/DECISIONS.md` D-165–D-172, worksessions `2026-08-28-coworker-attendance-review.md`, `2026-08-29-autonomous-shift-envelope.md`.

---

## Vibe lock — what “add on and polish” means

Jonathan: you may suggest placement and layouts. You may not venture out of the product feeling.

### You may

- Place Shift envelopes, Shift mail, attendance review, Evidence Center, companion registration, and Bibles **into** `WorkShiftPage` / Jobs / More using existing instruments: paper tiles, wax seals, `CollapsibleCard`, cream Hercules bubble, chips, ConfirmSheet.
- Suggest that envelope inbox sits **above** or **beside** posted-earnings bubbles, or that Evidence is a collapsed notebook under Tip climate. Write the suggestion in the return handoff if you do not implement it.
- Resolve CSS so `#244` desk tokens win and `main`’s Shift/Evidence spacing inherits them.
- Polish contrast, focus rings, reduced-motion, and 44px targets **without** new chrome families.
- Keep `main`’s boot/ErrorBoundary even if it is not pretty — recovery is paper, never a fintech crash screen.

### You may not

- Introduce a second theme, dark SaaS shell, new primary font, or fintech blue.
- Replace wax seals, fat banks, cream Hercules bubble, gold Drawer, or weather-in-glass.
- Redesign iPhone `OfficePhone` mosaic, story strip, or bottom nav. Seal **labels** on `#244` stay.
- Stretch the 3-column desk below 900px, or invent a fourth Home column for Shift mail.
- Put Evidence, coworker names, or envelopes on Shared Home mosaic or Personal Books floor.
- Recolor calendar by person/member (kind colour stays). GCal overlay may still tint by member — do not expand that onto Hearth items.
- Restyle Kitty Banks from paper pigs into progress bars, coins, or game HUD.
- Change leftover copy to “safe to spend,” “sit-down leftover,” or “month net.”
- Open Add-bank / Fund setup / Audit by default. Collapsed stays collapsed.
- Cover Post/Confirm with a chart, cat, or Evidence panel (D-156 kill criterion still holds).

Theme canon: [`docs/HEARTH_UI_THEME.md`](../HEARTH_UI_THEME.md). One sentence: *a warm Toronto kitchen-table office — cream paper, pine and copper, rain on the glass, a Maine Coon on the furniture.*

---

## Same boundaries Cursor had (do not loosen)

Never, without Jonathan’s explicit approval:

- Merge to `main`, deploy, `wrangler deploy`, clasp-push, apply hosted schema, change secrets, use Production, or mutate household data.
- Put keys in `VITE_`. Put model keys in Worker secrets only if Jonathan orders that work (out of scope here).
- Build bank feeds, Interac, or issued cards.
- Call this work shipped, kitchen-live, or Production-ready.

Always:

- Default experiments to Development. Fictional/demo data only for screenshots.
- Confirm is the money writer. D-172: 7shifts, Gmail, OCR, AI, schedules, and jobs may collect and prefill; they cannot write money.
- Partner-personal never on Shared, Personal Books floor, Hercules, or export.
- `personalBooksFloor` ≠ `scopedHousehold`. Leftover spend ≠ `leftoverProjection`.
- No new Fund formulas. Fund contribute and room interest/rewards stay behind ConfirmSheet.
- One kernel, two UI branches: `<720px` glance + one-tap; `>=720px` composed office; three columns only at `>=900px`.
- Living canon is `docs/` except `docs/nostalgia/` and `docs/reference/`.

---

## Git strategy (required)

1. `git fetch origin main` and `git fetch origin cursor/shared-ledger-story-aef7`.
2. Branch from **current** `origin/main`: `codex/kitchen-desk-main-integration` (or `cursor/…-aef7` if this Cloud Agent template applies). Record `BASE=$(git rev-parse HEAD)`.
3. Merge `#244` **into that branch** (`git merge origin/cursor/shared-ledger-story-aef7`). Prefer merge over rebase so both histories stay reviewable. Do not rebase `#244` itself. Do not force-push `#244`.
4. Resolve conflicts with the table below. When CSS, copy, or Home/Books/Kitty layout disagrees, **`#244` wins**. When Shift Evidence, envelopes, attendance, boot, Worker flags, or companion labels disagree, **`main` wins**, then dress the `main` UI in `#244` paper grammar.
5. Renumber kitchen-desk D-165 → D-173 on this integration branch only.
6. Run focused tests from **both** lineages, then `pnpm check`.
7. Open a **new draft PR** against `main`. Leave `#244` open until Jonathan says otherwise. Do not merge.
8. Independent books / privacy / UX / trust / verifier on the **integrated SHA**, not copied from `#244` or `main`.

If the merge is so conflicted that you would have to rewrite Home or Shift from scratch, **stop** and hand the conflict list to Jonathan. Do not invent a third desk.

---

## Conflict hotspots (files both sides touched)

Overlap at packet time (`871e660` → `#244` vs `871e660` → `origin/main`):

| File | `#244` intent | `main` intent | Resolution |
|---|---|---|---|
| `src/App.tsx` | Ledger view, Kitty Banks Plan, nav, accepted-snapshot writes, leftover fence | Blank-boot ErrorBoundary, GIS identity, shift envelopes, attendance Confirm, coworker import | Keep **both**. Boot/ErrorBoundary/`previewShiftAmounts` from `main`. Desk routing, `personalBooksFloor` wiring, Kitty Plan, leftover Ask fence from `#244`. Envelope/attendance callbacks from `main`. |
| `src/WorkShiftPage.tsx` | Posted earnings bubbles, week/month/year chips, Personal aria, cups not saucers | Envelopes, Bibles, attendance, Evidence Center, coworker import | Keep **`main`’s envelope/Evidence/attendance flow**. Keep **`#244`’s posted-earnings bubbles under Tip climate**. Place envelope inbox in existing paper cards; do not add a dashboard hero. Confirm still posts. |
| `src/Calendar.tsx` | Kind colour, `dayOpen` below-grid detail, titles in cells | Small evidence/outlook hooks | Keep `#244` colour/detail. Do not let evidence tint Hearth items by person. Outlook stays outlook. |
| `src/Office.tsx` / `src/OfficeWide.tsx` (Wide is `#244`-only vs merge-base) | 3-col desk, seals, Drawer gold, weather in glass | Minor chalkboard/office nits on `main` | `#244` desk wins. Do not put envelopes on Home. |
| `src/Hercules.tsx` | Cream bubble, leftover CAD fence, chips after help | Companion/Pro disclosure nits | Keep cream bubble + leftover fence. Keep `main` disclosure/refusal. Coworker names stay out of generic disclosure (D-166). |
| `src/styles.css` | Desk, banks, bubbles, floor, calendar kind | Evidence/Shift/notice spacing | Merge selectors. **Tokens and desk classes from `#244`.** Do not fork `:root`. |
| `src/core/commands.ts` / `src/core/index.ts` | Floor/seals/banks exports; accepted-snapshot writes | Envelope/Bible/attendance commands | Keep both export surfaces. Do not let envelope commands post money. |
| `src/main.tsx` | Small boot import | Kitchen boot / error path | Keep `main` blank-root defense. |
| `docs/DECISIONS.md`, `docs/HEARTH_ROADMAP.md`, `docs/AI_HANDOFF.md` | D-164 implemented + kitchen-desk D-165 | D-165–D-172 on `main` | Reconstruct: `main` IDs 165–172 **plus** kitchen-desk as D-173. Do not concatenate blindly. |

`#244`-only (take as-is, then compile): `src/core/ledgerExperience.ts` (`personalBooksFloor`), `src/core/kittyBanks.ts`, `src/core/officeWide.ts` (`deskMonthSeals`), `src/Books.tsx` floor, `src/KittyBanks.tsx`, `src/Accounts.tsx` Confirm CAD, `src/theme/PaperTheme.tsx` `CollapsibleCard`, `src/ledger-story.css`, `src/office-wide.css`.

`main`-only (take as-is, then dress): `src/imports/*`, `workers/evidence*.js`, `src/WorkShiftPage.tsx` envelope UI, coworker roster, `test/shift-envelope.test.ts`, `test/work-coworkers.test.ts`, `test/app-kitchen-boot.test.ts`.

---

## Suggested placement (allowed; not a redesign)

These are starting placements. Codex may adjust and must record the choice.

1. **Shift → Today:** Tip climate and `#244` posted cash/card/wage bubbles stay at the top of the work story. Envelope “needs Confirm” list is a **paper notebook under those bubbles**, collapsed if empty. Do not add a second seal row for pending envelopes.
2. **Attendance review:** stays inside the existing four-step Confirm sheet as a sidecar. No Home mosaic tile. No money from names.
3. **Evidence Center / companion registration:** stay under Shift → Jobs (or the existing Evidence door). Concrete companion labels from PR #251. Collapsed by default.
4. **ShiftBible:** after Confirm, as a paper receipt in the Shift room — not a Home infographic.
5. **Shared Home / Personal Books:** no Evidence, no coworker names, no envelope counts.

If a placement would require new Home furniture, **do not add it**. Put it on Shift or More.

---

## Invariants (kill the branch if any break)

- Confirm is the only money writer in this packet. D-172 collection/prefill never calls `postEntry` / `postWorkShift` by itself.
- Partner-personal rooms, txs, recurrences, and goals never appear on Shared, Personal Books floor, Hercules, or export.
- Leftover spend is posted in − posted expenses. It is not `leftoverProjection`.
- Personal Books Confirm quotes accepted-books CAD via `walletForListedAccounts`. Floor clone is Activity/visibility only.
- `scopedHousehold` is not replaced by the full journal.
- Widgets, weather, cosmetics, and Hercules never `postEntry`.
- iPhone `OfficePhone` structure unchanged except the three seal labels already on `#244`.
- No new Fund formula. Kitty Banks remain existing goals.
- Coworker identity is not household membership and does not change CAD.
- Blank household open cannot clear `#root`.
- Decision IDs on the integration branch are unique. Kitchen desk is not numbered D-165 there.

---

## Out of scope

- Merge, deploy, hosted migration, secrets, Production, real 7shifts OAuth publication.
- Re-enabling D-159 automatic posting.
- iPhone Home redesign, Classic free-move desk, new Fund envelope, bank feeds.
- Reopening leftover-spend vs sit-down leftover.
- Reopening whether Shared is a room list (it is not).
- Changing 3-column breakpoint from 900px without Jonathan.
- Museum folders (`docs/nostalgia/`, `docs/reference/`) as planning inputs.

---

## Acceptance criteria

A fresh reviewer can verify from the integration SHA alone:

1. Unique living decision IDs: `main` D-165–D-172 preserved; kitchen desk is D-173 (or next free).
2. Shared Home `>=900px`: seals + mosaic + stage + Kitty Banks. Seal labels Money in / Money out / Leftover spend. No coworker/Evidence furniture.
3. Personal Books: joint + own rooms; partner-personal denied; Confirm CAD matches accepted books for listed rooms.
4. Leftover spend equals `incomeActualCents - expenseActualCents` for that ledger month; unpaid recurrences excluded from Money out.
5. Kitty Banks `kittyBankStep` 0 / 10% / 100% distinct; Fund contribute Confirm; Add-bank closed.
6. Shift: posted earnings bubbles **and** envelope/attendance/Evidence/Bible from `main`. Visible Confirm still required to post a shift.
7. D-167: kitchen ErrorBoundary / identity skip still present; household open does not blank `#root` in `test/app-kitchen-boot.test.ts`.
8. Companion registration still mints concrete labels (PR #251).
9. `pnpm check` green on the integration SHA. Do not paste `#244`’s 1116 or `main`’s count.
10. Visual proof, fictional Development demo only, at **320 / 390 / 720 / ~1100**: Shared Home desk, Personal Books floor, Shift Today (bubbles + envelope placement), OfficePhone seals. Keyboard, focus, reduced-motion, empty, error.
11. Independent books **PASS**, privacy **no P0/P1**, UX **vibe lock PASS** (no new skin), trust **PASS**, verifier **PASS** on the six product claims above.
12. Return `docs/AI_HANDOFF.md` with Dual Course deltas, exact SHA, verification, uncertainty, data/environment disclosure, next owner. PR described as draft, not shipped.

---

## Exact commands

```bash
git fetch origin main
git fetch origin cursor/shared-ledger-story-aef7
git checkout -b codex/kitchen-desk-main-integration origin/main
git rev-parse HEAD   # record as BASE
git merge origin/cursor/shared-ledger-story-aef7
# resolve per the hotspot table; renumber kitchen desk D-165 → D-173
pnpm exec vitest run test/ledger-experience.test.ts test/ledger-story-ui.test.ts test/ledger-story-dom.test.ts test/kitty-banks.test.ts test/office-wide.test.ts test/shared-ledger-story.test.ts test/app-kitchen-boot.test.ts test/shift-envelope.test.ts test/work-coworkers.test.ts test/shift-bible-ui.test.ts
pnpm check
```

If `pnpm check` is not the repo gate, use the same gate `#244` used (`ai:verify`, `tsc --noEmit`, Vite build) and record the exact command.

---

## Data and environment disclosure (required in the return)

Write `none` explicitly where none occurred.

- Development impact
- Production impact
- Network calls or data sent
- MCP access
- Hosted rows / schema / secrets / deployments
- Real household or partner-personal data used

Screenshots: fictional Development demo only. Never commit workbooks, `.env`, chats, or credentials.

---

## Reviewers and return

| Review | Why |
|---|---|
| Books | Leftover spend, floor vs accepted CAD, Confirm, D-172 no silent post |
| Privacy | Partner-personal denial; coworker names; Evidence not in Hercules |
| UX | Vibe lock; 320/390/720/1100; OfficePhone fence; no new skin |
| Trust | Auth boot, Confirm, no schema/secrets, unique decision IDs |
| Verifier | The twelve acceptance criteria on the integrated SHA |

**Next owner after a green integrated PR:** Jonathan. He decides merge. Codex does not merge, deploy, or call it live.

**If blocked:** return the unresolved conflict list, the SHA you stopped on, and one recommended placement question — not a redesigned kitchen.

---

## Paste starter for a new Codex chat

```text
You are Codex, Hearth integrator. One writer. Read AGENTS.md, docs/AI_OPERATING_MODEL.md, and
docs/briefs/CODEX_D165_UX_MAIN_INTEGRATION_HANDOFF_2026-08-29.md.

Exact SHAs at packet time:
- origin/main 4b2f40064b526541ef7a20d6e99fc99ca5647baa (re-fetch; land on current tip)
- UX PR #244 cursor/shared-ledger-story-aef7 @ ed708dc358ed808fbc5a9ec89b6c95bdb9a55a60
- merge-base 871e6607b4bc6a5d653f9e9bbcc9131f9a07dc65

Jonathan: merge the kitchen-desk UX with current main into one organism.
Stay inside the same boundaries as Cursor. Suggest placement; do not leave the
product feeling. Add on and polish; do not restyle.

Create a fresh branch from current origin/main. Merge #244 into it.
#244 wins Home/Books/Kitty/seals/tokens. main wins Shift Evidence/envelopes/
attendance/boot/Worker flags/companion labels, then dress those in paper grammar.
Renumber #244 D-165 kitchen desk to D-173 so main’s D-165–D-172 stay unique.

Do not merge, deploy, apply schema, change secrets, use Production, or mutate
household data. Confirm still posts. D-172 collection cannot write money.
pnpm check on the integrated SHA. Independent audits. Draft PR. Not shipped.
```
