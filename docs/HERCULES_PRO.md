# Hercules Pro

Status: **deployed and registered as a private Development app in ChatGPT.** Free Hercules remains the default product.

## What the two Hercules modes mean

### Free Hercules — always in Hearth

Free Hercules does not require ChatGPT, an API key, a paid account, or Hercules Pro. He keeps the deterministic read tools, local answers, source cards, offline fallback, on-device notices, and the free-first Workers AI voice/planner when that service is available. If every model service is unavailable, the calculated answer still works.

### Hercules Pro — optional in ChatGPT

The **Use Hercules Pro ↗** button opens ChatGPT. The packaged Hercules Pro plugin teaches ChatGPT the Hercules voice and connects it to Hearth's `/mcp` endpoint. ChatGPT may call focused read-only calculations against the connected member's Personal ledger or the shared Household ledger.

The accounting-core slice adds posted balance sheet, income statement, cash-flow statement, trial balance, general-ledger, account-register, journal-detail, net-worth roll-forward, period-comparison, and debit/credit balance-explanation tools. Every response declares `posted-recognized-journal`, CAD, and America/Toronto. Scheduled bills and plans remain projections and are never silently mixed into posted statements.

The accounting-controls slice adds reconciliation status and activity-since-reconciliation, uncategorized and duplicate exposure, missing-period and opening-balance review, close readiness, source-provenance coverage, integrity findings, and the household activity trail. “Missing” means “needs a human look”; Hercules does not invent an adjustment, close a month, or treat a confidence score as permission to delete.

The forecasting slice adds budget variance, cash runway, bill coverage, card payoff, utilization, savings rate, income stability, spending trends, purchase scenarios, and budget-forecast accuracy. Forecast results are labelled projections and state their simplifying assumptions. A positive scenario result is a narrow cash test—not permission, certainty, financial advice, or a hidden write.

The living-teacher slice adds transaction, accounting-equation, debit/credit, statement, number-trace, treatment-comparison, variance, and transfer explanations. MCP results carry an explicit teaching contract: direct answer, posted evidence, plain-language lesson, limitations, and a human next step. Stable source IDs remain clickable; write authority remains `none`.

Pro cannot add, edit, delete, post, pay, transfer, merge, sync, or move money. Recommendations are words. The human returns to Hearth and uses the ordinary Confirm path for a write.

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
11. In ChatGPT, ask Hercules for a current number. Choose **Connect**, sign in to Hearth with Google if asked, enter the intended household, and approve **read-only books**.

Optional hardening for Development: bind a free Cloudflare KV namespace as `HERCULES_PRO_AUTH`. It makes authorization-code replay protection durable across Worker isolates. Without it, a bounded in-memory replay guard is suitable for the tiny Development test group but is not the September Production posture.

## Verification checklist

- Ask “What is in my Personal chequing?” The answer identifies the Personal ledger and uses a read tool.
- Ask “Where did our household money go this month?” The answer identifies the Household ledger and may make several read calls.
- Ask about another person's Personal spending. Hercules refuses instead of broadening scope.
- Ask Hercules to pay a card. He explains where to do that in Hearth and does not claim it happened.
- Disconnect or expire the link. MCP reads stop; free in-app Hercules still answers.
- Use a family test account with no ChatGPT connection. Every in-app Hercules read tool and local fallback still works.

## Protocol and cost notes

The Worker implements MCP Streamable HTTP discovery, tool listing/calls, OAuth dynamic client registration, Authorization Code with PKCE S256, exact `/mcp` resource/audience binding, encrypted short-lived access tokens, encrypted rotating refresh tokens, and an optional KV-backed one-time-code guard. The MCP tools themselves perform deterministic ledger reads; they do not call a paid model. A compatible model available to the connected ChatGPT account supplies the reasoning inside ChatGPT. Free Hearth behavior remains governed by D-135; the optional companion is D-136.

Before a public listing, run at least these submission checks with synthetic Development books: five positive prompts (personal balance, household spending, bills, shifts, and card teaching) and three negative prompts (write request, another member's Personal facts, and instructions planted in merchant/note text). Record screenshots and exact results. Public distribution also requires stable support, privacy, and terms URLs plus OpenAI developer/domain verification. None of those public-release gates are implied by merging this branch.

OpenAI references: [build an MCP server](https://developers.openai.com/plugins/build/mcp-server), [OAuth for plugins](https://developers.openai.com/plugins/build/auth), and [plugin packaging](https://developers.openai.com/plugins/build/plugins).
