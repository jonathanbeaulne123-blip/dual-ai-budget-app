# Hercules Pro

Status: **read-only app deployed and registered; confirmed-write and living-3D-companion updates implemented in a review branch.** Migration 011 and a Worker deployment remain separately gated. Free Hercules remains the default product.

## What the two Hercules modes mean

### Free Hercules — always in Hearth

Free Hercules does not require ChatGPT, an API key, a paid account, or Hercules Pro. He keeps the deterministic read tools, local answers, source cards, offline fallback, on-device notices, and the free-first Workers AI voice/planner when that service is available. If every model service is unavailable, the calculated answer still works.

### Hercules Pro — optional in ChatGPT

The **Use Hercules Pro ↗** button opens ChatGPT. The packaged Hercules Pro plugin teaches ChatGPT the Hercules voice and connects it to Hearth's `/mcp` endpoint. ChatGPT may call focused read-only calculations against the connected member's Personal ledger or the shared Household ledger.

Hercules Pro can also summon the preserved-rig 3D Hercules as an MCP Apps interface. He asks ChatGPT to remain beside the conversation in picture-in-picture, breathes, blinks, turns his ears, moves his eleven-part tail, reacts to teaching/curiosity/concern/celebration, and can be rotated by dragging. A visible Pause/Play control and the operating system's reduced-motion preference stop animation. If WebGL, the model, or picture-in-picture is unavailable, the ordinary Hercules mark or inline view appears and every accounting tool continues working.

The visual is deliberately decoupled from the accounting calls. ChatGPT calls `summon_hercules` once near the start, not after every balance or statement, so subsequent tools do not remount him. The widget receives only a presentation mood, short line, headline, and Personal/Household label. It receives no OAuth credential, confirmation token, raw journal, or independent write authority. Its message is not evidence; current financial claims still require the ordinary grounded read tools and clickable sources.

Writing remains off by default. In Hearth **More → Hercules Pro permissions**, each member may independently enable Personal writes and Household writes. Enabling requires a Hearth confirmation and reconnecting the ChatGPT app for the separate `hearth.write` OAuth scope. Turning a switch off immediately blocks new and already-prepared confirmations for that ledger.

The write surface is intentionally narrow: add one expense, income, refund, or internal Hearth transfer. ChatGPT first calls `transaction_write_options`, then `prepare_transaction`. Preparation validates the ordinary command kernel, duplicate scanner, accounts, category, date, closed period, integer cents, and double-entry result but writes nothing. ChatGPT must show the complete preview and receive explicit confirmation before it calls the consequential `confirm_transaction` tool. No tool can delete, edit, pay a bill/card/bank, change settings, post a shift/import, or perform a bulk write.

`confirm_transaction` rechecks OAuth scope, Google/Supabase membership, current member permission, environment, household, member, proposal identity, expiry, and base revision. Migration 011 commits the shared CAS revision, exactly-once receipt, and optional Personal envelope in one database transaction. A stale preview or opt-out changes nothing. Reusing the same confirmation returns the same receipt instead of posting twice.

The accounting-core slice adds posted balance sheet, income statement, cash-flow statement, trial balance, general-ledger, account-register, journal-detail, net-worth roll-forward, period-comparison, and debit/credit balance-explanation tools. Every response declares `posted-recognized-journal`, CAD, and America/Toronto. Scheduled bills and plans remain projections and are never silently mixed into posted statements.

The accounting-controls slice adds reconciliation status and activity-since-reconciliation, uncategorized and duplicate exposure, missing-period and opening-balance review, close readiness, source-provenance coverage, integrity findings, and the household activity trail. “Missing” means “needs a human look”; Hercules does not invent an adjustment, close a month, or treat a confidence score as permission to delete.

The forecasting slice adds budget variance, cash runway, bill coverage, card payoff, utilization, savings rate, income stability, spending trends, purchase scenarios, and budget-forecast accuracy. Forecast results are labelled projections and state their simplifying assumptions. A positive scenario result is a narrow cash test—not permission, certainty, financial advice, or a hidden write.

