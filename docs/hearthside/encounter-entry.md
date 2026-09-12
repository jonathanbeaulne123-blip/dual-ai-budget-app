# Authenticated encounter entry

The entry connects the authored seasonal encounters to the existing private Vault, the canonical shared command endpoint, Studio design operations and the actual shared-memory review. It never creates a bank, money event, date, task or fired piece.

`EncounterEntry` accepts the current Vault connection, expected identity/environment/household/member, a fresh `readContent(signal)` adapter to `LedgerSyncClient.hearthsideContent`, the active roster, theme, optional encounter ID and these host callbacks:

- `onOpenEncounter(id)` opens the stable encounter route.
- `onOpenPiece(pieceId, designId)` opens the canonical Studio document from the accepted outcome. The client does not submit a locally generated recipe as authority.
- `onMemoryDraft(candidate): Promise<boolean>` opens the real memory editor. Preserve an existing draft with the same ID; return false if another draft is open. Never replace a user's edits with the initial generated candidate.
- `onOpenMemory(id)` opens the existing composition and its publication review.
- `onOpenWardrobe()` opens the actual Studio wardrobe tab.

The source adapter must validate the current source's subject and scope against the Vault connection immediately before invoking `hearthsideContent`. The entry additionally verifies the returned household, current pair and sequence. It uses the imported canonical decoder, so optional memory provenance fields introduced by the integration owner remain intact.

## Recovery and authorship

`EncounterSharedClient` writes one scope-bound request to IndexedDB before HTTP. A same-operation retry and simultaneous same-author tabs retain the request ID. It checks actor, command digest, positive canonical sequence, command kind and an actual empty posted-ID array before clearing the request. Unknown errors and malformed receipts remain uncertain. Corrupt saved records are never sent. Closing a client aborts future work; tokens remain transient.

The Studio bridge sends only `{kind:'encounter.create-piece',id,digest}`. It refreshes and opens the outcome actually accepted by the server. Recovery retries that command and opens the same piece.

Memory IDs are deterministic for household, encounter and kept composition. Private image IDs additionally bind the accepting principal. The actor's first explicitly chosen PNG and draft are saved in a separate private IndexedDB record before upload. Retrying reuses those bytes and IDs. A different rendering for the same composition requires resuming the saved preview; it cannot silently overwrite it. This handles changed display names or a different browser encoder without manufacturing a second memory. The private store permits at most 20 recovery records; original records and upload bytes never enter household metadata or bearer URLs.

Fresh shared keeping and the live private reveal are checked before preparing a memory and again after upload, before the host opens its editor. The candidate includes only the accepting member's recollection. The partner's words appear only inside the jointly reviewed PNG. The PNG remains a private media object until the existing exact-composition MemoryPublication workflow completes its separate paired approval and activation.

After both people keep a canonical memory, a deliberate `encounter.outcome` request links that exact revision. The server still validates the current memory. A withdrawn memory cannot be recreated by retrying its deterministic identity. Private reveal withdrawal prevents a saved image from being resumed, without silently removing separately published memories or pieces. Removing a device recovery copy does not withdraw an already uploaded or published object.

## Integration

Apply `encounter-entry-integration.patch` narrowly to the current root files. It adds `/hearthside/encounters/:id`, seasonal and wardrobe surfaces, the common/conservatory entrance, the existing Vault provider connection, the actual memory editor callback and a direct Studio wardrobe tab. It preserves browser return/focus handling. Root owns the focus map, deployment flags and canonical HTTP/DO handlers.

Root also needs the browser fetch receiver fix already delivered as local commit `6a91d29`: in `HearthsideVaultClient.send`, extract `const request = this.request` and invoke `request(...)`. Calling the native browser fetch function as a client method throws before network dispatch in Chromium. The shared client includes the same correction.

Local dependency snapshot commits are test scaffolding, not the handoff: `73e13d8`, `9109db2`, `2bef2aa`, `0632b99`, `aa995e9`, `b035b2e`, `6a91d29`, `54f9f92`. Do not cherry-pick them wholesale into root. The handoff commit contains only the new entry/client/helpers, focused tests, docs and returned patch.

## Evidence boundary

The browser suite uses two independent authenticated synthetic browser contexts, the real Vault Durable Object with SQLite/private R2, the actual private and shared HTTP clients, and the exact root `LedgerSyncClient.hearthsideContent` method. Its separate synthetic canonical HTTP adapter persists shared state and uses the real encounter transition, canonical design operations and Vault memory evidence checks. It is deliberately named a fixture; it does not replace root's actual LedgerRoom admission/recovery tests.

The proof covers three themes, all seven specified widths, keyboard and axe, private isolation, same-author tabs, reload and lost acknowledgements, current paired memory approval/activation, corrupt receipts and withdrawn reveal recovery. Images are at `/tmp/hearthside-encounter-entry-proof/`. Full integrated App routing, the root patch, hosted authenticated continuity, native/physical acceptance and Production activation remain separate gates. No hosted resources, provider calls, notifications or invitations are activated here.
