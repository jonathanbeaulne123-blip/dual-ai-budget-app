# Hercules rate KV binding (D-147)

D-121 meters `/hercules/chat` and document scan at **60 requests per client IP per UTC day**. Isolate memory is the fallback when KV is unbound — it is **not** durable across Worker isolates and is **not** a reliable production hard cap.

This packet does **not** put placeholder KV ids into `wrangler.jsonc`. Invalid ids would break the live `main` → `wrangler deploy` job. Jonathan creates the namespace, pastes real ids, then deploys.

## Jonathan steps (explicit approval + Cloudflare login)

1. From a machine with Cloudflare credentials for account `7dfdfbba3053d8b857cbc359e0761c00`:

```bash
pnpm exec wrangler kv namespace create HERCULES_RATE
pnpm exec wrangler kv namespace create HERCULES_RATE --preview
```

2. Add this block to `wrangler.jsonc` (real ids only):

```jsonc
"kv_namespaces": [
  {
    "binding": "HERCULES_RATE",
    "id": "<id from create>",
    "preview_id": "<id from create --preview>"
  }
]
```

3. Commit the real ids (namespace identifiers, not secrets).
4. Deploy with Jonathan's explicit approval (`wrangler deploy` or Actions on `main`).
5. Smoke: confirm Worker env shows `HERCULES_RATE` bound; exercise chat until `429`.

## Concurrent failure semantics (proven in tests)

| Backend | Cross-isolate durability | Concurrent get→put |
|---|---|---|
| Isolate memory | No — each isolate has its own counter | Parallel awaits in one isolate can briefly exceed 60 before writes settle |
| KV (`HERCULES_RATE`) | Yes — shared across isolates | Still eventually consistent; two concurrent reads of `59` can both write `60`, briefly allowing 61. Not a perfect atomic increment. |
| Future Durable Object | Yes + single-threaded | True hard cap (not built in this packet) |

Code: `workers/herculesGuard.js` `checkChatRateLimit`. Tests: `test/hercules-worker.test.ts` (KV bound, memory fallback, concurrent exceed proof, wrangler binding contract).

## Rollback

Remove the `kv_namespaces` entry; the Worker falls back to isolate memory. Missing KV must never bypass the limit (D-121).
