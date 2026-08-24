# Claude brief — new Hearth living-roadmap artifact

## How to use this brief

Attach or paste the current `docs/HEARTH_ROADMAP.md`, then paste everything from **BEGIN PROMPT** through **END PROMPT** into Claude. The roadmap file is required source material, not optional background.

---

## BEGIN PROMPT

Create a completely **new visual living-roadmap artifact for Hearth**.

This new artifact replaces the prior artifact at <https://claude.ai/code/artifact/284c9044-db77-487a-b873-ca99e4489bb6>. Do not tweak, patch, fork, reskin, or incrementally revise the prior artifact. Start from a clean artifact and a fresh information architecture. The old artifact establishes lineage only; its facts, structure, state, and code are not source material.

You may expand this brief when doing so materially improves roadmap comprehension, navigation, provenance, accessibility, or maintainability. Expansion must remain inside the product laws and factual source rules below.

### Required source intake

Before designing or coding anything:

1. Read the attached or pasted `docs/HEARTH_ROADMAP.md` in full.
2. Use that file as the sole factual payload for roadmap phases, work items, statuses, gates, proof notes, updates, rivals, AI tooling, Dual Course scores/deltas, recent-session facts, and source links.
3. Preserve its phase order, naming, distinctions, status language, uncertainty, and major-versus-small Update hierarchy.
4. Follow source precedence and caveats stated inside the roadmap. A linked PR, branch, experiment, or aspiration is not shipped unless the roadmap explicitly says it is shipped.
5. Do not silently infer missing dates, owners, status, completion, sequencing, scores, dependencies, or product behavior. Omit a missing field or label it `Not stated in roadmap` / `Unverified` when the omission itself matters.
6. Do not use memory, the previous artifact, `docs/nostalgia/`, or `docs/reference/` to fill gaps.
7. Treat “Recent session” narrowly: include only work explicitly recorded as recent in `docs/HEARTH_ROADMAP.md`, not whatever merely appears newest by date.
8. If you cannot access the complete roadmap file, stop and ask for it. Do not generate a plausible substitute.

Every substantive detail in the artifact must be traceable to the roadmap or to a source the roadmap itself names. Source links should be available close to the relevant detail and again in the source register.

### Artifact boundary

This is a **roadmap-only artifact**: an editorial, explorable representation of plans, evidence, decisions, gates, and progress. It is not a product prototype, ledger simulator, budgeting interface, command console, or money workflow.

Do not implement, simulate, or imply a working money action. There must be no functional control that posts, edits, imports, categorizes, reconciles, allocates, transfers, or confirms money. Demonstrating the roadmap’s trust boundary is allowed; reproducing the money behavior is not.

The artifact should make these Hearth laws legible wherever the roadmap invokes them, without inventing implementation:

- Dual Course weighting: Books have weight **5**; Hercules/interactables have weight **3**; Books win a conflict.
- Commands are the money trust boundary. UI, Hercules, weather, cosmetics, and widgets never post money. Confirm still posts.
- Money uses CAD integer cents, `America/Toronto`, and double-entry accounting.
- Development is not Production.
- Google-account cloud continuity is core: personal and household ledgers follow the signed-in person to any device, with no peer device online. Disposable hosted data may remain open through 2026-09-30; the late-September Auth + RLS cutover still gates meaningful October data, bank feeds, Interac, issued cards, and private hosted payloads.
- Gated, speculative, and currently impossible destinations remain visible when the roadmap includes them; their gate, risk, and proof requirements must remain attached.
- Sheets, clasp, and Apps Script are obsolete product paths when the roadmap says so.

Do not turn these laws into executable controls. They are roadmap constraints and evidence labels.

### Editorial thesis

The artifact should answer, in this order:

1. Where is Hearth now?
2. What is true versus proposed, active, gated, or unknown?
3. What sequence of phases moves Hearth forward?
4. What materially changed, and why?
5. What did Hearth learn from rivals without copying their failure modes?
6. Which AI/tooling system does which job, under which gate?
7. Does the roadmap advance both Books and Hercules while respecting the 5:3 weighting?
8. What happened in the recent session, and which sources support the page?

The experience should feel like a living field guide and operating map, not a generic SaaS analytics dashboard.

### Required information architecture

Build all of the following into one coherent artifact. You may introduce additional connective views or summaries, but do not remove or collapse away these required regions.

#### 1. Masthead and orientation

- Hearth name, `Living roadmap`, the roadmap’s as-of date/version if explicitly supplied, and a concise source-backed orientation statement.
- A visible provenance line naming `docs/HEARTH_ROADMAP.md` as the payload.
- A compact legend for status, gate, risk, evidence, and Dual Course markers actually present in the source.
- A strong **2px mast rule** anchoring the page.

#### 2. Phase rail

