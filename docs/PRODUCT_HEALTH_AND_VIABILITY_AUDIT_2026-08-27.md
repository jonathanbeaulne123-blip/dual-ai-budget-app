# Hearth product health and investor viability audit — 2026-08-27

## Executive verdict

Hearth is a technically ambitious, differentiated household-finance prototype with a stronger accounting and auditability spine than most early consumer prototypes. It is not yet an investor-ready business.

The accounting kernel, confirmation boundary, reversal model, Toronto civil-date handling, member scoping, and sync-conflict design show serious thought. The production build succeeds, the production dependency audit reports no known vulnerabilities, and 873 tests pass locally. Those are meaningful engineering assets.

They are not substitutes for product-market evidence. Hearth currently has no repository-visible measurement of external households, activation, retained households, paid conversion, churn, revenue, customer-acquisition cost, support cost, or lifetime value. The founding-household use case is detailed, but the first complete opening-truth and monthly-loop experience remains unfinished. The application also carries a large mobile/web payload, a sprawling interaction surface, explicit accessibility debt, and several maintainability hotspots.

The unbiased status is therefore:

- **Code health:** `6.5 / 10` — strong correctness intent and unusually broad automated proof, offset by monoliths, full-snapshot architecture, missing coverage/performance budgets, and extreme change velocity.
- **Budgeting logic:** `8.0 / 10` — the strongest part of the product, though opening truth, production two-device proof, aggregate-range safety, and an external accounting review remain open.
- **UX and overall experience:** `5.5 / 10` with **medium-low confidence** — code and tests show good interaction principles, but the live tactile experience could not be re-run in this session and the first-use path is incomplete.
- **Design-partner viability:** `6.5 / 10` after the First Numbers, accessibility, performance, and operational gates below.
- **Institutional investor readiness:** `2.0 / 10` — there is no traction or unit-economics evidence yet. This is pre-validation, not a failed business.

These scores are audit judgments, not industry benchmarks. The external benchmarks below are used for the measurable gates, not to manufacture achieved performance.

## Scope and evidence boundary

Audited baseline: `main@93df0ec1d31c245cdc213d204ab8185ad3bb38a5`. The linked GitHub repository returned the same latest commit and no open issues or pull requests at the time of review.

Evidence used:

- 58,921 lines across 237 `src` files;
- 20,152 lines across 122 test files;
- 3,343 lines across six Worker files;
- strict TypeScript settings including `strict`, `noUncheckedIndexedAccess`, unused-code checks, and isolated modules;
- full local verification, focused source inspection, build output, dependency audit, roadmap/decision canon, and current GitHub state;
- current primary or first-party benchmark sources linked in the investor section.

Constraint: signed-in browser control could not initialize in this session. No claim below should be read as a current hands-on confirmation of scrolling, tap feel, visual hierarchy, screen-reader output, real-device performance, or cross-browser rendering. UX observations are explicitly code/test/document-backed until a fresh phone and desktop walkthrough is recorded.

## 1. Code health and logic

### What is genuinely strong

#### Money is represented and validated deliberately

- CAD is canonical.
- User money inputs are parsed to integer cents, reject more than two decimals, reject non-finite values, and guard the per-value safe-integer range.
- Hours and percentage inputs use bounded parsers rather than unstructured coercion at the posting boundary.
- Toronto civil dates are derived with an explicit IANA timezone. Day arithmetic uses UTC civil dates, avoiding the common “local midnight became yesterday” defect.

#### The ledger has real accounting invariants

- Source transactions compile to a double-entry journal.
- Every entry is checked for equal debits and credits and integer cents before ingest.
- The trial balance and accounting equation are checked in memory and again after SQL ingest.
- PGlite ingest is transactional; an unbalanced or mismatched journal throws before acceptance.
- Accepted revisions carry a financial snapshot hash, entry count, debit total, credit total, and in-balance receipt.
- Development and Production books are rejected when environment identity disagrees.

This is substantially better than a UI that merely sums categorized transactions. It gives Hearth a credible path to explainability, deterministic rebuilds, and accountant-facing evidence.

#### Corrections preserve history

- Posted money is reversed and reposted rather than silently overwritten.
- Closed periods are enforced.
- Duplicate detection requires explicit confirmation and stores the reviewed result.
- Recurrences, OCR/imports, bank evidence, Hercules, games, and projections are designed as proposals or read models; Confirm remains the writer.

