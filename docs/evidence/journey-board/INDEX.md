# Journey Board — visual + accessibility evidence

Captured against the real app in headless Chromium (`/opt/pw-browsers/chromium-1194`, SwiftShader software GL — not a phone,
not a real GPU), driving the same "Open the demo household table" → "I am Jonathan" flow the tool-atlas harness uses, on a
local Vite dev server built with the `pages.yml` presentation flags (`VITE_HEARTH_HOUSE_WORLD=1 VITE_HEARTH_HARBOUR=1
VITE_QUEENS_NEST=1 VITE_FUND_MODEL_V2=1 VITE_CELLAR_V3=1` plus the continuity/Hercules flags). Local only: not merged, not
deployed.

Every demo login creates a **new, fictional Development household** (synthetic data only), so exact dollar figures / dates
differ capture to capture; the structure and states shown are representative.

## Two capture passes — which file comes from which tree

- **Final tree (integrator refresh, after review fixes B1/M1/M2/M3 and MINORs 1–10).** Each viewport in a **fresh browser
  context at its real size** (no resizing): 320×568, 390×844, 720×900, 1100×800. Every page load fetched exactly one land
  file, `/horizon/world/horizon-geo-1.journey.json.gz` (the slim baked land, REVIEW M2) — never the index or the terrain.
  Files: `arrival-classic-{320,390,720,1100}.png`, `commitment-selected-{390,1100}.png`, `due-review-sheet-1100.png`,
  `income-review-panel-1100.png`, `income-review-1100.png`, `list-view-390.png`, `axe-390.json`, `axe-1100.json`.
- **Earlier tree (the evidence pass before the review fixes; kept as the record of that pass).** Everything else in this
  folder: BEFORE, the Taylor / Newfoundland arrival set, cluster, past chapter, Back to now, the Horizon round trip, reduced
  motion, the keyboard sequence, the flat twin and `list-view-1100.png`. Some of those were taken by resizing one page.
  Where the fixes changed what they show, the section says so.

`console.log` in this folder (git-ignored) has the earlier pass's per-capture console listing. In both passes the only
console error is `Failed to load resource: net::ERR_FAILED`, one per page load: the harness allows only same-origin
requests and aborts a best-effort cross-origin request the app makes anyway. It is identical on BEFORE and AFTER.

## 1. BEFORE — the household Journey on main (`OurPathWorld`)

| File | Shows |
|---|---|
| `before-journey-1100.png` | Old `OurPathWorld` "Step into Journey" full-bleed page, Week zoom, at 1100px |
| `before-journey-390.png` | Same, at 390px |

Reached by logging in and then routing to `/house/kitchen-table/above?household=<id>&scope=household&surface=journey`
(same house-route the app itself uses; confirmed against `src/hearthside/houseRoutes.ts` and `src/house/navigation.ts`).

## 2. AFTER — arrival, 3 themes × 4 widths

D65 (edition-aware arrival, PENDING Jonathan) means logging in as Jonathan lands **directly** on the Journey Board — no
extra navigation needed. Theme was switched through the real Settings UI (All tools and search → "Settings" →
**Appearance and comfort** fold → theme card → **Use theme**), not by poking storage.

| Theme | 1100 | 720 | 390 | 320 |
|---|---|---|---|---|
| Classic Hearth | `arrival-classic-1100.png` | `arrival-classic-720.png` | `arrival-classic-390.png` | `arrival-classic-320.png` |
| Taylor's Scrapbook | `arrival-taylor-1100.png` | `arrival-taylor-720.png` | `arrival-taylor-390.png` | `arrival-taylor-320.png` |
| Newfoundland | `arrival-newfoundland-1100.png` | `arrival-newfoundland-720.png` | `arrival-newfoundland-390.png` | `arrival-newfoundland-320.png` |

