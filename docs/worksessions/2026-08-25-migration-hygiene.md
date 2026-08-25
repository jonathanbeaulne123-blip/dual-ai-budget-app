# Hearth worksession — Migration hygiene (007 rename + apply readiness)

- **Status:** OPEN — repo hygiene in progress; hosted applies await Jonathan
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/migration-hygiene-f375`
- **Baseline SHA:** `a1b040e` (`main`)
- **Head SHA:** (pending)
- **PR or issue:** (pending)
- **Risk:** Medium (docs + unapplied SQL rename); hosted apply is High/Release and not performed here
- **Decision owner:** Jonathan
- **Environment impact:** none applied this session

## Household outcome

Migration files on `main` are uniquely numbered and apply-tooling-safe. Hosted timezone CHECK and Auth/RLS cutover remain Jonathan-gated.

## Budget delta (5)

`+1` — clearer hosted schema path; no money meaning change until apply

## Engagement delta (3)

`0`

## Verified baseline

- Live schema_migrations ids `[2,4,5]` per living docs
- Auth `004` and timezone formerly both named `004_*` (collision)
- No `SUPABASE_DB_PASSWORD` in this agent environment

## Scope

### In scope

- Rename D-126 hosted packet to `007_household_timezone_iana.sql` with id 7
- Ambiguous-prefix guard in apply script; `pnpm books:apply:007`
- Living docs / brief / index updates

### Out of scope

- Applying 007 or 006 without Jonathan's explicit approval
- Google Auth provider / secrets
- Moving Production to another project
- Closing superseded PRs without Jonathan confirmation

## Acceptance evidence

- [ ] Exactly one `007_*.sql`; no `004_household_*`
- [ ] Apply script rejects ambiguous prefixes
- [ ] `pnpm test` / `tsc` clean
- [ ] Jonathan decisions for remaining applies

## Plan

- [x] Rename timezone packet + schema_migrations row
- [x] Harden apply tooling
- [ ] PR for Jonathan
- [ ] Interrupt: Jonathan applies 007 and/or chooses 006 project boundary

## Evidence log

- (pending commit)

## Remaining uncertainty

Whether Jonathan wants a separate Dev Supabase project before 006.

## Handoff

Jonathan: (1) approve/apply `007`, (2) A/B project boundary for `006`, (3) optionally close superseded PRs #87/#89.
