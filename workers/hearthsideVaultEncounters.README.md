# Private reveals and twelve seasonal encounters

Local implementation, stacked on Vault `5fde7fafe290061a732326df92f57f780db489fd`.
No hosted schema, service, key, provider, invitation, notification or financial
activity is enabled by this package. Root Codex owns integration and release.

Budget delta (5): private answers and review choices never enter shared household
metadata, financial commands, URLs or the shared archive. Optional intention
linking is a reference to an existing record. Engagement delta (3): all twelve
Claude-informed seasonal packs have Notice → Make → Keep workflows with private
answers, shared arrangements and deliberately reviewed creative outcomes.

## Root metadata and command patch

Add optional `encounters: SharedEncounter[]` to the Hearthside versioned state;
legacy absence decodes to an empty collection. Use `decodeSharedEncounter` and
`decodeEncounterCommand` from the new strict module, not a loose JSON passthrough.
Bound the root collection and preserve it in shared-life archive/recovery. Require
the compatible encounter reader/writer capability before accepting new writes.
Financial restore must retain newer encounters just as it retains other creative
work. Root owns the command registry/focus map and actual room routes.

`applyEncounterCommand(current, input, authority)` is the pure transition seam.
Authority supplies authenticated `actorId`, current exact `memberIds`, canonical
`experienceIds`, actual `wardrobeIds`, and verified evidence when required.

- `encounter.start`: new occurrence id, exact pair, existing optional intention.
- `encounter.choose`: only the actor's choice and its per-author expected revision.
  Independent partners can change their own arrangement concurrently.
- `encounter.reveal`: exact expected encounter revision and trusted Vault binding.
- `encounter.keep`: the complete current composition digest, one real actor's
  acknowledgement. Never accept a client-supplied pair of approvals.
- `encounter.pause` / `encounter.resume`: only the actor's participation. A pause
  clears that actor's Keep acknowledgement and transfers no responsibility.
- `encounter.link`: existing optional intention, exact expected revision; clears
  Keep choices. It never creates an experience, bank, Task or date.
- `encounter.outcome`: exact mutually kept digest and independently verified
  canonical design/memory reference. It cannot manufacture the target record.

Every material reveal, arrangement or intention-link change advances
`compositionRevision` and clears both Keep choices. Root command receipts supply
idempotent durable acceptance; browser callbacks must retain the original command
identity through an uncertain acknowledgement. Replay starts a new occurrence
instead of overwriting an earlier one.

The metadata contains shared Make words/drawings, but **no Notice answer or private
consent status**. A reveal binding is an opaque reference, never disclosed content.

## Trusted Vault assembly patch

`hearthsideVaultEncounters.integration.patch` is an exact source patch against the
predecessor Vault files. It adds the private helper/adapter assembly and the
`encounter/` archive key family with monotonic generation validation. It leaves
all bindings/migrations/activation unchanged. Root should adapt these small hunks
around its newer memory withdrawal method. Tests apply these exact hunks in memory
while bundling the actual Vault; the one-writer shared source files remain untouched.

Root supplies the trusted read-only RPC:

```ts
vaultEncounterContext(scope: Scope, id: string): Promise<{
  id: string;
  packId: string;
  participantMemberIds: string[];
  wardrobeIds: string[];
}>
```

Check the fresh authenticated scope, current canonical encounter, exact active
pair and available wardrobe projection. Never accept wardrobe ids or a roster
from browser-supplied context. The adapter resolves current Auth principal
bindings through the existing authenticated Vault audience policy before and
after each private command and again after the archive await, immediately before
returning a private response. Its authorization argument is transient only.

The Vault exposes a trusted-only RPC, absent from its HTTP command vocabulary:

```ts
checkEncounterRevealFor(scope: Scope, binding: EncounterRevealBinding)
  : Promise<EncounterRevealBinding>
```

It checks **local Vault evidence only** and makes no LedgerRoom callback. Root can
hold its serial writer while awaiting it. Before canonical commit, root must
revalidate current CAS, actor, members, immutable binding and choice predicates.
Root must require this fresh evidence for `encounter.reveal`, **and for every
`encounter.choose`, `encounter.keep` and `encounter.outcome`** using that reveal.
An edited or withdrawn private reveal therefore cannot support a new keepsake
even if its old reference remains in shared metadata.

## Private reveal protocol

Authenticated POST uses `{operation:'encounter-private', input:{encounterId,
action, ...}}`. Actions are `read`, `save`, `delete`, `review`, `reveal`, `pause`,
`resume` and `withdraw`; each mutation carries a stable private request id.

Each person saves and reviews their own exact answer. The explicit `review`
action creates a random, author-only token bound privately to the full round's
generation and that person's answer revision. Ordinary reads do not return a
deterministic hash that changes when the other person writes. Tokens, review
states, timestamps and answer existence for the partner never enter shared data.

Both current answers and both current explicit reveal choices atomically create
the same immutable reveal binding and separately attributed answer projection.
Until then, the API returns only the caller's answer, their own submitted-choice
history and pause state. `choiceSubmitted` changes only with that author's own
actions. Current consent validity remains server-private: another person's save,
delete or pause must not change the author's ordinary response. It contains no
partner answered/read/consented fields. A save, edit, delete
or participation change clears both private reveal choices. Asynchronous users
can return later and deliberately choose again after any intervening edit.

