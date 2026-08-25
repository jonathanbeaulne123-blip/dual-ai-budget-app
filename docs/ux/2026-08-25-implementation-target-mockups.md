# Hearth implementation-target mockups (2026-08-25)

**Status:** BINDING visual target — approve these before any further theme code lands.  
**Author:** Cursor agent after Jonathan feedback (“looks nothing like what we talked about”)  
**Supersedes for visual fidelity:** prior CSS-only “theme kernel” pass on `cursor/ui-theme-implement-f375`

---

## Why the shipped code missed

The Aug 25 code pass renamed components and tweaked tokens, but **did not change the rendering model**:

| Mockup promise | What code actually ships |
|---|---|
| **Illustrated room** — window, wall, desk, mug, plant | Flat `--paper` fill + rectangular `.instrument` cards |
| **Paper objects** — envelope, wallet leather, spiral pad | Same card chrome with slightly different `background:` tints |
| **Big Maine Coon on furniture** | Small `Hercules` sprite (~96px) in a corner |
| **Watercolor warmth + torn edges** | 1px borders + `box-shadow` |
| **Scene composition** | Draggable grid layout from September Office |

Renaming “Blotter” → “Month net” does not make it look like pinned paper on a wall.  
**You were right:** structural Draft C/D is not visual Draft C/D.

---

## Ground truth art (old mocks you loved)

| File | Keep |
|---|---|
| `ux_mock_d2_desktop_home_soft.png` | **Primary desktop target** — big cat on wallet, rainy Toronto window, paper instruments |
| `ux_mock_draft_d_wide_paper_desk.png` | Room grammar — window left, objects on wall, desk drawer nav |
| `ux_mock_d2_desktop_hercules_wander.png` | Wander pathing — cat always visible, dotted trail, never blocks Confirm |
| `ux_mock_mobile_home_c_hybrid.png` | Mobile Home — wax seals, story scraps, notebook expand, Hercules pill |

---

## New implementation-target mockups (approve these)

These are generated to show **exactly what the app should look like** when done — not wireframes.

### Desktop Home — room + big cat

![Desktop Home implementation target](/opt/cursor/artifacts/hearth_impl_target_desktop_home_v1.png)

**File:** `hearth_impl_target_desktop_home_v1.png`

Must-haves:
- Rainy **window frame** (left) with sill props — not a full-width hazy band
- **Wall** behind instruments — textured cream paper, not dashboard grid
- Instruments as **objects** with material skins (paperclip, envelope flap, leather wallet, spiral pad)
- **Hercules** = large Maine Coon **on the wallet**, not a corner pill
- Sentence-case labels; Fraunces money; Figtree UI
- Bottom **nav** on torn parchment (Home · Calendar · + · Plan · Books · More)
- Wooden desk surface + nameplate + notebook props

### Desktop Home — wander pathing

![Desktop wander implementation target](/opt/cursor/artifacts/hearth_impl_target_desktop_wander_v1.png)

**File:** `hearth_impl_target_desktop_wander_v1.png`

Must-haves:
- Same room as above
- **Dotted wander trail** between sill → Pad → Wallet
- Cat shown at multiple poses along path (stretch, walk, loaf)
- Confirm/Post area **never covered** (bottom-right clear)
- Annotation: ever-present, not on-demand

### Mobile Home — Draft C

![Mobile Home implementation target](/opt/cursor/artifacts/hearth_impl_target_mobile_home_v1.png)

**File:** `hearth_impl_target_mobile_home_v1.png`

Must-haves:
- Thin weather ribbon only — **no chalkboard band**
- Wax seals (Post / Due / Close) — embossed circles, not bordered chips
- 2×2 **torn paper** story scraps with tape / slight rotation
- One **spiral notebook** expand with bar breakdown
- Duolingo-style **Hercules pill** bottom-right
- Standard Hearth nav + center Add FAB

---

## Implementation model (what code must become)

### Layer stack (desktop)

