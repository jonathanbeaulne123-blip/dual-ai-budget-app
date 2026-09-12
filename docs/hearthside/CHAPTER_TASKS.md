# Chapter agreements and canonical Tasks — P7 integration

This package changes observable work in Our Path and Sitdown: each person can review exact shared Ritual terms, pause their own participation immediately, prepare a dated occurrence, accept its responsibility, and complete the same Task used in the Planner. Closing a Chapter is an exact two-person review, including the Ritual transitions and open Move Tasks it pauses.

## Apply and activate locally

1. Apply the owned source commit, then apply `chapter-authority-integration.patch` to the integration checkout. The patch was exercised against baseline `429db8ef0447dac6347e89e945dd04aad05e84fb` with the new source. It deliberately remains a reviewable patch because the integration owner owns these shared files.
2. Resolve root integration changes in registry, protocol, client, LedgerRoom hello, authority, sync shaping, command identity/runtime, command-event materialization and compaction. New readers/authority precede new writes. `chapterAgreementVersion: 1` is required once these records exist or a Chapter command creates them. Reader/writer capability failure preserves records and asks for an update.
3. Keep the existing feature gates and high-risk focus map. Register the new Chapter suites and retain the amended Chapter/Planner tests plus existing startup, Plan, Sitdown, Ledger and month-rehearsal regressions.
4. Wire the Planner with `taskCompletionBlock(household, task, memberId)`. Gate Complete, Attach receipt and Paid/keep with this reason. Private self-authored Tasks stay private and need no shared assignment. For an unassigned shared Task show Taking it; `acknowledgeTask` atomically claims it. Do not turn an unaccepted assignment into a read receipt: use “hasn’t accepted this assignment”. Existing `editorFor` spreads the protected source and participation fields, which must be retained through edits.

## Commands and contracts

All commands are non-financial intents executed under the authenticated `memberId`; no endpoint accepts a new household or a client-authored approval history.

- `editRitual(h,{memberId,ritualId,expectedRevision,terms})` proposes the complete `ritualTerms(ritual)` structure. It retains current terms until everyone in the exact active audience agrees. A material update supersedes pending approval, retaining all earlier versions.
- `acknowledgeRitualChange(h,{memberId,ritualId,expectedRevision,proposalId,digest})` accepts only the unchanged terms, basis and audience. The proposal itself is the proposer’s explicit agreement. Own participation changes do not invalidate unrelated shared terms.
- `setRitualParticipation(h,{memberId,ritualId,expectedMemberRevision,paused})` only updates the actor’s participation. It never changes the owner, backup or shared state. Existing dated assignments retain their reviewed responsibility when a template changes.
- `adoptChapterTasks(h,{memberId,chapterId?})` preserves legacy Move IDs and historical Ritual dates, giving each a deterministic canonical Task identity. It is explicit and idempotent. Unknown authors, completion instants and legacy receipt meaning remain unknown; legacy date-only completions are archived Tasks with preserved source metadata.
- `prepareRitualOccurrence(h,{memberId,ritualId,onDate,expectedRevision})` creates/reuses one reviewed dated Task. The occurrence identity/date never silently changes. Another date is another deliberate occurrence.
- `respondToMove` requires `expectedTaskRevision`; accept claims/takes the canonical Task, acknowledge reviews the current Task material version and audience, and pause/decline pauses only the actor.
- `recordRitualHeld` and `completeMove` require `expectedTaskRevision` and delegate to `completeTask`. Legacy free-text `evidenceRef` is no longer a completion receipt. `recordRitualHeld` does not append a second heldOn completion; all current views derive it from Tasks.
- `reviewChapterClosure(h,{chapterId,outcome,carryForward?,sitdownId?})` returns exact affected terms, `expectedRevision`, and `reviewDigest`. The caller shows those terms before submitting `closeChapter` with `reviewDigest`. A changed Task, Ritual, Chapter, audience or outcome invalidates that local review. The first accepted proposal keeps the Chapter open. Partner approval uses `proposalId`, `digest`, and current `expectedRevision` with those same terms.

`ChapterConsent` histories are versioned, immutable in their authored facts, and retain individual approval timestamps. A digest checks exact content; it is not a signature. Only authenticated command replay creates authority. Equal-version divergence is rejected, higher versions cannot lose immutable prior history, and wall-clock recency cannot replace new records with old-client writes. `assertChapterTaskGraph` rejects orphaned canonical Tasks, missing closure approvals, or material terms changed outside their accepted review; call it after shaping/recovery as included in the patch.

## Canonical evidence and recovery

A shared Task’s responsible person or agreed backup accepts its exact assignment before completion. Personal self-authored Tasks are completed only by their owner. Material Task changes clear acceptance; linked Move changes also advance its material version. Money work needs an existing accepted receipt with matching identity, date and amount, correct bank/bill/planned-expense purpose, and no reversal. A dated Ritual uses evidence from that occurrence date and cannot reuse the same receipt for another occurrence of that Ritual. Private financial sources cannot be attached to shared Task references.

`Task.chapterSource` is provenance, not a second completion store: canonical Task records own completion, evidence, assignment and participation. Moves retain their original historical fields only as a legacy baseline, then project current values from their protected Task link. Existing Task IDs remain stable across Chapter, Sitdown and Planner.

Command-event payloads now include `chapterTasks` (only shared Tasks with a Chapter source), bind them into materialization hashes, retain them through compaction, and validate the complete graph after replay. The patch updates old Chapter replay regressions to assert both direct and compacted Task recovery. Do not include personal Tasks in this payload.

Financial restoration must preserve the newer Chapter/Ritual/Move/Task graph together with other shared-life content, or reject the old restore requiring explicit shared-life recovery. Restoring only its Tasks or only its Chapters creates a broken graph. Parent’s broader creative-continuity restoration needs to include this graph; the patch’s shape check makes incoherent recovery fail closed. Shared-life restore is separate and must not revive superseded approvals.

## Evidence and limits

Measured local proof: 47 core/authority/Chapter/Planner assertions passed after the sync graph guard (46.63s under host load); 4 browser tests passed with the app’s real styles and scene tokens (11.17s), including the dark scene, enlarged text and the repaired legacy action contrast. Final targeted strict TypeScript passed with the graph guard, authority patch and fixture; the integration owner still includes the package in its complete exact-head gate.

Local tests cover exact reviews, stale and changed participants, authenticated actor binding, old capability rejection, independent pauses, same Task completion across views, accepted financial fixtures, legacy adoption without invented authorship, tampered terms and orphaned graph recovery, and direct/compacted command replay. Browser tests exercise the actual components under React StrictMode, free and funded Rituals, explicit closure review, responsibility/pausing, correct household scope draft reset, all three themes at 320/390/719/720/1100/1440/1920px, enlarged text and keyboard controls. Screenshots are generated at `/tmp/hearthside-chapters-proof`.

These are local synthetic proofs. Hosted authenticated devices, native presentation, full application accessibility review and Production remain separate program gates. No payment, deployment, migration application or external communication occurs in these tests. P8 still needs to supersede or close the legacy `keepWinAsMemory` path: it currently unions keepers when its caption/amount visibility changes and cannot represent exact-composition memory consent.
