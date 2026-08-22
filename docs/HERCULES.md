# Hercules

**The product face:** a living Maine Coon who reads the household journal, keeps notes in the same snapshot as the milk, and never posts a cent.

The ledger is still the company (Dual Course weight 5). He is Course B (weight 3) **and** a serious tool: money questions are answered on-device from the books. Care is posted household facts, not a hunger meter. Ember was the flame prototype and is fully historical.

Laws: [DECISIONS.md](DECISIONS.md) D-042 / D-044 / D-045 / D-046 / D-047 / D-049 / D-050 / D-051. Strategy: [STRATEGY.md](STRATEGY.md). Museum essay: [nostalgia/HERCULES.md](nostalgia/HERCULES.md).

## Laws

- No dock card. No full-screen Clippy sheet. He loafs in the corner while Add is open.
- Tap / chips = `talkHercules` / `askHercules` (journal-true). Typed money questions stay on-device. Unmatched talk may use `POST /hercules/chat`. **Third-party keys are allowed** as Worker secrets (`wrangler secret put OPENAI_API_KEY` / `ANTHROPIC_API_KEY`); Workers AI is the fallback. Never `VITE_`. The model cannot post, emit SQL, invent a write, or name who spent more.
- Chat and memories live in `kitchen.hercules` (D-049). Same merge, tombstones, Hearth Pass, and hosted door as the books. The model does **not** receive chat history or a transaction dump — only briefing, grounded CAD, and memory labels.
- Safe writes: keep a talk, keep a note, forget a note, wipe chat. A “add milk” line opens Add. **Confirm still posts.** Hercules never calls `postEntry`.
- Mood from Health, bills, goals, week-over-week spend. Punishment is a face and a sentence, never a fake fee.
- Unlocks come from posted facts, a tied rec, or a closed month — never a shop, never pay-to-keep-alive, never pet death.
- Shift-posting streak (D-050) is consecutive **posted shift dates** from the latest shift. Vacation does not kill him. “Log shift” opens Add. Confirm still posts.
- **September Office (D-051):** he will perch, bump, lick, and pounce on desk widgets. He still never posts. Kill criterion unchanged.
- **Kill criterion:** if Bianca will not add a grocery because he is in the way, shrink him. Drag him. Pin him.

## Dual Course

Every new line in his mouth must point at a budget primitive (wallet, rec, sit-down, Health, D-016). Every new accounting surface should give him one honest sentence. If they conflict, the books win.

## How to try it

1. **App/website:** Hearth (kitchen site or `pnpm dev`)
2. **Tab/page:** any page — he wanders. Home for the net and opinion. Add to see him loaf. Home → Hercules’s things for ledger notes.
3. **Instructions:**
   1. Open the demo kitchen table (Development).
   2. Tap him. Ask **What’s on the Visa?** or **Opinion?** — that answer comes from the journal, not a model.
   3. Type `remember payday is Thursday`. Send. The note lands in the kitchen ledger (wardrobe → Kitchen ledger notes).
   4. Type `what do you remember?` He reads the snapshot, not a vendor memory store.
   5. Type `add milk`. Add opens. Confirm still posts.
   6. Dismiss the bubble. Reopen him: prior chat is still there. Wipe it from Hercules’s things if you want it gone on both phones.

## Purrsonality

Smug-kind Maine Coon on a Toronto counter: first person, short sentences, occasional mrrp, milk → bills → treats. He is also the household auditor. Dollar facts come from `talkHercules`, not from the model’s imagination. Third-party keys are allowed; they stay on the Worker (`wrangler secret put OPENAI_API_KEY` or `ANTHROPIC_API_KEY`). Never `VITE_`. Local `pnpm dev` falls back to the same voice if the Worker is quiet.

Why this shape (research we used, not dependencies we imported): Finch and Pokémon Sleep make the real act the game; we make **posting and asking the books** the act. GenieClaw / local-first household agents keep memory in SQLite next to the home data — we keep it in the household snapshot. Cloudflare Workers AI function-calling would execute tools **next to the model**, which would require sending the journal off-phone. Tools stay on the phone.
