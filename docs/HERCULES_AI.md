# Hercules AI

Hercules is the household's resident data scientist who never touches the money. This file is the living spec for that layer (D-057–D-060, D-133/D-135). Companion how-to still lives in [HERCULES.md](HERCULES.md). Laws: [DECISIONS.md](DECISIONS.md).

## Research taken

- **Actual Budget / Firefly III.** Rule-based categorisation and scheduled-transaction inference. A `GROUP BY` on a few hundred rows beats an LLM. Habit detection is a second lens on `detectRhythms`, not a second miner.
- **Copilot Money / Monarch.** Anomaly *surfacing* is useful. Auto-posting a discovered bill is not. Hercules may interrupt once; he may not write.
- **Lunch Money rules.** A frozen template the household owns is the right object for “we buy this coffee.” That is a preset, not a recurrence.
- **Structured retrieval.** Permission to send the ledger is not a reason to dump it. Last ~36 rows, a month rollup, open claims, upcoming visits, and on-device notices. Chat history still never leaves the phone.
- **Treat user/third-party text as data.** Merchant names, spouse notes, and Google event titles are attacker-influenced. The Worker wraps them as `HOUSEHOLD DATA` and tells the model to ignore instruction-like text inside them.
- **Finch / Pokémon Sleep.** The real act is the game. Here the act is posting, confirming, and tapping Save. The cat is the delivery mechanism, not a second ledger.

## Research refused

- **Cleo shame.** A vendor model still cannot invent or rank who spent more; `sanitizeHerculesReply` kills that sentence. D-132 household questions about a named member's shared posts are answered on-device from a scoped journal comparison. Partner-personal rows remain forbidden.
- **Mint bill-discovery-as-truth.** A detected habit is a proposal. Recurring bills stay on Calendar. Coffee is noisy for bills on purpose; habits are allowed to see it.
- **Duolingo guilt / Tamagotchi death.** Dismissing a notice hides it. He does not starve.
- **Clippy timing.** The paperclip was not the bug. Unsolicited timing was. Preset proposals are **not** queued on the 16s idle mutter. One dismissible card. Inert during Add. If it blocks milk, it is wrong.
- **Sending the whole journal every question.** `test/scale.test.ts` is 12 months × 200 txs. Retrieval is the design, not a concession.
- **Model-side tool-calling that writes.** Tools stay on the phone. The model cannot invent notice keys. The tap uses those ids only (`acceptPresetNotice`, same shape as `acceptVisitGoal`).
- **Bank aggregation.** D-039 stands. No Flinks, Plaid, Interac, or issued cards until Auth smoke and October Production readiness are complete. Deny-by-default RLS 006 is applied.

## Architecture

**On-device science, model voice.**

The phone computes arithmetic, clustering, cadence, anomaly, preset/habit detection, quiet reasoning, and grounded CAD. It recomputes on open and after a post. That is a cheap GROUP BY, not a nightly job — phones are not a reliable scheduler — and it does **not** ride `useFurniture`'s 100ms interval.

The model does language: framing as a cat, which of several true notices is worth a sentence. It does **not** create proposal objects. Notices have ids computed on the phone. Accept uses those ids only.

### Brain v2 Slice 1 — typed read tools (D-133)

For an unmatched financial question, the Worker may choose a plan of at most four calls from a fixed read-only catalog. The Worker chooses names and bounded arguments; the phone executes the calls against the active member/view projection. No journal rows or account balances are sent to the planner, and the Worker never executes a tool.

Catalog: `account_balance`, `find_transactions`, `spending_summary`, `income_summary`, `compare_spending`, `bills_due`, `shift_summary`, `goal_progress`, `money_owed`, `cash_position`, `budget_status`, `category_breakdown`, `credit_card_status`, `net_worth`, `audit_health`, and `duplicate_review`.

