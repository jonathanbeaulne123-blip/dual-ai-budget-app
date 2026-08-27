# The Onboarding Update

> **Status:** Parts 1–2 planned; D-128 scenario safety and D-129 motion/interaction direction locked. See [Part 2 storyboard](ONBOARDING_PART2_STORYBOARD.md).
> **Household outcome:** Bianca signs into the household with Google, meets Hercules, learns Hearth by doing a short set of real or safely simulated household jobs, brings the books to a truthful current starting point, and can replay or skip any lesson.  
> **Scope boundary:** no hosted migration, Auth/RLS policy, Production mutation, deployment, or real household posting is authorized by this plan.

## 1. Product definition

This is not a splash screen and not a long tooltip carousel. It is a modular, Hercules-led tour of the real phone and desktop product.

The update has four parts:

1. **Planning and review** — inventory every control family and feature; locate dead, gated, misleading, legacy, and unfinished surfaces; choose the Bianca journey; draft Hercules copy; research strong onboarding patterns.
2. **Animation and interaction planning** — [locked storyboard](ONBOARDING_PART2_STORYBOARD.md) for phone and desktop movement, focus, callouts, user actions, skip/resume/replay, and failure recovery. D-129 deliberately refuses a reduced-motion substitute for onboarding; do not claim that gate as passed.
3. **Onboarding foundation** — add a member + household + environment-scoped tutorial engine, Google first-entry eligibility, modular chapter registry, safe scenario state, progress persistence, analytics-free event hooks, and accessibility primitives.
4. **Experience implementation** — build the animations and interactions, wire the approved real scenarios through existing commands, verify phone/desktop/accessibility/offline behavior, and automatically begin after the first eligible real Home render with one persistent Skip action.

The architecture must make a later lesson, feature, prompt, interaction, or animation an additive registry entry whenever possible. Tutorial sequencing must not be scattered through page components.

## 2. Verified Part 1 baseline

### What was examined

- Current merged application at `main@44156f9`, including D-127 job and shift workflow.
- Phone UI at 390 × 844 on a local Development household as both Jonathan and Bianca.
- Wide Office DOM and controls.
- `src/App.tsx`, all page components, all Office instruments, Hercules page/instrument copy, current first-run lesson storage, Office intent routing, and motion/reduced-motion CSS.
- Static button scan: **309 literal `<button>` elements across 41 TSX files**. Repeated calendar days, keypad digits, account/category choices, game cells, and dynamic rows are treated as control families below rather than hundreds of duplicate tutorial decisions.
- Existing unit/integration coverage for commands, books, Office/mobile, dialogs, shifts, continuity, Hercules, appointments, statements, and conflicts.

### Wiring verdict

Every literal button either has an action/submit path or, in Hercules's case, pointer/gesture handling. The scan found no obvious rendered `<button>` that is simply inert.

That does **not** mean every control is onboarding-ready:

| Finding | Verified state | Onboarding consequence |
|---|---|---|
| Hercules first-run lessons | `src/core/lessons.ts` stores a flat seen-id list in device `localStorage`; page help consumes it. It is not member/household/environment cloud progress and has no chapter, skip, resume, or replay model. | Reuse the copy ideas, replace the progress architecture. |
| Opening truth | Accounts can be opened, but there is no guided multi-account current-balance command or onboarding flow. | Must be built as the accounting centre of the update. |
| Google Calendar setup | **Write reminders to Google** can appear enabled when the client ID is unavailable; connection buttons correctly disable. | Repair before it can be taught. `.ics` remains a valid fallback lesson. |
| Google suite toggles | Drive has real desk/sit-down use; Contacts, Gmail, and Sheets are mostly permission/capability preparation rather than complete Bianca workflows. | Exclude unfinished services from the main tour. |
| Cloud/pairing copy | Books and Invite still contain one-phone / explicit-Publish language that contradicts accepted Google-account cloud continuity. | Rewrite before onboarding; never teach Publish as the normal path. |
| Phrase, Pass, manual Publish | Working legacy/recovery controls remain visible. | Put in optional recovery help, not the first-run showcase. |
| Personal ledger privacy | UI truthfully says the view is currently a filter, not a lock, until the security cutover. | Teach what Personal means functionally, but do not promise privacy before the cutover. |
| Advanced books tools | SQL, raw journal, export, close/reopen, and reconciliation are wired. | Keep available; do not overload Bianca's first session. |
| Games/cosmetics/desk editing | Functional and appealing, but do not advance current balances or the September trial. | One optional delight chapter after the core tour. |

