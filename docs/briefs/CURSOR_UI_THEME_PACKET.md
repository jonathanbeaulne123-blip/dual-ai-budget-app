# Cursor brief — Hearth UI theme implementation packet

> **Status (2026-08-25):** **Blocked.** Draft C/D code was reverted; production UX is pre-theme September Office. Implement only after [implementation-target mockups](../ux/2026-08-25-implementation-target-mockups.md) are approved and illustrated assets exist. CSS-only passes are explicitly out of scope.

> **Paste with:** `docs/HEARTH_UI_THEME.md`, `docs/ux/2026-08-25-home-ux-report.md`  
> **Lead:** Cursor (implementation). **Review:** Claude or `hearth-ux-auditor` (visual/a11y), `books-auditor` if money labels touched.  
> **Baseline:** `main` at start of branch  
> **Jonathan locks (2026-08-25):** Mobile **C**, Desktop **D** (first mock style + wander pathing), Hercules **focus/unfocus** mobile.

## Goal

Implement the locked UI theme so **future features** reuse grounded paper grammar, tokens, and Hercules behaviors — not ad-hoc cards. Ship the smallest coherent slice that proves the theme in code.

## Canon refs

- `docs/HEARTH_UI_THEME.md` — **theme authority**
- `docs/ux/2026-08-25-home-ux-report.md` — audit evidence
- `src/styles.css`, `src/office.css`, `src/office-phone.css`
- Mockups in PR #117 artifacts (`ux_mock_*`)

## Allowed scope (pick slices; do not boil the ocean)

### Slice 1 — Theme kernel (required first)

- Extract shared CSS/classes: `.hearth-paper-tile`, `.hearth-wax-seal`, `.hearth-story-strip`, `.hearth-notebook-body` (names illustrative)
- Document in `HEARTH_UI_THEME.md` §4 with actual class names once created
- No visual change required if extraction is zero-diff; prefer small refactor from Books tiles

### Slice 2 — Mobile Home C shell

- `src/OfficePhone.tsx` + `src/office-phone.css`
- Thin weather ribbon → wax seals (Post/Due/Close) → 2×2 story strip → one notebook expand
- Remove/replace phone stamp chips aesthetic with seal grammar
- Drop drawer as primary nav where story strip covers instruments; drawer may remain for overflow
- **Hercules:** collapsed pill; tap opens focus overlay component (new or extend `Hercules.tsx`)

### Slice 3 — Mobile Hercules focus/unfocus

- Full-screen overlay: dimmed desk, large Maine Coon, teacher chips, dismiss → pill
- Inert/hidden during Add/Confirm
- `prefers-reduced-motion`: cross-fade only

### Slice 4 — Desktop D room + wander pathing

- Keep free-move layout from `Office.tsx`
- Visual pass toward first Draft D stylized room (window, desk, paper objects)
- Hercules wander path between `publishFurniture` targets (extend `Hercules.tsx` / `useFurniture.ts`)
- Sentence-case instrument names; pin gutter 52px / 104px edit-only fix

### Slice 5 — Mobile Books C + desktop Calendar/Books room chrome

- `Books.tsx` mobile: seals for pane family + hero + story + notebook expand
- Desktop Calendar/Books: same room atmosphere as Home (not separate skin)

## Forbidden

- Money kernel, Commands, Confirm semantics, Auth/RLS, schema, deployment
- Draft E standalone layout; phone stamp-row aesthetic as final
- Second theme/fonts; CAD on weather; guilt mechanics
- Shrinking desktop to match mobile or stretching mobile C to desktop canvas

## Implementation steps

1. Read `HEARTH_UI_THEME.md` end-to-end.
2. Implement **Slice 1** shared tile components (or CSS module) reused by Books + OfficePhone.
3. Implement **Slice 2** mobile Home C behind existing breakpoint gate — feature-flag optional for Jonathan review.
4. Implement **Slice 3** Hercules focus mode on mobile only.
5. Implement **Slice 4** desktop visual + wander without removing instruments.
6. Wire **Slice 5** tab parity when slices 2–4 stable.
7. Run `pnpm test`; add visual/regression tests for tile render if cheap.
8. Screenshot 390 + 1100; delegate `hearth-ux-auditor`.

## Acceptance checks

```bash
pnpm test
pnpm check
```

Manual at **320, 390, 720, ~1100px**:

| Check | Expect |
|---|---|
| Mobile Home | Seals + 2×2 stories + one expand; Hercules pill visible, not covering nav |
| Hercules focus | Tap pill → full-screen; dismiss → pill; hidden during Add |
| Desktop Home | Stylized room; cat wanders; Confirm never covered |
| Books mobile | C grammar matches Home |
| Labels | Sentence-case; no `Milk` as Post stamp value |
| Reduced motion | No tilt/rain animation; focus uses fade |
| Tokens | No new palette outside `:root` |

## Handoff contract

Return `docs/AI_HANDOFF.md` fields plus:

- Which slices shipped
- New shared components / CSS classes (for theme packet §4 update)
- Screenshots paths
- Dual Course deltas
- Decision row draft for D-decision when Jonathan approves

## Out of scope for this packet

- B-stack swipe animation (Engagement follow-up)
- Onboarding, Auth invite chrome, opening truth
- Production deploy
