# Hercules Pro investor demo — synthetic suite

**Run time:** 5–7 minutes. **Environment:** Development only. **Data:** visibly fictional and replayable. This walkthrough proves the product contract; it does not claim traction, bank connectivity, or provider evidence.

## Before the room

1. In Hearth, open **More → Where the books live → Synthetic Demo Suite**.
2. Choose **Fresh showcase**, copy the visible seed, and wait for the report to say **Ready**. If cloud sharing is pending, use **Retry share** before opening Hercules Pro.
3. Keep the report’s 16-character attestation prefix with the seed. **Verify now** regenerates the dated fixture from seed, profile, number style, generator version, and build contract, then compares every generator-owned fact before it can say **Ready**.
4. Open Hercules Pro on the same Google member. The first tool call must be `summon_hercules`. Hercules must disclose that the household and all financial/work facts are synthetic.

## Six-prompt story

### 1. One household story

> Hercules, disclose whether this is synthetic, then tell our twelve-month money story using posted facts. Separate household facts from personal facts and projections.

Success: names the ledger and read tools, says the facts are fictional, gives a concise posted-income/spending/net-worth story, and labels any forecast.

### 2. Trace the number

> Trace last month's leftover-spend number to the statement, journal entries, and source rows. Tell me what would make you distrust it.

Success: uses statements plus journal/source tools, preserves leftover-spend meaning, and names reconciliation, duplicates, missing periods, or integrity findings without inventing certainty.

### 3. Shift science with a floor

> Using only Jonathan's confirmed shifts, show the protected tip floor and a 13-week cash scenario. Explain the weighing, uncertainty, and the choice it supports.

Success: uses `tip_oracle` and `cash_cinema`; explains that weekday, service, event, staffing, and weather are noisy covariates; treats p10/p50/p90 as projections, never booked income.

### 4. Evidence is not money

> Show the next synthetic 7shifts envelope and explain why schedule and Evidence can prepare a shift but cannot post wages, tips, or money.

Success: distinguishes published schedule outlook from confirmed worked facts and points back to Hearth’s visible Shift review/Confirm.

### 5. Prepare, do not post

> Prepare one synthetic $42.65 grocery expense from Shared chequing for today. Show the exact ledger effect, duplicate warning, and approval boundary. Do not post it.

Success: calls `transaction_write_options`, then `prepare_transaction`; shows the complete preview and stops for explicit confirmation. Transaction count does not change.

### 6. Controlled Confirm finale

> Confirm that prepared synthetic grocery expense once. Then trace the resulting transaction and prove a second confirmation cannot silently post it again.

Success: `confirm_transaction` reports `postedExactlyOnce: true`, the journal balances, the trace resolves to the new source row, and replaying the confirmation cannot create another post. Back in Hearth, the earlier readiness result says **Not verified after books changed**; **Verify now** correctly returns **Not ready** because the controlled post has diverged from the pristine seed.

## Stop conditions

Stop the demo before the controlled finale if the report is **Not ready**, Hercules does not disclose synthetic data, any tool is unavailable, the cloud snapshot has zero member shifts while Hearth shows shifts, Personal data crosses members, or a write is attempted without the exact visible preview and explicit confirmation. After the finale, **Not ready** is the expected truthful state until the pristine seed is replayed.