## 3. Every control family: disposition for the tutorial

Legend:

- **Feature** — central guided action Bianca performs.
- **Spotlight** — Hercules points and explains; Bianca may tap.
- **Context** — teach later at the moment it becomes useful.
- **Exclude** — keep in the app, but do not feature in first onboarding.
- **Repair first** — do not teach until the named problem is fixed.

### Entry, identity, and persistent shell

| Control family | What it does now | Disposition |
|---|---|---|
| Continue with Google | Discovers Development household memberships and personal scope when configured. | **Feature.** This is the normal door. |
| Open discovered household | Opens a matching cloud replica as the matched member. | **Feature.** This is the onboarding eligibility boundary. |
| Create household / demo / phrase-or-pass entry | Creates, demos, or joins through legacy recovery paths. | **Context.** New-household onboarding later; demo and phrase are not Bianca's normal entry. |
| Member choice during legacy entry | Selects who this device represents without Auth. | **Exclude** from Bianca's Google path. |
| Household / Personal ledger buttons | Switch the visible ledger scope. | **Feature.** Explain Shared versus Bianca's Personal clearly and honestly. |
| Multi-household ledger selector | Switches among cloud/local replicas. | **Context** after a second membership exists. |
| Development pill | Shows the active environment. | **Spotlight** briefly: September is a trial; Production remains separate. |
| Bottom navigation: Home, Cal, Shift, Add, Plan, Books, More | Main phone routes (D-152). | **Feature.** Teach the map once, then navigate by doing. |
| Command chip/banner/toast actions | Shows saving, sync, conflict, recovery, and undo states. | **Context.** Explain when a real state appears; never manufacture a success state. |

### Home — phone

| Control family | What it does now | Disposition |
|---|---|---|
| Post / Due / Close stamps | Jump to Add, Calendar due work, and Plan/sit-down. | **Spotlight.** Three household rhythms in one breath. |
| Month net | Opens the blotter projection. | **Feature.** Teach that it is income minus expense, not bank balance or leftover. |
| Pad | Expands quick Add. | **Feature.** Bianca posts a familiar transaction here or through the centre Add button. |
| Shifts | Expands Timesheet. | **Feature** if Bianca has a job configured; otherwise chapter stays available but incomplete. |
| Jars | Opens goal progress and purchase flow. | **Spotlight** after balances, not before. |
| Pin buttons / drawer count | Keeps selected instruments open or reveals parked ones. | **Exclude** from core; optional customization lesson. |
| Chalkboard save, expand, delete, shrink | Keeps household notes; never posts money. | **Spotlight** as delight, not setup. |

### Home — desktop Office

| Control family | What it does now | Disposition |
|---|---|---|
| Sill figures | Open the relevant Office instrument. | **Spotlight.** Hercules can physically lead Bianca from figure to source. |
| Instrument headers | Expand/collapse Blotter, Calculator, Wallet, Accounts, Calendar, Appointments, Mail, Claims, Timesheet, Accessories, Postcard, Cook-off, Jars, Lamp, and games. | **Feature subset only:** Calculator, Wallet/Accounts, Calendar, Timesheet, Lamp. Others become optional chapters. |
| Instrument pin | Keeps a selected instrument open. | **Exclude** from core. |
| Edit desk / Desks / Home theme / Drawer / Straighten | Resize, hide, restore, theme, apply personalities, or repack the Office. | **Optional delight chapter.** Strong showcase, weak first-number value. |
| Tic-tac-toe / Hangman controls | Household games with no CAD. | **Optional final reward**, never required. |

### Hercules

| Control family | What it does now | Disposition |
|---|---|---|
| Tap Hercules / How can I help | Opens page-true grounded help and chips. | **Feature.** The tutorial host and permanent replay entry. |
| Double-tap to sit | Pins/sits Hercules and plays the bag interaction. | **Spotlight** during the welcome. |
| Drag / wander / perch / bump / pounce | Existing companion movement around furniture. | **Feature animation vocabulary** for Part 2; never block the target. |
| Suggested question chips | Ask grounded questions and may navigate/expand a surface. | **Spotlight** after the first guided action. |
| Typed chat / Send / OK | Grounded on-device answer or bounded model voice. | **Context** after deterministic tour copy. Tutorial scripts must not depend on a model response. |
| Save as preset / Not now | Accepts or dismisses a detected repeated merchant proposal. | **Optional feature** after Add is understood. |

