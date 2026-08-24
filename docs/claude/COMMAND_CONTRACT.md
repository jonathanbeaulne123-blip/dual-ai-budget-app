# Claude command contract

Claude owns presentation. This file is the typed write-surface contract. Do not infer posting from toast timing, spinner duration, or generic exceptions.

Adapter: `src/claude/commandContract.ts`. Fixtures: `COMMAND_SURFACE_FIXTURES`. Do not edit OfficePhone, Hercules drawing, or widget chrome to consume this; wire later from App outcome fields.

**UX spec (2026-08-24):** [`docs/CLAUDE_COMMAND_STATES_UX.md`](../CLAUDE_COMMAND_STATES_UX.md) — state/copy matrix, flows, viewport annotations, a11y, Cursor checklist. Visual mockup: [`command-states-mockup.html`](command-states-mockup.html).

## States

| Kind | Meaning | Posted nothing | Posted exactly once | Retry |
|---|---|---|---|---|
| `saving` | Confirm is in flight. | unknown | unknown | no |
| `accepted-local` | Books accepted on this phone. No hosted publish. | no | yes | no |
| `pending-transport` | Local books accepted. Share did not finish. | no | yes | same confirmation id |
| `synchronized` | Local books accepted and hosted snapshot matched the expected revision. | no | yes | no |
| `rejected-no-write` | Validation or policy refused the command. | yes | no | no |
| `retryable-failure` | Books or disk failed before accept. Previous household is live. | yes | no | same confirmation id |
| `permanent-validation-failure` | Unbalanced or invalid command. | yes | no | no |
| `conflict-needs-attention` | Local accept happened. Hosted write was refused as stale. Both sides are kept. | no | yes | human conflict, not silent retry |
| `recovery-available` | Accept did not stick, or books accepted while snapshot save/restore failed. | only if `postedNothing` | only if `postedExactlyOnce` | open recovery |

## User-safe fields

Safe to render: `kind`, `ok`, `confirmationId`, `revision`, `sharingMode`, `userMessage`, `retryable`, `postedExactlyOnce`, `postedNothing`, `recoveryAvailable`.

Do not render: implementation exceptions, SQL, secrets, partner `personal` rows, raw remote payloads, audit hashes unless Jonathan asks.

## Guarantees

- `postedNothing === true` and `postedExactlyOnce === false` means the previous valid household is unchanged.
- `postedExactlyOnce === true` and `postedNothing === false` means this confirmation id posted once. Repeating it must reuse the receipt.
- `conflict-needs-attention` does not disappear after refresh. Both snapshots stay on the conflict record.
- If persist fails after ingest and books restore also fails, `postedNothing` and `postedExactlyOnce` are both false. Recovery is available. Do not Confirm again with a new id.
- Sharing mode `local` means zero household REST from this write.

## Retry rules

Use `retryRuleFor(state)`:

- `do-not-retry` — change the command or stop.
- `retry-same-confirmation` — send the same `confirmationId`.
- `wait-for-human-conflict` — show both sides; do not last-write-wins.
- `open-recovery` — export/diagnostics; do not reset Production from Development.
