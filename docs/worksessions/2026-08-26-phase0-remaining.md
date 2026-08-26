# Hearth worksession — Phase 0 remaining (linked demotion, atomic honesty, KV, protection, working memory)

- **Status:** OPEN (proof in progress)
- **Opened:** 2026-08-26 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** dual-ai-budget-app
- **Branch:** `cursor/phase0-remaining-c04e`
- **Baseline SHA:** `391e3af860e605eaa9d437a12c94056a505c46a2` (`main` after #156 / D-146)
- **Head SHA:** (commit after this packet)
- **PR or issue:** (open on push)
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development client + Worker guard + living docs. No Production schema. No hosted row deletes. KV namespace create/deploy and GitHub rulesets require Jonathan (API 403 / Cloudflare account).

## Household outcome

Ordinary Hearth use is Google continuity without **Publish to the cloud**. Local books and cloud share stay separate failure domains. Hosted Personal/Shared partial failures never ack as success. Hercules rate limiting documents durable KV. Branch protection steps are recorded for Jonathan. WORKING_MEMORY matches current main.

## Budget delta (5)

`+3` — remove misleading Publish authority; fail closed on partial hosted writes and legacy race when CAS is expected.

## Engagement delta (3)

`+1` — Invite chrome matches the real Google door; less false “publish” ceremony.

## Verified baseline

- `main@391e3af` (D-146 membership tuple + hash acceptance merged via #156).
- D-143/D-145 already on main; Publish was still Auth-off primary until this packet.
- `wrangler.jsonc` has no `HERCULES_RATE` KV binding; rulesets `[]`; gh integration cannot write protection.

## Scope

### In scope

1. Demote Publish/`linked` UX and commandRuntime gate; Advanced recovery only (Auth-off)
2. Refuse legacy racy publish when CAS expected; Personal/Shared partial-failure honesty + tests
3. Hercules KV runbook + concurrent failure semantics tests (no placeholder ids in wrangler)
4. Branch-protection runbook for Jonathan
5. Rewrite WORKING_MEMORY; check Phase 0 drift checkbox

### Out of scope

- Live two-browser E2E, Production CAS apply, Worker deploy, GitHub ruleset apply, KV namespace create (Jonathan)
- Personal+Shared single SQL transaction (schema)

## Acceptance evidence

- [x] Auth-on Pairing has no primary Publish; Auth-off Publish is Advanced only
- [x] commit transport does not OR on `linked`; tests green
- [x] CAS-expected path refuses legacy race; Personal fail after shared CAS does not ack
- [x] Guard tests cover concurrent/missing-KV semantics; binding runbook (no fake wrangler ids)
- [x] Branch protection runbook committed
- [x] WORKING_MEMORY reflects current main facts
- [ ] Full `pnpm check` / auditors / PR

## Evidence log

- Focused vitest 66/66 after rebase onto `391e3af`.

## Decisions

- **D-147** (this packet). D-146 remains identity tuple + hash (#156).

## Remaining uncertainty

- Cloudflare KV id unknown until Jonathan creates namespace
- GitHub ruleset apply requires owner token
- Full atomic Personal+Shared TX still open

## Handoff

Jonathan: create KV namespace + deploy Worker; apply GitHub ruleset from runbook; review PR.
