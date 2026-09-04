# Hearth worksession — onboarding Chapter 4 accounts

- **Status:** CLOSED; LOCAL QUICK-GATE + BUILD + UX VERIFIED
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/13-ch4-accounts`
- **Baseline SHA:** `eb479f9e8abb67d8b49eb8b8b0e520eafc5d276d`
- **Head SHA:** working tree
- **PR or issue:** none
- **Risk:** Medium-High
- **Decision owner:** Jonathan
- **Environment impact:** none; fictional local Development fixtures only

## Household outcome

Chapter 4 now maps the household's real Shared accounts, asks the custodian to
choose a Shared Fund card when several exist, and refuses completion from any
Personal account. The optional Personal setup is soft, owner-only, and records
a skip without inventing data or weakening the household gate.

## Budget delta (5)

`+2` — cited Shared account evidence, privacy refusal, current-evidence command
fence, and an explicit non-guessing Fund-card choice. No money command,
balance, Fund event, or posting authority changes.

## Engagement delta (3)

`+3` — one specific route opens the real editor, calm copy distinguishes
Shared from Personal, and an explicit later-safe Personal skip avoids trapping
the household in optional work.

## Scope

### In scope

- Shared-account/Fund-card evidence and privacy-safe failure states.
- Existing account-editor routing and an explicit Shared Fund-card choice.
- Owner-only optional Personal evidence and non-completing skip continuity.
- Chapter copy, six-minute guidance, after-Shared pause, tests, living docs,
  and live responsive/accessibility proof.

### Out of scope

- Bank feeds, issued cards, financial movement, new Shared account/Fund model,
  schema, hosted data, Auth/RLS, Production, push, merge, or deployment.

## Evidence log

- Focused final suite: **12 files / 180 tests passed** after its first run
  caught and repaired the Chapter 4 copy-deck allowlist.
- Medium-High quick gate: AI surface, TypeScript, diff hygiene, **201 fast +
  7 serial tests passed** in **under two minutes**, below the five-minute
  suggestion.
- Production build: TypeScript and Vite passed, **457 modules transformed**,
  Hercules Pro UI built, and no `_redirects` artifact remained. Existing
  PGlite browser-external/eval and chunk-size notices remain warnings only.
- Live fictional Development browser pass:
  - 320 px task: no horizontal overflow; 44 px Close and stop; 48 px specific
    **Open accounts** action; focus lands on the Hercules heading.
  - 390 px Personal choice: **Open accounts**, **Skip this for now**, and stop
    measure 48/48/44 px; skip reveals the cited Shared evidence and **Next**.
  - Account editor: the pass caught 37 px legacy chips; the final form now has
    44 px scope, kind, and Fund-card controls, 45 px inputs, a 49 px **Add
    credit card** action, and no horizontal overflow.
  - 720 / 1100 px: Personal and accepted evidence layouts reflow without
    overflow; accepted evidence lists nine Shared rows without Personal data.
  - 550 px equivalent to 1100 px at 200%: `scrollWidth === clientWidth` and
    the last evidence row plus stop control remain available.
  - Primary action contrast is **6.16:1**. Forced colors and reduced motion
    were emulated: the active rail remains visible, focused stop has a 2 px
    system outline, and no onboarding transition remains.
  - Privacy scene says only **I can't use that here.** and offers no action
    other than Close/stop; explicit Mastercard choice reports
    `aria-pressed="true"` and updates the resolver.
- Browser QA files were temporary and removed; no test route remains.

## Decisions

- D-208 supersedes the manual's offline-queued Shared-account example. An
  offline shared write cannot count as accepted onboarding evidence.
- `fundCardAccountId` is a dedicated member-owned Personal preference with its
  own convergence clock. It resolves ahead of history only while it still
  names an eligible Shared credit card. The independent home-glance choice can
  change without silently changing the Fund card.
- The optional Personal skip gets its own progress field and never participates
  in chapter satisfaction.

## Remaining uncertainty

- Browser proof is local and fictional. Hosted two-device continuity and
  cloud acknowledgement remain release evidence, not claims of this slice.
- The account editor persists through the existing application write path;
  this slice does not claim a live offline/online transport trial.

## Handoff

Local implementation and UX proof complete. Not pushed, merged, deployed, or
hosted-live verified. Next owner: Jonathan may review and separately authorize
push/PR/merge.
