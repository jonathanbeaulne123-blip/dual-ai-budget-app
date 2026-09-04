# Hearth — Build Manual
### Charter · Register & Ask · Till · Clerk · Demo

**How to use this document.** Paste it once, then say **"do Charter slice 1."** Do exactly that slice, open the PR, stop. When Jonathan says **"do Charter slice 2,"** do that one. Same for **"do Register and Ask slice 4,"** **"do Till slice 2,"** **"do Clerk slice 3,"** **"do Demo slice 1."**

One slice per message. Never run ahead. Never do "slice 3 and 4 together." If a slice can't be done as written, stop and say why instead of improvising a different design.

**Who runs which slice, and what can run at the same time: Appendix D.**

---

# PART 0 — STANDING BRIEF

Read this before every slice. It applies to all of them.

## 0.1 What Hearth is

A household ledger for two people, Jonathan and Bianca. React 19 + TypeScript + Vite, Vitest, pnpm 10.14.0, PGlite on-device, Cloudflare Workers. CAD integer cents. Civil dates are `America/Toronto`.

The shared money lives in the **Household Fund** — a shared operating subledger over Bianca's savings account. **The money stays in her savings. Hearth cannot move it.** Hearth records what two people agreed to.

## 0.2 The two-income model (this is the product)

- **Bianca is the custodian.** She holds the account and she is the one who swipes the household card. She is the household's *spender*.
- **Jonathan has no access to the shared account or its money.** He contributes into the Fund. He cannot swipe. His only lever on the household's finances is **how much he works**.
- **Bianca is paid biweekly** — a predictable *cadence*. Her **contribution amount is not fixed and must never be assumed constant.** The first months are a discovery period to learn what the house actually costs and therefore what she should set aside.
- **Jonathan is a tipped earner.** His income is variable and, crucially, is **not an input to the month — it is the output.** The month needs a number and he goes and earns it.
- The split rule is therefore **Remainder**: one income covers what it covers, the other closes what's left, by working more.

The product answers one question no other product answers: **"how much do I need to work to close this month?"**

## 0.3 The five laws — no slice may break these

1. **Custody.** Hearth never moves money. `Confirm` is the money boundary. A proposal never creates money. Only the fund custodian may confirm.
2. **No second envelope (D-161, D-173).** A goal or an earmark is a **claim on** the pool, never a second balance. An earmark is a *label on money, not a partition of it*. If a new number could ever disagree with `projectHouseholdFund`, the design is wrong.
3. **Conservation ties.** Any derived instrument folds the real events and must reproduce the projection's own answer. Carry a `tiesToProjection` boolean and render an honest empty state when it is false. Never paper over a mismatch.
4. **No ratio.** Nothing in the register, the Ask, or any surface may compute a share, a percentage, or a ranking between the two members. Totals and attribution: yes. `62% / 38%`: never. This is a fence in code, not an intention in a doc.
5. **The clerk never proposes.** Hercules reads the journal and cites rows. He may not emit a proposed amount and may not tell anyone to work.

## 0.4 Canon and reading order

