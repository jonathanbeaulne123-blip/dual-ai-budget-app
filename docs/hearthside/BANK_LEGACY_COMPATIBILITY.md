# Bank creation: legacy acceptance compatibility

Risk: High. Budget delta (5): select the receipt path using the actual App writer mode, retaining Final Confirm and the existing acceptance boundary. Engagement delta (3): existing Home and Kitty entrances can create their first bank without a v2 receipt service or a stuck review.

Base: `1d5b08ee49594349e1886344f5e6d1edeb9f0062`. Isolated worktree; no dependency source copies. The four shared-file changes are supplied only as `bank-legacy-compatibility.integration.patch`. Root owns the current-main reconciliation and will preserve newer Kitty nesting/navigation props.

The regression: App supplied `readAcceptedKittyCommand` even when `commitHousehold` used legacy acceptance. `addGoal` could be accepted and then the v2 reader threw `SCOPE_CLOSED`. Absence of a reader also disabled every bank creation form.

The repair:

- App supplies the v2 reader only when `useLedgerSync && (household.linked || localLedgerIdentity(member))`, matching its actual command writer condition. A v2 household whose client is opening or disconnected keeps the v2 path; connection errors never downgrade it.
- The original legacy CreateBank form was removed in this checkpoint. The current authored form and Review/Final Confirm sheet are therefore shared by both paths. Intention-linked creation still requires its existing v2 receipt service because the connection is independently reviewed there.
- Legacy creation uses the real `CommandOutcome` and same-household `CommandReceipt`, including exact confirmation ID, posted goal ID, active member and shared/personal visibility. An absent result, failed outcome or candidate without a receipt never signals success. New legacy creation receipts explicitly identify `addGoal`.
- Saved reviews carry an optional writer tag. Old untagged reviews remain compatible with the previous v2 path. An attempted v2 review cannot resubmit as legacy. Previously stuck legacy creations recover from their existing legacy receipt; older App receipts used the reviewed bank name as command kind, so recovery also checks name, target and the exact originally reviewed clay identity.
- Legacy uncertain retries retain the exact confirmation ID and rely on the existing legacy acceptance boundary's receipt deduplication. They do not set `recoverConfirmation`, whose current App implementation is v2-only.
- Empty bank creation stays mounted while the accepted household arrives, so its review is cleared and the actual posted goal is selected before the form leaves. Root should preserve its newer ranked nesting entries while applying this narrow initialization hunk.

Owned verification: `test/hearthside-bank-legacy-ui.test.ts` renders actual HouseholdHome and KittyBankRoom with the actual legacy `acceptHouseholdWrite` boundary and synthetic local adapters (no hosted writes). It covers shared Home and personal Kitty acceptance after Final Confirm, rejected ingestion with retained/editable inputs and a new explicit review ID, old-schema lost-reply recovery without another save, attempted-v2 downgrade denial, refusal of receiptless candidates, and uncertain false outcomes after a save retaining the original identity until its receipt is recovered. Existing bank journey UI/domain/actual LedgerRoom runtime tests remain required.

This is compatibility evidence on the checkpoint, not acceptance of the root's later main merge, physical devices, hosted deployment or flag activation. No dependencies or migrations are added.

Measured local evidence:

- Scoped High gate passed in 80.952 seconds, with 35 selected test files and no time-budget breach. This gate preceded the final narrow guard requiring `postedNothing === true` before treating a false legacy outcome as a definitive rejection. Its source fingerprint was `ee73f1f496a5076037aede78bffa022247c613598ce8c26420934115c69468ef`.
- After that guard and its additional regression: full application `tsc --noEmit` passed; 21 tests in four files passed in 8.99 seconds (seven legacy UI tests, eight journey UI tests, five journey domain tests, one authenticated LedgerRoom runtime test).
- The final patch is based on the stated checkpoint. Root must run its merged-program gate/build after applying and adapting the patch. This package does not claim the earlier High gate covers the later final source or the newer main merge.
- No layout or stylesheet changed, and no new browser screenshot or physical-device proof was collected. The UI evidence here is React/jsdom interaction and actual acceptance/authority execution with synthetic fixtures.

The uncertain-outcome guard matters: only the existing definitive-rejection callback or an outcome explicitly guaranteeing that nothing posted permits cancellation and a fresh confirmation ID. A false/recovery result without that guarantee leaves the attempted review intact.