That interaction law is a product strength and a trust differentiator. It should remain non-negotiable.

#### Sync and privacy are designed to fail closed

- Environment, Google identity, household, member, and ledger scope are checked across discovery and transport boundaries.
- Compare-and-swap revisions, durable outbox work, Realtime events, conflict handling, and two-client harnesses exist.
- Personal and shared views are separated, with canary tests for partner-personal disclosure.
- Hercules calculations are deterministic/typed and grounded to source surfaces; model output does not directly post money.
- The Development-only Flinks path encrypts private connection state with scoped additional authenticated data and refuses Production activation.

### Engineering risks that materially matter

#### The UI and command layer are too concentrated

The largest hotspots are:

- `src/App.tsx`: 4,690 lines;
- `src/core/commands.ts`: 3,514 lines;
- `src/core/herculesTools.ts`: 1,602 lines;
- `src/ledger/supabase.ts`: 1,377 lines;
- `src/Hercules.tsx`: 1,362 lines;
- `src/Office.tsx`: 971 lines.

Large files are not automatically bad, but these files own many independent reasons to change. They raise merge-conflict frequency, make local reasoning harder, and increase the probability that a UX change touches financial or sync orchestration. `App.tsx` in particular is now an application coordinator, onboarding/router host, persistence boundary, command UI, sync status host, and multiple surface controller.

Recommended response: extract bounded controllers and feature coordinators without changing financial semantics. Start with application boot/identity, command acceptance, continuity status, and feature routing. Keep the ledger compiler and command functions explicit and testable; do not hide them behind a generic framework.

#### Accepted commands still drive a full projection rebuild

The PGlite path truncates the active projection and writes the household, members, categories, chart, every journal entry and line, source transaction, shift, goal, budget, recurrence, activity row, snapshot, and audit receipt again. This is simple and safe for a small household, but the work grows with the entire ledger rather than the new command.

This creates three risks:

- latency grows as history grows;
- IndexedDB and PGlite storage pressure grows on mobile browsers;
- a future “fast fix” may be tempted to bypass the verified projection boundary.

The correct next step is measurement before redesign: record acceptance latency and storage size at 1,000, 10,000, and 50,000 transactions on representative phones. Then introduce incremental projection/compaction only behind invariant-equivalence fixtures and export/rebuild proof.

#### The state architecture has a costly dual-truth shape

The JSON household is the durable product state while PGlite is the validated accounting projection and hosted continuity carries snapshots/events. The code is explicit about these failure domains, which is good, but atomicity across UI JSON, browser storage, PGlite, outbox, and cloud is still an open roadmap item.

Until that gate closes, “saved” must continue to mean locally accepted by the accounting boundary, while transport status remains separate. Never compress this into a single optimistic success boolean.

#### Aggregate numeric safety is not proven

Individual inputs are bounded to JavaScript's maximum safe-integer cents. Aggregate reducers and journal totals do not consistently assert that the resulting sum remains a safe integer. A real household will not approach quadrillions of dollars, so this is not an immediate user risk; it is still a correctness-contract gap that fuzz/property tests can close cheaply.

#### Test breadth is high; test governance is incomplete

Local results:

- AI surface verification: 41 required files present;
- tests: 873 passed, 2 skipped, 2 failed;
- production build: passed separately;
- production dependency audit: no known vulnerabilities.

Both failing tests are portability defects in the test harness:

1. `test/api.test.ts` assumes a `bash` executable is on `PATH`.
2. `test/companion-office-update.test.ts` uses a regex containing literal LF newlines against a CRLF checkout even though the target `emitOfficeIntent(...); return false;` implementation is present.

CI runs on Ubuntu, so the platform assumptions can remain hidden while a Windows contributor sees a red gate. The product logic is not demonstrated broken, but `pnpm check` is not currently cross-platform dependable.

There is also no enforced statement/branch coverage threshold, no linter/style rule, no browser E2E suite in the package manifest, no visual-regression baseline, and no field-performance gate. Passing-test count alone cannot show which financial, privacy, and UX states remain unexercised.

#### Change velocity is a risk signal as well as a strength

From 2026-08-21 through the audit baseline, Git records:

