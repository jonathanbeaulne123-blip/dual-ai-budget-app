# Hearth button inventory

> **Status:** living consult map, not constitution. Inspected against `main@713e586` (2026-08-27).
> **Household job:** name every control family a person can tap, ranked by usefulness and predicted use, in plain language.
> **Not a build plan.** This file does not authorize new buttons, onboarding copy, or posting shortcuts.

## Should AIs load this?

**Yes, when the task is about UI, onboarding, Office/phone chrome, or inventing/moving a tap target.** It saves a 360-button grep and keeps Confirm as the money boundary.

**No, not at session start.** Do not add this to the required `AGENTS.md` / `docs/README.md` / `docs/HEARTH_ROADMAP.md` load. Context budget wins. The index in [`docs/README.md`](README.md) is enough discovery.

| If you are… | Load this? | Then |
|---|---|---|
| Mapping, teaching, or ranking controls | Yes | Treat families as current; inspect `src/` before claiming a missing or extra button |
| Posting, sync, Auth/RLS, migrations | No | Command contract and living money canon already cover the write boundary |
| Adding a new tap target | Yes, after current code | Do not duplicate a family. Only Confirm (or a Confirm-labeled cousin) may post money |
| Writing first-run onboarding | Yes, plus | Tutorial *disposition* (Feature / Spotlight / Exclude) stays in [`ONBOARDING_UPDATE.md`](ONBOARDING_UPDATE.md) §3 |

**Stale rule:** if a label here disagrees with current TSX, the TSX wins. Re-scan `<button` under `src/` and update this file in the same PR that changes a control family.

---

## How to read the ranking

Static scan at this SHA: about **361** literal `<button>` elements across `src/**/*.tsx`. Repeated keypad digits, calendar days, category/account chips, wallet tiles, and game cells are **families**, not hundreds of tutorial decisions.

- **Usefulness** follows Dual Course: family-office books weigh **5**; Hercules and toys weigh **3**. Confirm, Add, wallet, bills, shifts, and undo beat chalkboard and hangman.
- **Predicted use** is Jonathan + Bianca on a normal Toronto week: groceries/coffee, glance Home/Wallet, Calendar dues, work clock-in/out, occasional card paydown, monthly sit-down. Google/QR/restore/SQL are high-stakes and low-frequency.
- **ELI5** is the function in one breath. It is not marketing copy and not a permission to skip Confirm.

**Law (product):** tapping can *prepare* money. A visible **Confirm** is supposed to be the write boundary.

**Current write styles (inspect TSX; do not flatten these):**

| Style | What the human sees | Examples at this SHA |
|---|---|---|
| **Confirm sheet** | `Confirm.tsx` dialog, Cancel + confirm label | Add **Post**, Calendar **Mark paid**, Activity **Reverse**, import **Review final Confirm**, shift **Confirm shift** |
| **Confirm-labeled chip** | Button says Confirm/Lock; calls persist/`onApply` with no sheet | Sit-down **Confirm moves**, **Lock**, **Copy jobs** |
| **Direct command chip** | Tap runs a command immediately | Wallet **Post estimated interest / rewards**, **Mark value**, Goals **Fund goal** / **Add shared goal** |

When mapping or adding a money tap, prefer a Confirm sheet. Do not treat a direct chip as a model to copy.

---

## If you only remember ten

| Rank | What you tap | Usefulness | Predicted use | Like I’m 5 | Primary source |
|---|---|---|---|---|---|
| 1 | **Confirm** | Highest | Every real money write | The “yes, put this in the real piggy bank” stamp. | `Confirm.tsx` |
| 2 | **+ / Add / Post** | Highest | Several times a day | Front door for spent / earned / moved. Still a draft until Confirm. | `App.tsx` nav FAB, Add sheet |
| 3 | **CAD keypad** (`0–9`, `00`, delete) | Highest | Every post | Number buttons. Digits are **cents**. `525` is $5.25. | `CadPad.tsx` |
| 4 | **Home** | Very high | Constant | Back to the kitchen table. | `App.tsx` nav |
| 5 | **Household / Personal** | Very high | Several times a day | Two notebooks: shared house money vs “just mine.” | `App.tsx` view switch |
| 6 | **Groceries / Coffee / presets** | High | Daily | Stickers that fill a common spend so you do not retype it. | `App.tsx`, `CalculatorPad.tsx` |
| 7 | **Category chips** | High | Every expense/income | What *kind* of spend. Groceries is not rent. | Add sheet |
| 8 | **Account picker** | High | Every post | Which real wallet or card this hit. | Add sheet, `Accounts.tsx` |
| 9 | **Calendar** | High | Daily glance, weekly pay | Wall calendar for bills, paydays, visits. Looking is free. | `Calendar.tsx` |
| 10 | **Books → Wallet tiles** | High | Daily glance | The real piggy banks. Tap a tile to open that jar. | `Books.tsx`, `Accounts.tsx` |

Where usefulness and predicted use disagree: **Confirm** is the most useful and not the most tapped; **+** and the keypad get more hits. **Health / Lamp** should be mostly boring (“Clean”). **Hercules** will get lots of taps and still cannot spend a cent.

---

## 1. Daily money spine

Used the most. Highest household value.

| Family | Like I’m 5 | Posts money? | Source |
|---|---|---|---|
| **Confirm** | Stamp that makes the number real. | Yes, after preview | `Confirm.tsx` |
| **Cancel** (Confirm sheet) | Never mind; do not write it. | No | `Confirm.tsx` |
| **+ (Add money)** | Open the pad from the bottom bar. | No | `App.tsx` |
| **Post / Post $X / Move $X** | I’m done filling the form; show Confirm. | No (opens Confirm) | Add sheet, `CalculatorPad.tsx` |
| **Close** (Add sheet) | Shut the pad without posting. | No | `App.tsx` |
| **expense / income / shift / transfer** | Pick the story kind. Paying a card is a **transfer**, not an expense. | No | `App.tsx` |
| **CAD keypad** | Type CAD as integer cents. | No | `CadPad.tsx` |
| **Groceries / Coffee** | Instant fill for the two kitchen spends. | No | `App.tsx`, `CalculatorPad.tsx` |
| **Saved preset chips** | Your stickers. Fill note/category/account. | No | `PresetChip.tsx` |
| **Save as preset / Forget preset** | Keep or throw a sticker. Catalog only. | No | `App.tsx`, `Hercules.tsx` |
| **Who paid (Joint / member)** | Whose money was this? | No | Add sheet |
| **Split % chips** | How we split the pizza. Must sum to 100. | No | Add sheet |
| **Shared / Personal / Both** | Which notebook to save the row in. | No | Add Date & place |
| **Date & place / Hide details** | Extra row: date, place, stamps. | No | Add sheet |
| **Add anyway** | Yes it looks like a duplicate; post anyway. | Opens Confirm | Add sheet |
| **Home / Calendar / Plan / Books / More** | Five rooms of the house. **+** sits in the middle. | No | `App.tsx` nav |

**Phone Home seals and tiles** (tap targets, not always `<button>`):

| Family | Like I’m 5 | Source |
|---|---|---|
| **Post seal** | Did we write anything today? Opens the Pad. | `OfficePhone.tsx` |
| **Due seal** | Is a bill staring at us? Opens Mail. | `OfficePhone.tsx` |
| **Health seal** | Do the books still add up? Opens the lamp. | `OfficePhone.tsx` |
| **Month net tile** | This month’s income minus expense. Not leftover, not bank balance. | `OfficePhone.tsx` |
| **Pad / Wallet / Shifts / Mail / Goals / Health tiles** | Open that notebook. | `OfficePhone.tsx` |
| **More instruments chips** | Pull parked Home toys back out. | `OfficePhone.tsx` |
| **pin / pinned** | Keep a notebook open. Comfort, not money. | `OfficePhone.tsx`, `Office.tsx` |

---

## 2. Daily navigation and “where am I?”

Constant taps. They do not change CAD by themselves.

| Family | Like I’m 5 | Source |
|---|---|---|
| **Open ledger** | Switch which house’s books this phone is holding (when you belong to more than one). | `App.tsx` |
| **Retry now / Retry** | Cloud hiccup; try sending saved work again. | `SyncFreshnessStatus.tsx`, command chip |
| **Review pending / Open recovery** | Jump to More when sync or restore needs a human. | command banner |
| **Development pill** | Label: this is the trial kitchen, not Production. Not a toy. | `App.tsx` header |
| **Hercules (tap)** | Hey cat, talk about *this* screen. He points. He never posts. | `Hercules.tsx` |
| **How can I help** | Same door, from the bubble. | `Hercules.tsx` |
| **Question chips** | Canned questions grounded in the books. | `Hercules.tsx` |
| **send / ok** | Send what you typed to the cat. | `Hercules.tsx` |
| **Close focus / dismiss** | Put the cat down. | `Hercules.tsx` |
| **Double-tap / drag / wander / perch** | Sit him, move him. Play, zero CAD. | `Hercules.tsx`, Office furniture |

---

## 3. Work / shift

