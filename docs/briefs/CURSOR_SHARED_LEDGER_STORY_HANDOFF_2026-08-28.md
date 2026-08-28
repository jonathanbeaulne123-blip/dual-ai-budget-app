# Cursor implementation handoff — Shared Ledger story architecture

## Status and exact baseline

- **Target AI:** Cursor, as the single implementation writer.
- **Repository:** `dual-ai-budget-app`
- **Packet branch:** `codex/shared-ledger-story-handoff`
- **Packet baseline and head:** `origin/main@341756d56bb465c5ada585b01be54561696a5a89`
- **Implementation branch:** create a fresh `codex/` or `cursor/` branch from the then-current reviewed `origin/main`; record the exact base before editing.
- **Current PR:** none. This document is a design and implementation contract, not shipped UI.
- **Risk:** **High review gate**. Most work is presentation and pure projection, but Shared/Personal scope, account visibility, Hercules disclosure, exports, and Fund custody are privacy and financial-trust boundaries.
- **Decision owner:** Jonathan.
- **Implementation reviewer:** Claude for visual system, interaction, iPad, iPhone-fence, and accessibility.
- **Independent trust reviewer:** privacy/books reviewer for projection scope, Fund meaning, and route-by-route denial.

## Household outcome

Opening **Shared Ledger** should feel like Jonathan and Bianca sitting down at the same household table: what the household owns together, what changed, what needs a person, what is due, and what happens next are told as one truthful story.

Opening **Personal Ledger** should feel like a private journal and personal money room: my accounts, my income and obligations, my goals, and my private contribution sources. It must not feel like the Shared room with a different row filter.

The result remains one Hearth brand and one command kernel. The experience changes because the jobs are different:

- Shared Ledger coordinates two people around shared facts.
- Personal Ledger helps one person understand and manage private facts.

## Why now

D-161 made the Household Fund financially complete enough to rehearse, but the current UI presents the new shared operating system as a detached Home card and a long Books form. The app can state the rules, yet it does not teach the routine through its structure.

The next necessary layer is not another Fund command. It is a ledger-purpose architecture that makes correct shared behavior obvious before September practice produces real friction.

## Dual Course result

- **Budget delta (5): `+4`.** Mode-correct projections, a visible Fund flow, clear custody and confirmation authority, reconciliation freshness, action ownership, and route-wide Personal denial make the existing books easier to understand without changing their meaning.
- **Engagement delta (3): `+3`.** The Shared Ledger becomes a cooperative monthly story with paper infographics, a weekly rhythm, and a visible household arc instead of a set of disconnected forms.
- If the two conflict, the books win. Cut an animation, flourish, or chart before hiding a liability, changing a Fund formula, exposing Personal data, or implying Hearth moves money.

## Verified current experience

These are current facts from code and a read-only live Development audit on 2026-08-28. No Confirm, household mutation, provider request, secret, deployment, or Production action occurred.

### What the user can do today

- Choose the named Shared or Personal ledger from a two-button switch above every tab.
- Use Home projections whose month dashboard is built from `householdForView`.
- Configure and operate the Household Fund in Books.
- Keep transaction visibility and Fund funding as separate choices in Add/Confirm.
- Propose a contribution as either member; only the custodian can confirm receipt, settlement, reconciliation, and rollover.
- Read the permanent custody disclosure and, when configured, a Home Fund glance.
- Open Personal-only custodian reconciliation from the Fund pane.

### What the experience currently communicates

- The mode switch changes labels and some projected figures, but the shell, hierarchy, object names, navigation, and interaction sequence remain almost identical.
- Shared and Personal Home use the same Office, seals, stories, hero blotter, notebook, and drawer.
- In a live comparison, Books retained the same hero, account story, pane list, net-worth presentation, and wallet figures in both modes. Only a small amount of scope-dependent copy changed.
- Calendar and Shift receive the accepted household directly and have no ledger-mode contract in their props. Plan is only partly mode-aware. More is largely the same control room in either mode.
- The Fund glance is conditionally rendered as a generic card above the Office. It is not part of the Office story and disappears entirely before configuration.
- The Fund pane is financially explicit but form-first: setup, contribution, plan/transfer, private reconciliation, rollover, then audit rows. The user must construct the story mentally.
- The current source fence in `test/household-fund-ui.test.ts` deliberately prevents the Fund from entering the Office instrument model. That was a safe first release choice; D-164 supersedes it for desktop/iPad Shared mode only.

