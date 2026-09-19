# Trusted Vault audience adapter

This is prepared local implementation. Migration 023 is source only; no schema,
Worker binding, key, production flag or guest invitation is activated by it.

`createVaultPublicationAuthority(env, writer, options)` supplies Vault's policy,
acceptance and reference checks. `writer.accept(scope, reference, authorization)`
must call the canonical LedgerRoom `acceptVaultPublication(scope, reference)` and
return its immutable `VaultAcceptance`. The integration owner supplies that writer
and the authoritative media-reference lookup. The adapter has no local/fabricated
receipt fallback. `authorization` can be ignored by the trusted LedgerRoom writer.

The edge forwards its freshly authenticated token as the fourth internal
`commandFor` argument. Policy and acceptance receive it only for that request.
It is not added to Scope, stored records, references, errors or browser responses.
Preparation resolves fresh principals. Activation checks the exact audience before
canonical acceptance and again after that cross-store await. A changed audience
leaves the accepted reference recoverable with access off. Retry keeps its identity.

## Authenticated control-plane RPC

`ledger_sync_scope` intentionally does not expose the other members' authentication
subjects. The new `hearthside_vault_audience` RPC resolves exact active, bound,
non-revoked `auth_user_id` values. It uses the existing `own_member_id` and live
session checks, including revoked devices and deleted households. It never reads
or returns private content, display names, email addresses, balances or tokens.

A publishable key plus user JWT is insufficient to make a public RPC server-only;
the user can otherwise call that endpoint themselves. The Worker signs a narrow
HMAC attestation bound to the exact JWT hash, actor, household, environment and
short timestamp. The RPC also requires the live user session. Neither credential
works alone. These are ordinary [Supabase key and user identity boundaries](https://supabase.com/docs/guides/getting-started/api-keys);
the dedicated MAC adds the server boundary without a service-role key.

The signature uses Web Crypto HMAC-SHA256 and PostgreSQL's
[pgcrypto HMAC](https://www.postgresql.org/docs/current/pgcrypto.html#PGCRYPTO-GENERAL-HASHING-FUNCS).
JWT binding reads the actual lower-case authorization header from
[PostgREST's transaction request settings](https://postgrest.org/en/stable/references/transactions.html#request-headers-cookies-and-jwt-claims).
The SQL compares every signature byte. Proofs are accepted for 30 seconds with up
to five seconds of future clock skew; replay still requires the same live JWT,
same scope and current membership. The read-only RPC changes no grants or content.

The adapter bounds responses to 16 KiB and requests to eight seconds, refuses
redirects and credential-bearing URLs, checks the response actor/scope/freshness,
and never caches principal bindings or exposes provider error bodies. Browser
prepare/recovery responses use `VaultAuthorReview`, containing member IDs rather
than authentication subjects.

Only selected members receive a letter/capsule/answer. Joint memories require all
current active bound principals, with at least two. Guest publication additionally
requires an injected `guestRecipients` resolver from the distinct guest namespace;
without that grant authority, guest publication is denied. Household membership
does not grant letter access or turn someone into a guest.

## Separate release configuration

Release must review and apply migration 023 after the existing session/cutover
migrations. pgcrypto must reside in `extensions`; a differently placed existing
extension fails explicitly instead of being moved silently.

The private `vault_authority_keys` table is empty after migration. Rows default to
disabled, require a Development environment, 32-byte key, activation time and
expiry. All table privileges are revoked from public, anon and authenticated roles.
Release must separately provision a dedicated random key into that private table
and the Worker secret `HEARTHSIDE_VAULT_AUTHORITY_KEY` (64 lower-case hex characters),
with matching non-secret `HEARTHSIDE_VAULT_AUTHORITY_KEY_ID`. Key generation,
provisioning, rotation and log-redaction verification are not performed here.
Never put these values in VITE, household records, Vault objects or source control.
Never use a Supabase secret/service-role key as a substitute.

## Evidence and open gates

The SQL suite executes the complete migration in PGlite with real pgcrypto and
the repository's canonical session helper definitions. It checks empty/disabled/
expired keys, user-JWT-only denial, anonymous/table denial, modified scope/actor/
signature/token hash/time, unbound/other-household omission, member/device/session
revocation and deleted-household denial. Adapter tests cover cryptographic parity,
fresh audience changes, joint approval, isolated guest grants, bounded responses,
safe errors and canonical receipt delegation. Service tests check transient auth
forwarding and the acceptance/revocation race.

Hosted PostgREST header behavior, provisioned key rotation, authenticated devices,
the integrated canonical receipt writer and guest grant resolver require separate
integration/Release proof. No local test substitutes for those gates.
