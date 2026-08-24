# Hercules AI

Hercules is the household's resident data scientist who never touches the money. This file is the living spec for that layer (D-057–D-060). Companion how-to still lives in [HERCULES.md](HERCULES.md). Laws: [DECISIONS.md](DECISIONS.md).

## Research taken

- **Actual Budget / Firefly III.** Rule-based categorisation and scheduled-transaction inference. A `GROUP BY` on a few hundred rows beats an LLM. Habit detection is a second lens on `detectRhythms`, not a second miner.
- **Copilot Money / Monarch.** Anomaly *surfacing* is useful. Auto-posting a discovered bill is not. Hercules may interrupt once; he may not write.
- **Lunch Money rules.** A frozen template the household owns is the right object for “we buy this coffee.” That is a preset, not a recurrence.
- **Structured retrieval.** Permission to send the ledger is not a reason to dump it. Last ~36 rows, a month rollup, open claims, upcoming visits, and on-device notices. Chat history still never leaves the phone.
- **Treat user/third-party text as data.** Merchant names, spouse notes, and Google event titles are attacker-influenced. The Worker wraps them as `HOUSEHOLD DATA` and tells the model to ignore instruction-like text inside them.
- **Finch / Pokémon Sleep.** The real act is the game. Here the act is posting, confirming, and tapping Save. The cat is the delivery mechanism, not a second ledger.

## Research refused

- **Cleo shame.** He will not name who spent more. `sanitizeHerculesReply` still kills that sentence.
- **Mint bill-discovery-as-truth.** A detected habit is a proposal. Recurring bills stay on Calendar. Coffee is noisy for bills on purpose; habits are allowed to see it.
- **Duolingo guilt / Tamagotchi death.** Dismissing a notice hides it. He does not starve.
- **Clippy timing.** The paperclip was not the bug. Unsolicited timing was. Preset proposals are **not** queued on the 16s idle mutter. One dismissible card. Inert during Add. If it blocks milk, it is wrong.
- **Sending the whole journal every question.** `test/scale.test.ts` is 12 months × 200 txs. Retrieval is the design, not a concession.
- **Model-side tool-calling that writes.** Tools stay on the phone. The model cannot invent notice keys. The tap uses those ids only (`acceptPresetNotice`, same shape as `acceptVisitGoal`).
- **Bank aggregation.** D-039 stands. No Flinks, Plaid, Interac, or issued cards. Hosted RLS is still `USING (true)`.

## Architecture

**On-device science, model voice.**

The phone computes arithmetic, clustering, cadence, anomaly, preset/habit detection, quiet reasoning, and grounded CAD. It recomputes on open and after a post. That is a cheap GROUP BY, not a nightly job — phones are not a reliable scheduler — and it does **not** ride `useFurniture`'s 100ms interval.

The model does language: framing as a cat, which of several true notices is worth a sentence. It does **not** create proposal objects. Notices have ids computed on the phone. Accept uses those ids only.

**When he thinks.** On open and after a post. Offline, notices still work; the model is flavor and fallback (`localHerculesChat`).

**Interruption budget.** One proposal card, dismissible, inert during `adding`. Only a `habit-preset` notice earns the shoulder-tap. Claim aging, visit drift, and extra habits sit on the desk / Ask (“what did you notice?”). Dismissals persist on `calendar.dismissedNoticeKeys` and union-merge like rhythms.

**Memory.** Notices are recomputed. Dismissals persist. Accepted presets persist as catalog rows and merge like recurrences (`updatedAt` + `mergeRecords`). Chat/memories stay in `kitchen.hercules` (D-049).

**Grounding.** Every `$` in a model reply must appear in GROUNDED JOURNAL (spoken / lesson / fact). Briefing totals, notices, and the ledger excerpt are language context, not an interchangeable FIGURES allowlist (D-112). Unknown figures fall back to the grounded line. `sanitizeHerculesReply` is the outbound seam on the phone and on the Worker.

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

## Dual Course

- **Budget (5):** one-tap honest posting of repeated merchants; duplicate confirm still fires; quiet titles do not leak to a vendor; figures in his mouth trace to posted rows.
- **Engagement (3):** he notices without being asked; one cat-voiced proposal; Save is a human tap; he still never `postEntry`.