### Device findings

- At `>=720px`, the app correctly selects `OfficeWide`; this already satisfies the routing half of “iPad follows desktop.”
- At portrait iPad width, `office-wide.css` switches below 900px to one column. The result is a long desktop stack, not a deliberately composed iPad version of the desktop story.
- Read-only screenshots at 768×1024 and 1280×900 showed active Hercules/preset chrome crossing financial story content and controls. Layering is technically functional but visually interrupts the narrative.
- At 390×844, `OfficePhone` remains the strongest surface: compact seals, four stories, one notebook, and familiar bottom navigation. Its style and structure should remain.

## Where the product went wrong

1. **Ledger mode was added as a filter after the room was designed.** Shared and Personal determine which facts are available, but not what job the page is doing.
2. **The financial core shipped before its teaching layer.** This was the correct release order, but the second pass never reorganized Fund facts into a contribution → use → clearing → reserve → reconciliation → rollover story.
3. **Home optimizes for universal instruments.** Month net, wallet, bills, shifts, goals, Health, and claims are useful, but the same set cannot be the lead story for both private self-management and household coordination.
4. **Deep pages inherit raw page contracts.** Some routes receive `household` without `view` or a mode-safe projector. The UI therefore cannot promise a different purpose even when the top switch says it has changed ledgers.
5. **Authority is described beside forms instead of designed into the journey.** “Waiting for Bianca” and “Bianca confirms” are correct, but they arrive after the user has already navigated into an administrative pane.
6. **Fun and financial meaning are adjacent, not coupled.** The paper room and Hercules are delightful; the Fund math is truthful. The experience rarely makes a true Fund event change the room’s story in a memorable way.

## D-164 design protocol

### Layer 1 — ledger purpose before device layout

Implement a first-class ledger experience contract before changing screen composition.

#### Shared Ledger

The purpose is **coordinate the household**.

Every major Shared surface should answer, in this order:

1. What is true together now?
2. What changed since we last looked?
3. What needs one of us?
4. What is coming next?
5. Why can we trust this view?

Shared visual language may use paired paper edges, connected flow lines, a household timeline, two-person attribution, and a monthly arc. Attribution must never become a ranking, winner, score, or “who spent more” comparison.

#### Personal Ledger

The purpose is **understand and manage my private position**.

Every major Personal surface should answer:

1. What is mine now?
2. What came in or went out for me?
3. What obligations and goals are mine?
4. What have I chosen to make shared?
5. What stays private, and who can see it?

Personal visual language should be a quieter single-person folio or journal. It may share Hearth paper, type, pine, copper, and Hercules, but should not reuse the Shared action queue or partner-attribution timeline.

#### Mode contract

- Build a typed `LedgerExperienceMode` or equivalent contract at the app boundary.
- Route every mode-aware page through a scope-safe projector before rendering.
- Do not pass the raw accepted household to a mode surface merely because the component knows the member id.
- Give every page a persistent, plain-language mode heading and one-sentence purpose. Do not rely on color or the top switch alone.
- Preserve the existing command functions, Confirm sheets, command identity, PGlite acceptance, and continuity envelopes.
- Health of the underlying accepted books may remain a global integrity signal, but label it separately from mode-scoped amounts and findings. Never use global Health as permission to expose mode-hidden facts.

### Layer 2 — desktop/iPad first, iPhone protected

#### Desktop and iPad

- `>=720px` uses one Shared Story component system and one Personal Folio component system.
- iPad does not get `OfficePhone` and does not get a separate brand or feature set.
- At 720–899px, intentionally recompose the desktop story into a readable single-column sequence. Do not merely let the two desktop columns collapse in source order.
- At 900px and above, use the wider two-column story room.
- Test at 768×1024, 820×1180, 1024×1366, 1280×900, and 1440×1000.
- The bottom navigation, Hercules, notice/proposal cards, and drawers must reserve space or relocate so they never cover story facts or actions.

#### iPhone

