# Claude assignment — Mobile shell only (desktop frozen)

> **Shipped.** Mobile Home is `src/OfficePhone.tsx`. This file stays as the assignment record. Do not restyle `.desk-wide` from it. Cursor owns the desktop fence, persistence, and Hercules perch/bubble clamp.

Paste **this whole file** into Claude. Then open the kitchen (or `pnpm dev`) at **390×844** *and* at **≥720px**. Do not plan from `docs/nostalgia/` or `docs/reference/`.

You are **Claude**: design lead **and** implementer of the **mobile Home board**. You produce real React and CSS, iterated in a browser at iPhone width, until Home is not a settings list.

Cursor Grok owns domain wiring, persistence, commands, and **guarding the desktop shell**. Grok does not restyle your mobile board after drop-in unless a Dual Course gate is red (contrast, Post covered, invented CAD).

Jonathan’s latest instruction (2026-08-23) wins over [CLAUDE_OFFICE_UX.md](CLAUDE_OFFICE_UX.md) and over the “keep the phone shape at 1400px” line in [OFFICE.md](OFFICE.md).

---

## 0. The split (read this twice)

Hearth is **one product, two UI branches, one kernel.**

| | Mobile | Desktop / wide |
|---|---|---|
| **Breakpoint** | `< 720px` (`WIDE_BREAKPOINT`) | `≥ 720px` |
| **This pass** | **You build.** Glance + one-tap. Subtract the 17-row rail. | **Do not change.** Jonathan likes it. Freeze. |
| **Philosophy** | Quick common acts. At-a-glance data. The direction *before* Home became a settings list. | Heavy customization, dynamic window, full widget desk. Everything that made the phone cumbersome is **doable here**. Tweak later, do not strip now. |
| **Layout key** | `hearth.office.<env>.phone` | `hearth.office.<env>.wide` |
| **Default desk** | Five or fewer objects. Tracker / Household. | Current canvas: all instruments, free move, weather, overlap. |

**Core functionality is shared.** `postEntry`, `postShift`, `postTransfer`, Confirm, Google, Calendar overlay, Appointments, Books, Hercules talk, Health, sit-down — same commands, same snapshot, same meaning. If it posts money, both shells call the same verb.

**Theme is shared.** Colours, fonts, Hercules bubble chrome, wax, brass, paper, pine, copper. `:root` in `src/styles.css` / `src/office.css` is the house. Do **not** invent a second brand for mobile. Mobile may *use fewer objects*; it may not look like a different company.

**UI decisions are not shared.** What is on Home, how large it is, whether it jiggles, whether games show, whether the rail is five rows or seventeen — those are per shell.

---

## 1. Hard fence — desktop stays

Jonathan: *“These UI changes should only affect the mobile client. I actually really like the desktop view, it should remain the same for now.”*

Treat `≥ 720px` as **production UI** this week.

### You may

- Add mobile-only markup/CSS behind `@media (max-width: 719.98px)` (or a `.office.is-phone` class that is **not** applied on wide).
- Change shared **tokens** only when both shells should move together (ink, paper, bubble radius, Fraunces/Figtree). Say so in the PR.
- Fix a money-meaning or kill-criterion bug that also appears on wide (Post covered, wrong CAD, `UNMODIFIED` as a maroon error chip). Those are not “desktop restyles.”

### You may not

- Restyle `.desk-wide`, wide absolute positions, or the 2-column canvas “to match mobile.”
- Hide instruments on wide, delete games on wide, or apply Tracker/Household defaults to `wide` layout.
- Lift or keep `.app { max-width: 760px }` as a *design* fight this pass — desktop is the current centred office. Tweaking that cap is a **desktop-branch** decision later.
- “Fix” desktop clutter by subtracting it. Clutter on a laptop is a customization problem. Clutter on a 390px rail is the disease.

**Acceptance for the fence:** at ~390×844 Home is a glanceable phone. At ~900px (or any width ≥720 inside the current app column) Home still looks like today’s office: window, sill, movable instruments, not five tiles.

---

