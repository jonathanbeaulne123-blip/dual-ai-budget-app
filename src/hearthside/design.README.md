# Canonical Hearthside designs

This module implements the P4 creative document and operation reducer for the full Hearthside program. It is independent of financial commands, household snapshots, render libraries, and media services. It does not by itself enable the Studio, a hosted authority, or live previews.

Baseline: `429db8ef0447dac6347e89e945dd04aad05e84fb`, local branch `codex/hearthside-design`. Risk is High at integration. The budget improvement is a creative revision boundary that can remain separate from funding review dependencies. The engagement improvement is simultaneous accepted painting, individual undo, immutable firing, and recoverable original artwork. The integration owner must record these decisions in the program worksession and decision log.

## Storage and acceptance

One `KittyDesignDocument` owns a studio's pieces, selected display identity, immutable migrated baseline, and accepted operation journal. Store it separately from the household envelope, in the existing scoped authority. The small `KittyDesignReference` contains only `{version, designId, revision, displayPieceId}`. A design may exist without a bank.

The public entry points are exported from `design.ts`:

| API | Use |
| --- | --- |
| `createKittyDesignDocument(id, scope)` | Begin an empty document. Scope is environment, household, and optional personal owner. |
| `migrateLegacyKittyStudio(id, scope, studio, migrationId, existing?)` | Preserve the old pieces and display choice once; mismatching subsequent migration refuses overwrite. |
| `decodeKittyDesignOperation(unknown)` | Closed, versioned, bounded client decoder. No authored actor, server order, money, URL, or replacement-piece payload. |
| `acceptKittyDesignOperation(document, operation, authority)` | Return a new document and durable-receipt value; exact retries return the original receipt. |
| `projectKittyDesign(document)` | Piece projections, field/surface revisions, editing epoch, gesture attribution/state, reveal snapshots, and recoverable paint. |
| `displayedKittyDesignPiece(document)` | Selected `KittyPieceV1` for the existing Home/room/Studio renderers. |
| `kittyDesignReference(document)` | Small envelope or experience reference. |
| `snapshotKittyDesignRevision(document, pieceId, revision)` | Exact selected accepted revision for memory/export generation. |
| `checkpointKittyDesign(document)` | Deterministic JSON retaining complete operation attribution and undo history. |
| `restoreKittyDesignCheckpoint(json)` | Strict history validation and replay after storage restart or an authorized restore. |

The authority context contains exactly `environment`, `householdId`, `actorId`, `order`, and `acceptedAt`. The owning LedgerRoom must obtain identity from authenticated membership, supply a monotonically increasing safe integer order, and atomically persist the accepted document plus receipt before sending an acknowledgement. This module checks scope and personal-owner isolation; household membership authentication remains the caller's job. A structurally valid checkpoint is not a credential or proof of authorship.

Keep membership checks, the design write capability (`hearthside-design-operations-v1`), command receipts, and compatibility checks at the server boundary. Disable legacy whole-envelope artwork writes after migration. Financial restoration must not replace this document. Do not write a projected `KittyPieceV1` back into the old whole-studio writer.

## Concurrent editing contract

Every operation has version, operation identity, design identity, piece identity, and gesture identity. Creative edits additionally carry `expectedEditEpoch`; new/migrated clay starts at zero, and reopening uses the accepted reopen order as its new epoch. A delayed edit from an earlier firing cannot enter the newly reopened clay by accident. Keep rejected work available in the client's resumable recovery queue.

`append-stroke` accepts a completed stroke or completed gesture segment and its original per-part `surfaceRevision`. The server stamps authorship and compositing order. Concurrent strokes do not need a whole-piece expected revision. Use one gesture identity for a continuous authored movement; individual undo deactivates all its accepted segments while preserving a partner's segments. Redo places the original segments back at their original accepted positions. Live partial strokes and cursor positions belong exclusively to the authenticated ephemeral preview lane.

Shape fields use keys such as `profile.0`, `features.head`, or `ears`, with `expectedFieldRevision`. Dip fields use `part: "base"` or a named part; clearing a part-specific dip uses `color: null`. Stamp colour, trim, shape, size, rotation, and label have independent field revisions. Exact stamp placement (`{part,u,v}` or `null` for a named anchor) is one atomic field; mixed coordinates cannot result from concurrent drags.

