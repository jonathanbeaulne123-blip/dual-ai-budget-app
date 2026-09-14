# The cellar's bill rail — evidence

Chromium (SwiftShader for the 3D path; `--disable-3d-apis` for the no-WebGL
path), fictional Development books on the `composition=queen` proof page with
`bills=1`, driven into the cellar by the app's own two-tap gesture. Produced by
`test/queen-cellar-layout.mjs`; 23 records in `records.json`, **0 page errors,
0 serious/critical axe hits, `overflowY` 0 everywhere**.

The fictional month on the rail, eleven jars (plus *Fictional big shop*, planned, Food › Groceries, the 13th, and *Fictional oil change*, planned, Transport › Fuel, the 19th): *Fictional streaming* (subscription,
Life › Fun, the 8th, already posted → a shard), *Fictional gym* (subscription,
Health › Care, the 10th, full and overdue → its hammer is out from the 12th),
*Fictional hydro* (house bill, Housing › Electric, the 15th, full), *Fictional
transit pass* (recurring payment, Transport › Transit, the 18th), *Fictional
rent* (house bill, Housing › Electric in this fixture, the 20th, $760 of $900 —
the month's largest), *Fictional phone* (house bill, Life › Phone, the 22nd),
*Fictional winter tires* (planned expense, Life › Fun, the 24th), *Fictional
date night* (the 26th) and *Fictional card payment* (recurring, Debt › Card
payment, the 28th).

| Set | What it shows |
|---|---|
| `early-*` (320×568, 320×700, 390×844, 720×900, 1100×800) | The 12th. The gate opens on today; the water stands at 93% of the month's crest; eleven jars on their days, **each told apart three ways** — a body per purpose, a tint per category group, a finish per line, a size band per due. Only the overdue full gym has its hammer out; everything ahead just holds its water (`early-gate-*`: *"Filling. Fictional hydro · house bill · Housing › Electric · in 3 days · $140.00 saved, ready"*, and the only act is the rehearsal). The line with no jar in the gate is the key: *shape is what it is for, colour where it is filed, size how large the due is.* |
| `due-crack-*` (320, 390, 1100) | The 20th. The gate opens on today, where the rent stands **cracked**: due and $140 short. The line names it; the act reads *Pay it anyway · from the water*. The strikes down the rail read `shard, hammer, crack, none, none`. |
| `due-lifted-*` | The rent lifted out for a rehearsal: the jar floats over a dotted hole, the water on its day rises from 70% to 93% of the crest, the line ends *"Lifted out — a rehearsal; nothing is written."* `Set it back` restores it. No command is called. |
| `due-hammer-*` / `due-confirm-*` | The overdue, full hydro jar in the gate: **the hammer is out**, by hand only. Pressing it opens the app's Confirm sheet (*"Break the bank: Fictional hydro … does not move money at your bank"*). Cancel leaves the hammer out and posts nothing. |
| `due-broken-390x844` | Confirmed on the proof page's in-memory books: `postDueRecurrences` posts the one recurrence, the jar becomes a shard on its own day, the hammer is gone, the notice says so. |
| `overdue-planned-*` | The 27th. The planned expense is due and "full", but the cellar cannot post a planned expense: **no hammer**; the act is *Open it in the banks*. |
| `keyboard-focus-390x844` | The rail takes focus with a visible ring; three ArrowRight presses move the gate three days and the slider follows (11 → 14); the line lands on the hydro jar. |
| `reduced-3d-390x844` | `prefers-reduced-motion` + the comfort attribute: the room renders in 3D; the water and the rail have no transition (`0s`). |
| `no-webgl-*` (390, 1100) | `--disable-3d-apis`: the room reads `flat`, the drawn jars stand in (the water inside each is the saved amount; the crack, the ghost's dotted outline and the hammer are drawn), and the same reading holds. |

## Reading the rail

- Time runs along the rail, one cell a day. A bill stands on its due day as
  the studio's own kitty bank, and three things tell one from another, every
  one a band read from the books (`src/core/queenCellar.ts`): **the body is
  the purpose** — a house bill is the lidded bean cat, a recurring payment the
  tall cat with pointed ears, a subscription the round cat with its tail
  wrapped round, an appointment the low loaf, a planned expense a round cat
  in **frosted glass** (translucent in its group's tint, a dashed edge) until
  it posts — never the wireframe ghost, which is kept for the paid shard; **the tint is the category group** the bill is filed
  under (Housing terracotta, Food olive, Transport slate, Life plum, Health
  sage, Debt graphite; an unknown group keeps the bare clay) and **the finish
  is the line inside it** (plain, speckled, banded, crackled by the line's
  place in its group, so Electric and Household gas read apart); **the size
  is one of five bands** of the due against the month's largest, so rent
  stands over a phone bill. The water inside is what the bank has saved; a
  crack across the cat is "due and not full", the broken cat is "paid".
  **No figure is on the rail** — the amounts are confirmation in the line
  beneath the gate, which also names the purpose and the filing.
- Every pane in the room is glass (`queen-glass.css`): a thin tint, a strong
  blur, a bright hairline; in the live 3D cellar the panes are smoked with
  paper text so they read on stone. Regenerated after the merge with the
  house patch (kitty banks in the rooms, the house rail, the vertical axis).
- The water behind the rail is `fundWalk`'s balance on the day in the gate,
  drawn against the month's crest; the dashed tidemark is the buffer. The
  fixture's buffer is $0, so the tidemark sits on the floor here.
- The strike rule is Jonathan's: hammer only by hand and only when due and
  full; a crack when due and not full (you can still pay — the sheet says the
  rest comes from the Fund's water); a shard when the bill was paid anywhere
  else in the app; nothing early. The hammer also only leans where the cellar
  can post — a recurring bill. It never moves bank money.

## The compromised frame

320×568 with the chrome stand-ins leaves the room about 240px tall — the same
frame the rooms' own evidence shows cramped. There the slider and the sub-line
give way (the rail still drags and takes the arrow keys, and the line beneath
the gate is hidden by the existing short-frame rule); the stair, head, view
pills and rail stay inside the room. 320×700 is the honest 320 frame.