## 2. Why the last spec failed (do not repeat it)

You already used the live kitchen at 390×844. The finding stands:

Home is a **settings list**. Seventeen identical header rows — small-caps name left, value right, ~1400px of scroll. No object hierarchy. That is the phone **rail**, not the wide canvas.

The September spec asked for instruments as objects (rotation, overlap, one-at-a-time expand). What shipped on the phone is `Instrument`: a 44px header, body only after tap. Seventeen of those cannot be an office.

**Do not write another 640-line spec for Grok to interpret.** You already ran that process. Build the mobile board. Iterate in a browser.

Desktop is where that spec’s *feeling* actually landed (canvas, weather, widgets). Leave it.

---

## 3. Mobile philosophy (this pass)

Borrow from the rival table, not from a widget store.

| Steal | From | On mobile Home |
|---|---|---|
| Giant pad, 1250 → $12.50 | Cash App | Calculator stays. Milk in ten seconds. |
| Three rings / three acts | Apple Fitness, Tamagotchi | Post / Due / Close (or Milk · Shift · Pay card) as the controller. |
| One hero number | YNAB, Copilot | Blotter net **dominates**. Labels are secondary. Never `UNMODIFIED` in error-maroon on a clean opinion. |
| Account as the object | Mint, bank apps | Wallet **or** Accounts, not both stacked as equal rows. |
| Creature + a few goals | Finch | Hercules + jars or chalk — not seventeen chores. |
| The daily act *is* the screen | Pokémon Sleep | Posting is the game. Games (ttt/hangman) are not default-on. |
| Sparse home | Monzo | Search / cmd-k is the hatch, not Home. |
| One question | Typeform | Optional first-run: Tracker vs Household. Not a quiz that blocks milk. |

**Refuse on mobile:** Duolingo guilt, Clippy, Notion infinite canvas as the ledger, a widget store, auto-post, CAD in the weather glass, inventing safe-to-spend, bank ticker (D-039).

### Mobile Home is a controller

Glance without a decision. One tap for the common act. Cabinets (Calendar / Plan / Books / More) stay in the **nav** — do not duplicate them as gold buttons plus the bar.

Default-on **five or fewer** instruments, plus the window/sill if it still earns its height. Calculator cannot be removed.

Suggested starting desks (mobile only):

| Desk | For | On the rail |
|---|---|---|
| **Tracker** | Capture | Calculator **large**, blotter, wallet, mail (or activity). |
| **Household** | Couple default | Calculator, blotter, timesheet **or** jars, chalkboard, lamp-if-lit. |

**Ledger / CPA density is desktop.** Do not cram statements onto a 390px Home.

Customization on mobile is the **escape hatch** (hide / restore), not the front door. Edit-Desk jiggle, sizes, stacks, paper stocks, auto-promote — those belong to the **desktop branch**.

### Mobile bugs you already named (fix on phone)

- Logo as a broken `<img>` — inline the mark if needed.
- Night window reading as a failed image — draw glass, not a blurry void.
- Proposal bubble clipping the rail and covering Timesheet.
- Cat sitting on chalkboard / games and squeezing text (on a five-object desk he has somewhere else to loaf; still `pointer-events: none` during Add).
- Sill figures wrapping (“the Wednesday visit”, orphan GROCERIES).
- Cabinet row duplicating the nav.
- Blotter stamp: clean wax, not engineering `unmodified` in `#6b1d1d`.

---

## 4. Desktop philosophy (not this pass — do not strip it)

Jonathan: *“The philosophy for the desktop is heavy customization, unique dynamic background and widgets … a desktop screen will be able to support more customization without restricting information access. I want to add everything we’ve talked about. It is doable on a desktop. I really like the way it feels … it just needs tweaking.”*

The **desktop branch** (later, Grok or a later Claude pass) is allowed to take the full office packet that **broke the phone**:

