# HANDOFF — Track D · one Campfire ritual (decision D3)

Branch `claude/tool-atlas-campfire` (worktree `wt-campfire`), from `main@4e0234a3`. Local commits only; nothing pushed. Risk: **Medium-High** (household-shape semantics of the month close; no money meaning changed, no new command). Fictional data only (catalog seed: Bianca MEM-001, Jonathan MEM-002; plan-life fixture).

## What was built

| File | What |
|---|---|
| `src/harbour/campfire/ritual/model.ts` | Pure read model: `CAMPFIRE_BEATS` (Arrive · Look back · Settle · Look ahead · Seal), `nextBeat`/`previousBeat`, `campfireMonth`, the Campfire thread (`CAMPFIRE-<month>`) vs weekly thread (`SITDOWN-WEEK-<Sunday>`), `campfireChairs`/`bothHere`, `sealStatus`/`sealWords`/`canGiveSeal`, `booksCloseState`, `lookBack`, `lookAhead`, `settleRitualTerms`, `campfireAllocationSlices` (Protect never suggested), `needsYouCount`, **`campfireState(household, memberId, today)`** → `{ line, month, closesInDays, overdue, needsYou, seal }` for B2's host panel ("Chapter closes in 5 days · 1 card needs you" / "… · waiting for Bianca" / "… · Sealed by Jonathan · your seal is needed"). |
| `ritual/CampfireRitual.tsx` | The sheet: `role="dialog"`, `aria-modal`, labelled by the Chapter title, focus contained via `useDialog`, Escape / **Put it back** close; beat rail (`aria-current="step"`), each beat an `h3` that takes focus on change; one `role="status"` line after every write, `role="alert"` on refusal. Opens at Seal when a seal waits on this person. |
| `ritual/beats.tsx` | **Arrive** (two chairs from the month's Campfire thread, live presence as display only, Chapter + its month's dates, the Lesson, "Take my chair") · **Look back** (the month's kept household recipe cards with `projectPlan` numbers, top 3 `evaluatePlanDrift` findings, Rituals held / not held, Moves done/open, wins Keep / Let it fade, the month's charts + "What went well" from the old guide) · **Settle** (propose graduate/retire → `editRitual`, agree → `acknowledgeRitualChange`, full `RitualCard` in a disclosure, open Moves with `ChapterMoveActions` (pause = `respondToMove`), **the books close once** (`closeBooksMonth`, held with a reason until both chairs are taken, gone once closed), where leftover goes) · **Look ahead** (proposed household cards for this month and next: what rolls / what is new / whose chair it needs → `acknowledgeHouseholdPlan`; agreed next steps read-only; add a Ritual / offer a Move) · **Seal** (outcome + carry-forward → read the exact terms → first seal `closeChapter` with `reviewDigest`; the other phone reads "Sealed by Bianca · your seal is needed" → second seal `closeChapter` with `proposalId`+`digest`; money-model households open the next Chapter atomically inside that command, others get "Open the next Chapter" → `openChapter`; optional "Put our Sitdown notes away" closes the month's thread). |
| `ritual/WeeklySitdown.tsx` | Two chairs at the flagstone: `appendPlanSitdownTurn` turns only, optional Hercules reply via the App's existing Shared-reply route. No close, no seal, no digest. |
| `ritual/CampfireDoor.tsx`, `CampfireGlyph.tsx`, `useCampfireWrite.ts`, `index.ts`, `ritual.css` | The thin door ("Open the Campfire" + the panel line), a static-under-reduced-motion fire glyph, the write/status hook (`CampfireRun`, looser than `KitchenCommand`), exports, styles. |
| `src/harbour/campfire/CampfireScene.ts` | The fire and both logs now open `CAMPFIRE_RITUAL_TARGET = "campfire-ritual"` (path of months still → `journey`, Hercules → `hercules`); labels say "Open the Campfire". |
| `src/ChapterPanel.tsx` | `ChapterRoom` is a door (props kept; new optional `onOpenCampfire`). `ChapterMoment` loses its own "Open this Chapter" write → door (optional `onOpenCampfire`, falls back to `onOpenPath`); "See/Open Our Path" copy gone. `ChapterClose` kept for the flag-off v3 check-in, kicker "Seal this Chapter". `RitualForm` copy "proposed at the Campfire". |
| `src/SitDownGuide.tsx` | Split into `SitDownLookBack` (read-only) and `SitDownLeftover` (writes through `onCommand`/run; "Confirm moves of $X" names its amount; the "Lock {month}" books close is removed — it lives only in Settle). `SitDownGuide` survives as a **@deprecated shim** for App's flags-off Plan page (`App.tsx:7562`) and `widgets/Postcard.tsx`. |
| `src/tabs/BooksTab.tsx` | "Close the month" section → `CampfireDoor`. New prop `campfireDoor?: { onOpenCampfire? }`; the old `closeTheMonth` prop is still accepted (typed) so App compiles untouched — non-null means "show the door". |
| `src/PlanStudio.tsx` | `sitdown` section → door; household `review` keeps "Read this exact version" and the private counterproposal, but **Acknowledge** → door (Look ahead). New optional prop `onOpenCampfire`. The shared-turn chat, stage list and private-preparation note left with the section. |
| `src/core/terms.ts` | `CAMPFIRE_TERMS`, `CAMPFIRE_RETIRED_TERMS` (check-in, Close the month, Close the previous Chapter, Sit-down, Our Path). |

## Wiring App.tsx needs (integrator)

1. State: `const [campfire, setCampfire] = useState<{ beat?: CampfireBeat } | null>(null)`, `const [weeklySitdownOpen, setWeeklySitdownOpen] = useState(false)`; import from `./harbour/campfire/ritual/index.ts`.
2. Mount beside the other sheets (near `QuickSheet`, `App.tsx:9299`), household view only:
   ```tsx
   {household && session && view === "household" && campfire && <CampfireRitual household={household} memberId={actorId} today={today} busy={busy}
     onCommand={runKitchen} onClose={() => setCampfire(null)} initialBeat={campfire.beat}
     sitDown={dashboard ? { dashboard, displayHousehold } : null}
     presentMemberIds={[session.memberId, ...peersFromLivePresence({ live: softPresenceLive, members: household.members, viewerMemberId: session.memberId }).map(p => p.memberId)]}
     onOpenTable={() => { setCampfire(null); openHouseObject("plan-studio"); }} />}
   {household && session && view === "household" && weeklySitdownOpen && <WeeklySitdown household={household} memberId={actorId} today={today} busy={busy}
     onCommand={runKitchen} onClose={() => setWeeklySitdownOpen(false)} onSharedHerculesReply={/* the same function PlanStudio receives at App.tsx:7507 */} />}
   ```
3. `openHouseObject` (`App.tsx:6546`): first line `if (target === "campfire-ritual") { setCampfire({}); return; }` — the fire and logs send that target.
4. Our Path tent (`App.tsx:7482-7545`): `<ChapterRoom … onOpenCampfire={() => setCampfire({})} />`, `<PlanStudio … onOpenCampfire={() => setCampfire({})} />`; the Kitchen work centre's "Open our shared Sitdown" → `setWeeklySitdownOpen(true)`. (That tent header still says "Our Path" — App copy, not mine.)
5. Books (`App.tsx:7754`): replace `closeTheMonth={…}` with `campfireDoor={view === "household" && planSystemV2Enabled() ? { onOpenCampfire: () => setCampfire({ beat: "settle" }) } : null}`; then delete `closeTheMonth` from `BooksTabProps`.
6. The strip's flagstone (dock track): `onOpen` → `setWeeklySitdownOpen(true)`. The Campfire host panel (B2): `campfireState(household, actorId, today).line` + "Open the Campfire" → `setCampfire({})`.
7. `HouseholdHome`'s `ChapterMoment` may pass `onOpenCampfire` (optional).

## Commands called (all pre-existing, captured; no new command)

Directly: `appendPlanSitdownTurn`, `acknowledgeHouseholdPlan`, `closeBooksMonth`, `closeChapter`, `openChapter`, `editRitual`, `acknowledgeRitualChange`, `keepWinAsMemory`, `dismissWin`, `offerMove`. Through reused controls: `addRitual` (RitualForm); `adoptChapterTasks`, `respondToMove`, `completeMove`, `acknowledgeTask`, `prepareRitualOccurrence`, `recordRitualHeld`, `setRitualParticipation` (ChapterTaskControls, **kept** — the ritual's Settle uses it; the Glasshouse does not import it today); leftover: `saveSitDownSession`, `applySitDown`, `executeSitDownMoves` (**posts transfers exactly as before**, the one money-moving button, named "Confirm moves of $X"), `adoptSitDownStandingOrders`, `recordSitDownDrive`. Nothing else posts money; Protect goals are filtered out of the leftover proposal.

## Codex trust review (requested)

- **Both-acknowledgement seal** is `closeChapter`'s existing consent (proposal + approval by the whole active audience, exact digest) — unchanged. What is new is household-shape *semantics in the UI*: (a) a household with fewer than two active members gets no seal button ("one person alone never seals"), though the command itself would accept an audience of one; (b) the books close only when both partners have taken a chair in the month's Campfire thread (`participantMemberIds` of `CAMPFIRE-<month>`). Both are UI gates, **not server-enforced**; `closeBooksMonth` remains a single-actor command. K3/D3 ("the books cannot close while one of you is away") is only as strong as these gates until a command enforces it.
- `Books.tsx:690` still has its own "Lock" `closeBooksMonth` (not in my files) — a second place the books close. The flag-off v3 check-in (`plan-v3/CheckIn.tsx`) still reaches `closeChapter`/`acknowledgeHouseholdPlan`/`appendPlanSitdownTurn` via `ChapterClose` (D27 retires it). "Sit-down" copy remains in `core/helpDesk.ts:111`, `core/naming.ts:17`.

## Tests and verification

- `test/campfire-ritual.test.ts` (new, 18): beat order + focus + dialog; seal needs both (UI, two phones, second-person words) and one person never seals; books close only in Settle, held until both chairs, once; weekly Sitdown writes turns only (UI + source fence); `campfireState` lines; Campfire vs weekly thread; Protect never suggested; command allow-list / no money commands; vocabulary fence over the ritual, `ChapterPanel`, `SitDownGuide`, `BooksTab` and PlanStudio's sitdown/review lines. **18/18 pass.**
- Updated: `harbour-rooms` (door targets) ✓; `kitchen` (leftover guide's `applySitDown(current, …)`), `weekly-document-ui` ✓; `plan-life-ui`, `kitchen-wizard-ui`, `plan-v3-ui` ✓ (32/32). `test/hearthside-chapter-browser.test.ts` + its fixture now drive the ritual's beats — **not run** (needs Chrome; none here).
- Pre-existing failures, unchanged files, not mine: `terms.test` (KitchenWizard/QueenHome/hearthside strings), `copy-budget` (47 unrelated paragraphs, `App.tsx:8249` Whisper), `kitchen`/`ledger-story-ui` KittyBanks assertions.
- `tsc`: focused project over App.tsx + every touched file and test — **clean**. Full `pnpm typecheck` (`tsc --noEmit`, whole project): **exit 0**.

## Dressings, layout, motion

`ritual.css`: tokens per `:root[data-theme="classic|taylor|newfoundland"]` — Classic porcelain `#F6F0E4` + chalk edge, accent `#B04C34`; Taylor vellum `#fff8f4`, washi corner `#e8a6bd` @ 20 %, Caveat kicker, accent `#826789`; Newfoundland `#f5f3ea` with the white frame, Figtree caps beats, accent `#2f5b63`. Phone (< 720): bottom sheet, beats a scrolling row, chairs stack at < 360; ≥ 720: centred panel, beats down the left. 44 px targets, two-tone `outline` focus, `aria-disabled` with described reasons, solid sheet (no blur), scrim goes opaque under `prefers-reduced-transparency`, `prefers-contrast: more`, `forced-colors`; the fire flickers only under `prefers-reduced-motion: no-preference`. **No screenshots taken** (no browser in this environment) — 320/390/720/1100 visual evidence is owed.

## Deltas

- Budget (5): **+2** — one place, one evening, where the leftover, the Rituals, next month's card and the books close are settled together; the books close once, only with both present; nothing new posts.
- Engagement (3): **+2** — the Campfire becomes the month's real two-person ritual (seat, seal, the camp walks on); the weekly Sitdown is two light chairs.

## Left for the integrator / next owner

App wiring above; rename `closeTheMonth` → `campfireDoor`; delete the `SitDownGuide` shim with its two legacy callers; the Books.tsx Lock; a command-level both-present guard if Jonathan wants K3 enforced; browser evidence at four widths × three dressings; `DECISIONS.md` entry (not touched). Commit trailers follow this session's attribution (Opus 5.5), not the brief's.
