# Hearth Future Vision v2 — One Complete Plan

*Prepared 12 September 2026 from the Future Vision compass document and a full audit of the repository at `main@ecf936a` (Claude/kitty studio, PR #447). This version turns the compass into a single plan: what the product is, where the app actually stands, what changes now, and what is deliberately later. Nothing here is shipped by being written; decisions marked **Decision** wait for Jonathan (and where noted, Bianca).*

---

## 0. How to read this version

The v1 document was written as a compass: many branches, each zooming on one idea, written before anyone checked the branches against each other or against the code. That produced real strengths (the behavioural model, the Bridge rules, the Sitdown anatomy) and three kinds of drift: sections that contradict each other (three different household navigation maps), sections that critique an app that no longer exists (the Plan rebuild thesis describes the pre-V2 Plan page), and sections that describe as future what is already built and deployed to Development (the four-destination Fund shell, the Bridge editor, the eight-stage Sitdown, deep theme authoring).

v2 keeps the compass's direction and collapses it into one idea with one vocabulary. Every concept section below has the same shape: **Direction** (what we are building toward), **Today** (what the code does, with file references so it can be verified), **What changes now** (the concrete gap to close), and **Open** (questions that still need a decision). Section 15 gathers the "now" items into a sequenced programme; section 16 gathers the decisions.

Superseded v1 material is listed in section 17 so the original document can be pruned rather than argued with.

---

## 1. The one idea

Hearth is one home with two spaces and a bridge between them.

**My Money** is the private, exact, self-directed workspace: accounts, work and shifts, personal planning, Books. It is complete on its own. **Our Home** is the couple's shared place: the money they have chosen to manage together (the Fund), the agreements that govern it, the goals they are building toward, and a monthly rhythm of small rituals, one learning focus, and one Sitdown that closes each Chapter and opens the next. **The Bridge** is the governed way selected meaning crosses between the two — never a third ledger, never a sync, never a shortcut around consent.

Underneath both spaces sit five invariants that no theme, device, ledger, or companion may bend:

1. **Final Confirm** is the only boundary that posts or changes accepted money. Proposals, plans, acknowledgments, and celebrations never imply money moved.
2. **Same-version mutual acknowledgment** governs every change to shared financial meaning, responsibility, or standing agreement. Seen is not agreed; silence is not consent; a material change resets acknowledgment.
3. **Privacy at the Bridge.** Personal information is member-scoped until its owner deliberately bridges the minimum useful meaning. Exact income is never required.
4. **One authoritative number.** Every amount has one source, one freshness state, one recovery path; other appearances are links or labelled summaries.
5. **Healthy is quiet.** Warnings appear only when a person can or must act. No shame, no scoreboard, no streak loss, no relationship score.

Hercules is the companion in both spaces — welcomer, translator, coach, host, witness — with one identity and a hard wall between private preparation and shared evidence. He explains, teaches, drafts, and celebrates what the evidence supports; he never posts, acknowledges, decides, or takes a side.

The three themes (Classic Hearth, Taylor's Scrapbook, Newfoundland), two view types, and two ledgers produce twelve authored expressions of this one truth. Theme changes metaphor, material, rhythm, and voice. View changes density, reach, and how two people review together. Ledger changes audience, authority, privacy, and verbs. Meaning never changes.

The behavioural centre of Our Home is the **Chapter**: one Sitdown-to-Sitdown month in which the couple learns one useful layer, practises one primary habit at its real-life cue, sees what it changes, and decides what graduates into their quiet rhythm. This is what turns a correct ledger into a product Bianca will open on a day when nothing is wrong.

---

## 2. Where the app actually is

The audit compared every v1 concept against the code. The summary matters because the plan's sequencing depends on it: far more of the vision is built than the compass assumes, and the real gaps are narrower and more specific than "reinvent the household experience from zero."

### 2.1 Built and live in Development

| Concept | Evidence |
|---|---|
| Two ledgers with a switcher | `LedgerView = "household" \| "personal"`; `view-switch` group in `src/App.tsx`; names from `src/core/ledgerNames.ts` (defaults "Household Ledger" / "{Name}'s Personal Ledger") |
| Four-destination Fund shell: Home / Our Money / Our Path / Together | `kitchenPrimaryNav("household")` in `src/core/ledgerExperience.ts`; D-242 in `docs/DECISIONS.md` |
| Plan System V2: four lenses, versions, same-digest acknowledgment, private drafts, scenarios, assumptions, drift findings, reflection, learning | `src/core/planSystem.ts`, `src/PlanStudio.tsx`, `test/plan-system.test.ts`; PR #433, Development deployed |
| The Bridge (for Plan): private draft → exact disclosure review → proposed/held/declined/withdrawn/accepted/superseded | `src/PlanBridgeEditor.tsx`, `PlanBridgeDraft`/`PlanBridgeDecision` |
| Eight-stage Sitdown matching the v1 anatomy | `PlanStudio.tsx` stages: Arrive · Notice · Reflect · Update reality · Build the month · Learn · Resolve the Bridge · Acknowledge |
| Household Fund as a non-custodial subledger with two-sided contribution motions, settlement, reconciliation, append-only audit | `src/core/householdFund.ts`, `src/HouseholdFundPanel.tsx`, `src/SettleStage.tsx` |
| Charter: five-question founding conversation, signed clauses, revocable permissions, amendments | `src/CharterFounding.tsx`, `src/Charter.tsx` |
| Goals, Kitty Banks, and the sculpt/paint/fire Kitty Studio | `src/KittyBanks.tsx`, `src/kitty/`, `src/core/kittyStudio.ts` |
| Three themes with authored per-route scenes and hand-drawn artwork (not token swaps) | `src/theme/scenes.ts` (12 eras, 12 places), `SceneArtwork.tsx`, ~250 KB theme CSS |
| Hercules: persistent presence, typed read tools, provenance, privacy scoping, action panel with Confirm, plan guide, drift tool, coaching pace (Quiet/Calm/More), private chat and memory controls, wardrobe, Pro | `src/Hercules*.tsx`, 31 files under `src/core/hercules*.ts` |
| Sync/freshness status bar with healthy vs "Needs attention" and deep link into More | `src/SyncFreshnessStatus.tsx` |
| Cross-device continuity with no host device, QR pairing, offline states | `src/continuity*.ts`, `src/AuthJoinQr.tsx`, `src/Pairing.tsx`; D-114 |
| Permission matrix, Confirm sheet with staleness detection, reversal-not-deletion corrections | `test/permission-matrix.test.ts`, `src/Confirm.tsx` |
| Calendar with bills, recurrences, potential expenses, Google sync, rhythm detection | `src/Calendar.tsx` |
| Work (shifts, 7shifts evidence, tip-outs) and Books (full double-entry statements) | `src/core/work.ts`, `src/Books.tsx` |
| Strong accessibility base: focus trap hook, reduced motion in ~30 stylesheets, forced-colors, easy-read toggle, evidence at 320/390/720/1100 | `src/useDialog.ts`, `src/useEasyRead.ts`, `CLAUDE.md` |

### 2.2 Partial

| Concept | What exists | What is missing |
|---|---|---|
| Adaptive Add | Four fixed actions (Shift / Income / Expense / Transfer) in every space and page (`src/FabSpeedDial.tsx`) | Any variation by space or destination; non-financial verbs |
| Status Centre | A real status bar; a "More" page that already holds sync help, charter, account, books integrity, restore points, device, appearance | "More" is still a sixth Personal destination; no composed Needs Us / Sources / Household / Privacy / Comfort / Help structure; appearance picker sits first |
| Home opening composition | Household Home stacks `HouseholdPathHome`, the Till door, `MonthRehearsalAccess`, theme scene heading, then the Office with three wax seals (Money in / Money out / Leftover spend) and story tiles | One composed moment; a Fund pulse sentence; a single next Move; partner presence. Today's Household Home is the Personal office grammar with extra panels on top — exactly the "too much information" signal |
| Personal navigation | Home · Cal · Shift · [+] · Books · Plan · More | Plain labels; More removed; a decision on four vs five destinations |
| Curriculum | Four FCAC-sourced lessons (one per lens) in `src/core/planLearning.ts`; a 12-module `PLAN_CURRICULUM` constant that nothing references | The six-Chapter foundation; spiral revisits; teach-back |
| Fairness | Charter split rule: Evenly / By what we each earn / One of us covers what's left | A fairness sandbox; proportional computation driving Fund contributions; the word "fairness" appears nowhere in `src/` |
| Hercules in two modes | Chats are private by default and sanitized from exports; Shared Hercules turns are Worker-bound (D-241) | A visible "Private preparation" / "Shared with both of you" label on the active surface; Chapter-aware behaviour; the "grows quieter" rule beyond coaching pace |
| Two-device Sitdown | Shared session authority with participant members and per-member acknowledgment | A pass-the-phone mode; a UI that shields the other partner's private turn; two-browser convergence still unproven |
| Quiet expression | `atmosphere` boolean; reduced-motion handling; coaching pace "Quiet" | A per-theme Quiet expression that reduces artwork, sentiment, motion, and sound as one choice |

### 2.3 Absent

The Chapter, Ritual, Move, Win, and Memory objects; Our Rhythm; Our Story; the celebration ladder; the Fund pulse; partner presence on Home; the Bridge for expenses, bills, and calendar events (today's Bridge carries only Plan meaning: contribution/range, responsibility, constraint, shared goal, Fund target); Home → Personal "Bring into My Money"; a Status Centre; adaptive action; coverage ladder; tradeoff map; decision notebook; what-changed diff; pause-a-standing-agreement; a leaving/export review; reorientation after long absence; the "Our Home" and "My Money" names anywhere in the product.

### 2.4 Where the compass was wrong, and what that changes

**The Plan rebuild thesis is stale.** v1 says the Plan page "begins with an accounting result," "treats Personal and Household as filters," and "reports after the fact." Plan System V2 opens with "Start with a conversation," has genuinely separate Personal and Household scopes with private drafts, and includes cash-flow runway, true-expense discovery, scenario lab, assumption drawer, reflection, and a Hercules coach. The plan below stops re-litigating Plan and instead lists the four instruments still missing.

**The household shell is not "from zero."** D-242 already shipped Home / Our Money / Our Path / Together. The reinvention's job is to recompose what those four destinations *contain* — above all Home — not to invent the map.

**Themes are not "later."** `AGENTS.md` requires every UX change to ship all three authored themes, and the scene system is already deeper than v1 imagined. The plan keeps that law and adds one rule: design a new surface's grammar theme-neutral in a flagged branch first, then author the three expressions before it leaves the flag.

**There are two Sitdowns.** The eight-stage Plan Sitdown and the older three-act `src/SitDownGuide.tsx` (What went well / the shared view / Where leftover goes, with Confirm moves, standing orders, and Lock month) both exist. This is the single most important consolidation in the plan (section 6).

**The Bridge exists, but only for Plan.** The signature story — "I paid for groceries from my Personal account and part of it belongs to the household" — has no Bridge path today. That, not a Bridge tab or more lifecycle states, is the Bridge gap.

**The Charter is the missing link in v1's Together.** v1 mentions "the household charter" once. The app's Charter is already the root agreement object (custodian, split rule, what either of us can just do, ceiling, cadence, signatures, amendments). v2 makes it the spine of the agreement layer.

---

## 3. Two Spaces, One Hearth

**Direction.** One identity, two purpose-built spaces, a persistent switcher that reads like moving between rooms. My Money works without a household; Our Home works even if a member keeps no detailed Personal books. Unfinished drafts stay bound to their ledger. Crossing into Our Home should feel like entering a different product: the Personal shell's account density falls away.

**Names.** The switcher shows **My Money** and the couple's chosen household name, default **Our Home**. Inside Our Home, the money object is **the Fund**, default label "The Fund," renamable, and the couple's chosen name replaces the label everywhere it appears. This resolves v1's ambiguity between "Our Home" (the space) and "the Fund" (the pool), and it fixes the app's current defaults ("Household Ledger" / "Jonathan's Personal Ledger"), which describe accounting scope rather than a place.

A naming collision to settle now: v1's committed shell names the household truth destination **Our Money**, while the Personal space is **My Money**. A person switching spaces would see "My Money" in the threshold and "Our Money" in the tab bar — two similar labels doing different jobs. **Recommendation:** label the household truth destination with the Fund's chosen name (default **The Fund**), which v1's earlier capability map already proposed and which honours the rename decision. The four household questions then read: Home (Where are we?) · The Fund (What is true?) · Our Path (Where are we going?) · Together (What needs us together?). **Decision 1.**

**Today.** `view-switch` is a small two-button group with user-authored names; a separate "Switch household" disclosure appears only with multiple replicas. Household Home is the Personal office with household panels stacked on top, so the threshold is not felt. `src/PersonalLedgerFolio.tsx` (a Personal "folio" room) exists but is imported nowhere.

**What changes now.**
- Rename defaults to My Money / Our Home / The Fund; keep user rename.
- Make the threshold a real transition: the switcher becomes a labelled space control in the topbar on both widths; the Personal bottom nav and the household bottom nav are different components with different furniture, not one `<nav>` filtered by view; no Personal account tabs or categories follow the user across.
- Returning users open their last space; first run asks whether to begin with My Money, create Our Home, or join one (today's onboarding already has "Start together").
- Decide Personal navigation (section 4.6).

**Open.** Decision 1 (tab label). Whether a person may later belong to more than one household without duplicating My Money (v1 parks this; the replica model already supports multiple households — keep parked).

---

## 4. Our Home — the living shell

### 4.1 The four destinations

Home, The Fund (or Our Money — Decision 1), Our Path, Together are committed and shipped. What changes is what each destination is composed of.

- **Home** owns the current Chapter, the Fund pulse, one next Move, the next Sitdown, partner presence, what is growing, and a recent Win only when one exists. It summarizes obligations, goals, decisions, and stale evidence, and every summary opens its authoritative home. It does not own history, settings, or a learning library.
- **The Fund** owns accepted household position (available vs committed), obligations and cash-flow timing, contributions, reimbursements and settlement, accepted activity as a readable story, evidence lineage, corrections, and the Quiet Record (the household face of Books). Calendar is a view of shared financial time inside it, not a destination.
- **Our Path** owns Chapters (active and past), Journeys, goals and Kitty Banks, learning progression, Our Rhythm (graduated habits), and Our Story (kept Memories). Plan Studio is a room inside Our Path, not the whole tab.
- **Together** owns the Charter, the next Sitdown and its agenda, decisions waiting for acknowledgment, responsibilities and backup knowledge, the fairness arrangement, standing agreements, and each partner's private preparation entrance.

**Today.** Home is described in 4.2. "Our Money" renders the household Books/ledger surface. "Our Path" renders Plan Studio with the Kitty Bank room inside it. Together renders `HouseholdTogether` with "Resume our Sitdown." A compensating secondary nav ("Calendar & bills · Work & shifts · Settings & more") sits under the household header because the four-tab shell dropped Calendar, Shift, and More.

**What changes now.** Recompose Our Path so the Chapter, goals, and rhythm lead and Plan Studio is entered as a room. Move the household Calendar into The Fund as its time layer and retire the secondary nav (Work is a Personal job; Settings moves to the Status Centre). Retire the Till door from Home once the adaptive action covers quick capture.

### 4.2 Home: the opening composition

**Direction.** Home composes the current moment rather than tiling every metric. First screenful on mobile: the Home's identity, the Chapter moment, the pulse sentence, one next Move. Below: coming up, what is growing, partner presence, a Win only when earned. When everything is healthy the page becomes spacious; when one thing needs action, that thing takes the stage. Nothing on Home may be a full register, every goal at once, a reimbursement scoreboard, duplicate balance cards, technical sync detail when healthy, a large generic Hercules prompt, or a wall of shortcuts.

**Today.** `OfficePhone` opens with a weather ribbon, three wax seals (Money in / Money out / Leftover spend — a Personal-ledger grammar that duplicates the Fund position), and story tiles, with `HouseholdPathHome` ("The life this money supports"), the Till door, and the four-week rehearsal invite stacked above. `OfficeWide` is a seals row over mosaic / stage / banks. Both are good Personal offices and wrong Household homes; the direct user signals "There's too much information," "I don't know how to get here," and "What can I actually do?" all trace to this page.

**What changes now.** Build a new Household Home component behind the Plan V2 flag family, theme-neutral first, with exactly these parts: identity line (Home name, optional couple-supplied image or symbol; never fabricated memorabilia); Chapter moment (title expressed as meaning, e.g. "Make Rent Boring · week 2"); Fund pulse sentence (4.3); next Move card with owner and any acknowledgment needed; coming up (the two or three nearest dated obligations and potential expenses, from existing `monthObligations` and `potentialExpenses`); what is growing (one or two goals, from Kitty Bank backing steps); partner presence (4.4); recent Win (only when the celebration ladder fires); quiet doors to The Fund, Our Path, Together. Remove the wax seals, story tiles, Till door, and rehearsal invite from Household Home (the rehearsal becomes Chapter 1 — section 5.6). Keep the Personal office untouched.

### 4.3 The Fund pulse

**Direction.** One calm sentence describing the state of the shared plan, never the relationship: **Covered** (near-term shared obligations supported by current evidence) · **Building** (essentials stable, Chapter progressing) · **One thing needs us** (a bounded decision or responsibility is ready) · **Time to reset** (the plan no longer matches reality) · **Checking** (evidence stale or incomplete; no confident claims).

**Today.** Every input exists: `projectHouseholdFund` (operating balance, transfer due, upcoming reserve, top-up needed, reconciliation state), `evaluatePlanDrift` findings with critical / attention / gentle severity, `PlanAcknowledgement` state, Bridge decisions awaiting the couple, Fund contribution motions awaiting confirmation, and `syncFreshness` tone. Nothing composes them into one state.

**What changes now.** Define `fundPulse()` as a pure projector over those inputs with an explicit precedence: Checking (stale/offline/unreconciled) → Time to reset (critical drift or a reopened plan) → One thing needs us (any item awaiting both partners or the custodian) → Covered (protected lines covered through the horizon) → Building (covered plus an active Chapter with progress). Each state carries the one amount or gap that matters and a link to its authoritative home. The pulse is plain text with a non-colour glyph, reusable on Home, in the status bar, and as Hercules's first sentence.

### 4.4 Partner presence

**Direction.** What each person has completed, proposed, or is waiting on — without surveillance, rankings, or contribution totals. "Bianca acknowledged the October plan · Jonathan's Bridge proposal is waiting for you."

**Today.** `softPresence` and realtime presence exist for continuity; acknowledgment, Fund motion, and Bridge states carry actor identity. No surface shows them together as presence.

**What changes now.** A presence strip on Home composed only from shared-scope facts (acknowledgments, motions, Bridge decisions, responsibilities due). Never counts, never totals.

### 4.5 The adaptive action

**Direction.** One control in a stable position whose verb set changes with the destination. Home: Plan something · Cover something · Record something · Decide together · Celebrate something · Ask Hercules. The Fund: Record shared activity · Add or inspect an obligation · Propose a reimbursement · Plan a cost · Correct accepted history. Our Path: Begin a goal · Add a Ritual · Choose a lesson · Mark a milestone · Keep a Memory. Together: Add a Sitdown item · Propose an agreement · Assign or rebalance responsibility · Ask for acknowledgment · Appreciate a contribution. The active ledger is always named before a financial verb; financial and non-financial verbs are visually distinct; every financial verb ends at Final Confirm. In My Money the set stays direct: Add an expense · Add income · Add a transfer · Add a shift.

**Today.** `FAB_ADD_ACTIONS` is a constant of four financial modes rendered identically everywhere. The downstream Add flow (`AddSlideshow`, `MobileEntryChoices`) is already contextual in content.

**What changes now.** Make the action set a function of `(view, tab, context)`; keep the existing four as the My Money set; map each household verb to an existing destination flow (Record → Add expense with household scope; Cover → contribution motion; Plan a cost → potential expense editor; Decide together → Together's waiting list; Celebrate → Memory offer; Propose a reimbursement → the expense Bridge in section 8). The FAB's position, scrim, focus return, and "actions open Add; they never post" rule stay.

### 4.6 Personal navigation

**Direction (v1).** Four destinations plus the action; a fifth must earn its place. v1 proposed Home · Calendar · Work · Books for My Money, and separately said Personal Plan should remain a permanent destination — which makes five.

**Today.** Home · Cal · Shift · [+] · Books · Plan · More.

**Recommendation.** Remove More (it becomes the Status Centre behind the status bar), rename Cal → Calendar and Shift → Work, and keep five: **Home · Calendar · Work · Books · Plan**. My Money is deliberately the dense, exact product, and for a tipped shift worker Calendar (paydays, shifts, bills) and Work are both daily jobs. The four-item rule was written for the household shell. Revisit once the household shell lands; the fallback is folding Calendar into Home and Plan as a time layer, mirroring the household rule. **Decision 2.**

### 4.7 Status bar and Status Centre

**Direction.** The status bar always makes four things legible: who I am, which space I am in, whether my data is current, whether anything needs my attention. Healthy is compact and quiet; attention appears only when actionable and opens directly to the explanation or recovery. Tapping it opens the **Status Centre**, which replaces More entirely and holds only what is global, infrequent, account-level, or exceptional: **Needs Us** (unresolved acknowledgments, due responsibilities, failed actions, stale information); **Sources and continuity** (linked account entrances, freshness, sync and recovery, what survives disconnection); **Household** (Fund name, members, invitations, roles, leave and export); **Privacy and sharing** (what I'm sharing, what is shared with me, Bridge history, Hercules permissions, trusted devices); **Appearance and comfort** (theme with live Chapter preview, Quiet expression, motion, haptics, sound, celebration intensity, coaching intensity, text and contrast); **Help and transparency** (what Hercules can see/infer/draft/never decide, how calculations work, export, what's new).

**Today.** `SyncFreshnessStatus` already does the bar's job well, including "Needs attention" and a deep link. More holds most of the right content in the wrong order: appearance first, then charter, start-from-scratch, account, household table, books integrity, recent changes, restore points, this phone, clock and place, where the books live.

**What changes now.** Rebuild More as the Status Centre with the six groups above, reachable from the status bar in both spaces and from no tab. Move out what belongs elsewhere: Charter → Together; Books integrity and "the full twelve-month story" → Books / Quiet Record; Kitty and plan controls → Our Path; development-environment controls → a clearly separated advanced area. Add what is missing: the Bridge privacy dashboard, independent comfort controls, the Hercules capability map, and a single recovery centre. Add the space name to the bar.

---

## 5. The Chapter system

This is the largest unbuilt part of the vision and the one that most directly addresses the project's stated main goal: Bianca barely engages with the app today, and the household has no money ritual at all — the ritual has to be created, not supported.

### 5.1 Vocabulary (committed)

- **Living Home** — the shared place the couple returns to (Home, section 4).
- **Journey** — a longer outcome spanning several Chapters ("Settle into our first home").
- **Chapter** — one Sitdown-to-Sitdown month: one Lesson, one primary new habit, reflection, payoff. Follows the couple's Sitdown, not the calendar.
- **Lesson** — the one financial idea understood more deeply this month.
- **Ritual** — a repeated behaviour tied to a real financial cue (payday, pre-rent, the weekly clearing moment, after a surprise). Has an owner, a definition of done, the evidence that shows it happened, and a recovery move chosen in advance.
- **Move** — the smallest useful action available now; may have an owner.
- **Win** — truthful evidence that effort produced a benefit. Routine Wins fade after acknowledgment.
- **Memory** — a First, recovery, milestone, or closing the couple chooses to keep in Our Story. Authored, never manufactured; amounts may stay hidden.
- **Our Rhythm** — graduated habits that have left the foreground and hold quietly; they resurface only when disrupted, deepened, or relevant to a decision.

### 5.2 The loop

Arrive → Orient (one sentence) → Choose (accept, change, pause, or decline the suggested Move) → Act → Acknowledge (the partner responds where shared meaning requires) → See growth (Home changes) → Celebrate or recover → Close and carry forward (at the Sitdown).

### 5.3 Objects and where they live

These are non-money objects. They belong in the household document as new collections alongside `monthRehearsals`, `sitDownSessions`, and `weeklyDocumentStamps`, excluded from financial hashes exactly as D-183 excluded rehearsal metadata. Proposed shapes (for Codex/Jonathan review — schema is outside Claude's authority):

- `journeys[]` — id, title, why, chapterIds, state.
- `chapters[]` — id, journeyId?, title, meaning, openedAtSitdownId, closedAtSitdownId?, lessonId, primaryRitualId, moveIds, state (open · closing · established · still-forming · life-changed · closed), carryForward, memoryOfferId?.
- `rituals[]` — id, chapterId, cue (payday · pre-rent · weekly · sitdown · after-surprise · custom with recurrenceId), ownerMemberId, backupMemberId?, doneDefinition, evidenceRule (which accepted facts count), recoveryMove, state (active · graduated · paused · retired), holdingEvidence[].
- `moves[]` — id, chapterId, ritualId?, text, ownerMemberId?, needsAcknowledgment, state, completedEvidenceRef?.
- `wins[]` — id, level (acknowledgment · shared-win · first · graduation), evidenceRefs, shownAt, fadedAt.
- `memories[]` — id, winId?, title, authoredNote?, authoredMediaRef?, hideAmounts, keptBy (both acknowledgments for a shared Memory), kittyBankId?.

Existing objects the Chapter system reads rather than duplicates: `PlanVersion` and `PlanHerculesSession` (the Sitdown's decisions and `rhythm` text), `recurrences` (cues), `HouseholdFundContributionMotion` and `fund_events` (evidence), `PlanDriftFinding` (pressure), `PlanLearningProgress` (Lesson completion), `Charter` (standing agreements), `Goal`/Kitty Bank (what is growing).

### 5.4 The six-Chapter foundation

Committed as a living curriculum, expanded through use, never a locked sequence:

1. **See Our Shared Life** — map obligations, agreements, and evidence; Lesson: Personal vs shared, the Bridge, what the Fund represents; Ritual: bring one shared question into the Sitdown instead of carrying it privately. Tools: Shared Home Map, Shared Agenda Builder, Four-Horizon View.
2. **Make Rent Boring** — Lesson: cash-flow timing, balance vs available; Ritual: pre-rent readiness check tied to Bianca's biweekly pay cycle. Tools: Cash-Flow Ribbon (runway exists), Coverage Ladder, Responsibility Map.
3. **Share the Mental Load** — Lesson: ownership, backup knowledge, definitions of done; Ritual: one whole responsibility moves through owner-and-backup. Tools: Mental-Load View, Responsibility Map, Backup Knowledge Card.
4. **Build Breathing Room** — Lesson: irregular vs emergency, buffer purpose; Ritual: a small recurring contribution to a chosen buffer (a Kitty Bank). Tools: Buffer Runway, True-Expense Radar (exists as Prepare discovery), Shock Scenario (exists as stress rehearsal).
5. **Make Room for Joy** — Lesson: goal definition, tradeoffs, opportunity cost; Ritual: one contribution or planning Ritual advances a chosen goal. Tools: Goal Tradeoff Map, Scenario Slider (exists), an authored celebration plan.
6. **Handle a Surprise Together** — Lesson: prioritization, buffers, rebuilding; Ritual: a short recovery Ritual whenever the shared plan materially changes. Tools: Priority Ladder, Recovery Plan, What Changed Card.

Expansion Chapters (true expenses, debt, credit, protection, taxes and benefits, the long future, choosing a product, one income, a major purchase, fraud, rebalancing the agreement, returning after time away) stay as candidates; the thirteen-domain curriculum and the "neglected but consequential" list remain the reference for what each may teach.

**Today.** `PLAN_CURRICULUM` (12 modules) is a dead constant; four FCAC lessons ship, one per lens, with "Learning never blocks agreement." **What changes now:** wire the four lessons as the Lessons of Chapters 1, 2, 4, and 5; retire `PLAN_CURRICULUM` or re-key it to Chapters; add Chapters 3 and 6 lessons (Canadian, FCAC/CFPB-sourced, reviewed date recorded, like the existing four).

### 5.5 Closing a Chapter and the celebration ladder

A month ends; it does not pass or fail. Closing offers exactly one of: Established (graduate into Our Rhythm) · Still forming (carry forward only if chosen; change size, cue, or owner) · Life changed (close and begin a more relevant one) · Meaningful result (offer a Memory) · Little changed (reflect without theatre).

The celebration ladder has four levels, each with a truth condition and a theme-neutral behaviour: **Acknowledgment** (a small completed Move: one specific sentence, a soft settle) · **Shared Win** (a repeated Ritual with visible benefit: warmer copy, a subtle Home change) · **First or milestone** (accepted financial evidence, never a proposal: a distinct shared moment, specific Hercules reflection, optional Memory offer) · **Chapter graduation** (reflection on what changed, then the next choice). Pressure reverses the ladder: no celebration layer, quieter Home, smaller next Move. Every celebration can be skipped, muted, or kept; none implies custody, return, perfection, or relationship quality.

**Today.** Kitty jar `celebrate` animation, Hercules `celebrate` pose, the `verified-milestone` drift finding, and `saveBoardMilestone`. No ladder, no truth conditions, no Memory. **What changes now:** implement the ladder as a pure function from evidence to level, drive existing poses/animations from it, add the Memory offer sheet (authored note, optional couple-supplied image, hide-amounts toggle, both partners keep), and a Comfort control for intensity.

### 5.6 Chapter 1 is the Month-One rehearsal

The roadmap's D-183 four-week rehearsal with Bianca (`MonthRehearsalPanel`: weekly checkpoints, "ten-minute weekly sit-down," week 3 "Corrections and trust") gates launch, and Jonathan already planned a four-question founding conversation with her (twenty minutes, no screen) in week one. These are the same thing as Foundation Chapter 1 "See Our Shared Life" plus the Charter founding conversation. **What changes now:** the rehearsal is re-expressed as Chapter 1 — its weekly checkpoints become Rituals, its stop conditions stay as kill criteria, its closing is the first real Sitdown. The Charter's five questions absorb Jonathan's four. One object, one story, and Bianca's first month in the app *is* the product.

---

## 6. The Sitdown — one ritual

**Direction.** The Sitdown is the Chapter boundary and the heart of Our Home: a prepared, guided conversation that produces shared orientation, one Lesson, the few decisions that need both people, ownership with definitions of done, continuity (close one Chapter, open the next), and closeness. Eight steps: Arrive together · Close the previous Chapter · Orient to shared reality (Now / This Chapter / Ahead / Longer horizon / Unknown) · Learn one useful thing · Make the shared decisions · Turn the decision into a Ritual · Look ahead without reopening everything · Open the next Chapter. It is a focused **mode** entered from Home or Together, never a fifth tab. Before it, Hercules assembles a household-visible brief and each partner has a private preparation space behind a hard wall. It adapts: steady, under pressure (shorten, defer teaching), recovery, one partner absent (hold consequential decisions), long absence (reorient, smaller Chapter). It must never become an account audit, a lecture, a confession, a score, or a second ledger.

**Today.** Two Sitdowns exist. The Plan Studio stages (Arrive · Notice · Reflect · Update reality · Build the month · Learn · Resolve the Bridge · Acknowledge) are a faithful, shipped version of the anatomy, with private preparation already separated ("Your private preparation is only shared if you deliberately write it here") and a `rhythm` text field standing in for the Ritual. `SitDownGuide.tsx` is the older three-act flow that *moves money*: it allocates leftover by weight/percent/fixed, confirms moves, adopts standing orders, exports a workbook, and locks last month.

**What changes now.** Consolidate to one Sitdown mode built on the Plan Studio stages, renamed to the eight human steps. The three-act flow's valuable parts move to their natural homes: "Where leftover goes" becomes a **Close the month** tool in The Fund (a bounded financial action with its own Final Confirm) that the Sitdown's "Make the shared decisions" step can open in context; "Lock last month" stays in Books / Quiet Record; standing orders become graduated Rituals; "What went well" becomes the Arrive step's recognition of one specific act of care. The `rhythm` text field becomes a Ritual object with cue, owner, done, evidence, recovery. Add the Sitdown brief (what changed, what is settled, the smallest set of items needing both) generated from drift findings, Bridge decisions awaiting, Fund motions, and reflection. Add the **Private preparation / Shared with both of you** label to every surface in the mode. Pass-the-phone is a clearly handed private turn; two-device mode is in the product model now and delivered when two-browser convergence is proven.

**Open.** Should the couple choose the Lesson before the Sitdown, or should Hercules reveal his recommendation after closing the previous Chapter? (Recommendation: recommend after closing; the couple chooses.) What happens when one partner repeatedly postpones? (Recommendation: Together shows "Sitdown waiting since…" neutrally; Hercules offers a fifteen-minute version; never a nag.) **Decision 3:** confirm retirement of the three-act Sitdown as a separate surface.

---

## 7. Plan — the decision studio

**Direction.** Plan is where financial truth becomes intent. Personal Plan asks "What do I need my money to do next?" and is private, direct, and complete without a household. Household Plan asks "What are we choosing to make possible together this Chapter?" and is a shared agreement studio with same-version acknowledgment. Four lenses — Protect · Prepare · Build · Everyday — are lenses, not tabs. Planning is intent, never financial truth; scenarios never post; material changes create versions or counterproposals; plan health is a small set of explainable conditions, not a grade. Two clocks: the calendar month for financial timing, the Sitdown-to-Sitdown Chapter for learning and focus.

**Today.** Plan System V2 implements the model: `PlanVersion`, `PlanLine` (commitment kinds including bridge-commitment), `PlanAssumption` with confidence and source references, `PlanScenario`, decision fields with reopen-when, `PlanDriftFinding`, reflection with per-line status, learning progress, and the Hercules plan guide. Cash-flow runway, true-expense discovery, scenario lab, assumption drawer, stress and purchase rehearsal all exist. "Everyday" is the shipped name for v1's "Live" (v1 question 7 is answered: **Everyday**). Household Plan is reached as the "Our Path" tab today.

**What changes now.**
- Build the four missing instruments: **Coverage ladder** (immediate → rest of Chapter → true expenses → buffer → goals and joy, each rung openable; tactile on desktop, stepped on mobile); **Tradeoff map** (move one future contribution and watch dates and flexibility respond); **What-changed diff** (the history section exists; add a field-level, meaning-first comparison to the last acknowledged version); **Decision notebook** (a durable list of material choices with options considered, reason, acknowledgers, and reconsideration trigger — today's decision fields are the data; the notebook is the view).
- Give Household Plan the v1 opening posture language using the Fund pulse (Covered · Building · One choice needs us · Time to reset) and the **One choice needs us** framing when a plan does not close ("The repair estimate leaves $180 uncovered. Compare…").
- Place Household Plan as a room inside Our Path (section 4.1) with contextual entry from Home, The Fund, and Together ("Prepare for our Sitdown," "Review what we agreed"). Personal Plan stays a permanent My Money destination.
- Rewrite the v1 rebuild thesis as "what V2 delivered" (section 17).

**Open. Decision 4:** planning method for the household side — the hybrid (precise obligations and true expenses, one broader Everyday pool, explicit goal contributions) versus category-level limits. The shipped V2 is already the hybrid; confirm it. **Decision 5:** when a plan is fully covered but one partner has not acknowledged, does the posture say "Covered — waiting for Bianca," or does acknowledgment live separately? (Recommendation: separate. Pulse describes money; presence describes people.)

---

## 8. The Bridge

**Direction.** The Bridge is a governed process between My Money and Our Home: a person turns selected private context into a household proposal, or brings an accepted household responsibility into their private plan. It is not a third ledger, not a sync, not a tab. Vocabulary at the moment of action is literal: **Share with Our Home**, **Bring into My Money**, Propose, Review. Before anything crosses: what will be shared, who will see it, why Hearth is asking, what accepting changes. Lifecycle: Private → Draft → Proposed (sender acknowledged) → Seen → In discussion → Counterproposal → Mutually acknowledged → Accepted as context / as plan or responsibility → Awaiting Final Confirm → Financially confirmed → Declined / Withdrawn / Superseded → Archived. Seen is not agreed; silence is not consent; discussion never changes truth; acknowledgment never substitutes for Final Confirm. The no-duplication rule: the Personal record stays the source; Our Home holds only the acknowledged household meaning, and Hearth shows the relationship rather than two unrelated events.

**Today.** `PlanBridgeEditor` is a faithful Bridge for *Plan meaning*: kinds contribution/range, responsibility I can take, constraint to respect, shared goal, Fund target; exact disclosure review with an explicit "Never shared" list; proposed · held · declined (with reason) · withdrawn · accepted · superseded; private replacement via `supersedesId`; acceptance only by adding to one's own Household draft, which then needs proposal plus independent acknowledgment; tests prove private labels never reach Shared Hercules. Income privacy is structural (Household assumptions can cite only Bridge decisions).

**What changes now.**
- **The expense Bridge** (signature story 1): on an eligible Personal expense, "Share with Our Home" with the four required meanings the sender must choose — household spending, reimbursement, contribution recognition, planning-only — a portion selector, minimum supporting detail, a recipient preview, and the same lifecycle. Acceptance that creates a household fact routes to the existing Fund flows (a contribution motion for contribution recognition; a settlement item for reimbursement; a household-scoped expense for household spending) and ends at Final Confirm. The Personal record shows Bridge status; the household item shows provenance without exposing the source account.
- **Bills and calendar events** as Bridge objects (a Personal event → a household potential expense with date and range only).
- **Bring into My Money** (Home → Personal): an accepted household bill, contribution due, or responsibility offered to a member's Personal Calendar or Plan as a reference, never a transaction; completion reports minimum status back; declining the aid does not erase the responsibility.
- Add **Seen** and **In discussion** (a question attached to the proposal) to the state model; keep "held for Sitdown."
- Bridge history and "What I'm sharing / What is shared with me" in the Status Centre.

**Open (kept from v1, still provisional).** Does a pure FYI need a second acknowledgment? (No — Seen suffices until it is adopted into a plan or decision.) Standing permissions? (Not yet; one-time proposals until the model is trusted.) Do proposals expire? (They go stale and leave attention surfaces; they never silently accept or vanish.) Is "Bridge" customer-facing? (A recognizable concept; literal verbs at the moment of action.)

---

## 9. Goals, Kitty Banks, and Our Story

**Direction.** A Kitty Bank is a named shared intention with emotional meaning and financial structure: what we are building toward, why it matters, the target or milestone, what is available, what each partner agreed to contribute, what could affect it, the next step, how we will recognize progress. Goals are not budget categories. Contribution promises are mutually acknowledged before they enter the shared plan; personal tradeoffs used to keep them stay private; a missed promise is a conversation, not a judgment. Potential expenses are planned, revisable, removable, and convert only through explicit review.

Jonathan's stated vision for the Kitty Bank room: a standalone App-Store-quality experience — pottery-style sculpting (heads, ears, whiskers, mouths, bodies), a world-class paint studio, a kiln firing that gives a glaze polish; the bank grows with backing in the same 10% steps as the shelf (D-173) and slims when money is used, with Slime Rancher squash-and-stretch on deposits; designs shared through the household; a fired bank is final, and "throw another" starts a new one.

**The unification v2 adds:** a fired Kitty Bank is the natural **Memory vessel**. When a goal is reached or a meaningful First happens, the couple may keep the bank — fired, final, with its authored note — in **Our Story**. The studio is therefore not a side game; it is how the couple authors the physical form of what they are building, and Our Story is where the finished pieces live. Celebration stays proportional and evidence-bound: a bank never fires on a proposal.

**Today.** `KittyBanks.tsx` and the `src/kitty/` room (lens choices Protect / Prepare / Build, "Assign. Use. Refill.", return earmarked money to the Fund) and the studio (`KITTY_BODIES/HEADS/...`, brush/marker/sponge/eraser, fired pieces immutable, cap 6) are Development-deployed. The room is mounted inside Plan Studio. Goal contributions are append-only; saved amounts are derived. Theme decisions require colour-independent meaning.

**What changes now.** Move the Kitty Bank room to Our Path (the brief for #447 explicitly deferred this as a shell decision; v2 makes it). Add the story fields (why it matters, how we will recognize progress) and a contribution promise per partner expressed as a Bridge kind (contribution/range already exists). Connect milestones to the celebration ladder and the Memory offer. Keep the studio's "final when fired" rule and raise the cap only when Our Story exists to hold retired pieces.

---

## 10. Together and the Charter

**Direction.** Together answers "What needs us together?": the next Sitdown and its agenda, decisions waiting with both acknowledgment states, responsibilities with owner, backup, definition of done, and return cue, the fairness arrangement, standing agreements, and each partner's private preparation entrance. Fairness is supported without being declared: equal, income-proportional by percentage or range, custom, alternating, the Fund pays, one partner intentionally covers, a temporary exception with a review point. Contribution totals are quiet by default and available on demand. Equal stake does not require identical work; the product prevents knowledge and anxiety from concentrating invisibly.

**Today.** The Charter already holds who holds it, how we decide who puts in what (Evenly / By what we each earn / One of us covers what's left), what either of us can just do (revocable permissions), how much work is too much, when we sit down, custom clauses, signatures, and amendments (raise → hold → confirm by the other). Together renders "Resume our Sitdown." Plan-linked tasks exist (D-242). No fairness sandbox; no responsibility map; no mental-load view.

**What changes now.**
- Make the Charter the visible spine of Together: it opens with the Charter's clauses as the standing agreements, the next Sitdown, and decisions waiting.
- **Fairness sandbox**: compare the Charter's three split rules plus custom and alternating against a declared income range or percentage per partner (Bridge kind contribution/range), showing who carries money, risk, and administration — privately first, then proposed. Bianca's stated reality (she will not contribute her whole paycheque; her share is not the same each month; the first month is discovery) is the design case: the sandbox must support a range and a review point, not a fixed number.
- **Responsibility map** from CharterPermissions, Ritual owners, and Plan-linked tasks, emphasizing coverage and backup knowledge, never task counts by person. Add the **Backup Knowledge Card** (who else can find the authoritative record) and a non-secret continuity map.
- "Pause a standing agreement without erasing history" as a Charter amendment state.

---

## 11. The Fund — the truth layer

**Direction.** The Fund answers "What is true?" in progressive depth: a plain-language position (available now, committed next, due soon, needs agreement, recent movement, healthy status), then understandable breakdown, then the Quiet Record and source evidence. It is non-custodial: its balance says what it represents (declared contributions, connected evidence, accepted activity) and how fresh that evidence is; "available," "funded," "paid," and "settled" never imply more certainty than the evidence supports. Shared expenses begin with what happened, not accounting detail, and carry one of six treatments (paid from shared money; paid personally and recognized; paid personally with reimbursement; paid personally as a contribution; partly household; planning-only). Bills distinguish scheduled, set aside, paid, confirmed. Reimbursements are agreements, not accusations, and leave Home when resolved. Activity reads as a household story. Calendar is the time layer inside it.

**Today.** This is the most complete part of the app: motions with two-sided consent and declared sources, settlement with allocation preview, the contribution register tying to obligations oldest-first, potential expenses, append-only Fund books with audit links, private reconciliation ("Jonathan sees only whether it ties"), `FundTrust`'s Confirmed / Observed / Estimated ladder, and `Books.tsx` for the Quiet Record.

**What changes now.** Recompose the Fund landing as the six-line position above the existing panels; map the six expense treatments onto the Add flow and the expense Bridge (section 8); add the **Close the month** tool (from the old Sitdown) here; fold the household Calendar in as the time layer with a scrubbable month ribbon; rename the tab per Decision 1.

---

## 12. Hercules — the couple's companion

**Direction.** One identity, three contexts — Home presence (ambient, ignorable), private preparation (helps one partner think; nothing crosses unless deliberately shared), shared moment (reasons only from household-visible evidence; addresses both symmetrically). Roles: welcomer, coach (smallest next Move), translator, conversation host, pattern spotter, recovery ally, witness, celebrant. The closeness test: every shared intervention should reduce the chance one partner feels alone with the problem, make both perspectives easier to understand, or create shared pride — otherwise the surface should do the job without him. He grows quieter as Rituals stabilize and returns for a new Lesson, real difficulty, or an earned milestone. He never chooses the fairness model, takes a side, reveals private evidence, treats one acknowledgment as both, celebrates what evidence does not support, performs Final Confirm, or gates evidence behind his interpretation. Education is distinguished from advice; above education he prepares questions for a professional.

**Today.** The authority, privacy, provenance, and voice infrastructure exists and is tested: typed read tools with member/view scoping, closed reply contract with expression and gesture enums, Worker-bound Shared turns, private chat and memory with forget controls, drift tool with snooze/dismiss, coaching pace, the action panel that proposes and never posts, the plan guide that asks one question at a time. The character and wardrobe work is far ahead of the behavioural work.

**What changes now.**
- Make the mode visible: a **Private preparation / Shared with both of you** label wherever Hercules speaks, in both spaces.
- Chapter awareness: his first sentence on Home is the Fund pulse plus the next Move; at Chapter open he explains the Lesson and offers choices; during practice he notices friction and offers a smaller Move; at closing he names the specific effort and benefit, then recedes.
- The "grows quieter" rule as logic: nudge frequency decays as a Ritual's holding evidence accumulates, independent of the coaching pace setting; presence expands on new Chapter, critical drift, or a ladder level of First or above.
- Celebration language bound to ladder levels, with the v1 example voice as the style reference ("Rent is covered. You both did the small things that made that true.").
- The Hercules capability map ("what I can see, infer, draft, and never decide") in the Status Centre.
- Bianca's six trials (`docs/briefs/HERCULES_BIANCA_ACCEPTANCE.md`) become Chapter 1 Rituals rather than a separate acceptance track.

---

## 13. Twelve expressions

**Direction.** Theme changes spatial metaphor, material, rhythm, transitions, Hercules's place, progress expression, and emotional tone; view changes density, comparison, reach, and how two people review together; ledger changes audience, authority, privacy, vocabulary, and default actions. The design test: if screenshots of the three themes could be mistaken for one interface with different colours, the treatment is not complete; if a financial decision changes meaning between themes, it has gone too far. Classic Hearth is the warm household table (Our Home) and the private writing desk (My Money). Taylor's Scrapbook is the open shared spread and the private journal, never fabricating tickets, handwriting, or memories. Newfoundland is a place-changing journey through St. John's — Jellybean Row warmth for Home, a harbour office for the Fund, Signal Hill's horizon for Our Path, a sheltered table for Together — with weather reflecting information state and never equating difficulty with threat. Every theme offers a **Quiet expression**. Celebration, coaching, motion, haptics, sound, and decorative density are separate controls from theme.

**Today.** Already authored per route and per ledger with twelve eras and twelve places; `AGENTS.md` requires all three themes on every UX change; the Hercules room theming depth was decided 2026-09-11 as one fully authored room per theme. Quiet exists only as `atmosphere` and the coaching pace.

**What changes now.** Keep the three-theme law. Add the grammar-first rule for new surfaces (theme-neutral behind a flag, then three authored expressions before unflagging). Add the Quiet expression as one Comfort control that reduces artwork density, sentiment, motion, and sound without changing the world. Author the new Household Home and Sitdown mode in all three themes as the first test of the twelve-expression review.

---

## 14. Trust, recovery, and cross-device

**Direction.** Equal dignity; both see accepted truth; both propose and counterpropose; the private-source owner decides what crosses; the responsible person confirms completion; the financial actor performs Final Confirm. Corrections preserve trust: draft edits freely, proposed revises or withdraws, acknowledged changes create a version, confirmed corrects through adjustment or reversal. Stale, offline, and cross-device states protect newer accepted decisions and never present a queued proposal as accepted. Leaving, pausing, and recovering are deliberate, neutral, and never celebratory. Devices have different jobs (mobile notices and captures; desktop compares and sits down); handoff opens at the same meaningful object; the privacy wall survives screen-sharing, thumbnails, and restored views.

**Today.** Almost all of this is built and tested (permission matrix, Confirm staleness, reversal-not-deletion, last-owner protection, device revoke, no-host continuity, offline tones). Missing: pause an agreement, a leaving review (open bills, goals, reimbursements, evidence, export), reorientation after long absence, the privacy wall's thumbnail/notification behaviour, and the two-device Sitdown UI.

**What changes now.** Reorientation after absence (a Status-Centre-driven "what changed, what can still be trusted, smallest useful reset" on return when freshness is stale beyond a threshold); the leaving review as a guided flow in Status Centre → Household; pause as a Charter amendment state. Two-device Sitdown follows the two-browser convergence proof already on the roadmap.

---

## 15. What changes now — the programme

Sequencing respects the operating model and the roadmap's gates: Phase 0 STOP-SHIP items, the Phase 1 "Bianca-ready monthly loop," the late-September Auth+RLS cutover, and the rule that nothing is "shipped" until merged, deployed, and live-verified. All new surfaces ship behind reversible flags, theme-neutral first, then three themes, with evidence at 320/390/720/~1100 including keyboard, focus, reduced motion, loading, empty, error, offline. Course deltas use the roadmap's Budget (5) / Engagement (3) weights. Schema, money semantics, Auth/RLS, and deployment items are planned here and decided by Jonathan with Codex review, per Claude's scope.

### Horizon A — before the October cutover (Development only; makes Bianca's first month the product)

| # | Item | Owner | Risk | Notes |
|---|---|---|---|---|
| A1 | Names: My Money / Our Home / The Fund defaults; tab label per Decision 1 | Claude (UX) | Low | Copy and `ledgerNames` defaults; no schema |
| A2 | Status Centre replaces More in both spaces; status bar shows space name; Personal nav per Decision 2 | Claude | Medium | Mostly recomposition of existing More content |
| A3 | Household Home recomposition (identity · Chapter moment · pulse · next Move · coming up · growing · presence · Win · doors); remove seals/tiles/Till/rehearsal invite from Household Home | Claude, Codex audit | Medium-High | Flagged; theme-neutral first; the single most important UX change |
| A4 | `fundPulse()` projector and presence strip | Cursor (core) + Claude | Medium | Pure projection over existing data |
| A5 | Adaptive action by `(view, tab)` mapped to existing flows | Claude | Medium | FAB rules unchanged |
| A6 | One Sitdown: rename stages to the eight steps; retire `SitDownGuide` as a surface; move leftover allocation to The Fund's **Close the month**; Ritual object replaces `rhythm` text; brief; mode labels | Claude + Codex (money path review) | High | Decision 3 |
| A7 | Chapter system v1: `chapters`, `rituals`, `moves`, `wins` as non-financial document collections excluded from hashes; Chapter 1 re-expresses the D-183 rehearsal; Charter founding absorbs the four-question conversation | Codex (schema), Cursor, Claude | High | Gated on Jonathan's schema decision |
| A8 | Our Path recomposition: Chapter leads, Kitty room moves here, Plan Studio becomes a room | Claude | Medium | Honors the #447 brief's deferred shell decision |
| A9 | Wire four existing lessons to Chapters 1/2/4/5; retire or re-key `PLAN_CURRICULUM`; add lessons 3 and 6 | Claude | Low-Medium | Canadian sources, reviewed date |
| A10 | Comfort controls: Quiet expression, celebration intensity, haptics/sound/motion, coaching intensity together in Status Centre | Claude | Low | Extends `Appearance` |
| A11 | Hercules mode label; pulse-first greeting | Claude | Low | Copy and presentation only |
| A12 | Housekeeping (section 17): doc pruning, D-239 collision, dead code, quick-gate debt | Codex | Low | The failing concurrent quick gate is flagged in three consecutive handoffs and should be fixed before A3–A7 land |

### Horizon B — October to December (after Auth+RLS; the living loop becomes real)

Celebration ladder and Memory offer; Our Story; Our Rhythm (graduation and holding evidence); the expense Bridge with four meanings and the six expense treatments; Bring into My Money; Seen / In discussion states; Bridge privacy dashboard; coverage ladder, tradeoff map, what-changed diff, decision notebook; fairness sandbox, responsibility map, backup knowledge card; Fund landing recomposition and Calendar folded in; Kitty Bank story fields and contribution promises; reorientation after absence; leaving review; pause agreement; the three theme expressions of Home, Sitdown mode, and Our Path; Chapters 2–6 content.

### Horizon C — 2027 and beyond

Two-device Sitdown; standing Bridge rules (narrow, inspectable, stoppable); multiple household memberships; search; digest and notification preferences; professional handoff pack; expansion Chapters; bank feeds, Interac, and any real account or card (a different trust, custody, and regulatory era — years away, per the compass and the roadmap's Phase 8).

### How we will know Bianca is ready

Kept from v1 and tightened: each partner can say what is available, committed, due, and who is responsible; "did this count?" is asked less; unequal contributions feel intentional without a scoreboard; Home is worth opening when nothing is wrong; a mistake is corrected without fear that history changed; and — the new one — Bianca completes Chapter 1 and chooses Chapter 2 herself. The D-183 stop conditions (imbalance, privacy leakage, duplication, loss, false Synced state) remain kill criteria.

---

## 16. Decisions needed

1. **Household truth tab label**: "Our Money" (as shipped) or the Fund's chosen name (default "The Fund"). Recommendation: the Fund's name.
2. **Personal navigation**: five destinations (Home · Calendar · Work · Books · Plan, More removed) or four with Calendar folded in. Recommendation: five now, revisit after the household shell lands.
3. **Retire the three-act Sitdown surface**, moving leftover allocation to The Fund's Close the month and standing orders to Rituals. Recommendation: yes.
4. **Household planning method**: confirm the shipped hybrid (precise obligations and true expenses, one Everyday pool, explicit goal contributions) over category limits.
5. **Covered vs acknowledged**: keep the pulse about money and presence about people. Recommendation: separate.
6. **Chapter objects in the household document** as non-financial collections excluded from hashes (Codex trust review).
7. **Chapter 1 = Month-One rehearsal**, with the Charter founding conversation as its opening. Affects how Bianca's first month is framed (and should be read by Bianca).
8. **Kitty Bank room moves to Our Path** and a fired bank may become a Memory in Our Story.
9. **Lesson choice timing**: Hercules recommends after the previous Chapter closes; the couple chooses.
10. **Names**: confirm My Money / Our Home as customer-facing space names.

---

## 17. Housekeeping

**Supersede in the v1 document.** "Our Home Navigation" (Home · Calendar · Home Account · Together) and the "Earlier capability map" — replaced by the shipped four-destination shell. "Rebuild Thesis" under Plan Page Rebuild — rewrite as "What Plan System V2 delivered and what remains" (the critique describes the pre-V2 page). "Theme expression comes later" / "Theme-by-theme styling decisions before the core experience is right" — replaced by the grammar-first-then-three-themes rule, since themes are already deep and mandatory. Question 7 ("Live" vs other names) — answered: Everyday. "Status of this direction: exploratory… not an implementation plan" — this v2 is the plan.

**Repository.** Fix the D-239 numbering collision in `docs/DECISIONS.md` (the table row is Plan System V2; the section is "Invite a new person before roster membership"). Remove or wire `src/PersonalLedgerFolio.tsx` (unreferenced) and `PLAN_CURRICULUM` (unreferenced). Repair the concurrent quick gate and the exhaustive repository gate flagged open in the last three handoffs before large UX work lands. Record that Plan System V2 is Development-deployed, not live-verified, and that the last explicit LIVE VERIFIED item is D-200.

**Vocabulary lock.** Use these and only these in copy and code: My Money, Our Home, the Fund (renamable), Home, Our Path, Together, Sitdown, Chapter, Journey, Lesson, Ritual, Move, Win, Memory, Our Rhythm, Our Story, Quiet Record, Bridge (concept) with Share with Our Home / Bring into My Money (verbs), Status Centre, Final Confirm, acknowledge. Avoid: sync both ledgers, move the transaction, partner access, auto-share, owes because, behind, failed us, streak.

---

## 18. Closing

The compass said: one home, two spaces, a governed Bridge, a couple learning to be good at life together one month at a time, and a companion who makes that feel possible without taking it over. The audit says most of the machinery for that already exists and works. What is missing is the *living* part — the Chapter on Home, the pulse in one sentence, the next small Move, the Sitdown as one ritual instead of two, the Win that is true and the Memory the couple chooses to keep. Horizon A builds exactly that, in the order that lets Bianca's first month be the product rather than a test of it.