- Keep `OfficePhone`, its seals, story mosaic, one-notebook rule, bottom navigation, paper warmth, and Hercules focus pattern.
- Do not add a new phone instrument, desktop flow diagram, extra dashboard row, edit mode, or Fund form to Home in this packet.
- Audit mode semantics, privacy, labels, overflow, focus, and overlay collisions at 320×568 and 390×844.
- Return phone suggestions separately. Implement only a necessary semantic correction, such as an accurate mode label or privacy sentence, and only if it fits existing chrome without structural change.

## New Shared Ledger vision

### 1. Household opening — “Together, right now”

Replace the generic Shared hero with a household opening spread.

Lead with the Fund state when D-161 is configured:

- operating balance;
- transfer due or credit;
- upcoming reserve;
- **Fund free-to-spend** or exact top-up needed;
- monthly target progress;
- reconciliation status and freshness.

The words **Fund free-to-spend** are mandatory. Do not relabel this as global safe-to-spend or imply it covers every household account.

Before Fund setup, render an explanatory opening chapter at `$0.00`: what the Fund is, where the money remains, who confirms opening, and the next safe action. Do not leave a blank hole or hide the story.

### 2. Money-flow infographic — “How the shared pool moves”

Create a paper flow driven only by D-161 projections and immutable events:

`Confirmed contributions → Operating pool → Fund-backed purchases → Transfer due/credit → Upcoming reserve → Fund free-to-spend/top-up → Kitty rollover`

Requirements:

- Every node has a plain label, current CAD, source/freshness affordance, and empty state.
- Connectors communicate arithmetic direction; they do not animate money moving between banks.
- Refund-before-settlement reduces due in the flow.
- Refund-after-settlement appears as a visible Fund credit branch.
- Deficit turns the last node into the exact top-up; it does not erase the recorded purchase.
- Kitty rollover shows operating plus Kitty conservation and says no bank movement occurs.

### 3. Household action queue — “Who needs to do what”

Derive a short, non-shaming queue from existing facts:

- contribution proposed and awaiting custodian confirmation;
- destination transfer due;
- reconciliation stale or untied;
- upcoming Fund-backed bill not yet posted;
- top-up required before a new planned commitment;
- safe month-end rollover available;
- books/Health issue requiring review.

Each item names the permitted actor and the reason. “Bianca confirms receipt” is good. “Jonathan failed to transfer” is forbidden. Completed items move into the timeline; they do not become streak pressure.

### 4. Weekly household story

Create an append-only narrative strip from shared-safe facts:

- contribution proposed/confirmed;
- Fund-backed purchase/refund;
- partial or grouped settlement;
- reconciliation tie or review-needed result;
- correction/reversal;
- Kitty allocation/release.

Group by Toronto civil date. Show actor and destination only when those facts are shared by contract. Personal source accounts, private account totals, Personal transaction ids, and raw bank evidence must never enter this projector or its DOM.

### 5. Monthly arc

Give the Shared Ledger a visible beginning, middle, and close:

- opening operating balance;
- target and confirmed contributions;
- purchases/refunds and clearing progress;
- upcoming reserve and buffer;
- reconciliation checkpoints;
- safe rollover preview;
- closing operating and audit links.

This is the household ceremony. It replaces the current mental task of reading a grid of totals, several forms, and raw event rows.

### 6. Trust footer

Keep this disclosure persistent in every Shared Fund story:

> The money remains in Bianca’s savings. Hearth cannot move it.

Also show:

- when the shared slice was last reconciled;
- whether it tied;
- which actions are proposals vs confirmed facts;
- a direct audit link;
- the current environment and sync freshness.

Do not reveal the backing account, bank total, Personal remainder, unexplained private arithmetic, provider row, or token.

## Personal Ledger vision

Personal should remain calmer and more familiar than the new Shared room, but it must be purposefully different.

- Lead with a private-position folio: Personal accounts, Personal/both activity, private obligations, private goals, and private reconciliation where authorized.
- Show “My contribution to the household” as a bridge into Shared. It may show the contributor identity and confirmed shared amount; it may not expose the private source account in Shared.
- Keep a visible privacy seal explaining that account metadata and private reconciliation stay in this member’s Personal envelope.
- Remove the Shared household action queue, partner timeline, household Fund flow, and shared account catalog from Personal mode unless a fact is explicitly `both` by contract.
- Do not redesign Personal into another dashboard. Its distinguishing feeling is focus, privacy, and self-management.

## Required pure functions and view models

Names may change, but the boundaries must exist and stay outside React.

