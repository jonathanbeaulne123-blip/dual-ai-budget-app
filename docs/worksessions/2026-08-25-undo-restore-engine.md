# Hearth worksession — Combined undo + restore engine

- **Status:** OPEN
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/undo-restore-engine-f375`
- **Baseline SHA:** `4d96cb1` (`main`, includes live-pull #109)
- **Head SHA:** (pending)
- **PR or issue:** (pending)
- **Risk:** High (money undo + shared restore; no silent LWW)
- **Decision owner:** Jonathan
- **Environment impact:** Development + Production client behavior; no hosted schema apply this PR

## Household outcome

Fat-finger **Undo** removes only your latest ledger Confirm; partner posts stay; cloud updates via CAS. Owners use **Restore** for dated sync snapshots. Open conflict / unresolved dual-use divergence blocks Restore (Q8 A). One engine for Dev and Prod.

## Budget delta (5)

`+3` — confirmation-scoped undo; owner restore; refuse restore when conflicted

## Engagement delta (3)

`+1` — clear Undo vs Restore labels; Recent LIFO of my writes

## Locked decisions (Jonathan 2026-08-25)

1. Toast Undo = only that Confirm (1A) with guidance defaults (whole Confirm for transfer/split)
2. Partner stays on Undo (2A)
3. Undo = personal fat-finger (3A)
4. Both short Undo + long Restore in More (owners Restore)
5. One engine Dev+Prod
6. Auto CAS after Undo
7. Recent = LIFO of **my** ledger Confirms (B)
8. Restore refuses while absorb/conflict needed (A)
9. Labels: Undo vs Restore
10. Restore = current household owner role only

## Scope

### In scope

- `undoLedgerConfirm` (postedIds only; no whole-snapshot undo)
- App: drop Dev last-sync toast path; LIFO my ledger history; auto CAS via commitHousehold
- `restorePoints` on household (hosted via existing snapshot payload); 30-day prune
- Owner gate via `continuity_memberships.role`
- More → Restore points UI
- Decision why-note superseding daily D-119 snapshot undo

### Out of scope

- Applying a new Supabase migration (optional 011 later if we split table out)
- Confirmation-scoped undo of arbitrary middle Confirms (A deferred)
- Changing quiet kitchen / non-ledger no-undo

## Acceptance evidence

- [ ] Focused tests for undo + restore eligibility
- [ ] `pnpm check`
- [ ] Trust review for money paths
