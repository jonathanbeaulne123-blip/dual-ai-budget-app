# Hearthside bank receipt settlement — 2026-09-12

- Owner/integrator: root Codex; bounded implementation by Codex in isolated `codex/hearthside-bank-ack`.
- Exact base: `1d5b08ee49594349e1886344f5e6d1edeb9f0062`. The integration owner was reconciling main; all dependencies were read from this checkpoint, not conflicted root files.
- Risk: High; this changes the client completion boundary for an already accepted command.
- Budget delta (5): exact accepted receipt releases the original writer without another confirmation or duplicate bank.
- Engagement delta (3): after uncertain bank creation, the couple can deliberately continue into the bank-to-experience agreement.
- Authorized scope: one new real-client/HTTP regression, exact client patch, focused evidence. No root edits, credentials, dependency installation, provider calls, hosted schema/activation or Production actions.
- Finding: HTTP `acceptedCommand` returned success without the WS ACK path's durable queue cleanup, waiter settlement or in-flight release. App's original `await confirm` stayed busy indefinitely while the socket remained open.
- Implementation: shared serialized receipt settlement; current scope, actor, identity, exact pending digest, sequence coverage and undo validation; idempotent callback/queue completion; explicit reader/client cancellation behavior.
- Baseline proof: unchanged checkpoint failed the new regression because busy remained true after successful HTTP receipt recovery; 1.47 seconds.
- Passing evidence: five actual Chromium/IndexedDB/WebSocket/HTTP/Miniflare SQLite/R2 tests plus twelve existing authority tests; 17/17, 4.58 seconds. Both transport orderings, invalid receipt faults, same-identity retry, queue advancement, closed scope and aborted read covered. No full compiler or High gate ran, as requested by the integration owner.
- Related failure: the prior bank runtime fixture bypasses the client constructor. It needs a real constructor before its deliberate replica overrides; integration guidance is in `docs/hearthside/bank-ack-settlement.md`.
- Handoff: patch applies only to `src/ledgerSync/client.ts` on the checkpoint. Root owns capability merge reconciliation, the small older-fixture correction, focus registration and final integrated gate. A full App presentation test and the separately reported non-v2 creation-path compatibility finding remain outside this patch.
- Independent review: root requested this concrete repair following the bounded App/Hearthside/bank integration review. Root owns independent review of the finished patch; the passing tests do not substitute for that review.