High if a job is configured (Bianca’s workdays can rival groceries). Quiet if not.

| Family | Like I’m 5 | Posts? | Source |
|---|---|---|---|
| **Start shift / Clock in** | Start a live punch. Still a preview. | No | `Timesheet.tsx`, Add shift |
| **Already off?** | I forgot to punch; fill hours after the fact. | No | `Timesheet.tsx` |
| **Paid / Unpaid break / End break** | Pause the clock the honest way. | No | `Timesheet.tsx` |
| **Clock out / Review & confirm pay** | Stop the clock; walk wage/tip review. | No | `Timesheet.tsx` |
| **Never mind / Discard this open shift** | Throw away an unposted punch. | No | `Timesheet.tsx` |
| **Use this timeline** | Two phones punched; pick the clock you recognize. | No | `Timesheet.tsx` |
| **Next / Back** (shift ceremony) | Step through hours, tips, tip-outs. | No | `WorkShiftFlow.tsx` |
| **Confirm shift** | Confirm stamp for wages + tips. | Yes | `WorkShiftFlow.tsx` |
| **Correct** (history) | Post a reversing correction. Old shift row stays. | Yes, via Confirm | `WorkShiftHistory.tsx` |
| **Add/Edit/Review/Archive job** | Job rules only. No CAD. | No | `WorkJobs.tsx` |
| **This month / All time / Export CSV** | Filter or download the paycheck story. | No | `WorkReport.tsx` |

---

## 4. Wallet, cards, and activity

Daily glance. Weekly action (pay card, reverse a mistake).

| Family | Like I’m 5 | Posts? | Source |
|---|---|---|---|
| **Wallet tiles** | Open that account’s room. | No | `Accounts.tsx`, `WalletTray.tsx` |
| **Pay this card / Pay card** | Move money *to* the card. Not a second expense. | Opens transfer Confirm | `Accounts.tsx` |
| **Add on this card / Move in / Contribute** | Open Add aimed at that jar. | No | `Accounts.tsx` |
| **Activity tabs** | Filter posted rows. | No | `Ledger.tsx` |
| **Reverse** | Honest eraser: matching opposite row. Original stays. | Yes, via Confirm | `Ledger.tsx` |
| **Include / Exclude / Show contrast** | Count this row vs park a lookalike clone. | No (flag only) | `Ledger.tsx` |
| **Post estimated interest / rewards** | You tap interest/cashback; it never auto-posts. Direct command chip today (no Confirm sheet). | Yes, on tap | `Accounts.tsx` |
| **Save terms / Save APY / Everyday HIS / Goals savings** | Store card/savings settings. | No | `Accounts.tsx` |
| **Mark value** | Write what an investment is worth today. A mark, not a trade. Direct command chip today. | Yes, on tap | `Accounts.tsx` |
| **Archive this account** | Hide an old account. History stays. | No | `Accounts.tsx` |
| **Open an account → kind chips → Open** | Add chequing, savings, credit, investment, receivable. | No (structure) | `Accounts.tsx` |

---

## 5. Calendar, bills, and due work

Weekly rhythm.

| Family | Like I’m 5 | Posts? | Source |
|---|---|---|---|
| **Month / Appointments / Bills / Google** | Four Calendar rooms. | No | `Calendar.tsx` |
| **‹ › month / day cells** | Flip the page; pick a day. | No | `Calendar.tsx` |
| **Open plan** | Jump to Plan vs actual. | No | `Calendar.tsx` |
| **Mark due paid / Paid / Post / Mark paid** | This bill happened. | Yes, via Confirm | `Calendar.tsx`, `Mail.tsx` |
| **Add repeating / type / cadence / Save** | Teach a bill or paycheck that comes back. Saving a reminder is not posting it. | No | `RepeatingForm.tsx` |
| **Adopt / Not a bill** | Yes that grocery rhythm is a bill / stop nagging. | No | `Calendar.tsx` |
| **Edit / Skip once / Pause / Resume** | Change, skip this cycle, or freeze a reminder. | Skip/paid still Confirm | `Calendar.tsx` |
| **Due preview: Not now / Review / Review all** | Bills are waiting. | No | `DuePreviewSheet.tsx` |

---

## 6. Plan, sit-down, and goals

Monthly. High usefulness, low daily taps.

