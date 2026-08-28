# Hearth UI theme — living packet for all shells

> **Authority:** Jonathan's 2026-08-25 UX direction + this file + `docs/ux/2026-08-25-home-ux-report.md`.  
> **Use when:** any AI adds or restyles UI on Home, Calendar, Books, Plan, Add-in-room, or Hercules chrome.  
> **Does not change:** money meaning, Commands, Confirm boundary, Auth/RLS, hosted schema.

Hearth is **one product, two UI branches, one theme kernel** (D-079 / D-080 / D-082 / **D-156**).

| Branch | Breakpoint | Shell name | Direction |
|---|---|---|---|
| **Mobile** | `< 720px` | `OfficePhone` + tab pages | **Draft C ★** — hybrid seals, story strip, notebook expand |
| **Desktop / wide** | `≥ 720px` | `OfficeWide` paper office (default) + opt-in Classic desk | **Draft D ★ + D-156** — same room (window, wander) with phone C grammar composed as a two-column paper office; free-move canvas is Classic desk |

**Theme is shared.** Tokens, fonts, paper grammar, Hercules identity (Maine Coon), Dual Course gates.  
**Layout is not shared.** Never shrink desktop to phone or stretch phone C onto a free-move grid. Compose the grammar at width.

Mockup evidence lives under `/opt/cursor/artifacts/` and in PR [#117](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/117).

---

## 1. Feeling (one sentence)

A warm Toronto kitchen-table office: cream paper, pine and copper, rain on the glass, a Maine Coon on the furniture — **not** glassmorphism fintech, **not** a SaaS dashboard, **not** a game HUD.

---

## 2. Locked direction (Jonathan 2026-08-25 evening)

### Mobile — Draft C (final)

```text
┌─────────────────────────────┐
│ thin weather ribbon (no CAD)│
├─────────────────────────────┤
│  ○ Post   ○ Due   ○ Close   │  ← wax PAPER SEALS (not SaaS chips)
├─────────────────────────────┤
│ Today's stories  (2×2 scraps)│  ← Books tile grammar
│  Month net │ Visa due        │
│  Next bill │ Shifts          │
├─────────────────────────────┤
│ ▼ one notebook expand body  │  ← ONE open at a time
│   (income/expense bars…)    │
├─────────────────────────────┤
│ nav          [Hercules ●]   │  ← Duolingo pill, bottom-right
└─────────────────────────────┘
```

Borrow from **A** (glance simplicity inside tiles) and **B** (stack overlap depth) **inside** C — do not ship A or B as alternate Home shells.

**Mobile Books / Calendar / Plan:** same **paper family** as Home C (seals or soft pills for sub-nav, hero card, story scraps, optional notebook expand). Not a cold separate app skin.

### Desktop — Draft D synthesis (D-156)

Default wide Home is a **composed paper office**: phone C seals + story mosaic + notebook, laid out as two columns with a hero blotter and paper infographics. Combine two mockup intents for atmosphere:

| From | Keep |
|---|---|
| **First Draft D** (`ux_mock_draft_d_wide_paper_desk`) | Stylized room: rainy window, wooden desk, watercolor warmth, sentence-case names |
| **Round-2 wander** (`ux_mock_d2_desktop_hercules_wander`) | Hercules **pathing**: visible wander trail, perch targets on paper objects |
| **Phone C grammar** | Seals, mosaic, notebook — composed at width, not stretched 2×2 |

Free-move packing, S/M/L, Edit Desk, and personalities remain **Classic desk** (Cabinets). Desktop **Calendar** and **Books** tabs stay in the same room (window glimpse, paper grammar) and may use extra width.

### Hercules — two behaviors, one cat

| | Mobile | Desktop |
|---|---|---|
| **Default** | Small **Duolingo-style** pill/avatar, bottom-right, **out of the way** | Large Maine Coon **always visible**, wandering |
| **Engaged** | Tap → **full-screen focus overlay** (teacher chips, chat, grounded figures) | Optional compact bubble; cat remains scenery |
| **Dismiss** | X or backdrop → **unfocus**, shrink to pill | Pin/drag still available |
| **Add active** | Pill hides or moves clear; focus mode closes | Cat inert or moves clear; **never** on Post |
| **Identity** | Maine Coon only (D-044). No owl/dog stand-ins in production art |

Focus/unfocus is **exactly** the mobile pattern Jonathan approved (`ux_mock_mobile_hercules_focus.png`).

### Dropped

- **Draft E** as standalone — A+B+C combo supersedes it.
- Phone **stamp row** aesthetic (tech chips) → replace with **wax seals** in C.
- Uppercase furniture shouting (`CALCULATOR`, `BLOTTER`) on user-facing labels → **sentence-case finance words**.

---

## 3. Design tokens (do not fork)

Source of truth: `:root` in `src/styles.css`; office extensions in `src/office.css`, `src/office-phone.css`.

| Token | Value / role |
|---|---|
| `--paper` | `#f3eee4` — page atmosphere |
| `--paper-2` | `#ebe4d6` — desk / secondary paper |
| `--card` | `#fffaf2` — tile face |
| `--ink` | `#1b1712` — primary text |
| `--muted` | `#6b6258` — secondary text (watch contrast AA) |
| `--line` | `#d8cfc0` — borders |
| `--pine` / `--copper` / `--gold` | Success / warn / accent |
| `--font` | Figtree — body, labels, UI |
| `--display` | Fraunces — money, hero figures |
| `--shadow`, `--lift-*` | Paper lift, not Material elevation |

**Extend** tokens; do not introduce a second theme system or fintech blue palette.

---

## 4. Component grammar (reuse these patterns)

Every new surface should compose from these **instruments**, not invent new card types.

### 4.1 Paper tile (Books + mobile story strip)

CSS: `.hearth-paper-tile`, `.hearth-tile-kind`, `.hearth-tile-name`, `.hearth-tile-value`  
React: `PaperTile` in `src/theme/PaperTheme.tsx`

### 4.2 Wax seal (mobile controllers)

CSS: `.hearth-wax-seal`, `.hearth-wax-seals`  
React: `WaxSeal` in `src/theme/PaperTheme.tsx`

### 4.3 Story strip

CSS: `.hearth-story-strip`, `.hearth-story-grid`, `.hearth-story-heading`  
React: `StoryStrip` in `src/theme/PaperTheme.tsx`

### 4.4 Notebook expand body

CSS: `.hearth-notebook`, `.hearth-notebook-body`  
React: `NotebookBody` in `src/theme/PaperTheme.tsx`

### 4.5 Desktop instrument

- Sentence-case name on paper object with **material tint** (calculator gray-cream, wallet tan, mail envelope cream)  
- Free-move on grid; snap 8px  
- Pin gutter: **52px** default, **104px** only in edit mode (fixes S-tile clip)  
- Hercules publishes **furniture rects** for perch/path targets

### 4.6 Weather ribbon / window

- Atmosphere only — **no CAD on glass**  
- Timeout + cache; never block Add on weather fetch  
- Reduced motion: static wet-glass texture

---

## 5. Typography

| Use | Font | Case | Size guidance |
|---|---|---|---|
| Money, hero net | Fraunces | — | `clamp` on phone; 22–64px context |
| Body, buttons | Figtree | Sentence | 13–16px |
| Kind label | Figtree | Uppercase | 10–11px, tracking +0.08em |
| Instrument name (desktop) | Fraunces or Figtree | **Sentence** | 13–14px — not shouting caps |
| Stamp/seal label | Figtree | Uppercase | ≥11px |

Use **`rem`** for user-facing small type so OS font scaling works.

---

## 6. Motion

| Pattern | Shell | Rule |
|---|---|---|
| Hercules wander | Desktop | Slow path between furniture targets; respect reduced motion → static loaf |
| Hercules focus | Mobile | Pill → full-screen overlay; dim desk 15–20%; restore scroll on dismiss |
| Paper stack swipe | Mobile (future) | Draft B — horizontal swipe between stack decks; **after** C legibility ships |
| Tile expand | Mobile | Height transition; one open |
| Desk jiggle | Desktop edit | Edit mode only; off reduced motion |
| Rain/snow | Both | CSS only; off reduced motion |

---

## 7. Dual Course gates (theme vs books)

| Course | Weight | Theme may | Theme must not |
|---|---|---|---|
| **Books** | 5 | Project journal-true CAD, teach one primitive, link to Confirm | Invent figures, auto-post, hide environment, fake fees |
| **Engagement** | 3 | Hercules, weather, layout, cosmetics, focus play | Block Milk/Confirm, guilt/death mechanics, decorative authority |

**Kill criterion:** if Bianca will not add milk because Hercules or a widget is in the way → shrink furniture (mobile: collapse Hercules; desktop: move cat).

---

## 8. New feature checklist (every AI implements this)

Before opening a PR that touches UI:

1. **Shell** — Which branch? Mobile C grammar or desktop D room? If both, two explicit layouts — not one responsive blur.  
2. **Tokens** — Only `:root` / office CSS extensions?  
3. **Labels** — Sentence-case finance words; no invented CAD; projections named in handoff.  
4. **Tile** — Can it be a paper tile, seal, or notebook section instead of a new component type?  
5. **Hercules** — Mobile pill + focus? Desktop perch on new furniture rect?  
6. **Confirm** — Add/Confirm visible and uncovered at 320, 390, 720, ~1100px?  
7. **States** — loading, empty, error, offline, long text, large figures, reduced motion?  
8. **a11y** — 44×44 touch targets; `aria-expanded` + `aria-controls` on expands; contrast AA on warn text.  
9. **Evidence** — screenshots at 390 + 1100 for changed surfaces.

---

## 9. Forbidden patterns

- Glassmorphism, neon fintech, cold terminal Bloomberg chrome  
- Second nav paradigm on mobile (drawer + stamps + rail + sill saying the same thing)  
- Dashboard widget store grid on phone Home  
- Uppercase furniture names as primary labels  
- Hercules hunger meter, guilt streak, pay-to-keep-alive  
- CAD in weather/window  
- Static tile tilt on phone under reduced motion  
- Shrinking desktop desk to “match” mobile  
- Stretching mobile C to desktop without free-move room  
- New theme colors/fonts outside token table without Jonathan approval  

---

## 10. Mockup index (ground truth art)

### Locked references

| Artifact | Meaning |
|---|---|
| `ux_mock_draft_d_wide_paper_desk.png` | Desktop **visual style** target (stylized room) |
| `ux_mock_d2_desktop_hercules_wander.png` | Desktop **Hercules pathing** target |
| `ux_mock_mobile_home_c_hybrid.png` | Mobile Home **layout** target |
| `ux_mock_mobile_books_c_hybrid.png` | Mobile Books **layout** target |
| `ux_mock_mobile_hercules_focus.png` | Mobile focus/unfocus **interaction** target |
| `ux_mock_d2_desktop_home_soft.png` | Desktop Home round-2 (softness reference) |
| `ux_mock_d2_desktop_calendar_soft.png` | Desktop Calendar in room |
| `ux_mock_d2_desktop_books_soft.png` | Desktop Books in room |

### Exploration only (do not ship as alternate shells)

`ux_mock_mobile_home_a_simple.png`, `ux_mock_mobile_home_b_stack.png`, `ux_mock_draft_a/b/e` — borrow patterns into C/D only.

---

## 11. File map for implementers

| Area | Files |
|---|---|
| Mobile Home | `src/OfficePhone.tsx`, `src/office-phone.css`, `src/core/officePhone.ts` |
| Desktop Home | `src/OfficeWide.tsx`, `src/Office.tsx` (Classic desk), `src/office-wide.css`, `src/office.css`, `src/core/officeWide.ts`, `src/core/officeLayout.ts` |
| Widget bodies | `src/widgets/*.tsx` |
| Books | `src/Books.tsx`, `src/styles.css` (`.books-story-tile`, `.wallet-tile`, `.hero`) |
| Calendar | `src/Calendar.tsx` |
| Hercules | `src/Hercules.tsx`, `src/hercules.css` |
| Tokens | `src/styles.css` `:root` |

---

## 12. Related canon

- [OFFICE.md](OFFICE.md) — September Office instrument catalog  
- [CLAUDE_MOBILE_SHELL.md](CLAUDE_MOBILE_SHELL.md) — mobile shell history  
- [CLAUDE_DESKTOP_OFFICE.md](CLAUDE_DESKTOP_OFFICE.md) — desktop customization brief  
- [ux/2026-08-25-home-ux-report.md](ux/2026-08-25-home-ux-report.md) — audit + pros/cons  
- [briefs/CURSOR_UI_THEME_PACKET.md](briefs/CURSOR_UI_THEME_PACKET.md) — paste-ready implementation packet  
- [DECISIONS.md](DECISIONS.md) — add D-row when theme ships to code  

---

## 13. Decision record (pending code)

When implementation lands, record in `DECISIONS.md`:

- **Mobile Home** = Draft C shell (seals + story + notebook expand)  
- **Desktop Home** = Draft D room + D-156 composed paper office (Classic desk opt-in)  
- **Hercules mobile** = Duolingo focus/unfocus  
- **Hercules desktop** = ever-present wanderer  
- **Shared** = paper tile grammar across Home / Books / Calendar tabs  

Until then, this document is the **design authority** for theme work.
