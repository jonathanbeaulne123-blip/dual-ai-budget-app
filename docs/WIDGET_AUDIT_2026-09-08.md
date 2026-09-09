# Widget ecosystem audit — 2026-09-08

Baseline: `76e486a142987ed5d6fbc065367fadf4c896de26`. Integration: `codex/hercules-home-fund-repair`. This is a source and interaction inventory, not a claim of completed visual acceptance. All values reuse accepted core readings. Personal visibility is enforced before presentation. A drawer is a navigation surface, never financial authority.

## Office instruments (17)

D means a desktop instrument. P means an instrument available in the compact phone Office. Other instruments remain reachable through their ordinary workspaces or the desktop library; this patch does not invent new phone widgets. Office mode and saved layouts determine placement. Paper's omission is not an availability rule: its drawer now uses the complete instrument inventory.

| Instrument | Purpose and user value | Source of truth | Actions | Scope / role | Availability and empty/error behavior | Confirmed gap / disposition |
|---|---|---|---|---|---|---|
| Pad / calculator | Draft an amount and enter money with fewer steps | Entry draft; accepted account/category catalog | Add, account/category presets, More | Actor's current books; Confirm required | D/P; no amount is a draft, not a transaction; validation remains at review | Original keypad visual restoration requires Claude packet and rendered comparison |
| Blotter / Month net | Compare accepted money in and out this month | `officeFacts`, ledger month reading | Open ledger | Current scoped books | D/P; empty history shows no activity; integrity failure cannot become a plausible balance | No new formula |
| Wallet | See card pressure and reach payment review | Accepted account balances and card reading | Open account, Pay card | Visible accounts only | D/P; no card means no credit account configured, not zero debt | Paper drawer previously omitted it; complete library repairs discovery |
| Accounts | Inspect balances and recent accepted activity | Account register readings | Open register, payment review | Shared or actor Personal | D; phone uses Books accounts; no accounts prompts setup | Purpose overlaps Wallet intentionally: all accounts versus card pressure |
| Calendar | Locate dated money and household events | Existing calendar occurrence model | Day/week/month, open Calendar | Scoped events; private labels stay private | D; phone Calendar destination; empty day is explicit | No separate recurrence calculation |
| Appointments | Prepare for upcoming visits and proposals | Accepted appointments/visits | Open visit/appointments | Existing participant visibility | D; phone Calendar; no upcoming appointments explicit | Preserve current actions |
| Mail / bills | Identify the next bills needing attention | Due-occurrence reading | Review payment, open Calendar | Current scoped bills | D/P; nothing due differs from missing setup | Does not mark a bill paid on opening |
| Claims | Find outstanding amounts owed | Accepted claim/settlement reading | Landed review, appointment details | Existing claim ownership | D; phone register/workspace; empty means no outstanding claims | Landed remains a reviewed transfer |
| Shifts / timesheet | Start, pause and finish today's work | Owner's accepted shift timeline | Clock in/break/out, discard, review pay | Acting member only | D/P; no active shift offers clock in; competing timelines require choice | Paper omission repaired in drawer |
| Notes / chalkboard | Enter the five shared boards | Board-specific accepted state | Select Notes, Photos, To-do, Goals, Shift Ask | Existing board visibility and role rules | D/P; empty board offers its own first action | No board permissions changed |
| Wardrobe | Personalize and converse with Hercules | Companion appearance/preferences; scoped chat | Appearance, names, memories, chat | Actor preferences; chat gets filtered context | D; appearance reachable through normal controls on phone | Keep appearance/play available while setup incomplete |
| Postcard / Sit-down | Revisit the household review | Weekly Document and accepted sit-down state | Open document/guide | Existing member/household rules | D; phone ordinary review destination; unstamped clearly unfinished | No automatic signature or completion |
| Cook-off | Compare recorded kitchen and takeout spending | Existing `cookOffScore` category reading | Read comparison | Scoped accepted expenses | D; insufficient category history explicit | Category-specific spending is not measured savings; no new savings claim |
| Jars / Goals | See financial goals and approved progress | Goal/contribution/purchase reading | Open plan, purchase review | Existing financial-goal scope | D/P; no goals offers plan; incomplete funding stays visible | Separate from shared board milestones |
| Health / lamp | Reveal ledger checks needing attention | `runHealthCheck` | Open finding / More | Existing scoped checks | D/P; healthy versus unavailable distinguished by source result | Paper omission repaired in drawer |
| Tic-tac-toe | Shared low-stakes play | Accepted game state | Move/reset | Existing household members | D; phone ordinary companion route | No financial effect |
| Hangman | Shared word play | Accepted game state | Guess/reset | Existing household members | D; phone ordinary companion route | No financial effect |

