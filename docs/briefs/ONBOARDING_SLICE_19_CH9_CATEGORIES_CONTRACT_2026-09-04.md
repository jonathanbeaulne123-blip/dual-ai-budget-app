# Onboarding Slice 19 — Chapter 9 category selection

## Outcome

Each active household member chooses what the first household plan should cover
on their own device. A local draft is private. Explicit Submit publishes that
member's category ids and any category ideas. One submitted list waits without
revealing the other. Once both current lists exist, Hearth reveals the combined
set and each authored list without comparing them.

## Suggestion and canonical boundary

- A typed idea is component-local draft state and changes no Household data.
- Submit creates an immutable `OnboardingCategoryProposal` tied to the author's
  category submission id, member id, household id, and submission time.
- A proposal id may join the deterministic submitted union, but it is not a
  `Category`, budget plan, approval, transaction, or posting.
- `mergeOnboardingCategories` is the one reviewed adoption command. It requires
  both current category submissions and maps each submitted source id to one
  canonical category id.
- One accepted idea creates one active expense category. The merge creates no
  budget amount and no journal entry.

## Conflict rule

Same normalized name with different ids is a conflict whether the alternatives
are two submitted ideas or an idea and an existing canonical category. Hearth
shows the alternatives and the category group. The reviewed command requires
exactly one selected source for each conflict and maps every same-name source to
that one canonical category. It never selects by arrival order.

## Privacy and presentation

- Before both Submit actions, a member can see only their own draft/submitted
  state and a patient waiting line.
- After both Submit actions, the household may see the deterministic union and
  the two member-authored lists.
- The screen contains no score, ratio, percentage, ranking, contribution claim,
  or language about who selected more.
- Chapter 9 uses the existing Plan route and one focused card. Hercules remains
  the conductor and never collects the choices in chat.

## Continuity

Proposal and merge records are Shared-only, shaped with exact fields, merged by
immutable id, included in command identity/materialization hashes, and replayed
through the current command-event path. Merge events also carry each newly
canonical category so a second device cannot receive the adoption record without
the category it references. Actor, household, submission, source, and category
relationships fail closed.

## Money boundary

Draft, Submit, reveal, conflict choice, and reviewed merge create no transaction,
journal line, Fund event, estimate, budget plan, contribution, or approval. The
accepted-books financial hash remains governed by the existing money commands.

## Kill criteria

- a draft reaches Shared state before Submit;
- one submitted list exposes the other person's choices;
- arrival order changes the combined set;
- an idea becomes canonical before the reviewed merge;
- a same-name/different-id conflict resolves without an explicit selection;
- the merge creates duplicate canonical categories or arrives without them on
  another device;
- any member comparison or selection count is rendered;
- any budget amount, money row, journal meaning, Fund event, or approval changes.
