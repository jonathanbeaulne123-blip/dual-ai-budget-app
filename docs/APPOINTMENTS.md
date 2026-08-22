# Appointments, claims, and money owed to us

Living spec for recurring visits, itemized bills, insurance as a **receivable**, the claims tray, quiet labels, and Hercules proposing sinking-fund jars. Laws: [DECISIONS.md](DECISIONS.md) **D-053 / D-054 / D-055 / D-056**. Dual Course: [STRATEGY.md](STRATEGY.md).

This is not a slice packet. The receivable model is fixed (Jonathan). Privacy and Hercules autonomy are the designs below. Reversals need a new D-number, not a hidden rewrite.

---

## Research — steal / refuse

Read against Canadian group benefits (Sun Life, Manulife, Canada Life, Green Shield), CRA METC, YNAB sinking funds, Actual Budget scheduled transactions, Finch / Pokémon Sleep / Tamagotchi / Duolingo / Mint.

| Source | Take | Refuse |
|---|---|---|
| **Canadian benefits** | Adjudication is submitted → pending → paid / partial / denied with an EOB. Benefit years are calendar or policy-anniversary. Dental is typically 80% basic / 50% major with an annual max. Deductibles restart. Coordination of benefits is second-payer, not a second income stream. OHIP covers the physician visit; dental, physio, therapy, and glasses are usually private. | A US HSA / FSA wallet. Inventing 80% coinsurance when the household has not typed a typical recovery. Modelling every plan maximum in v1. |
| **CRA METC** | Eligible medical **net of reimbursements**. 2026 threshold is the lesser of 3% of net income (line 23600) or **$2,890**. Credit is non-refundable at the lowest federal rate plus provincial. Pool the family; usually the lower-income spouse claims. 12 consecutive months ending in the tax year. Vet bills for a pet are **not** eligible. | Filing taxes. Inventing a refund dollar. Putting Hercules's vet on the METC list. |
| **YNAB** | Sinking funds: every visit has a job, true-up when reality differs. | Guilt priesthood. Auto-moving CAD without a confirm. |
| **Actual Budget / Firefly** | Scheduled transactions are projections until posted. | Forking a second poster beside `postEntry`. |
| **Apple / Fantastical / Todoist** | "Every 6 months," nth weekday, and "office calls you" (once, then overdue). Slip is real. | Natural-language parsers in the ledger. |
| **Finch** | Care without death. Follow-through is the game. | Decay while you're on vacation. |
| **Pokémon Sleep** | Long-horizon collection from a real act. | Gacha, paid currency, FOMO windows. |
| **Tamagotchi** | Presence. | Hunger meters, death, pay-to-revive. |
| **Duolingo** | — | Streak death, shame banners. |
| **Mint** | "Something is coming." | Ad upsell, feed-as-truth, dead-product bloat. |