Before your first slice: `docs/README.md`, `docs/HEARTH_ROADMAP.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `AGENTS.md`. Inspect current code rather than trusting any summary — including this one. `docs/nostalgia/` and `docs/reference/` are history, not the plan.

Design source for everything here: `claude/hearth-two-incomes-2026-09-01.md` and `claude/hearth-charter-month-plan-2026-08-31.md`.

## 0.5 Delivery convention — every slice, no exceptions

- Branch off `main`: the branch name is given in the slice.
- One slice = one branch = one PR. Never commit to `main`. `main` publishes to Cloudflare on merge (D-041); Jonathan merges, you do not.
- `pnpm test` must pass. `pnpm build` (which runs `tsc --noEmit`) must pass. Also `pnpm ai:verify` and `pnpm check:windows`. Run them before opening the PR.
- **`pnpm test` now runs the lane runner** (`node scripts/run-test-lanes.mjs`), not `vitest run`. Use it rather than invoking vitest directly, so a slice's suite lands in the right lane.
- **The "pre-existing failures as of `ba752c2`" note in earlier drafts is stale.** Record the actual failing set on the branch point you start from, and state in the PR that the count is unchanged.
- PR body uses `docs/AI_HANDOFF.md` fields: both Dual Course deltas (budget 5, engagement 3), exact verification, uncertainty, data disclosure, next owner.
- Append any new decision to `docs/DECISIONS.md` using the D-number the slice assigns.
- Never commit `.env`, Worker secrets, Google tokens, workbook exports, or real household rows. **All test and demo data is synthetic.**

## 0.6 Test conventions (house style — follow both)

Every slice ships both kinds:

1. **Source fences** — `readFileSync` the file and `toContain` / `not.toContain` the rule, so a rule can't be quietly deleted. Example: assert `contributionRegister.ts` contains no `percent`, `ratio`, or `share`.
2. **Command-driven scenarios** — build the household by calling the **real commands** (`configureHouseholdFund`, `proposeHouseholdFundContribution` → `confirmHouseholdFundContribution`, `postEntry`, `confirmHouseholdFundSettlement`, …), never by hand-writing state. If a scenario can't be built through commands, the command layer is missing something — say so.

Tests live in `test/**/*.test.ts`, node environment.

## 0.7 Visual conventions

Use the existing paper/ink tokens. **No hex literals in new CSS** — derive with `color-mix` from `--ink --paper --paper-2 --card --line --pine --copper --gold --felt --brass --display --font --lift-0/1/2`.

Semantic colours for this feature set, define once and reuse:
- `--reg-hers: var(--pine)` — Bianca's money
- `--reg-his: var(--copper)` — Jonathan's money
- `--reg-carried: var(--line)` — balance carried in
- unfunded = **no fill, 1px `--copper` dashed outline**

Any geometry that carries a rule (a shared scale, a fill level, a bar width) goes in a pure `src/core/*View.ts` module with exported constants, the way `src/core/monthSpread.ts` does it, so the rule is assertable in a test instead of buried in JSX.

Evidence required at **320px, 390px, 720px, ~1100px**, in both themes, including keyboard focus, reduced-motion, empty, loading and error states.

## 0.8 Copy rules

- Never say "governance", "budget variance", "compliance", or "lite".
- Words on screen: *charter, motion, waiting on you, agreed, held, the record, the ask*.
- **Held is never "denied."** It reads as *let's talk about this*.
- The Ask never issues an instruction. It never says "work three shifts." It lays out options.
- Never write copy that reports one member's workload to the other.

## 0.9 Definition of done for every slice

- [ ] Branch named as specified, PR opened, not merged
- [ ] `pnpm test` green (pre-existing 3 unchanged), `pnpm build` green
- [ ] Both test kinds present (source fence + command-driven scenario)
- [ ] No hex literals in new CSS
- [ ] Screens at 320 / 390 / 720 / 1100 in both themes, if the slice touches UI
- [ ] `docs/DECISIONS.md` updated when the slice assigns a D-number
- [ ] Handoff fields in the PR body
- [ ] Nothing outside the slice's stated scope was touched

---

# PART 1 — THE CHARTER

*Five slices. The household's founding document. Build every slice against a **genuinely empty household** — no Fund, no events, no seed. If it isn't good empty, the demo is a lie.*

---

## Charter slice 1 — the record

**Goal:** the charter exists as a typed, validated, pure record. No UI, no commands.

**Branch:** `charter/1-record` · **PR:** `feat(charter): the household charter record`

**Files:** new `src/core/charter.ts`; modify `src/core/types.ts`; new `test/charter-record.test.ts`

**Add to `types.ts`:**

```ts
export type CharterSplitRule = "even" | "proportional" | "remainder";
export type CharterCeilingKind = "hours-per-week" | "amount-per-month" | "none";

export type CharterSignature = { memberId: string; signedAt: string | null };

export type CharterPermission = {
  id: string;
  label: string;               // ≤ 90 chars, their words
  grantedByMemberId: string;   // who is giving up the confirm
  actorMemberId: string;       // who may act alone
  revokedAt: string | null;
};

export type CharterClause = { id: string; heading: string; body: string };  // ≤ 60 / ≤ 400

export type CharterAmendment = {
  id: string;
  raisedByMemberId: string;
  field: string;               // dotted path into the charter
  fromText: string;
  toText: string;
  confirmedByMemberId: string | null;
  heldByMemberId: string | null;
  heldNote: string;
  raisedAt: string;
  resolvedAt: string | null;
};

export type HouseholdCharter = {
  id: string;
  purpose: string;             // ≤ 240 — what the pool is for
  custodianMemberId: string;
  splitRule: CharterSplitRule;
  splitNote: string;           // ≤ 240 — how they decide, in their words
  ceilingKind: CharterCeilingKind;
  ceilingValue: number;        // tenths of an hour, or integer cents, by kind. 0 when "none"
  cadence: "weekly" | "biweekly" | "monthly" | "none";
  cadenceWeekday: number;      // 0–6
  clauses: CharterClause[];
  permissions: CharterPermission[];
  signatures: CharterSignature[];
  amendments: CharterAmendment[];
  foundedOn: DateKey;
  createdAt: string;
  updatedAt: string;
};
```

Add `charter?: HouseholdCharter | null` to `Household`.

**Add to `charter.ts`:** `shapeHouseholdCharter(value: unknown): HouseholdCharter | null` following the exact defensive style of `shapeHouseholdFundConfig` — clamp lengths, drop malformed rows, sort deterministically, `isoOrFallback` for timestamps. Plus:

```ts
export function charterIsSigned(charter: HouseholdCharter): boolean;      // every signature has signedAt
export function charterUnsignedMemberIds(charter: HouseholdCharter): string[];
export function charterCeilingLabel(charter: HouseholdCharter): string;   // "24 hours a week" | "$400 a month" | "no ceiling agreed"
export function charterActivePermissions(charter: HouseholdCharter): CharterPermission[];
```

**Rules:**
- A charter with zero signatures is **valid**. Unsigned is a state, not an error.
- `custodianMemberId` must be a real member. If a Fund exists, it must equal `fund.custodianMemberId`.
- `ceilingValue` is 0 when `ceilingKind === "none"`.

**Tests (`charter-record.test.ts`):**
- shape returns `null` for garbage; clamps an over-long purpose to 240; drops a clause with no heading
- an unsigned charter shapes successfully and `charterIsSigned` is `false`
- `charterUnsignedMemberIds` returns both members for a fresh charter, one after a single signature
- `charterCeilingLabel` for all three kinds
- source fence: `charter.ts` contains no `percent`, `ratio`, or `share`

**Decision to log** (claim the next free D-number — Appendix B)**: Remainder is a first-class split rule.** *Hearth models three split rules. `remainder` means one income covers what it covers and the other closes the rest by working more. It is the household's own rule, recorded in the charter in their words, not a computed default.*

**Do not:** write any UI, any command, or any migration in this slice.

---

## Charter slice 2 — founding, signing, amending

**Goal:** the charter can be created, signed, and changed only by agreement.

**Branch:** `charter/2-commands` · **PR:** `feat(charter): found, sign, and amend by motion`

**Depends on:** slice 1

**Files:** modify `src/core/commands.ts`; new `test/charter-commands.test.ts`

**Commands (follow the `proposeHouseholdFundContribution` pattern exactly — `cloneHousehold` previous/next, `commit(previous, next, "Charter", <summary>, [ids])`, `ValidationError` for refusals):**

```ts
foundHouseholdCharter(household, input: {
  memberId: string; custodianMemberId: string; purpose: string;
  splitRule: CharterSplitRule; splitNote: string;
  ceilingKind: CharterCeilingKind; ceilingValue?: string | number;
  cadence: HouseholdCharter["cadence"]; cadenceWeekday?: number;
  clauses?: Array<{ heading: string; body: string }>;
  date: string;
}): CommitResult

signHouseholdCharter(household, input: { memberId: string; at?: string }): CommitResult

grantCharterPermission(household, input: { memberId: string; actorMemberId: string; label: string }): CommitResult
revokeCharterPermission(household, input: { memberId: string; permissionId: string }): CommitResult

proposeCharterAmendment(household, input: { memberId: string; field: string; toText: string }): CommitResult
confirmCharterAmendment(household, input: { memberId: string; amendmentId: string }): CommitResult
holdCharterAmendment(household, input: { memberId: string; amendmentId: string; note?: string }): CommitResult
```

**Rules — assert every one:**
- Founding twice throws. Amend instead.
- `signHouseholdCharter` may only sign **your own** line. Signing for the other member throws.
- An amendment is **raised by one member and confirmed by the other.** Confirming your own amendment throws. This is motion-and-second.
- A confirmed amendment writes the new value and stamps `resolvedAt`. `fromText` is captured at raise time so the record shows what changed.
- `grantCharterPermission`: `grantedByMemberId` is the caller. **You can only give away your own confirm, never take someone else's.** `actorMemberId !== memberId`.
- `revokeCharterPermission`: only the granter may revoke. Revoking is immediate and needs no second.
- Held is not a rejection: `holdCharterAmendment` leaves the amendment open with `heldByMemberId` set. It can still be confirmed later.
- If a Fund exists and the amendment would change `custodianMemberId`, throw. Custody moves through the Fund, not the charter.

**Tests:** one command-driven scenario per rule above, each asserting the `ValidationError` message or the resulting state. Plus a source fence: `commands.ts` contains `"You can only sign your own line."` and `"An amendment needs the other person to agree."`

**Copy (exact):**
- `"You can only sign your own line."`
- `"An amendment needs the other person to agree."`
- `"That charter already exists. Raise an amendment instead."`
- `"You can only give away your own confirm."`
- `"Custody moves through the Fund, not the charter."`

**Do not:** build UI. Do not auto-sign the founder.

---

## Charter slice 3 — the founding conversation

**Goal:** two people found a household in about six minutes, from empty, with four questions.

**Branch:** `charter/3-founding-flow` · **PR:** `feat(charter): the founding conversation`

**Depends on:** slice 2

**Files:** new `src/CharterFounding.tsx`, `src/charter-founding.css`; modify the shared-home entry so an empty household lands here; new `test/charter-founding.test.ts`

**The four questions — one per screen, exact copy:**

1. **"What is this money for?"**
   Sub: *"One or two sentences. It goes at the top of the page and it settles most arguments before they start."* → `purpose`
2. **"How do we decide who puts in what?"**
   Three cards: **Evenly** / **By what we each earn** / **One of us covers what's left.**
   The third card's body: *"Bianca's pay covers what it covers. Jonathan closes the rest by picking up shifts."* → `splitRule`, and the free-text underneath is `splitNote`, in their words.
3. **"What needs both of us, and what can either of us just do?"**
   → `permissions`, each written as a plain sentence. Pre-fill one suggestion: *"Bianca can spend from the Fund on anything we've already agreed is a household bill."*
4. **"When do we sit down?"**
   → `cadence` + `cadenceWeekday`. A **"we don't yet"** option is valid and sets `cadence: "none"`.

Then a **ceiling** step, framed as protection, not a limit:
> **"How much work is too much?"**
> *"If closing a month would take more than this, Hearth stops offering shifts and offers to move a goal instead."*
> Hours a week / dollars a month / no ceiling.

**Rules:**
- Every step is **skippable** with "decide this later" and returnable-to. A skipped step leaves the field at its empty default and the charter still founds.
- The flow **never blocks on the second person.** One person can found alone; the other signs whenever.
- Defaults are pre-filled from what the app already knows (member names, existing fund custodian) and are always visibly editable.
- Progress is saved per step, so closing the app mid-founding loses nothing.
- Reachable from empty state **and** from `More → the charter` afterwards.

**Tests:** command-driven — walk all four answers through to `foundHouseholdCharter` and assert the record; a second scenario skipping every step still founds; a fence that the flow renders the literal string `"How much work is too much?"`.

**Evidence:** all four breakpoints, both themes, keyboard-only pass through the whole flow.

**Do not:** show a single number, chart, or dollar figure anywhere in this flow. Do not gate founding on the Fund existing.

---

## Charter slice 4 — the charter page and the empty signature line

**Goal:** the charter reads as a document, and an unsigned line is visible, patient, and never accusing.

**Branch:** `charter/4-page` · **PR:** `feat(charter): the charter page and the empty signature line`

**Depends on:** slice 3

**Files:** new `src/Charter.tsx`, `src/charter.css`; new `src/core/charterView.ts`; modify shared-home nav; new `test/charter-page.test.ts`

**The page, in order:** purpose (display face, large) · custodian line · the split rule in their words · standing permissions as sentences · the ceiling · the cadence · clauses · **the signature block** · amendment history, newest first.

**`charterView.ts`** exports the layout rule so it is assertable:
```ts
export const SIGNATURE_VIEW = { ruleWidth: 260, ruleGap: 10, nameSize: 12 } as const;
export function signatureLines(charter, members): Array<{ memberId: string; name: string; signedAt: string | null }>;
```

**The empty signature line — the rule:** a signed line shows the name and the date. An unsigned line shows **the same rule, the same name, and nothing else.** No badge, no amber, no "pending", no "action required", no count in the nav, no notification. It is simply blank and true.

**Copy:** the only thing near an unsigned line is, at rest, nothing. If the viewer *is* the unsigned member, one quiet link: `"sign"`. If the viewer is the other member: nothing at all.

**Tests:** `signatureLines` returns both members in stable order; a fence asserting `Charter.tsx` contains none of `"pending"`, `"required"`, `"reminder"`, `"!"` as a badge; a scenario where member B has not signed and the rendered output for member A contains no prompt directed at B.

**Do not:** add a badge, a nag, a streak, or a notification anywhere in this slice. That is the whole point of it.

---

## Charter slice 5 — Held, everywhere

**Goal:** `Held` becomes a first-class action beside `Confirm` on every motion, and it never reads as a rejection.

**Branch:** `charter/5-held` · **PR:** `feat(motion): Held as a first-class action`

**Depends on:** slice 2

**Files:** modify `src/core/commands.ts`, `src/core/householdFund.ts`, `src/core/types.ts`; UI wherever Confirm appears; new `test/held.test.ts`

**Add:** `"contribution-held"` to the fund event kinds, and:
```ts
holdHouseholdFundContribution(household, input: { memberId: string; proposalEventId: string; note?: string }): CommitResult
releaseHouseholdFundHold(household, input: { memberId: string; holdEventId: string }): CommitResult
```

**Rules:**
- A held motion is **still open.** It can be confirmed later without being re-raised.
- Only the member who would confirm may hold. Holding your own proposal throws.
- A hold **never** touches a balance. `projectHouseholdFund` must be byte-identical with and without holds present — assert this directly.
- The person who held may release their hold; the proposer may withdraw their proposal.
- Holds appear in the record with their note.

**Copy (exact — never "denied", "rejected", "declined"):**
- Button: `"Hold"`
- After: `"Held — let's talk about this."`
- Note placeholder: `"What would you want to know first?"`
- In the record: `"{Name} held this on {date}."`

**Tests:** a scenario that holds then confirms the same proposal successfully; a projection-equality test with and without a hold; a source fence that the held copy contains none of `denied` / `rejected` / `declined`.

**Decision to log** (claim the next free D-number — Appendix B)**: Held is an open state, not a refusal.** *A held motion remains confirmable, never alters a balance, and is never rendered as a rejection.*

---

# PART 2 — THE REGISTER AND THE ASK

*Ten slices. The centre of the product. Slices 1–7 are pure core modules with no UI at all — build and test them before anything renders, because the rules live there.*

**The through-line:** the register folds the month → the tail of the register is the Ask → the Ask converts into candidate shifts → and the Ask always offers the other door. **These are one arithmetic, computed once, read several ways.** Nothing in this part may recompute a number that another module already owns.

**Discovery-first.** Bianca's contribution is **not** a fixed amount and never will be. Month one exists to learn what the house actually costs. Every instrument in this part must be honest about how much it has actually watched, and must degrade to "I don't know yet" rather than guess. Slice 4 is where that lives, and it comes *before* the Ask on purpose.

---

## Register & Ask slice 1 — the obligations fold

**Goal:** one honest list of what the household owes this month.

**Branch:** `register/1-obligations` · **PR:** `feat(register): the month's obligations, folded once`

**Files:** new `src/core/monthObligations.ts`; new `test/month-obligations.test.ts`

```ts
export type ObligationSource = "recurrence" | "goal-claim" | "posted";

export type MonthObligation = {
  id: string;
  label: string;
  date: DateKey;
  amountCents: number;
  source: ObligationSource;
  recurrenceId: string | null;
  goalId: string | null;
  transactionId: string | null;
};

export type MonthObligations = {
  monthKey: string;
  rows: MonthObligation[];       // sorted by date, then id
  owedCents: number;
  tiesToProjection: boolean;
};

export function monthObligations(household: Household, monthKey: string, today: DateKey): MonthObligations;
```

**Rules:**
- Reuse the **same** recurrence projection `projectHouseholdFund` uses for `upcomingReserveCents`. Do not write a second projection.
- `goal-claim` rows are **claims on the pool**, never a second balance (D-161/D-173). A goal contributes at most its planned monthly claim.
- `posted` rows are `purchase-funded` transactions already in the month.
- No double counting: a posted transaction that satisfies a recurrence appears once, as `posted`.
- `tiesToProjection` folds every active event and demands the projection's own answer. When false, downstream renders an empty state — never a guess.

**Tests:** a command-driven month with two recurrences, one goal claim and one posted purchase → exact rows and `owedCents`; a duplicate-suppression case; a `tiesToProjection: false` case; a source fence that this module never imports a second projection.

---

## Register & Ask slice 2 — the register fold

**Goal:** apply money to obligations in the order it arrived, and show what each contribution paid for.

**Branch:** `register/2-fold` · **PR:** `feat(register): what each contribution actually paid for`

**Depends on:** slice 1

**Files:** new `src/core/contributionRegister.ts`; new `test/contribution-register.test.ts`

```ts
export type RegisterSource = {
  kind: "carried" | "contribution";
  eventId: string | null;          // null for carried
  memberId: string | null;         // contributorMemberId
  date: DateKey;
  amountCents: number;
};

export type RegisterSegment = { sourceIndex: number; amountCents: number };

export type RegisterRow = {
  obligationId: string;
  label: string;
  date: DateKey;
  amountCents: number;
  segments: RegisterSegment[];     // in arrival order
  unfundedCents: number;
};

export type ContributionRegister = {
  monthKey: string;
  sources: RegisterSource[];       // arrival order: carried first, then confirmed contributions by date, then createdAt
  rows: RegisterRow[];
  carriedCents: number;
  byMember: Array<{ memberId: string; amountCents: number }>;   // totals only
  owedCents: number;
  unfundedCents: number;
  tiesToProjection: boolean;
};

export function contributionRegister(household: Household, monthKey: string, today: DateKey): ContributionRegister;
```

**Rules — each is a test:**
- **Arrival order, FIFO.** Money is applied to obligations in date order; each obligation draws from the earliest source with a remaining balance.
- Per row: `sum(segments) + unfundedCents === amountCents`. Exactly.
- Per source: the total drawn across all rows never exceeds that source's `amountCents`.
- `owedCents === sum(rows.amountCents)` and `unfundedCents === sum(rows.unfundedCents)`.
- `carriedCents + sum(sources where kind==="contribution") + unfundedCents === owedCents`.
- Only **confirmed** contributions are sources. Proposals and holds are invisible here.
- **No ratio.** No exported field, no local variable, no comment computes a share between members.

**Tests:** the worked scenario below, exactly; a scenario with one member only; a scenario where money exceeds obligations (`unfundedCents === 0`, sources partly undrawn); and the **no-ratio source fence**: read `contributionRegister.ts` and assert it contains none of `percent`, `Percent`, `ratio`, `Ratio`, `share`, `Share`, `/ total`.

**The canonical scenario — build it through commands and assert every number.** September 2026, viewed the 12th, synthetic:

| Obligation | Date | Amount | Expected funding |
|---|---|---:|---|
| Hydro | 04 Sep | 128.00 | carried 128 |
| Rent · our share | 05 Sep | 1,450.00 | carried 112 · B 980 · J 358 |
| Insurance | 10 Sep | 186.00 | J 177 · B 9 |
| Groceries · planned | 15 Sep | 520.00 | B 520 |
| Internet | 20 Sep | 92.00 | B 92 |
| Gas | 22 Sep | 74.00 | B 74 |
| Phone | 25 Sep | 110.00 | B 110 |
| Vet · Marmalade | 26 Sep | 215.00 | B 175 · **unfunded 40** |
| Halifax · goal claim | 30 Sep | 300.00 | **unfunded 300** |

Sources in arrival order: carried 240 (01 Sep) · Bianca 980 (04 Sep) · Jonathan 310 (06 Sep) · Jonathan 225 (11 Sep) · Bianca 980 (18 Sep).

Assert: `owedCents === 307500`, `unfundedCents === 34000`, `carriedCents === 24000`, `byMember` = Bianca 196000 and Jonathan 53500, and `196000 + 53500 + 24000 + 34000 === 307500`.

**Decision to log** (claim the next free D-number — Appendix B)**: the register never computes a share.** *Attribution and totals are shown. Percentages, ratios, and member-vs-member rankings are not computed anywhere, at any layer. Enforced by source fence.*

---

## Register & Ask slice 3 — purpose labels

**Goal:** a contribution can say what it was for, without creating a second pot.

**Branch:** `register/3-purpose` · **PR:** `feat(fund): purpose is a label on money, not a partition of it`

**Depends on:** slice 2

**Files:** modify `src/core/types.ts`, `src/core/householdFund.ts`, `src/core/commands.ts`, `src/core/contributionRegister.ts`; new `test/contribution-purpose.test.ts`

**Add:** `purpose: string` (≤ 90 chars, trimmed) to `HouseholdFundEvent`, shaped and defaulted to `""`. Accept an optional `purpose` on `proposeHouseholdFundContribution`, carried through to the confirmed event.

**The rule that matters, stated in the module header comment verbatim:**
```
// A purpose is a label on money, not a partition of it (D-161, D-173, D-177).
// It never changes which obligation a dollar funds, never creates a balance,
// and never appears in any arithmetic. It is provenance the register can read back.
```

**Tests — this is the whole slice:**
- Build the canonical scenario **twice**: once with no purposes, once with a purpose on every contribution. Assert the two `ContributionRegister` results are **deeply equal except for the purpose strings**. Same segments, same unfunded, same totals.
- Assert `projectHouseholdFund` is byte-identical with and without purposes.
- Source fence: `contributionRegister.ts` never branches on `purpose`.

**Decision to log** (claim the next free D-number — Appendix B)**: an earmark is a label, not a partition.** *Contribution purposes are provenance for reading back. They never affect funding order, balances, or any derived number.*

**Do not:** sort, prioritise, or match obligations by purpose. That is the second-envelope trap.

---

## Register & Ask slice 4 — the run-rate finding (the discovery month)

**Goal:** Hearth learns what the house actually costs before it tells anyone what to contribute — and says plainly how sure it is.

**Branch:** `register/4-run-rate` · **PR:** `feat(register): what the house actually costs, and how sure we are`

**Depends on:** slice 2

**Files:** new `src/core/houseRunRate.ts`; new `test/house-run-rate.test.ts`

```ts
export const RUN_RATE_MIN_WEEKS = 3;

export type RunRateConfidence = "watching" | "provisional" | "settled";

export type HouseRunRate = {
  weeksWatched: number;
  confidence: RunRateConfidence;        // <3 watching · 3–7 provisional · ≥8 settled
  observedMonthlyCents: number;         // what the house has actually cost, annualised to a month
  lowMonthlyCents: number;              // the calm month
  highMonthlyCents: number;             // the expensive month
  byCategory: Array<{ subcategoryId: string; label: string; monthlyCents: number; weeksSeen: number }>;
  suggestion: RunRateSuggestion | null; // null while "watching"
  copy: string;
};

export type RunRateSuggestion = {
  monthlyNeedCents: number;
  note: string;                          // never an instruction
};

export function houseRunRate(household: Household, today: DateKey): HouseRunRate;
```

**Rules:**
- Below `RUN_RATE_MIN_WEEKS`, `confidence` is `"watching"`, `suggestion` is `null`, and `copy` says so. **Never extrapolate from under three weeks.**
- Only money that actually moved through the Fund counts. Plans and intentions do not.
- The suggestion is a **need for the household**, never a per-person number and never a split. Splitting is the charter's job, not this module's.
- `low`/`high` come from observed spread, not a fixed percentage.

**Copy (exact):**
- watching: `"Three weeks in, I'll have a first read on what the house costs. Right now I've watched {n}."`
- provisional: `"On {n} weeks, the house looks like about {mid} a month — somewhere between {low} and {high}. Ask me again at the end of the month."`
- settled: `"The house has run about {mid} a month across {n} weeks."`

**Tests:** a 1-week household → `watching`, `suggestion === null`; a 5-week household → `provisional` with a suggestion; a 10-week household → `settled`; a fence that no copy string contains `should contribute` or `you need to put in`.

**Decision to log** (claim the next free D-number — Appendix B)**: the discovery month.** *Hearth does not assume a contribution level. It observes what the household actually spends for at least three weeks, reports its own confidence, and offers a household-level need — never a per-person instruction.*

---

## Register & Ask slice 5 — the Ask

**Goal:** the tail of the register, said out loud, at two horizons.

**Branch:** `register/5-ask` · **PR:** `feat(ask): the month still needs`

**Depends on:** slices 2 and 4

**Files:** new `src/core/ask.ts`; new `test/ask.test.ts`

```ts
export type AskHorizon = "month" | "payday";

export type HouseholdAsk = {
  horizon: AskHorizon;
  throughDate: DateKey;
  askCents: number;
  register: ContributionRegister;       // the source, carried so nothing recomputes
  confidence: RunRateConfidence;        // from houseRunRate — honesty about the inputs
  copy: string;
};

export function householdAsk(household: Household, today: DateKey, horizon?: AskHorizon): HouseholdAsk;
export function nextPaydayDate(household: Household, memberId: string, today: DateKey): DateKey | null;
```

**Rules — non-negotiable:**
- **The Ask is derived, never recomputed.** `askCents` for the month horizon must be *exactly* `register.unfundedCents`. Assert equality in a test. If they can ever differ, the design is wrong.
- The **month horizon is primary.** The payday horizon is the same fold truncated at `nextPaydayDate` for the custodian, and is a **secondary line**, never the headline.
- `nextPaydayDate` uses the existing `WorkPaySchedule` / `projectCadence` cadence. It projects **timing only** — it must never assume a contribution amount. Bianca's amount varies by design.
- When `confidence === "watching"`, the Ask still shows its number and appends the run-rate caveat.
- Zero and negative are real answers: `askCents === 0` renders **"September is covered."**

**Copy (exact):**
- `"September still needs {amount}."`
- secondary: `"{amount} of that lands before the {n}th."`
- covered: `"September is covered."`
- watching: `"September still needs {amount} — though I've only watched {n} weeks of this house."`

**Tests:** canonical scenario → `askCents === 34000` and `=== register.unfundedCents`; a covered month → 0 and the covered copy; a payday-horizon case; a fence that `ask.ts` contains no arithmetic over obligations (it must import the register and read it).

**Decision to log** (claim the next free D-number — Appendix B)**: the Ask is the register's tail, not a second calculation.**

---

## Register & Ask slice 6 — the other door

**Goal:** the Ask always offers wanting less, beside working more.

**Branch:** `register/6-other-door` · **PR:** `feat(ask): the other door`

**Depends on:** slice 5

**Files:** modify `src/core/ask.ts`; new `test/ask-alternatives.test.ts`

```ts
export type AskAlternative = {
  goalId: string;
  label: string;
  claimCents: number;         // this month's claim sitting inside the tail
  askIfDeferredCents: number; // what the Ask becomes if this month's claim moves
  copy: string;
};

export function askAlternatives(ask: HouseholdAsk): AskAlternative[];  // largest claim first
```

**Rules:**
- Only `goal-claim` obligations that are **partly or wholly unfunded** can be alternatives. A bill is never an alternative — Hearth does not suggest skipping the hydro.
- Deferring is a **motion**, exactly like any other: proposed by one, confirmed by the other. Nothing moves on tapping.
- Alternatives are shown **every time the Ask is shown**, not only when the number is large. That is the guardrail.

**Copy (exact):** `"Or move {goal} to next month, and the ask is {amount}."`

**Tests:** canonical scenario → one alternative, Halifax, `askIfDeferredCents === 4000`; a scenario where the tail is all bills → empty array; a fence that no bill-source obligation can appear.

**Decision to log** (claim the next free D-number — Appendix B)**: the Ask always shows the other door.** *Every presentation of a shortfall offers deferring a goal claim beside earning more. Bills are never offered as alternatives.*

---

## Register & Ask slice 7 — routes

**Goal:** turn the Ask into candidate shifts — honestly, or not at all.

**Branch:** `register/7-routes` · **PR:** `feat(ask): which nights close it`

**Depends on:** slices 5, 6

**Files:** new `src/core/askRoutes.ts`; new `test/ask-routes.test.ts`

```ts
export const ROUTE_MAX_SHIFTS = 4;

export type RouteShift = { date: DateKey; weekday: number; meal: TipMeal; hours: number; safeCents: number; expectedCents: number };

export type AskRoute = {
  shifts: RouteShift[];
  hours: number;
  safeCents: number;        // sum of p10 — the headline
  expectedCents: number;    // sum of p50 — the whisker
  clearsAtSafe: boolean;
  shortfallCents: number;   // 0 when it clears
};

export type AskRoutesResult =
  | { kind: "routes"; askCents: number; routes: AskRoute[]; watchedShifts: number }
  | { kind: "not-enough-data"; askCents: number; watchedShifts: number; copy: string };

export function askRoutes(household: Household, input: {
  askCents: number; memberId: string; from: DateKey; to: DateKey;
}): AskRoutesResult;
```

**Rules — these are the honesty of the feature:**
- Build candidates from `weekdayCadenceMap()` — **only nights he actually works.** Never invent a Monday he has never worked.
- Price each candidate with the existing `shiftOutlook()`. **`safeCents` is the low (p10) figure. The headline is always the safe number.** Never rank or headline on the expected number.
- **Refuse below a sample.** If `observeTipShifts(household, memberId).length < SHIFT_ORACLE_MIN_SHIFTS` (already 4 in `shiftGlance.ts`), return `kind: "not-enough-data"`. Do not return a low-confidence route.
- Sort: routes that clear at safe first, then fewest hours, then fewest shifts, then earliest finish.
- Return at most 4 routes and at most `ROUTE_MAX_SHIFTS` shifts per route. Include **one route that does not clear** when a plausible cheaper one exists — the honest near-miss is information.
- `askRoutes` never mutates and never posts. It suggests nothing to the calendar.

**Copy (exact):**
- not-enough-data: `"I've only watched {n} of your shifts. Ask me again in a few weeks — I'd be guessing."`
- clears: `"clears · {amount} spare"`
- near miss: `"short {amount}"`
- header: `"bars are your safe number · whiskers reach the good night"`

**Tests:** a household with 12 posted shifts and a $340 ask → the top route clears at safe and is the fewest hours; a household with 3 posted shifts → `not-enough-data`; a fence that `askRoutes.ts` never headlines `expectedCents` and contains no string matching `you should work` / `pick up` / `need to work`.

**Decision to log** (claim the next free D-number — Appendix B)**: quote the safe number, or refuse.** *Shift conversions are headlined at the low estimate and are withheld entirely below the minimum sample. Routes are options, never instructions.*

---

## Register & Ask slice 8 — the register drawing

**Goal:** the register, drawn, at true width.

**Branch:** `register/8-drawing` · **PR:** `feat(register): the register, drawn`

**Depends on:** slices 2, 3

**Files:** new `src/core/registerView.ts`, `src/Register.tsx`, `src/register.css`; new `test/register-view.test.ts`

**`registerView.ts` — the geometry rule, assertable:**
```ts
export const REGISTER_VIEW = {
  width: 900, barLeft: 250, barRight: 810, rowHeight: 30, barHeight: 13,
  labelLeft: 0, dateLeft: 152, valueRight: 890,
} as const;

export function registerScale(maxRowCents: number): number;   // (barRight - barLeft) / maxRowCents
export function segmentWidth(cents: number, scale: number): number;
```
**The scale is shared by every row.** That is the whole point of the drawing — a $128 bar and a $1,450 bar are comparable because one scale governs both. Assert it.

**Render:** one row per obligation — label, date, bar, amount. Bar segments in arrival order using `--reg-carried` / `--reg-hers` / `--reg-his`. Unfunded = dashed `--copper` outline, no fill. Then a rule, then totals: the month owes, each member's total, carried in.

**Rules:**
- Build the mock at the **real render width**, not a convenient one. A drawing verified at the wrong scale is a lie — this has already happened twice on this project.
- When `tiesToProjection === false`, render an empty staff with an honest line, not a partial drawing.
- The drawing is horizontally scrollable inside its own container; the page body never scrolls sideways.

**Tests:** `registerScale` for the canonical month; segment widths sum to the row width within 1px; a fence that `Register.tsx` renders no `%` character in any data-bearing string.

---

## Register & Ask slice 9 — the Ask panel

**Goal:** the number, the routes, and the other door, on Jonathan's desk.

**Branch:** `register/9-ask-panel` · **PR:** `feat(ask): the Ask on the desk`

**Depends on:** slices 5, 6, 7, 8

**Files:** new `src/core/askView.ts`, `src/Ask.tsx`, `src/ask.css`; modify `src/OfficeWide.tsx`; new `test/ask-panel.test.ts`

**Layout, top to bottom:** the figure (`$340.00`, display face, `--copper`) · the one-line sentence · the payday secondary line · the routes drawing · **the other door, always visible, never behind a toggle** · the run-rate caveat when confidence is not `settled`.

**`askView.ts`:** `ROUTE_VIEW` constants and `routeScale(maxCents, room)` in the same style as `monthSpread.ts`. Bars are the safe number; whiskers reach expected; a dashed vertical line marks the ask.

**Rules:**
- Placement: **Jonathan's desk only.** This panel must not render on the custodian's default surface. See Till slice 4.
- Never render an imperative. No "work", no "pick up", no "you need to".
- The `not-enough-data` state renders the number and the refusal copy — it does **not** hide the panel.

**Tests:** a fence that `Ask.tsx` contains none of `you should`, `you need to`, `pick up a shift`; a `not-enough-data` render still shows the amount; evidence at all four breakpoints, both themes.

---

## Register & Ask slice 10 — the metronome

**Goal:** one new mark type on the Course makes the whole economics legible.

**Branch:** `register/10-metronome` · **PR:** `feat(month spread): her paydays as ticks, his contributions as marks`

**Depends on:** slice 5 (for `nextPaydayDate`)

**Files:** modify `src/core/monthSpread.ts`, `src/MonthSpread.tsx`, `src/month-spread.css`; modify `test/month-spread.test.ts`

**Add:** `paydayTicks(household, monthKey)` returning the custodian's projected pay dates in the month, and a `tick` mark type drawn on the axis — a short vertical rule, `--felt`, below the axis line, unlabelled except at the first.

**Rules:**
- Ticks mark **timing only.** They carry no amount, no height, no value. Bianca's contribution amount varies and the drawing must not imply otherwise.
- Contribution marks keep their existing treatment. The contrast — a regular tick versus an irregular mark — *is* the information.
- Do not change `courseScale`, `courseTop`, `courseBottom`, or any existing assertion. The conservation tests must pass untouched.

**Tests:** ticks land on the projected cadence dates; a fence that no tick carries an amount; the existing month-spread suite passes unmodified except for the new cases.

---

## Register & Ask slice 11 — the ceiling, enforced

**Goal:** the number Bianca answered in the Charter actually restrains what the Ask offers.

**Branch:** `register/11-ceiling` · **PR:** `feat(ask): the charter ceiling restrains the routes`

**Depends on:** slices 5, 6, 7, and the Charter record

> **Why this slice exists.** The audit of `origin/main` @ `6f5dd56` found that `ceilingKind` and `ceilingValue` are collected in founding, stored on the charter, shaped, labelled by `charterCeilingLabel()`, and rendered on the charter page — and referenced **nowhere** in `ask.ts`, `askRoutes.ts`, `askView.ts`, or `Ask.tsx`. The ceiling is a sentence on a page. A household can agree "24 hours a week" and the routes instrument will still headline a 31-hour week. **This was the guardrail that made the Ask the earner's instrument rather than a boss's, and it shipped as decoration.** This slice closes it.

**Files:** modify `src/core/askRoutes.ts`, `src/core/askView.ts`, `src/Ask.tsx`; new `test/ask-ceiling.test.ts`

```ts
// askRoutes.ts
export type CeilingVerdict =
  | { kind: "none" }                                        // charter has no ceiling
  | { kind: "within"; ceilingLabel: string }
  | { kind: "over"; ceilingLabel: string; byHours: number }  // hours-per-week ceilings
  | { kind: "over"; ceilingLabel: string; byCents: number }; // amount-per-month ceilings

export type AskRoute = { /* … existing … */ ceiling: CeilingVerdict };

