# Hearth — Onboarding Build Manual
### The household track · the personal track · Hercules conducting

**How to use this document.** Paste it once, then say **"do onboarding slice 0."** Do exactly that slice, open the PR, stop. When Jonathan says **"do onboarding slice 1,"** do that one.

**One slice per message. Never run ahead.** Never do "slice 3 and 4 together." If a slice cannot be done as written, **stop and report the conflict** rather than improvising a different design.

**This manual is not authorization to implement any slice.** Jonathan approves it first. Slice 0 is read-only and may run before approval.

**Written to be executed by a mid-capability model.** Every slice names the files to read first, the files to create, the exact signatures, the exact copy, the exact test file and lane, and a literal acceptance command. If something is not written here, it is not in scope — ask, do not invent.

**Companions.** `HEARTH_BUILD_MANUAL.md` planned the structural build (v1) — **which has now largely shipped; see §0.5.** `HEARTH_UX_PACKET.md` **§13** and `hearth-ux-plates.html` **plates 9–14** carry the visual system for every onboarding surface — the invitation, the handshake, the conductor shell, the witness screen, the return bar, and a dimensioned anatomy drawing. Those three companion artifacts are **not committed in the repository at this baseline**. Slice 7 and every dependent visual slice must stop until the exact reviewed companions are committed; a local Downloads copy is not a repository prerequisite and may not be silently substituted. This manual is v2: the layer that walks two people through those surfaces. **It builds no new ledger surface of its own.**

---

# PART 0 — STANDING BRIEF

Read all of Part 0 before every slice. §0.14 is the section that will save you the most time.

## 0.1 The outcome

Jonathan and Bianca sit down together, each on their own device, and let Hercules conduct them from nothing to a usable first shared budget. It is deliberately their **first ritual** — an end-of-month sit-down that happens to be the beginning.

When it ends: opening balances, Household Fund configuration, recurrences, shared budget categories, and the first shared monthly budget are current. Both members have said they are Ready. Ordinary Hercules unlocks.

Onboarding establishes a starting point. It does not pretend the books stay current on their own, and the finale says so.

## 0.2 Two tracks

**Household track** — twelve chapters. Required. Entering it puts **both** members' ordinary Hercules into setup mode. Co-present by design.

**Personal track** — opt-in modules covering the personal ledger, shifts, the tip oracle, the office, and Hercules' own features. Never locks anything, never gates anything, offered contextually rather than nagged.

Both share the registry shape, the probe discipline, the evidence projector, the semantic actions, and the copy deck. **Personal-track state may never contribute to a household gate.** The registry validator enforces it.

## 0.3 The five laws

1. **Completion is typed, or it did not happen.** A chapter completes only from typed domain state, an accepted command receipt, or an exact configuration fact. DOM text, a toast, a click, a visited route, elapsed time, and a model reply are never evidence.
2. **Chat text is never an approval.** Not a signature, not a configuration approval, not a budget approval, not Ready.
3. **Onboarding coordinates existing surfaces; it never forks a replacement copy of one.**
4. **Stopping is not completing.** No global Skip. An honest stop changes availability and never touches completion.
5. **A member's own state is not the other member's to change.**

## 0.4 Verified baseline

**Verified against `origin/main` @ `200dfd1`** (Fund slice 11 integrated, 2026-09-03). This baseline contains Fund slices 0–11 and onboarding slices 1–4. Both SHAs quoted in the original assignment prompt (`7101dce`, `1c03cbe`) and the previous verification SHAs (`6f5dd56`, `64740b3`) are stale. `main` moves several times a day — every later slice re-verifies.

Labels: **[verified]** read in code on this SHA · **[locked]** Jonathan's instruction · **[proposed]** this manual's design · **[open]** unresolved, a slice may not pass it.

| Fact | Label | Evidence |
|---|---|---|
| `pnpm test` = `node scripts/run-quick-gate.mjs` | **[verified]** | `package.json`, **D-202**. The gate classifies the diff, runs `pnpm ai:verify`, type-checks, and selects targeted tests; it no longer automatically runs both full test lanes. |
| `test:fast` and `test:books` remain explicit full-gate lanes; `test:books` is serial (`--maxWorkers=1`) and names every heavy test | **[verified]** | `package.json`. A new heavy test must still be **added to that list by name**. The exhaustive path is `pnpm test:full` and requires the authorization described by **D-202**. |
| `pnpm check:windows` = `pwsh -NoProfile -File scripts/verify-windows.ps1` | **[verified]** | `package.json`. The command could not run on this macOS host because `pwsh` is not installed; that is a local tooling gap, not a failing Hearth test. |
| `pnpm ai:verify` = `node scripts/verify-ai-surface.mjs`, and it enforces the Clerk fences | **[verified]** | `scripts/verify-ai-surface.mjs:51–64`; the standalone verification passed with 48 required files and two Clerk-owned files. |
| Baseline failing-test set | **[verified]** | **None under the authorized quick gate.** Fund slice 11's exact clean head over this baseline passed AI verification, TypeScript, 45 selected tests, and `pnpm build`. This is not a claim that the exhaustive suite ran. |
| Highest decision number in use | **[verified]** | **D-206** |
| Decision-number integrity | **[open]** | `docs/DECISIONS.md` assigns **D-202** both to the accepted quick-gate decision and to the later demo-seed why-note. The next decision cannot safely be numbered until this canonical collision is reconciled; it does not block the onboarding foundation. |
| `HearthTab = "home" \| "plan" \| "calendar" \| "shift" \| "ledger" \| "more" \| "add"` | **[verified]** | `src/core/hercules.ts:13` — the registry's nav vocabulary |
| `HerculesPresence(...)` with an `onGo` prop | **[verified]** | `src/Hercules.tsx:201`; wired in `src/App.tsx:4926` and `src/App.tsx:6215` |
| `src/core/index.ts` is the barrel every component imports from | **[verified]** | 236 lines; a new core module must be re-exported here |
| `src/App.tsx` is 6,432 lines; `commands.ts` 6,574; `types.ts` 1,414; `Hercules.tsx` 1,591 | **[verified]** | collision map, §D.2 |
| `src/core/onboarding/` | **[verified present]** | slices 1–4 are merged: registry, household mode, member progress, semantic actions, and the local affirmative classifier |
| Ordinary Hercules chat provider stack | **[verified]** | **D-184** — Gemini → Groq → opted-in OpenAI → Workers AI. Onboarding v1 still makes **zero** model calls |

## 0.5 The audit — what the structural build actually shipped

The structural build and its formerly outstanding follow-ups are merged on the verified SHA. Read this section before assuming anything is missing.

### Landed, and landed well

| Structural slice | Shipped as | Notes |
|---|---|---|
| Charter 1 · record | `src/core/charter.ts` | plus `mergeHouseholdCharters()` — a continuity merge the spec did not ask for. Good addition. |
| Charter 2 · commands | `commands.ts`, `test/charter-commands.test.ts` | **D-189** Remainder is a first-class charter split rule |
| Charter 3 · founding flow | `src/CharterFounding.tsx`, `src/core/charterFounding.ts` | |
| Charter 4 · page | `src/Charter.tsx`, `src/core/charterView.ts`, `SIGNATURE_VIEW` | signature geometry is a real exported constant, as specified |
| Charter 5 · Held | `test/held.test.ts`, `test/held-ui.test.ts` | **D-193** Held is an open contribution-motion state, never a refusal |
| Register 1 · obligations | `src/core/monthObligations.ts` | `ObligationSource = "recurrence" \| "goal-claim" \| "posted"` exactly as specified |
| Register 2 · register fold | `src/core/contributionRegister.ts` | plus `contributionRegisterThrough()`. **The no-ratio fence is stronger than specified** — it also excludes `fundPrivate\|bankBindings\|reconciliations` and the literal `/ total` |
| Register 3 · purpose | `purpose` on the fund event, `test/contribution-purpose.test.ts` | |
| Register 4 · run rate | `src/core/houseRunRate.ts`, `RUN_RATE_MIN_WEEKS = 3` | |
| Register 5–6 · Ask + other door | `src/core/ask.ts` with `householdAsk`, `askAlternatives`, `nextPaydayDate` | `test/ask.test.ts` makes the Ask derivation law mechanical. |
| Register 7 · routes | `src/core/askRoutes.ts` | refusal at `SHIFT_ORACLE_MIN_SHIFTS` with exact copy; `ASK_ROUTES_HEADER_COPY` exported |
| Register 8 · drawing | `src/core/registerView.ts`, `src/Register.tsx` | includes the named `RegisterPresentation` state machine |
| Register 9 · Ask panel | `src/core/askView.ts`, `src/Ask.tsx` | `askBelongsOnDesk()` makes the desk-only rule testable |
| Register 10 · metronome | `paydayTicks()`, `paydayTickAria()` in `monthSpread.ts` | accessible timing carries no amount |
| Register 11 · ceiling enforced | `src/core/askRoutes.ts`, `src/core/askView.ts`, `src/Ask.tsx`, `test/ask-ceiling.test.ts` | **D-201**, merged in PR **#307** (`10a7dbc`). The Charter ceiling now affects route verdicts, ordering, and the other-door presentation. |
| Till 1 · custody fence | `test/custody-fence.test.ts` | **D-197** posting a Household Fund purchase is a custody act |
| Till 2 · swipe | `src/core/swipe.ts`, `src/Swipe.tsx`, `test/swipe.test.ts` | **D-198.** The UX packet's numbers became exported constants. |
| Till 3 · the Till surface | `src/Till.tsx`, `test/till.test.ts` | **D-199**, present on `main` through `3002356`. |
| Till 4 · member landing preference | `landingSurface` in types, commands, household split/merge, and sync | **D-200**, present on `main` through `d031c6c`. The preference is member-owned and does not widen Shared data. |
| Clerk 1–2 · reading + citations | `src/core/clerkReading.ts`, `src/ClerkReading.tsx` | |
| Clerk 3 · fences | `scripts/verify-ai-surface.mjs:51–64` | the Clerk fences remain a passing build gate |
| Clerk 4 · the weekly | `src/core/weeklyDocument.ts`, `weeklyDocumentStamp.ts`, `src/WeeklyDocument.tsx` | **D-196** the weekly is an asynchronous household document |
| Demo 1 · four-month demo seed | `seedDemoHousehold()`, `test/demo-seed.test.ts` | merged in PR **#309** (`7dd1f96`): command-authored four-month history, real Hold, deferred goal claim, and unsigned Charter line. |
| Demo 2 · guided walk | `docs/DEMO_WALK.md` | merged in PR **#308** (`3bef5a3`). Its embedded pre-merge readiness note is historical; the seed and ceiling are now on `main`. |
| Onboarding 1 · registry | `src/core/onboarding/registry.ts`, `types.ts` | **D-203**, merged in PR **#317**; pure validated registry, no runtime behavior. |
| Onboarding 2 · household mode | `src/core/onboarding/mode.ts`, Shared continuity and command replay | **D-204**, merged in PR **#318**; two-device handshake facts survive split, assembly, merge, and replay. |
| Onboarding 3 · member progress | `src/core/onboarding/progress.ts`, Personal continuity and actor-gated commands | **D-205**, merged in PRs **#319–320** after trust corrections. |
| Onboarding 4 · semantic actions | `src/core/onboarding/actions.ts`, `affirmative.ts` | **D-206**, merged in PR **#321**; typed text may continue, pause, or reopen, never approve or submit. |

**The previous ceiling regression is resolved.** `ceilingKind` and `ceilingValue` now flow through `askRoutes.ts`, `askView.ts`, and `Ask.tsx`, with behavior asserted in `test/ask-ceiling.test.ts`. Chapter 3 can rely on that answer affecting the later Ask route instrument.

**The pattern worth repeating:** rules were turned into *exported constants, named functions, and build gates* instead of prose. `askBelongsOnDesk()`, `ASK_ROUTES_HEADER_COPY`, `SWIPE_UNDO_MS`, `paydayTickAria()`, the ceiling verdict functions, and the Clerk gate in `ai:verify`.

### Outstanding

| Structural slice | Status | Effect on onboarding |
|---|---|---|
| Till 3 · the Till surface | **[verified merged]** — through `3002356` | none; onboarding conducts the existing account surfaces |
| Till 4 · `landingSurface` member preference | **[verified merged]** — through `d031c6c`, **D-200** | the member-owned precedent required by the handshake is present |
| Demo 1 · four-month demo seed | **[verified merged]** — PR **#309** (`7dd1f96`); its why-note currently collides at **D-202** | slice 27's demo prerequisite exists |
| Demo 2 · `docs/DEMO_WALK.md` | **[verified merged]** — PR **#308** (`3bef5a3`) | no blocker |
| Register 11 · the ceiling, enforced | **[verified merged]** — PR **#307** (`10a7dbc`), **D-201** | Chapter 3's ceiling answer has behavior |

### The conflict you must resolve — read this twice

**`src/App.tsx:2208–2211` still auto-opens the Charter founding flow.**

```ts
useEffect(() => {
  if (!household || view !== "household") return;
  if (householdNeedsCharterFounding(household)) setCharterFoundingOpen(true);
}, [household, view]);
```

`householdNeedsCharterFounding()` (`charterFounding.ts:93`) returns true for a genuinely empty household — no charter, no fund, no transactions, no fund events, no accounts.