**Why appointments are not a `RecurrenceKind`:** a recurrence is one amount (rent, Spotify, Bianca's pay). A visit has itemized lines, expected recovery, a claim lifecycle, OHIP vs private, and cadences recurrence cannot say (`every 6 months`, `3rd Tuesday`, `office calls you`). The calendar board **projects** visits as `BoardKind: "visit"`. Mark-paid for bills stays `postEntry` via recurrence. Visits post through `postVisit`.

**Why a dedicated `receivable` kind, not `other`:** `other` is the jar / cash on the counter (`isCashLikeKind`). A Sun Life claim is not a tip envelope. Receivable is a current asset, debit-normal, **not** cash-like, **not** a liability. Chart base 1320. Wallet group: **Owed to us**.

---

## Money meaning (D-053)

On the day of the visit:

1. Full amount posts as an **expense** (Visa or chequing).
2. Expected insurance (or employer, or a person) posts as a **refund onto the receivable**. Compile is Dr A/R, Cr expense. Category spend that day is out-of-pocket.
3. When the money lands: **`postTransfer` receivable → the account that received it.** Never income.
4. Shortfall / denial: **expense write-off** with `accountId` = receivable (Dr expense, Cr A/R). Category climbs back to true out-of-pocket.
5. Overpay: settle outstanding A/R first, extra recovery is a further **refund to the bank that received cash**, still not income.

`postVisit`, `openClaim`, `settleClaim`, `writeOffClaim`, and `submitClaim` wrap that composition so the UI cannot mis-order refunds. Confirm still writes. Duplicate confirm still fires on the visit expense.

Itemized lines are optional. If present they **must sum** to the posted visit total.

Claims are **general**: `insurance | employer | person | tax | other`. Co-pay pending is the special case of "money owed to this household that hasn't arrived." A work Uber, a friend paying you back, a tax refund of a posted installment — same tray.

OHIP visits with $0 at the desk do not post. Private extras still can. Recovery is estimated from `typicalRecoveryCents`, else the median of settled claims for that appointment, else **$0**. We do not invent a plan maximum.

CRA METC projection is out-of-pocket: visit total minus reimbursements received minus still-expected recovery. A pending Sun Life cheque does not inflate the credit. Vet stays off.

---

## Privacy (D-054)

This couple **shares a ledger by design**. Hiding Bianca's therapy from Jonathan is the wrong product here even where it is right in the abstract.

- Appointment notes travel on the **shared snapshot**. Hosted RLS is still `USING (true)`. The publishable key ships in the bundle. Treat hosted contents as disclosed (D-034 / D-052).
- Do **not** encrypt with the three-word phrase (that would be a comforting lie: the other phone already has the phrase).
- Do **not** use `visibility: "personal"` as privacy. It is a filter (D-015). D-052 keeps partner personal rows, but they are still not encryption.
- `sensitivity: "quiet"` = Hercules and pulses say "the Tuesday visit." Calendar cards still show the title they typed, on the same phones.
- **D-060:** `postVisit` does not copy a quiet title onto the expense note, place, or claim label. The model payload strips those strings even if a household-typed note matches.
- The UI must say this out loud. Copy: appointment notes travel with the household snapshot; until Auth, treat them like groceries on a shared drive.

The feature does **not** wait for Auth. The receivable and the METC log are the product. Auth remains the privacy boundary.

---

## Hercules (D-055)

He **never posts money** (D-042 / D-044 / D-049). He **never** calls `addGoal` unprompted.

He **proposes** a sinking-fund jar from learned cadence, typical cost, typical recovery, and weeks until due. A human taps **Start this jar** → `acceptVisitGoal` → `addGoal`. Confirm still writes. He does not `contributeToGoal`.

Hercules the cat is a household member with recurring costs (`memberId: "companion"`). Same propose/confirm loop, first person: "I have a date in March."

Quiet appointments use the coded title in his mouth.

---

## Surfaces

Calendar → **Appointments** is the destination (D-056). Month-board visit pills and the Office claims tray stay satellites.

```text
Calendar → Appointments
├── Upcoming      next 90 days from projectAppointmentDates, overdue first,
│                 cost + expected-back per row. METC hero is the front door.
├── Each visit ▸  detail: claimed vs learned cadence, history, itemized bill,
│                 jar if one exists, practitioner / place / coverage,
│                 Post visit → Confirm (draft can carry BillLine[]).
├── Owed to us    agedReceivables grouped by status, itemization,
│                 Submitted / Landed / Denied through Confirm.
├── Medical log   craMedicalLog year view: eligible net of reimbursements
│                 and still-expected recovery, vet excluded, $2,890 named.
└── Add / Edit    all five cadences, coverage, practitioner, place, sensitivity.
                  HOSTED_DISCLOSURE is the weighted sentence, not filler.
```

- **Office claims tray** — glance of outstanding CAD; Landed goes through Confirm; never `postEntry` from the widget itself.
- **Wallet** — Owed-to-us tiles. Net worth includes receivable. Cash-flow treats A/R → chequing as operating in.
- **Ask / Hercules** — "What's owed?", "Medical log", "Start this jar" (he tells you to tap Start; he does not write).
- **CRA log** — `craMedicalLog`: eligible cents net of reimbursements received **and** still expected (pending claims do not inflate METC). Cap $2,890 (2026) named, not computed as a refund. Vet stays off. Itemized lines on a row make the year defensible.

---

## How to try it (Development demo)

1. Open Hearth on Development. Reload demo data if the kitchen is empty.
2. Home: claims tray should show Sun Life cleaning still owing (~$180). Hercules may mention it. Wallet group **Owed to us** is not a jar.
3. Calendar → Appointments. The hero is this year's eligible medical, net of what is still coming back. Read the disclosure — it is the privacy sentence, not filler. Therapy is listed by the title Bianca typed; Hercules should call it "the Tuesday visit" if you ask him.
4. Open Hygienist. History shows the exam / debridement / fluoride lines. The drift sentence waits for a second posted visit. Post visit can add lines; Confirm still writes.
5. Owed to us: Sun Life cleaning, aging, **Submitted** then **Landed**. Confirm. Books: transfer Benefits owing → Everyday chequing. Not income. Category stays out-of-pocket.
6. Medical log: $68 eligible after the pending $180 stays out. Cap $2,890 named. Vet is off the list.
7. Hercules checkup: **Start this jar**. Confirm. Plan shows **Hercules · vet**. He did not post a cent.
8. Add a spa every 8 weeks, or a 3rd Tuesday, from the cadence picker — kind no longer freezes cadence.

Undo from the toast still works. Two phones merge claims by id (D-052).