export function routeCeilingVerdict(household: Household, route: AskRoute, from: DateKey): CeilingVerdict;
export function everyRouteOverCeiling(result: AskRoutesResult): boolean;
```

**Rules — each is a test:**
- The ceiling is read from `household.charter` only. **If there is no charter, or `ceilingKind === "none"`, every verdict is `{ kind: "none" }` and nothing changes.** A household that has not agreed a ceiling is not given one.
- `hours-per-week`: sum a route's hours **inside each ISO week it touches**, and compare each week separately. A route spanning a week boundary is judged per week, not in total.
- `amount-per-month`: compare the route's `safeCents` against the ceiling for the target month.
- **A route over the ceiling is never the headline.** Sort order becomes: clears-at-safe **and** within ceiling → clears-at-safe but over ceiling → does not clear. Within each group, fewest hours as before.
- **When every route is over the ceiling, the routes drawing is not rendered at all.** `askRoutes` still returns them for the record, but `askPanelView` sets a new presentation and the panel shows the other door instead. This is the "app takes your side" behaviour, made mechanical.
- The ceiling never lowers, trims, or alters a proposed amount. It only changes what is *offered* and in what order.

**Copy (exact — add to the deck):**
- over, hours: `"That's {byHours} hours past what you two agreed was too much."`
- over, amount: `"That's {byAmount} past what you two agreed was too much."`
- every route over: `"Every way I can see to close this is more than you two agreed to work. Moving a goal is the better answer here."`
- no ceiling agreed: nothing is said. Silence, not a prompt to set one.

**Tests (`test/ask-ceiling.test.ts`, lane `test:fast`):**
- a charter with `ceilingKind: "none"` produces identical routes to today's behaviour, byte for byte
- an hours ceiling of 24 marks a 15.5-hour route `within` and a 31-hour route `over`
- a route spanning a week boundary is judged per week — 20 hours split 12/8 across two weeks is `within` a 16-hour ceiling
- with every route over, `askPanelView` renders no routes drawing and the alternatives are present
- a source fence: `askRoutes.ts` contains `charter` and `ceiling`, and `Ask.tsx` contains none of `you should`, `you need to`, `pick up a shift`

**Decision to log** (claim the next free D-number — Appendix B)**: an agreed ceiling restrains what the Ask offers.** *When a household has recorded a work ceiling in its charter, routes that exceed it are never headlined, and when every route exceeds it the instrument offers the goal instead of the hours. A household with no agreed ceiling is never given one.*

**Do not:** invent a default ceiling, prompt for one, alter a proposed budget amount, or hide the routes from the record. The routes still exist; only the offer changes.

---

# PART 3 — THE TILL

*Four slices. Bianca's surface. She holds the card and she posts most of the household's spending — she is the most active poster in the house, so this is not a smaller app. Craft here must be **at least** as good as the desk's.*

---

## Till slice 1 — the custody fence

**Goal:** the person without the card cannot post a purchase from it. In the model, not the UI.

**Branch:** `till/1-custody-fence` · **PR:** `fix(fund): only the custodian may post a household purchase`

**Files:** modify `src/core/commands.ts`; new `test/custody-fence.test.ts`

**Rule:** any command that creates a `purchase-funded` event — posting an entry with `funding` against the Household Fund — must call `requireFundCustodian(household, input.memberId)` and throw for anyone else.

**What is *not* fenced** (Jonathan must keep all of this): proposing a contribution, confirming his own settlement, posting his shifts, annotating, reading everything, raising any motion, deferring a goal claim as a motion.

**Copy (exact):** `"Only the person holding the card can post a household purchase."`

**Tests:** custodian posts a Fund-backed purchase → succeeds; non-custodian → `ValidationError` with that exact message; non-custodian can still propose a contribution and post a shift → succeeds; a source fence that the `purchase-funded` path contains `requireFundCustodian`.

**Decision to log** (claim the next free D-number — Appendix B)**: posting a household purchase is a custody act.** *Only the fund custodian may record spending from the shared card. This is enforced in the command layer, not by hiding a button.*

---

## Till slice 2 — the swipe

**Goal:** record a purchase in two taps, standing at a counter, in about ten seconds.

**Branch:** `till/2-swipe` · **PR:** `feat(till): post a swipe in two taps`

**Depends on:** slice 1

**Files:** new `src/Swipe.tsx`, `src/swipe.css`; modify shared-home nav; new `test/swipe.test.ts`

**The flow, and nothing more:**
1. **Amount** — the existing CAD pad, opened focused. This is tap one.
2. **Where** — a row of the six categories she has actually used most this month, from real history, plus `More`. This is tap two. **Done.**

**Rules:**
- **Text only this month.** No camera, no receipt image, no OCR, no attachment. That is a later slice and is out of scope here.
- Posted immediately as a `purchase-funded` claim against the Fund. It is a claim, not a settlement — it does not move money (custody law 1).
- Undo available for 10 seconds inline; after that it is edited in the record like anything else.
- Offline-safe: queues and replays like every other write. Never blocks on network.
- The six categories are **observed, not configured.** No setup screen.
- Works one-handed at 390px. Nothing important below the fold.

**Copy (exact):**
- title: `"What did you just spend?"`
- after: `"Posted. Nothing moved."`
- undo: `"Undo"`

**Tests:** a command-driven scenario posting through the same path the UI calls; a projection test proving the swipe changed no balance; a fence that `Swipe.tsx` contains no `camera`, `file`, `image`, or `ocr`; evidence at 320 and 390 with keyboard and reduced-motion.

---

## Till slice 3 — the Till surface

**Goal:** her whole app, on one screen, with the swipe first.

**Branch:** `till/3-surface` · **PR:** `feat(till): the custodian's surface`

