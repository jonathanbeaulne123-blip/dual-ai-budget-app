# Onboarding Slice 13 contract — Chapter 4 · map where money lives

## Authority

Jonathan authorized Slice 13 on 2026-09-04 and clarified that chapter times
are guidance, not limits. The current onboarding manual's Chapter 4 probe and
the newer `_1` UX packet/plates govern the journey. Current repository canon
D-208 supersedes the older packet's offline-queued Shared-write example:
Shared account changes remain online-required and cannot become accepted
evidence before cloud acknowledgement.

## Household outcome

The custodian names the accounts the household actually uses and explicitly
chooses one Shared credit card for the Fund. Chapter 4 completes only from a
non-empty Shared account set plus that resolvable Shared card. Personal
accounts remain owner-only and optional; adding one or recording a skip never
substitutes for the household probe.

## Modify

- `src/core/onboarding/evidence.ts` — make Chapter 4 household-only, preserve a
  separate owner-only Personal projection, and refuse partner-Personal
  candidates without revealing them.
- `src/core/types.ts`, `src/core/household.ts`, `src/core/sync.ts`,
  `src/core/swipe.ts`, `src/core/commands.ts`, `src/Accounts.tsx` — carry a
  dedicated member-owned Personal Fund-card preference with deterministic
  convergence and expose it in the existing account editor.
- `src/core/onboarding/progress.ts`, `src/core/commands.ts` — record the
  optional Personal-account skip without satisfying the chapter and fence
  acknowledgement behind current Shared evidence.
- `src/core/onboarding/copy.ts`, `src/core/onboarding/registry.ts`,
  `src/OnboardingChat.tsx` — add Chapter 4 copy, six-minute guidance, the
  after-Shared pause point, repair states, Personal choice, and actions.
- `src/Hercules.tsx`, `src/App.tsx`, `src/Books.tsx` — close Hercules, retain
  the scoped return instruction, switch to the actor's Personal Books, and
  expand the existing account editor in one action.
- Focused onboarding/account tests and living decision, roadmap, worksession,
  and handoff records.

## Create

- `test/onboarding-accounts.test.ts`
- `docs/worksessions/2026-09-04-onboarding-accounts.md`

## Probe and recovery

- No Shared accounts: pending; **Open accounts** lands on the real editor.
- Shared accounts but no resolvable Shared credit card: pending; the editor
  offers every eligible Shared card as an explicit Fund default.
- Exactly one eligible Shared card: resolvable without an invented choice.
- Several eligible Shared cards: never guessed. The custodian chooses one.
- A requirement that only a partner-Personal card could appear to satisfy:
  `blocked.privacy`; no account id, name, count, institution, or last four is
  disclosed.
- Offline Shared addition: the existing D-208 online-required boundary
  refuses before accepted state. No local `offline.queued` completion claim.
- A card archived or made Personal after selection stops resolving and the
  acknowledgement command refuses until current evidence passes again.

## Evidence and Personal choice

Household evidence cites every active Shared account and names the Fund card.
The witness receives the same household card and **Shared accounts only.**
Personal evidence is available only through `selfPersonalAccountsEvidenceFor`
to its owner. The optional skip writes
`personalAccountSetupSkippedAt` in that member's Personal progress envelope;
it writes no account and does not affect `chapterSatisfied`.

## UX and accessibility

- The task uses the plate's plain “which accounts the house actually uses”
  language and one specific **Open accounts** action.
- The routed editor says that Hearth records accounts but neither opens them
  nor moves money. Its Fund-card choice says it records a default and does not
  charge the card.
- After Shared evidence passes, an owner with no Personal account gets one
  soft choice: add it now or **Skip this for now**. After either choice, the
  cited Shared evidence and explicit **Next** return.
- All routed account controls, shell actions, Close, and stop are at least 44
  CSS px. Focus stays visible, content reflows without horizontal scrolling,
  and no timer, percentage, automatic advance, or partner-directed nudge is
  introduced.

## Acceptance

- Tests cover partner-Personal non-satisfaction and non-disclosure, ambiguous
  versus selected Shared cards, the command fence, owner-only Personal
  evidence, a non-fabricating skip, witness evidence, direct account setup,
  registry/return behavior, and existing Swipe/account contracts.
- Medium-High quick gate and production build pass on the exact final tree.
- Live browser proof covers 320, 390, 720, 1100, a 200%-equivalent reflow,
  keyboard wrapping, 44 px targets, contrast, forced colors, reduced motion,
  privacy refusal, skip recovery, and explicit Fund-card selection.

## Do not

- Do not add a bank feed, provider connection, issued card, account-opening or
  money-movement claim.
- Do not use Personal accounts, partner metadata, device presence, or
  Household Google bridge fields for the household probe.
- Do not guess among several Shared cards or let navigation/chat complete the
  chapter.
- Do not create a Shared Fund/account field, schema, hosted row, Auth/RLS,
  Production, deployment, or second account-management surface.
