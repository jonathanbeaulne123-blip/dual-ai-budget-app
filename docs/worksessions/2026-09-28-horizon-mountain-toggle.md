# Worksession — Horizon ↔ Mountain full-App UX dissection

**Date:** 2026-09-28
**Branch:** `cursor/horizon-mountain-toggle-39dc`
**Base:** `origin/main@9fed6002`
**Head:** `358c16718c3b79ea5f3c9eb35044877eeee5d930`
**PR:** #565 (draft)
**Risk:** Medium
**Budget delta (5):** +0 — no money meaning, writers, schema, or Confirm changes
**Engagement delta (3):** +1 — one session can flip Mountain and Horizon under real App chrome for dissection

## Outcome

Jonathan can open a fictional household (whole-house review or flagged Vite) and switch **Mountain** ↔ **Horizon** without leaving the App. Compass, QuickSheet, and host doors stay; only the XOR world shell remounts. Geographies and presence worlds stay partitioned (D15 unchanged).

## Scope

- Reactive DEV world seam (`src/harbour/harbourWorld.ts`) with preference that survives `housePath` query rewrites
- In-App `WorldToggle` (z-index above review banner)
- `HarbourWorld` + App remount key
- Cloud Agent `.cursor/environment.json` harbour flags + review terminal
- Whole-house review banner Horizon link + `docs/horizon/README.md` §8 note

## Out of scope

- Geographic merge, side-by-side canvases, Mountain VillageHUD on Horizon land
- `VITE_HEARTH_HORIZON` / D15 production switch
- Presence cross-world peers, Worker, hosted schema
- Exhaustive full lanes

## Verification

- Quick gate (focus `test/harbour-world-toggle.test.ts`, risk medium) on `b75a37a9`: vitest-fast **611/611**; serial failed Playwright missing + bank-ack env; **time-budget-breached** at serial (~537s). Classification: quick-gate-failed on serial env; change-focused fast lane green.
- Units on head: harbour-world-toggle + source-fences + one-bar + desk-personal **43/43**.
- Chrome CDP: Mountain→Horizon→Mountain with `aria-pressed` and `world=` URL sync (`/opt/cursor/artifacts/toggle-chrome-proof.json`).
- Screenshots: `/opt/cursor/artifacts/mountain-with-toggle.webp`, `horizon-with-toggle.webp`, `mountain-after-toggle.webp`.
- Data/environment: fictional Development only; no Production.

## Next owner

Jonathan reviews the toggle in whole-house review on PR #565, then decides merge or any follow-up chrome overlay packet.