**Depends on:** slice 2

**Files:** new `src/Till.tsx`, `src/till.css`; modify `src/core/kitchen.ts` nav; new `test/till.test.ts`

**The screen, in this order — the order is the design:**
1. **The swipe button.** Largest thing on the screen. Her primary act.
2. **Waiting on you** — motions to Confirm or Hold. Absent entirely when empty; no zero-state card, no "0 items".
3. **The standing line:** `"Nothing has moved."` Always true, always there, quiet.
4. **This month, in one line** — what the house has spent so far. No chart.
5. **The door**, at the foot: `"see everything"` — one line, permanent, unobtrusive, no settings, no confirm dialog. It goes to the full desk.

**Rules:**
- **Identical rights, identical data.** The Till hides nothing. It is a *default surface*, not a permission tier.
- **Never reads as "lite."** Same type scale, same craft, same tokens as the desk.
- **The Ask never appears here.** Nothing on this surface reports Jonathan's workload to Bianca. (See Part 0, law 4's sibling: the Ask informs the person doing the work; it never reports on them.)
- Empty state — no motions, no spending yet — must be genuinely good and closeable in four seconds.

**Tests:** a fence that `Till.tsx` never imports `Ask` or `askRoutes`; an empty-household render contains no zero-state card; the `"see everything"` string is present and is a focusable link; evidence at all four breakpoints, both themes.

---

## Till slice 4 — the surface preference

**Goal:** which surface you land on is yours alone to choose.

**Branch:** `till/4-preference` · **PR:** `feat(till): the landing surface is a member's own choice`

**Depends on:** slice 3

**Files:** modify `src/core/types.ts`, `src/core/household.ts`, `src/core/commands.ts`; new `test/surface-preference.test.ts`

**Add:** `landingSurface: "desk" | "till"` to the member-personal record, defaulting to `"till"` for the fund custodian and `"desk"` for everyone else.

```ts
setLandingSurface(household, input: { memberId: string; surface: "desk" | "till" }): CommitResult
```

**Rules — assert every one:**
- **A member may only set their own.** Setting another member's surface throws: `"Only you can choose where you land."`
- Changing it is instant, reversible, and requires no confirmation from anyone.
- The `"see everything"` door is a **peek** — it does not change the preference. Changing the preference is a separate, explicit act.
- The default is a default, never a lock. Nothing in the app may present the Till as assigned.

**Tests:** self-set succeeds; cross-set throws with that message; the door does not mutate the preference; a fence that no code path sets `landingSurface` for a member other than the caller.

**Decision to log** (claim the next free D-number — Appendix B)**: the landing surface is member-owned.** *Each member chooses their own default surface. No member can set another's. The Till is a default, never a restriction, and the full desk is always one permanent link away.*

---

# PART 4 — THE CLERK

*Four slices. Hercules reads the record and prepares the papers. He does not vote.*

---

## Clerk slice 1 — the reading

**Goal:** three or four sentences on what changed since the last stamp, every one of them citing its rows.

**Branch:** `clerk/1-reading` · **PR:** `feat(clerk): the reading, with citations`

**Files:** new `src/core/clerkReading.ts`; new `test/clerk-reading.test.ts`

```ts
export type ClerkSentence = {
  id: string;
  text: string;
  transactionIds: string[];
  fundEventIds: string[];
};

export type ClerkReading = {
  since: DateKey;
  today: DateKey;
  sentences: ClerkSentence[];    // 3–4
  tiesToProjection: boolean;
};

export function clerkReading(household: Household, since: DateKey, today: DateKey): ClerkReading;
```

**Rules — the fences are the feature:**
- **Every sentence cites at least one row.** A sentence with an empty citation list is dropped, not rendered. Assert this.
- **No proposed amount.** The reading may state what happened (`"groceries ran $180 over the shape of the last three months"`). It may not state what to do (`"you should move $180"`).
- **No work instruction.** It may never mention shifts, hours, or working more. That belongs to the Ask, on Jonathan's own surface, at his own request.
- Grounded on-device from the journal. This slice adds **no** model call.
- When `tiesToProjection` is false, the reading is withheld with an honest line rather than published.

**Tests:** every returned sentence has ≥1 citation; a source fence that `clerkReading.ts` contains none of `should move`, `you should`, `recommend`, `shift`, `hours`, `work more`; a scenario asserting the exact sentences for the canonical month.

**Decision to log** (claim the next free D-number — Appendix B)**: the clerk quotes, never proposes.** *Clerk output cites household rows, states no proposed amount, and never mentions working more. A sentence without a citation is not rendered.*

---

## Clerk slice 2 — citations, tappable

**Goal:** tap a claim, see the rows it came from.

**Branch:** `clerk/2-citations` · **PR:** `feat(clerk): tap a sentence, see its rows`

**Depends on:** slice 1

**Files:** new `src/ClerkReading.tsx`, `src/clerk-reading.css`; new `test/clerk-citations.test.ts`

**Rules:** each sentence is a focusable control; activating it reveals the exact rows inline (never a modal on mobile); the rows are the real ledger rows, linked into the record; keyboard and screen-reader complete.

**Copy:** `"the rows this came from"`

**Tests:** keyboard traversal reaches every sentence; the revealed rows match the sentence's citation ids exactly; evidence at all four breakpoints.

---

## Clerk slice 3 — the fences, tested

**Goal:** make the clerk's limits assertable rather than aspirational.

**Branch:** `clerk/3-fences` · **PR:** `test(clerk): the clerk may not propose`

**Depends on:** slices 1, 2

**Files:** new `test/clerk-fences.test.ts`; modify `scripts/verify-ai-surface.mjs`

**Add to `pnpm ai:verify`:** a check that no clerk-owned module or component emits a proposed amount or an imperative about work. Fail the build if it does — the same weight as a type error.

**Tests:** run `clerkReading` across a spread of synthetic households and assert **no output sentence** matches `/\b(should|need to|recommend|suggest)\b/i` or `/\b(shift|hours|work more)\b/i`; assert the clerk never appears in any code path that writes money.

---

## Clerk slice 4 — the weekly, async, about the Ask

**Goal:** a check-in that survives one person not showing up, and that has a reason to exist.

**Branch:** `clerk/4-weekly` · **PR:** `feat(ritual): the weekly, async, about the Ask`

**Depends on:** slices 1–3, and Register & Ask slices 5–7

**Files:** modify `src/SitDownGuide.tsx` and the existing `SitDownSession` acts; new `src/core/weeklyDocument.ts`; new `test/weekly.test.ts`

**The weekly is a document that fills in over hours, not a meeting:**
- **Act 0 — the reading.** The clerk's sentences, cited. New.
- **Act 1 — the month so far.** The register.
- **Act 2 — the ask.** The number, the routes, **and the other door.**
- **Act 3 — what we're doing.** Motions raised. It stamps either way.

**Rules:**
- **It completes unsigned.** One person can read, place and stamp; the other's line stays blank. Never blocked, never nagged.
- Act 2 renders the Ask **only for the member whose ask it is.** For the other member, Act 2 shows the number and the motions raised — never a route, never an hours figure. This is the guardrail from the plan.
- Reuse the existing acts machinery and the `"sunday"` `kettlePhase` — do not build a parallel ritual system.
- **Do not build the co-present mode.** Out of scope, deliberately.

**Tests:** a weekly stamps with one signature; the non-owning member's Act 2 render contains no route and no hours string; the cadence comes from the charter (`cadence: "none"` means no weekly is offered at all).

---

# PART 5 — THE DEMO

---

## Demo slice 1 — the seed

**Goal:** four months of synthetic history so the record has something to be moving about.

**Branch:** `demo/1-seed` · **PR:** `feat(seed): four months of household history`