Hercules Pro's accounting-core extension also exposes focused posted-journal statements and tracing: `balance_sheet`, `income_statement`, `cash_flow_statement`, `trial_balance`, `general_ledger`, `account_activity`, `journal_entry_detail`, `changes_in_net_worth`, `period_comparison`, and `explain_balance`. Those tools declare their accounting basis, currency, and timezone; they do not turn budgets or scheduled items into posted facts.

D-137 optionally adds three separate Pro contracts without changing the free Brain catalog: `transaction_write_options` is read-only; `prepare_transaction` validates and seals one exact expense/income/refund/internal-transfer preview with zero mutation; `confirm_transaction` is consequential and available only with current member opt-in plus `hearth.write`. ChatGPT must display the full preview and receive explicit confirmation between prepare and confirm. The server rechecks membership, permission, expiry, exact identity, revision, duplicate evidence, and balanced books. Migration 011 atomically stores the shared receipt and optional Personal row; no SQL fallback or broader model command exists. Production remains disabled.

The boundary is deliberately narrow:

- unknown calls and unknown arguments are discarded;
- dates are validated and limits/horizons are clamped;
- a plan contains at most four valid calls;
- the catalog exposes no SQL, code execution, mutation, Confirm, or generic query tool;
- every calculation begins from `householdForHerculesContext`, so Household reads shared/`both` facts and Personal reads that member's personal/`both` facts only;
- a Personal request for another member refuses without widening scope;
- every displayed amount is a typed `HerculesNumberSource` card that routes to the supplying account, transaction, category, member, recurrence, shift, goal, or claim surface;
- a missing/failed planner falls through to the existing guarded chat/local answer. Off-topic cat talk does not wait for the planner.

Planning and ordinary voice now share the D-188 order: configured Gemini → configured Groq → opted-in OpenAI → Workers AI. Plans use constrained JSON; all plan output is reduced to the fixed read-only catalog before the phone executes anything. OpenAI remains available only when `HERCULES_ALLOW_PAID_PROVIDERS=true`; the checked-in default is `false`, and Anthropic is no longer a planner or ordinary-chat hop. Every voice attempt receives the same credential-free full synthetic Development context plus the grounded tool result, and all provider output is sanitized again on the Worker and again on the phone. This is model interpretation backed by deterministic calculation and source cards, not model write authority.

### Full synthetic brain, tool calculations, and failover (D-135 / D-184 / D-188)

The free route tries Cloudflare's free-plan eligible `@cf/google/gemma-4-26b-a4b-it`, then the smaller `@cf/meta/llama-3.1-8b-instruct`. The same binding now attempts selected receipt/bill/statement vision before any paid vendor. The Worker never calls OpenAI or Anthropic merely because an old secret happens to exist.

Every external chat or planning hop remains inert unless the deployment explicitly sets both `HERCULES_ALLOW_EXTERNAL_PROVIDERS=true` and `HERCULES_EXTERNAL_DATA_CLASSIFICATION=synthetic`; keys alone do not activate them. Full context additionally requires the server-owned `HERCULES_ALLOW_FULL_SYNTHETIC_CONTEXT=true` flag and a normal client request marked `environment: development`. This is a deployer attestation backed by Jonathan's explicit authorization for full ordinary Development context in this synthetic testing environment, not cryptographic content detection; a client label alone cannot activate it. The phone includes the full credential-free synthetic snapshot for Development only. Production, authentication/sync fields, credential-shaped keys, command receipts, and provider identity keys stay out. With that gate open, a configured `GEMINI_API_KEY` activates Gemini first and configured `GROQ_API_KEY` activates Groq second. OpenAI remains third and still additionally requires both its secret and `HERCULES_ALLOW_PAID_PROVIDERS=true`; the Workers AI pair remains the final server fallback. Third-party fetches use independent failure deadlines and the chain never races providers.