This is **exactly the D-129 "automatic start after Home renders" pattern that this manual supersedes** (§B.2), and it remains live on `main`. A household that opens Hearth for the first time is taken straight into Charter founding with no invitation, no explanation, and no partner.

**Slice 10 owns this conflict and must resolve it, not work around it.** The auto-open becomes the *invitation*: on an empty household Hercules offers the household track, and Charter founding is reached through Chapter 3 like every other surface. Do not delete `householdNeedsCharterFounding` — it is the right predicate; only its consumer changes.

## 0.6 Hard prerequisites and explicit blockers

| Slice | Requires | Status on `200dfd1` |
|---|---|---|
| 2, 26 | member-owned landing preference precedent | **satisfied** — `landingSurface` is personal-envelope state, **D-200** |
| 12 (Ch 3) | charter record + commands | **satisfied** — `charter.ts`, D-189, D-193 |
| 12 (Ch 3) | the standalone founding flow | **satisfied** — `src/CharterFounding.tsx`; **slice 12 navigates to it** |
| 13, 15 (Ch 4, 6) | the custody fence | **satisfied** — D-197 |
| 14 (Ch 5) | `openingTruth.ts` | **satisfied for Development only** — `postOpeningBalances` remains a Development rehearsal. Production invitation/activation is blocked until a separately accepted Production-capable opening-truth path exists; never let a Production household enter a track that cannot finish. |
| 18–24 (Ch 9–11) | obligations + register | **satisfied** — Register 1 and 2 merged |
| 21 (formula) | `houseRunRate` | **satisfied**, and still empty on a first run — §0.10 |
| 24 (Ch 11) | Charter ceiling behavior | **satisfied** — Register 11, **D-201**, PR #307 |
| 27 (demo lifecycle) | four-month Development demo and walk | **satisfied** — Demo 1 and 2, PRs #309 and #308; reconcile the duplicate D-202 label before assigning another decision |
| 7–10 and later UI | `HEARTH_BUILD_MANUAL.md`, `HEARTH_UX_PACKET.md`, `hearth-ux-plates.html` committed in the repository | **[open blocker]** — absent at this baseline. Do not implement visual slices from local-only copies or memory. |

**Foundation slices 1–6 are not blocked.** The member-facing household track remains Development-only until Production opening truth exists, and visual slices 7 onward remain blocked until the exact UX companions are committed. Fund slices 0–11 are present and do not block the onboarding foundation.

## 0.7 Risk, Dual Course, review routing

Runtime implementation is **High risk**: household-wide state, privacy-scoped evidence, shared approvals, deterministic budget math, offline merge, and an atomic plan-adoption command.

Planned for the completed experience — **Budget (5): +5** · **Engagement (3): +3**.
**This manual changes runtime behavior by zero. Budget delta 0 / Engagement delta 0.**

Independent trust/privacy/money review before any meaning-changing slice is accepted. Visual/accessibility review for the choreography. One writer per checkout. Jonathan owns product decisions, merge, deploy, and Production.

## 0.8 Hearth invariants every slice inherits

CAD integer cents · `America/Toronto` civil dates · one kernel, two shells (phone below 720px is glance plus one tap; wide at or above 720px is the office) · Confirm is the money boundary · the journal stays balanced · nothing posts autonomously · no ratio, no ranking, no "his versus hers" · privacy scopes live in projectors, not in hidden UI · Practice never touches accepted books (D-128) · derived numbers come from canonical projections · continuity and offline integrity preserved · **books beat cosmetics**.

## 0.9 Entry, lock, and the release valve

**Free roam first.** A new household is **not** in setup mode. Setup is never entered at first launch. (This is the change §0.5 flags in `App.tsx`.)

**Development release boundary.** The first household track is offered and activated only in Development. The stored mode shape remains environment-bound and fail-closed in Production, but no Production household may enter the track until a separately accepted Production-capable opening-truth command makes Chapter 5 finishable.

**The invitation.** Offered once, quietly, resumable, never modal, never repeated.

**The co-present handshake.** One member proposes; the other confirms on their own device inside a bounded window. Both see the same explanation first. **One member cannot place the other in setup mode.**

| | Availability | Completion | Who |
|---|---|---|---|
| **Global Skip** | — | — | **forbidden; does not exist** |
| **Personal skip** | unchanged | records a skip of one personal substep or module | the member, for themselves |
| **Stop setup for now** | unlocks both | records **stopped-incomplete**, never complete | both, by the same handshake; defined solo path when the partner is unreachable |
| **Dev force unlock** | unlocks | writes **no** completion record | Development only; impossible in Production; permanently marked |

## 0.10 Two things that are true on a first run

**Run-rate evidence is always absent.** `RUN_RATE_MIN_WEEKS` is 3; a founding household has watched zero. **The empty/untied state is the expected path.** Design and test it as the default; present run-rate evidence is the rare case.

**Onboarding produces a budget, not an Ask.** The Ask needs a shift sample that does not exist yet. **The Ask, routes, and any hours figure are out of scope for the entire household track** — and `askBelongsOnDesk()` already exists to enforce it.

## 0.11 Time budget — three sittings

| Sitting | Slices | Chapters | Target | Ends on |
|---|---|---|---|---|
| One — the founding | 10–12 | 1–3 | ~15 min | the Charter exists and both signed |
| Two — the facts | 13–17 | 4–8 | ~25 min | books current, Fund configured |
| Three — the first month | 18–25 | 9–12 | ~20 min | budget adopted, both Ready |

**No chapter may require more than ~5 minutes without a declared internal pause point.** **No countdown, no timer, no progress percentage, ever.**

## 0.12 Conductor and witness

| Role | Meaning |
|---|---|
| **conductor** | does the work on their device |
| **witness** | watches the result land, told in copy they need not type |
| **both** | parallel and independent |
| **joint** | a shared approval both must give |

Ch 1–2 both · Ch 3 joint · Ch 4, 5, 7 Bianca conducts · Ch 6 Bianca conducts, joint approval · Ch 8 each conducts their own · Ch 9–10 both independent · Ch 11–12 joint.

**A witness surface is never a dead screen.**

## 0.13 No model calls in v1

**Onboarding v1 makes zero model calls.** Warmth comes from **three to five deterministic flavor variants per chapter**, chosen by a stable seed from household id + chapter id. A model-flavored line is a possible later slice, out of scope here. A fence asserts no onboarding module imports a provider client.

D-184's provider stack applies to *ordinary* Hercules chat. The onboarding fence is about onboarding.

## 0.14 The house patterns — copy these exactly

This section exists so you do not have to reverse-engineer conventions. Read the named reference file when in doubt.

### A. A core module

New core modules live in `src/core/<name>.ts`, are pure, and import with explicit `.ts` extensions.

```ts
import { addDays, monthKeyFromDateKey, type DateKey } from "./calendar.ts";
import type { Household } from "./types.ts";
import { ValidationError } from "./types.ts";
```

**Every new core module must be re-exported from `src/core/index.ts`** or components cannot see it. Follow the existing style there — `export * from "./charter.ts";` for a whole module, or a named list for a selective one (see the `contributionRegister` entry).

Reference: `src/core/contributionRegister.ts`.

### B. A command

Commands live in `src/core/commands.ts`. **Never invent a different shape.**

```ts
export function doTheThing(household: Household, input: {
  memberId: string;
  /* … */
}): CommitResult {
  requireMember(household, input.memberId);          // guards first, before any clone
  if (/* precondition fails */) throw new ValidationError("Exact copy from the copy deck.");
  const previous = cloneHousehold(household);
  const next = cloneHousehold(household);
  /* mutate `next` only */
  return commit(previous, next, "Onboarding", `Human summary of what happened`, [affectedId]);
}
```

Rules: guards throw `ValidationError` with copy taken **verbatim from Appendix E**; clone previous *and* next; mutate only `next`; return `commit(...)`. Reference: `proposeHouseholdFundContribution` in `commands.ts`.

### C. A component

```ts
import { useEffect, useRef } from "react";
import type { CommitResult, Household } from "./core/index.ts";
import { /* named exports, from the barrel — never a deep path */ } from "./core/index.ts";
import "./onboarding.css";

type Props = {
  household: Household;
  memberId: string;
  busy?: boolean;
  onCommit: (fn: (current: Household) => CommitResult) => void;
  onDismiss: () => void;
};

export function OnboardingChat({ household, memberId, busy, onCommit, onDismiss }: Props) { /* … */ }
```

`onCommit` is how a component runs a command — it hands up a function, App applies it. **A component never calls a command directly and never mutates `household`.** Open/close state lives in `App.tsx`. Reference: `src/Charter.tsx`.

### D. A view module

Anything carrying geometry, a copy constant, or a placement rule goes in `src/core/<name>View.ts` as an exported constant or function so it can be asserted in a test. This is the single most important pattern in the codebase.

```ts
export const REGISTER_VIEW = { width: 900, barLeft: 250, /* … */ } as const;
export const REGISTER_EMPTY_LINE = "Nothing owed this month yet.";
export function registerScale(maxRowCents: number): number { /* … */ }
```

References: `src/core/registerView.ts`, `src/core/askView.ts` (see `askBelongsOnDesk`), `src/core/swipe.ts` (see `SWIPE_UNDO_MS`).

### E. A test file

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogHousehold, configureHouseholdFund, /* real commands */, type Household } from "../src/core/index.ts";

const BIANCA = "MEM-001";
const JONATHAN = "MEM-002";

function configuredFund(): Household {
  return configureHouseholdFund(catalogHousehold(), {
    custodianMemberId: BIANCA, openedOn: "2026-08-01", createdBy: BIANCA,
  }).household;
}