**Depends on:** everything above

**Files:** modify `src/core/seed.ts`; new `test/demo-seed.test.ts`

**Rules:**
- Build **entirely through the real commands**, exactly as `seedHouseholdFund` already does. Never hand-write state — that is how custody rules get silently broken in a seed.
- **Bianca's contributions vary month to month.** A constant amount would misrepresent the product. Show the discovery arc: months 1–2 are rough, months 3–4 settle.
- Include: at least one held motion, one deferred goal claim, one unsigned charter line, one month that was covered without an ask, and one month with a real ask.
- 100% synthetic. No real household rows, ever.
- The final month must reproduce the canonical September figures from Register & Ask slice 2 so the drawings match this manual.

**Tests:** the seeded household ties (`tiesToProjection === true`) in every month; the September register matches the canonical table exactly; the seed touches no real data path.

---

## Demo slice 2 — the walk

**Goal:** six beats, about six minutes, rehearsed until boring.

**Branch:** `demo/2-walk` · **PR:** `docs(demo): the walk`

**Depends on:** slice 1

**Files:** new `docs/DEMO_WALK.md`

**The six beats, in order — no personal ledger appears at any point:**

1. **"This is a household, not an account."** Open on the Charter. Two names, one custodian, and the split rule in her words. Nobody in fintech opens on a document.
2. **"One of them is paid by a clock."** The Course, with the metronome. Her paydays are ticks; his marks move.
3. **"So here's what your work paid for."** The register. Point at the rent bar — carried, hers, his. Then run a finger to the dashed tail.
4. **"And here is what that costs."** $340.00 becomes a Friday and a Saturday. Then tap **the other door**: *or move Halifax, and it's $40.*
5. **"She's the one with the card."** Second device — a real second phone, not a resized window. The Till. A swipe posted in ten seconds, a motion confirmed. *Nothing moved until she said so.*
6. **"The AI reads. It doesn't decide."** The weekly reading, tappable through to rows. Close on: **"Hearth cannot move a cent of this, and it cannot make anyone work a shift. It can only tell you the truth about both."**

Beats 4 and 5 are the ones that close it. Rehearse those twice as often.

---

# PART 5 — THE FUND AT THE CENTRE

*Twelve slices. The Household Fund becomes the face of the shared home: one pace instrument, a rail of swappable widgets, and a stage that changes with the widget you pick.*

**Visual source of truth:** the workshop artifact **"The Fund at the Centre"** (`claude/hearth-fund-workshop-2026-09-02.html` in the project). Every screen in this Part is drawn there at true device width. **Where prose and a drawing disagree, the drawing is the intent.** `HEARTH_UX_PACKET.md` §14 carries the geometry constants.

**The through-line, and the reason slice 1 comes first:** every widget below reads from **one balance walk**. The Level draws it, Next out tabulates it, Spoken for slices it, the consequence line re-runs it with a motion confirmed. **Nothing in this Part recomputes a balance.** If two widgets can ever disagree about the Fund, the design is wrong.

**Decisions Jonathan settled on 2026-09-02, carried into these slices:**
- Lead with the dry date. It is the honest headline.
- Rails differ by role by default; **all fourteen widgets stay in the drawer for both members.**
- The Level **projects from day one**, and says out loud that day-one forecast is only the bills that were typed in.
- The rail is **fixed at eight** on desk, six on phone. It never scrolls.
- The stage **remembers within a session and resets to the Level on a new day.**
- **The week ships now**, built as a forward view rather than a record of a ritual.

---

## Fund slice 0 — the fold

**Goal:** decide the fate of the six shared plates already on the floor, once, before fourteen new ones arrive beside them.

**Branch:** `fund/0-fold` · **PR:** `refactor(desk): fold the shared plates into the Fund library` · **Owner:** Codex · **Risk: med**

**Read first:** `src/core/deskPlates.ts` — `SHARED_PLATE_IDS` and the whole `sharedPlates()` body (`:130–290`) · `src/DeskPlates.tsx` · `src/OfficeWide.tsx:460–500`.

> **Why this slice exists.** The shared floor already carries six plates: `due · cards · owed · saving · coming · trust`. Dropping fourteen more beside them gives twenty, which is a menu, not a board. Four of the six are strictly better served by something in Part 5. **Two are worth reinventing, and one of those turns out to be a hole in the product.**

### The verdicts

| Existing | Was | Verdict |
|---|---|---|
| `due` | "What is due next" | **Retire.** `next-out` is the same question answered better — it carries the *Leaves* column, so it says which bill breaks the month rather than only which is next. |
| `saving` | "What we are saving toward" | **Retire.** `shelf` is the same `fill` over shared goals, and its stage adds what deferring a claim does to the month. |
| `coming` | "What is coming to the house" | **Absorb into `week`.** Appointments are not money, but they are the household's week. One calendar concept, not two — `week` gains an `appointment` entry kind. |
| `trust` | "Whether to trust this" | **Absorb into `record`.** Freshness and findings are the same question — *can I trust what I am looking at* — and answering it in two places invites them to disagree. `record` gains findings and the tie status. |
| `cards` | "What the cards are doing" | **Reinvent as `accounts`.** See Fund slice 10. |
| `owed` | "Who owes us" | **Reinvent as `settle`.** See Fund slice 11. |

### What this slice does

- Extends `SHARED_PLATE_IDS` to the Fund library of sixteen and removes `due` and `saving`.
- Moves `appointments` into the `week` model as an entry kind, and `findings` into the `record` model.
- **Preserves every selector.** `outstandingClaims`, `creditCardView`, `sharedGoals`, the appointments window and the findings list all keep working and keep their tests — only their *consumers* change. A fence asserts none of those functions were deleted.
- Adds a one-time arrangement migration: a member whose stored rail names a retired id gets the replacement in that slot (`due → next-out`, `saving → shelf`, `coming → week`, `trust → record`, `cards → accounts`, `owed → settle`). **Never drops a slot to seven.**

**Tests:** every retired id maps to exactly one replacement · a stored rail containing all six retired ids migrates to eight distinct widgets · `outstandingClaims`, `creditCardView` and `sharedGoals` still exist and still pass their own suites · the shared library is exactly sixteen with no duplicates.

**Decision to log** (claim the next free D-number)**: the shared floor has one plate library.** *The six original shared plates fold into the Fund library — two retired as duplicates, two absorbed into a wider widget, two reinvented. No selector is deleted; only its consumer changes.*

**Do not:** delete a selector, silently drop a member's slot, or leave two widgets answering the same question.

---

## Fund slice 10 — the accounts

**Goal:** one account you choose at a glance; every account you are allowed to see on the stage; one click into its books.

**Branch:** `fund/10-accounts` · **PR:** `feat(fund): the accounts` · **Owner:** Cursor · **Depends on:** 0, 3

**Read first:** `src/core/accountKinds.ts` · `creditCardView` in `deskPlates.ts` · `resolveSwipeCardAccount` in `src/core/swipe.ts` · `test/personal-books-privacy.test.ts` — **the privacy contract this slice must not breach.**

**Files:** new `src/core/accountsWidget.ts`, `src/AccountsStage.tsx`, `test/accounts-widget.test.ts`; modify `src/core/types.ts` (the chosen-account preference), `src/core/commands.ts`, `src/core/index.ts`

```ts
export type AccountScope = "shared" | "self-personal";
export type AccountRow = {
  accountId: string; name: string; kind: AccountKind; scope: AccountScope;
  balanceCents: number;
  utilization: number | null;      // credit cards only, 0–1
  isFundCard: boolean;
  booksTarget: { tab: HearthTab; accountId: string };
};
export function accountRows(household: Household, memberId: string): AccountRow[];
export function chosenAccount(household: Household, memberId: string): AccountRow | null;
setGlanceAccount(household, { memberId, accountId }): CommitResult
```

**Rules:**
- **The glance shows one account, and the member picks it.** Stored per member, self-owned — setting another member's choice throws `"Only you can choose what your board shows."`
- **Default:** the Fund's backing card for the custodian (via `resolveSwipeCardAccount`), the member's own everyday account otherwise. A default is a starting point, never a lock.
- **Scope is the whole slice.** `accountRows` returns shared accounts and **the viewer's own** personal accounts. **A partner's personal account never appears — not as a row, not as a count, not as a total.** A test asserts no partner-personal account id occurs anywhere in the serialized output.
- The stage groups by scope with a plain heading, shows balance, and shows a `gauge` only for credit cards. **Clicking any row opens that account's books page** via the existing navigation target — the widget navigates, it never renders a ledger of its own.
- **No household total across scopes.** Adding a shared balance to a personal one produces a number that means nothing and reads as a net worth. A fence asserts the module computes no cross-scope sum.
- The glance uses `gauge` for a card and `fill` otherwise — existing primitives, no new drawing.

**Tests:** the chosen account defaults correctly for each role · a cross-member `setGlanceAccount` throws · a partner-personal account is absent from every field of member A's output · clicking a row calls the books target once · no cross-scope total exists · screenshots at four breakpoints.

---

## Fund slice 11 — to settle

**Goal:** surface what the Fund owes back — and what is owed to the household. **This is a hole in the product today.**

**Branch:** `fund/11-settle` · **PR:** `feat(fund): what the Fund still owes` · **Owner:** Codex · **Depends on:** 0, 5 · **Risk: high**

**Read first:** `src/core/householdFund.ts` — `HouseholdFundProjection.transferDueCents` (`:61`), `destinationPositions` (`:74`, built at `:467`), `HouseholdFundDestinationPosition` · `confirmHouseholdFundSettlement` in `commands.ts` · `outstandingClaims` in the claims module.

> **Why this matters more than the plate it replaces.** When Bianca swipes the household card, the purchase is a **claim** — the card fronts the money and the Fund owes that account until a settlement is confirmed. `transferDueCents` and `destinationPositions` have existed in the projection all along and **nothing on the shared home has ever shown them.** The card-holder is carrying a balance the app knows about and never mentions.

**Files:** new `src/core/settleWidget.ts`, `src/SettleStage.tsx`, `test/settle-widget.test.ts`; modify `src/core/index.ts`

```ts
export type SettleOut = {           // the Fund owes an account
  destinationAccountId: string; name: string;
  dueCents: number; creditCents: number;
  transactionIds: string[];         // what makes it up
  oldestDate: DateKey;
};
export type SettleIn = {            // owed to the household
  claimId: string; label: string; remainingCents: number; sinceDate: DateKey;
};
export type SettleView = {
  out: SettleOut[];                 // dueCents desc, then oldest first
  in: SettleIn[];
  outTotalCents: number;            // the Fund's own obligation — a single-direction total, permitted
  inTotalCents: number;
  custodianCanSettle: boolean;
};
export function settleView(household: Household, memberId: string, today: DateKey): SettleView;
```

**Rules:**
- `out` comes from `destinationPositions` — **read it, never recompute it.** A fence asserts the module imports `projectHouseholdFund` and derives nothing of its own.
- `in` comes from `outstandingClaims` with `claimRemainingCents` — remaining, never the original bill.
- **Framing is a hard rule: the Fund owes the card. A person never owes.** Copy says `The Fund owes {account} {amount}` and never `{Name} owes`. A fence asserts the module and component contain no `/\bowes you\b|\byou owe\b/i` and no member name adjacent to "owes".
- **Settling is a custody act.** `custodianCanSettle` is true only for the fund custodian; the stage shows the Confirm-settlement control only then, and the underlying command already enforces it (D-197). The contributor sees the same figures and no button.
- The two directions are **never netted.** `outTotalCents` and `inTotalCents` are separate, and a combined figure is forbidden — they are different obligations to different parties.
- The glance uses `tally` when the count is countable and names the largest destination.

**Tests:** a household with two swiped purchases on one card produces one `out` row whose `dueCents` equals the projection's `destinationPositions` entry exactly · confirming a settlement reduces it and never touches the journal's balance · a non-custodian gets `custodianCanSettle: false` and no control renders · `outTotalCents` and `inTotalCents` are never combined anywhere · the "a person never owes" copy fence.

**Decision to log** (claim the next free D-number)**: the Fund owes the card, and the household is told.** *Outstanding destination positions are surfaced on the shared home. The obligation is always the Fund's to an account, never a person's to a person, and settling remains a custody act.*

---

## Fund slice 1 — the balance walk

**Goal:** one function that walks the Fund's operating balance across a month — solid behind, dashed ahead — and never invents an amount.

**Branch:** `fund/1-walk` · **PR:** `feat(fund): the month's balance walk` · **Owner:** Codex · **Risk: high**

**Read first:** `src/core/householdFund.ts` — `activeHouseholdFundEvents` (`:251`), `projectHouseholdFundOperatingBalanceBefore` (`:305`), `projectHouseholdFund` (`:370`), and the private `householdFundOperatingDelta` it uses · `src/core/monthObligations.ts` in full · `src/core/houseRunRate.ts` for the observe-don't-assume pattern · `test/contribution-register.test.ts` for the test shape.

**Files:** new `src/core/fundWalk.ts`, `test/fund-walk.test.ts`; modify `src/core/index.ts`