1. `projectLedgerExperience(household, memberId, view, today)`
   - returns the correctly scoped household plus mode label, purpose, privacy/custody disclosures, and safe navigation capabilities;
   - refuses a missing or mismatched member;
   - never broadens scope for a page that lacks a `view` prop.

2. `buildSharedLedgerStory(projectedShared, today)`
   - derives opening, Fund flow nodes, action queue, weekly events, monthly arc, trust facts, and typed source links;
   - consumes only Shared/both facts and public Fund positions.

3. `buildPersonalLedgerStory(projectedPersonal, memberId, today)`
   - derives private position, private activity, personal goals/obligations, contribution bridge, and privacy facts;
   - contains no other member’s Personal rows or account metadata.

4. `sharedActionQueue(...)`
   - deterministic priority: invalid/untied books → exact top-up → due transfer → pending custodian confirmation → upcoming reserve → reconciliation freshness → rollover opportunity;
   - no behavioral score, shame language, or invented deadline.

5. `fundFlowDiagram(...)`
   - returns typed integer-cent nodes and relationships, not formatted strings;
   - exact conservation and refund behavior are testable without React.

6. `ledgerRouteContract(tab, view)`
   - declares the route’s mode purpose, accepted projector, commands exposed, and whether the route is inherently member-specific;
   - prevents Calendar, Shift, Books, Plan, Accounts, or More from silently ignoring the active mode.

No function in this list posts money, writes storage, calls a provider, or talks to a model.

## Screen-by-screen contract

### Home

- Shared: the household opening, Fund flow, action queue, weekly story, monthly arc, and trust footer are the primary composition.
- Personal: private folio plus existing useful personal instruments.
- The generic Office may supply atmosphere and secondary instruments, but it must not remain the identical primary shell for both modes.

### Books

- Shared opens on **Household story**, not the generic Wallet.
- Household Fund becomes a story/report destination with forms progressively disclosed behind named actions.
- Personal opens on **My books** and shows only the member-safe account/activity projection.
- Journal, trial balance, statements, reconciliation, close, and export must state which ledger scope they represent.
- Shared export must exclude every Personal account, transaction, reconciliation value, and bank binding.

### Plan

- Shared emphasizes the household target, upcoming funded commitments, buffer, coordination, and month close.
- Personal emphasizes private goals, private budget, and the member’s own contribution decision.
- Do not hide a raw shared component as the only difference; give each mode its own opening and next action.

### Calendar

- Add `view` and a mode-safe projection.
- Shared shows shared/both bills, household settlements, shared appointments, and Fund-backed recurring commitments.
- Personal shows the requesting member’s Personal/both dates and clearly labels any inherently shared date.
- Calendar reminders still never post.

### Shift

- Shift remains worker-centered. The route must say that explicitly instead of pretending to be a general Shared ledger page.
- Personal mode may show the worker’s detailed work story.
- Shared mode may show only shared/both posted shift outcomes or a clear link to the worker’s Personal Shift room; never expose partner-personal work rows.
- Keep existing `postWorkShift` and Confirm behavior.

### Accounts

- Shared shows only `scope: shared` accounts and household-safe account facts.
- Personal shows only the current member’s `scope: personal` accounts plus explicitly `both` facts allowed by contract.
- Institution, last four, backing savings, bank total, and private reconciliation never appear in Shared markup, exports, Hercules context, or source cards.

### More

- Shared contains household membership, shared sync/restore, shared Health, and household controls.
- Personal contains account/session/privacy, member consent, private data controls, and member-scoped history.
- Dangerous controls retain the existing Confirm and owner/member gates.

### Add and Confirm

- Preserve the current separation of transaction visibility and **Use Household Fund**.
- Make the active ledger purpose visible before Confirm.
- Changing Fund funding must not silently change visibility; changing visibility must not silently remove Fund allocation.
- No new quick-post shortcut is authorized.

## Visual and interaction direction

This must feel completely different through hierarchy and behavior, not through a second brand.

- Keep Hearth’s cream paper, pine, copper, Fraunces, Figtree, wax, rain, and Maine Coon.
- Shared uses connected sheets, flow lines, a paired household margin, a stitched event ribbon, and a month-closing folio.
- Personal uses a single bound folio, private seal, quieter density, and fewer cross-sheet connections.
- Use sentence-case finance labels. Metaphors remain Hercules speech only and must gloss the financial meaning.
- Infographics must be understandable as text and structure without color or animation.
- Hercules may point to a true action or explain a source. He never confirms, ranks partners, compares spending morality, or carries private facts into Shared.

