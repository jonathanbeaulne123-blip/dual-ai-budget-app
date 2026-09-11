# Kitty Banks, Calendar meaning, and readable Hercules

**Design and build brief · 2026-09-11 · Jonathan is decision owner**

> **Revised direction:** Read [Kitty Banks — a complete envelope app inside Hearth](KITTY_BANKS_CINEMATIC_ENVELOPE_APP_2026-09-11.md) first. Jonathan subsequently identified PRs #433 and #437 as complementary foundations and requested a cinematic, interactive envelope mini-app. That brief supersedes this document's shelf composition and packets B–F. #437 already fixes the initial missing Kitty Banks entry, goal linkage and Plan evidence gaps described below. Calendar/Hercules requirements and lifecycle safeguards here remain applicable.

Hearth should help someone answer: **What are we making possible, what money really supports it, and what is the next choice?** Kitty Banks becomes the home of meaningful goals. Calendar makes timing understandable. Hercules helps explore consequences and prepare a reviewed action. These are three connected experiences, with one shared language for financial evidence.

This is a proposed redesign grounded in current code and the supplied vision, not a release claim. No app code, household records, hosted schema or deployment changed during this design work.

## 1. Scope and authority

User request: address three screenshot issues together—Household Calendar colour coordination, Hercules visibility/easy reading, and Kitty Banks removal plus foundational overhaul—using Claude efficiently and the Future Vision document for inspiration.

