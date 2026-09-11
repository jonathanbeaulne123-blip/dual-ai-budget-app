# Kitty Banks — a complete envelope app inside Hearth

**Revised product and interaction direction · 2026-09-11 · Jonathan owns decisions**

Kitty Banks is a place you enter, with objects you can pick up, open, personalize and put to work. Each bank represents an enduring purpose for money. The room should make the future inviting; the envelope inside must make everyday planning dependable.

This supersedes the earlier brief's quiet shelf / three-column composition and its proposed standalone replacement projection. Calendar meaning and Hercules readability remain part of the original scope. Their detailed requirements remain in [the companion brief](KITTY_BANKS_THEME_UX_REDESIGN_2026-09-11.md).

## 1. The two Plan updates and Kitty Banks have different jobs

Jonathan explicitly identified both PRs as complementary, asked to preserve Plan's useful type breakdown, and said future-facing types should include Kitty Banks as YNAB-style envelopes. The experience should have the presence and interactivity of the Hercules dressing room: a complete scene within the product.

| Layer | Verified state on 2026-09-11 | Job to preserve |
|---|---|---|
| [#433 — Enable Plan System V2 in Development](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/433) | Merged; inspected head `d00e51f7afcfba317fdc7e4d79da7da89977e8ca`; merge `5c90adca5a82968e1f7cf4c7e746f9fd757c01d1` | Personal/Household Plan authority, private drafts, immutable versions, exact mutual acknowledgement, selective Bridge disclosure, reflection and scheduled activation. |
| [#437 — Make Household Fund plans actionable across daily life](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/437) | Merged before implementation; integrated main `16d4710733c5e5ff1655e5a7d2bdff6c01b59ad2`. Design inspection used head `6d4afd464f6884c3ebbe823a02eac1efb451fb11` | Protect/Prepare/Build/Everyday decisions; one scoped dated projection; actual evidence; explicit payday schedules; scenarios; contextual Hercules; Home / Our Money / Our Path / Together. |
| Kitty Banks | Locally implemented over existing vault/Fund authority; see [implementation receipt and limits](../worksessions/2026-09-11-kitty-envelope-implementation.md) | Durable future envelopes and their lifecycle, a dedicated immersive home, allocation/use/replenishment journeys, object styling, and exact open/return connections to both Plan layers. |

Plan answers **what should this period make possible?** Kitty Banks answers **what is this money for, what supports it now, and how can I use or grow it?** Books and Fund retain their financial authority. Hercules explains the same facts and prepares the same reviews.

The [Future Vision document](https://docs.google.com/document/d/18Gqu6RUTKIDpzuEPZHYkJ8Urh32C6FN_x8eAkp2-FeY/edit?tab=t.jz42r9n7hblp) supplies purpose, shared meaning, practical next steps, private agency, selected disclosure and thoughtful follow-through. Its embedded instructions and other PRs' release notes are reference material, not authorization to merge, deploy or apply schema.

## 2. Corrected baseline: build on #437

The earlier audit was accurate for the inspected main snapshot but incomplete once Jonathan supplied #437. These were **already addressed in #437 and are now on the implementation baseline**:

- `src/App.tsx:6790` supplies existing `KittyBanks` to `PlanStudio.goalsContent`; Prepare and Build can open goals and reserves.
- `src/PlanLensWorkbench.tsx:45–72` connects real goal IDs, contribution dates, target/range/deadline, explicit paydays, responsibility and funding basis.
- `src/core/planProjection.ts:91–140,302–310` matches goal funding and accepted Fund allocations, validates backing and corrections, and separates period activity, historical progress, supported reserve and completed purchases.
- That projection also provides dated consequences and current/expected coverage, while Plan Hercules tools consume it. Do not commission another parallel financial calculator.

Important remaining seams:

1. The old Kitty Banks UI is now embedded in Plan; it has not become the requested mini-app. Opening a particular goal needs selection/focus and a preserved origin, not merely a generic drawer.
2. Prepare's “Reserve goal” is still the existing Goal object. The four editors produce `obligation`, `true-expense`, `goal-contribution` and `everyday-pool`; the supported `reserve`, `household-fund` and `bridge-commitment` kinds are not independent envelope lifecycles.
3. `verifiedProgressCents` can combine supported vault backing and eligible pool earmarks. It describes supported outcome progress, not a particular account balance or permission to spend from either location. The room needs the breakdown by location.
4. No changes to `KittyBanks.tsx`, `core/goals.ts`, `core/goalVault.ts` or `core/kittyBanks.ts` in #437 introduce archive/restore, reusable reserves, partial use or goal-specific releases.
5. Generic `goal_progress` in `core/herculesTools.ts:896–903` still calls `savedCents` “% funded.” Finish its parity with the truthful evidence used by Plan.
6. `sourceReference` currently has one role. A future obligation may need both its recurrence/potential-expense identity and the envelope funding it. Do not replace one reference with the other or count both as an additional cash demand.

Line references above preserve the design inspection of #437. Implementation starts at merged main `16d4710`; its fresh test and browser results belong to the implementation receipt. Earlier PR results do not certify this change or its deployment.

## 3. Future-facing Plan types use real envelopes

A lens is how someone is thinking today. An envelope is a persistent purpose. A bank does not change identity, move cash or duplicate itself when someone looks at it through another lens or enters a new month.

| Plan type | Kitty Bank relationship | Example and behavior |
|---|---|---|
| Protect / `obligation` | Every future-cost editor offers an explicit existing/new envelope link. The obligation remains the thing due; its funding envelope remains the money purpose. An immediately payable obligation can remain unlinked. | Annual insurance bill opens its Prepare envelope with the bill due date retained. A buffer for essential bills can be a Protect envelope. The bill and its reserve must not both consume capacity for the same dollars. |
| Prepare / `true-expense` | Default to a reusable envelope with a dated need or refill rule. | Car care, dental costs, gifts or annual renewals accumulate, fund partial costs, carry forward and refill without being retired after one purchase. |
| `reserve` | A durable cushion with an explicit target/floor and replenishment behavior. Available from Protect and Prepare. | Rainy-day money remains useful indefinitely. A draw reduces the supported balance and can propose a refill; it never creates a failed or hungry cat. |
| Build / `goal-contribution` | Outcome envelope with a purpose, optional target/date, milestones and one or more exact Plan contribution intentions. | A weekend away, course or home project. A project can have multiple linked costs with one total purpose and no duplicate cash. A non-monetary next step does not require a fake bank. |
| `household-fund` | Contribution to the shared funding pool, with a chosen envelope allocation where appropriate. | Funding the pool and assigning its money to a bank are linked effects, not two sources of wealth. |
| `bridge-commitment` | Selected personal commitment to a shared purpose, referencing its destination envelope. | Shared view sees the offered amount/date/meaning and accepted state. Private accounts, other banks, income and conversation stay private. A promise is not received money. |
| Everyday / `everyday-pool` | Today's flexible spending keeps its role. Future-oriented intentions within it can deliberately create/link an envelope. | “Save some dining money for our anniversary” proposes a reallocation to that same anniversary bank. Buying today uses the existing consequence/review flow and, when explicitly chosen, its envelope. |

Future-facing means the user is allocating for a future purpose, not merely that a transaction has a later date. Offer the connection everywhere it is relevant; never silently manufacture a new bank for each future row. Existing unlinked intentions remain valid and visible until deliberately linked. Do not infer links from similar names.

### The foundation must actually support envelope budgeting

YNAB separates the purpose of money from its bank account, and already offers dated targets plus distinct refill and recurring set-aside behaviors. Those are baseline expectations, not Hearth inventions. Sources checked 2026-09-11: [category versus account balances](https://support.ynab.com/en_us/category-balances-versus-account-balances-an-overview-ryvnKB_Ac), [targets](https://support.ynab.com/how-to-use-targets-rk5kkI9ks).

The proposed destination is **assign money to a purpose without requiring a bank transfer**. A real transfer is a separate choice when changing custody is intended. Current Hearth has two narrower mechanisms—vault-backed goal contributions and accepted Fund earmarks. Neither is to be relabelled as a finished general envelope engine.

Required contract work: accepted scope-bound allocation over eligible verified cash, explicit assigned/unassigned balances, carry-forward, partial use with exact transaction attribution, replenishment, reviewed reallocation and reversal/replay. Account movement must preserve the same allocation only when its eligibility and scope remain valid. Shared member-held funds retain custodian provenance; do not invent general custody support. Existing Fund/vault evidence must transition without counting the same cash twice or rewriting history.

Plan scenarios may use explicitly dated expected income; accepted envelope availability must use received, supported money. Overspending, unverified backing, credit purchases, refunds and corrections need explicit behavior. Do not ship a credit-card promise under a cash-only implementation. Do not subtract arbitrary category spending or pool earmarks from a vault balance.

This is High-risk domain work before the app can honestly claim a full YNAB-style envelope lifecycle. The first interactive scene can consume existing supported flows while those contracts are built; unavailable behaviors must be visibly absent or identified as preview functionality.

## 4. Chosen experience: the Future Workshop

Keep **Kitty Banks** as the product name. “The Future Workshop” describes its scene, not a new global navigation destination. Reach it within Our Path, with contextual entrances in the other surfaces.

### Arrival and room composition

The room occupies the main experience. A broad worktable, meaningful depth, authored light and a few substantial cat-shaped ceramic banks establish a place. Banks have weight, material, a coin slot, a little opening panel and an envelope inside. They remain recognizable as useful money objects rather than a cartoon pet that needs feeding.

The selected bank sits on a generous turntable. Other banks sit on stepped furniture in a stable order, with readable nameplates. The useful facts are immediately visible: name, purpose/type, supported money by location, next planned contribution and next choice. Do not make the user walk a camera around to discover their balance.

Opening a bank brings it forward and opens its envelope folio. The room stays present. Controls and long reading use solid surfaces, with generous contrast and a proper body font. Type is stated on the nameplate with an icon; sculpture, finish and colour are optional expression and never the only way to interpret money.

Use a room view for emotional orientation and a compact **All banks** index for finding and comparing many envelopes. Twelve or fifty banks must remain practical: stable ordering, keyboard selection, text labels, type filtering and clear totals. Render only the handful of models on stage. Do not force a tour through a sprawling virtual building.

### The bank is a useful app within the app

Its four destinations are **This bank, Its plan, Use money, History**. These are internal views of one selected envelope, not separate copies or ledgers.

- **This bank:** purpose, supported amounts/location, target or refill rule, linked costs, selected next action; create/edit/style/archive.
- **Its plan:** current intention versus proposed change; real payday dates, target timing, contribution schedule and #437 consequences. Shared exact-version status remains visible.
- **Use money:** assign/reallocate supported cash, review a contribution or use it for a linked cost, as each command becomes supported. A reusable reserve remains after use.
- **History:** assigned/contributed/used/refunded/released activity, linked receipts and intent revisions, with optional user-authored memories. Spending for the intended purpose is progress, not failure.

### Six moments, with a real payoff

1. **Enter from Prepare.** Tap the Annual costs bank on a Plan line. The workshop opens focused on that exact envelope. A quiet “Back to Prepare · September” control preserves the source line, scroll position, scope and draft.
2. **Bring it to the table.** Tap the bank or its accessible nameplate. A short camera movement brings it forward; its panel opens. In reduced motion the view changes immediately. Amounts remain readable throughout.
3. **Rehearse the future.** Pick a labelled payday slip or use the amount field. Try $150 versus $300. A separate translucent planning outline and dated paper path change; the bank's actual-money display does not. #437 supplies the changed timing, exposed obligation or unresolved assumption. No animation invents affordability.
4. **Choose the appropriate action.** “Save to Plan draft” preserves the proposal. Shared agreement uses #433's exact-version process. “Review contribution” opens the existing action review directly in the room; it does not force a round trip through Plan. Personal and Shared wording follow their actual authority.
5. **Complete and see the receipt.** A real accepted operation updates its supported money and shows the receipt. Only then can a brief physical motion represent the accepted result. Unknown or pending outcomes stay visibly pending and recover from the existing receipt identity. A harmless styling preview has its own save action and never borrows a money confirmation.
6. **Use it and return.** When an actual linked cost is accepted, the envelope shows the use and remaining supported amount. A reserve offers a refill proposal; an outcome can mark an authored milestone. Return to the exact originating Plan line, now reading the same evidence. Completing a goal offers memory or archive, never automatic destruction.

### Three tactile interactions worth building

**Turn and style the bank.** Rotate, zoom and open it. Try a small curated range of glazes, collar/nameplate details and scene-compatible ornaments. Preview instantly; save cosmetic changes explicitly with the appropriate scope. All choices are available without financial milestones or purchases. Avoid equipping Hercules or copying his wardrobe inventory by accident.

**Lay out the next paydays.** Contribution slips occupy real dates along a paper strip on the table. Moving a slip or editing its field proposes a different timing/amount through the existing Plan scenario. Actual backing stays visually separate. Keyboard and tap controls do everything dragging can do. The outcome includes what changed elsewhere, not merely an attractive rising bar.

**Open the envelope to use it.** The folio reveals the purpose and verified money sources beside the linked cost. Choosing “Use for this cost” prepares a review with the actual source and attribution. A proposed reassignment moves a labelled paper slip into a rehearsal tray; only accepted allocation changes alter the bank's money. Undo in the preview returns the slip; reversing accepted money requires a new reviewed command.

## 5. A separately composed phone experience

At 320–719px, show one large inspectable bank, its name and two short money-location rows before the primary action. The scene is composed vertically for the phone; decorative furniture may fall outside the shot, essential text never does.

An **All banks** button opens a readable index. Explicit Previous/Next controls supplement optional swipe navigation. The envelope opens as a reachable sheet with This bank / Its plan / Use money / History. A contribution field uses the ordinary keyboard; the selected bank remains contextual rather than occupying half the screen while typing.

Reserve measured space for mobile nav, Fund pull tab/return chrome and safe areas. Long evidence and history scroll naturally. Closing the bank, Hercules or a review restores the correct focus and draft. No gesture-only financial operation, hidden hover menu, mandatory camera control, horizontal page overflow or tiny legend.

The 2D/easy-read view preserves the same bank, actions and facts. It is a deliberately composed flat illustration plus readable folio, available on demand and if 3D fails. Do not replace a broken renderer with an error-only screen.

## 6. Six authored settings, each composed for desktop and phone

| World and scope | Desktop set and bank materials | Phone composition |
|---|---|---|
| Classic Household | Communal walnut table extending the Plan pinboard; cream plaster, paper route of paydays, glazed ceramic cats, brass nameplates; selected bank at the shared worktable. | Close shot of bank and open paper folio; pinboard provides a quiet upper frame. |
| Classic Personal | Smaller writing desk, individual notebook, one personal lamp and a quieter alcove; same familiar Hearth material language. | Bank beside a single notebook page; personal scope is always written in the header. |
| Taylor Household — Fearless | Honey/gold light, textured cream paper, handwritten planning annotations, softly reflective glaze and ribbon details; a tactile shared scrapbook worktable. | Gold-lit bank above one unfolding scrapbook leaf; no pale handwriting used for financial body text. |
| Taylor Personal — Debut | Botanical blue/green desk, pressed-paper textures and a private growing-future notebook; floral details on optional bank finishes. | Vertical botanical margins around the bank; paper panel emerges below, preserving readable contrast. |
| Newfoundland Household — Signal Hill approach | Outdoor-influenced planning station facing the coastal approach; weathered timber, sheltered folio, sea-glass glazes and a route toward the horizon. | Low viewpoint along the work surface with coastal horizon above the bank; sheet stays solid and calm. |
| Newfoundland Personal — windswept summit | Compact summit field desk/folio composition, open sky, strong stone and wood shapes, private route notes; the bank feels sheltered within the scene. | Tighter summit framing and a field notebook; wind is optional environmental motion, never motion in text. |

These are new set-design proposals within the current Plan scene identities. They do not move Calendar's Red/Midnights or St. John's/Cape Spear identities into Kitty Banks. Final era/location assets need their normal source/art review. No fabricated tickets, photographs or personal memories.

Ambient motion is optional and pausable, with reduced-motion respected initially and on change. Audio defaults off. Every room works in grayscale and with stronger text. Art is expressive; meanings stay stable.

## 7. How the experience connects across Hearth

| Entry point | Arrival and useful action | Return/result |
|---|---|---|
| Plan Protect | Select bill plus its funding bank; inspect due date and linked envelope without replacing the obligation identity. | Exact Protect line and scenario; obligation and funding counted once. |
| Plan Prepare / Build | Open the specific reserve/outcome with selected version/draft/scenario. | Same line, immutable version or retained private draft and source focus. |
| Our Path | Enter the full Kitty Banks room. | Existing Our Path position and navigation. |
| Home / Our Money / Fund | Open bank from grounded next-step or accepted allocation. | Source card/receipt; accepted money remains the shared projection's input. |
| Calendar | Open linked future cost, milestone or dated contribution with its provenance and state. | Same day/event. Planned, expected and posted remain distinguishable; no external calendar write is implied. |
| Together | Open a chosen shared commitment or practical next step. | The existing task/Sitdown context; a checkmark does not post money. |
| Hercules | Open the exact selected bank or work entirely through its contextual editable review. | Permanent composer, private conversation, current draft and receipt retained; no new generic AI command dispatcher. |

Proposed route contract carries scope, member context, goal ID, origin, optional Plan selection and originating line, requested intent and return focus/scroll. Source permissions and freshness are revalidated on open and confirm. A route is not permission to disclose private content or accept a stale request.

## 8. Removal, money truth and recovery are part of the scene

The requested subtle X remains visible, with a 44px touch target and “Manage removal of [name]” label. It opens a real review. Accepted banks archive; history and stable IDs stay. A separate supported action releases/reassigns money when requested.

Current `goalVault` reserves backing for open goals. Introducing archive without changing that calculation could free its money for another goal. Archive must preserve backing until an explicit accepted release/reallocation; restore cannot recreate already-released reserves. List linked bills, appointments, Plan versions, Fund allocations, pending reviews and chosen schedule consequences. Never implicitly stop or restart them.

Design the room for empty/one/many banks, unknown target, stale evidence, unsupported old records, over-target money, partial use, archived-with-money, unavailable goal reference, offline drafts, scope change, failed write and unknown receipt. An empty or partially funded bank remains equally attractive and respected. No decay, sad/hungry animals, streak loss, member ranking or savings-based cosmetic unlocks.

## 9. Delivery sequence and Claude allocation

**0 — Reconcile the baseline.** Keep #433. Independently integrate/verify #437 through its own release process; do not quietly merge it as part of this design request. Refresh main and #437 before implementation. If #437 changes, map its final contracts before patching shared files.

**1 — Scene prototype plus shared view contract.** Claude supplies a bounded presentational prototype: arrival, exact bank selection, open envelope, styling, payday rehearsal and return, in all six settings and two device compositions. Codex supplies fictional typed view states and read-only adapters from #437. No duplicate Plan projection. This proves the experience before domain work is painted into it.

**2 — Truthful envelope foundation.** Codex owns the location breakdown, generic Hercules parity, stable identity/purpose/lifecycle, obligation-versus-funding links, and accepted allocation semantics. Reuse and extend #437's projection and its existing adversarial tests. One evidence item cannot fund two intentions, a transfer cannot create wealth twice, and a Plan acceptance cannot become an allocation silently. Preserve legacy histories and old accepted Plan digests; unknown evidence stays unresolved.

**3 — One complete usable bank.** Integrate scoped scene navigation and existing reviewed contribution from open to accepted receipt to return. Add durable archive/restore only with preserved reservations/dependencies. Every slice includes all themes and device layouts. A UI review packet supplies exact base/head, changed files, screenshots, keyboard/focus, fallback and recovery evidence.

**4 — Make envelopes useful through use and renewal.** Implement account-independent assignment where supported, explicit allocation changes, partial use, exact transaction attribution, refunds/reversals, carry-forward and refill. Annual-cost and rainy-day journeys must work repeatedly. Finish credit/custody edge contracts before advertising support. No UI-only negative contributions or category guesses.

**5 — Cross-surface acceptance.** Plan, Calendar, Fund, Together, Home and Hercules open and return to the same bank with the same facts. Finish Calendar type/person/state tokens and Hercules paired readable surfaces/easy-read preference. Run the focused required gates for the actual changed scope; record physical and authenticated acceptance separately from local synthetic checks.

Claude is used for authored scene, choreography, responsive composition and a final visual critique. Codex owns financial contracts, scope/privacy, integration and tests. One writer per checkout; bounded read-only review is independent. Do not spend Claude calls asking it to invent financial algorithms or repeatedly re-read the repository.

## 10. What must be true before we call this successful

- A user understands actual money, location, future intent and next action within five seconds, even with motion off.
- A user can create, personalize, fund, partly use, replenish and archive a bank without losing its history or re-entering it every month.
- The same bank appears in Prepare, Protect and a future month without duplicated money or competing versions of its purpose.
- A changed payday proposal shows a grounded consequence through #437; #433 preserves who agreed to exactly what. Current cash is unchanged until an accepted money action.
- A mobile user can complete the journey with one hand, ordinary controls and reachable review/composer, then return to where they started.
- A source becomes stale or a write response is lost: the screen explains and recovers without a blind duplicate action or false completed animation.
- An old unbacked contribution, Fund release or archived reserve never becomes spendable just because a new room looks more convincing.
- The experience makes planning and using money enjoyable in task testing, and performs at least as clearly as YNAB on assignment, reallocation, partial use and refill. The advantage to prove is household decisions, useful timing, private agency and pleasure of use together.

Proposed rendering targets inherited as a benchmark from the dressing-room direction: no 3D download before opening, usable scene within four seconds on the agreed test connection, cached opening near-instant, at least 30fps on the agreed midrange phone, capped pixel ratio, lazy assets and GPU cleanup. These are targets, not measured Kitty Banks results. The existing wardrobe code provides patterns for lazy loading, explicit previews, fallbacks, reduced motion and return focus; its assets and financial semantics are not copied blindly.

## 11. Design provenance and delivery state

One additional bounded Claude pass was requested in the existing [design conversation](https://claude.ai/chat/06725790-8210-473f-9cdf-4b5ad3b62ec5), preserving its Sonnet 5 Medium setting. It received a short product/contract summary with fictional examples, not private financial records or a repository upload. Codex retains final synthesis authority.

The completed response contributed the physical workshop, inspectable vessels, opening envelope and rehearsal-object direction. Codex rejected hiding numbers until approached, a second cat for the linked obligation, contribution-dependent cosmetic wear, automatic “awaiting agreement” after saving a private draft, and forced navigation to Plan for every action. The final design keeps immediate facts, one envelope identity, universally available styling, real workflow states and direct reviews. Claude's suggested vanity setting for Debut is not the selected Plan composition.

An independent read-only review checked this brief against both PRs and the goal contracts and found no blocking correction. This is document review, not runtime validation. One built-in image-generation call produced the Classic Household scene study; it is a mood/composition reference. Production UI will use actual components and accessible controls, with shorter copy and responsive type rather than text baked into art. Other worlds and mobile views are specified above, not claimed as rendered by that single image.

This is the revised design and implementation handoff, not an app patch or certification. No runtime changes, test suite, PR, merge, deployment, schema application or household write took place in this worktree. The scene study is illustrative art direction, not a screenshot of working software. The earlier interactive shelf concept is superseded as the main composition; its synthetic money distinctions remain useful requirements.
