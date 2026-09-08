# Hearth worksession — App-issued accepted scenario source

- Status: LOCALLY VERIFIED; draft PR delivery pending
- Owner / decision owner: Jonathan; assignee Codex
- Branch: codex/mobile-sc6-accepted-scenario-source
- Base: a13c6c4155707cb7d1f68d68bbe5c89078a49b80 (SC05, draft PR383)
- Risk: High; Budget(5)+3; Engagement(3)+1
- Environment: local fictional fixtures; no hosted changes

# SC06 accepted source adapter
Separate branch after SC05. High risk; Budget(5)+3 Engagement(3)+1. Root sole writer.

Model code is complete. Add one read-only ScenarioSourceContext {household: accepted full pair, accepted: ScenarioAcceptedSource, isCurrent():boolean}; children receive it through props and never load auth/storage or manufacture authority. Optional context is null when current Shared acceptance/auth cannot be established; ownBooks unavailable when Shared accepted but no proven own pair. Current Fund/Ask rendering stays readable.

App owns a token-free auth identity state+ref (environment,userId,sessionId,googleSubject). Token refresh alone does not change identity. On auth identity change synchronously update ref, increment pair authority epoch and replicaScopeGenerationRef, invalidate accepted-pair lease, then render state. Include identity key in v2 client and presence effect deps. Its scope subject remains localLedgerIdentity or auth.userId.

Separate pair completeness from view generation. Pair key includes env/hh/member/authidentity/authoritymode/pair epoch; member/hh/env change invalidates it. Room change retains proven pair but changes source scope authorityGeneration/viewerRoom, invalidating prior scenario choices. Existing rememberSession compares fields; only member/hh increment pair epoch. changeEnvironment and switchLedger invalidate synchronously.

Positive complete-pair stamp points: v2 client adopt (including validated local cache), legacy installCanonicalCloudReplica full Shared+Personal validation, legacy repair full pair. V2 creation/discovery candidates remain unavailable until ordinary validated v2 client publication supplies the complete-pair proof. Do not stamp generic cached startup or personalReplica load: save-before-load can synthesize an empty envelope.

V2 adopt captures env/hh/member/auth identity plus auth generation on client creation; transport deliberately excludes the pair epoch so failed navigation cannot disable subsequent accepted publication; checks live/captured identity/env/member/hh before AND after save. Late auth-A callbacks cannot restore A after B even before React cleanup. Source context isCurrent checks current accepted household object, activeBooksGate.ready, exact pair scope/key, same lease/acceptance id, current room+replica generation. Async model results must recheck it on settlement and before render/use.

Accepted id = version+revision+booksAcceptedHash+local acceptance epoch, bounded below512 characters; scope is separately bound, never a command UUID. Per-source digests remain core responsibility. Unknown replacement invalidates completeness; only proven scoped accepted successor may carry. Conservatively wait for next v2 accepted publication rather than infer arbitrary generic adoption is complete.

Tests: pure token-free identity/scope and lease builders; mounted real App via test/app-startup-p1.test.ts, capture scenario props in DeferredOffice/FundLedge mocks, retain v2 client options and delayed save. Validated cached pair ready without SQL, missing legacy unavailable vs pulled empty ready, auth A→B before/after save invalidates old callbacks, token rotation preserves scope, view changes preserve completeness/new basis, env/member/hh invalidate, unknown generic replacement never grants completeness, current shells remain mounted.

Later Reach: original flat composition replaces phone Ask, never append second card. Top current Shared Ask29px, single conditional sentence, one Level drawing,0–4 rail+hours, named dates, original5px projection paperbox. Receipt/availability/fixed-or-cap amount/contribution-date controls inside paperbox disclosure; model end deficit compact row there, never second hero or relabelled Ask. Native gesture cancel/no writes; no forecast consent or election inferred from route motion.

## Reproduced and repaired lifecycle failures

Mounted actual App regressions failed before repair: a failed household switch stopped subsequent accepted updates, and a delayed legacy response from sign-in A installed after B became current. Transport now separates navigation invalidation from client lifetime. Legacy full-pair pulls carry their operation-start authentication provenance through installation. A→B→A within one React batch increments authentication generation and forces a new client. Token-only refresh retains the valid source.

Targeted repaired run:17 passed (8 mounted startup plus9 source-builder cases),27 skipped,63.23seconds. Independent final lifecycle review:4 passed,32 skipped,8.20seconds; no additional bounded findings. Nine new mounted startup cases bring that file to36 assertions. The initial High gate stopped at TypeScript because a test fixture used undefined for a nullable accepted hash; changed the fixture to null. That failed run lasted48.314seconds, fingerprint e2d8d57b519d99b2e21b62800e4667d313543812d75c0e78f6d659f70a02de36. Final gate pending below.

No rendered markup or CSS changes: source props only. Evidence uses fictional local households, actual App lifecycle, and mocked provider transport. No physical-device, hosted, exhaustive, merge, deployment, schema or Production claim.

The next gate passed TypeScript, AI and diff checks, plus79/80 fast assertions; the source-text Ask-placement assertion expected household as the first prop. Restored that prop ordering without changing rendered behavior. This failed run lasted352.728seconds, fingerprint14c4e3f374adcce713e678d3816cf603b29f2247b2bc29cddc89d246ef315c91; five-minute breach at test discovery, TypeScript243.876seconds.

Final source gate fingerprint06b8fd34338d3c9d5a4d4e5a8d0106002e2f11049c9f98eec27dd05013059e7b: TypeScript/AI/diff passed,78/80 fast assertions passed. The existing demo-entry file timed out at15seconds during the four-worker run and its second case inherited incomplete cleanup. Gate181.621seconds, no breach. Unchanged isolated demo-entry rerun passed2/2 in23.48seconds (tests3.009seconds). Serial selected files are completed separately; this is not a clean quick-gate claim.


## Final evidence and delivery

- All130 selected assertions pass across final gate and targeted recovery:78 final fast,2 isolated demo-entry,50 serial (36 actual App startup,6 onboarding entry,1 stale seat,7 proof matrix). Serial run217.56seconds. Independent final4 lifecycle regressions pass, no bounded blocker.
- Final High gate command: `pnpm test -- --risk=high --base=a13c6c4155707cb7d1f68d68bbe5c89078a49b80 --focus=test/scenario-source-context.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Issue only scoped validated Shared and own Personal scenario sources, invalidate old auth results synchronously, preserve accepted replica adoption after failed navigation, and keep startup and Bianca rehearsal acceptance intact"`.
- Recovery commands: `pnpm exec vitest run test/app-swift-demo-entry.test.ts --maxWorkers=1`; `pnpm exec vitest run test/app-startup-p1.test.ts test/onboarding-app-stale-seat.test.ts test/onboarding-entry-integration.test.ts test/proof-matrix.test.ts --maxWorkers=1 --testTimeout=30000`.
- Runtime PATH prepended the bundled Node runtime. Evidence is selected quick validation with targeted recovery, not a clean quick gate or exhaustive lane.
- Changed source: App plus the new scenarioSourceContext helper; optional prop threading in Ask, FundLedge, FundStage, Office and OfficeWide. Tests: source-context builders and actual App startup. No rendered markup or CSS changes; no new browser claim.
- Next owner: Codex, integrate Claude's original phone Reach using these scoped props. Jonathan owns review and any later release authorization.