### Add and Confirm

| Control family | What it does now | Disposition |
|---|---|---|
| Expense / income / shift / transfer | Chooses typed command flow. | **Feature:** expense and transfer in core; shift in work chapter; income contextual. |
| CAD keypad digits, `00`, delete | Enters integer CAD cents. | **Feature.** Hercules explains “digits are cents” while Bianca performs it. |
| Milk / Coffee / preset chips | Prefills common lines. | **Feature** with a household-relevant choice. |
| Category choices | Select the budget meaning of income/expense. | **Feature.** Explain account versus category. |
| Joint / member / Split % | Selects ownership/visibility allocation. | **Feature** for Joint versus Personal; split percentage becomes contextual. |
| Account selector | Chooses where money landed or left. | **Feature.** Tie directly to current balances. |
| Note | Adds searchable human context and powers category suggestions. | **Spotlight.** Optional, not required. |
| Save/Forget preset | Changes catalog only; does not post money. | **Context** after repeated use. |
| Date & place / Shared-Personal-Both / location stamps | Edits civil date, storage view, and optional phone stamps. | **Context.** Date/visibility matter; location stays optional and out of core. |
| Post / duplicate Add anyway / Cancel / Close | Opens the real validation and Confirm boundary. | **Feature.** The most important lesson: only Confirm changes the books. |
| Transfer From/To | Moves value without income or spending. | **Feature scenario:** pay a card or move to savings. |
| Shift Clock in / Already off / Sign out / Never mind | Starts, finishes, or abandons a non-money punch. | **Feature** in the work chapter. |

### Calendar, bills, appointments, and settlements

| Control family | What it does now | Disposition |
|---|---|---|
| Month / Appointments / Bills / Google | Selects Calendar workspace. | **Spotlight.** Focus the chapter on Month + Bills + work settlement. |
| Previous/next month and day cells | Navigates dates and selects a day. | **Feature** with today's real board. |
| Open plan / Mark due paid | Moves to planning or reviews all due items. | **Feature** once opening truth is complete. |
| Calendar row Paid/Post/Confirm | Opens a real command or paycheck/tip settlement review. | **Feature.** Use a safe real due item or a clearly isolated practice item. |
| Appointments Upcoming/Owed/Log/Add and visit cards | Tracks visits, claims, reimbursements, and CRA medical reporting. | **Optional showcase**; valuable but too much for the required first session. |
| Claim Submitted/Landed/Denied | Advances claim state or posts settlement/write-off after Confirm. | **Context** when a claim exists. |
| Start this jar | Creates a proposed visit goal only after a human tap. | **Optional spotlight.** Great Hercules boundary example. |
| Add repeating / type / cadence / Save / Cancel | Creates or edits bills, income, or transfer reminders. | **Feature** for one September bill. |
| Adopt / Not a bill | Turns detected ledger rhythm into a reminder or dismisses it. | **Optional showcase.** |
| Edit / Skip once / Pause / Resume / Mark paid | Maintains a repeating item and posts only through review. | **Spotlight** after adding one bill. |
| Google Connect / reminders / `.ics` | Links Calendar or writes/downloads reminders. | **Repair first** for missing-config enabled state; then optional. |

### Plan, budget, sit-down, and goals

| Control family | What it does now | Disposition |
|---|---|---|
| Category actual/budget rows | Shows plan versus posted truth. | **Feature.** Hercules explains that the journal is actual; budget is a plan. |
| Sit-down fact cards and Then the books | Reviews positives and proceeds through the monthly ritual. | **Spotlight** now; full three-act sit-down becomes a later contextual lesson. |
| Back / Assign leftover / allocation mode / Pause / Copy jobs / Confirm moves / standing orders | Runs the complete sit-down and transfers leftover after Confirm. | **Context** at month end, not first login. |
| Download/Drive workbook and Lock/Reopen month | Exports and closes a period. | **Exclude** from first onboarding; advanced month-end chapter. |
| Start jar / contribution / Add shared goal / Purchased? | Creates and funds goals, then posts a purchase from the vault. | **Optional showcase** after balances are truthful. |

### Books, Accounts, and Audit