describe("the thing", () => {
  it("does the thing", () => { /* build through real commands, assert */ });

  it("keeps its fence", () => {
    const source = readFileSync(new URL("../src/core/thing.ts", import.meta.url), "utf8");
    expect(source).toContain("requiredSymbol");
    expect(source).not.toMatch(/forbiddenPattern/i);
  });
});
```

**`MEM-001` is Bianca (custodian), `MEM-002` is Jonathan.** Build every scenario through real commands — never hand-write `Household` state. Reference: `test/contribution-register.test.ts`.

### F. Test lanes — where a new test goes

`pnpm test` runs `scripts/run-quick-gate.mjs`: it fingerprints the exact change, verifies AI surfaces and TypeScript, then selects changed, mapped, and invariant tests. It does **not** run both exhaustive lanes.

- **Default test placement: `test:fast`.** Nothing to configure — a new `test/*.test.ts` is picked up automatically when the exhaustive lane is authorized, and the quick gate selects it when the change graph or explicit focus requires it.
- **Only if the test is heavy** (pglite, scale, stress, a full app boot, >5s), add it **by name** to *both* the `--exclude` list in `test:fast` and the file list in `test:books` in `package.json`. Getting this wrong makes the fast lane slow for everyone.

`pnpm test:full` is the guarded exhaustive path that runs `test:fast` and then serial `test:books`; use it only with the exact owner authorization required by D-202.

Every onboarding test in this manual belongs in `test:fast` unless its slice says otherwise.

### G. Copy

Never write a member-facing sentence at a call site. Every string comes from Appendix E through the copy deck (slice 6). **Byte-exact, including punctuation.**

## 0.15 Test conventions

Every slice ships:

1. **Source fences** — `readFileSync` + `toContain` / `not.toMatch`, so a rule cannot be quietly deleted.
2. **Command-driven scenarios** — through the real commands, never hand-written state.
3. **Probe negatives** — for every completion probe, a malformed / stale / conflicted / untied / privacy-ineligible case that **fails** it.
4. **Privacy assertions** — member A's projector output contains no partner-Personal id and no summary of one.
5. **Continuity scenarios** — offline write, outbox replay, remote merge, two-device concurrency, for every self-owned record.

## 0.16 Delivery, done, handoff

- Branch off `main` with the slice's branch name. One slice = one branch = one PR. Never commit to `main`; Jonathan merges.
- **Work in a clean worktree outside OneDrive.** A worktree inside a syncing folder corrupts.
- Gates: `pnpm test` · `pnpm build` · `pnpm ai:verify` · `pnpm check:windows`. Record the failing set at your branch point and state that the count is unchanged.
- PR body uses `docs/AI_HANDOFF.md` fields: both Dual Course deltas, exact verification, uncertainty, data disclosure, next owner. **Stated once here; slices point back to this.**
- Report separately: local · branch · PR · exact-head review · merge · CI · deployment · live verified.
- **Claim decision numbers at write time.** Highest in use is D-198. See Appendix B.
- Never commit `.env`, secrets, tokens, workbook exports, or real household rows. All examples synthetic.

**Definition of done, every slice:** branch as specified · PR open, unmerged · four gates green · the test kinds the slice calls for · new core module re-exported from `src/core/index.ts` · no hex literals in new CSS · evidence at 320 / 390 / 720 / ~1100 if UI is touched · conductor **and** witness states captured if either renders · handoff fields present · nothing outside the stated scope touched.

---

# PART 1 — THE FOUNDATION

*Slices 0–9. Nothing a member can see until slice 7.*

---

## Onboarding slice 0 — the verification pass

**Goal:** re-verify §0.4, §0.5 and §0.6 against `origin/main` today. Read-only.
**Branch:** `onboarding/0-verify` · **PR:** `docs(onboarding): refresh the onboarding baseline` · **Owner:** Codex

**Read first:** `AGENTS.md`, `CLAUDE.md`, `docs/README.md`, `docs/DECISIONS.md`, `docs/HEARTH_ROADMAP.md`, `package.json`, `scripts/verify-ai-surface.mjs`.

**Modify:** §0.4, §0.5, §0.6 tables of this manual only. **No source file.**

**Do:**
1. Fetch `origin/main`; record the SHA; clean worktree **outside OneDrive**.
2. Re-check every row of §0.4 and §0.5. Set each label.
3. Confirm `pnpm test` still runs `scripts/run-quick-gate.mjs`, `pnpm test:full` remains the guarded exhaustive path, and `check:windows` still runs `scripts/verify-windows.ps1`.
4. Record the highest D-number at the fetched SHA and re-read D-128, D-129, D-183, D-184, D-196 through D-206.
5. Record which `src/core/onboarding/` slices are already merged; do not require the folder to remain absent after slice 1.
6. **Confirm the `App.tsx` auto-open conflict in §0.5 is still present** and record its current line numbers.
7. Record the failing-test set at this SHA so later slices can prove they added none.

**Done when:** every **[open]** row names a merged commit or a blocking absence, the baseline SHA is current, and the auto-open line numbers are recorded.

**Do not:** write code, or build a prerequisite.

---

## Onboarding slice 1 — the registry

**Goal:** every chapter is a validated, versioned record. No behavior.
**Branch:** `onboarding/1-registry` · **PR:** `feat(onboarding): the versioned chapter registry` · **Owner:** Codex · **Depends on:** 0

**Read first:** `src/core/hercules.ts` (for `HearthTab`), `src/core/index.ts`, `src/core/registerView.ts` (view-module pattern), `test/contribution-register.test.ts` (test pattern).

**Create:** `src/core/onboarding/types.ts`, `src/core/onboarding/registry.ts`, `test/onboarding-registry.test.ts`
**Modify:** `src/core/index.ts` (re-export)

```ts
// src/core/onboarding/types.ts
import type { HearthTab } from "../hercules.ts";

export type OnboardingTrack = "household" | "personal";
export type OnboardingSitting = 1 | 2 | 3 | null;          // null for personal modules
export type MemberRole = "conductor" | "witness" | "both" | "joint";
export type ApprovalMode = "none" | "member" | "joint";
export type SkipPolicy =
  | "household-required" | "member-required" | "member-skippable"
  | "auto-completable" | "blocked";
export type SemanticActionKind =
  | "navigate" | "pause" | "stop-setup" | "skip-personal"
  | "continue" | "submit" | "approve" | "edit" | "reopen";

export type ChapterId = string;                             // e.g. "ch-03-charter"
export type NavTarget = { tab: HearthTab; view?: string };

export type OnboardingChapter = {
  id: ChapterId;
  registryVersion: number;
  track: OnboardingTrack;
  order: number;
  sitting: OnboardingSitting;
  copyKey: string;
  flavorKeys: string[];                  // 3–5
  target: NavTarget | null;              // null = conducted entirely in chat
  conductor: "self" | "partner" | "either" | "both";
  approval: ApprovalMode;
  skip: SkipPolicy;
  timeBudgetSeconds: number;
  pausePoints: string[];
  actions: SemanticActionKind[];
  dependsOn: ChapterId[];
  contributesToFinalGate: boolean;
};

export type RegistryProblemCode =
  | "duplicate-id" | "duplicate-order" | "order-gap"
  | "target-without-navigate" | "navigate-without-target" | "unknown-tab"
  | "joint-and-skippable" | "personal-contributes-to-gate"
  | "household-policy-on-personal" | "budget-without-pause"
  | "flavor-count" | "dependency-cycle" | "forward-dependency";

export type RegistryProblem = { code: RegistryProblemCode; chapterId: ChapterId; detail: string };
```

```ts
// src/core/onboarding/registry.ts
export const ONBOARDING_REGISTRY_VERSION = 1;
export const ONBOARDING_REGISTRY: readonly OnboardingChapter[];
export function validateRegistry(rows: readonly OnboardingChapter[]): RegistryProblem[];
export function chapterById(id: ChapterId): OnboardingChapter | null;
export function householdChapters(): OnboardingChapter[];   // track "household", by order
export function personalModules(): OnboardingChapter[];
```

**The twelve household rows** — ids, order, sitting, conductor, approval, skip, target:

| id | order | sitting | conductor | approval | skip | target tab |
|---|---|---|---|---|---|---|
| `ch-01-meet` | 1 | 1 | both | joint | household-required | `null` |
| `ch-02-household` | 2 | 1 | both | none | auto-completable | `more` |
| `ch-03-charter` | 3 | 1 | either | joint | household-required | `more` |
| `ch-04-accounts` | 4 | 2 | partner | none | household-required | `more` |
| `ch-05-opening` | 5 | 2 | partner | none | household-required | `ledger` |
| `ch-06-fund` | 6 | 2 | partner | joint | household-required | `plan` |
| `ch-07-recurrences` | 7 | 2 | partner | none | household-required | `calendar` |
| `ch-08-cadence` | 8 | 2 | self | member | member-required | `shift` |
| `ch-09-categories` | 9 | 3 | both | member | household-required | `plan` |
| `ch-10-estimates` | 10 | 3 | both | member | household-required | `plan` |
| `ch-11-plan` | 11 | 3 | both | joint | household-required | `plan` |
| `ch-12-ready` | 12 | 3 | both | joint | household-required | `ledger` |

`conductor: "partner"` means *the custodian*, resolved at runtime — never a hard-coded member id.

**`validateRegistry` rejects, one problem code each:** duplicate id · duplicate order within a track · a gap in household order · `target: null` with `"navigate"` in `actions` · `"navigate"` in `actions` with `target: null` · a `target.tab` outside `HearthTab` · `approval: "joint"` with `skip: "member-skippable"` · `track: "personal"` with `contributesToFinalGate: true` · `skip: "household-required"` on a personal row · `timeBudgetSeconds > 300` with empty `pausePoints` · fewer than 3 or more than 5 `flavorKeys` · a `dependsOn` cycle · a `dependsOn` on a later `order`.

**Tests (`test/onboarding-registry.test.ts`, lane `test:fast`):**
- the shipped registry returns `[]` from `validateRegistry`
- one malformed fixture per problem code, asserting the exact code
- `householdChapters()` returns exactly 12 in the table's order
- source fence: `registry.ts` contains no `import` from `"../commands.ts"` and no `.tsx`

**Acceptance:** `pnpm vitest run test/onboarding-registry.test.ts` green, then the four gates.

**Decision to log** (claim the next free number)**: onboarding chapters are a validated registry, not code paths.**

**Do not:** implement any probe, projector, command, or component.

---

## Onboarding slice 2 — household mode and the co-present handshake

**Goal:** a household enters setup mode only when both members agree, on their own devices.
**Branch:** `onboarding/2-household-mode` · **PR:** `feat(onboarding): the co-present handshake and household setup mode` · **Owner:** Codex · **Depends on:** 1

**Read first:** `src/core/commands.ts` — `proposeHouseholdFundContribution` and `confirmHouseholdFundContribution` (the exact shape to copy); `src/core/householdFund.ts` — `shapeHouseholdFundConfig` (the defensive shaping style); `src/core/types.ts`.

**Create:** `src/core/onboarding/mode.ts`, `test/onboarding-mode.test.ts`
**Modify:** `src/core/types.ts` (add `householdOnboarding?: HouseholdOnboarding | null` to `Household`), `src/core/commands.ts`, `src/core/index.ts`, `src/core/sync.ts`, `src/core/household.ts`, `src/core/commandIdentity.ts`, `src/core/commandRuntime.ts`, `src/ledger/continuityCommandLog.ts`, `src/ledger/materializeSnapshotFromEvents.ts`

```ts
export const HANDSHAKE_WINDOW_MINUTES = 15;

export type OnboardingModeState =
  | "inactive" | "offered" | "handshake-pending" | "active" | "paused-safe"
  | "waiting-member" | "blocked" | "adopting" | "stopped-incomplete"
  | "complete" | "repair";

export type HouseholdOnboarding = {
  id: string;
  environment: "development" | "production";
  householdId: string;
  registryVersion: number;
  state: OnboardingModeState;
  proposedByMemberId: string | null;
  proposedAt: string | null;
  handshakeExpiresAt: string | null;
  confirmedByMemberIds: string[];
  startedAt: string | null;
  stoppedAt: string | null;
  stoppedByMemberIds: string[];
  stoppedSolo: boolean;
  forcedUnlock: boolean;                 // Development force unlock, permanent marker
  completedAt: string | null;
  completionDigest: string | null;
  createdAt: string;
  updatedAt: string;
};

export function shapeHouseholdOnboarding(value: unknown): HouseholdOnboarding | null;
export function onboardingIsActive(household: Household): boolean;
export function ordinaryHerculesAvailable(household: Household): boolean;
export function handshakeExpired(row: HouseholdOnboarding, nowIso: string): boolean;
```

Commands in `commands.ts`, following §0.14 B exactly:

```ts
offerHouseholdOnboarding(household, { memberId, at? }): CommitResult
proposeHouseholdOnboarding(household, { memberId, at? }): CommitResult
confirmHouseholdOnboarding(household, { memberId, at? }): CommitResult
stopHouseholdOnboarding(household, { memberId, soloReason? }): CommitResult
resumeHouseholdOnboarding(household, { memberId }): CommitResult
```

**Rules — each is a test:**
1. `handshakeExpiresAt = proposedAt + HANDSHAKE_WINDOW_MINUTES`. After expiry the proposal is dead; it never silently activates.
2. `confirmHouseholdOnboarding` reaches `"active"` **only** when `confirmedByMemberIds` contains **both** active member ids. Confirming your own proposal alone does not activate.
3. No command path sets `state: "active"` from a single member id. **Assert this by enumerating every command.**
4. **`stopHouseholdOnboarding` never sets `completedAt` or `completionDigest`.** Assert directly — this is the law that keeps stop from becoming Skip.
5. A solo stop requires `soloReason` and sets `stoppedSolo: true`.
6. `ordinaryHerculesAvailable()` derives from the accepted record only. **A fence asserts `mode.ts` imports nothing from `src/*.tsx`.**
7. An unknown `state` value shapes to `"blocked"`, never `"complete"`.
8. `registryVersion` newer than `ONBOARDING_REGISTRY_VERSION` shapes to `"repair"`, never `"active"`.
9. `householdOnboarding` is a Shared record: split, shape, assembly, deterministic merge, accepted-command validation, and compacted replay all preserve it. Two offline confirmations union without either device overwriting the other.

**Copy** — from Appendix E, verbatim: `invite.explain`, `invite.waiting`, `invite.expired`, `stop.recorded`.

**Tests (`test/onboarding-mode.test.ts`, `test:fast`):** one per rule; plus a continuity case where two devices confirm offline and merge to `"active"` exactly once.

**Decision to log: setup mode is entered by a co-present handshake and left by an honest stop.**

**Do not:** build any UI. Do not touch `App.tsx`.

---

## Onboarding slice 3 — member progress, safe resume, dev unlock

**Branch:** `onboarding/3-progress` · **PR:** `feat(onboarding): member progress, safe resume, and the development unlock` · **Owner:** Codex · **Depends on:** 2

**Read first:** `src/core/onboarding/mode.ts`, `src/core/householdFund.ts` (`shapeHouseholdFundPrivate` — the member-scoped shaping precedent at line 196).

**Create:** `src/core/onboarding/progress.ts`, `test/onboarding-progress.test.ts`
**Modify:** `src/core/types.ts`, `src/core/commands.ts`, `src/core/index.ts`, `src/core/household.ts`, `src/core/sync.ts`

```ts
export type MemberChapterProgress = {
  chapterId: ChapterId;
  observedCompleteAt: string | null;     // set only from an accepted probe
  probeEvidenceKey: string | null;
  skippedAt: string | null;              // personal skips only
  lastSafeResumePoint: string | null;
  acknowledgedAt: string | null;
};

export type MemberOnboardingProgress = {
  id: string; householdId: string; memberId: string;
  registryVersion: number;
  rows: MemberChapterProgress[];
  offersMuted: boolean;                  // personal-track offers, member-owned
  declineCountByModule: Record<ChapterId, number>;
  updatedAt: string;
};

export function memberProgress(household: Household, memberId: string): MemberOnboardingProgress;
export function nextChapterFor(household: Household, memberId: string, today: DateKey): OnboardingChapter | null;
export function householdGatesOutstanding(household: Household): ChapterId[];
export function mergeMemberProgress(server, client): MemberOnboardingProgress;
```

```ts
recordChapterAcknowledgement(household, { memberId, chapterId, createdBy }): CommitResult
skipPersonalStep(household, { memberId, chapterId, createdBy }): CommitResult
setOnboardingOffersMuted(household, { memberId, muted, createdBy }): CommitResult
forceUnlockOnboarding(household, { memberId, createdBy }): CommitResult   // Development only
```

**Rules:**
1. **Self-owned.** `createdBy` is the trusted acting member and must equal the target `memberId`; writing member B's progress from member A throws `"Only you can record your own progress."` An omitted actor also refuses.
2. `observedCompleteAt` is set **only** from a probe result. Fence: `progress.ts` imports no component and contains no `document`.
3. **Merge law** (`mergeMemberProgress`): per chapter, earliest non-null `observedCompleteAt`; latest `lastSafeResumePoint`; a skip never un-skips; `declineCountByModule` takes the max. Order-independent and lossless.
4. `nextChapterFor` never returns a chapter with unmet `dependsOn`, and never returns a personal chapter while the household track is active.
5. `householdGatesOutstanding` is the only source of truth for what the finale waits on.
6. `forceUnlockOnboarding` throws `"Not available in this environment."` unless `environment === "development"`; sets `state: "stopped-incomplete"` and `forcedUnlock: true`; **writes no completion record**; a forced household never reads complete, forever.

**Tests:** one per rule; the merge test runs both orderings and asserts deep equality.

**Do not:** render anything.

---

## Onboarding slice 4 — semantic actions and the affirmative classifier

**Branch:** `onboarding/4-actions` · **PR:** `feat(onboarding): semantic actions and a local affirmative classifier` · **Owner:** Codex · **Depends on:** 3

**Create:** `src/core/onboarding/actions.ts`, `src/core/onboarding/affirmative.ts`, `test/onboarding-actions.test.ts`, `test/onboarding-affirmative.test.ts`
**Modify:** `src/core/index.ts`

```ts
export const AFFIRMATIVE_VERSION = 1;
export function isAffirmative(text: string, locale?: string): boolean;

export type SemanticAction = {
  kind: SemanticActionKind;
  chapterId: ChapterId;
  memberId: string;
  revision: string | null;
  origin: "button" | "affirmative";
  at: string;
};

export type ActionOutcome =
  | { kind: "local"; nextResumePoint: string }
  | { kind: "command"; command: string }
  | { kind: "refused"; reason: string };

export const AFFIRMATIVE_ALLOWED: readonly SemanticActionKind[] = ["continue", "pause", "reopen"];
export function resolveAction(household: Household, action: SemanticAction): ActionOutcome;
```

**Rules:**
1. **`origin: "affirmative"` is accepted only for the three kinds in `AFFIRMATIVE_ALLOWED`.** Every other kind with that origin returns `refused`. **Test all 9 × 2 combinations.**
2. `approve` and `submit` always return `{ kind: "command" }` — never `local`.
3. A missing or stale `revision` on `submit` / `approve` / `edit` returns `refused`.
4. `resolveAction` is idempotent: same action, same state → same outcome, no second effect.
5. `isAffirmative` is local, deterministic, versioned, locale-bounded.

**`isAffirmative` truth table — implement and test exactly these.**
True: `yes` `yep` `yeah` `yup` `ya` `sure` `ok` `okay` `k` `next` `go` `go ahead` `let's go` `lets go` `ready` `i'm ready` `im ready` `sounds good` `good` `great` `perfect` `do it` `continue` `carry on` `keep going` `alright` `all right` `right` `please` `yes please` `mhm` `uh huh` `👍` `✅` — plus each with surrounding whitespace, trailing `.` `!`, and any capitalisation.
False: `no` `nope` `nah` `not yet` `not now` `wait` `hold on` `hang on` `stop` `maybe` `i think so` `probably` `what` `what?` `huh` `?` `` (empty) `   ` `idk` `later` `skip` `undo` `back` `why` `yes but` `no thanks` `sure?` — and any string over 40 characters, which is a sentence, not an affirmation.

6. **A visible Next button is available wherever `continue` is permitted.** Assert against the registry.

**Tests:** the full truth table as a `it.each`; all 18 kind × origin combinations; stale-revision refusal; idempotent replay; fence that `affirmative.ts` imports nothing from `commands.ts`.

**Decision to log: typed text may advance, never approve.**

---

## Onboarding slice 5 — the privacy-scoped evidence projector

**Branch:** `onboarding/5-evidence` · **PR:** `feat(onboarding): privacy-scoped evidence cards` · **Owner:** Codex · **Depends on:** 1 · **may run alongside 2–4**

**Read first:** `src/core/householdFund.ts:196` (`shapeHouseholdFundPrivate` — how member scoping is already done), `src/core/contributionRegister.ts` (the fence style).

**Create:** `src/core/onboarding/evidence.ts`, `test/onboarding-evidence.test.ts`
**Modify:** `src/core/index.ts`

```ts
export type EvidenceScope = "household" | "self-personal";
export type IneligibleReason = "malformed" | "stale" | "conflicted" | "untied" | "privacy";

export type EvidenceCard = {
  chapterId: ChapterId;
  scope: EvidenceScope;
  kind: "transaction" | "receipt" | "account" | "configuration" | "recurrence" | "submission" | "approval";
  sourceIds: string[];                 // never empty
  lines: Array<{ label: string; value: string }>;
  observedAt: string;
};

export type EvidenceResult =
  | { kind: "accepted"; card: EvidenceCard }
  | { kind: "empty" }
  | { kind: "ineligible"; reason: IneligibleReason };

export function evidenceFor(household: Household, chapterId: ChapterId, viewerMemberId: string): EvidenceResult;
export function witnessEvidenceFor(household: Household, chapterId: ChapterId, viewerMemberId: string): EvidenceResult;
```

**Rules:**
1. **Partner-Personal facts are dropped, never summarized.** Not "your partner added an account" — nothing. Result is `empty` or a household-scoped card.
2. `sourceIds` is never empty on an `accepted` card.
3. `witnessEvidenceFor` returns the household-scoped subset only and can never widen.
4. `ineligible` is not `empty`. A stale or untied fact renders honestly and blocks the probe.
5. Never touches the DOM or a component. **Fence: `evidence.ts` contains no `document`, no `window`, and no import matching `\.tsx`.**

**Tests:** for each of the twelve chapters, an owner-viewer fixture and a partner-viewer fixture, asserting **no partner-Personal id string appears anywhere in the partner's serialized output**; each `IneligibleReason` reachable; the fence.

**Decision to log: onboarding proves completion with cited rows.**

---

## Onboarding slice 6 — the copy deck and flavor variants

**Branch:** `onboarding/6-copy` · **PR:** `feat(onboarding): the deterministic copy deck` · **Owner:** Claude · **Depends on:** 1

**Create:** `src/core/onboarding/copy.ts`, `src/core/onboarding/flavor.ts`, `test/onboarding-copy.test.ts`
**Modify:** `src/core/index.ts`

```ts
export const COPY_DECK_VERSION = 1;

export type CopyEntry = {
  key: string;
  speaker: "hercules" | "system";
  surface: "chat" | "presence" | "status" | "button" | "card";
  scope: EvidenceScope | "none";
  announce: "polite" | "assertive" | "none";
  text: string;                      // {named} slots only
  slots: string[];
};

export const ONBOARDING_COPY: Readonly<Record<string, CopyEntry>>;
export function copy(key: string, slots?: Record<string, string>): string;
export function flavorFor(chapterId: ChapterId, householdId: string): string;
```

**Rules:**
1. **Every key in Appendix E exists, byte-exact.** A test compares each against a literal in the test file — if the deck drifts, the test fails.
2. **No copy is composed at a call site.** Fence over `src/Onboarding*.tsx`: no template literal containing `. ` or ending `.`, `?`, `!` inside JSX text.
3. An unfilled slot throws in test and renders the key in development — never an empty string to a member.
4. `flavorFor` seeds from `householdId + chapterId`: same inputs, same variant, always. Deterministic hash, no `Math.random`.
5. `announce: "assertive"` appears on at most three entries in the whole deck.
6. **Flavor variants contain no digits and none of the words `should`, `need to`, `must`.** Assert over every variant string.

**Tests:** every registry `copyKey`/`flavorKey` resolves; slots match placeholders; `flavorFor` stable over 1,000 calls and covers every variant across many household ids; the byte-exact table; the no-digits fence.

---

## Onboarding slice 7 — the conductor shell on mobile

**Branch:** `onboarding/7-conductor-mobile` · **PR:** `feat(onboarding): the conductor shell in Hercules focus` · **Owner:** Cursor · **Depends on:** 1–6

**Blocking prerequisite:** the reviewed `HEARTH_BUILD_MANUAL.md`, `HEARTH_UX_PACKET.md`, and `hearth-ux-plates.html` must exist at committed repository paths. They are absent at the slice-0 baseline. Stop instead of using a local Downloads copy, memory, or improvised geometry.

**Read first after that prerequisite lands:** `src/Hercules.tsx` (the focus surface), `src/Charter.tsx` (component pattern, focus trap, `onCommit`), the committed **`HEARTH_UX_PACKET.md` §13 in full**, and committed **`hearth-ux-plates.html` plates 11 and 14** — plate 11 draws all three states of this screen, plate 14 dimensions it.

**Create:** `src/core/onboarding/shellView.ts`, `src/OnboardingChat.tsx`, `src/onboarding.css`, `test/onboarding-conductor.test.ts`
**Modify:** `src/Hercules.tsx` (render the shell inside the existing focus surface — **do not add a route or a tab**), `src/core/index.ts`

**The governing idea, and the thing to get right before anything else: this is not a chatbot.** It is a page Hercules is writing, one chapter at a time. **Hercules speaks in the display face at 22px and never gets a bubble or an avatar.** If a reviewer looks at the screen and thinks "messaging app," the slice is wrong regardless of what the code does.

**Geometry goes in `shellView.ts` as exported constants — never hard-coded in the component:**

```ts
export const SHELL_VIEW = {
  padTop: 22, padSide: 20,
  railMarkWidth: 26, railMarkHeight: 3, railGap: 6,
  railToTurn: 22, turnToHerc: 10, hercToCard: 18,
  cardToAction: 20, actionToFoot: 26,
  navButtonHeight: 48, returnBarHeight: 44, minTouch: 44,
  hercMaxEm: 24,
} as const;
```

**Anatomy, top to bottom:** sitting rail → turn line → Hercules line → **one** card (task or evidence) → action row → foot with the stop link.

**Three rail marks for three sittings — never twelve for twelve chapters.** Twelve marks read as a progress bar, which is the one thing this design refuses to be.

**The evidence card carries a provenance line and it is not optional** — `From the charter record`. A card that cannot cite its source does not render.

**Rules:**
- Reuses the existing full-screen focus surface. **No new nav tab, no replacement screen, no onboarding-only copy of an existing form.**
- The Next control is present wherever `continue` is permitted.
- Sitting boundaries render `sitting.pause` with a real Pause control.
- Nothing auto-advances; no animated number; **no timer, no percentage**.
- Tokens, type, spacing, focus and states per `HEARTH_UX_PACKET.md`. **No hex literals.**

**Tests:** fence — `OnboardingChat.tsx` contains no `setTimeout` used to advance, no `document.querySelector`, no `%` in a data-bearing string, and **none of `bubble`, `avatar`, `timestamp`, `typing`**; every spacing value comes from `SHELL_VIEW`, asserted by a fence that the CSS/JSX contains no bare pixel literal for the listed gaps; Next reachable by keyboard in every state; screenshots at 320 / 390 / 720 / ~1100 compared against plate 11.

---

## Onboarding slice 8 — the witness shell and the noticed status

**Branch:** `onboarding/8-witness` · **PR:** `feat(onboarding): the witness surface and the noticed status` · **Owner:** Cursor · **Depends on:** 7

**Read first:** the committed `HEARTH_UX_PACKET.md` §13.4 and §13.6, and committed **plate 12**. If slice 7's companion-artifact prerequisite is still open, stop.

**Create:** `src/OnboardingWitness.tsx`, `test/onboarding-witness.test.ts`
**Modify:** `src/OnboardingChat.tsx`, `src/onboarding.css`

**Rules:**
- The witness sees whose turn it is, what the chapter is for, and **household-scoped** evidence as it lands. Never a partner-Personal fact.
- Copy tells them plainly they are not expected to type (`chapter.turn.witness`).
- **The noticed status is a polite live region** (`role="status"`, `aria-live="polite"`). It announces without moving focus. **No duplicate announcement** when both devices observe the same completion — dedupe on `probeEvidenceKey`.
- Focus is preserved across a status update and returns predictably after any control.
- The witness never gets a control that writes the conductor's state.

**Tests:** the status node has `aria-live="polite"` and focus does not move on update; the witness render contains no partner-Personal id from the fixture; duplicate-announcement suppression; screenshots.

---

## Onboarding slice 9 — desktop conducting and the persistent return message

**Branch:** `onboarding/9-desktop-return` · **PR:** `feat(onboarding): desktop presence conducting and the persistent return instruction` · **Owner:** Cursor · **Depends on:** 7, 8

**Read first:** `src/Hercules.tsx:192` (`HerculesPresence` props), `src/App.tsx:5143` (how it is wired), `src/App.tsx:2165–2168` (**the auto-open conflict — do not change it here; slice 10 owns it**).

**Also read:** the committed `HEARTH_UX_PACKET.md` §13.5 and committed **plate 13** — the return bar is 44px furniture pinned above the nav, not a toast, with no dismiss. If slice 7's companion-artifact prerequisite is still open, stop.

**Create:** `src/core/onboarding/returnMessage.ts`, `test/onboarding-return.test.ts`
**Modify:** `src/Hercules.tsx`, `src/App.tsx` — **`onGo` wiring only, nothing else**

**Rules:**
- Desktop uses the existing `HerculesPresence` and bubble system with its existing `onGo`. **No new desktop surface.**
- A chapter's navigation button calls `onGo(target.tab)`, closes chat, and leaves a persistent instruction: **`"Finish here, then open Hercules."`**
- The message persists through ordinary navigation and safe resume until the probe passes or a documented blocking state. **Not a toast. It does not time out.**
- **Fence: `returnMessage.ts` contains no `setTimeout`, no route listener, and no click handler.** Only a probe clears it.

**Tests:** the message survives three simulated navigations and a reload; only a passing probe clears it; the fence.

---

# PART 2 — THE TWELVE CHAPTERS

*Slices 10–25. Every chapter uses the same shape. Money semantics get their own slice before the chapter that renders them.*

**The chapter template every slice below fills in:** household outcome · roles · sitting and budget · read first · create/modify · probe · evidence · choreography · states · skip and approval · tests · acceptance · do not.

---

## Onboarding slice 10 — Chapter 1 · Meet Hercules  *(and the auto-open fix)*

**Goal:** two people opt in together and know what they agreed to. **And the first-launch auto-open becomes an invitation.**
**Branch:** `onboarding/10-ch1-meet` · **PR:** `feat(onboarding): Chapter 1 — Meet Hercules, and the invitation replaces auto-open` · **Owner:** Cursor · **Depends on:** 1–9
**Roles:** both · **Sitting 1 · ~4 min**

**Read first:** `src/App.tsx:2165–2172`, `src/core/charterFounding.ts:93` (`householdNeedsCharterFounding`), and **plates 9 and 10** — the invitation is a card on Home, not a takeover, and the handshake is two devices.

**Modify:** `src/App.tsx` (the auto-open effect **only**), `src/OnboardingChat.tsx`
**Create:** `test/onboarding-invitation.test.ts`

**The fix — this is the slice's most important change.** Today:

```ts
if (householdNeedsCharterFounding(household)) setCharterFoundingOpen(true);
```

An empty household is dropped straight into Charter founding with no invitation, no explanation, no partner. That is the D-129 auto-start this manual supersedes.

**Change the consumer, not the predicate.** `householdNeedsCharterFounding` stays exactly as it is. The effect now offers the household track (`offerHouseholdOnboarding`) instead of opening founding. Charter founding is reached through Chapter 3, like every other surface.

**Release gate:** this invitation and the transition into active household setup are Development-only until a Production-capable opening-truth path is accepted. In Production, keep free roam and do not offer or activate this track; the mode record remains shaped only so malformed or future data fails closed.

**Probe:** `state === "active"` with **both** member ids in `confirmedByMemberIds`. Nothing else counts.

**Choreography:** Hercules explains his role, the setup lock on **both** members, pause and resume, the Confirm boundary, the privacy boundary, and what finishing accomplishes. He names the three sittings and their honest lengths. One control: **Start together**. The partner's device shows the same explanation and **Yes, let's start**. Neither activates alone. One line introduces the personal track as available later and never required.

**States:** *offered* — shown once, quiet, dismissible, never repeated · *handshake-pending* — waiting copy plus expiry · *expired* · *active*.

**Skip/approval:** household-required, no skip; the handshake is the approval.

**Tests:** an empty Development household **does not** open Charter founding and **does** show the invitation; a Production household gets neither the takeover nor an onboarding invitation; the invitation renders at most once per household until dismissed or accepted; activation is impossible from one device; expiry copy at the right moment; keyboard path through both sides; **a fence that `App.tsx` no longer calls `setCharterFoundingOpen` from the `householdNeedsCharterFounding` effect.**

**Do not:** delete `householdNeedsCharterFounding`. Do not touch any other part of `App.tsx`.

---

## Onboarding slice 11 — Chapter 2 · Open the right household

**Branch:** `onboarding/11-ch2-household` · **PR:** `feat(onboarding): Chapter 2 — Open the right household` · **Owner:** Cursor · **Depends on:** 10
**Roles:** both · **Sitting 1 · ~3 min**

**Read first:** `src/core/membershipAccess.ts`, `src/auth/accountFlow.ts`, `test/shared-money-membership.test.ts`.

**Probe:** valid authenticated identity **and** two valid household seats **and** a resolvable Household scope. **Auto-completable** when all three hold.

**Evidence:** household-scoped — household name, both member display names, environment. Never a partner's Personal scope contents.

**States:** missing Auth · missing partner membership · multiple households (ask which, never guess) · revoked membership · offline cached identity (**proceed read-only, chapter stays pending, never complete from cache**) · member or household switch mid-flow (return to this chapter; do not carry progress across identities).

**Tests:** each failure state reachable and correctly copied; offline cached identity never completes; a household switch resets to this chapter and leaks no prior-household progress.

---

## Onboarding slice 12 — Chapter 3 · Write the household Charter

**Branch:** `onboarding/12-ch3-charter` · **PR:** `feat(onboarding): Chapter 3 — the Charter` · **Owner:** Cursor · **Depends on:** 11
**Roles:** joint · **Sitting 1 · ~8 min, declared pause after question two**

**Read first:** `src/core/charter.ts`, `src/core/charterFounding.ts`, `src/CharterFounding.tsx`, `src/Charter.tsx`, `test/charter-record.test.ts`.

**Probe:** a Charter exists **and** `charterIsSigned(charter)` is true **and** both signatures are against the same revision. Signed by one is *pending*, not complete.

**Evidence:** household-scoped — purpose, custodian, split rule in their own words, ceiling, cadence, both signature dates. Use `charterCeilingLabel()` and `signatureLines()`; do not re-derive them.

**Choreography:** two sentences on what a charter is, then the real navigation button to the existing founding flow. Chat closes; `nav.return` persists. On probe pass the noticed status fires on both devices; reopening shows the charter card and congratulates.

**States:** none exists · exists unsigned · signed by one (**`waiting.partner`, never a nag aimed at the other person**) · signed against a superseded revision (`ineligible: "stale"`) · amended mid-flow (re-probe; never silently stay complete against an old revision).

**Skip/approval:** household-required, joint, **cannot be skipped**. One member may not sign for the other. Chat text is never a signature.

**On the ceiling:** founding collects `ceilingKind` and `ceilingValue`, and the evidence card shows `charterCeilingLabel()`. Register slice 11 is merged under D-201, so the accepted ceiling already constrains Ask route presentation; reuse that behavior and do not reimplement it in onboarding.

**Tests:** a one-signature household reads pending; two signatures on different revisions read stale; the chapter completes only from the typed record — **a test that visits the founding route without signing and asserts the chapter is still pending.**

**Do not:** reimplement, restyle, or fork `CharterFounding.tsx`. Do not collect charter answers in chat.

---

## Onboarding slice 13 — Chapter 4 · Map where money lives

**Branch:** `onboarding/13-ch4-accounts` · **PR:** `feat(onboarding): Chapter 4 — where money lives` · **Owner:** Cursor · **Depends on:** 12
**Roles:** Bianca conducts, Jonathan witnesses · **Sitting 2 · ~6 min, pause after the shared accounts**

**Read first:** `src/AddAccountTiles.tsx`, `src/core/accountKinds.ts`, `src/core/swipe.ts` (`isEligibleSwipeCard`, `resolveSwipeCardAccount` — the Fund card is already resolvable; reuse it).

**Probe:** at least one shared account exists **and** `resolveSwipeCardAccount()` resolves a Fund backing card. Personal accounts are **not** part of the household probe.

**Evidence:** household-scoped for shared accounts and the Fund card. Self-personal for the viewer's own Personal accounts. **Partner-Personal accounts dropped entirely.**

**States:** none · shared present, Fund card missing · a shared requirement only a **partner-Personal** account could satisfy → **blocked with `blocked.privacy`, which must not reveal the account exists** · offline queued additions.

**Skip/approval:** household-required for the shared set; personal account setup is **member-skippable** and visible only to its owner.

**Tests:** a partner-Personal account cannot satisfy the shared probe **and does not appear in the other member's evidence**; skipping personal accounts records a skip and fabricates nothing.

**Do not:** create a bank feed, imply Hearth can move money, or plan an issued card.

---

## Onboarding slice 14 — Chapter 5 · Bring the books to today

**Branch:** `onboarding/14-ch5-opening` · **PR:** `feat(onboarding): Chapter 5 — bring the books to today` · **Owner:** Codex · **Depends on:** 13
**Roles:** Bianca conducts, Jonathan witnesses · **Sitting 2 · ~6 min, pause between accounts**

**Read first:** `src/core/openingTruth.ts` **in full**, `src/OpeningTruthCard.tsx`, `test/opening-truth.test.ts`, and **D-183** in `docs/DECISIONS.md`.

**Reuse, do not rebuild.** `openingEligibleAccounts`, `buildOpeningTruthDraft`, `openingTruthReviewSummary`, `householdHasAcceptedMoney`, `hasPostedOpeningTruth`, `hasOnlyOpeningCorrectionHistory`, `openingBatchRows` all exist.

**Probe:** Development only: `hasPostedOpeningTruth(household)` is true **and** the accepted batch covers every shared account from Chapter 4 that has a non-zero opening amount. A legitimate zero-balance account is outside the required opening-line set and cannot keep the chapter pending; do not fabricate a zero-value journal row to mark coverage.

**Evidence:** household-scoped — the accepted receipt, the accounts covered, the civil date, the balanced Opening equity line.

**The state that matters most.** `householdHasAcceptedMoney(household) === true` **and** `hasPostedOpeningTruth(household) === false` **and** `hasOnlyOpeningCorrectionHistory(household) === false` → ordinary money exists but the books are not demonstrably current. **Fail closed.** Render `blocked.stale` naming the conflict and offer the correction path the command already supports. **Never weaken `openingTruth.ts` to let onboarding pass.**

Also: partial coverage of the non-zero opening-line set reads pending, not complete. Production is blocked before setup activation until its own accepted opening-truth path exists; Chapter 5 must never become an unavoidable Production dead end.

**Skip/approval:** household-required, no skip.

**Tests:** partial non-zero coverage reads pending; a zero-balance shared account needs no fabricated opening row and does not block; the ineligible-with-ordinary-money case blocks and is copied honestly; Production cannot enter the track; **a fence that this slice's diff does not modify `src/core/openingTruth.ts`**; Toronto civil-date and balanced-equity invariants unchanged.

**Do not:** reconstruct history, fabricate income, double-open the books, or relax any boundary the command enforces.

---

## Onboarding slice 15 — Chapter 6 · Set up the Household Fund

**Branch:** `onboarding/15-ch6-fund` · **PR:** `feat(onboarding): Chapter 6 — the Household Fund` · **Owner:** Codex · **Depends on:** 14
**Roles:** Bianca conducts, joint approval · **Sitting 2 · ~5 min**

**Read first:** `src/core/householdFund.ts`, `configureHouseholdFund` in `commands.ts`, `test/custody-fence.test.ts`.

**Create:** `src/core/onboarding/fundApproval.ts`, `test/onboarding-fund-approval.test.ts`
**Modify:** `src/core/types.ts`, `src/core/commands.ts`, `src/core/index.ts`, `src/core/household.ts`, `src/core/sync.ts`, and accepted-command replay/identity files required by the Shared record.

```ts
export type OnboardingFundApproval = {
  id: string; householdId: string; memberId: string;
  publicConfigDigest: string;
  approvedAt: string;
};

export function fundConfigApprovalDigest(household: Household): string | null;
export function bothApprovedFundConfig(household: Household, digest: string): boolean;
approveOnboardingFundConfig(household, { memberId, createdBy, publicConfigDigest }): CommitResult
```

The digest covers only Shared-visible meaning: configured status, custodian, and public operating rules. It never contains the Personal backing-account id, institution, or other private metadata. A private backing-account change is the custodian's responsibility and does not ask the partner to approve a fact they cannot inspect.

**Probe:** a Fund configuration exists **and** both members approved its current `publicConfigDigest`.

**Evidence:** household-scoped — configured status, custodian, public operating rules, and approval dates. The backing account's id, name, institution, and metadata are self-personal to the custodian and never enter witness evidence.

**Choreography:** conductor configures on the Fund surface; witness sees it land, then gets their own approval control. **Approval is a button and a reviewed command — never a chat reply.**

**States:** unconfigured · configured, one approval · approvals against different revisions (`stale`) · **custodian mismatch with the Charter → blocked with `"Custody moves through the Fund, not the charter."`**

**Skip/approval:** household-required, joint, cannot be skipped.

**Tests:** one approval reads pending; mismatched revisions read stale; a cross-member or omitted `createdBy` refuses; offline approvals merge without loss; witness evidence and the Shared approval digest contain no backing-account id or institution; **`projectHouseholdFund` is byte-identical before and after this chapter** — approval is not a journal post.

**Do not:** move money, imply money moved, or post a journal row.

---

## Onboarding slice 16 — Chapter 7 · Put regular money on the calendar

**Branch:** `onboarding/16-ch7-recurrences` · **PR:** `feat(onboarding): Chapter 7 — regular money` · **Owner:** Cursor · **Depends on:** 15
**Roles:** Bianca conducts, Jonathan witnesses and may add · **Sitting 2 · ~6 min, pause every third recurrence**

**Read first:** `src/core/recurrence.ts`, `addRecurrence` and `postOneRecurrence` in `commands.ts`, `src/core/monthObligations.ts` (how a recurrence becomes an obligation).

**Probe:** at least the household's rent-or-equivalent plus one other recurrence exist as valid recurrences. Existing valid recurrences count without duplication.

**Evidence:** household-scoped — label, cadence, amount, next date, per recurrence.

**Choreography:** Hercules distinguishes three things explicitly, because conflating them is how this chapter goes wrong — a **reminder**, a **standing fact** that anchors the plan, and an **actual posted occurrence**. Only the middle one is needed here.

**Skip/approval:** household-required; optional recurrences beyond the minimum are member-skippable.

**Tests:** an existing valid recurrence satisfies the probe **with no new row created**; **no occurrence is ever posted by this chapter** — a fence that the chapter module never imports `postOneRecurrence`, plus a journal-equality assertion.

---

## Onboarding slice 17 — Chapter 8 · Teach Hearth how each person earns

**Branch:** `onboarding/17-ch8-cadence` · **PR:** `feat(onboarding): Chapter 8 — earning cadence` · **Owner:** Cursor · **Depends on:** 16
**Roles:** each member conducts their own · **Sitting 2 · ~4 min each**

**Read first:** `src/core/work.ts` (`defaultWorkSchedule`, `WorkPaySchedule`), `src/core/recurrence.ts` (`projectCadence`), `src/core/ask.ts` (`nextPaydayDate` — already consumes the cadence).

**Modify:** `src/core/types.ts`, `src/core/work.ts`, the existing schedule command in `src/core/commands.ts`, `src/core/sync.ts`, and the schedule tests. Extend `WorkPayCadence` with `"irregular"`; shaping must preserve it, while timing projections such as `nextPaydayDate` and `paydayTicks` return no invented regular date or amount for it.

| | Scope | Required? |
|---|---|---|
| **Cadence** — when this member is paid, by what rhythm | household | **required** |
| **Detail** — job records, rates, deductions, landing accounts, shift specifics | personal | **personal track** (slice 26) |

The household plan needs both members' cadence: one member's regular pay is the month's metronome (`paydayTicks` already draws it) and the other's variable earning is what closes the gap. **Cadence is timing. It is never an assumed amount.**

**Probe:** each member has a valid pay cadence. A member's probe is satisfied only by their own record.

**Evidence:** household-scoped: `"{Name} is paid every second Thursday."` Self-personal: the member's own detail. **Partner detail never appears.**

**States:** cadence missing · cadence recorded, detail skipped (complete for the household track) · **irregular earner with no fixed cadence → `"irregular"` is a first-class valid answer, never a blank.**

**Skip/approval:** cadence **member-required**; detail **member-skippable**, and a skip is explicit progress — not fabricated income.

**Tests:** a skip records a skip and no income row; one member's detail never reaches the other's evidence; `"irregular"` survives shaping and continuity, satisfies the probe, and produces no invented payday date, tick, or amount.

**Do not:** ask for or store an assumed contribution amount. That is the discovery month's job.

---

## Onboarding slice 18 — the submission contract

**Branch:** `onboarding/18-submissions` · **PR:** `feat(onboarding): self-owned category and estimate submissions` · **Owner:** Codex · **Depends on:** 17

**Read first:** `src/core/contributionRegister.ts` **including its fence test** at `test/contribution-register.test.ts:323` — copy that fence's shape.

**Create:** `src/core/onboarding/submissions.ts`, `test/onboarding-submissions.test.ts`
**Modify:** `src/core/types.ts`, `src/core/commands.ts`, `src/core/index.ts`

```ts
export type SubmissionKind = "categories" | "estimates";

export type OnboardingSubmission = {
  id: string; householdId: string; memberId: string;   // self-owned
  kind: SubmissionKind;
  revision: number;
  categoryIds: string[];                                // kind "categories"
  estimates: Array<{ subcategoryId: string; amountCents: number }>;   // kind "estimates"
  submittedAt: string;                                  // set only by the explicit Submit
  supersededBy: string | null;
};

export function currentSubmission(household, memberId, kind): OnboardingSubmission | null;
export function mergedCategorySelection(household): { unionIds: string[]; bySubmitter: Record<string, string[]> };
export function mergeSubmissions(server, client): OnboardingSubmission[];
```

```ts
submitOnboardingCategories(household, { memberId, createdBy, categoryIds }): CommitResult
submitOnboardingEstimates(household, { memberId, createdBy, estimates }): CommitResult
```

**Rules — each a test:**
1. **Self-owned.** Trusted `createdBy` must equal the target `memberId`; writing another member's submission or omitting the actor throws `"Only you can submit your own."`
2. Shared **only** at the explicit Submit. Drafts are private to their author.
3. Sharing covers **only** the selected category ids and estimate cents. No partner-Personal source fact is disclosed.
4. **No ownership, no ratio, no ranking, no "his versus hers", no journal entry.** Fence: `submissions.ts` contains no `/ratio|share|percent|ranking|owner/i` and no `/ total`.
5. Replacement bumps `revision` and sets `supersededBy` on the old row. History is auditable, never mutated in place.
6. **Merge law:** simultaneous offline submissions merge without loss. Category selection merges as a **deterministic union ordered by category id**; estimates never merge across members.
7. **Missing and zero estimates are distinct.** Zero means "we spend nothing here"; missing means "not answered" and is never imputed. Represent missing as an absent row, not `0`.

**Decision to log: an onboarding submission shares a choice, not a claim.**

---

## Onboarding slice 19 — Chapter 9 · Choose what the household budget covers

**Branch:** `onboarding/19-ch9-categories` · **PR:** `feat(onboarding): Chapter 9 — what the budget covers` · **Owner:** Cursor · **Depends on:** 18
**Roles:** both, independent · **Sitting 3 · ~5 min**

**Read first:** `src/AddCategoryForm.tsx`, `src/core/onboarding/submissions.ts`.

**Probe:** both members have a current `categories` submission. One submission is *waiting-member*, not complete.

**Evidence:** household-scoped — the merged union and which categories each member selected. **Never a comparison and never a count of who chose more.**

**Choreography:** each member selects independently on their own device **without seeing the other's selection until both have submitted.** Then the union is shown to both.

**Rules:** define the exact point at which a *proposed* category becomes an *accepted canonical* category — a reviewed command, once, at merge, not per selection. Conflicts (same name, different id) surface for a joint decision and never auto-resolve.

**Skip/approval:** household-required joint gate; **cannot be globally skipped**. Individual choices are free.

**Tests:** one submission reads waiting-member; the union is deterministic under submission order; a proposed category does not become canonical before the merge command; **no ratio or count-comparison in any rendered string.**

---

## Onboarding slice 20 — Chapter 10 · It's okay to guess

**Branch:** `onboarding/20-ch10-estimates` · **PR:** `feat(onboarding): Chapter 10 — it's okay to guess` · **Owner:** Cursor · **Depends on:** 19
**Roles:** both, independent · **Sitting 3 · ~5 min**

**Required copy, byte-exact including punctuation and the curly apostrophe:**

> **`It's okay to guess. This is the first shape, not a promise; Hearth will learn from what actually happens.`**

**Probe:** both members have a current `estimates` submission covering the merged category set.

**Evidence:** household-scoped after both submit — each member's own numbers, labelled by author, **no comparison and no total-versus-total framing.**

**Rules:** shared only at the explicit Submit. Guesses are not promises, postings, contribution commitments, ratios, or approvals of the final plan — copy says so and a fence asserts no rendered string implies otherwise. Missing and zero are distinct and both answerable.

**Skip/approval:** household-required joint gate. An individual **category** may be left un-estimated (recorded missing); the chapter cannot be skipped.

**Tests:** the exact copy string byte-for-byte; a zero estimate and a missing estimate produce different stored state; neither is imputed.

---

## Onboarding slice 21 — the proposal formula and the source digest

**Branch:** `onboarding/21-proposal` · **PR:** `feat(onboarding): the deterministic first-plan proposal` · **Owner:** Codex · **Depends on:** 20

**Read first:** `src/core/houseRunRate.ts`, `src/core/monthObligations.ts`, `src/core/ask.ts` (how a derived module carries its source instead of recomputing), `test/ask.test.ts:291` (the derivation fence).

**Create:** `src/core/onboarding/proposal.ts`, `test/onboarding-proposal.test.ts`
**Modify:** `src/core/index.ts`

```ts
export const PROPOSAL_FORMULA_VERSION = 1;

export type ProposalBasis = "both-estimates" | "single-estimate" | "recurrence-floor" | "run-rate-raised";

export type ProposalInput = {
  subcategoryId: string;
  label: string;
  estimatesCents: Array<{ memberId: string; amountCents: number | null }>;  // null = missing
  recurrenceFloorCents: number;
  runRate:
    | { eligible: false; reason: "insufficient-weeks" | "untied" | "absent" }
    | { eligible: true; monthlyCents: number; weeksWatched: number };
};

export type ProposalRow = ProposalInput & { proposedCents: number; basis: ProposalBasis };

export type BudgetProposal = {
  monthKey: MonthKey;
  formulaVersion: number;
  rows: ProposalRow[];                    // ordered by subcategoryId, ascending
  totalCents: number;
  capacityCents: number | null;
  capacitySourceRevision: string | null;    // stable revision/digest of the accepted capacity fact
  sourceDigest: string;
};

export function buildProposal(household: Household, monthKey: MonthKey, today: DateKey): BudgetProposal;
export function proposalDigest(proposal: Omit<BudgetProposal, "sourceDigest">): string;
```

**The frozen formula.** Per category, in integer cents:
1. Both estimates present → their **mean, rounded half-up**. One present → that one. None → `0`.
2. **Raise to `recurrenceFloorCents` if higher.** Never below the exact recurring obligations assigned to that category.
3. **Only if `runRate.eligible` is true**, raise to `runRate.monthlyCents` if higher, and set `basis: "run-rate-raised"`.
4. Never lower. Never trim. Never redistribute.

> **On a first run step 3 never fires.** `RUN_RATE_MIN_WEEKS` is 3 and a founding household has watched zero, so `runRate.eligible` is `false` with reason `"insufficient-weeks"`. **This is the expected path and the default test fixture.** Copy key `runrate.absent`.

**The digest** covers, normalized and deterministic: `monthKey`, `formulaVersion`, both submission ids and revisions, the merged category id list, every `recurrenceFloorCents`, run-rate eligibility and value, `capacityCents`, `capacitySourceRevision`, and every row's `subcategoryId` + `proposedCents`. Any accepted capacity edit changes its source revision and therefore invalidates earlier approvals. **Same meaning in, same digest out, regardless of input ordering.**

**Rules:** deterministic and order-independent · integer cents only, **no float in a stored value** · **no ratio, no ranking, no silent trim** — fence: `proposal.ts` contains no `/percent|ratio|rank|trim/i` · absent, zero, conflicting, stale and newly-added categories each have defined, tested behavior · **no model call, ever.**

**Tests:** shuffled inputs produce an identical digest (run 20 permutations); changing either capacity cents or its accepted source revision changes the digest and invalidates prior approvals; the floor is never breached; **the run-rate-absent path is the primary fixture**; a category added after submission yields `"single-estimate"` or `"recurrence-floor"` and never throws; the fence.

**Decision to log: the first plan is deterministic and floor-respecting.**

---

## Onboarding slice 22 — approvals

**Branch:** `onboarding/22-approvals` · **PR:** `feat(onboarding): self-owned approvals keyed to a digest` · **Owner:** Codex · **Depends on:** 21

**Create:** `src/core/onboarding/approvals.ts`, `test/onboarding-approvals.test.ts`
**Modify:** `src/core/types.ts`, `src/core/commands.ts`, `src/core/index.ts`

```ts
export type OnboardingApproval = {
  id: string; householdId: string; memberId: string;
  scope: "proposal" | "ready";             // fund-config approval is owned by slice 15
  digest: string;
  approvedAt: string;
};

export function approvalsFor(household, scope, digest): OnboardingApproval[];
export function bothApproved(household, scope, digest): boolean;

approveOnboardingProposal(household, { memberId, createdBy, digest }): CommitResult
approveOnboardingReady(household, { memberId, createdBy, digest }): CommitResult
```

**Rules:** append-only, self-owned, keyed to the exact digest · trusted `createdBy` must equal `memberId` · **one member cannot approve, replace, or revoke another's** — throws `"Only you can approve for yourself."` · any meaning-bearing edit produces a new digest, and approvals against the old digest **remain auditable but cannot authorize adoption** · concurrent offline approvals for the same digest merge without loss · **a chat reply never creates an approval** — enforced at the action layer (slice 4) and asserted here. Fund-configuration approval is already defined, persisted, and merged in slice 15; this slice must not create a second record for it.

**Tests:** cross-member approval throws; an edit invalidates authorization while preserving the old record; two-device concurrent approval merges; a stale-digest approval never authorizes.

---

## Onboarding slice 23 — atomic budget-plan adoption

**Branch:** `onboarding/23-adoption` · **PR:** `feat(onboarding): exactly-once budget adoption` · **Owner:** Codex · **Depends on:** 22

**Read first:** `setBudget` in `src/core/commands.ts:1488` and `seedBudgetPlan` at `:1473` — this command batches over that exact behavior.

```ts
adoptFirstBudget(household, { memberId: string; createdBy: string; monthKey: MonthKey; proposalDigest: string }): CommitResult
```

**Preconditions, all validated before anything is written:** valid identity and membership · household mode `"active"` · proposal revision and digest still current · **both members' approvals present against this exact digest** · month matches · category set matches · every amount an exact integer cent · this adoption identity **not already applied**.

**Postconditions:** the complete batch of plan writes applied **exactly once, all or nothing** · an accepted command receipt · **no journal row, no transfer, no Confirm-boundary change** · idempotent on retry by adoption identity.

**Rules:** **cannot partially apply** — a failure mid-batch leaves zero plans changed. Define retry, duplicate, stale, conflict, offline/outbox, rejection, and post-commit interruption. **Existing accepted plans are never overwritten silently**; they may seed a proposal under the frozen rules and appear as evidence, but two matching approvals for the current digest are the only authorization to change them.

**Tests:** a forced mid-batch failure leaves `household.budgetPlans` deep-equal to before · duplicate invocation is a no-op returning the same receipt · a stale digest is rejected · **the journal is deep-equal before and after adoption** · an existing plan is not overwritten without matching approvals.

**Decision to log: the first budget is adopted atomically, and changes plans only.**

---

## Onboarding slice 24 — Chapter 11 · Hercules lays out the first plan

**Branch:** `onboarding/24-ch11-plan` · **PR:** `feat(onboarding): Chapter 11 — the first plan` · **Owner:** Cursor · **Depends on:** 23
**Roles:** joint · **Sitting 3 · ~7 min, pause before approval**

**Read first:** `src/core/registerView.ts` and `src/Register.tsx` (the drawing pattern and its presentation states), `src/core/askView.ts` (`askBelongsOnDesk`).

**Probe:** an accepted `adoptFirstBudget` receipt for the current month.

**Anatomy:** both submitted estimate sets, authored and **uncompared** · the exact recurrence anchors · the run-rate line — **on a first run, the honest empty state** · one proposed amount per category showing input values, eligibility, source label, formula result, integer cents · the total against entered capacity · each member's own approval control.

**Rules:** every number shows its basis — a proposed figure with no visible derivation is a bug · **never** silently trim, compute a ratio, rank members, or tell one member how much the other must work · editing creates a new revision and digest and **visibly invalidates approvals — the copy warns before the edit, not after** · **the Ask, routes, and any hours figure do not appear**; fence that this component imports nothing from `ask.ts`, `askRoutes.ts`, or `askView.ts`.

**States:** built · one approval (waiting-member) · edited after approval · adopting · adopted · adoption failed (nothing changed, honest retry).

**Tests:** the run-rate-empty copy is the default render; an edit visibly clears approvals; the Ask/routes import fence; screenshots at four breakpoints, conductor and witness.

---

## Onboarding slice 25 — Chapter 12 · Prove tomorrow will be easy

**Branch:** `onboarding/25-ch12-ready` · **PR:** `feat(onboarding): Chapter 12 — ready, and unlock` · **Owner:** Codex · **Depends on:** 24
**Roles:** joint · **Sitting 3 · ~5 min**

**Read first:** **D-128** in `docs/DECISIONS.md`, `src/core/monthRehearsalPractice.ts`, `src/MonthRehearsalPanel.tsx`, `test/month-rehearsal.test.ts`. **Practice isolation already exists — reuse it, do not re-invent it.**

**Two paths:** the member already posted an eligible **accepted** transaction → show the privacy-safe evidence and count it. Otherwise → an isolated **Practice** input and correction under D-128, discarded afterward.

**The D-128 line, asserted not assumed:** a Practice row never enters journals, PGlite accepted books, continuity snapshots, reports, streaks, Health, or accepted-money progress. Copying Practice creates a real **draft** only, still requiring review and Confirm.

**The finale:** finish on Books and Health · show the checklist from `householdGatesOutstanding()` · each member gives their **own** Ready approval against the same completion digest · **unlock only when every non-skippable household gate is satisfied and both Ready approvals are valid.**

**After unlock:** show what onboarding established, state honestly that routine ledger inputs remain (`unlock.honest`), and offer the personal track.

**Repair:** define retry and repair when unlock is interrupted **after** the completion record is accepted — the household must converge to unlocked, never to a state where the record says complete and the lock says active.

**Tests:** a Practice row appears in no accepted projection, streak, or Health figure; one Ready approval reads waiting-member; unlock is impossible with an outstanding gate; an interrupted unlock converges to unlocked on next launch; the post-unlock copy states the ongoing-input truth.

---

# PART 3 — THE PERSONAL TRACK

## Onboarding slice 26 — the personal modules

**Branch:** `onboarding/26-personal` · **PR:** `feat(onboarding): the opt-in personal track` · **Owner:** Cursor · **Depends on:** 25
**Prefer:** land Till slice 4 (`landingSurface`) first — it is the member-owned-preference precedent this slice's mute switch follows.

**Never locks anything. Never gates anything. Never contributes to a household gate** — the registry validator rejects it; assert again here.

| Module id | Outcome | Contextual trigger | Budget |
|---|---|---|---|
| `pm-01-own-books` | personal accounts; Personal versus Household | a first personal transaction | ~4 min |
| `pm-02-shifts` | the clock, posting a shift, the streak | Ch 8 cadence recorded as shift-based | ~5 min |
| `pm-03-tips` | the tip oracle, and why it refuses below a real sample | **after a fourth posted shift** (`SHIFT_ORACLE_MIN_SHIFTS`) | ~4 min |
| `pm-04-own-plan` | personal budget categories | three personal transactions in one month | ~4 min |
| `pm-05-office` | plates, the desk, customization | first desktop session after unlock | ~3 min |
| `pm-06-hercules` | memories, asking, the chat | seven days after unlock | ~3 min |

**Offer rules:** each module declares an exact **trigger predicate over typed state** · **at most one offer per session, two per week** · **two declines and it is not offered again that month** (`declineCountByModule` from slice 3) · a member-owned mute switch (`setOnboardingOffersMuted`), which another member cannot change · every module individually skippable, resumable, out of order.

**Tests:** a personal module never appears in `householdGatesOutstanding()`; the frequency cap and two-decline rule hold across simulated sessions; the mute switch is self-owned and cross-member writes throw.

---

# PART 4 — LIFECYCLE

## Onboarding slice 27 — re-runs, new members, and the demo household

**Branch:** `onboarding/27-lifecycle` · **PR:** `feat(onboarding): lifecycle and re-run cases` · **Owner:** Codex · **Depends on:** 26

**Read first:** `src/core/seed.ts:207–220` (the six-month budget seed already there), `src/core/demoSuite.ts`, `src/core/syntheticRuntime.ts`.

| Case | Behavior |
|---|---|
| **Charter amended after completion** | **Nothing re-opens.** Onboarding is a starting point, not a standing gate. |
| **A new member joins** | Household stays complete. The new member gets a **member-scoped** Ch 1, 2, 8-cadence, plus the personal-track offer. **Never re-locks existing members.** |
| **Development → Production promotion** | Onboarding state is scoped by environment. A Production household starts `"inactive"` and never inherits a Development completion. |
| **The seeded demo household** | **Arrives onboarding-complete**, with a synthetic completion digest and both Ready approvals. **A demo must never open in setup mode.** Extend `seed.ts` / `demoSuite.ts`. |
| **Stopped-incomplete, resumed later** | Re-probe every chapter against current canonical state. Chapters whose facts changed underneath return to pending; nothing stays complete on stale evidence. |
| **Registry version bump mid-flow** | Household enters `"repair"`, not `"active"`. Define the migration; fail closed on an unknown chapter id. |

**Tests:** a seeded demo household reads complete and never renders the invitation; a Production household does not inherit Development completion; a resumed household re-probes and demotes a chapter whose evidence went stale.

---

# APPENDIX A — SLICE INDEX

| Say this | Branch | Owner | Depends | Risk | Ships |
|---|---|---|---|---|---|
| do onboarding slice 0 | `onboarding/0-verify` | Codex | — | none | the verified baseline |
| do onboarding slice 1 | `onboarding/1-registry` | Codex | 0 | med | the chapter registry + validator |
| do onboarding slice 2 | `onboarding/2-household-mode` | Codex | 1 | **high** | the handshake, setup mode |
| do onboarding slice 3 | `onboarding/3-progress` | Codex | 2 | **high** | member progress, resume, dev unlock |
| do onboarding slice 4 | `onboarding/4-actions` | Codex | 3 | **high** | semantic actions, affirmative classifier |
| do onboarding slice 5 | `onboarding/5-evidence` | Codex | 1 | **high** | the privacy-scoped projector |
| do onboarding slice 6 | `onboarding/6-copy` | Claude | 1 | low | the copy deck + flavor variants |
| do onboarding slice 7 | `onboarding/7-conductor-mobile` | Cursor | 1–6 | med | the conductor shell |
| do onboarding slice 8 | `onboarding/8-witness` | Cursor | 7 | med | the witness surface + noticed status |
| do onboarding slice 9 | `onboarding/9-desktop-return` | Cursor | 7, 8 | med | desktop presence + persistent return |
| do onboarding slice 10 | `onboarding/10-ch1-meet` | Cursor | 1–9 | **high** | Ch 1 · Meet Hercules **+ the auto-open fix** |
| do onboarding slice 11 | `onboarding/11-ch2-household` | Cursor | 10 | med | Ch 2 · the right household |
| do onboarding slice 12 | `onboarding/12-ch3-charter` | Cursor | 11 | med | Ch 3 · the Charter |
| do onboarding slice 13 | `onboarding/13-ch4-accounts` | Cursor | 12 | med | Ch 4 · where money lives |
| do onboarding slice 14 | `onboarding/14-ch5-opening` | Codex | 13 | **high** | Ch 5 · books to today |
| do onboarding slice 15 | `onboarding/15-ch6-fund` | Codex | 14 | **high** | Ch 6 · the Fund |
| do onboarding slice 16 | `onboarding/16-ch7-recurrences` | Cursor | 15 | med | Ch 7 · regular money |
| do onboarding slice 17 | `onboarding/17-ch8-cadence` | Cursor | 16 | med | Ch 8 · earning cadence |
| do onboarding slice 18 | `onboarding/18-submissions` | Codex | 17 | **high** | the submission contract |
| do onboarding slice 19 | `onboarding/19-ch9-categories` | Cursor | 18 | med | Ch 9 · what it covers |
| do onboarding slice 20 | `onboarding/20-ch10-estimates` | Cursor | 19 | med | Ch 10 · it's okay to guess |
| do onboarding slice 21 | `onboarding/21-proposal` | Codex | 20 | **high** | the formula + digest |
| do onboarding slice 22 | `onboarding/22-approvals` | Codex | 21 | **high** | self-owned approvals |
| do onboarding slice 23 | `onboarding/23-adoption` | Codex | 22 | **high** | atomic adoption |
| do onboarding slice 24 | `onboarding/24-ch11-plan` | Cursor | 23 | med | Ch 11 · the first plan |
| do onboarding slice 25 | `onboarding/25-ch12-ready` | Codex | 24 | **high** | Ch 12 · ready, and unlock |
| do onboarding slice 26 | `onboarding/26-personal` | Cursor | 25 | low | the personal track |
| do onboarding slice 27 | `onboarding/27-lifecycle` | Codex | 26 | **high** | re-runs, new members, demo |

**Critical path:** 0 → 1 → 2 → 3 → 4 → 7 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25.

**Legal parallel work:** 5 alongside 2–4 · 6 alongside anything after 1 · 8 and 9 after 7 while Codex runs 14–15 · 26 alongside 27.

**Model guidance.** Slices marked **high** change what a number means or who may act: run those on the strongest model available and route them through an independent trust reviewer. Slices marked **med** and **low** are well-specified enough for a mid-capability model — read the named "read first" files, follow §0.14, and do not deviate. **Slice 10 is marked high despite being a UI slice** because it changes first-launch behavior on `App.tsx`.

---

# APPENDIX B — DECISION RECONCILIATION AND PROPOSED TEXT

**Claim numbers at write time. Never reserve a range.** Highest in use on `200dfd1` is **D-206**. An earlier draft of the structural manual pre-assigned D-174 through D-184 on the belief that D-173 was highest; canon was already past D-189, and those slices landed under current numbers instead. Read `docs/DECISIONS.md` at write time.

| Slice | Decision to record | Number |
|---|---|---|
| 1 | onboarding chapters are a validated registry, not code paths | *claim at write time* |
| 2 | setup mode is entered by a co-present handshake and left by an honest stop | *claim at write time* |
| 4 | typed text may advance, never approve | *claim at write time* |
| 5 | onboarding proves completion with cited rows | *claim at write time* |
| 18 | an onboarding submission shares a choice, not a claim | *claim at write time* |
| 21 | the first plan is deterministic and floor-respecting | *claim at write time* |
| 23 | the first budget is adopted atomically, and changes plans only | *claim at write time* |

## B.1 Preserved from D-128 — unchanged

Visible separation between real books and Practice · real facts use ordinary commands and the existing Confirm · Practice is temporary and cannot enter journals, PGlite accepted books, continuity snapshots, reports, streaks, Health, or accepted-money progress · copying Practice creates a real **draft** only, still requiring review and Confirm.

Slice 25 asserts each as a test rather than inheriting it as an assumption. **Practice isolation is already implemented** (`monthRehearsalPractice.ts`) — reuse it.

## B.2 Superseded from D-129

| D-129 clause | Superseded by |
|---|---|
| automatic start after Home renders | the invitation and the **co-present handshake** (slices 2, 10). **This clause is still live in `App.tsx:2165–2168` — slice 10 removes it.** |
| the global persistent Skip action | **removed.** Personal skip, an honest stop, and a Development-only unlock replace it (§0.9) |
| "onboarding is not a chat experience" | **withdrawn.** Mobile uses the existing Hercules focus surface; desktop the living presence |
| route animation, camera choreography, target locking, or a visited target proving completion | **completion is typed, or it did not happen** (§0.3 law 1) |
| any finale that unlocks without the new gates | unlock requires every non-skippable gate **and** both self-owned Ready approvals (slice 25) |

## B.3 Preserved or adapted from D-129

The living Hercules and real navigation direction · no timer-based progress · typed deterministic dialogue and semantic actions · progress scoped to environment, household, Google member, and version · declared safe resume · Practice isolation through D-128 · **full-motion onboarding as a named accessibility exception and documented debt** · no sound, no Pokémon art or branding.

## B.4 Stale planning documents

`docs/ONBOARDING_UPDATE.md`, `docs/ONBOARDING_PART2_STORYBOARD.md`, `docs/briefs/CURSOR_ONBOARDING_FOUNDATION_PROMPT.md`, `docs/worksessions/2026-08-25-onboarding-update.md` all predate this contract and remain on `main`. Slice 0 lists every claim current code contradicts. **Known already: any sentence saying there is no opening-truth command is stale** — `src/core/openingTruth.ts` is present, and D-183 (the Month One rehearsal decision) carries the one-reversible-opening-batch rule it must respect.

## B.5 Proposed decision text — number unassigned

> **Hercules-led household onboarding.** *Proposed; number unassigned until Jonathan approves this manual and current canon is rechecked.*
>
> A household begins in free roam with ordinary Hercules available. Hercules may offer the household onboarding track once. The track begins only when one member proposes and the other confirms on their own device inside a bounded window; one member can never place the other in setup mode. While active, ordinary Hercules is unavailable to both members.
>
> The track is twelve chapters, conducted in the existing Hercules focus surface on mobile and the living presence on desktop. Every real task happens on the existing Hearth surface built for it; onboarding coordinates those surfaces and never forks a replacement. A chapter completes only from typed domain state, an accepted command receipt, or an exact configuration fact — never from a click, a route, a toast, elapsed time, or a model reply. Typed text may advance a chapter; it may never sign, submit, approve, or ready.
>
> There is no global Skip. Personal substeps and personal-track modules are skippable by their owner. Setup may be stopped at any time by the same handshake that started it; stopping restores ordinary Hercules and records the track as stopped and incomplete, never complete. A Development-only unlock exists for demonstration, writes no completion record, and marks the household permanently.
>
> The first shared budget is a deterministic, versioned, floor-respecting proposal in CAD integer cents, digested over all meaning-bearing inputs. Each member approves only for themselves against the exact digest. Both approvals authorize one atomic, idempotent batch command that changes budget plans only, creates no journal row, and cannot partially apply. Onboarding v1 makes no model calls.
>
> Unlock requires every non-skippable household gate and both members' self-owned Ready approvals. Onboarding establishes a starting point; it does not claim the books stay current without ongoing input.
>
> This supersedes the D-129 automatic start, the global Skip, and the not-a-chat delivery rule. The D-129 full-motion direction remains a named accessibility exception, isolated to onboarding.

## B.6 The accessibility debt, stated honestly

**Do not claim onboarding is reduced-motion accessible.** Every UI slice produces evidence of two facts: the exception exists and is isolated to onboarding, **and** reduced-motion behavior outside onboarding is intact. A fence asserts no onboarding motion primitive is imported by ordinary Hercules or any other screen.

---

# APPENDIX C — CUT, AND STAYING CUT

Say so and stop rather than building any of these.

- Historical import or history reconstruction of any kind.
- Bank feeds, Interac APIs, issued cards, or any money movement.
- Autonomous posting, or any model write authority.
- **Any model call in onboarding v1** — including a "harmless" flavor line.
- Model-controlled navigation, completion, progression, approval, or budget calculation.
- Partner-Personal disclosure or aggregation, including a summary implying a partner fact exists.
- Contribution ratios, category ownership, "his versus hers" ranking, or silent capacity trimming.
- **The Ask, routes, or any shortfall-to-shifts surface anywhere in the household track.**
- A new mobile navigation tab.
- Onboarding-only replacement versions of existing Hearth surfaces.
- New hosted schema, tables, columns, RPCs, Google scopes, secret changes, or Production work.
- A global onboarding Skip.
- Fake history, fake income, or Practice facts counted as accepted money.
- Sound, or Pokémon art or branding.
- A countdown, a timer, or a progress percentage.
- **Modifying `src/core/openingTruth.ts` to make Chapter 5 pass.**

---

# APPENDIX D — OWNERS, WAVES, AND THE COLLISION MAP

## D.1 Ownership

**Codex** — anything that changes what a number means or who may act: the registry validator, household mode and the handshake, member progress, semantic actions, the evidence projector, submissions, the formula and digest, approvals, atomic adoption, the finale gate, lifecycle, and the disclosure fences.

**Cursor** — anything that renders: the conductor and witness shells, the desktop wiring, the chapter components.

**Claude** — the copy deck and flavor variants, the choreography, the conductor/witness design, the accessibility specification, and visual review of every UI PR against `hearth-ux-plates.html`.

**Jonathan** — product approval, decision acceptance, merge, deploy, Production.

## D.2 The collision map

| File | Lines | Touched by | Rule |
|---|---|---|---|
| `src/core/commands.ts` | 6,067 | 2, 3, 15, 18, 22, 23, 25 | **Never two in flight.** One writer, merged before the next starts. |
| `src/core/types.ts` | 1,381 | 2, 3, 18, 22 | Never two in flight. |
| `src/App.tsx` | 6,347 | **10 and 9 only** | Slice 9 touches the `onGo` wiring; slice 10 touches the auto-open effect. **Nothing else opens this file.** Land 9 before 10. |
| `src/Hercules.tsx` | 1,591 | 7, 9 | Sequential. 7 lands before 9 starts. |
| `src/core/index.ts` | 218 | almost every slice | Append-only, one line per module. Low conflict risk but rebase before pushing. |
| `src/core/onboarding/registry.ts` | — | 1, 26 | Sequential; 26 adds rows only. |
| `package.json` | — | only a slice adding a heavy test | See §0.14 F. |

Everything else is a new file and safe alongside anything.

## D.3 Waves

| Wave | Codex | Cursor / Claude |
|---|---|---|
| A | 0, then 1 | Claude: draft 6 (lands after 1) |
| B | 2 | Claude: 5, 6 |
| C | 3 | — |
| D | 4 | Cursor: 7 (against the frozen signatures above) |
| E | review 14 prep | Cursor: 8, then 9 |
| F | — | Cursor: **10**, then 11, 12, 13 |
| G | 14, then 15 | Cursor: 16, 17 |
| H | 18 | Cursor: 19, 20 |
| I | 21 → 22 → 23 | Cursor: 24 after 23 |
| J | 25 | Cursor: 26 |
| K | 27 | Claude: visual and a11y sweep |

**Signatures are frozen in this manual**, so a Cursor slice may start as soon as its Codex slice's types are published here, and needs it **merged** only before its own PR lands.

**Mandatory independent trust review** before accepting: 2, 3, 5, 10, 14, 15, 18, 21, 22, 23, 25, 27.

---

# APPENDIX E — THE COPY DECK

Every string is byte-exact, including punctuation and curly apostrophes. Slice 6 implements this table; a test compares each entry against a literal.

## E.1 Entry and the handshake

| Key | Copy | Announce |
|---|---|---|
| `invite.offer` | `When you're both ready to set up the household together, I can walk us through it.` | none |
| `invite.explain` | `This puts both of us in setup mode until we finish or stop. Three sittings, about an hour all in — we can stop between any of them.` | none |
| `invite.propose` | `Start together` | none |
| `invite.confirm` | `Yes, let's start` | none |
| `invite.waiting` | `Waiting for {name} to say yes on their device.` | polite |
| `invite.expired` | `That invitation expired. Start it again whenever you're both ready.` | polite |

## E.2 Running a chapter

| Key | Copy | Announce |
|---|---|---|
| `chapter.turn.conductor` | `This one's yours.` | none |
| `chapter.turn.witness` | `{name} is doing this one — you don't need to type anything.` | none |
| `nav.go` | `Open {surface}` | none |
| `nav.return` | `Finish here, then open Hercules.` | polite |
| `probe.already` | `Looks like you already handled this.` | none |
| `notice.completed` | `Hercules noticed` | polite |
| `notice.congratulate` | `That's done. Nice.` | none |
| `continue.next` | `Next` | none |
| `continue.ask` | `Ready for the next one?` | none |
| `sitting.pause` | `Good place to stop. We'll pick up right here.` | none |
| `sitting.two.warning` | `This is the long one — bills, balances, the fund. Worth a coffee.` | none |

## E.3 Waiting, skipping, stopping

| Key | Copy | Announce |
|---|---|---|
| `waiting.partner` | `Waiting on {name}. Nothing's lost — it'll pick up when they're in.` | polite |
| `skip.personal` | `Skip this for now` | none |
| `skip.personal.recorded` | `Skipped. I'll leave it on the list, not in the way.` | none |
| `stop.offer` | `Stop setup for now` | none |
| `stop.explain` | `This turns Hercules back on for both of us. Nothing gets marked done — we can pick it up whenever.` | none |
| `stop.recorded` | `Setup stopped. Nothing was marked done — we can pick it up whenever.` | polite |
| `stop.resume` | `We were partway through. Want to carry on where we left off?` | none |

## E.4 Blocked, stale, honest refusals

| Key | Copy | Announce |
|---|---|---|
| `blocked.identity` | `I can't see both of you in this household yet.` | assertive |
| `blocked.membership` | `{name} isn't a member of this household yet.` | assertive |
| `blocked.stale` | `Something changed underneath this since it was done. Worth another look.` | polite |
| `blocked.conflict` | `Two versions of this disagree. Let's settle which one is right.` | assertive |
| `blocked.untied` | `These numbers don't tie to the ledger yet. I'd rather show you nothing than show you the wrong thing.` | polite |
| `blocked.privacy` | `I can't use that here.` | polite |
| `offline.queued` | `Saved here. It'll sync when you're back.` | polite |
| `retry.honest` | `That didn't go through. Nothing changed — want to try again?` | polite |

**`blocked.privacy` is deliberately blank about the reason** and must never reveal that a partner-Personal fact exists. No variant may say "your partner has…". Only three `assertive` entries exist in the whole deck, and they are all here.

## E.5 The budget chapters

| Key | Copy |
|---|---|
| `guess.reassure` | `It's okay to guess. This is the first shape, not a promise; Hearth will learn from what actually happens.` |
| `categories.solo` | `Pick what our money should cover. {name} is picking too — we'll put the lists together after.` |
| `estimates.submit` | `Submit my numbers` |
| `runrate.absent` | `I've got nothing to go on yet — no month has gone by. This is built from the two of you and the bills we know about.` |
| `proposal.basis.floor` | `at least the bills assigned here` |
| `proposal.capacity` | `That's {total} against the {capacity} you said we have.` |
| `proposal.edit.warn` | `Changing this clears both approvals. We'd each say yes again.` |
| `approve.self` | `I approve this` |
| `approve.waiting` | `Waiting on {name} to approve the same plan.` |
| `adopt.done` | `That's our first month. It's a plan, not a promise.` |

## E.6 The finale

| Key | Copy |
|---|---|
| `ready.checklist` | `Here's everything we set up.` |
| `ready.self` | `I'm ready` |
| `ready.waiting` | `Waiting on {name} to say they're ready.` |
| `unlock.done` | `That's it. Hercules is back to normal for both of us.` |
| `unlock.honest` | `From here it's the ordinary work — the odd receipt, the odd shift. I'll keep the books, but I can't fill them in for you.` |
| `personal.offer` | `Whenever you want, I can show you the rest of what I do. No rush.` |
| `personal.decline` | `Not now` |
| `personal.off` | `Stop offering these` |

## E.7 Command refusals — used verbatim in `ValidationError`

| Where | Copy |
|---|---|
| slice 3 | `Only you can record your own progress.` |
| slice 3 | `Not available in this environment.` |
| slice 15 | `Custody moves through the Fund, not the charter.` |
| slice 18 | `Only you can submit your own.` |
| slice 22 | `Only you can approve for yourself.` |
| Till 4 (structural) | `Only you can choose where you land.` |

## E.8 Flavor variants

Three to five per chapter, seeded by `householdId + chapterId`, versioned with the deck. A variant may add warmth. **A variant may never add a fact, a number, an instruction, or a claim the script did not already make.** A test asserts every variant string contains no digit and none of `should`, `need to`, `must`.

---

*Companion to `HEARTH_BUILD_MANUAL.md` (structural v1 — largely shipped, see §0.5), `HEARTH_UX_PACKET.md`, and `hearth-ux-plates.html`. Audited and verified against `origin/main` @ `200dfd1` on 2026-09-03. The companion artifacts remain an explicit repository blocker until committed. Every figure and example is synthetic.*