**Classic, final tree (refreshed, fresh page per size):** 320×568, 390×844, 720×900, 1100×800. What they show: the
due reminders lead "Needs attention" ("Repeating reminders · 6 to review", D66) and there is no longer a "Repeating
reminders · Review →" link under the board (B1). At 720 and 1100 the summary card scrolls inside itself below "Needs
attention" (the 1100×800 card ends at the attention list; see the handoff's limitations). At 390 and 320 the summary folds
to one line ("September 2026 · ◆ 9 · Everyday · now $0.00 · More"); at **320×568 the stage between the summary and the
Compass is only ≈ 140 px tall** — the piece and "We are here" are in view, the chapter strip is not. A Hercules speech
bubble ("Groceries · planned needs a payment") overlaps the App header at 720/1100; that is the App's resident, not the board.

**Taylor's Scrapbook and Newfoundland: earlier tree** (one page resized through the widths, before the review fixes). They
still show the themes' paper, palette and miniature dressing, but they predate D66 (no due-reminders attention item).

All 12 show the same DOM/keyboard order (summary → chapter strip → Map/List → Back to now → toolbar → marks → panel) with
only the paper/palette/miniature dressing changing per theme, as `data-theme` and `journey-board--<theme>` confirm.

## 3. Selected commitment + its panel (final tree)