`projectKittyDesign` returns field revision keys `shape:<field>`, `dip:<part>`, and `stamp:<stampId>:<field>`. Missing keys read as revision zero. `undo-gesture` and `redo-gesture` require the current target gesture revision, not the document revision. Both advance touched field revisions. Only the authenticated author's editable gestures can be toggled. If an undone stamp creation supports a partner's active stamp edit, the stamp remains as that edit's substrate. Dependent stamp changes that would become invalid are refused; partner work is never erased to make an undo succeed.

Shape-change and shape-undo receipts name `finishActiveStrokes`. The preview lane must finish those affected local strokes, retain their captured mapping, and reset picking against the new shape. Each accepted stroke retains the original sculpture and UV mapping. Existing named surfaces share `kitty-uv-v1`, so changes to their shape retain normalized coordinates. Paint on a removed ear or tail is returned in `recoverablePaint`, with author/gesture/operation identity and old sculpture. It is excluded from the current visible projection and returns when the surface returns. The UI must show this retained-work state. This module never silently deletes or flattens it.

`fire` requires the exact piece `expectedRevision`, freezes its authored projection and recovered paint, and returns a stable `reveal:<operationId>` receipt identity. Finish pending local preview gestures before offering this review. A partner's edit accepted first invalidates the reviewed revision; an old stroke delivered after firing refuses with `PIECE_FIRED`. `reopen` resumes the same piece identity and advances the editing epoch. Later undo or repaint cannot alter an earlier reveal or `snapshotKittyDesignRevision` result.

Archive retains history. Display selection has its own `expectedDisplayRevision` so unrelated painting does not conflict with the shelf choice. Multiple clay pieces may exist in a canonical document; adapt the current single-wheel UI around a selected piece, not by truncating the document into the legacy one-draft shape.

## Bounds and recovery

Each piece retains the existing 400-stroke, 6,000-point, 64-stamp bounds, counting inactive/recoverable work too. History currently permits 20,000 accepted entries and 200 pieces per document; checkpoint JSON is capped at 32 MiB. Reaching a bound refuses new work without erasing history. These are bounded safeguards, not permission to raster-flatten undo information. A future segmented journal must retain every gesture's identity, attribution, active state, and original position.

Checkpoints retain the complete normalized baseline and accepted operations. The restore validator uses a single chronological pass, rejects duplicate/reordered entries, and rechecks every operation precondition. Old stroke authors remain `null`; a legacy `firedBy` value already present is preserved as existing historical data. Unknown historical stroke authors are never inferred from the migration actor.

## Local verification

Fresh verification after the tool-session restart:

- `node node_modules/vitest/vitest.mjs run test/hearthside-collaboration.test.ts test/kitty-studio.test.ts --maxWorkers=1`: 29 tests passed after the final editing-epoch guard (18 collaboration and 11 existing Kitty tests; 1.93 seconds wall, 102 ms tests).
- `node node_modules/typescript/bin/tsc --noEmit --pretty false --strict --noUnusedLocals --noUnusedParameters --noUncheckedIndexedAccess --allowImportingTsExtensions --target ES2022 --module esnext --moduleResolution bundler --skipLibCheck src/hearthside/design.ts test/hearthside-collaboration.test.ts`: passed with no diagnostics after the final epoch guard.
- `pnpm exec` stopped at `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` while attempting an implicit dependency reinstall. Shared dependencies were not reinstalled. Direct local tools were used instead.
- Whole-repository TypeScript validation is blocked by missing dependencies in the reference checkout's existing `node_modules`, including Supabase, PDF.js, Cloudflare types, Agents, and Playwright. This is not a successful full build or release gate.

The collaboration suite exercises overlapping strokes, partner-preserving undo, original-position redo, same-author two-device retries, field conflicts, original-surface recovery, stamp dependencies, firing against pending accepted changes, late pre-fire edits after reopen, checkpoint/restart, legacy preservation, strict decoding, scope isolation, archive/display, and retention limits. It is a reducer suite; it is not authenticated network, physical-device, frame-rate, or live Studio proof. The integration owner must register it in the quick-gate focus map alongside affected existing suites and complete the program's authority/UI acceptance.