- 408 commits;
- 122 merge commits;
- 727 files changed;
- 133,712 insertions and 10,802 deletions.

This demonstrates exceptional shipping capacity. It also makes review depth, decision drift, regression isolation, and effective bus factor serious concerns. Code volume and merge count should not appear in an investor story as traction. The remedy is smaller release trains, protected required checks, explicit owner review for money/privacy surfaces, and change-failure metrics—not slower work for its own sake.

### Code-health priorities

1. Close the existing atomic acceptance and branch-protection gates.
2. Make `pnpm check` portable across Windows and Ubuntu.
3. Add money/property fuzzing, coverage reporting, and explicit critical-module thresholds.
4. Add a real-browser E2E path for first household, first numbers, capture, correction, sit-down, offline/reconnect, and second device.
5. Establish performance and storage fixtures at realistic ledger sizes.
6. Decompose orchestration hotspots in reversible slices.
7. Add production observability that never records transaction descriptions, amounts, account names, or personal financial content.

## 2. UX and overall experience

### Experience strengths

#### The product has a point of view

Hearth is not another generic finance dashboard. A kitchen/office metaphor, cooperative monthly sit-down, household/personal scopes, shift-worker income handling, and Hercules as a grounded teacher create a recognizable product. The warm aesthetic can reduce the shame and coldness common in money software.

The metaphor is strongest when it makes the next safe action obvious. It is weakest when furniture, games, companion behaviors, and specialized offices compete with the monthly money loop.

#### Phone and desktop are treated as different jobs

- Phone is designed for glance, capture, and one-tap movement with a bounded object count.
- Wide Office supports review, arrangement, and denser evidence.
- Commands, colors, and semantics are meant to remain shared across both.

This is the right product architecture. It is better than shrinking a desktop ledger onto a phone.

#### Trust states are visible

The code and tests distinguish accepted, pending, failed, stale, conflict, duplicate, and reversal states. Amount entry uses a CAD pad and financial actions end in a complete Confirm summary. Dialog focus trapping and several accessible names are tested. Sync freshness and source/actor facts are treated as UX, not hidden logs.

#### The correction story is humane

People can make a mistake without losing the audit trail. “Reverse and correct” is more honest than destructive edit history, but it must be explained in plain language so it does not feel like punishment or accounting bureaucracy.

### Experience risks

#### Time to first value is not closed

Opening truth and the integrated onboarding journey remain unfinished. A new household can encounter household identity, shared and personal books, accounts, transactions, categories, calendar, bills, goals, shifts, appointments, claims, statements, audit, reports, sync, Drive, bank intake, Hercules, games, and office customization before completing one calm monthly loop.

The first experience should not teach the product catalog. It should get one household to:

1. create/open the correct household;
2. establish honest opening balances or explicitly mark them unknown;
3. capture/import and confirm real activity;
4. correct one mistake safely;
5. complete a short shared sit-down and understand what changed.

Everything else can remain visible in the roadmap and product, but it should not compete with this activation path.

#### The visual personality can undermine financial seriousness

Hercules and the living office are potential retention advantages. They are not yet a moat, and they can reduce trust if a user meets animation or play before understanding balances, provenance, and recovery. The right sequence is evidence first, warmth second, delight third.

Games must remain clearly separate from money outcomes. No streak, pet state, or celebration should imply that spending more, having more, or maintaining a perfect daily routine is success.

#### Accessibility has two explicit blockers

- `index.html` sets `maximum-scale=1, user-scalable=no`. W3C's current WCAG 2.2 guidance says authors should not prevent user-agent scaling and that text must be enlargable to 200% without loss of content or function.
- D-129 intentionally forces full onboarding choreography even when `prefers-reduced-motion` is set and provides no reduced-motion control.

The rest of Hearth contains thoughtful reduced-motion and target-size work, but these two decisions prevent a broad accessibility claim. They should be treated as release blockers for general availability, not documentation footnotes.

#### The payload is heavy for the target context

The production output contains 16 files totaling 21.41 MiB uncompressed. The initial main JavaScript chunk is about 1.60 MB raw / 472 KB gzip, plus 97 KB CSS. Activating the embedded books path adds a roughly 531 KB lazy JavaScript chunk plus about 10.09 MB of PGlite WebAssembly and 6.29 MB of database data assets. The build warns about chunks over 500 KB and browser externalization around a `node:zlib` fallback.