`commitment-selected-1100.png` (1100×800), `commitment-selected-390.png` (390×844, fresh page) — clicked a visible `.journey-mark--commitment` (a Bill mark,
e.g. "Gas · $74.00 · Overdue · not recorded"). Opens `StopPanel` (`journey-panel--stop journey-panel--commitment`) with the
exact amount/date/status (same words as the list row) and its `actions[]` ("Mark paid…", "Open the Calendar", "Open the
bill jars") — nothing ran; selecting is inert as the module promises. "Mark paid…" is offered because Gas's occurrence
(Tue 22 Sep) is on or before today, so Bill paid can take it (D67).

## 3a. Due reminders over the board (final tree, REVIEW B1 / D66)

`due-review-sheet-1100.png` — pressed "Review…" on the first "Needs attention" item ("Repeating reminders · 6 to review").
The App's own due review ("6 repeating items are due · Review each occurrence here. Nothing posts until you press its named
Confirm.") rises as a sheet above the board (`.due-preview-host[data-world-sheet]`, z 20); each row keeps its **Actions**
(the named Confirm) and **Later**. Opening it recorded nothing. Note: the board itself is not `inert` while this sheet is up
(the sheet is not a modal); what the frame covers is `inert` (proved in `test/journey-board-app.test.ts`, B1).

## 3b. Expected pay → Review and record… (final tree, REVIEW M1 / D66)

- `income-review-panel-1100.png` — the "4 on Mon 28 Sep" cluster → **Bianca pay** (`income:<recurrenceId>@2026-09-28`):
  "INCOME · EXPECTED · $2100.00 · scheduled · Expected", primary action **Review and record…**, then Open the Calendar.
- `income-review-1100.png` — after pressing it: the same due review above the board, with keyboard focus moved to the
  **Bianca pay** row (confirmed from `document.activeElement`). At 1100×800 that row sits below the sheet's first four rows,
  so the frame shows the top of the sheet; focus does not scroll the sheet to it (noted as a limitation). Its named Confirm
  (`postOneRecurrence`) is what turns the SAME stop confirmed — proved in `test/journey-board-app.test.ts` (M1), not pressed here.

*Implementation note:* a plain Playwright mouse click on a `.journey-mark` button times out ("element is not stable"),
because the 3D camera keeps nudging mark positions every animation frame; `{force:true}` can also silently miss when the
mark sits under the fixed Record/Tools FAB. The capture script dispatches `element.click()` in-page instead, which invokes
the same `onClick` the real UI wires up, without depending on a resting mouse position — a Playwright-harness detail, not
an app bug (a real pointer down inside the hit area works exactly the same as any other button).

## 4. A cluster expanded

`cluster-expanded-1100.png` — clicked the "4 on Mon 28 Sep" cluster mark. Opens `ClusterPanel` ("ON THIS DAY") listing each
same-day stop (Bianca pay, two Expected Fund contributions, …) as its own button; nothing on the board itself moved.

## 5. Crossroads preview — **not capturable from this demo data**

No `.journey-mark--crossroads` mark exists anywhere on the board (checked at every camera tier) in the current synthetic
Development household — this demo snapshot has no open crossroads (era/home/plan fork) right now. `CrossroadsPanel.tsx`
was read and verified by inspection (preview banner text is `COPY.previewBanner = "Preview — nothing has changed"`, the
button is `COPY.returnWithoutChanging = "Return without changing"`, and previewing only calls `onPreview` — never an
action), but I did not fabricate a crossroads to screenshot it, per the "never invent a field" rule. **Gap**: if a real
crossroads-preview screenshot is required, the demo household generator needs a case that creates one (e.g. an open Era
decision point), or Jonathan can point me at a household that already has one.

## 6. List view

`list-view-390.png` (**final tree**, 390×844 fresh page) and `list-view-1100.png` (earlier tree) — the `[data-list-mode="list"]` toggle. Same September chapter, same figures as
the map (row for row: "Fund contribution … $980.00 … Received", "2 on Sun 6 Sep" cluster expanded inline), confirming the
map and list never disagree.

## 7. Past chapter selected (piece unchanged)

`past-chapter-1100.png` — clicked the "Jan" chapter chip (`.journey-strip__chapter--past`), then its own month mark
(`#journey-mark-2026-01`). Opens `ChapterPanel` ("CHAPTER · January 2026 · Past · No Chapter kept · Nothing dated in this
chapter"). The household piece's own `aria-label` ("We are here · Mon 28 Sep · September 2026") is byte-identical before
and after — browsing to a past month does not move the piece's actual date, only the camera. (The piece mark itself
becomes `hidden`/off-stage while a distant month is framed, which is expected: it is simply off-screen at that zoom, not
moved.)

## 8. Back to now

`back-to-now-1100.png` — after the past-chapter detour, pressing **Back to now** re-frames on September/today and closes
the open panel.

## 9. Enter Horizon (Stop tier → Horizon → return)

- `enter-horizon-before-1100.png` — zoomed to the Stop tier; the toolbar's **Enter Horizon here** is visible and enabled
  (camera is centred over land at this point, `centreOnLand` true).
- `horizon-entered-1100.png` — after clicking it: the app navigated to `/house/home/middle` and mounted `HorizonWorld`.
  (Under headless swiftshader the Horizon scene itself renders its own dev debug HUD — "Renovation book / Walk / Look /
  Island / Activity view / Tools / Journey / Sound off" — that is Horizon's own pre-existing chrome, not something the
  Journey Board track built or changed.)
- `horizon-return-1100.png` — clicking Horizon's own **Journey** button returns to the board, still framed at the Stop
  tier over the same spot ("We are here" / "Enter Horizon here" both present again).

## 10. Reduced motion

`reduced-motion-1100.png`, `reduced-motion-390.png` — captured with `page.emulateMedia({reducedMotion:'reduce'})` **and**
`document.documentElement.dataset.motion = 'reduced'` (belt and suspenders, matching `useReducedMotion`'s own two checks).
Confirmed via the DOM: `journey-board--still` is present and `journey-board--animated` is absent.

## 11. Keyboard focus sequence

`keyboard-focus-1-BUTTON.png` … `keyboard-focus-9-panel.png` — one frame per stop the moment Tab order enters a new region:
top bar → (an "A" — see note) → **summary** → **chapter strip** → **Map/List** → **Back to now** → **toolbar** (Zoom
out/in) → **marks** (a month mark) → **panel** (Enter on the mark opened it; the frame shows the panel's own focused
Close button). That is the documented order (summary → strip → Map/List → Back to now → marks → panel) plus the app's own
header controls first, and the toolbar between Back-to-now and the marks (the brief didn't call the toolbar out
separately, but it sits in real Tab order there and is included for completeness).

*Superseded by the review fix B1:* stop 2 in this (earlier-tree) sequence is an `<a>` link, "Repeating reminders Review →", which **did** receive focus — this
contradicts HANDBACKS.md's note that this due-preview link is "Not reachable on the board route." It was reachable via
Tab under the board. On the final tree that link is not rendered while the board stands, the reminders are the first
"Needs attention" item, and nothing under the frame is reachable by Tab (`test/journey-board-app.test.ts`, "B1: …").
The keyboard sequence was not re-captured.

## 12. Flat twin (WebGL unavailable) at 390

`flat-twin-390.png` — WebGL disabled by overriding `HTMLCanvasElement.prototype.getContext` (any `*webgl*` context type
returns `null`) before the app's first script runs, so `buildJourneyLand`'s `try/catch` trips and the board falls back to
the flat/SVG twin. Confirmed via DOM: `journey-board--flat` is present (not `--live`). Per the task's own caution, I did
**not** use `hearth:motion=flat` (that now routes arrival to the Desk per D65) — this is a true "3D unavailable" fallback,
not the Simple-view edition switch.

## 13. axe-core accessibility scan

`axe-390.json`, `axe-1100.json` — `@axe-core/playwright`, scoped to `[data-journey-board]`, run directly (I did not wire a
new entry into `docs/evidence-gates/browser-journeys.json`: that manifest's schema is built around directly-navigable,
no-login public routes with a fixed `route` string: `"route": "/roadmap/"` — the Journey Board needs a demo login and a
freshly generated household id first, which the manifest has no field for, and forcing it in would either break format
assumptions the `quality:5of5` gate relies on or require inventing a stable "route" the app doesn't have. Running axe
directly, as the task's own fallback instructs, avoided that risk.)

**Result (final tree, rerun by the integrator on the arrival page at 390×844 and 1100×800): 0 violations at both widths**
(22 rules passed and 1 "incomplete" — needs manual review — at each). Full rule-by-rule detail is in the JSON files. The
earlier pass also measured 0 violations. axe covers the board region only, not the App header, the Compass or the due sheet.

## 14. Perf — navigation to first frame (earlier tree: before the slim land artefact)

Measured with a CDP session (`Emulation.setCPUThrottlingRate`) against port 5199, first appearance of
`.journey-marks .journey-mark:not([hidden])` as the "first frame" signal (there's no `[data-journey-ready]` or
`.journey-board__marks button` in the actual DOM — the real classes are `.journey-marks` / `.journey-mark`; I used the
equivalent).

| | Unthrottled | 4× CPU throttle |
|---|---|---|
| Click "I am Jonathan" → first mark (includes generating a brand-new demo household + PGlite provisioning) | 19.4 s | 41.4 s |
| Full nav (`goto` "/" ) → first mark, same run | 23.9 s | 50.9 s |
| **Reload an already-provisioned household → first mark** (steady-state "first frame" cost) | **6.9 s** | **15.7 s** |

The first two rows are dominated by one-time demo-household generation (fictional data + local PGlite setup), which is not
what "board first frame" perf is really asking about. The **reload row is the meaningful number**: ~7 s to first drawn
mark unthrottled, ~16 s at 4× CPU throttle, on software (swiftshader) GL in this sandbox — real GPU hardware will be
faster; treat these as this-sandbox baselines for relative (throttled vs not) comparison, not as production timings.
They were taken **before** REVIEW M2's slim land artefact (the board then fetched and parsed the 5.7 MB index); they were
not re-measured on the final tree.

## Servers / cleanup

The earlier pass's BEFORE worktree was removed at the end of that pass; its dev server on 5198 and the AFTER server on 5199
were still running at the integrator's refresh (which captured against that 5199 server, serving this checkout with the
`pages.yml` flags) and were stopped after it. Note for whoever re-runs BEFORE from a worktree: its `pglite` (the on-device Postgres/WASM "local journal") could not be served in a
fresh `pnpm install --offline` checkout under Vite's default dev-server file allow-list, because its WASM/data files
resolve into the *original* checkout's shared pnpm store; the fix was adding that store path to `server.fs.allow` in the
worktree's own `vite.config.ts` (a worktree-local, throwaway edit — never touched the real repo's config).
