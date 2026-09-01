# Cursor implementation packet — Clerk Slice 2 tappable citations

Use this as the complete contract for one Cursor writer. Start from current Hearth canon and verified code. The dated manual supplies the requested slice; where it conflicts with living canon or this packet, living canon and Jonathan's latest instruction win.

## Status and exact baseline

- **Target AI:** Cursor, as the single implementation writer.
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App`
- **Base implementation SHA:** `6f1cb43f793312953fb733d795a0d0439d539f35` (`clerk/1-reading`).
- **Required branch:** `clerk/2-citations`.
- **Suggested PR title:** `feat(clerk): tap a sentence, see its rows`.
- **Dependency:** Clerk Slice 1 must remain in the branch history. Before editing, verify that `git merge-base --is-ancestor 6f1cb43f793312953fb733d795a0d0439d539f35 HEAD` succeeds and record the actual `HEAD` SHA.
- **Current state at packet close:** Slice 1 is committed and fast-forwarded into local `main`; `origin/main` remains unchanged. Start from the local merged `clerk/2-citations` branch and record its exact initial `HEAD`. No push, PR, deployment, hosted mutation, or Production action is included.
- **Risk:** **Medium** — read-only money-adjacent UI and accessibility; no financial writer or arithmetic change.
- **Decision owner:** Jonathan.
- **Independent proof:** targeted accessibility/behavior review, then verifier. Books/trust auditors are required only if implementation expands into financial meaning, visibility projection, navigation authority, or write paths.

## Household outcome

Jonathan or Bianca can focus or tap any Clerk sentence and reveal, directly beneath it, the exact accepted transaction and Household Fund event rows that support that sentence. The explanation remains calm, compact, usable by keyboard and screen reader, and never obscures the record behind a modal.

## Dual Course deltas

- **Budget delta (5): `+1`.** Every displayed claim becomes inspectable against its exact accepted source rows; no posting, allocation, projection, or financial meaning changes.
- **Engagement delta (3): `+2`.** A short reading becomes trustworthy and pleasant to explore without turning into advice.
- If presentation and record truth conflict, the record wins: withhold the sentence or the unresolved row rather than substitute, infer, or widen scope.

## Why now

Slice 1 sealed the pure `ClerkReading` contract: at most four sentences, exact transaction/Fund-event IDs, and an existing `tiesToProjection` conservation gate. Slice 2 may now render that contract without inventing calculations or advice. Later Clerk slices own stronger source fences and the weekly/asynchronous surface; do not pull them forward.

## In scope

- New `src/ClerkReading.tsx`.
- New `src/clerk-reading.css`.
- New `test/clerk-citations.test.ts`.
- A self-contained read-only component that receives a `ClerkReading` plus the already-authorized/scoped household record needed to resolve its IDs.
- One focusable native control per sentence.
- Activation by pointer, Enter, and Space.
- Inline disclosure immediately associated with the activated sentence; never a modal or portal on mobile.
- Visible copy exactly: **“the rows this came from”**.
- Exact resolution of `transactionIds` and `fundEventIds` to real rows from the supplied scoped household. Preserve the sentence's cited-ID order and do not add uncited rows.
- A record-link action only through an existing safe navigation callback or established record-source pattern. The component must not create a new global navigation or data-access path.
- Honest withheld treatment when `tiesToProjection === false`; no sentences or source rows render in that state.
- Calm empty handling when there are no sentences.

## Out of scope

- `src/App.tsx` placement or any new Home/Books/Hercules route.
- Clerk Slice 3 proposal-language/source fences beyond keeping existing Slice 1 guarantees green.
- Clerk Slice 4 weekly scheduling, async work, persistence, notifications, model calls, or provider work.
- New calculations, advice, proposed amounts, shifts/hours/work-more language, commands, Confirm behavior, ledger mutation, Fund mutation, schema, Auth/RLS, hosted reads/writes, secrets, Production, deployment, or real household data.
- Reworking the desk, changing mobile navigation, or introducing a modal citation viewer.

## Invariant laws

1. `ClerkReading` is the claim authority. The UI does not recalculate a sentence or synthesize new claims.
2. Every visible sentence has at least one cited ID. If a caller supplies an invalid empty sentence, fail closed by omitting it.
3. Disclosure contains exactly the cited IDs that resolve inside the supplied already-scoped household. Never search a broader snapshot to fill a missing row.
4. Missing cited IDs are an integrity/error state, not permission to fabricate, silently substitute, or widen visibility.
5. `tiesToProjection === false` withholds the reading and shows one honest line; do not publish stale figures.
6. A citation control is a native `<button type="button">` or equivalently complete native control, with visible focus and programmatic expanded/controlled relationships.
7. Opening one sentence must not trap focus, move focus unexpectedly, or conceal the other sentence controls.
8. Citation UI is display-only. It may navigate to an existing authorized record view through a passed callback; it never writes money.
9. CAD values remain integer-cents facts from the supplied rows. Toronto civil dates remain unchanged.
10. Partner-Personal rows never appear on a Shared Clerk surface. Scope the household before this component; do not make the component a visibility projector.

## Acceptance criteria

- [ ] Each rendered sentence is reachable in DOM order by Tab.
- [ ] Enter and Space activate the same inline disclosure as pointer activation.
- [ ] The control exposes its expanded state and controls an associated inline region.
- [ ] Every disclosed transaction ID equals a `sentence.transactionIds` entry, in order, with no extras.
- [ ] Every disclosed Fund-event ID equals a `sentence.fundEventIds` entry, in order, with no extras.
- [ ] No sentence with zero total citations renders.
- [ ] An unresolved citation produces a calm inline integrity message and no substituted row.
- [ ] `tiesToProjection: false` renders the honest withheld state and zero claim controls.
- [ ] Empty tied reading renders a calm empty state without invented facts.
- [ ] No modal/dialog appears at 320 px or 390 px.
- [ ] At 320, 390, 720, and about 1100 px: no horizontal overflow, clipped focus ring, obscured row, or undersized primary target.
- [ ] Screen-reader names distinguish each sentence control; disclosure has a useful label and expanded relationship.
- [ ] Reduced motion does not hide state or delay evidence.
- [ ] Offline behavior is identical because the component performs zero network requests.
- [ ] Existing `test/clerk-reading.test.ts` remains green.
- [ ] No source, command, continuity, provider, or storage file changes unless Cursor stops and obtains a scope decision.

## Required tests and proof

Build `test/clerk-citations.test.ts` around the real Slice 1 canonical-month result, not hand-written citation objects alone. Cover:

1. keyboard traversal reaches every sentence in order;
2. pointer, Enter, and Space reveal the associated inline region;
3. revealed transaction and Fund-event rows match the sentence's citation IDs exactly;
4. switching/toggling disclosure retains coherent focus and `aria-expanded` state;
5. empty-citation input is dropped;
6. missing citation fails closed without widening scope;
7. untied and tied-empty states;
8. no command, mutation, model, storage, or network surface is imported.

Capture rendered evidence at 320, 390, 720, and approximately 1100 px. Include keyboard focus, one open mixed-source disclosure, the untied state, and the missing-row error. Use fictional/catalog Development fixtures only.

Run, from the exact implementation head:

```text
pnpm exec vitest run test/clerk-reading.test.ts test/clerk-citations.test.ts --maxWorkers=1
pnpm ai:verify
pnpm test
pnpm check
git diff --check <BASE_SHA>..HEAD
```

On Windows, if the known `bash`/`rm` host incompatibility prevents literal `pnpm check`, also run and report the equivalent native proof without calling the gate green:

```text
pnpm exec tsc --noEmit
pnpm exec vite build
pnpm build:hercules-pro-ui
pnpm check:windows
```

At packet creation, the focused Clerk suite passed `4/4`. The pre-merge aggregate rerun passed 1,447 ordinary and 139 serial tests but was non-green for two unrelated baseline/host issues: `test/api.test.ts` calls unavailable `bash`, and the dated Demo Suite fixture did not create the expected `upcoming` envelope. Do not hide those results, and do not repair them in this slice.

## Network, data, and secrets disclosure

- Local code, synthetic/catalog fixtures, and local rendered proof only.
- Expected network requests: zero.
- Hosted rows/schema mutations: zero.
- Household data mutations: zero.
- Real household exports or partner-Personal rows: forbidden.
- Secrets/credentials: none; do not inspect, add, log, or transmit them.
- Environment: local Development presentation only. Production and deployment remain out of scope.
- Peer device: not required.
- Offline/outbox behavior: unchanged; the component has no transport or outbox role.

## Stop conditions

Stop and return a conflict packet if any of these becomes necessary:

- editing `App.tsx`, a command, financial projector, visibility projector, continuity/storage, Worker, migration, or environment flag;
- resolving citations from a broader household than the caller supplies;
- adding a modal, provider/model call, persistence, polling, or network fetch;
- changing Slice 1 sentence arithmetic/text to make the UI easier;
- introducing a new amount, recommendation, work instruction, ranking, or member comparison;
- main no longer contains `6f1cb43f793312953fb733d795a0d0439d539f35`, or the `ClerkReading` contract has changed.

## Required return handoff

Return the complete `docs/AI_HANDOFF.md` contract:

- branch, exact base/head SHAs, PR state, and all changed files;
- household outcome, risk, Budget delta, and Engagement delta;
- acceptance-criterion evidence and exact command results;
- screenshots or artifact paths for all four breakpoints plus keyboard/focus/reduced-motion/empty/error/offline evidence;
- explicit confirmation of zero model, command, network, storage, hosted, schema, secret, Production, and household-data changes;
- any unsupported claim or remaining uncertainty;
- independent review findings;
- next decision requested from Jonathan.

Do not push, open a PR, merge, deploy, or mutate hosted/Production state unless Jonathan separately authorizes that action.