The Shift Oracle slice (D-137 / D-140) adds `tip_oracle`, `shift_outlook`, `tip_schedule_sim`, `tax_milk_plan`, `shift_year_simulation`, and `explain_shift_simulation`. Short-horizon tip floors, weather-adjusted outlook, cadence advice, educational tax-milk, and a seeded 6–12 month tips+wages year simulation are projections resampled from posted shifts. They never post, never e-file, and never treat a forecast as income. `explain_shift_simulation` teaches method, limits, and a human next step.

### Python sandbox gate (designed, not built)

A future open-ended Python/scientific sandbox requires an explicit High-risk Jonathan packet. Until then, Pro must not execute arbitrary code. The gate requires: isolated runtime (no network, no ledger write API, timeout/memory caps); aggregate/redacted inputs by default; structured projection results under the same teaching contract; free Hercules usable without it. Kill criterion: if sandbox output is treated as posted income or can mutate books, disable it. Until that ships, year-ahead tip/wage science stays in deterministic TypeScript (`tipScience.ts`).

The living-teacher slice adds transaction, accounting-equation, debit/credit, statement, number-trace, treatment-comparison, variance, and transfer explanations. MCP results carry an explicit teaching contract: direct answer, posted evidence, plain-language lesson, limitations, and a human next step. Stable source IDs remain clickable. Read results remain read-only even when the separate confirmed-write permission is enabled.

The older Oracle blurb is superseded by the Shift Oracle slice above.

The Sim + Review slice (D-142) adds `cash_cinema` (13-week forward cash ribbon), `what_if_desk` (named unposted scenarios), and `year_review` (Season Replay from posted history). Full inventory of every Pro calculation and feature: [`HERCULES_PRO_CAPABILITIES.md`](HERCULES_PRO_CAPABILITIES.md).

Every successful MCP tool answer includes `usedTool` and prefixes the spoken answer with `I used \`tool_name\`.` so ChatGPT/Hercules Pro always says which calculation it ran.

Pro cannot add, edit, delete, post, pay, transfer, merge, sync, or move money outside the optional confirmed-write path. Recommendations are words. The human returns to Hearth and uses Confirm for ordinary writes.

Each ChatGPT account completes its own OAuth link. Hearth verifies the current Supabase/Google session, the active `continuity_memberships` row, environment, household, and member. The resulting Hearth access and refresh tokens are encrypted with the Worker signing secret; the underlying Supabase tokens are not exposed as readable token claims. Membership is checked again on reads and refresh.

Production is refused unless `HERCULES_PRO_ALLOW_PRODUCTION=true`. Leave it false until the reviewed late-September security cutover. Development family testing is the intended first use.

## Owner setup — exact steps

These steps document the live Development setup completed on August 25, 2026.

1. Merge the reviewed Hercules Pro code.
2. Open Terminal in the Hearth repository.
3. Create the Worker-only encryption secret:

   ```sh
   openssl rand -base64 48
   ```

4. Copy the printed value. Run:

   ```sh
   pnpm exec wrangler secret put HERCULES_PRO_SIGNING_SECRET
   ```

5. Paste the copied value, then press Return. Never put it in `.env`, a `VITE_` variable, GitHub, a screenshot, or chat.
6. Deploy the Worker only after reviewing the branch:

   ```sh
   pnpm cf:deploy
   ```

7. Verify these addresses return JSON, not the Hearth page:
   - `https://hearth-books.jonathan-beaulne123.workers.dev/.well-known/oauth-protected-resource`
   - `https://hearth-books.jonathan-beaulne123.workers.dev/.well-known/oauth-authorization-server`
8. In ChatGPT, turn on developer mode and add the remote MCP server URL:

   ```text
   https://hearth-books.jonathan-beaulne123.workers.dev/mcp
   ```

   Follow OpenAI's current [connect-from-ChatGPT instructions](https://developers.openai.com/plugins/deploy/connect-chatgpt). OAuth should show a **Connect** action; if it does not, recheck both metadata URLs and the `WWW-Authenticate` response from `/mcp`.