Not every asset is fetched on first paint, so total build size is not a load-time measurement. It is nevertheless a material mobile/offline risk. There is no current field LCP, INP, CLS, data-transfer, memory, or low-end-device evidence.

Google defines a “good” Core Web Vitals experience at the 75th percentile as LCP at or below 2.5 seconds, INP at or below 200 ms, and CLS at or below 0.1. Those should become release gates measured on real devices, not inferred from local build time.

#### External fonts weaken offline and privacy consistency

The shell requests three Google Fonts families. This can produce a flash/layout shift, inconsistent offline visuals, and an additional third-party request before the household sees its local books. Self-host a deliberately small subset or provide system fallbacks that preserve legibility and brand tone.

### Required experiential proof

Before calling the app Bianca-ready or design-partner-ready, record fresh evidence at 320, 390, 720, 1100, and a representative wide desktop viewport:

- first household and returning household;
- VoiceOver/NVDA or equivalent names and order;
- keyboard-only flow;
- browser zoom and text size at 200%;
- reduced-motion onboarding alternative;
- offline start, pending command, reconnect, conflict, and second-device convergence;
- 1,000+ and 10,000+ transaction responsiveness;
- long names, large CAD amounts, errors, empty states, and stale data;
- real-device LCP/INP/CLS, memory, and transferred bytes.

## 3. Product and investor viability

### What is real today

- A deep founding-household problem definition exists.
- A credible technical asset and differentiated interaction thesis exist.
- A competitive paid-price range exists in market: YNAB lists US$109/year, Monarch US$99.99/year, Copilot US$95/year, and Canadian Wealthica spans CAD$75–$150/year for relevant connected/premium tiers.
- The Canadian market is non-trivial: Statistics Canada's 2021 Census counted about 14.98 million private households, including about 10.58 million multi-person households.

What is not evidenced:

- external activated households;
- retained households or completed monthly loops;
- willingness to pay;
- subscription conversion, renewal, refund, or churn;
- revenue, MRR, ARR, CAC, payback, LTV, gross margin, burn, or support cost;
- a repeatable acquisition channel;
- Production bank connectivity or general-availability security operations.

The investor conclusion must therefore be **pre-traction / pre-investable on conventional metrics**. It would be misleading to assign a valuation, market multiple, or probability of venture success from the codebase.

### Market and benchmark reality

RevenueCat's 2026 report covers subscription-app funnel, revenue, and retention data. Relevant context:

- North American median Day-35 download-to-paid conversion is 2.8%; the upper quartile is above 6.0%.
- Across categories, only 17.3% of newly launched apps reach $1,000 in monthly revenue within two years and 4.6% reach $10,000.
- Median monthly revenue one year after launch is about $72; the upper quartile is above $429 and top 10% above $2,574.
- Year-one annual-plan retention is generally 20–40%, with 32–59% the category upper-quartile range; the overall yearly median in the compared cohort fell from 31% to 28%.
- North American median realized year-one value per payer is about US$26, with the upper quartile above US$46.

These benchmarks are not a forecast for Hearth. They show why an attractive app and competitive price do not establish a business. Hearth should aim to exceed median retention and conversion before interpreting paid acquisition as scalable.

Bessemer's SaaS metrics are not a direct consumer-app comparator, but they are useful future efficiency guardrails: 12–18 month CAC payback is described as “good,” 6–12 months as “better,” and logo retention above 85% as “good” for later-stage SaaS. Hearth has none of these measurements today, so the immediate task is not optimization; it is instrumentation and small-cohort proof.

### Bottom-up market scenarios, not forecasts

Using the 2021 Canadian household count and a hypothetical CAD$120 annual plan:

- `0.1%` of Canadian private households ≈ 14,979 paying households ≈ **CAD$1.80M ARR**;
- `1.0%` ≈ 149,789 paying households ≈ **CAD$17.97M ARR**;
- `1.0%` of multi-person households ≈ 105,820 paying households ≈ **CAD$12.70M ARR**.