Deterministic tools are calculators and source trails for questions with many variables; they no longer replace the conversational brain. After tools answer, the same Gemini-first chain interprets the result in Hercules's voice using the full synthetic Development context. The model cannot replace typed figures or source links. If planning or voice is unavailable, an obvious bill question still gets a deterministic `bills_due` plan and the local grounded result survives. Gemini uses high thinking with a 16,384-token output allowance; GPT-OSS uses high reasoning with 8,192 completion tokens. Those remove the former tiny app budgets while leaving room inside free-tier rate limits; they are not a promise to bypass provider context, rate, quota, or safety limits.

### Shift Oracle (D-137)

Tipped-income science lives on-device in `tipScience.ts` and is exposed as read tools shared by free Hercules and Hercules Pro: `tip_oracle` (seeded Monte Carlo p10/p50/p90 + dry-streak reserve), `shift_outlook` (weekday × meal tip range with optional weather glass), `tip_schedule_sim` (cadence advice: protect-floor vs chase-spike), `tax_milk_plan` (educational tax-milk + peak smoothing buffer), `shift_year_simulation` (6–12 month tips+wages Monte Carlo), and `explain_shift_simulation` (method, limits, next step). All facts are projection-labelled. No Python sandbox yet (D-140 gate). No e-file. Kill criterion: rip the Oracle if a projection is treated as posted income or posts without Confirm.

### Sim + Review packs (D-142)

On-device `simReview.ts` adds three shared read tools: `cash_cinema` (13-week tip/wage/bill/card cash ribbon), `what_if_desk` (named unposted scenarios), and `year_review` (Season Replay from posted tips and journal). Hercules Pro MCP answers announce `usedTool` and prefix `I used \`tool_name\`.` Full inventory: [`HERCULES_PRO_CAPABILITIES.md`](HERCULES_PRO_CAPABILITIES.md).

