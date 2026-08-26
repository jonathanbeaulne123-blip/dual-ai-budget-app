# Sheets-era tracker archive — retained evidence

> **Recorded 2026-08-26 (`America/Toronto`).** Living Phase 0 hygiene. Issues and PRs below are closed or superseded. Do not reopen them as the plan. Prefer living canon (`docs/HEARTH_ROADMAP.md`, `docs/DECISIONS.md`) and current `main`.

Hearth no longer runs Google Sheets / clasp. Sheets-era tracker items were archived after recording where their useful work went (or why they were dropped). **Do not delete GitHub history.**

## Closed Sheets-era issues

| Issue | Title | Closed | Reason | Retained evidence / replacement |
|---|---|---|---|---|
| [#1](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/1) | [Review] Transaction Input end-to-end | 2026-08-24 `NOT_PLANNED` | Sheets review tracker; product left Sheets | Hearth rebuild + command Confirm path on `main`; museum under `docs/reference/` |
| [#2](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/2) | [Review] Tip Tracking and Add Shift end-to-end | 2026-08-19 `COMPLETED` | Sheets tip review completed / absorbed | D-127 job-based work flow + Timesheet on `main` |
| [#3](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/3) | [Review] Dashboard usefulness, freshness, and mobile layout | 2026-08-24 `NOT_PLANNED` | Sheets dashboard review; UI is Office/phone | U-05 Office/mobile split; `OfficePhone`; living UX theme packet |
| [#4](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/4) | [Architecture] Cross-feature reliability and scale audit | 2026-08-24 `NOT_PLANNED` | Sheets-scale audit; engine is PGlite | D-111 `acceptHouseholdWrite`; living `ARCHITECTURE.md` |
| [#5](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/5) | [Release] September 1 functional test build | 2026-08-24 `NOT_PLANNED` | Sheets September build cancelled | Cloudflare kitchen from GitHub `main` (D-041); no clasp |
| [#6](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/6) | [Fix] Transaction Input concurrency-safe writes | 2026-08-19 `COMPLETED` | Sheets fix completed before rebuild | Superseded by Confirm + `acceptHouseholdWrite` idempotency |
| [#7](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/7) | [Fix] Authoritative server validation for Transaction Input | 2026-08-18 `COMPLETED` | Sheets validation | Kernel `ValidationError` / Confirm boundary on `main` |
| [#8](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/8) | [Scale] Remove 5,000-row duplicate-detection limit | 2026-08-18 `COMPLETED` | Sheets duplicate scale | Batch import duplicate lanes (D-130); PR [#11](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/11) merged in Sheets era |
| [#9](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/9) | [Decision] Currency, accounts, mobile Transaction Input | 2026-08-18 `COMPLETED` | Product decisions locked | CAD integer cents; D-047 accounts; phone Add path |
| [#10](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/10) | [Fix] CAD authoritative currency | 2026-08-19 `COMPLETED` | CAD fix | Living law in `AGENTS.md`; PR [#15](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/15) |
| [#14](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/14) | [Performance] Reduce Add Transaction full-ledger reads | 2026-08-24 `NOT_PLANNED` | Sheets lock-performance; not applicable | PGlite + snapshot model; no Sheets document lock |

Zero open issues remain on the repository as of this record.

## Superseded / closed-without-merge PRs (retained commits or clean rebuilds)

| PR | Title | Disposition | Retained evidence |
|---|---|---|---|
| [#18](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/18) | Cloud env + AGENTS notes | Closed; stacked under rebuild | Cloud notes live in `AGENTS.md` |
| [#19](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/19) | Living Hearth AI QA pack | Closed `NOT_PLANNED` stack | Living AI docs / skills replace the Sheets-era pack |
| [#22](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/22) | Publish hearth-books from main | Closed; deploy path shipped elsewhere | D-041 worker deploy from `main` |
| [#24](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/24) | Point kitchen URL at Daily Hearth | Closed; product renamed Hearth | Live worker `hearth-books` |
| [#46](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/46) | Put live Google back on roadmap | Closed | `docs/GOOGLE.md` + D-114 continuity |
| [#47](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/47) | Two UI shells mobile-only | Closed | D-079 `OfficePhone`; desktop Office retained |
| [#50](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/50) | CPA memo adjudication | Closed | Living Office / CPA personality docs |
| [#61](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/61) | Due-on-open (stale D-107 stack) | Closed; rebuilt cleanly | D-108 on `main` via clean salvage (#81 lineage) |
| [#63](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/63) | Git-main chat host / IP limit | Closed; salvaged | D-121 via merged [#79](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/79) |
| [#66](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/66) | Three AI roles config | Closed; do not revive | Superseded by clean [#88](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/88) |
| [#67](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/67) | AGENTS/roadmap visibility | Closed | Content merged through later docs PRs |
| [#87](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/87) / [#89](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/89) | Auth/RLS + CAS apply drafts | Closed; work landed via apply path | D-122/D-123; migrations 002–008 applied with Jonathan approval |

Merged Sheets/Hearth transition anchors: [#17](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/17) (Hearth product; Sheets → `docs/reference/`), tag `sheets-v0.0.31` for Apps Script recovery.

## Current open PRs (not Sheets-era)

As of this record only living drafts remain (for example continuity/naming work). They are not archived by this document.

## Phase 0 checkbox

`Archive or supersede stale Sheets-era issues and PRs only after recording retained evidence` — satisfied by this file plus zero open Sheets-era issues.