Sources: `src/Office.tsx`, `src/OfficeWide.tsx`, `src/core/officeWide.ts`, `src/core/officeFacts.ts`, instrument components and their existing core readers. Every drawer retains office mode, desk presets, appearance, names, glance mode, size, saved layouts, restore, straighten and parked instruments. Look/Desks retain Back to drawer inside the modal.

## Fund library (16)

Every eligible library item remains discoverable. Desktop has eight saved positions; phone renders six. Positions seven/eight remain stored and are not offered as visible phone destinations. Level is pinned first. Ineligible placement is disabled with an explanation before selection. The Ask remains limited to its existing eligible role.

| Widget | Purpose / user value | Accepted source | Action retained | Scope / role | Empty or unavailable state | Confirmed gap / repair |
|---|---|---|---|---|---|---|
| The Level | Read the Fund across the month | `fundWalk`; phone Shared trust reading | Inspect level / eligible Shift Ask | Shared; contributor presentation follows existing role | Untied projection cannot be a trusted balance | Preserve current chart and custody interpretation |
| I spent something | Quickly draft a household expense | Entry draft and current account intent | Guarded expense shortcut | Existing spending authority | Missing foundations route to explicit review | Preserve shortcut and Final Confirm |
| I'll put in | Propose one's contribution | Accepted Fund motions and source declaration | Contribution form | Own proposal only | Missing declaration blocks; no proposal creates cash | Mandatory source, separate explicit custodian receipt |
| Waiting on you | Resolve household contribution motions | `householdFundContributionMotions` | Review receipt, Hold, Release, Withdraw | Each existing actor action checked at authority | No actionable motions is distinct from partner waiting | Source shown before receipt; changed proposal requires review |
| Next out | See the next dated outflows | `nextOut(fundWalk)` | Existing detailed reading | Shared | No upcoming accepted outflow explicitly stated | Lead with upcoming dates/outflows |
| Spoken for | See commitments against the current pool | `spokenFor(fundWalk,today)` | Existing detailed reading | Shared | Overcommitment remains a discrepancy | Lead with accepted commitments and claimed/free bar, not duplicate Next out heading |
| This week | See due and posted items in the weekly view | `fundWeek` / existing movement readers | Existing weekly detail | Shared; named member turn uses accepted evidence | No items explicitly stated | Preserve reader's actual civil-date window; no invented total |
| The shape | Compare categories with their historical band | Existing `categoryShape` | Category detail | Shared history | Incomplete history stays insufficient | Describes categories rather than promising a new budget recommendation |
| The two streams | Compare contribution timing | `twoStreams`, six months of confirmed contributions | Existing timing detail | Shared | Missing history stays missing | Copy now says confirmed contribution timing; no amount-comparison promise |
| Last seven days | See actual recent Fund movement | New presentation reader over existing active Fund events, today minus six days through today | Open activity | Shared | No accepted movements in window | Previously a navigation placeholder; now dated daily movements and reconciled opening/closing reading |
| The shelf | Understand goals, claims and deferral | Existing `fundPlates` shelf model | Open shelf/cabinet | Shared permitted goals/claims | Existing explicit empty shelf | No speculative goal widget |
| The record | Read latest accepted Fund activity | Active accepted Fund events and latest reconciliation | Open Fund register | Shared; no private bank totals | No accepted activity; never-reconciled and unchecked separate | Previously a navigation placeholder; now dated latest summary |
| The minute book | Recall household decisions | Weekly stamps, sit-downs, charter signatures/amendment metadata | Open More | Shared summary only | No accepted decisions yet | Previously a navigation placeholder; now existing decision history summary |
| The Ask | Reach one's Shift Ask board | Existing role eligibility and board state | Open Shift Ask, board 5 | Eligible member only | Restriction explained; no partner impersonation | Preserve current board destination; stale old graphic assertion corrected |
| The accounts | Inspect Shared account registers | Existing `accountRows` | Open register | Shared accounts only | No visible Shared accounts prompts setup | Copy explicitly says Shared |
| To settle | Review the Fund's custody obligations | Existing `settleView` and accepted allocations | Reviewed settlement | Existing custodian rules | Nothing owed versus unavailable reading distinguished | No second transfer or silent settlement |

Sources: `src/FundDrawer.tsx`, `src/FundStage.tsx`, `src/FundLedge.tsx`, `src/core/fundRail.ts`, `src/core/fundLibraryReadings.ts`, `src/FundLibraryReading.tsx` and the existing named readers. Navigation is preserved; the new readers do not post, predict income, or alter accounting formulas.

## Contextual Home readings

| Reading | Purpose and accepted source | Actions / visibility / empty state |
|---|---|---|
| Money in, money out, leftover seals | Existing accepted month ledger reading | Open corresponding scoped ledger; no history is not forecast income |
| Shared pre-Fund plates: Due, Cards, Owed, Saving, Coming, Trust | Existing `sharedLedgerStory`/plate readers | Open named cabinet or review; Shared only; missing foundations remain visible |
| Personal plates: Clock, Tips, Pay, Wallet, Saving, Month | Owner-specific accepted shifts, pay and account readings | Open owner work/ledger/plan destination; never display peer Personal rows |
| Weather / season | Existing local/weather presentation | Informational only; unavailable weather is not a ledger failure |
| Attention sill | Existing accepted state requiring action | Explicit navigation; no auto-open or conversation request |
| Recent accepted receipt | Existing command receipt metadata | Review/guarded Undo; drafts never masquerade as posted receipts |
| Hercules useful-information indicator | Inexpensive accepted-state usefulness | Small static mark on existing control; user opens before conversational work |

These are contextual surfaces, not additional selectable Fund widgets. Their existing layout remains intact. The full-width arrangement row is replaced by a 44px-minimum control in the existing heading/action area.

## Shared boards (5)

| Board | Purpose / value | Source / actions | Scope / empty and restricted state |
|---|---|---|---|
| Notes | Shared written reference | Existing notes documents; open/edit | Existing member access; empty note remains empty |
| Photos | Shared visual reference | Existing photo attachments and metadata; add/open | Existing attachment visibility; unavailable source is explicit |
| To-do | Coordinate tasks | Existing task records; add/complete/reopen | Existing member rules; empty list offers first task; default introductory board |
| Goals | Coordinate milestones | Existing board goal records; add/edit milestones | Shared board access; explicitly does not move money or fund financial goals |
| Shift Ask | Coordinate work-related asks | Existing board/ask model and role checks | Eligible member only; explanation precedes unavailable action |

## Cross-cutting findings and verification status

- Reconciliation now has three evidential outcomes: independently checked and tied; not independently checked; discrepancy. Negative implied remainder always means discrepancy. Shared summaries and PGlite use the same distinction.
- Confirmed legacy contributions keep their balances and are identified as lacking a source declaration. Unresolved legacy proposals require owner replacement before receipt.
- Linked private source claims require current command sync for cloud mutation. Incompatible legacy transport explicitly refuses the mutation, rather than losing the claim during event replay.
- Source-level fixes are implemented. Mounted tests, real renders, accessibility and performance evidence are recorded in the worksession as they finish. This document does not certify unrun physical-device or assistive-technology checks.
- The Entries Not Posted redesign is excluded. No speculative widgets, new financial formulas or new permissions are included.


## Additional reproduced drawer defects repaired

The Office's early phone return made the shared desk drawer unreachable below720px and unmounted an open drawer on rotation. The drawer now remains outside the responsive branch. A compact Drawer action shares the existing More instruments area. Phone presets, appearance and parked instruments remain usable; desktop-only canvas mode/size controls explain their restriction before selection. Save/pull reads each breakpoint's actual saved layout.

Cycling a Classic desk instrument to a larger size retained neighbouring saved positions, covering their controls. Resizing now repacks the canvas together; pointer park/restore passes in all three themes. Closing after crossing720px returns focus to the current Drawer control and scrolls it into view. The decorative sleeping animation now stops under reduced motion. These repairs are presentation-only.

Automated Office/Hercules/Fund checks recorded114 broad and27 targeted post-fix axe scans with no reported violations, no runtime errors and no horizontal overflow. Fifteen Office theme/width cases, three pointer-collision cases, twelve reduced-motion cases and six cross-breakpoint focus-return cases passed. These are synthetic Chromium component checks; authenticated Save/Pull, physical keyboards and screen-reader use are not inferred from them.
