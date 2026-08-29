# Hearth worksession — Codex kitchen desk + main integration

- **Status:** OPEN
- **Opened:** 2026-08-29 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex (GPT), single writer
- **Repository:** `dual-ai-budget-app`
- **Branch:** packet on `cursor/shared-ledger-story-aef7`; integration branch not created in this session
- **Baseline SHA:** `origin/main@4b2f40064b526541ef7a20d6e99fc99ca5647baa` (re-fetch before branching)
- **Head SHA:** packet recorded on `#244` @ `ed708dc358ed808fbc5a9ec89b6c95bdb9a55a60`
- **PR or issue:** packet on draft [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244); Codex opens a **new** draft PR from a fresh `origin/main` branch
- **Risk:** High (ledger-mode presentation, Shift/Evidence/boot merge, decision-ID collision)
- **Decision owner:** Jonathan
- **Environment impact:** none; docs packet only in this session

## Household outcome

One kitchen: Cursor’s desk (Shared pool, Personal Books floor, leftover spend, fat banks) plus current `main` Shift/Evidence/companion/boot work, dressed in the same paper feeling. GPT may place Shift instruments. GPT may not restyle the desk.

## Budget delta (5)

`+5` — leftover spend, accepted-books Confirm CAD, and D-172 Confirm-only posting in one tree.

## Engagement delta (3)

`+2` — envelopes and Evidence sit in the paper Shift room; they do not replace Home.

## Verified baseline

- `#244` @ `ed708dc`: D-164 + kitchen-desk D-165 on this branch. `pnpm check` **1116 passed / 2 skipped**.
- `origin/main@4b2f400`: D-165 Evidence queue through D-172 envelopes + PR #251 companion labels. Merge-base with `#244` is `871e660`.
- Jonathan 2026-08-29: send GPT a handoff so he can merge the UX with his `main` work; stay in Cursor’s boundaries; suggest placement; do not leave the product feeling.

## Scope

### In scope

- Durable Codex packet with SHAs, vibe lock, conflict table, D-165 → D-173 repair, git strategy, acceptance, paste starter.
- Living canon pointers (`AI_HANDOFF`, roadmap, README, DECISIONS why-note).

### Out of scope

- Performing the merge in this session.
- Merge to `main`, deploy, schema, secrets, Production, household mutation.
- Restyling Home, Books, Kitty Banks, or `OfficePhone`.
- Reopening leftover-spend law or Fund formulas.

## Acceptance evidence

- [x] Packet stands without chat memory: SHAs, vibe lock, overlap files, kill criteria.
- [x] D-165 collision named; D-173 is the required re-home on the integration branch.
- [ ] Codex branch from current `origin/main`, merge `#244`, `pnpm check` on the integrated SHA.
- [ ] Independent books / privacy / UX (vibe) / trust / verifier on that SHA.
- [ ] New draft PR; not merged; not shipped.

## Plan

- [x] Fetch `origin/main`; list commits and overlapping files.
- [x] Write [`briefs/CODEX_D165_UX_MAIN_INTEGRATION_HANDOFF_2026-08-29.md`](../briefs/CODEX_D165_UX_MAIN_INTEGRATION_HANDOFF_2026-08-29.md).
- [x] Pin living docs and this worksession.
- [ ] Codex executes the merge per the packet.

## Evidence log

- 2026-08-29: `git fetch origin main` → `4b2f400`. Merge-base `871e660`. Overlap: `App.tsx`, `Calendar.tsx`, `WorkShiftPage.tsx`, `Hercules.tsx`, `Office.tsx`, `styles.css`, `commands.ts`, `core/index.ts`, `main.tsx`, living docs.
- 2026-08-29: `#244` not in `main`: D-164 kitchen notes + D-165 desk through `ed708dc`. `main` not in `#244`: D-166–D-172, blank boot, Evidence queue CPU, companion labels.

## Decisions

- `#244` wins desk grammar, tokens, leftover spend, Personal floor, Kitty Banks.
- `main` wins Shift Evidence/envelopes/attendance/boot/Worker flags/companion labels, then those surfaces inherit paper grammar.
- Kitchen-desk law keeps its text; the number becomes D-173 on the integration branch.

## Remaining uncertainty

`main` may move past `4b2f400`. Codex must land on the then-current tip. Integrated visual proof does not exist until the merge exists.

## Handoff

Not merged, not deployed, not live. Next owner: **Codex** — follow the brief. Jonathan decides whether the later integrated PR may merge.
