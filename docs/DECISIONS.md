# Decision Log

Current product and architecture decisions for Hearth. Historical Sheets conversation does not override an accepted entry unless Jonathan changes it.

| ID | Status | Decision | Reason |
|---|---|---|---|
| D-001 | Accepted | Git is the canonical source for code, tests, architecture, and release preparation. | Prevent full-file drift. |
| D-002 | Accepted | Keep separate development and production ledgers. | Reversible testing without risking household history. |
| D-005 | Accepted | Jonathan is product owner, production approver, and tie-breaker. | Product tradeoffs belong to the user. |
| D-007 | Accepted | Use calendar months and `America/Toronto`. Week bounds use the civil date, never local midnight. | Match the household and handle DST. |
| D-008 | Accepted | Transfers are neither income nor expense. They are a paired movement between accounts. | Prevent double counting. |
| D-009 | Accepted | Ownership is a splits array that must sum to the amount. Joint is explicit. | Blank member columns will not scale. |
| D-011 | Accepted | Defer bank integrations; keep an import-shaped command path. | Core reliability first. |
| D-015 | Accepted for now | Personal goals and personal ledger rows are a visibility filter, not privacy. Hidden UI is not a security boundary. | Two household editors can share a phone; genuine privacy needs auth. Each person should use their own phone. |
| D-030 | Accepted | Every money row has visibility `household`, `personal`, or `both`, plus `createdBy`. Household view shows household+both. Personal view shows that member's personal+both. | Jonathan and Bianca asked for a shared household database and a personal one each. |
| D-032 | Accepted | Household pairing is a three-word kitchen phrase, a tap-to-join URL, and a Hearth Pass file. A typed six-character blob key is a fallback, not the product. Cloud publish is optional. | The previous code feature failed whenever the host had no function, and six characters were the wrong object to put in Bianca’s hands. |
| D-016 | Accepted | Expense leaves purchasing power; income enters; transfer moves between household accounts; refund reduces category spend. Credit-card payments are transfers, not expenses. | Stops the four meanings collapsing into one catch-all. |
| D-021 | Accepted | CAD is the only currency. Account currency is authoritative. Writers refuse non-CAD active accounts. | No silent USD labels, no amount conversion. |
| D-022 | Accepted | Show an account selector whenever more than one account exists. Seed data includes chequing, Visa, and cash. | Prevent first-active-account from becoming a hidden defect. |
| D-023 | Accepted | Rebuild the working interface as a phone-first web app while keeping the domain portable. | Sheets was the prototype; it is no longer the product. |
| D-025 | Accepted | Browser validation is a usability aid. Commands are the trust boundary. | Stale or altered UI must not write bad money. |
| D-033 | Accepted | The books are a double-entry PostgreSQL ledger. Commands still validate and commit an in-memory snapshot; after each commit that snapshot is posted into balanced journal lines. PGlite (Postgres 18) is the in-app engine. The same schema is what you load on Neon or Supabase. Netlify Blobs are not a ledger. | JSON blobs cannot enforce debit = credit, cannot produce a trial balance, and failed as a shared database on functionless hosts. |
| D-026 | Accepted | One command is one snapshot replace with an undo snapshot. Derived flags refresh after the durable replace. The SQL journal is rebuilt from that snapshot inside a database transaction so the books cannot drift mid-write. | Partial writes cannot exist in this runtime. |
| D-028 | Accepted | One shift is one settings-driven calculation, one source row, one wages income, one tips income. Negative net tips remain allowed. | Preview/post disagreement is a financial bug. |
| D-029 | Accepted | Add Category uses the same commit/undo path as money. | Partial category+budget rows were how CAT-INCOME returned. |
| D-034 | Accepted | Hosted books are the Jonathan/Bianca Supabase Postgres project (`tykhocwacaxwquhynkok`, us-east-1). The app uses the publishable key and PostgREST. Schema apply uses the IPv4 session pooler or the dashboard SQL Editor — never the database password in the client. Direct `db.*.supabase.co` is IPv6-only. The API secret cannot CREATE TABLE. The publishable key is not a privacy boundary until Auth exists. | The publishable key can read tables but cannot CREATE TABLE. Direct Postgres is IPv6. Netlify Blobs are not the ledger. |
| D-020 | Open | Enable two-factor authentication on Jonathan's GitHub account. | The canonical remote still needs it. |