| Family | Like I’m 5 | Posts? | Source |
|---|---|---|---|
| **Category budget Save / Cancel** | Plan vs what you actually posted. Journal is truth; budget is a wish. | Budget edit only | `Books.tsx`, Plan tab |
| **Sit-down facts / Then the books** | Start leftover ritual. | No | `SitDownGuide.tsx` |
| **Assign leftover / allocation chips** | Park extra cash into jars. | No until Confirm moves | `SitDownGuide.tsx` |
| **Pause / Copy jobs** | Stop mid-ritual, or meet overspent categories halfway. Copy jobs writes on tap (no sheet). | Copy jobs writes | `SitDownGuide.tsx` |
| **Confirm moves** | Confirm-labeled leftover transfers. Calls persist/`onApply` with no Confirm sheet at this SHA. | Yes, on tap | `SitDownGuide.tsx` |
| **Standing orders / Download workbook / Drive** | Remember leftover moves; take a paper copy. | Drive is export | `SitDownGuide.tsx` |
| **Lock / Reopen** | Close last month so it stops changing. Reopen is a loud unlock. Sit-down **Lock** writes on tap. | Yes, on tap | `SitDownGuide.tsx`, `Books.tsx` |
| **Start / Add / Fund goal** | Make or fill a savings jar. Hercules can propose; you tap. **Fund goal** / **Add shared goal** write on tap today. | Yes, on tap | `App.tsx` Goals, `Jars.tsx` |
| **Mark purchased / Not yet** | We bought the thing from vault cash. Jar retires. | Yes (purchase sheet / tap) | Goals, `Jars.tsx` |

---

## 7. Appointments and claims

Useful when medicine/benefits exist. Not daily for everyone.

| Family | Like I’m 5 | Posts? | Source |
|---|---|---|---|
| **Upcoming / Owed / Log / Add / Visit cards** | Track a doctor visit. | No | `Appointments.tsx` |
| **Post visit** | Confirm the visit expense. | Yes | `Appointments.tsx` |
| **Submitted** | Mark a claim sent. | State only | `Appointments.tsx` |
| **Landed** | Benefits money moved into chequing. Not income. | Yes, via Confirm | `Appointments.tsx`, `ClaimsTray.tsx` |
| **Denied** | Write the amount back to the visit category. | Yes, via Confirm | `Appointments.tsx` |
| **Start this goal** on a visit | Save toward this appointment. | Goal create via Confirm | `Appointments.tsx` |

---

## 8. Books power tools

High usefulness, low daily taps.

| Family | Like I’m 5 | Source |
|---|---|---|
| **Wallet / All activity / Import / Journal / Trial / Statements / Reconcile / Close pack / Chart / Ask** | Accountant’s drawers. | `Books.tsx` |
| **Ask chips / Ask** | Question the books can answer without a model. | `Books.tsx` |
| **Record rec** | My statement says $X; tick that it matches. Rec does not post. | `Books.tsx` |
| **Close / Reopen / Download close pack / SQL / CSV** | Month-end lock and take-home copies. | `Books.tsx` |
| **Power SQL / Run query** | Read-only expert console. Bianca can ignore forever. | `Books.tsx` |

---

## 9. Import inbox

Batch, not daily. Inbox until one final Confirm.

| Family | Like I’m 5 | Posts? | Source |
|---|---|---|---|
| **Import QFX / OFX** | Drop a bank file into the inbox. | No | `BatchImport.tsx` |
| **Take document photo / Choose receipt** | Snap or pick a bill image. | No | `BatchImport.tsx` |
| **Connect Flinks / Fetch / Disconnect** | Optional bank-evidence helper. Gated. Does not post by itself. | No | `FlinksConnectPanel.tsx` |
| **Keep / Cancel / Keep both / exclude old** | Duplicate referee for imported vs already posted. | No | `BatchImport.tsx` |
| **Treat as new expense** | This payment is a new spend, not a match. | No | `BatchImport.tsx` |
| **Review final Confirm** | One Confirm for the cleaned batch. | Yes | `BatchImport.tsx` |
| **Retry Drive save / Delete Drive copy** | Optional private Drive copy. Failure is not a books failure. | No | `BatchImport.tsx` |

---

## 10. Companion and desk toys

Predicted taps can be high. Books usefulness is lower on purpose. Course A still wins if they conflict.

| Family | Like I’m 5 | Source |
|---|---|---|
| **Chalkboard Save / Done / Expand / Shrink / Delete / Scribble** | Fridge notes. Never CAD. | `ChalkboardDesk.tsx`, `DailyHearth.tsx` |
| **Edit desk / Desks / Home theme / Drawer / Straighten** | Rearrange the wide Office like furniture. | `Cabinets.tsx`, `Office.tsx` |
| **Size / × park / restore / Names on / Glance / Large / paper stock** | Resize, hide, or tint widgets. | `Office.tsx` |
| **Save desk / Pull previous desk** | Remember widget layout. Not books. | `Office.tsx` |
| **Window / Sill figures** | Rainy window; tap a sill number to jump to its instrument. | `OfficeWindow.tsx`, `SillOverview.tsx` |
| **Tic-tac-toe / Hangman / New game / New word** | Games. No CAD. | `GamesDesk.tsx` |
| **Wardrobe cosmetics / None / Save name / forget / Wipe chat** | Dress or rename the cat; erase memories on this device. | `WardrobeDesk.tsx`, `DailyHearth.tsx` |
| **Use / Open Hercules Pro** | Optional ChatGPT companion. May *prepare* one command; you still Confirm. | `Hercules.tsx`, `HerculesPro.tsx` |

---

## 11. Front door

Once per device, then rare. Very useful the day you need them.

| Family | Like I’m 5 | Source |
|---|---|---|
| **Login / Continue / Create household with Google** | Normal door. Find your ledgers on any phone. | Welcome in `App.tsx` |
| **Open {household} as {me}** | Walk into that house as that person. | Welcome |
| **Join with QR / Open camera / Close camera / Back** | Scan an invite instead of Google. | `WelcomeQrScanner.tsx` |
| **I am Jonathan / I am Bianca** | Legacy “who holds this phone?” if you did not come in through Google. | Welcome |
| **Create household** | Name the house and Personal ledger, then enter. | Welcome |
| **Open the demo kitchen table** | Fake practice house. Not real books. | Welcome |
| **Sign out of Google** (welcome) | Leave Google on the welcome screen. | Welcome |

---

## 12. More, identity, recovery, danger

Low predicted use. Some are nuclear. Do not teach destructive Development actions as play.

| Family | Like I’m 5 | Danger | Source |
|---|---|---|---|
| **Sign out / Sign out and clear this phone** | Forget Google on *this phone*. Cloud household stays. | Local session | `App.tsx` More, `GoogleBridge.tsx` |
| **This phone is {member}** | Legacy actor switch. Google path should not need this daily. | Identity mix-up | `App.tsx` |
| **Use this phone’s zone** | Show clocks in another IANA zone. Books dates stay Toronto. | None | `App.tsx` |
| **Allow location / Stamp time / Stamp place / Use now / Clear stamp** | Optional where/when stickers on a draft. | Privacy | Add sheet, More |
| **Link / Unlink / service On/Off / Confirm it’s me / Sync Google now** | Identity and optional Calendar/Drive/etc. | Unfinished services | `GoogleBridge.tsx` |
| **Issue email/QR invite / Copy Auth join link** | Bring the other person in. | Invite | `Pairing.tsx` |
| **Share phrase / Hearth Pass / Pull / Stop sharing / Publish** | Legacy recovery / old one-phone share. Emergencies, not daily. | Continuity confusion | `Pairing.tsx` |
| **Undo** | Reverse the last thing *you* posted, the honest way. | Latest only | More → Recent changes |
| **Restore** (owner) | Roll to a saved checkpoint. Loud, rare. | Owner-only | More → Restore points |
| **Export JSON snapshot** | Download a copy. | Safe | More |
| **Post due recurring** | Same as Calendar mark-due for everything due today. | Via Confirm | More |
| **Reload random data / Display pretty numbers** | Fake demo numbers. Trial kitchen only. | Wipes meaning | More |
| **Erase Development data** | Wipe trial activity. Production untouched. Cannot undo. | Nuclear | More |
| **Delete this Development household** | Destroy the trial house. | Nuclear | Welcome list, More |
| **Save category** | Add a new spend meaning if Groceries/etc. are not enough. | None | `App.tsx` |

**Conflict sheet (`Keep cloud copy` / `Keep this phone` / `Export both`):** the component still lives in `ConflictResolution.tsx` and is **not mounted** from `App.tsx` at this SHA. Do not teach it as a live button. Current conflict policy is auto-resolve plus Retry chrome. Inspect `src/core/conflict.ts` and `App.tsx` before claiming a human choose-sheet.

---

## Refresh recipe

When a PR adds, removes, or renames a control family:

1. Grep `<button` under `src/` (and note tap-targets that are not buttons: wax seals, paper tiles, Hercules figure).
2. Update the matching family row here. Do not explode keypad/calendar/category copies into individual rows.
3. Keep Confirm as the only money write unless a new Confirm-labeled cousin is intentional and tested.
4. Leave [`ONBOARDING_UPDATE.md`](ONBOARDING_UPDATE.md) §3 as tutorial disposition (Feature / Spotlight / Exclude). This file stays usefulness × predicted use.

Do not put this file on the mandatory constitution load.
