# Hearth worksession — Opening truth engine (Slice B)

- **Status:** OPEN
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/opening-truth-engine-4857`
- **Baseline SHA:** `891cc5dfe535dc4244cd87577af18e47a0fdd3f1` (`main`)
- **Head SHA:** (in progress)
- **PR or issue:** (pending)
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development client only; no hosted schema, secrets, or Production

## Household outcome

A household can Confirm real starting balances (assets and debts) on one Toronto as-of date. Opening equity balances the books. Nothing pretends the money was earned or spent inside Hearth.

## Budget delta (5)

`+5`

## Engagement delta (3)

`+1`

## Verified baseline

- D-128/D-129 product locks on opening truth.
- `"opening"` exists on `JournalEntry.source` only; no command or compile path.
- Only `EQ-RETAINED` equity chart account; equation treats RE as net income.
- Onboarding Slice A not on `main` — permanent More entry + optional auto-prompt when no accepted money.

## Scope

### In scope

- `postOpeningBalances` + pure draft/projection
- `EQ-OPENING` chart account; compile opening txs; equation/balance sheet update
- Exclude opening from P&L, cash flow, budgets, duplicates, work income
- Confirm UI (phone + desktop denser review) + More entry
- Reversal support for opening rows
- Focused tests + handoff

### Out of scope

- Hosted migrations / schema apply
- Full Hercules onboarding choreography (Slice A unmerged)
- Production deploy

## Acceptance evidence

- [ ] Assets-only, debt-only, mixed openings balance
- [ ] P&L / cash flow / budget unchanged by opening rows
- [ ] Personal/shared visibility correct
- [ ] Confirm once; failure leaves prior household
- [ ] `pnpm check` green

## Plan

- [x] Branch from current `main`
- [ ] Core engine + equation
- [ ] UI + Confirm
- [ ] Tests + auditors + PR

## Evidence log

## Remaining uncertainty

Slice A coordinator merge may later auto-route into this flow.

## Handoff

Jonathan review via GPT; not shipped until merge + kitchen verify.