Cloudflare documents a [10,000-neuron daily Workers AI free allocation](https://developers.cloudflare.com/workers-ai/platform/pricing/) and at least [100,000 Worker requests per day on Free](https://developers.cloudflare.com/workers/platform/limits/). This household's expected two users and a few daily questions are intentionally far below those ceilings. On a Workers Free plan, exceeding the AI allocation fails with a limit error instead of billing; paid-provider fallback still stays disabled. A Cloudflare account upgrade changes Cloudflare's own overage behavior, so the deployment owner must keep the usage dashboard visible even though this workload should remain tiny.

**When he thinks.** On open and after a post. Offline, notices still work; the model is flavor and fallback (`localHerculesChat`).

**Interruption budget.** One proposal card, dismissible, inert during `adding`. Only a `habit-preset` notice earns the shoulder-tap. Claim aging, visit drift, and extra habits sit on the desk / Ask (“what did you notice?”). Dismissals persist on `calendar.dismissedNoticeKeys` and union-merge like rhythms.

**Memory.** Notices are recomputed. Dismissals persist. Accepted presets persist as catalog rows and merge like recurrences (`updatedAt` + `mergeRecords`). Chat/memories stay in `kitchen.hercules` (D-049).

**Grounding.** Every `$` in a model reply must appear in GROUNDED JOURNAL (spoken / lesson / fact). Briefing totals, notices, and the ledger excerpt are language context, not an interchangeable FIGURES allowlist (D-112). Unknown figures fall back to the grounded line. Prompt echoes (`GROUNDED JOURNAL`, `FIGURES …`, spoken:/lesson:/fact: labels) also fall back. A Visa question answered with only a Mastercard figure falls back. `sanitizeHerculesReply` is the outbound seam on the phone and on the Worker.

**Delayed replies.** The phone binds each model call to a local request id plus environment, household id, and member id (D-116). If any value changes before the answer returns, the old answer is discarded and is not written to `kitchen.hercules`. The newly active ledger's own chat replaces the old busy state.

**Name collision.** `health.ts` already exports `Finding`. This layer uses `HerculesNotice`.

## Quiet appointments (D-060)

`sensitivity: "quiet"` means title and practitioner never reach a third-party model (D-054). Closing the storage leak: `postVisit` no longer copies a quiet title onto the expense note, place, or claim label. It stores `appointmentPublicTitle(..., "hercules")` (“the Tuesday visit”) and an empty place. An explicit household-typed note is stored if they typed one, and still redacted at the payload boundary.

Defense in depth: `redact`/`scrubQuietText` strips quiet titles, practitioners, and places from the model payload, including matching transaction notes and claim labels.

## Injection posture (D-059)

- LEDGER / NOTES / merchant strings are **untrusted DATA**. The Worker says so.
- ON-DEVICE NOTICES are phone-computed. The model cannot invent keys or CAD.
- Inbound clip + outbound `sanitizeHerculesReply` + figure clamp.
- Chat history still never ships.
- Memory labels still strip amounts to `CAD` so a notebook cannot become a second ledger.

D-049's thin payload (aggregates + one 40-char fact + 12 stripped labels) was right for a chat toy. It is lifted for a data scientist. The lift is retrieval, not a dump.

## Presets (D-058)

A preset is a **household catalog row**, shared across phones: type, amountCents (`0` = pad fills), account, subcategory, note, place, splits, visibility, sortOrder, origin `manual | detected`, active, timestamps.

Detector: ≥4 txs in the last ~62 days, amount CV ≤ 0.08, cadence not weekly/biweekly/monthly **or** interval CV > 0.35. Skip visit-sourced rows. Skip if a recurrence or preset already matches. Coffee is allowed here; bills still skip `NOISY_SUBCATEGORIES`.

Key: `preset:${type}:${subcategoryId}:${normalizedNote}:${amountCents}`.

Unsolicited bubble: **save as preset**, never auto-post today's coffee. `acceptPresetNotice` copies `acceptVisitGoal`. Posting from a chip still goes through Confirm. Duplicate confirm still fires (same amount within five days is required, not a bug).

Hand-create from Add: “Save as preset” writes the catalog, not money. Forget archives the row.

## Spouse script (Development demo)

1. Open Hearth on Development. Reload demo if the kitchen is empty.
2. Tap Hercules. He should offer **Save as preset** for `$2.25 · Tim Hortons` (eight seeded rows this month). Do not tap yet.
3. Open Add. Milk still posts in one breath. He loafs. The proposal is inert.
4. Close Add. Tap **Save as preset**. Confirm. No new transaction. A Tim Hortons chip appears on Add.
5. Open Add, tap the chip, Post. Duplicate confirm should appear (same $2.25 within five days). Add anyway or cancel — either way, Confirm is what writes.
6. Appointments → the quiet therapy row. Calendar cards still show the typed title. Ask Hercules about it: he says “the Tuesday visit.” He does not say the practitioner.
7. Type `what did you notice?` He answers from on-device notices. Typed unmatched talk may hit the Worker; quiet titles stay out of that payload.
8. Dismiss a notice with **Not now**. Reload. It should not come back.
9. Ask `How much did we spend on groceries this month?`, `Show coffee charges over $5`, `What is due in the next two weeks?`, `How are the jars doing?`, `Are we ahead of budget?`, `How healthy are the books?`, `What is our net worth?`, and `Do any duplicates need review?`. Hercules may combine several read tools, but each shown amount must be tappable and must open its actual source.
10. Switch to Bianca's Personal ledger and ask for Jonathan's spending. Hercules must refuse with no Jonathan CAD. Ask ordinary cat talk such as `Did you catch the fly?`; it should keep the existing chat path.

## Dual Course

- **Budget (5):** one-tap honest posting of repeated merchants; duplicate confirm still fires; quiet titles do not leak to a vendor; figures in his mouth trace to posted rows.
- **Engagement (3):** he notices without being asked; one cat-voiced proposal; Save is a human tap; he still never `postEntry`.
