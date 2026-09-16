# Hearth worksession: Plan Studio v3 — the plan at rest, the tool drawer, one check-in

- **Status:** OPEN. Local branch only: not pushed, not a PR, not merged, not deployed, not live verified.
- **Opened:** 2026-09-16 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX, Hercules, accessibility), as the Studio track of the Plan Studio v3 build
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/plan-v3-studio`
- **Baseline SHA:** `6160fb03` (`main`, #495)
- **Risk:** Medium. The new UI is behind a default-off flag. Two existing files gain small mount points: `PlanStudio.tsx`, and `OurPathWorld.tsx` (a context provider). The check-in writes only through existing commands: `appendPlanSitdownTurn`, `acknowledgeHouseholdPlan`, `closeChapter` / `openChapter` and `addRitual`. The resume-ownership merge (F2) still needs its Codex trust review.
- **Decision owner:** Jonathan (D-274–D-278)
- **Environment impact:** none. Fictional fixtures only.

## Household outcome

The plan becomes a short monthly check-in that ends in a plan both partners agree to. Between check-ins the plan rests calmly on one page, with a drawer of tools beneath it. The Plan Studio and the Our Path island work as one: closing the Sitdown sets the month on the island.

## Budget delta (5)

+1. The month's contributions, bills, the tightest day ahead and each partner's agreement read in one place. No money meaning, schema, sync, Auth/RLS or Hercules payload changed. Every figure comes from an existing selector, and every write goes through an existing command.

## Engagement delta (3)

+3. The Queen and her three funds, a month you can walk, a drawer of small objects, a paw trail and a two-paw seal. The Chapter visibly sets on the island.

## Verified baseline

- The current studio is `src/PlanStudio.tsx`. Its 13 sections are rendered inline, and its "Plan tools" strip is a `RememberedDetails`.
- The Shared Sitdown lives in `planHerculesSessions`. The session carries `stage` 0–7 and closes only when both partners have acknowledged the exact plan (`appendPlanSitdownTurn`).
- On a phone the App's `.app` clips horizontal overflow, which makes it a non-scrolling scroll container. `position: sticky` therefore never sticks inside it below 720px (measured in the proof). The drawer and the tally are fixed there instead.
- The island's land for a month sets when that month's Shared Sitdown closes (`pathSitdownClosedMonths`).

## Scope

### In scope

- **Flag.** `VITE_PLAN_STUDIO_V3`, off by default. With it off, the studio is unchanged; a UI test covers this.
- **Rest screen and drawer.** The rest screen, the tool drawer, the tool sheets (existing sections, embedded), fund sheets, Lite, the three worlds and dark scenes.
- **Check-in.** The check-in shell over the Shared Sitdown session, with look-closer chips, routine collapse, per-person agreement, the Sitdown close and the journey tie.
- **Adapter.** `src/plan-v3/model.ts`, with the fundSnapshot shape and the swap point.
- **Tests and evidence.** Unit and UI tests, a proof harness, browser evidence, and the decisions and handoff entries.

### Out of scope

- **Money meaning.** Any change to money meaning: the bills-to-Prepare migration, the contribution split command, "Now" as defined by the money track. These belong to the Money track.
- **Resume ownership.** Merging the companion `plan-guided-draft` resume state into the Sitdown session. This needs a core change and a trust review.
- **Monthly Chapters.** Making Chapters calendar-month records. This needs a core change.
- **Phase 3–7 content.** Real tools (Phase 4), the full step content (Phase 3), the first-visit intention flow (Phase 6) and retiring the old studio (Phase 7).

## What changed

**New files in `src/plan-v3/`:**

- `flag.ts`: `planStudioV3Enabled`.
- `model.ts`: the adapter (D-275).
- `PlanStudioV3.tsx`: the root. It holds the rest/check-in mode, the sheets, the Lite choice and the refused-write alert.
- `RestScreen.tsx`: the court, the island card, `restAction` (one primary action) and the divide moment.
- `FlowPanel.tsx`: "Money through the month", with `stoneLabel` as its words.
- `ToolDrawer.tsx`, `ToolArt.tsx` and `tools.ts`: the 1D drawer and its tool-to-section map.
- `ToolSheet.tsx`: `SheetFrame` (built on `useDialog`, portalled) and `ToolSheet` (the embedded `PlanStudioClassic`).
- `CheckIn.tsx` and `steps.ts`: the check-in (D-276).
- `figures.tsx`: the Queen (`QueenFigure`), the fund portraits (`NestPortrait`), the little Queen on the stones, and the paw.
- `plan-v3.css`.

**Edits outside that folder:**

- `src/PlanStudio.tsx`:
  - `PlanStudio` is now a small switch.
  - Today's component is `PlanStudioClassic`, with `embeddedSection` / `onEmbeddedClose`. These give a `<section>` root, no masthead, no strip and no mobile consequence bar, and "goals" opens the Kitty room directly.
  - `PlanStudioProps` and `PlanStudioSection` are exported.
- `src/path/tentContext.ts` (new) and `src/path/OurPathWorld.tsx`: the tent provides `leaveTent` (D-277).
- `src/vite-env.d.ts`: the flag's type.

**Tests and evidence:**

- `scripts/serve-plan-v3-proof.mjs`.
- `test/plan-v3-model.test.ts`, `test/plan-v3-ui.test.ts` and `test/plan-v3-layout.mjs`.
- `docs/evidence/plan-studio-v3/`.

## Adapter output (the swap point)

```ts
type FundSnapshotV3 = {
  now: { amountCents: number | null; line: string | null };
  undividedContributions: { id; memberId; memberName; amountCents; date; suggestion: {prepare,protect,build,everyday} | null; waitingOn: string[] }[];
  prepare | protect | build: { key; amountCents: number | null; line: string | null; tone: "calm" | "attention"; targetCents: number | null; rows: { id; label; detail; amountCents; date }[] };
  flow: { monthKey; today; totalInCents; anyEstimated; days: { date; day; balanceCents; contributions: { id; memberName; amountCents; estimated; actual; split }[]; outflows: { id; label; amountCents; fund: "prepare"|"protect"|"build"|null; actual }[] }[]; shortFrom; lowPoint; source: "fund-walk" | "plan-projection" } | null;
};
```

`planStudioFundSnapshot` is the default source. `PlanStudioV3` also takes `snapshotSource`, and the proof uses it for the `landed` state. When `src/core/fundModel.ts` lands, pass `fundSnapshot` (mapped if needed) as the source.

## Check-in stages (D-276)

| v3 step | Saved Sitdown `stage` | Old studio's title for that stage |
|---|---|---|
| Hello | 0 | Arrive together |
| Looking back | 1 | Close the previous Chapter |
| Coming in | 2 | Orient to shared reality |
| Prepare | 3 | Learn one useful thing |
| Protect top-up | 4 | Make the shared decisions |
| Build | 5 | Turn the decision into a Ritual |
| Everyday | 6 | Look ahead |
| Read it together | 7 | Open the next Chapter |
| Sitdown (close) | 7 + `close` | — |

## Acceptance evidence

**Type check.** `npx tsc --noEmit -p .` is clean after every commit.

**Unit and UI tests.**

- `npx vitest run test/plan-v3-model.test.ts test/plan-v3-ui.test.ts test/plan-life-ui.test.ts test/plan-guide-ui.test.ts`: 37/37.
- Model tests (9): the flag, the snapshot shape and that it passes the King's figures through unchanged, the walk, per-person agreement, resume from the Sitdown session, the personal view, the single badge, and pending contributions never counted.
- UI tests (14): the flag off leaves the studio unchanged; one primary action; seven or six tools and one badge; the dialog with the existing Bridge, Escape and focus return; a fund tap highlights and opens; stones by keyboard and the list; the divide moment only when supplied; per-person agreement; pause, then resume by the other member; a refused pause never claims the place was kept; look-closer on the right tab and focus return; routine collapse; the Sitdown close with the island door; the personal check-in.

**Quick gate.** `pnpm test -- --risk=medium --focus=test/plan-v3-ui.test.ts --focus=test/plan-v3-model.test.ts --focus-reason=…` returned `quick-gate-passed; time-budget-breached` (354 s against 300 s). TypeScript alone took 126 s in this container. The gate ran 24 fast files (311 tests) and 6 serial files (128 tests), including `app-startup-p1` and the Our Path suites. To let the gate hash the tree, `node_modules` (a symlink) was added to this checkout's local `.git/info/exclude`.

**Browser.** `HEARTH_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell node test/plan-v3-layout.mjs` produced 52 records with 0 failures; see `docs/evidence/plan-studio-v3/records.json`.

- **Coverage:**
  - Rest screen: three worlds × 320/390/720/1100.
  - States: agreed, short, landed, first, resume, badge, personal, Lite, dark, and Taylor at 1100.
  - Drawer and Letter tray by keyboard in every world at 390 and 1100.
  - A fund tap, the list and arrow keys.
  - The whole check-in at 320/390/1100, with Alex pausing at Prepare, Sam resuming and agreeing, Alex resuming and agreeing, the Sitdown closing, and "See it on our island".
- **Results:**
  - 0 overflow, 0 of our targets under 44px, 0 serious or critical axe findings (wcag2a/2aa/21aa), and 0 page errors.
  - With motion allowed, Full runs 4 animations and Lite runs 0.
  - The Chromium here is the headless shell, not a phone.

## Defaulted, confirm

- **F4.** "Looks right", "All here" and "Feels livable" only move on. No data changes.
- **Now.** The Queen's big number is the Kitty Nest's Everyday today. The money track's "Now" definition replaces it through the adapter.
- **Pause.** Pausing writes a shared Sitdown turn, "Paused at Prepare.", that both partners see in the Sitdown's shared talk.
- **Personal pause.** On a personal plan, Pause is not saved, and the check-in restarts at Hello.
- **Rest action order.** An active paused check-in outranks "Read it and agree" as the rest screen's one action.
- **Lite.** Lite starts on for a device that prefers reduced motion; the choice is remembered on the device.
- **Looking back.** The optional "one thing to remember" is shared: it is saved as the Sitdown's decision.

## Remaining uncertainty and gaps

- **Resume ownership.** There are still two resume owners (the Sitdown session and the companion `plan-guided-draft` workflow). The studio uses only the Sitdown session.
- **Chapters.** Chapters are foundation Chapters, not calendar months. The UI names the month's Chapter by the month, and `ChapterClose` closes whichever Chapter is open.
- **Transitional figures.** Until the money track lands, Protect holds the bills and Prepare shows $0 beside "Bills covered all September". This is a visible transitional mismatch behind the flag.
- **Stage titles.** Today's studio shows stage titles that differ from v3's for the same saved stage.
- **Month switching.** There is no month switching in v3 yet. Past months are reached through Past sheets, which is the embedded History section.
- **Unverified.** Not heard with a screen reader. Not tried on a real phone. The embedded Phase 1 sections keep today's sizes and look.

## Handoff

- **Next owner:** Codex. It should:
  - run the F2 trust review (resume ownership, and the pause writing a shared turn);
  - after the money track merges, swap `planStudioFundSnapshot` for `fundSnapshot`;
  - decide the calendar-month Chapter shape.
- **Then Jonathan:** turn on `VITE_PLAN_STUDIO_V3=1` in Development, walk a check-in on both phones, and answer the "Defaulted, confirm" list.
