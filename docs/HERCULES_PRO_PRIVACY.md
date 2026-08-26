# Hercules Pro privacy notice

Last updated: 2026-08-25

Hercules Pro is an optional connection between a person's ChatGPT account and the Hearth Development household they explicitly approve. Free Hercules inside Hearth does not require this connection. Read access is the default; write access is a separate, reversible member choice for the Personal ledger and/or shared Household ledger.

When connected, Hercules Pro may read the approved member identifier, household identifier, Google-linked Hearth identity, posted Personal ledger facts belonging to that member, shared Household ledger facts, accounts, transactions, bills, shifts, goals, claims, budgets, audit findings, and duplicate-review candidates needed to answer the person's question. It does not expose another member's Personal ledger. If the member opts in to writing, ChatGPT may also receive an encrypted, short-lived confirmation token containing the exact proposed transaction and may post that proposal after explicit confirmation. The token is bound to that identity, member, household, environment, ledger revision, and proposal.

Write permissions are stored in the member's Personal continuity envelope, not the shared household projection. A confirmed Personal write and its shared exactly-once receipt are committed atomically; Personal transaction rows remain outside the shared payload. Hearth rechecks active membership and the current permission at confirmation time, so opting out invalidates prepared writes.

Hearth uses the Google-linked Supabase session to verify membership on every ledger load. Its short-lived access and refresh credentials are encrypted inside Worker-issued tokens. Ledger text is sent to ChatGPT only through read-tool results requested during the connected conversation. ChatGPT's own storage and privacy practices are governed by the person's ChatGPT account and OpenAI's terms.

The optional animated companion is served from the same Hearth Worker as static JavaScript and a compressed 3D model. Its tool output contains only a mood, short display line, headline, and Personal/Household label. It receives no Supabase credential, Hearth access or refresh token, confirmation token, raw journal rows, or extra third-party tracking. The visual cannot read or write a ledger by itself.

Disconnecting or revoking the Hearth/Google membership stops future reads. During the pre-October 2026 Development trial, test data is disposable. Production access stays disabled until Hearth's planned security review and cutover. Do not enter meaningful October data before that cutover is complete.

Questions or deletion requests may be filed through the repository: https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues
