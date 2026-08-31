# Hercules

**The product face:** a living Maine Coon who reads the household journal, keeps notes in the same snapshot as the milk, and never posts a cent.

The ledger is still the company (Dual Course weight 5). He is Course B (weight 3) **and** a serious tool: money questions are answered on-device from the books. Care is posted household facts, not a hunger meter. Ember was the flame prototype and is fully historical.

Laws: [DECISIONS.md](DECISIONS.md) D-042 / D-044 / D-045 / D-046 / D-047 / D-049 / D-050 / D-051 / D-057–D-077 / D-083–D-094. Science spec: [HERCULES_AI.md](HERCULES_AI.md). Sit-down: [SITDOWN.md](SITDOWN.md). Goals: [GOALS.md](GOALS.md). Mark: [HERCULES_MARK.md](HERCULES_MARK.md). Strategy: [STRATEGY.md](STRATEGY.md). Museum essay: [nostalgia/HERCULES.md](nostalgia/HERCULES.md).

## Laws

- No dock card. No full-screen Clippy sheet. He loafs in the corner while Add is open.
- Tap / chips = `talkHercules` / `askHercules` (journal-true). Typed money questions stay grounded on-device; unmatched talk may use `POST /hercules/chat` (D-104). **FIGURES sent to the model are only grounded CAD** (D-112). Real figures in the bubble are typed provenance cards: tap one to open the ledger view and source surface that supplied it. UI code never regex-links arbitrary numbers. D-184 ordinary chat tries configured Gemini → Groq → opted-in OpenAI → Workers AI, then the existing on-device answer. Gemini/Groq activate only behind the explicit external-provider plus `synthetic` deployment classification gate; keys alone are inert. Keys are Worker secrets only (`wrangler secret put GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` for unchanged scan/planner routes). Never `VITE_`. The model cannot post, emit SQL, invent a write, or answer a Visa question with a Mastercard figure.
- Chat and memories live in `kitchen.hercules` (D-049). Same merge, tombstones, Hearth Pass, and hosted door as the books. Journal questions stay on-device. Household-view questions use only `household`/`both` rows; personal-view questions use only that member's `personal`/`both` rows. A personal question about another member is refused in Hercules voice. The model may receive a **redacted retrieval** (recent rows, month rollup, notices, figures) from that exact view — never chat history, never a quiet appointment title (D-059 / D-060). Memory labels still strip amounts.
- **Shared teaching (D-132):** in the household ledger Hercules may name a member when answering about their shared posts, shared categories, shared income, or shared shifts. “Overspend” means this week's shared posts versus that member's own prior four-week shared average; it is a pattern, not a moral score. Partner-personal rows remain forbidden. Own personal figures appear only while that member is in their Personal ledger.
- **Typed read tools (D-133/D-135):** for unmatched financial questions, the model may choose up to four calls from sixteen named read-only tools. The phone executes them against the current Household or Personal projection; the Worker receives no ledger dump and executes nothing. There is no generic SQL, code, mutation, or Confirm tool. Every resulting amount keeps a typed, tappable source. Planner failure falls back to ordinary Hercules chat.
- **Provider routing (D-135 / D-184):** ordinary in-app chat prefers configured Gemini, then configured Groq, then opted-in OpenAI, then Workers AI. Gemini/Groq require both `HERCULES_ALLOW_EXTERNAL_PROVIDERS=true` and `HERCULES_EXTERNAL_DATA_CLASSIFICATION=synthetic`. Planning and selected-image scanning keep their D-135 Workers-AI-first posture. Paid OpenAI/Anthropic calls remain disabled unless the Worker operator explicitly sets `HERCULES_ALLOW_PAID_PROVIDERS=true`. If every chat provider is unavailable, Hercules keeps the deterministic/local answer; scan failures remain honest.
- **Science (D-057 / D-058):** he notices repeated merchants on-device and may offer **one** Save-as-preset card. Confirm still posts. Duplicate confirm still fires. He never `postEntry` and never auto-creates presets.
- Safe writes: keep a talk, keep a note, forget a note, wipe chat, save/forget a preset, dismiss a notice. A “add milk” line opens Add. **Confirm still posts.** Hercules never calls `postEntry`.
- Mood from Health, bills, goals, week-over-week spend. Punishment is a face and a sentence, never a fake fee.
- Unlocks come from posted facts, a tied rec, or a closed month — never a shop, never pay-to-keep-alive, never pet death.
- Shift-posting streak (D-050) is consecutive **posted shift dates** from the latest shift. Vacation does not kill him. Clock-in is not a post. Sign-out Confirm still posts (D-062).
- **Page-true talk (D-063 / D-074 / D-093 / D-097):** sample questions follow the tab **and** the open instrument. **How can I help** is visible when chat opens and reads leftover, calendar, notices, and jars. On a loaded desk (usefulness 80+) first tap opens that help; below 80 first tap begs. Event talk on wide desk opens Calendar. Click him again to close. He perches on an opened widget; the hop cancels if another widget or tab opens. Chat stays off wallet, blotter, accounts, and the examined rect. Sit-down / leftover chips expand the postcard and leave the leftover sentence.
- **September Office (D-051 / D-064):** he will perch, bump, lick, and pounce on desk widgets. Expanded instruments close when you leave Home. He still never posts. Kill criterion unchanged.
- **Mark (D-061):** the live cat is ink-on-paper SVG (white coat, ruff under the head). The 3D GLB is source, not the 96px runtime. Laws and weaknesses: [HERCULES_MARK.md](HERCULES_MARK.md).
- **Fly and litter (D-132):** desktop only, unless reduced motion is requested. Catching the fly puts it in Hercules's mouth; dragging him to the litter box above More drops it, adds to a session-only pile, and spawns another. Dragging him over the pile without a carried fly clears it. Automatic paths are excluded from the litter zone. Mobile renders no fly or litter box. The pile is deliberately not household or device state.
- **Appointments (D-055 / D-056):** he may notice a visit and propose a jar. `proposeVisitGoal` does not write. **Start this jar** is a human tap from Calendar → Appointments or Plan. Quiet visits are "the Tuesday visit" in his mouth (D-054). He has vet bills (`memberId: "companion"`). The METC log is a page, not only an Ask answer.
- **Kill criterion:** if Bianca will not add a grocery because he is in the way, shrink him. Drag him. Pin him.
- **Sit-down (D-083):** on Plan he can read leftover and the positives. Confirm still moves leftover. He never `postTransfer`.

