# Worksession — Horizon ↔ Mountain full-App UX dissection

**Date:** 2026-09-28
**Branch:** `cursor/horizon-mountain-toggle-39dc`
**Base:** `origin/main@9fed6002`
**Head:** recorded on close
**Risk:** Medium
**Budget delta (5):** +0 — no money meaning, writers, schema, or Confirm changes
**Engagement delta (3):** +1 — one session can flip Mountain and Horizon under real App chrome for dissection

## Outcome

Jonathan can open a fictional household (whole-house review or flagged Vite) and switch **Mountain** ↔ **Horizon** without leaving the App. Compass, QuickSheet, and host doors stay; only the XOR world shell remounts. Geographies and presence worlds stay partitioned (D15 unchanged).

## Scope

- Reactive DEV world seam (`src/harbour/harbourWorld.ts`)
- In-App `WorldToggle` beside harbour chrome
- `HarbourWorld` + App remount key
- Cloud Agent `.cursor/environment.json` harbour flags + review terminal
- Whole-house review banner Horizon link + `docs/horizon/README.md` §8 note

## Out of scope

- Geographic merge, side-by-side canvases, Mountain VillageHUD on Horizon land
- `VITE_HEARTH_HORIZON` / D15 production switch
- Presence cross-world peers, Worker, hosted schema
- Exhaustive full lanes

## Verification (fill on close)

- Focused quick gate command and result
- Manual: Mountain → Horizon → Mountain with Compass/QuickSheet present
- Data/environment: fictional Development only; no Production

## Next owner

Jonathan reviews the toggle in whole-house review, then decides any follow-up chrome overlay packet.
