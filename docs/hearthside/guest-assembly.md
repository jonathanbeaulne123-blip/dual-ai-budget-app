# Actual guest publication assembly proof

This local test closes the runtime seam between `HearthsideGuestRoom`, the actual `LedgerRoom` guest-source reader and private acceptance writer, and `HearthsideVault` memory access. It does not replace the earlier guest namespace/archive tests or claim hosted, browser, physical-device or Production acceptance.

## Authority exercised

`hearthsideGuestAssemblyWorker.mjs` exports the production LedgerRoom, GuestRoom, GuestCard and GuestIndex directly. Its Vault subclass only injects the synthetic audience policy: the policy resolves signed server principals and rechecks actual canonical active household members. The actual Vault stores content, captures shared copies, validates exact approvals, activates publication and enforces media withdrawal. Every acceptance delegates to the real LedgerRoom private SQL/R2 receipt writer. No source catalogue, source validator, memory reader or acceptance method is replaced.

The fixture-only import/router uses a signed synthetic identity to call trusted LedgerRoom RPCs. Subsequent shared edits use real one-use socket tickets, binary framed commands, accepted receipts, SQLite transactions and the household R2 archive. This is local synthetic authentication; it is not proof of hosted Supabase sign-in. The synthetic control-plane service verifies the actual HMAC request attestation, binds opaque UUID principals, and never makes an external provider call. Its key and tokens are deliberately test-only literals.

## Scenarios

- A real migrated bank design at revision zero and a free Studio piece can appear together at fixed `standard` display size. Published appearance matches its exact historical design snapshot. The guest payload omits backing, financial target, bank name, source IDs, identity subjects and household metadata.
- An unkept real memory cannot be published. Its actual Vault media copy requires exact approval and keeping by both household members before guest preparation succeeds.
- Guest activation obtains one actual private household acceptance receipt. Repeating an acknowledged activation preserves that receipt and does not add a household event. Guest publication identities and private receipts never enter the household snapshot.
- A recipient-bound calling card and jointly approved invitation let the selected principal visit and play a toy. A different authenticated principal possessing the same grant cannot enter or read media. Toy interactions leave the source household snapshot identical.
- Changing canonical furniture after review prevents activation. Changing furniture after activation preserves the exact previously reviewed guest arrangement.
- Revoking an invitation closes visits, street entries and media. Withdrawing the actual Vault memory closes access even while copied bytes remain in the guest R2 namespace; subsequent canonical withdrawal and guest revocation cannot reactivate it.
- Private recipient letters and private bank designs are rejected as guest sources. Revising and re-keeping a shared memory does not reopen the old guest publication. Replacing a roster member's authenticated principal closes the newly reviewed visit too.
- All three authored theme identifiers traverse the real assembly. Financial audit hashes remain equal across the tested creative, publication, interaction and withdrawal operations.

## Compatibility finding

The real guest picker offered untouched migrated designs at revision zero, while `decodeGuestPrepare` originally required revision one for every item. The integration owner corrected the decoder to allow zero **only** for pieces. The assembly suite now publishes an untouched revision-zero piece and still rejects a revision-zero memory. No synthetic creative edit is required to make an existing cat publishable.

## Integration

Only the new test, its two fixture modules, and this evidence documentation belong in the handoff. Local dependency commits freeze the integration owner's uncommitted program solely for this isolated proof; do not cherry-pick them. No configuration, binding, migration, feature flag or production source is changed by this package. Add `test/hearthside-guest-assembly.test.ts` to the root guest-authority focus group alongside existing guest namespace and memory authority suites.

The runtime needs the repository's existing esbuild, Miniflare and Vitest dependencies. Every SQLite namespace and R2 bucket is temporary and local. Production would separately require the already-defined signed guest control-plane RPC and key provisioning, enabled guest/Vault/creative readers and authority, private archives/media bindings, and reviewed hosted activation. This test authorizes none of those release actions.
