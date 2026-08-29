# ChatGPT independent review — D-164 Shared kitchen / Household table

**Use this in a new ChatGPT chat. Do not continue an implementation thread.**

## Which model

Use **GPT-5 Pro** in ChatGPT Pro, with thinking / extended reasoning **on**.

This is a High-risk Dual Course review (books + privacy + Shared vs Personal presentation). Instant, mini, and GPT-4o will rubber-stamp. If the picker still shows **o3-pro**, that is an acceptable substitute. Do not use GPT-5 Instant, GPT-4o, or mini.

One session is enough if it returns named gates. Do not ask the same model to then implement the fix in that chat.

## How to run it

1. New ChatGPT chat → **GPT-5 Pro**.
2. Paste the fenced prompt below.
3. Give it the code. The GitHub repo is private, so ChatGPT cannot fetch PR #244 unless you connect the repo or attach files. Attach, or paste, at least:
   - `src/Books.tsx`
   - `src/core/accounts.ts` (`householdWallet`, `householdTableStory`)
   - `src/core/ledgerExperience.ts`
   - `src/App.tsx` (Plan Kitty card ~3490, More Household table door ~3658, nav ~5209, `PlanCategories` Zero plan ~5435)
   - `src/core/commands.ts` (`setBudget` ~1488)
   - `src/HouseholdFundPanel.tsx` (custody + `LEDGER_CUSTODY_DISCLOSURE`)
   - `src/BatchImport.tsx` (account `<select>` ~874)
   - `docs/AI_HANDOFF.md` (top D-164 sections only)
4. Optional: draft PR https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244 if ChatGPT can open it.
5. Do **not** paste `.env`, Worker secrets, Google tokens, workbook exports, or real household rows. Demo/synthetic Development only.

Related: [AI_HANDOFF.md](../AI_HANDOFF.md) · [worksession](../worksessions/2026-08-28-shared-ledger-story-implementation.md) · [D-164 design packet](CURSOR_SHARED_LEDGER_STORY_HANDOFF_2026-08-28.md) · [DECISIONS.md](../DECISIONS.md) D-164 / D-161 / D-046 / D-047 / D-048

## Exact git facts (packet time)

- Repo: `jonathanbeaulne123-blip/dual-ai-budget-app`
- Branch: `cursor/shared-ledger-story-aef7`
- Base: `origin/main` @ `871e6607b4bc6a5d653f9e9bbcc9131f9a07dc65` (do not rebase onto later `main` unless Jonathan asks; PR is dirty vs current GitHub `main`)
- Review against branch tip at or after `12111e4284ac8d9453bb3fa48dcc174840c34a98` (this packet)
- Draft PR #244 — **not merged, not deployed, not live**
- Risk: **High**
- Decision owner: Jonathan

---

Paste everything inside the fence:

```text
You are an independent reviewer of Hearth, not the implementer. Return PASS, CONDITIONAL, or FAIL. Do not write a patch. Do not merge, deploy, apply schema, change secrets, or rebase.

## Product (one paragraph)

Hearth is Dual Course: family-office books weigh 5; Hercules and interactables weigh 3. When they conflict, the books win. CAD is integer cents. Books civil dates stay America/Toronto. Commands plus visible Confirm post money. Hercules never posts. The Household Fund (D-161) is a virtual shared operating subledger over Bianca’s savings; Hearth cannot move the money. Persistent custody sentence: “The money remains in Bianca’s savings. Hearth cannot move it.” Shared Ledger is the household table. Personal Ledger is a private folio, not Shared with a filter (D-164). Audit Office (D-046) is how we show the journal. Accounts Floor (D-047) is how we touch accounts. A hidden UI screen is not a privacy boundary.

## Authority (in order)

1. Jonathan’s latest explicit instruction.
2. AGENTS.md, docs/CLOUD_CONTINUITY.md, docs/DECISIONS.md (D-046, D-047, D-048, D-161, D-164), docs/STRATEGY.md, docs/ARCHITECTURE.md.
3. Current code on branch cursor/shared-ledger-story-aef7 — not docs/nostalgia/ or docs/reference/.

## Exact git facts

- Repo: jonathanbeaulne123-blip/dual-ai-budget-app (private)
- Branch: cursor/shared-ledger-story-aef7
- Base: origin/main @ 871e6607b4bc6a5d653f9e9bbcc9131f9a07dc65
- Review SHA: branch tip at or after 12111e4284ac8d9453bb3fa48dcc174840c34a98
- Draft PR #244 — not merged, not deployed, not the live kitchen
- Do not rebase onto later main unless Jonathan asks

## Claimed household outcome (verify; do not assume)

Shared keeps a deep Household table room: Fund, cash, cards, activity, import. It does not keep a Shared Books landing (double-entry, household net worth, trial-in-balance, Hercules unmodified, Assets/Liabilities/Income/Expenses as the opening). Personal still opens My books on accepted-books position, with copy that says so. Audit on Shared is a collapsed disclosure. Kitty Banks remains D-161 (Fund surplus into existing shared goals). Plan Goals vault is not deleted. iPhone OfficePhone structure is unchanged. No new Fund formulas.

Dual Course claimed: Budget +3 on the table pass / +4 on the broader kitchen. Engagement +2 / +3. Books win: trial-off still banners and opens Audit.

## What Cursor already claims as proven (treat as claims)

- pnpm check at 53799f9 and 2033d28: 1102 passed / 2 skipped (fictional tests).
- Visual, demo kitchen as Jonathan: Shared hero $12,234.19 household cash, not $13,789.50 net worth. Goal savings tile $1,940 (pigs vault), not $3,440 including everyday HIS. Audit Trial in balance. Personal My books $13,789.50 with “accepted-books position” copy.
- Shared primary nav: Home · Cal · + · Plan · More. Personal keeps Shift. Books/table is More → Open the household table.
- householdTableStory keeps chequing, goals-purpose savings, credit. Investments stay in Wallet.

## Open findings Cursor did not close (verify; do not rubber-stamp)

Label each as still true, false at this SHA, or unproven.

1. Plan has a named “Kitty Banks” card (h2 + primary button) that opens Fund. Design packet said do not invent a new Plan product. Jonathan also asked what Kitty Banks is vs Plan Goals. Decide whether the card is honest D-161 wayfinding or a new product surface.
2. Plan “Zero plan” calls setBudget(..., "0") but setBudget uses parseAmount without allowZero, so $0 never commits. Actuals are not deleted; the write fails.
3. Personal My books hero CAD is booksEquation(compileHousehold(booksHousehold)).netWorthCents from the full accepted snapshot, not the scoped folio. Copy was changed to admit this. Decide if honest copy is enough or the figure must be scoped.
4. Shared table/Wallet CAD uses householdWallet(displayHousehold) (scoped clone). Audit/journal compile booksHousehold (accepted). Same Visa can disagree across the page.
5. Shared Import still receives booksHousehold, so the account picker can name Personal-scope accounts (including Bianca’s Fund backing).
6. Wallet on Shared still lists investments (Accounts Floor). Intentional leftover; say if that belongs on the kitchen table.
7. Independent Cursor UX/books/privacy auditors ran against older SHA ad48fad. Do not treat those verdicts as HEAD proof.

## Named gates — return PASS / CONDITIONAL / FAIL each

G-BOOKS. No new Fund formulas, event kinds, or command authority. Trial-off still surfaces. Sit-down leftover unchanged. Kitty rollover still allocateHouseholdFundSurplus → existing shared goals. Words remain Fund free-to-spend, never global safe-to-spend. LEDGER_CUSTODY_DISCLOSURE unchanged.

G-PRIVACY. Shared opening must not show partner Personal accounts, last4, or private recon. A collapsed Audit is not a privacy boundary. Personal mode must not claim partner rows are out if the hero CAD includes them. Import on Shared table is in scope.

G-PURPOSE. Shared page identity is household table (Fund/cash/cards), not Audit Office. Personal may keep My books / position. Decide whether Shared should keep this route at all.

G-UX. Dual Course: books still reachable. Audit disclosure keyboard-visible. Phone OfficePhone not structurally redesigned. Add/Confirm unobstructed. 320 / 390 / 720 / ~1100 called out if you can see screenshots; if you cannot, mark visual unproven.

G-SHIP. Distinguish local / branch / PR / merged / deployed / live. This work is draft PR only.

## Return format (required)

1. Overall: PASS | CONDITIONAL | FAIL
2. One household-outcome sentence (what Jonathan and Bianca would notice).
3. Table of G-BOOKS, G-PRIVACY, G-PURPOSE, G-UX, G-SHIP with verdict + one evidence sentence each (file/symbol, not vibes).
4. Ranked findings P0 / P1 / P2. Smallest correction per finding. No patch.
5. What you could not verify (missing files, no runtime, private GitHub).
6. Next owner and the smallest next action. Do not authorize merge or deploy.

## Forbidden

- Do not implement.
- Do not invent CAD, Fund math, or screenshots.
- Do not paste or request secrets, Production data, or real household rows.
- Do not treat Cursor chat memory as proof.
- Facts and inferences must be labeled separately.
```
