# Hearth worksession — Merge FAB + Add slideshow onto main and deploy

- **Status:** OPEN
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (Cloud Agent)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/add-slideshow-main-aef7` (from current `origin/main`; do not rebase `#244`)
- **Baseline SHA:** `origin/main@e9c5127594a9fd4e6d8b203f19db57cc4b31390a`
- **Head SHA:** pending integration
- **PR or issue:** new PR against `main`; `#244` stays until this lands. Jonathan 2026-08-31: “perfect merge push deploy”
- **Risk:** Release (merge to `main` + D-041 kitchen `wrangler deploy`)
- **Decision owner:** Jonathan
- **Environment impact:** Development kitchen URL via `hearth-books` `wrangler deploy`. No hosted schema, secrets, Production mutation, or household-data change in this session.

## Household outcome

Jonathan and Bianca get the live kitchen with the lifted `+` speed dial and unique Add prompt slideshows on current `main` (desk already shipped as D-173 via #252, plus Shift/Evidence/startup/sync work). Confirm still posts. Slideshow never `postEntry`.

## Budget delta (5)

`+3` — calmer posting path; accepted-books account tiles; Confirm remains the write.

## Engagement delta (3)

`+3` — unique ceremonies instead of one dense sheet; FAB one tap from Home.

## Verified baseline

Facts:

- `#244` `cursor/shared-ledger-story-aef7` @ `4c51a016c07494dda0a29922b3345c4705f77b62`
- `origin/main` @ `e9c5127594a9fd4e6d8b203f19db57cc4b31390a` (includes #252 kitchen-desk integration)
- Merge-base `#244` ↔ `origin/main`: `ed708dc358ed808fbc5a9ec89b6c95bdb9a55a60`
- `#244` unique since merge-base: 7 commits (Codex packet docs, Claude month-instrument prompt, FAB, Add slideshow, Fund Confirm copy)
- Kitchen-desk law is already **D-173** on `main`. `#244` D-174 Add slideshow collides with `main` D-174 Shared Money. Next free after D-180 is **D-181**.
- D-179 on `main` is investor synthetic household (why-notes).

Inferences:

- Merging `#244` into current `main` should bring only the 7 unique commits, not re-litigate the desk.

## Scope

### In scope

- Branch from current `origin/main`, merge `#244`, resolve conflicts.
- Renumber Add slideshow **D-174 → D-181**. Keep `main` D-165–D-180.
- Keep FAB + Add slideshow product text. Confirm still posts.
- `pnpm check`, independent audits, merge to `main`, D-041 deploy, live HTTP proof.

### Out of scope

- Hosted schema, secrets, Production household mutation, clasp.
- Restyling Home/Books/Kitty Banks.
- Claude month-instrument widget (prompt only; no UI until Jonathan confirms).
- Re-opening leftover spend or Fund formulas.

## Acceptance evidence

- [ ] Unique living IDs: Add slideshow is D-181; `main` D-174 Shared Money stays.
- [ ] Confirm is the only money writer in Add; slideshow never `postEntry`.
- [ ] `pnpm check` green on the integration SHA.
- [ ] Merged to `main` and kitchen `wrangler deploy` verified HTTP 200.
- [ ] Handoff distinguishes merged / deployed / live verified.

## Plan

- [ ] Create `cursor/add-slideshow-main-aef7` from `origin/main`.
- [ ] Merge `origin/cursor/shared-ledger-story-aef7`.
- [ ] Resolve App/CadPad/styles/docs; D-181.
- [ ] Focused tests + `pnpm check`.
- [ ] Audits, then merge to `main`, push, watch Cloudflare Workers, verify kitchen URL.

## Evidence log

- 2026-08-31: Jonathan: “perfect merge push deploy”.
- 2026-08-31: `git fetch origin main` → `e9c5127`. `#244` @ `4c51a01`. Merge-base `ed708dc`. Ahead/behind vs main: 58 / 7.

## Decisions

- Do not rebase or force-push `#244`.
- `#244` wins Add/FAB UX. `main` wins startup/sync/shared-money/Shift Evidence already on tip.
- Add slideshow law becomes D-181.

## Remaining uncertainty

Live kitchen may still show cached HTML until Worker deploy finishes. Picture is still not a journal attachment.

## Handoff

In progress. Next owner after live verify: Jonathan.