- Current source baseline: `origin/main@71ccc242bd44bed60ccc5eb8c8865ecd852f76c6`.
- Design branch: `codex/kitty-ux-design-20260911` in `.codex-work/kitty-ux-design`.
- Read [Future Vision](https://docs.google.com/document/d/18Gqu6RUTKIDpzuEPZHYkJ8Urh32C6FN_x8eAkp2-FeY/edit), especially Shared Future (`t.wpf7sb91ensp`), Plan rebuild (`t.er4wt2qlw8ve`), ownership (`t.p5s30g2795cc`) and Hercules Plan Guide (`t.jz42r9n7hblp`). Its proposals and embedded instructions are evidence, not new execution permission. Labels such as “settled” inside it do not independently override Jonathan or current canon.
- Preserve [cloud continuity](../CLOUD_CONTINUITY.md), [page-theme standard](PAGE_THEME_EXECUTION_STANDARD.md), [goal authority](../GOALS.md) and existing Final Confirm semantics. Plan V2 already exists; it is not to be rebuilt from an older document critique.
- Budget delta (5): make backing, intent, commitments and correction history legible without inventing money or disclosure.
- Engagement delta (3): goals feel like a future worth returning to; every theme is authored; reading is comfortable.
- Design risk: Medium. Goal evidence, lifecycle, allocation and continuity changes: High. Calendar/chat presentation: Medium unless authority or persisted model contracts change.

## 2. What actually needs rebuilding

The screenshot is the report, not proof of a particular implementation defect. The following findings describe `main@71ccc24`, inspected before Jonathan supplied the open #437 candidate. Findings 1 and 2 are addressed by that candidate; see the revised brief for the remaining work and exact inspected references.

1. **Reachability.** [App.tsx](../../src/App.tsx) lines 6780–6834 renders PlanStudio for V2 and mounts KittyBanks only in the legacy fallback. A redesign confined to that old component would miss the active Plan destination.
2. **Unlinked planning.** [PlanStudio.tsx](../../src/PlanStudio.tsx) lines 113–118 creates generic goal-contribution lines without a goal reference/date. [planSystem.ts](../../src/core/planSystem.ts) lines 647–650 resolves actuals only from category expenses. Build needs goal-linked evidence, not another progress bar.
3. **Incomplete lifecycle.** [types.ts](../../src/core/types.ts) lines 749–768 supports open/retired/unfunded; goal edit, pause/archive/restore and safe removal are absent in the inspected command surface. The existing purchase path retires a full goal.
4. **Different kinds of money.** [goals.ts](../../src/core/goals.ts) derives savedCents from contributions, including legacy unbacked rows. [commands.ts](../../src/core/commands.ts) lines 4723–4770 funds with a recorded vault transfer; lines 8076–8132 create/release pool earmarks. Releases have no goal ID, so a remaining per-goal earmark balance cannot always be derived.
5. **Dependencies survive the screen.** Appointment savingGoalId, recurrence goalId, Fund allocation history, purchase/contribution receipts and future Plan references must remain valid after archiving. [householdFund.ts](../../src/core/householdFund.ts) lines 939–970 requires referenced Shared goals to exist and retains immutable allocations.
6. **Hercules needs the same evidence.** [herculesTools.ts](../../src/core/herculesTools.ts) lines 932–939 calls the legacy saved ratio “funded.” That wording is unsafe for unbacked records and bypasses the distinctions above.
7. **Calendar has competing signals.** [Calendar.tsx](../../src/Calendar.tsx) combines direction, kind, heat and member colour; its kindLabel fallback returns “Bill” for unhandled kinds such as a generic event. [worlds.css](../../src/theme/worlds.css), [page-calendar.css](../../src/theme/page-calendar.css), [calendar-boards.css](../../src/calendar-boards.css) and [styles.css](../../src/styles.css) overlap colour/type rules. Month cells can have very small labels. Measure actual computed styles before claiming contrast failure or success.
8. **Chat has mixed paint contracts.** [styles.css](../../src/styles.css) lines 1865–1960 contains fixed light/translucent turn backgrounds with inherited theme ink and small text. [worlds.css](../../src/theme/worlds.css) lines 1448–1460 themes the outer bubble/log but does not supply a complete turn-level foreground/background pair. This is a source-level risk; actual-page contrast remains unmeasured here.

## 3. Initial composition: future shelf (superseded)

This records the first design exploration. The revised direction is a complete interactive room with tangible cat-shaped envelopes and a useful internal app, described in the cinematic envelope brief linked above.

Retain **Kitty Banks** as the friendly name. The underlying object is a goal or reserve with purpose, identity, scope and evidence. It is not another financial account, a category, or a second ledger.

Three compositions were considered with Claude:

- A dense ledger list gives good comparison but makes every intention look like administration.
- A story stack gives meaning space but becomes long and makes funding mechanics hard to compare.
- A selected intention with a **Purpose and Money** detail gives one goal a human story and a precise evidence panel. Use that, with a quiet shelf for the other goals and a single consequential choice in the centre.

### Desktop opening

Keep the current app shell and scene. A narrow shelf lists active goals by name, purpose and next step. The main stage presents the selected goal: its name, why it matters, a grounded progress statement and one next decision. A right context area contains Money evidence and a contextual Hercules composer. History and provenance open progressively below, not as competing hero numbers.

When no decision is needed, show a calm next milestone or contribution rhythm. Do not manufacture an alert. The shelf order is stable; urgency may identify an item without secretly reordering it. Provide explicit manual prioritization in a later supported model, not a drag gesture that silently reallocates funds.

### Mobile opening

Lead with the selected intention and one action. A compact “All Kitty Banks” control opens a reachable list. Show Received / Reserved / Planned as labelled rows rather than shrinking three desktop panels. Money evidence opens inline; Hercules opens a context-preserving drawer. Return to the same goal, scroll position and draft after closing it. Reserve measured space for nav, Fund pull tab and Fund return chrome.

### Personal versus Household

Personal: “What do I want to make room for?” Private story, private source accounts, self-directed scenarios and individual edits. A Bridge preview deliberately selects the meaning offered to the household.

Household: “What are we building together?” Shared purpose, named contribution commitments, one open decision and exact-version acknowledgements where the new goal contract requires them. Acknowledgement status is separate from money readiness. A goal can be funded while an edit awaits agreement. A partner's private account balance or salary never fills a gap.

### One owner per object

Dedicated Kitty Banks/Goals owns purpose, target, milestone dates, goal history, lifecycle and contributions. Plan V2 references goal IDs and owns period intentions/scenarios. Calendar references dated intentions or real events. Fund owns pool earmarks. Accepted books own cash and spending. Hercules consumes the same typed evidence.

Near-term access: a contextual **Kitty Banks** action in PlanStudio Build opens the dedicated goal surface; existing goal entry points open the same object. Do not make the whole future four-destination household shell a prerequisite or quietly add a new permanent global tab. Long-term Our Path placement remains a separate shell decision.

## 4. Money language and foundation

Use distinct, source-linked facts. Never combine them into an unqualified “saved” number:

- **Planned this period:** intent in an identified Plan version. Draft, proposed, acknowledged and scheduled are distinct states.
- **Promised:** a separately recorded contribution commitment with person, amount/range, date/rhythm and agreement state. An AI suggestion is not a promise.
- **Reserved in the Fund:** an accepted earmark over the shared cash pool. Cash has not necessarily moved into goal savings. Show separately from contributions and remove it from spendable pool projections once, through existing authority.
- **Received in goal savings:** accepted contribution evidence with valid transfer backing and correction history. Legacy unsupported rows remain “Recorded previously — backing unverified.”
- **Spent toward this goal:** exact accepted purchase/transaction references attributable to this goal. Category similarity is not attribution.
- **Remaining backed goal money:** valid backed contributions less goal-attributed net outflows/releases, respecting scope, correction chains and other-goal reserves. Its label must disclose location; this is not a general safe-to-spend guarantee.

A single transfer can consume a pool reservation and fund a goal. Link both effects to one accepted operation/receipt and reduce the reservation; do not show both as additional wealth. Distinguish intent achievement from the goal's lifetime progress.

Reuse and extend #437's deterministic, scope-aware Plan evidence projection before expanding progress/coaching. Expose the goal-level location breakdown, source IDs, provenance/revision, date, correction relationship, confidence/backing status and unresolved attribution. Reuse the existing contribution/purchase records and goalVault validation. A new parallel calculator or database table is not presumed necessary.

Per-goal earmark release/reallocation requires an explicit event contract. Historical pool-level releases are unresolved attribution; show that limit and offer a reviewed resolution. Never invent a proportional distribution or assign by goal name.

Legacy migration preserves IDs, rows and totals. Existing unlinked Build lines remain unlinked until the owner chooses a goal; do not mutate immutable accepted Plan versions or use name-similarity backfills. A linking revision must follow Plan V2's version and acknowledgement rules. No fake “Needs Review” goal is created to carry money.

## 5. Complete goal journeys

### Create and edit

Start with “What is this for?” then purpose, amount or milestone, timing if known, and scope. A new empty draft is allowed without pretending it has money. Use defaults as editable suggestions. Additional story/milestones unfold after the initial intention. Changing money assumptions previews consequences.

Personal changes follow the personal intent contract. Material Shared goal changes use a proposed version and genuine acknowledgements once implemented; the UI must not imply such protection exists before the command layer supports it. Changing scope is a deliberate Bridge/copy-and-link workflow, never a toggle that leaks private history.

### Contribute and plan

Two verbs with different outcomes: **Plan a contribution** opens a goal-linked Plan draft; **Review contribution** uses the existing scoped amount/source review and Final Confirm. The goal view may open either directly without forcing an unnecessary navigation detour.

The review freezes amount, date, source, destination, goal ID, applicable earmark effects and source revision. Revalidate at confirmation. Pending sync is visible; unknown outcome uses receipt lookup/recovery, not another blind transfer. Dismissal and theme changes preserve the appropriate draft.

### Spend, partial use and reusable reserves

The existing fully-funded purchase-and-retire behavior remains the supported baseline. A complete redesign should support partial costs, reusable reserves, goal-to-goal allocation changes and purchases from eligible real accounts, but each requires a separately reviewed domain contract. Do not fake them with negative contributions or ordinary category matches.

### The X and removal

The visible X is subtle in weight, clear on hover/focus and always accessible on touch, with a 44px target and accessible name “Manage removal of [goal].” It opens a review showing money, linked obligations, Plan versions, pending actions and history.

- Unsaved local draft: discard it, with recoverability appropriate to the editor.
- Accepted goal: **Archive** is the default; retain the stable identity and receipts. Do not hard-delete persisted goals in the first implementation.
- Funded goal: explain where cash remains. Archiving is not a refund or transfer. A separate reviewed action can release an earmark or move cash when its real command is supported.
- Archiving preserves the goal's reservation against vault capacity and accepted Fund earmarks until a separate reviewed release/reallocation succeeds. Current goalVault allocation uses openGoals, so adding an archived status without adapting reservation calculations could silently expose its money to another goal. Restore never recreates a reservation that was already released.
- Active recurrence/appointment/Plan links: list consequences and provide explicit decisions. Do not silently cancel bills, restart schedules or rewrite accepted Plans. Block archival when required dependency handling is unresolved.
- Shared material cancellation: use a goal proposal and acknowledgement contract, separate from any financial Final Confirm.
- Restore: returns the goal to active visibility; it does not revive old contribution promises, reminders, recurring transfers or stale approvals. Offer a fresh planning review.

If a future Delete action is introduced, zero savedCents is insufficient eligibility: no accepted history, Fund references, appointments, recurrences, Plan references, pending operations or external links must remain. Archive is enough to satisfy clean removal from the active experience while retaining truth.

### Recovery and unusual states

Provide intentional designs for zero goals, one goal, many goals, long titles, small/large amounts, unknown timing, unbacked legacy records, target lowered below funding, overshoot, archived-with-money, linked appointment, incomplete earmark attribution, stale review, failed sync, pending receipt, scope switch and offline return. Distinguish “we have not contributed lately” from “source information is out of date.” No inactivity timer creates a false financial warning.

## 6. Calendar: consistent meanings inside different worlds

Use three independent channels:

- **Kind:** a stable semantic colour family plus icon and plain label. Incoming money = deep green / incoming arrow; bills and required outflow = ink-blue / receipt; potential costs = amber / outline receipt; work = plum / briefcase; goals = teal / flag; life events = neutral / calendar. “Red means overdue/problem” is reserved for a real actionable state, not every bill.
- **Person:** name/initials and an explicit “Household” label. Optional avatar colour supplements identity and does not determine the event's kind.
- **State:** text such as Planned, Expected, Posted, Due, Pending or Needs review, with consistent icon/line treatment. A future planned item is not Posted. A generic event is not a Bill.

Keep meaning consistent across all six Calendar scenes. Tune each semantic foreground/background pair for actual contrast. Themes control the paper, environment and furniture, not whether a colour means salary on one page and danger on another.

Desktop month view supports short kind labels and a compact legend. Phone month view uses readable kind marks/counts and opens the full agenda; do not shrink essential information to fit a miniature desktop. The agenda shows title, kind, person and state in text. Hidden entries and totals preserve existing filter semantics. Separate cash-pressure heat from item kinds; never let a heat tint obscure labels.

Use one typed kind/state mapping for month, agenda, upcoming, planning board, chips, legends and Hercules references. Unsupported future goal milestone/commitment events require real projection support; a legend must not imply they already exist.

## 7. Hercules: readable in normal mode, comfortable in easy read

Normal mode must already meet contrast and legibility requirements. Define complete opaque foreground/background pairs for assistant turns, user turns, source citations, form fields, action reviews, errors, disabled controls and code/links in every scene. Avoid white/translucent bubbles inheriting pale night-theme text.

Use a stable readable body font, 16px message/composer baseline and comfortable 1.5 line height; themed display typography stays in headings. Left-align long messages and user turns. Do not choose random fonts from background colours or change typography mid-conversation.

**Easy read**, discoverable in the chat header and Appearance, increases text/spacing, uses the same predictable sans-serif, simplifies surfaces and suppresses local decorative motion. Proposed baseline 18px, line height 1.6, strong text contrast. Persist per person through the existing preference approach if supported; label device-only persistence honestly if that is the initial scope. Never reset it on theme change.

Desktop: a stable dock, scrollable conversation and permanently visible composer. Mobile: a context-preserving drawer with keyboard-safe composer and Fund/nav clearance. Error/retry messages remain inline and reachable. Theme or mode changes preserve scroll, draft, review identity and focus.

One editable review per action. “Draft,” “Waiting for acknowledgement,” “Final Confirm,” “Saving,” and receipt/recovery stay distinct. Easy read reflows the same authority and content; it does not remove evidence or confirmations. Private conversations remain private in Household contexts.

## 8. Authored scenes in every slice

Classic: pinboard shelf and paper planning folio; a warmer communal tabletop for Household, quieter personal notebook for Personal. Calendar remains the wall calendar. Desktop uses margin objects and a broad decision stage; phone uses paper tabs and a compact vertical reading order.

Taylor: **Goals/Plan Household Fearless**, warm gold and handwritten margin details with solid reading panels; **Personal Debut**, botanical blue/green notebook with private annotations. **Calendar Household Red**, autumn paper; **Personal Midnights**, dark navy surfaces with paired pale ink. Artwork must follow official era references at implementation time. Never mix the calendar era into the goal surface just because they share a component.

Newfoundland: **Goals/Plan Household coastal Signal Hill approach**, route and horizon around the purpose stage; **Personal windswept summit**, a quieter field notebook. **Calendar Household rainy St. John's**, window-and-paper schedule; **Personal Cape Spear morning**, open light and clear agenda. Use places as composition cues, not geographic claims or arbitrary repeated landscapes.

All twelve theme/device/ledger combinations share facts and handlers but differ in authored composition and language. No later “skin all themes” phase. Every new flow includes its three worlds, mobile/desktop behavior and applicable scopes from its first coherent slice.

## 9. A fictional decision to design around

“A weekend away” has an $1,800 CAD target, $650 in verified goal savings, $200 separately reserved in the Fund, and a $150 contribution proposed for next pay. Nothing has been spent. The proposal is not added to money received. The pool reservation is not described as a vault transfer.

The couple explores increasing next pay's proposal to $300. The scenario shows the extra $150 and the specific planning area that would provide it; it cannot claim rent remains protected until the current coverage calculation proves it. Comparing or saving this draft changes no accepted cash, no recorded contribution and no partner acknowledgement. Shared acceptance binds the exact Plan version; actual funding follows a separate reviewed financial action.

The interactive concept accompanying this brief uses fictional values only. It illustrates decisions and visual hierarchy; it is not an accounting calculator or a certificate of implemented behavior.

## 10. Dependency-ordered build packets

The revised cinematic envelope brief supersedes packets B–F and makes #437 the projection/linkage foundation. They are retained below as the initial audit trail, not a current instruction to duplicate that work. Packet A's Calendar/chat requirements remain independent and applicable.

**A — Calendar meaning and chat reading foundations (Medium, independent of goal domain work).** Claude owns scene compositions, tokens and reachable states; Codex owns existing-component integration and verification. One shared semantic calendar mapping; complete chat surface pairs; easy-read preference. Validate all scenes and nested reviews. These can be scoped as separate PRs with narrow ownership of shared CSS.

**B — Goal evidence projection (High).** Codex owns typed facts and backing/correction/privacy rules. Reuse goalVault/contributions/purchases. Return truthful held/spent/promised/earmarked/unresolved facts; replace Hercules “funded” overstatements. Independent money/privacy reviewer required.

**C — Goal identity and lifecycle (High).** Design stable archive/restore, dependency preview and goal version/acknowledgement contract. Add narrow command vocabulary, replay/materialization, scope validation and recovery. Preserve archived goals' backing in vault capacity and Fund reservation calculations; restore cannot recreate released reservations. Goal-specific earmark release/reallocation is an explicit dependent contract, not a UI subtraction. No hosted migration is assumed or applied by this packet.

**D — Goal-linked Plan/Calendar/Hercules (High).** Add source references and due dates to Build, match accepted goal contribution evidence for intent outcomes, retain immutable accepted versions and reconcile pending/changed sources. Contextual open/return works from Plan, Calendar, Fund and Hercules. Preserve unlinked legacy intentions without guessing.

**E — Dedicated Kitty Banks experience (Medium-High presentation over B–D).** Claude supplies one implementation for all twelve compositions and state journeys; Codex integrates the selected goal stage, shelf, editors, context dock, removal review and recovery through existing App authority. One writer per checkout. No new generic model dispatcher.

**F — Advanced goal behavior (High, after the first lifecycle is proven).** Partial purchase, reusable reserve, explicit allocation changes and funding-source flexibility. Decide the financial semantics before exposing controls. Keep current vault history valid; do not fabricate a bank institution or infer real accounts.

**G — Comparative acceptance and scoped release.** Test ordinary complete journeys and uncomfortable states against the baseline. Merge/deploy require Jonathan's separate explicit release instruction; Production/schema activation stays separately scoped.

Packet return must contain exact base/head, changed behavior/files, decisions versus assumptions, three-theme phone/desktop screenshots, focused command results, money/privacy/recovery evidence, risks and next owner. Re-fetch current main before implementation: this document is a baseline, not a guarantee that code is unchanged.

## 11. What “better than YNAB” must prove

YNAB already provides [targets](https://support.ynab.com/how-to-use-targets-rk5kkI9ks), [target snoozing](https://support.ynab.com/en_us/snooze-a-target-HyS4E5rZT), [Money Moves](https://support.ynab.com/moving-money-in-your-plan-ryyCKbBJi) and [Wish Farm guidance](https://www.ynab.com/guide/how-to-save-money), checked 2026-09-11. These are the baseline, not new Hearth inventions.

The proposed advantage is answering “Can we make room for this together?” while preserving personal agency, showing timing and evidence, keeping commitments distinct from cash, and making the next decision understandable. This is a hypothesis to test.

- Five-second comprehension: correctly identify the goal, actual held money, proposed amount, scope and next action.
- Explain the effect of an extra $150 contribution and its source without mistaking the scenario for a transfer.
- Create a private intention and share only a chosen contribution; partner cannot see the private account or conversation.
- Remove/archive a funded linked goal, then restore it; receipts remain and schedules do not silently resume.
- Read kind/person/state in a mixed Calendar in colour and grayscale, without mistaking an expected payment or potential cost for spending.
- Read and edit a Hercules action in every scene, toggle easy read, return from mobile keyboard and resume with draft/focus intact.
- Compare the same representative goal tasks with YNAB using completion, errors, comprehension and perceived effort. No unsupported superiority score.

Implementation checks: relevant focused tests in goal-funding-scope, goal-fill-ui, goal-purchase-ui, ask-goal-move and plan-system; new command/replay and unresolved-attribution tests where behavior warrants them. Use the recorded quick gate with a real focus/reason, e.g. `pnpm test -- --risk=high --focus=test/goal-funding-scope.test.ts --focus-reason="prove scope and backing invariants for the goal change"`, followed by the required build and actual-page checks. Exact focus must match the implemented slice. Do not run the exhaustive gate without the separately required request.

Visual evidence: all applicable combinations at 320/390/719/720/1100/1440/1920px, top/middle/bottom and nested flows, 200% text/zoom, keyboard and visible/restored focus, 44px controls, long amounts, no overflow, reduced motion and pause. Target WCAG AA contrast (4.5:1 body, 3:1 large text and necessary non-text controls); easy-read body target 7:1. Measure computed foregrounds against actual backgrounds. Browser proof does not certify physical devices, VoiceOver or authenticated two-device continuity.

## 12. Claude use and integration review

Actual consultation: [Redesigning Hearth's Kitty Banks, Calendar and Chat](https://claude.ai/chat/06725790-8210-473f-9cdf-4b5ad3b62ec5). Existing Sonnet 5 Medium settings were retained. One compact design brief, followed by one narrowly bounded correction from the completed code audit. No repository dump, real financial data, credentials, uploads or private chat history were sent.

Useful first-pass ideas: separate purpose from evidence, legible available-versus-promised, contextual detail, accessible removal review, normal/easy-read modes, and independent calendar meaning channels.

Codex corrections: reuse existing contributions; accepted earmarks are not pending confirmation; savedCents minus category spending is not verified availability; do not introduce a second ledger; no name-similarity migration; no hard deletion based only on zero contributions; no forced Plan detour to contribute; no hue-only ownership; preserve page-era mappings; include all themes in each slice. Final synthesis must remain consistent with these corrections even where Claude's original text differs.

The second response improved the next-step composition and direct review journey. It still proposed subtracting pool earmarks from vault contributions, implicitly pausing links on archive, and a Newfoundland scene divergence. Those suggestions are rejected: the two locations stay distinct, dependencies require explicit decisions, and Personal retains the summit scene. Claude is a design contributor, not the money authority. The independent final brief review also caught the archived-vault-reservation hazard; that requirement is incorporated above.

## Delivery state

Design proposal, code audit and fictional concept only. No app changes, financial writes, schema application, PR, merge or deployment. No test suite or actual-page accessibility certificate is claimed for a documentation deliverable. The next implementation owner must use the revised cinematic envelope brief and its #433/#437 integration sequence after verifying current main; Jonathan retains product and release decisions.