## Scope and non-scope

### In scope

- Mode-safe projectors and route contracts.
- New desktop/iPad Shared Story and Personal Folio compositions.
- Shared Fund flow, action queue, weekly story, monthly arc, and trust footer.
- Progressive disclosure of existing Fund commands.
- Screen-specific mode openings and mode-safe data wiring.
- Focused phone audit and only necessary semantic corrections.
- Unit/source/component/browser tests and canon updates required by implementation.

### Out of scope

- Any new financial formula or Fund event kind.
- Changing D-161 custodian authority, refund semantics, settlement limits, reserve formula, deficit rule, or reversal lineage.
- New Supabase table, migration, RLS policy, provider connection, bank row, secret, remote mutation, deployment, or Production action.
- Automatic posting, new model write authority, money movement, Interac, or card rails.
- iPhone structural redesign, new phone instrument, new navigation, or desktop customization removal.
- Replacing Hearth’s theme or Hercules identity.

## Delivery sequence

### Slice 0 — prove the mode boundary

- Add failing route/projection tests first.
- Replace raw-household presentation paths with `projectLedgerExperience` or equivalent.
- Cover Home, Books, Plan, Calendar, Shift, Accounts, More, exports, and Hercules sources.
- Return a small proof diff before visual work.

### Slice 1 — Shared Story core

- Implement pure Shared story, Fund flow, action queue, weekly story, monthly arc, and source-link view models.
- Prove the canonical Fund scenario and all refund/deficit/conservation cases through these new selectors.
- No React command wiring changes.

### Slice 2 — desktop/iPad Shared Home

- Build the new Shared opening and responsive story room.
- Integrate Fund empty/configured/deficit/tied/untied states.
- Resolve Hercules/notice/nav collision at iPad and desktop widths.
- Keep existing Add access and Office tools reachable.

### Slice 3 — Shared deep pages

- Adapt Books, Plan, Calendar, Accounts, Shift contract, and More.
- Convert Fund administration into progressive actions behind the story.
- Keep the append-only audit report available and direct.

### Slice 4 — Personal Folio differentiation

- Give Personal a distinct private opening and route language.
- Preserve current useful controls while removing Shared-only story and raw shared facts.
- Prove privacy and scope denial before styling polish.

### Slice 5 — phone audit only

- Run the complete semantic, privacy, overlay, keyboard, and touch audit at 320/390.
- Do not port the desktop/iPad compositions.
- Return recommendations and any required semantic correction as a separate commit or follow-up approval.

## Acceptance contract

### Ledger-purpose proof

- Switching Shared ↔ Personal changes page purpose, hierarchy, content, and next actions on Home and Books; it is not only a figure/filter change.
- Every tab visibly names the active ledger purpose or honestly declares an inherently member-specific room.
- Shared shows the five-question story: now, change, attention, next, trust.
- Personal shows the five-question folio: mine, movement, obligations/goals, shared choices, privacy.

### Financial proof

- D-161 canonical example remains: $1,000 confirmed contribution, $100 Fund purchase, $60 settlement, $20 refund → $940 operating, $20 due, $920 Fund free-to-spend before reserve.
- Fund flow nodes exactly reconcile to the existing projector for partial funding, split destinations, grouped settlement, refunds before/after settlement, direct debits, deficit recovery, rollover, and reversals.
- Planned commitments block on exact top-up; truthful historical recording does not.
- Operating plus Kitty remains conserved during rollover.
- The UI never presents the Fund as a chart account, held cash, bank balance, or money Hearth can move.

### Authority and privacy proof

- Jonathan can propose a contribution and mark Fund use but cannot confirm receipt, settlement, reconciliation, reversal, or rollover.
- Bianca’s backing account, institution, last four, bank total, Personal remainder, unexplained difference, Personal transaction id, and raw bank row are absent from Jonathan’s DOM, Shared route models, Shared exports, source cards, Hercules context, and snapshots intended for Shared.
- Personal mode contains no partner Personal row or aggregate derived from one.
- Shared mode contains no member Personal row or aggregate derived from one.
- Controls are command-enforced, not merely hidden.