```ts
export const WALK_MIN_CONTRIBUTIONS = 3;
export const WALK_OBSERVATION_DAYS = 90;

export type WalkPointKind =
  | "opening" | "contribution" | "settlement" | "kitty" | "obligation";

export type WalkPoint = {
  date: DateKey;
  kind: WalkPointKind;
  label: string;
  deltaCents: number;          // signed
  balanceCents: number;        // running, after this point
  actual: boolean;             // false = projected
  estimated: boolean;          // true only for an observed contribution estimate
  memberId: string | null;     // whose contribution, when kind === "contribution"
  sourceId: string | null;     // fund event id, or obligation id
};

export type BelowBufferRun = { fromDate: DateKey; toDate: DateKey; days: number; lowCents: number };

export type InflowConfidence = "none" | "motions-only" | "observed";

export type FundWalk = {
  monthKey: MonthKey;
  today: DateKey;
  openingCents: number;
  points: WalkPoint[];              // date asc, then actual before projected, then sourceId
  todayBalanceCents: number;
  bufferCents: number;
  belowBufferRuns: BelowBufferRun[];
  bufferCrossDate: DateKey | null;  // first date at or after today below the buffer
  dryDate: DateKey | null;          // first projected date below zero
  endBalanceCents: number;
  shortfallCents: number;           // max(0, -endBalanceCents)
  inflowConfidence: InflowConfidence;
  hasConfirmedContribution: boolean;
  tiesToProjection: boolean;
};

export function fundWalk(household: Household, monthKey: MonthKey, today: DateKey): FundWalk;

export type WalkHypothetical = { confirmEventIds?: string[]; deferObligationIds?: string[] };
export function fundWalkWith(
  household: Household, monthKey: MonthKey, today: DateKey, hypothetical: WalkHypothetical,
): FundWalk;
```

### The rules — each one is a test

**1 · Actual points come only from confirmed events.** Every point with `actual: true` is an `activeHouseholdFundEvents` row with a non-zero operating delta, dated on or before `today`. `purchase-funded` and `refund-funded` are **claims, not operating movements** (D-161, D-173) and never appear as walk points.

**2 · The walk ties.** The running balance at `today` **must equal** `projectHouseholdFund(household, today).operatingBalanceCents`, exactly. Assert it directly. When it does not, `tiesToProjection` is `false` and every consumer renders an honest empty state rather than a drawing.

**3 · Projected outflows** are `monthObligations(household, monthKey, today).rows` dated after `today` that are not already settled, applied on their own dates as negative deltas with `kind: "obligation"`.

**4 · Projected inflows are found, never assumed.** In this order, and no other source is permitted:

| Source | `estimated` | Condition |
|---|---|---|
| a confirmed contribution dated after today | `false` | always |
| an **open contribution motion** at its stated amount | `false` | the proposal exists and is unconfirmed and unheld |
| an **observed contribution estimate** on that member's projected pay dates | `true` | that member has **≥ `WALK_MIN_CONTRIBUTIONS`** confirmed contributions inside `WALK_OBSERVATION_DAYS` |

The estimate's amount is the **median** of those confirmed contributions; on an even count take the **lower** of the two middle values, so the result is deterministic and conservative. Pay dates come from the member's `WorkPaySchedule` via `projectCadence`.

> **The cadence supplies the date. It never supplies the amount.** A pay schedule says when someone is paid, not what they will contribute — Bianca's contribution is variable by design and this is the module where a careless implementation would quietly invent it. Below the sample threshold, **no inflow is projected at all** and `inflowConfidence` is `"none"`.

**5 · `inflowConfidence`** is `"none"` when no inflow point was projected, `"motions-only"` when every projected inflow is an open motion, `"observed"` when at least one estimate was used.

**6 · `dryDate` is null until money has actually arrived.** A Fund that starts empty does not "run dry". Formally: `dryDate` is `null` whenever `hasConfirmedContribution` is `false`, regardless of what the projection does. This is what makes the day-one plate honest.

**7 · `bufferCents`** comes from the month's `HouseholdFundMonthPlan.bufferCents`; `0` when no plan exists, in which case `bufferCrossDate` is `null` and `belowBufferRuns` is empty.

**8 · `belowBufferRuns`** covers the whole month, actual days included, merging consecutive days below the buffer into one run with its lowest balance.

**9 · Deterministic ordering.** Points sort by `date`, then `actual` before projected, then `sourceId`. Two runs over the same household produce identical output, and `fundWalk` is pure — no `Date.now()`, no `Math.random()`.

**10 · `fundWalkWith`** re-runs the same fold with the named proposals treated as confirmed and the named obligations removed. It **mutates nothing** and is the only sanctioned way to answer a "what if". A source fence asserts it calls the same internal fold as `fundWalk`.

**11 · Integer cents everywhere.** No float appears in any returned value.

### Tests (`test/fund-walk.test.ts`, lane `test:fast`)

Build every scenario through the real commands — `configureHouseholdFund`, `proposeHouseholdFundContribution` → `confirmHouseholdFundContribution`, `confirmHouseholdFundSettlement`, `addRecurrence`, `addGoal`, `postEntry`.

- **The canonical September**, matching the workshop and the register: opening $240 · Bianca $980 on the 2nd · Hydro $128 on the 4th · Jonathan $535 on the 5th · rent $1,450 on the 6th · Bianca $980 on the 18th · insurance $186 on the 18th · groceries $520 on the 19th · internet $92 on the 20th · gas $74 on the 22nd · phone $110 on the 25th · vet $215 on the 26th · Halifax claim $300 on the 30th. Assert `todayBalanceCents === 17700` at the 12th, `dryDate === "2026-09-26"`, `endBalanceCents === -34000`, `shortfallCents === 34000`, and one below-buffer run from the 6th to the 18th with `lowCents === 17700`.
- **`shortfallCents` equals the register's `unfundedCents`** for the same month. The Level and the Ask cannot disagree.
- **Ties**: `todayBalanceCents === projectHouseholdFund(household, today).operatingBalanceCents`.
- **A purchase never moves the line** — post a `purchase-funded` claim and assert the walk is deep-equal.
- **Day one**: an empty household walks with `inflowConfidence: "none"`, `dryDate: null`, `hasConfirmedContribution: false`, and points only from recurrences.
- **Two confirmed contributions is not enough**: no estimate is projected, `inflowConfidence` stays `"none"` or `"motions-only"`.
- **Three is enough**, and the amount is the median — with four contributions of 200/400/600/900 the estimate is **400**, the lower middle.
- **Order independence**: shuffle event insertion order, assert identical output.
- **`fundWalkWith`**: confirming an open $310 motion moves `dryDate` from the 26th to the 30th and `shortfallCents` from 34000 to 3000.
- **Source fences**: `fundWalk.ts` contains `projectHouseholdFund` and `monthObligations`; contains no `Date.now`, no `Math.random`, no `toFixed`, and none of `/ratio|percent|rank/i`.

**Decision to log** (claim the next free D-number — Appendix B)**: the Fund has one walk, and every instrument reads it.** *The month's operating balance is folded once — actual from confirmed events, projected from obligations and found inflows. Projected inflows come only from confirmed future contributions, open motions, or an observed median above a minimum sample; a pay cadence supplies a date and never an amount. No surface recomputes a balance.*

**Do not:** render anything, assume a contribution amount, or let a claim move the line.

---

## Fund slice 2 — the Level

**Goal:** the walk, drawn. Solid behind, dashed ahead, the buffer as a rule, and one sentence.

**Branch:** `fund/2-level` · **PR:** `feat(fund): the Level` · **Owner:** Cursor · **Depends on:** 1

**Read first:** the workshop artifact §II, §XVI · `src/core/registerView.ts` and `src/Register.tsx` — the view-module and presentation-state pattern to copy · `src/core/monthSpread.ts` for `paydayTicks`.

**Files:** new `src/core/levelView.ts`, `src/Level.tsx`, `src/level.css`, `test/level-view.test.ts`; modify `src/core/index.ts`

```ts
export const LEVEL_VIEW = {
  width: 700, height: 236,
  left: 40, right: 660, top: 30, axisY: 214, labelY: 234,
  actualStroke: 2.25, projectedStroke: 1.75, projectedDash: "5 4", projectedOpacity: 0.72,
  bandOpacity: 0.07, todayOpacity: 0.32, markRadius: 4,
} as const;

export type LevelPresentation = "ready" | "day-one" | "untied" | "loading" | "error" | "offline";

export type LevelDrawing = {
  presentation: LevelPresentation;
  pxPerCent: number;
  zeroY: number; bufferY: number; todayX: number;
  actualPath: string; projectedPath: string;
  bands: Array<{ x: number; width: number }>;
  marks: Array<{ x: number; y: number; label: string; estimated: boolean }>;
  dryMark: { x: number; y: number } | null;
  paydayTicks: Array<{ x: number }>;
};

export function levelDrawing(walk: FundWalk): LevelDrawing;
export function levelHeadline(walk: FundWalk): string;
export function levelSecondary(walk: FundWalk): string | null;
export function levelAria(walk: FundWalk): string;
```

### The headline ladder — highest true statement wins, exactly this order

| # | Fires when | Copy |
|---|---|---|
| 1 | `dryDate` is set | `At this pace the Fund runs dry on the {ordinal}.` |
| 2 | a below-buffer run of ≥3 days | `Under the buffer from the {a} to the {b} — {n} days on {low}.` |
| 3 | spoken-for exceeds the pool | `{claimed} of the {pool} in the pool is spoken for before the {ordinal}.` |
| 4 | `hasConfirmedContribution` is false | `This is only the bills you've told me about. Nothing has actually happened yet.` |
| 5 | otherwise | `{Month} is covered.` |

`levelSecondary` returns the next-highest true statement, or `null`. **Never more than two sentences**, and the covered case never manufactures a worry to fill the slot.

### Drawing rules

- **Actual is solid, projected is dashed. This rule cannot bend** — it is the whole honesty of the instrument.
- **Steps, never a curve.** Money arrives and leaves in lumps; a smoothed line is a lie about how a household works. No interpolation, no `stroke-linecap: round` on a segment join that would suggest one.
- **The band fills the space *below* the buffer**, only on the days the line is under it — so the shaded width is literally the number of days at risk. Not above.
- **An estimated inflow mark is hollow**; a confirmed one is filled. A member must be able to see which numbers were found and which were observed.
- Payday ticks reuse `paydayTicks()` — 3px `--tick`, below the axis, **timing only, no amount**.
- `presentation: "day-one"` renders **all dash, no solid**, one filled dot at today, and headline #4. `"untied"` renders the axes and the buffer with no line at all, plus `REGISTER_UNTIED_LINE`'s sibling copy.
- The drawing scrolls inside its own container on phone; the page body never scrolls sideways.
- **No hex literals.** `--pine` for the line, `--copper` for the buffer, band, and dry mark, `--felt` for ticks.

**Tests:** the canonical walk produces a `dryMark` and exactly two bands · the day-one walk produces an empty `actualPath` and no `dryMark` · every headline rung reachable, asserted byte-exact · `levelAria` names the balance, the dry date and the buffer · a fence that `Level.tsx` contains no `%` in a data-bearing string and no `--danger` · screenshots at 320 / 390 / 720 / ~1100.

---

## Fund slice 3 — the rail, the stage, and the arrangement

**Goal:** eight slots, member-owned, and a stage that changes with the slot you pick.

**Branch:** `fund/3-rail` · **PR:** `feat(fund): the rail and the stage` · **Owner:** Codex · **Depends on:** 2 · **Risk: high** *(member-owned state)*

**Read first:** `src/core/deskPlates.ts` — `DeskPlateModel`, `PlateFigure`, `SHARED_PLATE_IDS` · `src/core/plates.ts` — the six primitives · `src/core/askView.ts` — `askBelongsOnDesk()` · **`src/OfficeWide.tsx:460–500`.**

> **This slice is smaller than it looks.** `OfficeWide.tsx` already renders a plate strip of `DeskPlate` with `onSelect` and `onOpenCabinet`, and already has an `office-wide-stage` div — it just hard-renders `MonthSpread` + `Ask` behind a `spreadIsStage` flag. **You are not building a rail-and-stage architecture; you are making the stage's content a function of the selected plate.** Do not introduce a second stage, a router, or a modal.

**Files:** new `src/core/fundRail.ts`, `test/fund-rail.test.ts`; modify `src/core/types.ts`, `src/core/commands.ts`, `src/core/index.ts`

```ts
export const RAIL_SLOTS_DESK = 8;
export const RAIL_SLOTS_PHONE = 6;

export type FundWidgetId =
  | "level" | "swipe" | "contribute" | "waiting" | "next-out" | "spoken-for"
  | "week" | "shape" | "streams" | "seven-days" | "shelf" | "record" | "minutes" | "ask"
  | "accounts" | "settle";                                     // the two reinvented in slice 0

export const FUND_WIDGETS: readonly FundWidgetId[];            // all 16
export const RETIRED_PLATE_IDS = {                             // slice 0 migration
  due: "next-out", saving: "shelf", coming: "week",
  trust: "record", cards: "accounts", owed: "settle",
} as const;

export const DEFAULT_RAIL_CUSTODIAN: readonly FundWidgetId[] = [
  "level", "swipe", "waiting", "settle", "next-out", "spoken-for", "week", "accounts",
];
export const DEFAULT_RAIL_CONTRIBUTOR: readonly FundWidgetId[] = [
  "level", "contribute", "waiting", "ask", "next-out", "streams", "shape", "week",
];

export type MemberRail = { memberId: string; slots: FundWidgetId[]; updatedAt: string };

export function railFor(household: Household, memberId: string): FundWidgetId[];
export function phoneRail(slots: readonly FundWidgetId[]): FundWidgetId[];   // slots.slice(0, 6)
export function widgetAllowedFor(id: FundWidgetId, household: Household, memberId: string): boolean;
export function drawerFor(household: Household, memberId: string): Array<{ id: FundWidgetId; onRail: boolean; allowed: boolean }>;
```

```ts
setFundRailSlot(household, { memberId, slot, widgetId }): CommitResult
resetFundRail(household, { memberId }): CommitResult
```

### Rules