| Control family | What it does now | Disposition |
|---|---|---|
| Story tiles: net worth, chequing, goal savings, cards, investments | Opens the wallet and teaches the accounting story. | **Feature.** This is the payoff after opening balances. |
| Wallet account tiles | Opens an account room. | **Feature.** Bianca verifies each current balance here. |
| Pay/Add/Post interest/Rewards/Deposit/Move/Contribute/Mark/Archive | Executes or drafts account-specific actions. | **Feature subset:** pay card, add on account, savings move. Others are contextual/advanced. |
| Open account kinds and account form | Adds chequing, savings, credit, investment, other, or receivable. | **Feature** inside opening-truth setup. |
| Wallet / Activity / Journal / Trial balance / Statements / Reconcile / Close pack / Chart / Ask | Selects books and Audit panes. | **Spotlight:** Wallet, Activity, Statements, Reconcile, Ask. **Exclude:** raw journal, trial, close pack, chart until advanced chapters. |
| Include/Exclude duplicate and Reverse | Adjusts duplicate recognition or posts a reversal. | **Feature:** demonstrate correction/reversal; duplicate control stays contextual. |
| Record rec / Close / Reopen / downloads | Performs reconciliation, close, reopen, and export. | **Context/advanced.** |
| Ask chips / Ask | Answers deterministic book questions. | **Feature.** One grounded question shows off the ledger. |
| Power SQL / Run query | Read-only expert console. | **Exclude** from Bianca onboarding. |

### More, work, device, recovery, and global dialogs

| Control family | What it does now | Disposition |
|---|---|---|
| Health findings | Shows ledger integrity and adult next actions. | **Feature.** End the core tour on a clean, understandable Health result. |
| Recent changes / Undo | Shows command history and current undo semantics. | **Feature** after a practice correction, with exact Development/Production wording. |
| Share phrase/link, Pass, Publish, pull, stop sharing, join/import | Legacy invitation, recovery, and manual transport actions. | **Exclude** from core; recovery chapter only. **Repair cloud copy first.** |
| Google service On/Off, confirm identity, sync | Manages identity and optional Google scopes. | **Feature:** identity only. **Exclude:** unfinished services. |
| Add/Edit/Archive job, roles, rates, tip-outs | Configures work rules without posting money. | **Feature** before the shift scenario. |
| Timesheet start/break/clock out/review/discard/timeline choice | Records a punch, resolves competing device timelines, and opens shift Confirm. | **Feature.** |
| Shift history Correct / expand and Work report filters/export | Keeps immutable correction history and reporting. | **Spotlight** after the shift posts. |
| Member switch | Changes the legacy local actor. | **Exclude** from Google onboarding. |
| Clock zone and location controls | Changes this phone's display zone and optional stamps. | **Context** only. |
| Export/reload demo/post due/reset | Development/recovery actions. | **Exclude** from core; destructive/reset never becomes a playful tour action. |
| Add category | Adds a category and optional budget through Confirm. | **Context** when Bianca cannot find the right meaning. |
| Conflict Keep phone/Keep cloud/Export both/Dismiss | Resolves a real stale-write bundle. | **Context only when conflict exists.** Never stage a fake cloud conflict in the live ledger. |
| Due preview Not now/Review/Review all | Defers or reviews due items. | **Spotlight** if it naturally appears. |

## 4. Recommended Bianca journey

The first eligible session automatically starts the core guided sequence after real Home renders. One persistent **Skip tutorial** action exits at a safe boundary, and **More → Replay tutorial** starts it again. Optional showcase chapters remain modular content but do not add a chapter picker to first-entry chrome.

### Core path — approximately 8–12 minutes

1. **Welcome home** — Hercules emerges from his paper bag, introduces himself, and explains that he points but never posts.
2. **The two books** — show Household versus Bianca's Personal ledger and the Development trial label.
3. **Bring the books to today** — choose a Toronto as-of date, verify/add real accounts and debts, enter current balances, preview a balanced Opening equity entry, then Confirm once.
4. **Read the wallet** — Hercules walks from Books story tiles to the account rooms and asks Bianca to verify the result.
5. **Post one ordinary thing in Practice** — use the CAD pad, category, ownership, and account; finish a realistic Practice review without touching the books.
6. **Correct it safely in Practice** — show reversal/correction semantics without pretending history vanished or writing a journal row.
7. **Put September on the board** — add one real repeating bill and show where a paycheck/tip confirmation will appear.
8. **Set up work** — add Bianca's real job settings, simulate a four-hour Practice shift, and review wages/tips/tip-outs without posting it.
9. **Ask the books** — ask one deterministic question, such as the selected card balance or groceries.
10. **Finish clean** — open Health, explain sync/continuity, and leave a short “ready for September” checklist.

