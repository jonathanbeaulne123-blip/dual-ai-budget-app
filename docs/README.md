# Current docs

Hearth is the product. Current planning and build canon is in this folder, led by Jonathan's latest instruction and the living files below. The nostalgia and reference folders are Jonathan's personal museum: they are not planning inputs and must not be cited as next work.

**Start here:** [AGENTS.md](../AGENTS.md) (agent constitution) · [HEARTH_ROADMAP.md](HEARTH_ROADMAP.md) (living plan) · [README](../README.md) (run the app).

| File | Use |
|---|---|
| [../AGENTS.md](../AGENTS.md) | Shared agent constitution. Cursor Cloud and repo agents load this file. |
| [../CLAUDE.md](../CLAUDE.md) | Claude entry: includes `AGENTS.md`, then Claude’s UX/Hercules posture |
| [HEARTH_ROADMAP.md](HEARTH_ROADMAP.md) | Living phased roadmap, Updates history, rival matrix, AI workflow, Dual Course deltas, gates, risks, and proofs |
| [CLOUD_CONTINUITY.md](CLOUD_CONTINUITY.md) | Google-account access from any device, cloud/PGlite roles, the disposable-data window, and the late-September security milestone |
| [WORKING_MEMORY.md](WORKING_MEMORY.md) | Chat-thread recap; update when its shipped baseline drifts |
| [STRATEGY.md](STRATEGY.md) | Dual Course vision: family-office books (weight 5) and companion/interactables (weight 3) |
| [PROJECT_CHARTER.md](PROJECT_CHARTER.md) | Who Hearth is for and what success looks like |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Ledger, books, UI, and how the two courses couple |
| [BATCH_IMPORTS.md](BATCH_IMPORTS.md) | QFX/OFX and selected document-image inbox, duplicate lanes, Confirm boundary, provider and release truth |
| [DECISIONS.md](DECISIONS.md) | Living decision log |
| [AI_OPERATING_MODEL.md](AI_OPERATING_MODEL.md) | Codex, Cursor, and Claude roles, routing, evidence, authority, and context budget |
| [AI_HANDOFF.md](AI_HANDOFF.md) | Risk routing and Dual Course handoffs |
| [AI_SETUP_FOR_JONATHAN.md](AI_SETUP_FOR_JONATHAN.md) | Click-by-click activation and verification for the repository AI configuration |
| [GOOGLE.md](GOOGLE.md) | Household Google bridge: identity, Calendar, opt-in suite; never posts money |
| [HERCULES.md](HERCULES.md) | Companion laws and product guidance |
| [HERCULES_MARK.md](HERCULES_MARK.md) | Mark and runtime asset guidance |
| [HERCULES_AI.md](HERCULES_AI.md) | Resident data-scientist boundary, payload, notices, and memory guidance; reconcile with current decisions when stale |
| [ONBOARDING_UPDATE.md](ONBOARDING_UPDATE.md) | Four-part Hercules-led onboarding plan, button/feature audit, Bianca journey, scripts, architecture direction, and gates |
| [ONBOARDING_PART2_STORYBOARD.md](ONBOARDING_PART2_STORYBOARD.md) | Locked phone/desktop routes, focus camera, dialogue, Practice scenarios, failure recovery, implementation slices, and D-129 exception |
| [briefs/CURSOR_ONBOARDING_FOUNDATION_PROMPT.md](briefs/CURSOR_ONBOARDING_FOUNDATION_PROMPT.md) | Bounded Cursor Slice A foundation prompt with multi-model review and no migration/provider overlap |
| [OFFICE.md](OFFICE.md) | Office direction; reconcile with shipped Office/mobile state when stale |
| [CLAUDE_DESKTOP_OFFICE.md](CLAUDE_DESKTOP_OFFICE.md) | Claude desktop-office prompt |
| [CLAUDE_MOBILE_SHELL.md](CLAUDE_MOBILE_SHELL.md) | Shipped phone Home prompt/history |
| [CLAUDE_OFFICE_UX.md](CLAUDE_OFFICE_UX.md) | Historical Office prompt |
| [AUDIT_OFFICE.md](AUDIT_OFFICE.md) | Statements, reconciliation, and close guidance |
| [ACCOUNTS.md](ACCOUNTS.md) | Wallet, cards, and investments guidance |
| [APPOINTMENTS.md](APPOINTMENTS.md) | Visits, claims, receivables, and Appointments guidance |
| [ENVIRONMENTS.md](ENVIRONMENTS.md) | Development versus production, website, and hosted books |
| [CURRENT_PATH.md](CURRENT_PATH.md) | Frozen command path as inspected on main before this trust rewrite |
| [claude/COMMAND_CONTRACT.md](claude/COMMAND_CONTRACT.md) | Typed write-surface states for Claude (no toast-inferred posting) |
| [CLAUDE_COMMAND_STATES_UX.md](CLAUDE_COMMAND_STATES_UX.md) | Command/continuity/conflict/recovery UX spec — merged [PR #76](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/76) |
| [HOSTED_ROW_INVENTORY.md](HOSTED_ROW_INVENTORY.md) | Leftover hosted-row runbook. Metadata only. Do not delete without Jonathan. |
| [sql/rls_auth_ready.sql](sql/rls_auth_ready.sql) | Legacy Auth/RLS sketch — do not apply; superseded by cutover packet |
| [AUTH_RLS_CUTOVER.md](AUTH_RLS_CUTOVER.md) | Living Auth/RLS cutover (D-123); 004/005/007/008 applied; Google Auth live; **006 not applied** (path B NOTICE + ceiling 1 ready) |
| [`sql/006_preflight_readonly.sql`](sql/006_preflight_readonly.sql) | Read-only 006 go/no-go queries — re-run before paste |
| [`sql/009_rollback_006.sql`](sql/009_rollback_006.sql) | Rollback packet after 006 — rehearse on a clone first |
| [`sql/apply_006_auth_rls_cutover.md`](sql/apply_006_auth_rls_cutover.md) | Paste pointer for 006 (awaiting Jonathan approve) |
| [`sql/delete_empty_production_household.sql`](sql/delete_empty_production_household.sql) | Jonathan-approved delete of empty Production `HH-9465baf2ec6c9d9d` (paste in SQL Editor) |
| [`sql/apply_008_production_continuity_select.sql`](sql/apply_008_production_continuity_select.sql) | Paste-ready 008 SELECT bridge (Jonathan approved 2026-08-25) |
| [`sql/008_seed_production_owner_TEMPLATE.sql`](sql/008_seed_production_owner_TEMPLATE.sql) | Privileged Production owner seed + Personal extract template — fill placeholders; Jonathan approval required |
| [SUPABASE_GOOGLE_AUTH_SETUP.md](SUPABASE_GOOGLE_AUTH_SETUP.md) | Step-by-step Google provider + redirect URLs for Supabase Auth (D-123 Q1 A) |
| [`../supabase/migrations/004_auth_rls_prepare.sql`](../supabase/migrations/004_auth_rls_prepare.sql) | Additive Auth preparation — applied 2026-08-24 |
| [`../supabase/migrations/005_snapshot_cas_hardening.sql`](../supabase/migrations/005_snapshot_cas_hardening.sql) | Forward repair for live 002 CAS — applied 2026-08-24 |
| [`../supabase/migrations/006_auth_rls_cutover.sql`](../supabase/migrations/006_auth_rls_cutover.sql) | Preflighted deny-by-default project-wide cutover — **not applied**; Production/project boundary decision required |
| [`../supabase/migrations/007_household_timezone_iana.sql`](../supabase/migrations/007_household_timezone_iana.sql) | D-126 hosted IANA timezone CHECK — **applied** 2026-08-25 (schema id 7) |
| [`../supabase/migrations/008_production_continuity_select.sql`](../supabase/migrations/008_production_continuity_select.sql) | SELECT-only Production continuity bridge — **applied** 2026-08-25 (schema id 8) |
| [SITDOWN.md](SITDOWN.md) | Monthly sitdown, leftover, lock, reverse, and export guidance |
| [GOALS.md](GOALS.md) | Goals vault and leftover parking |
| [GITHUB_WORKFLOW.md](GITHUB_WORKFLOW.md) | Private repository and publish workflow |
| [briefs/](briefs/) | Paste-ready AI work packets derived from the living roadmap |
| [worksessions/](worksessions/) | Open/close records for bounded worksessions and the reusable [template](worksessions/TEMPLATE.md) |
| [nostalgia/](nostalgia/) | Cursor-era maps we outgrew. Read to understand past decisions. Do not cite as the next build plan. |
| [reference/](reference/) | Sheets-era snapshot. Read to understand how we got here. Do not cite as the next build plan. |

Start from the repository [README](../README.md) to run the app. Compatibility filenames such as `ROADMAP.md` and `PRODUCT_ROADMAP.md` point to the maintained roadmap.
