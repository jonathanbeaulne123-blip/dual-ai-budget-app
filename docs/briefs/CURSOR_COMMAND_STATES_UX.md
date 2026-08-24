# Cursor brief — Command state UX implementation

> Paste with `docs/CLAUDE_COMMAND_STATES_UX.md` and `docs/claude/COMMAND_CONTRACT.md`.  
> **Lead:** Cursor (implementation). **Review:** Codex (checklist §9), Claude (a11y/visual).  
> **Baseline:** `main@ac6a8b6e0d1b5b9cfe47dfc49c5407cac25e1fd4`

## Goal

Wire household UI chrome (header sync chip, persistent banners, toasts, Confirm/Add outcomes) to the existing `CommandOutcome` contract. Users must always know: posted or not, shared or pending, conflict or recovery — without a second state machine.

## Canon refs

- `docs/CLAUDE_COMMAND_STATES_UX.md` (design authority this pass)
- `docs/claude/COMMAND_CONTRACT.md`
- `src/claude/commandContract.ts`
- `src/core/commandOutcome.ts`
- `docs/CLOUD_CONTINUITY.md`

## Allowed scope

- `src/App.tsx` — outcome → surface rendering; fix misleading `syncState` mapping
- New small module e.g. `src/commandSurface.tsx` (presentation only)
- `src/Confirm.tsx` — a11y attributes
- `src/Pairing.tsx` — align sync copy with contract (if still shown)
- `src/styles.css` — banner/chip/toast styles
- Tests: Vitest for `renderCommandSurface` mapping; Playwright optional for 390px screenshots
- Synthetic Development fixtures only

## Forbidden

- `acceptHouseholdWrite`, outbox, Supabase, schema, Auth/RLS, credentials, deployment
- Production data or environment behavior changes
- Second parallel state machine
- OfficePhone/Hercules drawing changes (unless blocking Post visibility)
- Resolving §10 product questions without Jonathan

## Implementation steps

1. **Add `renderCommandSurface(outcome)`** using `toCommandSurface()` + matrix in CLAUDE_COMMAND_STATES_UX §3.
2. **Replace direct `setSyncState("error")` on pending-transport** with chip derived from outcome.sharingMode.
3. **Gate success toasts** with `guaranteesPostedExactlyOnce(state)`.
4. **Gate failure inline** with `guaranteesPostedNothing(state)` — never success toast.
5. **Persistent banner** for: `pending-transport`, `conflict-needs-attention`, `recovery-available`.
6. **Confirm/Add** — follow §7 persistence table; `aria-busy` during `saving`.
7. **Header stack** — environment pill + optional ledger switcher + sync chip + scope tabs (existing).
8. **Fix copy** — remove any host-phone language in Pairing/More (audit grep).

## Acceptance checks

```bash
pnpm test
pnpm check
```

Manual / Playwright at **320, 390, 720, ~1100px**:

| Fixture | Expect |
|---|---|
| `pending-transport` | “Waiting to share”; success toast + banner; no “saved to cloud” |
| `synchronized` | “Up to date”; success toast; no error syncState |
| `conflict-needs-attention` | Blocking banner; no false merge message |
| `permanent-validation-failure` | Add stays open; no success toast |
| `recovery-available` | Recovery banner; Confirm blocked for new id |

VoiceOver: conflict + recovery announcements assertive.

## Risk tags

`risk:money` (presentation only, but false “posted” is stop-ship), `risk:sync` (copy alignment)

## Dual Course

- Budget **+4** if checklist §9 passes with visual evidence
- Engagement **+1** if Hercules line hooks outcome (optional this packet)

## Epic incorporation (household workspace)

Do **not** `git apply` `claude-ux-epic-phase1_*.patch`. That patch targets the pre-D-111 `saveHousehold` → `syncHouseholdBooks` path and invents `WriteTruth` (`saved-local` / `books-accepted` / `books-rejected`). Current `acceptHouseholdWrite` already fail-closes; “saved but books disagree” is forbidden.

**Do** fold this work into the epic as Phase 6 + Phase 1 a11y, on `CommandUiKind`:

1. Re-implement patch a11y on current `App.tsx`: `useDialog`, Add dialog, names, `aria-current`, 44px pins.
2. Drive chrome from `toCommandSurface(outcome)` — never a second enum.
3. Product defaults: [`COMMAND_STATES_PRODUCT_QUESTIONS.md`](COMMAND_STATES_PRODUCT_QUESTIONS.md).

## Open questions

In-app “keep this side” merge stays blocked until Jonathan decides. Other §10 items have UI defaults in the product-questions brief.

## Handoff back

PR with: diff summary, screenshot set, checklist §9 ticked, residual risks, test output.
