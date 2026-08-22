# The Hercules Update

**Selling point:** a 3D-feeling Maine Coon named **Hercules** who follows every page, reads the books out loud, and never writes a cent.

This is the product face. The ledger is still the company. We did **not** rebuild the command kernel. Ember (the flame) was the prototype companion. Hercules is the same contract with a body people will actually tap.

Related: [DAILY_HEARTH.md](DAILY_HEARTH.md), [DECISIONS.md](DECISIONS.md) D-042 / D-044, [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md) Chapter 0.4.

---

## Sales pitch (investors and the kitchen table)

Mint died in 2024 because it was a monthly chore glued to a bank feed. YNAB works when people *intend*. Most households do not open a general ledger on a Wednesday for fun.

Research that actually exists (not a fake MIT percentage):

- **Fogg Behavior Model** (BJ Fogg, Stanford): a habit needs motivation, ability, and a prompt. Hercules is the prompt. The grocery split is the ability. The books staying true is the motivation that does not rot.
- **Self-Determination Theory** (Deci & Ryan): competence, autonomy, relatedness. Hercules explains the journal (competence), never posts for you (autonomy), and high-fives when both phones bought groceries (relatedness without a public shame board).
- **The Media Equation** (Reeves & Nass, 1996): people treat screens as social actors. A named cat is not a gimmick; it is how humans already use software.
- **Digital pets** (Tamagotchi onward) and **streak products** (Duolingo’s public engagement model) show that a creature plus a fact-based streak beats a dashboard. We copy the *creature*, not the dark pattern. Vacation does not kill Hercules. Posting streaks come from the ledger (D-042).
- **Maine Coon** specifically: large, dog-like, “follows you from room to room.” That is the interaction model. He follows Home → Calendar → Add → Plan → Books → More.

**One sentence for a room:** Hearth is the only household general ledger with a cat who is also the data scientist — and the cat is not allowed to touch the money.

**Kill criterion (CEO):** if Bianca will not add a grocery because Hercules is in the way, we shrink the cat, we do not add a feed. The dock hides while Add is open so Confirm stays the only tap that posts.

---

## What shipped (Waves 1–2)

On the phone, every signed-in page except the Add sheet:

1. **Hercules** is the default companion (Maine Coon). Old “Ember” snapshots rename once.
2. He **follows** as a dock. Tap to chat. Drag on the portrait for a 2.5D tilt. Restless mood wags the tail. Add hides him (kill criterion).
3. **Chat / data scientist** uses `askHercules` → journal projections (`askBooks`). He answers groceries, bills, tips, health, “what should I do,” “safe to skip,” cook-off, Sunday recap, forecast, “who are you.” He never calls `postEntry`.
4. **Toronto kettle whistle** — morning / after-shift / Sunday sit-down lines (`hourInToronto`).
5. **Grocery high-five** when both people posted groceries today. Chalkboard can scribble “nice.” Not a leaderboard.
6. **Bought** on a chalkboard note opens Add with the note filled. Confirm still posts.
7. **Collar cosmetics** (bell, yarn, fish) unlock from transfers, chalkboard activity, and shifts.
8. **Seasonal houses** — July patio auto-shows (and unlocks) June–August; winter ruff November–March or after a cold-month post.
9. **Bill-paid visor pop** — 700ms visor on the dock after confirm → `postOneRecurrence` / post-due.
10. **Sit-down postcard** — after Plan → Apply, Home shows a close card; **Pin to chalkboard** is the only write, and it is chalk, not money.
11. **Weekly cook-off** — household groceries vs coffee & lunches. Nobody is named.
12. **Sunday envelope** — 20-second screenshot recap (auto on Sunday once per phone; available any day from Home).
13. **Optional clink** on save, off by default, phone-local.
14. **Shift pulse** — trailing average of the last eight posted-shift weeks. Display only. Chapter 1.3 v0.

Books → Ask is the same brain with a Hercules byline. Power SQL stays read-only.

---

## Wave 3 — blocked until Auth + RLS (Chapter 0.1)

- Lights-on push that names amounts
- Receipt photos in hosted Postgres
- Watch / lock-screen widgets (need runway math first)
- Flinks, Interac API, issued cards, other households as customers

Google kitchen Link stays parked until the public client ID is baked. Hercules does not depend on Google.

---

## Ideas we will not ship

- Pay to keep Hercules alive
- Fake overdue fees
- An LLM that writes SQL the household did not mean
- A 10MB game-engine cat on top of PGlite
- Rebuilding the ledger so the cat *is* the database
- A cook-off that names who spent more

The 2.5D SVG cat is the CEO call: it loads on a phone, looks like a Maine Coon, and does not fight the books WASM.

---

## How to try it

1. Open Hearth on the phone.
2. Stay on **Development**.
3. Open the demo kitchen table, or use your household.
4. Tap the cat on any tab. Ask “are we alright,” “cook-off,” and “forecast.”
5. Add a grocery from two names to see the high-five.
6. Tap **bought** on a chalkboard line — Add opens; you still confirm. The cat hides while you add.
7. Apply a sit-down on Plan, then pin the postcard on Home.
8. Tick **Tiny clink on save** only if you want the sound.