### Optional showcase chapters

- Chalkboard and Hercules presence.
- Jars and a visit-proposed goal.
- Appointments/claims.
- Desk personalities, Home themes, Drawer, and Straighten.
- Presets and rhythm detection.
- Sit-down, reconciliation, close pack, and month lock.
- Games and cosmetics.
- Recovery/export/Pass.

## 5. Hercules script draft for Jonathan's review

These are deterministic reviewed lines. The model may not improvise accounting instructions during onboarding.

| Moment | Draft line |
|---|---|
| Welcome | “Bianca. Finally. I’m Hercules. I read the books, point at useful things, and keep my paws off Confirm.” |
| Skip choice | “I’m showing you the kitchen. If you’ve seen enough of my magnificent route, Skip sends me back under More.” |
| Navigation | “Six doors. Home is the counter. Calendar is what’s coming. Add is what happened. Plan is the intention. Books are the proof. More is where we inspect the pipes.” |
| Household vs Personal | “Household is ours. Personal is yours. Same cat, different page. For now that button is a view, not a vault door.” |
| Opening truth | “No archaeology. Tell me what the accounts hold on this date. The other side is Opening equity — where the story begins, not pretend income.” |
| Account | “This is an account: where value sits or what we owe. Groceries is a category: why value moved. Different jobs.” |
| CAD pad | “Tap the digits like cents. One-two-five-zero is twelve dollars and fifty cents. Tiny keys can go nap.” |
| Confirm | “Everything above is a draft. Confirm is the human paw print. I do not press it.” |
| Success | “Landed once. The journal and the wallet agree. That is the whole trick.” |
| Correction | “We do not erase the old footprint. We reverse it, then post the right one. The trail stays honest.” |
| Transfer | “Card payment is a transfer. Debt down, chequing down. Not a second expense. Very important. Mildly elegant.” |
| Calendar | “Dates remind. Paid writes. A bill on the board is not money until you review and Confirm.” |
| Job setup | “Teach the job once: role, wage, paydays, tips, and where the money lands. Timesheet remembers.” |
| Clock in | “Clocking in starts a timer, not income. We count first. You Confirm after the shift.” |
| Shift review | “Hours made wages. Tips came before tip-outs, then after. Check the destinations. Formulas may work; you still decide.” |
| Books | “Wallet is the object. Activity is the story. Statements are the summary. If a pretty number disagrees with the journal, the journal wins.” |
| Ask | “Ask me a number. I quote the books. Ask me to post, and I become extremely unavailable.” |
| Health | “Clean means the books agree with themselves. It does not mean life is perfect. It means we know what we’re looking at.” |
| Continuity | “Once the cloud has it, no phone has to babysit the ledger. Offline work waits its turn and travels when the door opens.” |
| Finish | “Accounts current. September on the board. Work ready. You can use the kitchen now — and replay any chapter when I’ve been too handsome to follow.” |

## 6. Research conclusions

The recommended Hearth pattern is a hybrid of an optional guided checklist and contextual learning-by-doing:

- [Apple's onboarding guidance](https://developer.apple.com/design/human-interface-guidelines/onboarding) says onboarding should be fast, fun, optional, interactive, close to the interface it explains, replayable later, and should postpone nonessential setup. Hearth follows this with a short core and optional chapters.
- [YNAB's current onboarding](https://support.ynab.com/en_us/ive-noticed-a-next-step-add-account-or-assign-money-banner-or-prompt-rkfGeLTwgx) uses a guided setup/checklist. Its mobile product keeps the rest of the app available, which is preferable to hiding Hearth features until a tour is finished.
- [YNAB's start guide](https://www.ynab.com/guide/the-ultimate-get-started-guide) emphasizes real current accounts and current money, not invented future income. Hearth keeps the useful “start from now” principle but uses balanced Opening equity instead of envelope semantics.
- [Finch's new-user guide](https://help.finchcare.com/hc/en-us/articles/42149821015693-New-User-Guide) gives a few starter goals and immediately ties the companion to a real first action. Hercules should likewise participate in actual Hearth jobs rather than narrating screenshots.
- [Actual Budget's starting-fresh guide](https://actualbudget.org/docs/getting-started/starting-fresh/) recommends a recent start date, current balances, and limited history. Hearth should not force historical reconstruction before the September trial.
- [Duolingo's stated method](https://investors.duolingo.com/static-files/f19d76fb-dee4-4f13-96ae-138ebfd0f2d3) centres interactive, bite-sized learning-by-doing. Hearth should teach one concept per action and return Bianca to the real product quickly.
- [W3C guidance on animation from interaction](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html) recommends a way to disable nonessential motion. Existing Hearth motion observes `prefers-reduced-motion`, but D-129 deliberately requires full onboarding motion without an equivalent static state. Keep this named as accessibility debt; do not falsely claim conformance.

Rejected patterns:

- A compulsory full-app tour before the ledger opens.
- A dimmed screen with paragraph tooltips over every button.
- Fake success, fake money, or a model-generated tutorial command.
- Hiding advanced features until onboarding completes.
- Replaying the tutorial every time a new device logs in after the same member already completed it.
- Unskippable animations, parallax, or a moving Hercules that blocks the target.

## 7. Architecture direction for Parts 2–4

Use a declarative chapter registry:

```ts
type OnboardingChapter = {
  id: string;
  version: number;
  eligibility(context): boolean;
  steps: OnboardingStep[];
  completion: "viewed" | "acted" | "confirmed";
  canSkip: true;
};

type OnboardingStep = {
  id: string;
  route?: "home" | "calendar" | "add" | "plan" | "ledger" | "more";
  target?: string;
  herculesLine: string;
  pose?: string;
  action: "explain" | "tap" | "input" | "preview" | "confirm";
  safety: "no-write" | "draft-only" | "real-confirm" | "practice";
};
```

Required seams:

- Stable `data-onboarding-id` targets instead of CSS-position guesses.
- A single coordinator that can navigate, call the existing `OfficeIntent` expand/bump/collapse system, place Hercules, and focus the target.
- Deterministic copy in versioned content modules, not model-only text.
- Progress keyed by environment + household + Google member, with device-specific completion only for phone/desktop layout lessons.
- Resume from the last safe step; never resume halfway through a money confirmation.
- One persistent Skip tutorial action, replay in More, safe-step resume, and no extra chapter/settings chrome. D-129 deliberately requires full onboarding motion even when the device requests reduced motion.
- Practice state visibly separate from real books. Real writes still use current commands and existing Confirm.
- A feature can register a future chapter without modifying the tutorial engine.

## 8. Locked scenario rule — D-128

Jonathan approved the recommended real/practice split on 2026-08-25:

**Rule:** opening balances and any facts Bianca says are real use the real command + Confirm path. Demonstration-only transactions and shifts run in an unmistakable temporary Practice kitchen and are discarded at chapter end. A practice item can be copied into a real draft, but never silently promoted.

Practice activity must not enter journals, cloud continuity snapshots, reports, streaks, or onboarding progress that claims real money was accepted. Copying practice into a real draft is an explicit user action; the copied draft still passes the ordinary review and Confirm boundary.

This decision unlocked the [Part 2 storyboard](ONBOARDING_PART2_STORYBOARD.md). D-129 now locks its motion and interaction model. The remaining copy remains editable through semantic tone variants rather than hard-wired one-audience jokes.

## 9. Acceptance gates

Jonathan approved the Part 1 direction and D-128 safety model. The following remain editable content, not blockers to the Part 2 architecture:

- featured, contextual, excluded, and repair-first control dispositions;
- the core and optional chapter lists;
- Hercules tone/scripts;
- ~~the real-versus-practice scenario rule~~ — approved as D-128.

The complete update is not ready until:

- first eligible Google household entry automatically begins after Home renders and keeps Skip visible;
- skip never blocks the app and replay is easy to find;
- progress survives device change without treating a new phone as a new person;
- phone and desktop receive different layouts but the same financial meaning;
- opening balances compile to balanced books without fake income/expense/cash flow;
- no tutorial code bypasses typed commands or Confirm;
- keyboard, screen reader, touch, zoom, offline, and reconnect proofs pass; reduced-motion conformance is a documented D-129 exception and therefore remains an explicit accessibility debt;
- adding a new chapter is demonstrably isolated to registry/content/target additions.
