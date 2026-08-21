# Comparison with the Sheets app on `main`

This rebuild exists to be compared, not merged blindly. `main` remains the live-verified Apps Script project.

| Review finding | Sheets `main` | Hearth on this branch |
|---|---|---|
| Add Transaction trust boundary | Pure validator + locked three-stage Sheet commit | Same validator ideas; one snapshot replace, nothing partial |
| Add Shift preview = post | `calcShiftAmounts_` shared | Same math, same test vectors, receipt UI |
| Duplicate fingerprint vs flag vs `Is_Duplicate` | Correct, O(n), locked | Same three fields; flags refresh after every commit |
| CAD from the account | v0.0.30 | Account currency copied; non-CAD refused |
| Add Category integrity | Unlocked, untested, can partial-write | Same command/undo path as money |
| This Week timezone | `setHours(0,0,0,0)` in runtime local time | Toronto civil date → Sunday week |
| Ownership | Blank `Member_ID` = joint | Explicit splits that must sum |
| Transfers | Decision only; type is Income/Expense | First-class paired transfer, excluded from totals |
| Refunds / card payments | Open D-016 | Refund reduces spend; card payment is a transfer |
| Dashboard | Script-rewritten spreadsheet | Home pulse, net, week, goals |
| Bianca UX | 15-item Budget Tools menu | Four tabs and one add sheet |
| Tests | Writers and migrations; not budget math | Calendar, shift, splits, ledger, health, 12×200 load |
| God file | 3,333-line `Code.gs` | `src/core/*` plus one UI app |
| Dev vs prod | Two Google projects | Two named local snapshots, labeled in the chrome |
| Shared household | One Sheet both edit | Phrase + join link + Hearth Pass; Postgres books on the phone; optional cloud envelopes |
| Books | Spreadsheet cells | Double-entry journal, trial balance, account register, read-only SQL |
| Hosting | Google | PGlite in-app; Supabase for hosted Postgres; Cloudflare Workers for the website; Netlify is rollback only |
| Personal vs household entries | Hidden sheet / filter only | Shared, Personal, or Both on every add; two views |
| Docs drift | README/AGENTS lagged PR #16 | Docs generated with this runtime |
| Goals / recurring | Schema, unwired | Working, small, reversible |
| Bank import | Intentionally deferred | Still deferred; JSON export exists |

Keep `main` until Jonathan is sure. This branch is the alternative, not a clasp push.