This proves a meaningful Canada-first bootstrap opportunity is arithmetically possible. It does not prove reachability. A Canada-only consumer subscription story may be too small or acquisition-heavy for traditional venture returns unless Hearth expands geography, increases durable household value/ARPU, or develops a distribution advantage. That expansion should follow Canadian household retention, not precede it.

### Competitive position

Potential wedge:

- Canadian couples/households with shared and private money;
- variable shift/tip income and effective-dated work rules;
- accountant-grade audit trail without a cold small-business interface;
- local-first validated books with explicit cloud continuity;
- grounded AI explanations tied to real source surfaces.

Real competitive disadvantages:

- incumbents already have mature bank aggregation, native apps, trust brands, support systems, pricing, and broad account coverage;
- the product has more conceptual breadth than validated usage;
- web/PGlite delivery is heavier and operationally less familiar than a mature native consumer app;
- financial-data trust, incident response, deletion/export, accessibility, and provider support become permanent costs;
- Hercules and visual polish are copyable; the durable moat must be trusted household workflow, longitudinal structured data, correction/reconciliation quality, and high switching value.

### Recommended capital posture

Do not raise institutional capital on a feature-completeness narrative. If external money is considered now, frame it as founder/design-partner validation capital with explicit learning milestones.

The next financing-quality evidence should be:

1. 20 consented, isolated design-partner households outside the founding household.
2. At least 70% complete first value within seven days.
3. At least 60% complete a second monthly sit-down; report the exact cohort denominator.
4. At least 10 households pay without a founder relationship or custom service.
5. Day-35 paid conversion meets or exceeds the North American median (`2.8%`) and trends toward the upper quartile (`6%+`) before scaled acquisition.
6. Annual-plan retention is eventually at or above the current 28% overall median, with an internal ambition of 40%+ for the narrow high-intent household wedge.
7. Zero unexplained money mutation, cross-member disclosure, lost accepted command, or Production security incident.
8. P75 Core Web Vitals meet Google's good thresholds on target devices.
9. Support time, provider cost, AI cost, and infrastructure cost produce a measured gross margin; no CAC scaling until gross-margin-adjusted payback is credibly under 12 months.
10. $1,000 MRR is reached through repeatable customer behavior, then $10,000 MRR with retention intact. RevenueCat's data shows these are meaningful filters, not ceremonial milestones.

### Stop / continue rules

Continue investing in the wedge if independent households repeatedly complete the opening-truth → capture → correction → sit-down loop, invite a partner, retain, and pay without high-touch rescue.

Narrow or reposition if households value only one component, such as shift income, reconciliation, or accountant-ready close packs. A smaller sharp product is more viable than a broad unused family office.

Pause general-market expansion if any of the following holds after two design-partner cycles:

- fewer than 40% of activated households return for the second monthly sit-down;
- more than 20% require founder intervention to reconcile or recover;
- financial/sync incidents cannot be explained from the audit trail;
- target-device performance misses gates after focused optimization;
- willingness to pay is below the measured cost to support and serve the household;
- the primary reason to return is companion novelty rather than financial clarity.

## 4. Additive roadmap implications

The canonical roadmap now needs an explicit product-health and investor-evidence lane. It must not remove existing product phases. It should change scheduling pressure:

- protect Phase 0 truth and security work;
- finish Phase 1 first value;
- insert privacy-safe instrumentation, performance, accessibility, and design-partner gates;
- keep later family-office, play, bank, and platform ideas visible but do not schedule them ahead of evidence;
- require every new feature packet to state which activation, retention, correctness, or unit-economics hypothesis it serves.

## Sources

- [RevenueCat — State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps)
- [Google web.dev — Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds)
- [W3C — Understanding WCAG 2.2 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)
- [Bessemer Venture Partners — State of the Cloud 2023](https://www.bvp.com/atlas/state-of-the-cloud-2023)
- [Statistics Canada — 2021 Census Profile, Canada](https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/details/page.cfm?DGUIDlist=2021A000011124&GENDERlist=1&HEADERlist=0&Lang=E&STATISTIClist=1%2C4&SearchText=Canada)
- [YNAB pricing](https://www.ynab.com/pricing)
- [Monarch Money pricing](https://partners.monarchmoney.com/pricing)
- [Copilot Money pricing](https://www.copilot.money/)
- [Wealthica Canada pricing](https://wealthica.com/ca-en/pricing/)