The existing private R2 journal durably archives every acknowledged mutation
before response. The service rechecks a disclosed body after archive awaits;
edits/revocation cannot return an old reveal through an interleaved read. Withdrawal
removes stored answer bodies and closes the occurrence permanently; archive replay
cannot revive it. Independently kept, reviewed memory copies remain separate.

Private command history is bounded at 256 ordinary mutations per occurrence.
New making/review activity then requires a fresh occurrence. Pause, deletion and
withdrawal remain available at that bound; repeat pause is a no-op. No old request
identity is silently evicted. This is a technical limit, never a relationship
score or a displayed progress target.

## UI and creation callbacks

`SeasonalDiscoveries` lists the four authored packs for the current theme and
earlier occurrences. Its start/open callbacks belong to root's stable routing.
`Encounter` takes `client`, exact `scope`, `theme`, canonical `encounter`, `roster`,
`enabled`, `submit`, `refresh`, `onReplay`, optional existing `experiences`, and:

```ts
onStudioKeepsake(recipe: EncounterStudioRecipe): Promise<void>
onMemoryKeepsake({ encounterId, compositionDigest, title,
  image: Blob, answers: EncounterRevealedAnswer[] }): Promise<void>
```

These callbacks are deliberate user actions after both Keep acknowledgements.
They open actual reviewed creation flows. Root must freshly verify the canonical
digest, both acknowledgements and Vault reveal before accepting any source copy.
Do not automatically post money, create a memory, fire, or approve a composition.
Use a stable outcome identity per chosen encounter revision to recover a lost
acknowledgement without manufacturing another piece or media copy.

The Studio recipe contains a validated sculpt, dip, actual stamp data and
`derivedStrokes: { sourceMemberId, stroke }[]`, plus original attributed choices.
Apply real `create-piece`, `add-stamp` and `append-stroke` operations using the
accepting actor and stable operation/gesture ids. Keep recipe provenance separate
from operation authorship. Preset/copied marks are not invented partner freehand
history. The Studio card uses the existing KittyFlat projection to review the
actual proposed shape/paint. An incised-style word is rendered as initial stamps
(up to 16 characters); this does not claim physically carved manufacturing geometry.
Actual firing and selection of an existing piece remain in the Studio.

Memory output is a locally rendered PNG of the exact illustrated arrangement,
full separately attributed revealed answers, shared Make words and ordering. It
contains no external resource or original EXIF data. Send this new image through
the existing private media upload queue and exact memory publication flow. The
caller may use its own recollection field; do not spoof the other person's direct
memory authorship merely because their reviewed answer appears in the image.

Mummers receives only actual wardrobe items:
`{id, name, stamp: KittyStampV1, preview: ReactNode}`. It uses the existing canonical
STAMP_ART paths for the selected item. No item is fabricated for an empty shelf;
`onOpenWardrobe` opens the existing wardrobe. The illustrations stay covered until
both put down a guess or optional further clue; there are no points or grades.
The deliberate Notice reveal already shares the chosen references, so the visual
cover is a play mechanic, not a private-access boundary.

The existing chalkboard drawing/typing remains untouched. Encounters optionally
accept a drawn mark, a keyboard-selected mark, or typed words. Make drafts retain
their per-author base revision in private IndexedDB, so a second device's newer
contribution is not silently overwritten. The component offers the current shared
contribution explicitly when a local draft is stale. Private draft and pending
request keys include environment, household, member and Auth subject.

The private cache retains one current Notice draft, one Make draft and one pending
command per visited occurrence. Settled pending records and empty caches are
deleted; uploaded/accepted content uses the server's separate recovery authority.
Switching scope unmounts the surface, closes its IndexedDB connection and prevents
later callbacks from publishing into another scope. No private content is loaded
into generic browser localStorage in product code.

## Evidence and remaining integration gates

Pure tests cover all twelve packs, exact attribution/digests, independent choice
revisions, actor spoofing, stale/revoked evidence, real Kitty recipe validation,
optional references, pause and material edit invalidation. Client tests prove
durable-before-network identity and storage-failure refusal.

The actual Miniflare Vault test applies the returned patch and runs authenticated
local two-member requests, SQLite, private R2, a canonical-shaped second Durable
Object, deliberately waiting writer→Vault evidence, stale approval, edit/review
invalidation, recipient isolation, audience replacement, retry, pause/resume,
withdrawal and explicit empty-DO archive restore.

Real Chromium runs both synthetic participants through all twelve complete
components to actual validated Studio recipes or generated PNG blobs. It checks
private IndexedDB reload/same-id retries, account switching, keyboard discovery,
all three themes at 320, 390, 719/720, 1100, 1440 and 1920 pixels, axe and dark
enlarged text. Screenshots are in `/tmp/hearthside-encounter-proof`. Browser fixture
metadata is synthetic and deliberately labelled; it is not Google/device evidence.

Actual LedgerRoom registry/replay/restore and room integration, canonical creation
callback acceptance, physical devices, authenticated cross-device continuity,
hosted archive lifecycle, and release activation remain root integration gates.
Recorded room-history views and Projector are outside this bounded package and
remain part of the full program. This package does not close P15.