### Responsive proof

- Desktop/iPad Shared Story uses the same component system at 768, 820, 1024, 1280, and 1440 widths.
- 720–899 is an intentional reading sequence, not a source-order collapse.
- No horizontal overflow, covered action, clipped figure, or overlapping Hercules/notice/nav.
- iPhone 320/390 retains the existing `OfficePhone` structure, number of story objects, navigation, and overall visual vibe.

### Accessibility and state proof

- One logical H1 and section hierarchy per route; flow nodes have equivalent text; action owner/reason is announced.
- Mode state is not color-only; switch exposes selected state correctly.
- Focus order follows story order; all actions are keyboard reachable; touch targets remain at least 44×44.
- Reduced motion preserves every relationship and amount.
- Loading, empty Fund, no activity, offline/stale, untied, deficit, long label, large CAD, and error states are designed and tested.
- No automatic announcement repeats every Realtime refresh.

## Files to inspect before implementation

- `src/App.tsx` — mode resolution, route props, Home composition, Add/Confirm.
- `src/Office.tsx`, `src/OfficeWide.tsx`, `src/OfficePhone.tsx` — device shells and Office contracts.
- `src/Books.tsx`, `src/HouseholdFundPanel.tsx`, `src/Accounts.tsx`, `src/Calendar.tsx`, `src/WorkShiftPage.tsx` — current deep surfaces.
- `src/core/visibility.ts`, `src/core/sync.ts`, `src/core/householdFund.ts`, `src/core/accounts.ts`, `src/core/insights.ts` — scope and source projectors.
- `src/theme/PaperTheme.tsx`, `src/styles.css`, `src/office-wide.css`, `src/office-phone.css` — shared grammar and device fences.
- `test/visibility.test.ts`, `test/household-fund-ui.test.ts`, `test/office-wide.test.ts`, `test/office-phone.test.ts`, `test/books.test.ts`, `test/accounts.test.ts` — current proofs and fences.

## Required verification

Run focused tests continuously, then the complete gate from the exact implementation SHA:

```sh
pnpm exec vitest run test/visibility.test.ts test/household-fund.test.ts test/household-fund-ui.test.ts test/accounts.test.ts test/books.test.ts test/office-wide.test.ts test/office-phone.test.ts test/desktop-office.test.ts test/ai-disclosure.test.ts test/snapshot-payload.test.ts test/sync-integrity.test.ts
pnpm test
pnpm ai:verify
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

Browser evidence must use synthetic or disposable Development fixtures and record:

- Shared and Personal Home at 390, 768, 820, 1024, 1280, and 1440;
- Shared and Personal Books, Plan, Calendar, Accounts, Shift, and More;
- empty Fund, active Fund, deficit, pending contribution, transfer due, tied/untied reconciliation, refund credit, and rollover preview;
- keyboard traversal, reduced motion, large text, offline/stale, and error states;
- zero console errors and zero horizontal overflow.

## Network, data, and release boundaries

- **Environment impact:** local/synthetic Development only for implementation and proof.
- **Hosted mutations:** none authorized.
- **Schema:** none authorized.
- **Provider/secret work:** none authorized.
- **Production:** refused in this packet.
- **Peer device:** not required for implementation; use the existing two-device harness for projection/scope continuity.
- **Data sent to AI:** code and synthetic facts only. Never send household exports, Personal account details, raw bank evidence, credentials, or private chat history.
- **Push/PR/merge/deploy:** implementation may create a local branch. Ask Jonathan before push. Merge, deployment, remote migration, secrets, provider calls, and Production require separate explicit approval.

## Expected Cursor return

Return one evidence-backed handoff containing:

- exact base/head SHA and PR state;
- changed household behavior by route and mode;
- every pure projector and its denial contract;
- screenshots or visual proof at all named widths;
- focused and full command results;
- privacy/authority matrix result;
- Claude UX/a11y disposition;
- independent privacy/books disposition;
- remaining P0/P1/P2 issues;
- whether any phone change occurred and why;
- explicit confirmation that no schema, secret, provider, hosted row, Production data, merge, or deploy was touched.

Do not call the design shipped because the branch renders. Completion requires mode-scope proof, visual review, full tests, and Jonathan’s approval before push or release.
