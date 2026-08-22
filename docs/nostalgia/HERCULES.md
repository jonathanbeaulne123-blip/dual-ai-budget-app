> **Nostalgia — do not build from this file.** Living how-to: [../HERCULES.md](../HERCULES.md). Living law: [../STRATEGY.md](../STRATEGY.md).

# The Hercules Update

**Selling point:** a living Maine Coon named **Hercules** who wanders the kitchen, teaches in one breath, and never writes a cent.

This is the product face. The ledger is still the company. We did **not** rebuild the command kernel. Ember was the flame prototype.

Related: [DAILY_HEARTH.md](DAILY_HEARTH.md), [../DECISIONS.md](../DECISIONS.md) D-042 / D-044 / D-045 / D-046 / D-047, [AUDIT_OFFICE.md](AUDIT_OFFICE.md), [ACCOUNTS.md](ACCOUNTS.md), [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md).

---

## What we studied (and what we stole)

| Companion | What they got right | What we refuse | What Hercules does |
|---|---|---|---|
| **Neko / oneko** (desktop cat, 1980s–now) | No chrome. Walks, sits, washes, sleeps. You drag him. He is *on* the screen, not in a widget. | Chasing the cursor across the Add sheet | Borderless wander, idle sequencer (walk → loaf → wash → stretch → sleep), drag to move, right-click to pin |
| **Animal Crossing villagers** | One or two sentences, then they walk away. Personality, not a FAQ. | Paragraphs, 11 chips, a help-desk transcript | Compact bubble that follows him. Two or three replies. Typed chat keeps the last few breaths, not a ticket log |
| **Finch** (self-care bird) | Pet health = *your* real habits. Glanceable. Care without a lecture. | Paywalls to keep the pet alive; hunger meters | Orange ping when Health is dirty, a bill is due, or nobody posted groceries. Petting purrs. It does **not** fake-fix the books |
| **Duolingo Duo** | Reactive poses: idle, celebrate, sad. The mascot *is* the feedback. | Guilt-streak death; the owl at your door | Jump on a paid bill and grocery high-five. Sleep when the week is kind. Pace when a bill stares |
| **Cleo** (money chat) | Short, human, coaching. People open it because of tone. | Roast-shame; chat as the whole app | Cat voice: “Milk. Ordinary. That’s the whole sport.” Numbers live on Home. He points. He does not replace the net |
| **Tamagotchi** | Three buttons. Check-on loop. Simple. | The pet dies. Pay to revive | He hides under the table when Health is dirty. Vacation does not kill him. Posting streaks come from the ledger |
| **Clippy** | People *remember* a character | Unsolicited full-screen help, interrupting work, “it looks like you’re writing a letter” | No modal. No dimmed overlay. He loafs in the corner while Add is open. Mutter only for a real bill or dirty Health, then fades |
| **Erica (BofA)** | Utility, trust | An orb with no friend | Hercules is a friend who happens to read a general ledger |
| **Neko Atsume / Nintendogs** | Presence over control. Petting. You look in on them | Collectathon that hides the job | Scratch him. He stays a Maine Coon, not a gacha |

**Gold standard we are aiming at:** Neko’s body + Animal Crossing’s mouth + Finch’s care loop + Cleo’s money coaching − Clippy’s interruption.

---

## Sales pitch

Mint died in 2024 because it was a monthly chore glued to a bank feed. Finch hit tens of millions in ARR by making self-care feel like looking after a creature. Cleo pulled Gen Z by talking like a financially literate friend. Duolingo’s owl is a retention machine because it *reacts*.

Hearth already has the rare thing: a two-person general ledger that does not lie. Hercules is how that ledger gets opened on a Wednesday for no reason.

Research that actually exists:

- **Fogg Behavior Model** — motivation, ability, prompt. He is the prompt. Milk is the ability.
- **Self-Determination Theory** — competence (he explains), autonomy (he never posts), relatedness (high-five, not a shame board).
- **The Media Equation** (Reeves & Nass, 1996) — people treat screens as social actors.
- **Yu-kai Chou, pet-companion design** — a pet makes showing up a promise to someone else. We tie that promise to *posted groceries and paid bills*, not to opening the app on vacation.

**One sentence:** Hearth is the household ledger with a cat who is your teacher and your friend — and the cat is not allowed to touch the money.

**Kill criterion:** if Bianca will not add a grocery because Hercules is in the way, shrink him. He already hides on Add. Drag him. Pin him.

---

## How he lives now

- **No dock card. No full-screen sheet.** He is a borderless SVG Maine Coon who jumps between safe perches.
- **Tap** = one bubble, attached to him. **Drag** = move. **Hold still** = purr. **Right-click / long-press pin** = stay.
- **Idle (Neko):** walk, loaf, wash, stretch, sleep. Restless = pace. Hiding = under the furniture. Paid bill / high-five = jump.
- **Attention ping** when he needs you (dirty Health, due bill, no grocery today). He does not die.
- **Talk** is `talkHercules` for taps and chips (journal-true, instant). **Typed chat** is Workers AI with a Hercules purrsonality (`POST /hercules/chat`). The model only sees aggregates + a grounded journal line. Local fallback uses the same voice. He never posts.
- **Home** keeps the real numbers, including wallet tiles. Chalkboard stays. Wardrobe tucks under “Hercules’s things.” Cook-off, forecast, Sunday recap, and card utilization live in his mouth, not in extra cards.

---

## What we will not ship

- Pay to keep Hercules alive
- Fake overdue fees
- An LLM that writes SQL the household did not mean — talk-only Workers AI is allowed (D-045); it still cannot post
- A 10MB game-engine cat on top of PGlite
- Rebuilding the ledger so the cat *is* the database
- A cook-off that names who spent more
- Clippy: unsolicited full-screen help

---

## How to try it

1. Development. Demo kitchen table.
2. Watch him wander. Drag him off a number if he’s sitting on it.
3. Tap him. Ask **Opinion?** or **Working capital?** or **What’s on the Visa?** or “we good?” Type in the bubble. Hit **send**.
4. Tap **+** — he loafs in the corner. Confirm still posts.
5. If a bill is due he paces and may mutter. Calendar, then confirm.
6. Tie a bank rec on Books to unlock **audit spectacles**. Close a month to unlock the **green-ink stamp**. On Books he stretches for fieldwork.

---

## Purrsonality (D-045 / D-046)

Hercules talks like a smug-kind Maine Coon on a Toronto kitchen counter: first person, short sentences, occasional mrrp, milk → bills → treats. He is also the household auditor: unmodified / qualified / adverse, working-capital watch, equity rolls. He will not name who spent more. He will not claim he posted.

| Path | What it is |
|---|---|
| Tap / chips | `talkHercules` / `askHercules` — projections over the books |
| Typed chat | `POST /hercules/chat` on `hearth-books` (Cloudflare Workers AI). No OpenAI key. System prompt stays on the Worker |
| Briefing | Month in/out/net, mood, health, bills, grocery-today, **opinion / trial / equation / going-concern / working capital**. Not a ledger dump |
| Grounding | The model must quote `talkHercules` CAD, not invent amounts |
| Sanitize | Strip SQL, write-claims, name-shame, “as an AI” |
| History | Last few turns in the bubble this session. Not saved in the household snapshot |
| Local | `localHerculesChat` if the Worker is unbound, slow, or returns HTML |

Kill criterion is unchanged: if the chat box blocks a grocery, shrink it. He still loafs on Add.
