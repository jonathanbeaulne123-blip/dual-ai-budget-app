# Hearth worksession — Computer office (D-151 / D-152)

- **Status:** OPEN
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (implementer)
- **Repository:** dual-ai-budget-app
- **Branch:** `cursor/computer-office-d151-605a`
- **Baseline SHA:** `e7ad717b6536749f3906e713df4e2107b4e61f1b` (`main`)
- **Head SHA:** update on close; current implementation `4105060` plus follow-up rig-guard commit
- **PR or issue:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/207
- **Risk:** Medium (UI/layout; games are kitchen cosmetics; Commands unchanged)
- **Decision owner:** Jonathan (G0–G5 continue/revert)
- **Environment impact:** Development client only; no hosted schema, secrets, or Production

## Household outcome

Computer Home (`≥ 1280`) matches the six photoreal stills (`hearth-canon-*.jpg`): first-person desk, fireplace, shelves, gold nav on the wood edge, objects that still post milk through Confirm. CSS cabin is not the look. Tablet (`720–1279`) is scaled `OfficePhone`. Phone (`< 720`) Draft C stays mostly untouched; stop and ask before porting desktop UX. Studio kit: [`docs/ux/computer-office/STUDIO_KIT.md`](../ux/computer-office/STUDIO_KIT.md).

## Budget delta (5)

`+1` naming/layout law only — Commands, Confirm, `postEntry`, and cents meaning stay. Games write empty `postedIds`. Projections never post.

## Engagement delta (3)

`+3` — computer Home becomes a room you sit in; personalities and Play earn a habit without becoming a second product.

## Verified baseline

- Phone Home is `OfficePhone` Draft C at `< 720` (`src/OfficePhone.tsx`, `src/office-phone.css`).
- Wide office was `≥ 720` with `hearth.office.<env>.wide`, `.app` `max-width: min(900px, 100%)`, Hercules `desktopFly` at `WIDE_BREAKPOINT`.
- Locked mockups copied to `docs/ux/computer-office/` (fictional demo CAD only). Prior Superdesign/image pass in this Cloud Agent produced those frames via Cursor image generation; Superdesign CLI remains unauthenticated on this VM, so those locked PNGs stay the pixel source of truth.

## Scope

### In scope

- D-151 canon + `docs/COMPUTER_OFFICE.md` + `docs/briefs/office/`
- Three-view breakpoint, tablet CSS, computer night-cabin shell
- Layout v3 + auto-size + personalities + Edit Desk
- Projection instruments: opinion, leftover, nextDue, sync
- Play + Kitchen Fleet, Sill Four, Pane Boxes (keep ttt/hangman)
- Shelf hotspots, sofa perch, destination chrome
- Tests and visual proof

### Out of scope

- Restyling phone Draft C structure
- Cabin on tablet
- Money command / Confirm changes
- Layout in `splitForSync`
- Production deploy, hosted schema, secrets
- Calling the work shipped

## Acceptance evidence

- [x] `pnpm check` at `80d190c` (follow-up commits typecheck + focused tests)
- [x] 390 Draft C; 768 scaled phone; 1280/1440 cabin (Jonathan G0–G1 still own the visual gate)
- [x] CadPad 1250 → $12.50 posted on fictional demo
- [x] Add inert on computer desk (HTML `inert`); games empty `postedIds`
- [x] `docs/AI_HANDOFF.md` complete
- [x] Independent UX audit (PASS WITH NOTES; notes patched)

## Plan

- [x] Persist canon (D-151, COMPUTER_OFFICE, briefs, living rewrite)
- [x] T0 three-view plumbing + tablet scale
- [x] T1 empty room
- [x] T2 living desk
- [x] T3 personalities
- [x] T4 Play + games
- [x] T5 nest/cabinets + proof

## Evidence log

- Baseline `e7ad717` (`main`). Branch `cursor/computer-office-d151-605a`. Draft PR #207.
- `pnpm check` at `80d190c`: 853 passed, 2 skipped, `tsc` + Vite production build green. One earlier `continuity-two-browser-proof` timeout was environmental (passes in isolation).
- Focused: `test/computer-office.test.ts` (11), `test/office-phone.test.ts` (14), `test/hercules-rig.test.ts` (11).
- Browser fictional demo: 390 Draft C; 768 scaled phone; 1280/1440 cabin; `1250` → posted `$12.50` groceries.
- Independent UX audit: PASS WITH NOTES (inert/focus then patched).
- Superdesign CLI: not authenticated on this Cloud Agent. Pixel source of truth is `docs/ux/computer-office/*.png` from the prior working image pass.

## Decisions

D-151. Locked Superdesign/image frames under `docs/ux/computer-office/` are the pixel source of truth. Superdesign CLI is unauthenticated on this Cloud Agent VM; do not block gates on a new canvas.

## Remaining uncertainty

Jonathan G0–G5 continue/revert. 12.9" iPad landscape at 1280 is a named edge. Two-browser game sync uses existing kitchen snapshot transport — no new channel.

## Handoff

Next owner: Jonathan. State: **branch / draft PR**, not merged, not deployed, not live verified.
