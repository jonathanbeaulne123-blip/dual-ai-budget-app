---
paths:
  - "src/core/**/*.ts"
  - "src/{App,Books,Ledger,Accounts,SitDownGuide,DailyHearth}.tsx"
  - "workers/**/*.js"
  - "sql/**/*.sql"
  - "scripts/apply-supabase-schema.mjs"
  - "test/**/*.{ts,tsx}"
---

# Money trust boundary

- UI is untrusted. It may preview and call a named Command after visible Confirm; it must not mutate snapshots, journal lines, or PGlite directly.
- Companion, cosmetic, weather, layout, Google, recurrence-definition, close, and mark code never posts money.
- Expense reduces purchasing power, income increases it, refund reduces spend, and transfer moves value. Card paydown is a transfer.
- Store CAD as integer cents. Use `YYYY-MM-DD` civil dates in `America/Toronto`.
- Splits total the amount exactly. Joint ownership is explicit.
- Every money document compiles to balanced double-entry lines. The journal wins over a projection or statement.
- Run Health against the full snapshot, not a visibility-filtered view.
- Hosted Supabase is snapshot transport and remains disclosed until Auth plus restrictive RLS exist.
- Posting, transfer meaning, splits, statements, sync, schema, Auth/RLS, or hosted-write changes are High risk and require independent review plus focused tests.