- **Self-owned.** Setting another member's rail throws `"Only you can arrange your own board."` A fence asserts no code path writes a rail for a member other than the caller.
- **`level` is pinned to slot 1.** It cannot be removed, replaced, or moved. Attempting it throws `"The Fund stays at the top of the board."`
- **Exactly eight slots**, always. Never seven, never nine. **The rail never scrolls.**
- **The phone is `slots.slice(0, 6)`** — there is no separate phone arrangement. The rail order *is* the priority order; if slot seven is not worth a phone slot it was not worth slot seven.
- **No duplicates** on one rail.
- **`ask` is allowed only for the member it computes for** — delegate to `askBelongsOnDesk()`, do not re-derive the rule. `widgetAllowedFor` returns `false` otherwise and `setFundRailSlot` throws `"That one only belongs on your own desk."`
- **Every other widget is allowed for both members.** `drawerFor` returns all sixteen; a default is a starting arrangement, never a restriction.
- Defaults are chosen by whether the member is the fund custodian.

### The stage

The stage is **not** household state and **not** a command. It is a per-member, per-device convenience:

- Selected widget lives in `sessionStorage`, keyed by member id **and civil date**.
- Same session, same day → you return to where you were. **A new civil day resets to `level`.**
- The stage is never empty; `level` is the resting state and there is no "select a widget" prompt.
- **Single click stages.** No double-click gesture on the shared floor.
- The rail is a **tablist**, the stage its **tabpanel**: arrow keys move, Enter stages, `aria-current` marks the selection, focus lands on the panel heading. The selected plate takes a 3px `--pine` inset edge — never a fill.

**Tests:** cross-member set throws · removing or moving `level` throws · a rail is always exactly 8 · `phoneRail` is the first 6, in order · `ask` cannot be placed on the custodian's rail and can on the contributor's · `drawerFor` returns 14 for both members · defaults resolve by custodianship · a fence that the stage selection is never written through `commit(...)`.

**Decision to log: the board is member-owned and the library is not.** *Each member arranges their own eight slots and cannot arrange the other's. Every widget is available to both; only the Ask is scoped, and only to the member it computes for.*

---

## Fund slice 4 — the drawer

**Goal:** every widget, always, for both — reached from the rail, not from settings.

**Branch:** `fund/4-drawer` · **PR:** `feat(fund): the drawer` · **Owner:** Cursor · **Depends on:** 3

**Read first:** the workshop artifact §XIV.

**Files:** new `src/FundDrawer.tsx`, `test/fund-drawer.test.ts`; modify `src/fund.css`

- **The drawer is itself a stage.** It opens where every other expansion opens — no new surface, no settings screen.
- Reached by a quiet **Arrange** control at the foot of the rail on desk; **long-press a plate** on phone.
- Fourteen cards, each a name and one line. Eight marked `on the rail`; the Ask marked `your desk only` for the member it belongs to and simply absent for the other.
- **Swapping is two taps** — pick the widget, pick the slot. **No drag-and-drop**: unusable on a touchpad, impossible one-handed.
- First line of the panel: `Nothing here is locked and nothing is earned — the library is identical for both of you.`
- **Nothing is premium, gated, or unlocked by progress.** A fence asserts the component contains none of `unlock`, `premium`, `pro`, `earn`.

**Tests:** the drawer lists 14 for the custodian and 14 for the contributor · tapping a card then a slot calls `setFundRailSlot` once · attempting slot 1 is refused with the pinned-Level copy · keyboard path through card → slot → confirmation · screenshots at all four breakpoints.

---

## Fund slice 5 — Next out and Spoken for

**Goal:** a bill list that shows the consequence of each bill, and an honest read of what is actually free.

**Branch:** `fund/5-next-out` · **PR:** `feat(fund): what leaves next, and what it leaves you` · **Owner:** Codex · **Depends on:** 3

**Files:** new `src/core/nextOut.ts`, `src/NextOutStage.tsx`, `test/next-out.test.ts`; modify `src/core/index.ts`

```ts
export type NextOutRow = MonthObligation & {
  leavesCents: number;      // the walk's balance after this obligation
  underBuffer: boolean;
  breaks: boolean;          // the first row whose leavesCents < 0
};
export function nextOut(walk: FundWalk): { rows: NextOutRow[]; breakRow: NextOutRow | null; totalCents: number };

export type SpokenFor = {
  poolCents: number;        // balance today
  claimedCents: number;     // obligations due before the next projected inflow
  freeCents: number;        // max(0, pool - claimed)
  overCents: number;        // max(0, claimed - pool)
  throughDate: DateKey;     // the next projected inflow, or month end
};
export function spokenFor(walk: FundWalk, today: DateKey): SpokenFor;
```

**Rules:** both read the walk and **compute no balance of their own** — a fence asserts neither file imports `projectHouseholdFund` · exactly one row may carry `breaks: true` · `throughDate` is the next inflow point of any kind, or the month's last day · `freeCents` and `overCents` are never both non-zero.

**The stage** is a four-column table — date, bill, amount, **Leaves** — where the Leaves column is a running balance, rows under the buffer take copper, and the breaking row is called out: *this is the one that breaks it*. The two shortfall rows sum to the register's `unfundedCents`.

**The plates:** *Next out* uses the `track` primitive (four ticks, next one taller and copper). *Spoken for* uses `fill`, drawn as claimed-against-pool with the overflow as a **dashed overhang** beyond the rail.

**Tests:** the canonical month marks the vet as `breaks` with `leavesCents === -4000` and Halifax at `-34000` · `spokenFor` at the 12th gives pool 17700, claimed 18600, free 0, over 900, through `"2026-09-18"` · no-buffer households mark nothing `underBuffer` · the import fence.

---

## Fund slice 6 — Waiting on you, and consequence before consent

**Goal:** tell someone what their yes actually does, before they give it.

**Branch:** `fund/6-consequence` · **PR:** `feat(fund): what confirming would do` · **Owner:** Codex · **Depends on:** 5 · **Risk: high**

**Files:** new `src/core/motionConsequence.ts`, `src/WaitingStage.tsx`, `test/motion-consequence.test.ts`; modify `src/core/index.ts`

```ts
export type MotionConsequence = {
  eventId: string;
  balanceAfterCents: number;
  dryDateBefore: DateKey | null;
  dryDateAfter: DateKey | null;
  shortfallBeforeCents: number;
  shortfallAfterCents: number;
  copy: string;
};
export function motionConsequence(
  household: Household, monthKey: MonthKey, today: DateKey, eventId: string,
): MotionConsequence | null;
```

**Rules:**
- Computed **only** via `fundWalkWith({ confirmEventIds: [eventId] })`. A fence asserts the module imports `fundWalkWith` and nothing that writes.
- **It is a preview, never an approval.** Rendering a consequence must not create, imply, or pre-arm a confirmation. Confirm remains a button and a reviewed command.
- Returns `null` for an event that is not an open, unheld contribution proposal.
- **Copy variants, exact:**
  - the dry date moves: `Confirming this puts the Fund at {balance} and moves the dry date from the {a} to the {b}. It would leave the month {after} short instead of {before}.`
  - the dry date disappears: `Confirming this puts the Fund at {balance} and clears the month.`
  - nothing changes: `Confirming this puts the Fund at {balance}. It doesn't change what the month needs.`
- **No pressure language.** No `should`, `need to`, `please`, `still waiting`. A fence asserts it.
- The consequence renders on **the confirmer's** card only. It never renders on the raiser's side as leverage.

**The stage** lists open motions with their consequence and inline Confirm/Hold, then held motions with their notes and a Release, then recent decisions. **Held keeps its card** — it never turns red and never disappears.

**Tests:** the canonical $310 motion gives `dryDateBefore "2026-09-26"`, `dryDateAfter "2026-09-30"`, `shortfallAfterCents 3000` · a motion that clears the month uses the second variant · a held motion returns a consequence but the card shows Release · rendering never calls a command · the pressure-language fence.

---

## Fund slice 7 — the week

**Goal:** what the week contains — due, posted, whose turn. **A forward view, not a record.**

**Branch:** `fund/7-week` · **PR:** `feat(fund): this week` · **Owner:** Cursor · **Depends on:** 5

**Read first:** the workshop artifact §XIII · `src/core/shiftGlance.ts` for posted shift dates · the charter's `cadence` and `cadenceWeekday`.

**Files:** new `src/core/fundWeek.ts`, `src/WeekStage.tsx`, `test/fund-week.test.ts`

```ts
export type WeekEntryKind = "due" | "posted" | "payday" | "shift" | "sitdown";
export type WeekEntry = { kind: WeekEntryKind; label: string; amountCents: number | null; memberId: string | null };
export type WeekDay = { date: DateKey; weekday: number; isToday: boolean; entries: WeekEntry[] };
export type FundWeek = { days: WeekDay[]; outCents: number; inCents: number; shiftCount: number };
export function fundWeek(household: Household, today: DateKey): FundWeek;   // Monday-start, 7 days
```

**Rules:**
- **Nothing is tickable.** No completion state, no checkbox, no strike-through. The moment a day gets a checkbox, a household has chores and someone is behind.
- `shift` entries carry **`amountCents: null`, always.** Whose shift, never what it earned.
- `sitdown` appears **only** when the charter sets a cadence. `cadence: "none"` and Sunday is an ordinary day.
- `payday` is a timing mark and carries an amount only when a contribution was actually confirmed that day.
- Seven columns on desk, seven rows on phone — **same data, same spec**.
- The glance is net: `−{out}` and `and {in} lands {weekday}`, plus a seven-cell strip where colour is the only encoding and today carries an ink outline.

**Tests:** the canonical week (Mon 14 – Sun 20) gives `outCents 79800`, `inCents 98000`, `shiftCount 3` · a `cadence: "none"` charter produces no `sitdown` entry · a shift entry's `amountCents` is `null` in every fixture · a fence that `WeekStage.tsx` contains no `checkbox`, no `checked`, no `complete`.

---

## Fund slice 8 — the shape

**Goal:** each category against **its own** trailing band. Never against another category, never against the other person.

**Branch:** `fund/8-shape` · **PR:** `feat(fund): the shape of the month` · **Owner:** Cursor · **Depends on:** 5

**Files:** new `src/core/categoryShape.ts`, `src/ShapeStage.tsx`, `test/category-shape.test.ts`

```ts
export const SHAPE_MIN_MONTHS = 3;
export type ShapeVerdict = "above" | "in-shape" | "quiet" | "one-off" | "unknown";
export type CategoryShape = {
  subcategoryId: string; label: string;
  monthToDateCents: number;
  bandLowCents: number; bandHighCents: number;   // trailing SHAPE_MIN_MONTHS range
  deltaCents: number;                             // above the band, else 0
  verdict: ShapeVerdict;
  monthsSeen: number;
};
export function categoryShape(household: Household, monthKey: MonthKey, today: DateKey): CategoryShape[];  // deviation desc
```

**Rules:** below `SHAPE_MIN_MONTHS` a category's verdict is `"unknown"` and it renders as such — **never extrapolated** · `"one-off"` is a category with no prior history and a single posting · the band is the observed trailing **range**, not a percentage of anything · sorted by `deltaCents` descending, then `subcategoryId` · **no ratio between categories and no household total** — a fence asserts the module contains none of `/percent|ratio|rank|of total/i`.

**The stage** is small multiples: one sparkline per category over its own band, a dot at today, copper above the band and pine inside. **The plate names only the worst one** — six sparklines are unreadable at 220px, which is exactly why this needs a stage.

**Tests:** a two-month category is `"unknown"` · the canonical month puts Groceries first with `deltaCents 18000` · a fence on the forbidden vocabulary · screenshots.

---

## Fund slice 9 — the two streams

**Goal:** six months of how this household actually earns. One stream is a clock; the other is a decision.

**Branch:** `fund/9-streams` · **PR:** `feat(fund): the two streams` · **Owner:** Cursor · **Depends on:** 5

**Files:** new `src/core/twoStreams.ts`, `src/StreamsStage.tsx`, `test/two-streams.test.ts`

```ts
export type StreamMark = { date: DateKey; amountCents: number; memberId: string };
export type MemberStream = { memberId: string; marks: StreamMark[]; cadenceLabel: string; regular: boolean };
export function twoStreams(household: Household, today: DateKey, months = 6): MemberStream[];
```

**Rules — this is the most tempting place in the product to add a ratio, so the fences are the feature:**
- **No total.** `MemberStream` carries no sum and the module exposes none.
- **No comparison, no ranking, no ratio, no share.** A fence asserts the module and the component contain none of `/total|percent|ratio|rank|share|more than|less than/i`.
- `regular` is derived from the spacing of that member's own marks — it describes a rhythm, never a virtue.
- The drawing puts one member above the baseline and the other below, on a shared timeline. **The shape is the point.**

**Tests:** a household with 13 regular and 14 irregular contributions returns both streams with no aggregate field · the vocabulary fence over both files · `regular` is true for an evenly spaced stream and false for a scattered one · screenshots at all four breakpoints.

---

## Part 5 — what stays forbidden

- A ratio, percentage split, or ranking between the two members — anywhere, and **especially in the two streams**
- A total that combines their contributions into a scoreboard
- `--danger` for a shortfall; copper is the ask
- A streak, score, badge, or celebration attached to a person
- A projection drawn in the same stroke as history
- Pending money coloured like confirmed money
- A smoothed or averaged balance curve
- A glance that says less than its stage in order to earn the click
- A second balance computed anywhere outside `fundWalk`
- A contribution amount inferred from a pay cadence
- A countdown, timer, or progress percentage

---

# APPENDIX A — SLICE INDEX