- All instruments: calculator, blotter, wallet, accounts, calendar, appointments, mail, claims, timesheet, chalkboard, wardrobe, postcard, cook-off, jars, lamp, games
- Free move, snap, rings, overlap, weather window as atmosphere (no CAD on the glass)
- Instrument sizes S/M/L, smart stacks, Edit Desk, paper stock / wood / density / cat scale
- Desk personalities as *starting points*, then full rearrange
- Google manager stays Calendar + More, not a mandatory Home widget
- Hercules on the furniture

This pass: **tweak nothing on wide unless it is a shared-token or a money bug.** Write a short “desktop later” cut list in your handoff so Grok does not lose the ideas. Do not implement them on mobile “just a little.”

---

## 5. Laws that do not move (either shell)

Commands are the money trust boundary. UI is untrusted (D-025 / D-026).

- Expense / income / **transfer** / refund. Card paydown is a transfer (D-016).
- CAD cents. `America/Toronto`. Splits sum. Joint is explicit.
- Development vs Production are two snapshots. Default to Development.
- Journal wins if a statement disagrees (D-046).
- Hercules, chalk, wardrobe, widgets, weather, layout, Google **never** `postEntry`.
- He never names who spent more. No hunger-meter death. Shift streak = **posted** dates (D-050).
- Bank / Interac / issued cards: Auth + RLS first (D-039). Google is live product (D-078) and is **not** a bank. Do not add an 18th mobile widget named Google. Calendar overlay and reminders stay in the Calendar cabinet.
- Quiet appointment titles stay coded in Hercules / pulses (D-054 / D-060).
- Layout never enters `splitForSync`. Phone layout ≠ wide layout.
- **Kill criterion:** if Bianca will not add milk, shrink the furniture. During Add: instruments inert, cat corner-loafs, never covers Post.

You may be revolutionary on the **mobile rail**. You may not be revolutionary in **money meaning**. You may not be revolutionary on **desktop this week**.

---

## 6. What to build (deliverable)

A **working mobile Home** in this repo:

- Real components and CSS.
- Fixtures / demo kitchen as Jonathan.
- Iterated at **390×844**.
- Shared theme tokens. Shared bubble component — restyle the component, not a mobile-only clone, unless chrome must stay identical (preferred: same `.hercules-bubble`).
- Nav unchanged in meaning (Home / Calendar / Add / Plan / Books / More).
- Confirm still posts. Calculator still uses existing `CadPad` + existing post path.
- `pnpm test` still green. Do not rewrite `postEntry` / `postShift` / `applySitDown` / journal compile.

### Suggested files

Prefer mobile-scoped styles in `src/office.css` inside a phone media query, or `src/office-phone.css` imported alongside. If you introduce `src/OfficePhone.tsx`, `Office.tsx` must still render the **current** desk on wide.

Do not fork `src/core`. Projections stay `buildDashboard`, `householdWallet`, `auditOpinion`, `sillOverview`, etc.

### Test script (mobile)

Development pill → demo kitchen → 390 wide:

1. You can post **$12.50** milk in ten seconds.
2. You do not scroll past a dozen identical rows to find the pad.
3. One number is obviously the month.
4. Nav is the only Books / Calendar / Plan / More.
5. Resize to ≥720: the old office is still there.

---

## 7. How to work with Grok

1. **You ship pixels on phone.** Grok wires any layout `v: 2` / personality persistence if you need saved Tracker vs Household — or you persist only on the `phone` key and leave `wide` JSON untouched.
2. **If a change would alter wide:** stop. Put it in the desktop later list.
3. **Shared CSS:** if you change `--ink` or bubble radius, both shells change. That is allowed when the house should move together. Do not change `--felt` blotter to “simplify mobile” if it also paints desktop.
4. **Disagreement:** Dual Course (5 vs 3), kill criterion, this fence. Jonathan breaks ties.
5. No clasp, no production Sheets, no workbooks in git. No Cloudflare-token PR (#22). No second Google-token PR.

---

## 8. First message back

1. One paragraph: mobile feeling at 390px.
2. What you will **not** touch on wide (checklist).
3. The five (or fewer) mobile objects and the one-tap acts.
4. Then build. Do not wait for another spec cycle.

This is the mobile update. Fill the phone. Leave the desk.
