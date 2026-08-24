# Hearth

A household budget and companion kitchen for Jonathan and Bianca. Toronto time. CAD. Phone-first. Dual Course: books weigh 5, Hercules weighs 3.

The live kitchen site is [hearth-books.jonathan-beaulne123.workers.dev](https://hearth-books.jonathan-beaulne123.workers.dev/). Merge to `main` publishes it. Shared books are the household Supabase Postgres. This repository is the product.

```text
pnpm install
pnpm test
pnpm dev
```

Open `http://localhost:5173`. **Open the demo kitchen table** loads a fictional six-month household. That is not live production data.

## What you can do today

- Add spend, income, a shift, or a transfer from one `+` button
- Open **Ledger** for Income, Expenses, or Other (refunds and transfers)
- Split a purchase by any percentage — Bianca’s share is typed, Jonathan’s fills to 100%, cents still add up
- Get stopped on a likely duplicate: same amount within five days, plus matching notes, place, category, or source
- Open **Calendar** for a Toronto month of bills, pay, shifts, and visits; post a dentist visit (full cost today, insurance as money owed to us); land a claim as a transfer, never income; adopt repeating ledger rows; download an `.ics` with alarms; optionally overlay both Google accounts
- Reverse a row (with confirm) — original stays; a reversing entry dated today appears. Undo from the toast or **More → Recent changes**
- Read Home as chalkboard, wallet tiles (tap an account like a bank app), one net number, a pulse sentence, this week versus last week, upcoming money dates, and shared goals. Hercules wanders the screen; tap him, then type in the bubble to chat. Home shows his audit opinion next to the net
- Open **Books → Wallet** for chequing, savings, cards, the TFSA, money owed to us, and the jar; **All activity** is still the type-first register. Pay a card is a transfer. Interest and cashback never post themselves
- Open **Books** for a general journal, trial balance, balance sheet, P&L, cash flow (including investing vs card paydown), equity roll, working capital, notes, bank rec, close pack, and read-only SQL
- Ask Hercules in plain language from the cat or Books → Ask (**Opinion?**, **Working capital?**, **What’s on the Visa?**, **Leftover?**); Power SQL stays read-only. The cat never posts
- Run a monthly sit-down on **Plan**: positives, then the books, then leftover jobs. One Confirm turns the plan into transfers. Lock last month. Download or Save to Drive
- Keep **Development** and **Production** as two named local ledgers on the same phone
- Choose **Shared**, **Personal**, or **Both** on every add; switch Household vs Personal at the top
- Invite the other person with a three-word phrase, a join link, or a Hearth Pass
- Link Google on More → Google household bridge so both phones know who is who; Calendar can overlay both calendars
- In Development, choose **Continue with Google** on a fresh device to discover matching household ledgers; accepted offline writes wait in a durable outbox and retry automatically
- Export JSON or a PostgreSQL dump; run Health and get a clean bill or a specific finding

Transfers never count as income or expense. Refunds reverse category spend. Shift tip math is the verified cent-rounded household rules, including negative net tips.

## Architecture in one page

```text
UI (React, untrusted)
   |
   v
Pure commands (validate → clone → commit → refresh flags)
   |
   v
Accepted device replica + durable outbox
   |
   +-- PGlite books (balanced journal and offline engine on this device)
   +-- cloud continuity (personal + household scopes discovered by Google identity)
   +-- Home / Plan / Health are projections
```

There is no Google Sheet, and no formula range that can freeze. The D-113/D-114 Development slices discover exact Google memberships, accept pulled books through PGlite, retry a durable compacting outbox on launch/focus/reconnect, and keep multiple household plus member-personal device replicas. No phone is the host. Current open-row scanning, GET-then-POST CAS, full hosted snapshots, and `linked`/phrase transport are transitional. Google never posts money. See [docs/CLOUD_CONTINUITY.md](docs/CLOUD_CONTINUITY.md).

## Household vs personal

Jonathan and Bianca each sign in as themselves. **Household** opens a household-ledger membership. **Personal** currently filters that household snapshot for the signed-in member. A dedicated durable personal-ledger cloud scope remains required before D-112 is complete.

Invite/bootstrap/recover with a **three-word phrase**, a **join link**, or a **Hearth Pass** when useful. Those tools are not the durable storage or authentication model. A new signed-in device must work while every old device is offline.

## Dual Course

Family-office books weigh **5**. Hercules and other interactables weigh **3**. Each update should improve the other course. If they conflict, the books win. Living law: [docs/STRATEGY.md](docs/STRATEGY.md). Living plan: [docs/HEARTH_ROADMAP.md](docs/HEARTH_ROADMAP.md).

## Docs

Start here:

- Agent constitution: [AGENTS.md](AGENTS.md) ([CLAUDE.md](CLAUDE.md) includes it for Claude)
- Living roadmap: [docs/HEARTH_ROADMAP.md](docs/HEARTH_ROADMAP.md) (`docs/ROADMAP.md` and `docs/PRODUCT_ROADMAP.md` are pointers)
- Cloud continuity: [docs/CLOUD_CONTINUITY.md](docs/CLOUD_CONTINUITY.md)
- Docs index: [docs/README.md](docs/README.md)
- Dual Course strategy: [docs/STRATEGY.md](docs/STRATEGY.md)
- AI operating model: [docs/AI_OPERATING_MODEL.md](docs/AI_OPERATING_MODEL.md)

Also living:

- Hercules: [docs/HERCULES.md](docs/HERCULES.md)
- Hercules mark: [docs/HERCULES_MARK.md](docs/HERCULES_MARK.md)
- Audit Office: [docs/AUDIT_OFFICE.md](docs/AUDIT_OFFICE.md)
- Accounts Floor: [docs/ACCOUNTS.md](docs/ACCOUNTS.md)
- Google household bridge: [docs/GOOGLE.md](docs/GOOGLE.md)

History (read, do not build from): [docs/nostalgia/](docs/nostalgia/) · [docs/reference/](docs/reference/)

The Google Sheets / Apps Script prototype is archived as reference under `docs/reference/sheets-era/` and as git tag `sheets-v0.0.31`. It is not the working tree.

## Disposable Development now; security cutover before October

Through 2026-09-30, hosted rows are disposable Development data and may remain openly readable/writable while cloud continuity is built. Do not call them private. Google Auth, durable personal/household membership, and deny-by-default RLS must ship before meaningful October data.

These still remain blocked until that security foundation and their own gates are complete:

- Real privacy for personal rows (a hidden screen is still visible on a shared phone)
- Bank import adapters that write, Open Banking, Interac APIs, issued cards
- Hosted private documents and other sensitive sources

Live Google Sheets writes are gone with the prototype; Google is a household bridge and never posts money.