| Say this | Branch | Ships |
|---|---|---|
| do slice 0 | `ux/0-tokens` | semantic tokens + the no-hex fence (Appendix D.6) |
| do Charter slice 1 | `charter/1-record` | the charter record |
| do Charter slice 2 | `charter/2-commands` | found, sign, amend by motion |
| do Charter slice 3 | `charter/3-founding-flow` | the founding conversation |
| do Charter slice 4 | `charter/4-page` | the page + empty signature line |
| do Charter slice 5 | `charter/5-held` | Held, everywhere |
| do Register and Ask slice 1 | `register/1-obligations` | the month's obligations |
| do Register and Ask slice 2 | `register/2-fold` | the register fold |
| do Register and Ask slice 3 | `register/3-purpose` | purpose labels |
| do Register and Ask slice 4 | `register/4-run-rate` | the discovery month |
| do Register and Ask slice 5 | `register/5-ask` | the Ask |
| do Register and Ask slice 6 | `register/6-other-door` | the other door |
| do Register and Ask slice 7 | `register/7-routes` | routes, or refusal |
| do Register and Ask slice 8 | `register/8-drawing` | the register drawn |
| do Register and Ask slice 9 | `register/9-ask-panel` | the Ask on the desk |
| do Register and Ask slice 10 | `register/10-metronome` | her paydays as ticks |
| do Register and Ask slice 11 | `register/11-ceiling` | the charter ceiling restrains the routes |
| do Till slice 1 | `till/1-custody-fence` | only the custodian posts |
| do Till slice 2 | `till/2-swipe` | two-tap swipe |
| do Till slice 3 | `till/3-surface` | the Till |
| do Till slice 4 | `till/4-preference` | member-owned landing surface |
| do Clerk slice 1 | `clerk/1-reading` | the reading, cited |
| do Clerk slice 2 | `clerk/2-citations` | tappable rows |
| do Clerk slice 3 | `clerk/3-fences` | the clerk may not propose |
| do Clerk slice 4 | `clerk/4-weekly` | the weekly, async |
| do Fund slice 0 | `fund/0-fold` | fold the six shared plates into one library |
| do Fund slice 1 | `fund/1-walk` | the month's balance walk |
| do Fund slice 2 | `fund/2-level` | the Level |
| do Fund slice 3 | `fund/3-rail` | the rail, stage and arrangement |
| do Fund slice 4 | `fund/4-drawer` | the drawer |
| do Fund slice 5 | `fund/5-next-out` | Next out and Spoken for |
| do Fund slice 6 | `fund/6-consequence` | consequence before consent |
| do Fund slice 7 | `fund/7-week` | this week |
| do Fund slice 8 | `fund/8-shape` | the shape |
| do Fund slice 9 | `fund/9-streams` | the two streams |
| do Fund slice 10 | `fund/10-accounts` | the accounts |
| do Fund slice 11 | `fund/11-settle` | to settle — what the Fund owes back |
| do Demo slice 1 | `demo/1-seed` | four months of history |
| do Demo slice 2 | `demo/2-walk` | the walk |

**Dependency order.** Fund **0** first, then 1→2→3→{4,5}, 5→{6,7,8,9,11}, and 10 after 3. Charter 1→2→3→4, and 5 after 2. Register & Ask 1→2→{3,4}→5→{6,7}→8→9, and 10 after 5, and 11 after 5, 6, 7. Till 1→2→3→4. Clerk 1→2→3→4, with Clerk 4 also needing Register & Ask 5–7. Demo last.

# APPENDIX B — DECISIONS THIS MANUAL PROPOSES

**Do not write a D-number from this table.** An earlier draft pre-assigned D-174 through D-184 on the basis that D-173 was highest. Canon was already well past it: as of `origin/main` @ `6f5dd56` (2026-09-02) the highest in use is **D-198**, and the slices that have landed took the numbers shown below. **Each remaining slice claims the next free number in `docs/DECISIONS.md` at the moment it writes its decision, and records it back into this table.** Never reserve a range in advance.

| Slice | Decision to record | Number |
|---|---|---|
| Charter 1 | Remainder is a first-class split rule | **D-189** ✅ landed |
| Charter 5 | Held is an open state, not a refusal | **D-193** ✅ landed |
| Register 2 | the register never computes a share | *claim at write time* |
| Register 3 | an earmark is a label, not a partition | *claim at write time* |
| Register 4 | the discovery month | *claim at write time* |
| Register 5 | the Ask is the register's tail | *claim at write time* |
| Register 6 | the Ask always shows the other door | *claim at write time* |
| Register 7 | quote the safe number, or refuse | *claim at write time* |
| Till 1 | posting a household purchase is a custody act | **D-197** ✅ landed |
| Till 4 | the landing surface is member-owned | *claim at write time* — Till slice 4 not yet on `main` |
| Register 11 | an agreed ceiling restrains what the Ask offers | *claim at write time* |
| Fund 0 | the shared floor has one plate library | *claim at write time* |
| Fund 1 | the Fund has one walk, and every instrument reads it | *claim at write time* |
| Fund 3 | the board is member-owned and the library is not | *claim at write time* |
| Fund 11 | the Fund owes the card, and the household is told | *claim at write time* |
| Clerk 1 | the clerk quotes, never proposes | *claim at write time* |

Where a slice's text above cites a D-number for one of these decisions, that citation is a placeholder — replace it with the claimed number when the slice lands.

# APPENDIX C — CUT, AND STAYING CUT

Do not build these, even if a slice seems to invite them. Say so and stop instead.

- The **Minute Book** — moved to month two. It needs history to be moving, and an empty household has none.
- The **co-present ceremony mode** — build for the habit that can actually be started.
- **Receipt photo / OCR** on the swipe — month two.
- **Plate customisation** and anything on the **personal floor**.
- The **merged Ahead room.**
- Any **bank feed, Interac API, or issued card** — blocked until Auth + RLS exist (`AGENTS.md`).

---

*Design source: `claude/hearth-two-incomes-2026-09-01.md` (Two Incomes, One Month) and `claude/hearth-charter-month-plan-2026-08-31.md` (The Household Charter). Grounded in `cursor/shared-ledger-story-aef7` @ `ba752c2` plus three commits on `claude/month-spread-shared-home`. Every figure in this manual is synthetic.*

# APPENDIX D — WHO BUILDS WHAT, AND WHAT RUNS IN PARALLEL

## D.1 The split, by risk class — not by file type

**Codex — anything that can change what a number means.** Types, commands, custody, the conservation folds, schema, the CI fences. These are the slices where a mistake silently corrupts the ledger, and they are where integration knowledge matters most.

**Cursor — anything that renders.** Components, CSS, view-geometry modules, nav, flows. This is where the iteration volume lives, and a mistake shows up in a screenshot rather than in a balance.

**Claude — the copy deck, the visual review of every UI PR against `hearth-ux-plates.html`, the demo walk, and the independent trust review `AGENTS.md` requires before any money-meaning change ships.**

Two boundary calls worth stating, because the file path misleads:

- `registerView.ts` and `askView.ts` live in `src/core/` but are **Cursor's**. They carry layout geometry, not money.
- `monthSpread.ts` is touched by Register & Ask slice 10, but **additively only** — a new export, no change to `courseScale` / `courseTop` / `courseBottom`. That keeps it a Cursor slice. If the slice ever needs to change an existing export, it stops being a Cursor slice.

| Slice | Owner | Why |
|---|---|---|
| Charter 1 · record | **Codex** | adds to `types.ts`, extends `Household` |
| Charter 2 · commands | **Codex** | money boundary, custody |
| Charter 3 · founding flow | **Cursor** | new components only |
| Charter 4 · charter page | **Cursor** | new components + `charterView.ts` |
| Charter 5 · Held | **Codex** | new event kind, `commands.ts`, projection equality |
| R&A 1 · obligations | **Codex** | must not fork the projection |
| R&A 2 · register fold | **Codex** | conservation arithmetic |
| R&A 3 · purpose | **Codex** | `types.ts` + `commands.ts` + the D-161 trap |
| R&A 4 · run rate | **float** | new file, no shared edits |
| R&A 5 · the Ask | **Codex** | derives from the register, must not recompute |
| R&A 6 · other door | **Codex** | same file as slice 5 |
| R&A 7 · routes | **float** | new file, reads `tipScience` read-only |
| R&A 8 · register drawing | **Cursor** | geometry + component |
| R&A 9 · Ask panel | **Cursor** | geometry + component + `OfficeWide` |
| R&A 10 · metronome | **Cursor** | additive drawing change |
| Till 1 · custody fence | **Codex** | custody |
| Till 2 · swipe | **Cursor** | component |
| Till 3 · Till surface | **Cursor** | component + nav |
| Till 4 · surface preference | **Codex** | `types.ts` + `commands.ts` |
| Clerk 1 · the reading | **float** | new file, read-only over the journal |
| Clerk 2 · citations | **Cursor** | component |
| Clerk 3 · fences | **Codex** | changes `pnpm ai:verify`, gates the build |
| Clerk 4 · the weekly | **Cursor** | reuses existing acts machinery |
| Demo 1 · seed | **Codex** | must build through real commands |
| Demo 2 · the walk | **Claude** | narrative, no code |

**Float slices** (R&A 4, R&A 7, Clerk 1) touch **no shared file** — each is one new module plus its test. Give them to whichever lane is idle, or to a third worker.

## D.2 The one thing that will actually bite you

**Eight slices edit `src/core/commands.ts`: Charter 2, Charter 5, R&A 3, Till 1, Till 4, Fund 3, Fund 10 and (read-only) Fund 11.** Never have two of them in flight at once. It is a ~4,500-line file and two branches editing it will conflict in a way that is easy to resolve *wrongly* — and resolving a custody command wrongly is the worst class of bug this project can ship.

**Five slices edit `src/core/types.ts`: Charter 1, Charter 5, R&A 3, Till 4, and Fund 3.** Same rule.

Everything else is a new file or a leaf file and is safe to run alongside anything.

## D.3 Signatures are frozen, so UI does not wait for merge

Every core slice in this manual publishes its exact type signatures. A UI slice may **start** as soon as its core slice's signature is frozen — which is now — and only needs the core slice **merged** before its own PR lands.

That is what makes two lanes work: Cursor builds against the typed shape while Codex is still writing the fold underneath it.

## D.4 The waves

Merge order inside a wave is always **Codex first, then rebase Cursor.**

| Wave | Codex lane | Cursor lane | Notes |
|---|---|---|---|
| **A** | Charter 1 | *Slice 0 — tokens* (see D.6) | Cursor has nothing else yet; Slice 0 unblocks every UI slice after it |
| **B** | Charter 2 | Charter 3 | Cursor builds the flow against `foundHouseholdCharter`'s frozen signature |
| **C** | Charter 5 | Charter 4 | no file overlap |
| **D** | R&A 1 | *float:* R&A 4 | both pure core; give R&A 4 to a third worker or to Cursor |
| **E** | R&A 2 | *float:* R&A 7 | R&A 7 needs no register data, only an amount |
| **F** | R&A 3 | R&A 8 | Cursor draws against the register type frozen in slice 2 |
| **G** | R&A 5 → 6 | R&A 10 | 5 and 6 are the same file, so they are sequential inside the lane |
| **H** | Till 1 | R&A 9 | the Ask panel needs 5, 6, 7 merged |
| **I** | Till 4 | Till 2 → Till 3 | Till 4 and Till 2/3 share no files |
| **J** | Clerk 3 | Clerk 2 | Clerk 1 (float) must be merged before both |
| **K** | Demo 1 | Clerk 4 | |
| **L** | — | — | Claude: Demo 2, the walk |

**The Fund waves** (Part 5), which run after Register 8–10 have merged:

| Wave | Codex | Cursor |
|---|---|---|
| F-0 | Fund 0 · the fold | — *(decide the library before drawing into it)* |
| F-A | Fund 1 · the walk | — *(nothing to draw until the walk exists)* |
| F-B | Fund 3 · the rail and arrangement | Fund 2 · the Level |
| F-C | Fund 5 · Next out and Spoken for | Fund 4 · the drawer |
| F-D | Fund 6 · consequence before consent | Fund 7 · the week |
| F-E | Fund 11 · to settle | Fund 8 · the shape, then Fund 9 · the two streams |
| F-F | — | Fund 10 · the accounts |

**Fund 0 comes first and Fund 1 is the critical path.** Six of the twelve read from the walk, so nothing else starts until it merges. Fund 8 and 9 are independent leaves and can run in either order, or in parallel with a third worker.

**Critical path is the Codex lane** — 15 slices against Cursor's 10. Keep it unblocked: Codex should not be reviewing UI PRs. Move a float slice to Cursor or a third worker whenever the Codex lane is more than two slices ahead.

## D.5 If you have a third worker

Claude Code takes the **float** lane — R&A 4, R&A 7, Clerk 1 — plus the visual review of each Cursor PR against the plates. That lane never touches a shared file, so it can run continuously without coordination, and it shortens the Codex critical path by three slices.

## D.6 Slice 0 — an addition to this manual

Not in the original plan; add it if you use the two-lane schedule.

**Goal:** the six new semantic tokens exist, and hex literals can't creep into new CSS.

**Branch:** `ux/0-tokens` · **PR:** `chore(ux): semantic register tokens and the no-hex fence` · **Owner:** Cursor

**Files:** new `src/register.css` (tokens only); modify `scripts/verify-ai-surface.mjs`

- Define `--reg-hers`, `--reg-his`, `--reg-carried`, `--reg-unfunded`, `--ask-figure`, `--tick` exactly as `HEARTH_UX_PACKET.md` §3.2 specifies, derived from existing tokens with `color-mix`.
- Add a check to `pnpm ai:verify` that fails on a hex literal in any CSS file added by these slices.
- No component changes. No visual change. This slice ships nothing a user can see, and that is correct.
