# Hearth worksession — Computer office (D-151)

- **Status:** OPEN
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (implementer)
- **Repository:** dual-ai-budget-app
- **Branch:** `cursor/computer-office-d151-605a`
- **Baseline SHA:** `e7ad717b6536749f3906e713df4e2107b4e61f1b` (`main`)
- **Head SHA:** (this branch; update as commits land)
- **PR or issue:** draft PR for this branch
- **Risk:** Medium (UI/layout; games are kitchen cosmetics; Commands unchanged)
- **Decision owner:** Jonathan (G0–G5 continue/revert)
- **Environment impact:** Development client only; no hosted schema, secrets, or Production

## Household outcome

Computer Home (`≥ 1280`) is the locked night-cabin room: first-person desk wood wall-to-wall, fireplace and shelves in view, gold nav on the front edge of the wood, Household objects that post milk through Confirm. Tablet (`720–1279`) is scaled `OfficePhone`. Phone (`< 720`) Draft C is frozen.

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

- [ ] `pnpm test` / `pnpm check`
- [ ] 390 Draft C unchanged; 768/1024 scaled phone; 1280/1440 cabin
- [ ] CadPad 1250 → $12.50 still posts
- [ ] Add inert on computer desk; games cannot hide Post
- [ ] `docs/AI_HANDOFF.md` complete
- [ ] Independent UX audit

## Plan

- [x] Persist canon (D-151, COMPUTER_OFFICE, briefs, living rewrite)
- [ ] T0 three-view plumbing + tablet scale
- [ ] T1 empty room
- [ ] T2 living desk
- [ ] T3 personalities
- [ ] T4 Play + games
- [ ] T5 nest/cabinets + proof

## Evidence log

Record exact commands, results, visual widths, links, and current SHAs.

## Decisions

D-151. Locked Superdesign/image frames under `docs/ux/computer-office/` are the pixel source of truth. Superdesign CLI is unauthenticated on this Cloud Agent VM; do not block gates on a new canvas.

## Remaining uncertainty

Jonathan G0–G5 continue/revert. 12.9" iPad landscape at 1280 is a named edge. Two-browser game sync uses existing kitchen snapshot transport — no new channel.

## Handoff

Next owner: Jonathan. State: **branch / draft PR**, not merged, not deployed, not live verified.