## Dual Course

Every new line in his mouth must point at a budget primitive (wallet, rec, sit-down, Health, D-016). Every new accounting surface should give him one honest sentence. If they conflict, the books win.

## How to try it

1. **App/website:** Hearth (kitchen site or `pnpm dev`)
2. **Tab/page:** any page — he wanders. Home for the net and opinion. Add to see him loaf. Home → Accessories for hats and ledger notes.
3. **Instructions:**
   1. Open the demo kitchen table (Development).
   2. Tap him. On the seeded demo the first tap opens **How can I help**. Ask **What’s on the Visa?** — tray vs statement, not Mastercard CAD.
   3. Type `remember payday is Thursday`. Send. The note lands in the kitchen ledger (wardrobe → Kitchen ledger notes).
   4. Type `what do you remember?` He reads the snapshot, not a vendor memory store.
   5. Type `add milk`. Add opens. Confirm still posts.
   6. Ask **What’s owed?** after a visit with insurance. Settlement is a transfer. Ask **Medical log** — pending claims stay out of the METC number; Hercules’s vet is never on it.
   7. On Plan, ask **Leftover?** The arithmetic is cash-like minus 30-day bills minus card mins. He will not move it.
   8. Dismiss the bubble. Reopen him: prior chat is still there. Wipe it from Hercules’s things if you want it gone on both phones.
   9. Watch him notice `$2.25 · Tim Hortons` and offer Save as preset. Confirm does not post money. The chip on Add still goes through Confirm; duplicate confirm should fire. Full script: [HERCULES_AI.md](HERCULES_AI.md).
   10. Ask **Will I be able to eat this week?**. Tap a translucent figure card; it should open Plan at the grounded calculation.
   11. In the household ledger ask **Did Jonathan overspend this week?**. The answer uses shared posts only. In Bianca's Personal ledger ask the same thing; Hercules should answer “Nice try, you silly kitten” and disclose no CAD.
   12. Ask **Show coffee charges over $5 this month**, **What bills are due in two weeks?**, **How much did we earn this month?**, and **How are the jars doing?**. Then ask **Are we ahead of budget?**, **Show the largest spending categories**, **How is the Visa?**, **What is our net worth?**, **Are the books healthy?**, and **Do any duplicates need review?**. These exercise Brain v2's sixteen typed read tools. Tap every amount card and verify that transaction/category facts open the register while account/net-worth facts open the wallet.

## Purrsonality

Smug-kind Maine Coon on a Toronto counter: first person, short sentences, occasional mrrp, milk → bills → treats. He is also the household auditor. Dollar facts come from `talkHercules`, not from the model’s imagination. Third-party keys stay on the Worker (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`). Never `VITE_`. Local `pnpm dev` falls back to the same voice if the Worker is quiet.

Why this shape (research we used, not dependencies we imported): Finch and Pokémon Sleep make the real act the game; we make **posting and asking the books** the act. GenieClaw / local-first household agents keep memory in SQLite next to the home data — we keep it in the household snapshot. Cloudflare Workers AI function-calling would execute tools **next to the model**, which would require sending the journal off-phone. Tools stay on the phone.
