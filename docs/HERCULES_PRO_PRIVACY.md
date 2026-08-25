# Hercules Pro privacy notice

Last updated: 2026-08-25

Hercules Pro is an optional, read-only connection between a person's ChatGPT account and the Hearth Development household they explicitly approve. Free Hercules inside Hearth does not require this connection.

When connected, Hercules Pro may read the approved member identifier, household identifier, Google-linked Hearth identity, posted Personal ledger facts belonging to that member, shared Household ledger facts, accounts, transactions, bills, shifts, goals, claims, budgets, audit findings, and duplicate-review candidates needed to answer the person's question. It does not expose another member's Personal ledger and has no tools that add, edit, delete, post, pay, transfer, merge, or sync money.

Hearth uses the Google-linked Supabase session to verify membership on every ledger load. Its short-lived access and refresh credentials are encrypted inside Worker-issued tokens. Ledger text is sent to ChatGPT only through read-tool results requested during the connected conversation. ChatGPT's own storage and privacy practices are governed by the person's ChatGPT account and OpenAI's terms.

Disconnecting or revoking the Hearth/Google membership stops future reads. During the pre-October 2026 Development trial, test data is disposable. Production access stays disabled until Hearth's planned security review and cutover. Do not enter meaningful October data before that cutover is complete.

Questions or deletion requests may be filed through the repository: https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues
