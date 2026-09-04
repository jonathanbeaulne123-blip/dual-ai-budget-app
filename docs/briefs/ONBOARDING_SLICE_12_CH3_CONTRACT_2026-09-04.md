# Onboarding Slice 12 contract — Chapter 3 · the Charter

## Authority

Jonathan authorized implementation on 2026-09-04 and clarified that chapter
times are friendly estimates, never limits. The current onboarding manual's
Chapter 3 outcome and the newer `_1` UX packet/plates govern the journey. This
contract supplies the missing file boundary without changing the existing
Charter record, founding questions, or document design.

## Household outcome

Either member can leave Hercules for the existing Charter founding flow or
document, return later without losing their place, and complete Chapter 3 only
after both people have signed the latest terms. A member who already signed
waits without a nudge aimed at the other person. An amendment makes earlier
signatures stale; each person may quietly sign the current terms again.

## Modify

- `src/core/charter.ts` — expose current/stale signature status and make
  replica merging retain a current re-signature over an older stale one.
- `src/core/commands.ts` — permit a member to replace only their own stale
  signature; continue refusing a duplicate signature on current terms.
- `src/core/onboarding/evidence.ts` — project the existing typed Charter with
  current-revision signatures and Charter provenance.
- `src/core/onboarding/copy.ts` — add Chapter 3 task and action copy.
- `src/core/onboarding/registry.ts` — make the displayed eight-minute estimate
  honest and declare the optional after-question-two pause point.
- `src/OnboardingChat.tsx` — present founding, own-signature, patient waiting,
  stale, accepted, and navigation states.
- `src/Hercules.tsx`, `src/App.tsx`, `src/onboarding.css` — open the existing
  founding/document surface, close chat, retain the scoped return instruction,
  and render its mobile furniture.
- Focused Charter/onboarding tests plus living handoff, worksession, roadmap,
  and decision records.

## Create

- `test/onboarding-charter.test.ts`
- `docs/worksessions/2026-09-04-onboarding-charter.md`

## Probe and recovery

- No Charter: pending; open the existing `CharterFounding` flow.
- Charter present but the viewer has no current signature: pending; open the
  existing `Charter` document to sign their own line.
- Viewer current, partner not current: `waiting.partner`; no partner-directed
  CTA, badge, warning, reminder, or automatic navigation.
- Both signatures are current when each normalized `signedAt` is greater than
  or equal to `termsUpdatedAt`; only then is evidence accepted.
- Any non-null signature older than `termsUpdatedAt` is stale. The owner of
  that line may re-sign; replicas prefer the earliest signature on the current
  terms over every stale signature. A later clock from a replica whose wording
  does not match the winning terms is not current consent and is discarded
  rather than attached to wording that person did not sign.
- A duplicate signature on current terms remains refused. One member can never
  sign or re-sign the other member's line.
- Completion comes only from the typed Charter projection and still requires
  the member's explicit Next acknowledgement; navigation or chat text cannot
  complete the chapter.

## Evidence

Household-scoped only: purpose (or an honest left-open value), custodian, split
rule, optional words, ceiling via `charterCeilingLabel`, cadence via the
existing Charter view helper, and both signature dates via `signatureLines`.
The card is **The charter** / **From the charter record.** No Personal content,
balance, chart, ratio, or enforcement claim appears.

## UX

- Task copy explains the Charter in two short sentences.
- CTA is specific: **Write the Charter**, **Open the Charter**, or **Review and
  sign the Charter**; never generic **Open More**.
- Navigation stores `nav.return`, closes chat, and opens the existing flow.
- The return instruction has no dismiss action or timeout and clears only when
  this member advances past Chapter 3.
- Eight minutes is an estimate. There is no timer, timeout, forced pause, or
  feature reduction. The after-question-two pause is optional metadata; the
  existing local draft makes returning safe.
- Existing Charter founding/page styling, keyboard model, and unsigned-line
  restraint remain intact.

## Acceptance

- Focused tests cover absent, unsigned, one-current-signature, stale,
  current-two-signature, amendment, stale re-sign, merge convergence, route
  without signing, copy, and navigation/return wiring.
- The Medium-High quick gate passes on the exact tree.
- Live browser proof covers 320, 390, 720, and about 1100 CSS px plus keyboard,
  focus, 44 px targets, reduced motion, forced colors, 200% zoom, and relevant
  founding/unsigned/waiting/stale/accepted journeys.

## Do not

- Do not reimplement, restyle, or fork `CharterFounding.tsx` or `Charter.tsx`.
- Do not collect Charter answers or signatures in chat.
- Do not add a signature-revision field, migration, schema, hosted row, or
  second Charter record.
- Do not change money, Fund, custody, Auth/RLS, provider, Production, or deploy
  behavior.
- Do not auto-complete, auto-advance, nag the other member, or turn the time
  estimate into a limit.