- A persistent, ordered rail containing every phase from the roadmap, including unbounded future destinations.
- Show the source’s real status and gate state; do not normalize away meaningful distinctions.
- Selecting a phase filters or scrolls to it without changing project state.
- Desktop may use a side or horizontal editorial rail. Mobile should use a compact, keyboard-accessible scroller or selector while retaining the full phase order.

#### 3. Current truth and gates

- A high-signal panel separating verified current truth from active work, proposed direction, dependencies, and gated futures.
- Surface the money trust boundary, Google-account device continuity, Development/Production distinction, the disposable-data window, the dated Auth + RLS cutover, and open proof requirements recorded in the roadmap.
- Make `gated` visibly different from `cancelled`, `blocked`, `active`, and `shipped` when those distinctions exist.
- Never promote an open PR or active branch to shipped status.

#### 4. Roadmap field

- Dense industrial cards for every roadmap phase and its work items.
- Each item should support the roadmap’s available metadata: status, course, gate, risk, why-now, dependencies, proof/acceptance, source, and horizon.
- Keep scanning compact, but reveal full source-backed detail through expansion, focus, or an accessible detail region.
- Make sequence, dependencies, and proof gates easier to understand than in prose alone without inventing relationships.

#### 5. Updates: big and small

- **Major Updates** receive dedicated editorial blurbs: what changed, why it matters, its evidence, and any resulting gate or decision.
- **Small Updates** remain a compact decisions/changes log. Do not inflate them into feature launches.
- Preserve the roadmap’s history-versus-present distinctions and its major/small classification.

#### 6. Rival matrix

- Present the complete rival/inspiration matrix from the roadmap.
- Preserve each source-backed `Steal`, `Reshape`, or `Refuse` call and its strongest Hearth signal.
- Keep the signal connected to Hearth’s trust boundary or Dual Course implication where the roadmap does so.
- Provide fast filters for call type and domain, plus linked sources. Do not add rivals or claims from memory.

#### 7. AI tooling and process

- Show ChatGPT/Codex, Cursor, and Claude as soft roles rather than silos.
- For each, present job, current tools, handoff expectations, and gates exactly as the roadmap defines them.
- Show shared deterministic checks and the relationship among `AGENTS.md`, Claude guidance, Cursor rules, local tooling, CI, and protected Production when present in the source.
- Do not depict any AI as holding Production secrets, bypassing Confirm, or independently approving money-critical work.

#### 8. Dual Course scores and deltas

- Make the Books/Hercules balance inspectable, using the roadmap’s actual scoring or delta data.
- State and visualize the **5:3** weighting and the rule that Books win conflicts.
- Explain what moved each course in the roadmap’s own terms.
- Do not calculate a missing score or fabricate false precision. If the roadmap provides narrative deltas rather than numeric totals, render those narrative deltas faithfully.
- Avoid framing household financial performance as a game score; these are roadmap/product-development scores only.

#### 9. Recent session

- Show only the session content explicitly designated recent by the roadmap.
- Present its goal, material actions, outcomes, decisions, verification, and open questions when supplied.
- Distinguish completed outcomes from work still open at session close.

#### 10. Source register

- Provide a compact, complete register of the sources cited by the roadmap and used in the artifact.
- Group sources by canon/repository evidence, implementation/verification, rivals, and tooling when those categories are supported.
- Links must be descriptive, keyboard reachable, and open safely. Do not list a source that supports no visible claim.

### Filtering and exploration

Provide a compact control strip that works at phone width and can filter the roadmap without mutating it. Use only dimensions present or safely derivable from explicit roadmap fields:

- free-text search;
- phase/horizon;
- status;
- gate;
- Books, Hercules, both, or enabling infrastructure;
- risk/evidence state when supplied;
- rival call type within the rival view.

Show active filters, matching counts, a clear-all action, and a clear empty state. Filtering must not erase context permanently; phase order and original status remain recoverable. Do not add edit, drag-and-drop prioritization, voting, or status-change controls.

### Craft language to preserve

Use the prior artifact’s craft language, applied to this completely new structure:

- **Public Sans** for body copy and controls;
- **Archivo** for display headings and major numerals;
- **IBM Plex Mono** for labels, statuses, dates, evidence tags, scores, and compact metadata;
- ground `#0c1013`;
- primary text `#e6ecef`;
- cards `#151a1e`;
- rules/dividers `#2b353b`;
- amber `#e0a644`;
- coral `#f07764`;
- green `#57be8d`;
- cyan `#45b6c1`;
- a centered **1040px editorial grid** at wide widths;
- the **2px mast rule**;
- dense industrial cards, disciplined spacing, tight labels, and strong information hierarchy;
- near-square corners rather than pills or soft consumer cards;
- no decorative shadows.

Use accents semantically and consistently, with a text/icon/pattern cue in addition to color. Favor rules, insets, typography, and density over gradients, glass effects, floating panels, ornamental illustration, or dashboard chrome. The result may be expressive, but it must still feel exact, serious, warm, and made for Hearth.

### Responsive and accessible behavior

- Design desktop from the 1040px grid, then verify the full experience at 768px, 390px, and 320px.
- At phone widths, preserve phase order, source access, filters, gates, and full item detail. Do not solve responsiveness by deleting evidence.
- Convert wide matrices into labeled stacked records or an explicitly scrollable, announced region; never rely on clipped columns.
- Use semantic landmarks, heading order, lists/tables where appropriate, real buttons and links, and clear accessible names.
- Provide an obvious keyboard focus indicator, logical tab order, and keyboard operation for phase navigation, filters, disclosures, and source links.
- Use at least 44px touch targets where controls need touch interaction.
- Meet WCAG AA contrast. Never encode status, gate, risk, or course by color alone.
- Respect reduced motion. Keep motion restrained and functional; the artifact must remain fully understandable with animation disabled.
- Preserve readable line lengths and allow browser zoom/reflow without overlapping or truncating content.
- Make filter announcements and expanded/collapsed state available to assistive technology.

### Factual and implementation discipline

- Use one explicit, structured data model for the roadmap content so the same item cannot acquire conflicting status across views.
- Keep source references attached to the data they support.
- Use stable IDs for phase and item navigation.
- Keep the artifact self-contained; do not depend on a live network fetch to render the supplied roadmap.
- It is acceptable to embed a faithful structured transcription of `docs/HEARTH_ROADMAP.md` in the artifact. It is not acceptable to shorten it by dropping gates, caveats, proof notes, or sources.
- If two source statements appear to conflict, preserve the conflict visibly and label it for resolution rather than choosing a winner silently.
- Do not create fake live indicators, percentages, progress, telemetry, dates, owners, or “updated moments ago” copy.
- Do not add inspirational filler, invented customer quotes, financial recommendations, or unsupported benefit claims.
- Do not make network calls, request credentials, connect accounts, or store user financial data.

### Deliverable

Deliver one polished, completely new interactive artifact—not a prose mock-up and not a revision of the old artifact. The artifact should be useful immediately with the supplied roadmap data and maintainable as that source evolves.

After the artifact, give a very short implementation note that states:

1. which source file supplied its facts;
2. what information-architecture expansions you made beyond this minimum brief;
3. any source ambiguity you preserved rather than resolving by invention;
4. the widths and accessibility interactions you verified.

### Acceptance checklist

Before submitting, verify every item:

- [ ] This is a new artifact and does not patch, fork, or reuse the prior artifact’s code or state.
- [ ] `docs/HEARTH_ROADMAP.md` was read in full and is visibly named as the factual payload.
- [ ] No roadmap status, owner, date, dependency, score, progress, or product behavior was invented.
- [ ] Open PRs, branches, experiments, and proposals are not presented as shipped.
- [ ] The artifact is roadmap-only and contains no working or simulated money action.
- [ ] Commands/Confirm, double-entry, CAD integer cents, `America/Toronto`, and Development-versus-Production are represented only as source-backed roadmap laws.
- [ ] Google-account continuity is visible as current core work; Auth + RLS is shown as a mandatory late-September cutover before meaningful October data, not as a prerequisite for disposable Development testing.
- [ ] The complete phase rail and all roadmap phases, including unbounded future destinations, are represented.
- [ ] Current truth/gates, phase work, major Updates, small Updates, rival matrix, AI tooling, Dual Course scores/deltas, recent session, and source register are all present.
- [ ] Major and small Updates retain their source classification.
- [ ] Rival calls and linked sources match the roadmap exactly.
- [ ] AI roles remain soft, shared, and gated; no AI is shown with Production or autonomous money authority.
- [ ] Dual Course uses the source’s real evidence and the 5:3 weighting without fabricated precision.
- [ ] Search and filters work, active state is evident, matching counts are correct, clear-all works, and the empty state is useful.
- [ ] The typography, exact color tokens, 1040px grid, 2px mast rule, dense industrial cards, near-square corners, and no-shadow rule are honored.
- [ ] The artifact has been checked at 1040px+, 768px, 390px, and 320px without losing evidence or navigation.
- [ ] Keyboard navigation, focus, semantic structure, touch targets, contrast, non-color cues, reduced motion, zoom/reflow, and assistive-state announcements are handled.
- [ ] Every visible substantive claim can be traced to a nearby citation or the source register.
- [ ] Missing or conflicting source information is omitted or explicitly marked, never silently repaired.
- [ ] The final implementation note identifies source intake, expansions, preserved ambiguities, and verified accessibility/responsive states.

## END PROMPT