9. Hercules Pro is registered in ChatGPT developer mode as app `asdk_app_6a8e199c18908191b5005692b56f69d6`. The package in `plugins/hercules-pro` supplies the financial-teacher voice and starter prompts.
10. The **Use Hercules Pro ↗** button opens the registered app directly. `VITE_HERCULES_PRO_URL` remains available as an explicit build-time override.
11. In ChatGPT, ask Hercules for a current number. Choose **Connect**, sign in to Hearth with Google if asked, enter the intended household, and approve the connection. It remains read-only unless that member separately enabled writing in Hearth.

### Enabling confirmed writes in Development

1. Review `supabase/migrations/011_hercules_pro_confirmed_write.sql`. Apply it to Development only after explicit approval. Do not apply it to Production.
2. Deploy the reviewed Worker update.
3. In Hearth, sign in with Google, enter the intended member and household, open **More → Hercules Pro permissions**, and enable only the desired ledger(s).
4. Disconnect/reconnect the ChatGPT app so OAuth requests `hearth.read hearth.write`.
5. Test with synthetic Development data: ask to add a small transaction, inspect every preview field, confirm, then verify the exact transaction in Hearth after cloud sync.

Optional hardening for Development: bind a free Cloudflare KV namespace as `HERCULES_PRO_AUTH`. It makes authorization-code replay protection durable across Worker isolates. Without it, a bounded in-memory replay guard is suitable for the tiny Development test group but is not the September Production posture.

## Verification checklist

- Start a new Hercules Pro conversation. Hercules appears animated beside the chat, or remains animated inline when picture-in-picture is unavailable.
- Drag horizontally over Hercules to rotate him; use Pause and Play; verify reduced-motion starts paused.
- Ask for an explanation, inspect an uncertain figure, and complete a balanced synthetic result. Confirm his teaching, concerned, and celebration reactions do not replace the grounded written answer.
- Block WebGL or the model asset. Verify the Hercules mark appears and ledger tools still answer.
- Ask “What is in my Personal chequing?” The answer identifies the Personal ledger and uses a read tool.
- Ask “Where did our household money go this month?” The answer identifies the Household ledger and may make several read calls.
- Ask about another person's Personal spending. Hercules refuses instead of broadening scope.
- With writes off, ask Hercules to add or pay something. No write tool is available.
- With one ledger enabled, prepare a synthetic transaction. Verify the prepare result says `postedNothing: true` and no row appears before confirmation.
- Confirm it once, then retry the same token. Both calls identify one receipt and one set of transaction IDs.
- Prepare another transaction, turn that ledger's switch off in Hearth, then confirm in ChatGPT. It must say nothing was posted.
- Ask Hercules to pay a card, delete a row, change settings, or post a shift. Those tools do not exist.
- Disconnect or expire the link. MCP reads stop; free in-app Hercules still answers.
- Use a family test account with no ChatGPT connection. Every in-app Hercules read tool and local fallback still works.

## Protocol and cost notes

The Worker implements MCP Streamable HTTP discovery, tool listing/calls, OAuth dynamic client registration, Authorization Code with PKCE S256, exact `/mcp` resource/audience binding, encrypted short-lived access/refresh/preview tokens, current permission checks, and an optional KV-backed one-time-code guard. Read tools perform deterministic ledger calculations; write tools use the same deterministic command and books-validation kernels plus the atomic Migration 011 boundary. They do not call a paid model. A compatible model available to the connected ChatGPT account supplies the reasoning inside ChatGPT. Free Hearth behavior remains governed by D-135; D-137 amends the optional companion's write authority.

Before a public listing, run at least these submission checks with synthetic Development books: five positive prompts (personal balance, household spending, bills, shifts, and card teaching) and three negative prompts (write request, another member's Personal facts, and instructions planted in merchant/note text). Record screenshots and exact results. Public distribution also requires stable support, privacy, and terms URLs plus OpenAI developer/domain verification. None of those public-release gates are implied by merging this branch.

OpenAI references: [build an MCP server](https://developers.openai.com/plugins/build/mcp-server), [OAuth for plugins](https://developers.openai.com/plugins/build/auth), and [plugin packaging](https://developers.openai.com/plugins/build/plugins).