```text
z-index (back → front)
──────────────────────
0  room-bg.svg          — wall texture, watercolor margin, doodles
1  window-scene.svg      — frame, glass, rain, harbour/city parallax
2  desk-surface.svg      — wood grain, mug, plant, notebook props
3  instrument-layer      — positioned paper objects (not uniform cards)
4  hercules-sprite       — large cat, wander animation between rects
5  sill-plate            — Mint-style figures (sentence case)
6  nav-parchment          — existing .nav reskinned
7  confirm/add           — never dimmed, never covered
```

### Layer stack (mobile)

```text
0  paper-bg               — warm cream, subtle grain
1  weather-ribbon         — thin strip
2  wax-seals               — SVG/CSS embossed seals
3  story-scraps            — PaperTile with torn-edge mask + rotation
4  notebook-expand         — spiral binding graphic + ruled body
5  hercules-pill           — small avatar, tap → focus overlay
6  nav                     — existing
```

---

## Asset requirements (honest)

CSS alone **cannot** reach the approved mocks. Required assets:

| Asset | Purpose | Suggested format |
|---|---|---|
| `room-wall.webp` | Desktop wall texture | 1920×1200 repeat |
| `window-rain.webp` | Window frame + glass + rain | 600×800 |
| `desk-wood.webp` | Bottom desk strip | 1920×400 |
| `instrument-month-net.svg` | Paper + clip + chart slot | SVG shell + live text |
| `instrument-wallet.svg` | Leather wallet shape | SVG + live card text |
| `instrument-envelope.svg` | Mail / next bill | SVG |
| `instrument-pad.svg` | Spiral calculator pad | SVG |
| `hercules-loaf.webp` | Large cat on furniture | 512×512 sprite |
| `hercules-walk.webp` | Walk cycle (3–4 frames) | sprite sheet |
| `hercules-stretch.webp` | Sill stretch pose | 512×512 |
| `wax-seal-*.svg` | Post / Due / Close | SVG |
| `paper-torn-mask.svg` | Story scrap edges | CSS mask |

**Outside tools:** Image generation got us to these targets; **production** needs either:
1. A fixed illustrated asset pack (Figma export or AI batch + human cleanup), or  
2. A dedicated illustrator pass on the approved PNGs.

---

## Code slices (after mock approval only)

| Slice | Scope | Exit criterion |
|---|---|---|
| **D-ASSETS** | Export/obtain asset pack from approved PNGs | Side-by-side screenshot ≥80% match at 1100px |
| **D-ROOM** | Replace `desk-wide` grid chrome with room layers | Window left, wall center, desk bottom |
| **D-OBJECTS** | Instrument skins map to SVG shells; text live | Wallet looks like leather, mail like envelope |
| **D-HERCULES** | Large sprite + wander path between furniture rects | Cat visible at 1100px; never on Confirm |
| **C-MOBILE** | Wax seals + torn scraps + notebook art | Side-by-side at 390px |
| **C-FOCUS** | Hercules pill → full-screen overlay | Matches `ux_mock_mobile_hercules_focus.png` |

**Do not merge more CSS-only tweaks** until D-ASSETS lands.

---

## Approval checklist (Jonathan)

- [ ] Desktop Home v1 — room, big cat, paper objects  
- [ ] Desktop wander v1 — pathing behavior  
- [ ] Mobile Home v1 — seals, scraps, notebook  
- [ ] Willing to add illustrated asset pipeline (not CSS-only)  
- [ ] Nav labels confirmed: Home · Calendar · + · Plan · Books · More  

Once checked, next step is **asset pack + room shell** — not another token rename.

---

## Related

- [HEARTH_UI_THEME.md](../HEARTH_UI_THEME.md) — tokens + grammar (still valid)  
- [2026-08-25-home-ux-report.md](2026-08-25-home-ux-report.md) — original audit  
- PR #117 — original exploration mocks  
- PR #120 — structural-only implementation (insufficient visually)
