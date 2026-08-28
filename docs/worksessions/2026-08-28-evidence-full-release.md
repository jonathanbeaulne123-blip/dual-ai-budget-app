# Hearth worksession — Evidence Mesh full release

- **Status:** OPEN; FULL RELEASE LIVE, AUTHENTICATED DATA HOOKUPS PENDING
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/evidence-full-release`
- **Baseline SHA:** `4418c830e5fbfea422786663533d5e3f0b7d2b6d`
- **Head SHA:** `34091089005991c8a2ae8cc0054217c4d2f9aabd` (release), follow-up startup fix pending
- **PR or issue:** #234 merged; startup-fix PR pending
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** Development and Production

## Household outcome

Release the complete member-owned 7shifts Evidence Mesh: real selected captures, email ingress, official 7shifts adapter, and opt-in deterministic automation in Development and Production without weakening environment, membership, accounting, or encrypted-vault boundaries.

## Budget delta (5)

`+5` — complete worked-time and earnings evidence can reach ordinary Hearth calculations, deterministic command acceptance, and payroll-week correction.

## Engagement delta (3)

`+3` — capture and reconciliation become usable from Hearth, browser, iPhone, calendar, files, and email.

## Verified baseline

- PR #233 merged at `main@efbe5ed`; pull-request and post-merge CI/Cloudflare workflows passed.
- Live Worker reports Evidence unavailable, 7shifts provider calls disabled, and Production refused.
- Development Evidence D1/R2/Queue/DLQ and `EVIDENCE_KEK_V1` exist; migrations 0001/0002 are applied.
- Local Miniflare proof passed the real Worker bundle with D1/R2/Queue, encryption, extraction, scope denial, tamper refusal, deletion, limits, and queue ordering.

## Scope

### In scope

- Separate Development and Production storage/binding isolation.
- Real selected capture and export/delete.
- Email routing and bounded raw MIME capture.
- Official 7shifts connector when an administrator token or approved OAuth credential exists.
- Explicit member/job automation policies and deterministic receipts.
- Production deployment and activation after live preflight passes.

### Out of scope

- Password, cookie, bearer-token, or session scraping.
- Unauthenticated capture or cross-member access.
- Model-, schedule-, calendar-, or email-triggered money authority.
- Invented credentials, provider identity, job mapping, or missing money fields.

## Acceptance evidence

- [x] Exact Development and Production resources, bindings, migration state, key names, and retention limits verified.
- [x] Current Supabase membership/RLS and authenticated command receipt path verified by exact-scope Worker and continuity tests without service-role exposure.
- [ ] Email domain/routing and member alias flow verified with a bounded real message.
- [ ] Official 7shifts credential and company/member/job mapping verified with read-only provider smoke.
- [ ] Real selected capture can upload, derive, review, export, and delete under the exact member.
- [ ] Opt-in automation proves initial post, retry receipt, and correction/variance behavior for one approved job.
- [x] Production cross-environment/member denial, rollback, kill switches, and zero unintended rows/objects verified locally; both live Production databases report zero business rows and zero Evidence bytes/objects.
- [x] Full repository, Worker, migration, accounting, privacy, and build proof has no packet P0/P1. Full suite: 1,034 passed / 2 skipped / 2 unrelated known failures (Windows `bash` unavailable; stale Hercules office source-shape assertion).

## Plan

- [x] Create a clean release branch and reconcile current `main@4418c83`.
- [x] Inventory live credentials, routes, resources, policy state, and Production refusal code.
- [x] Implement and prove separate Production resource bindings and explicit activation controls.
- [x] Reconcile email, official API, real capture, and automation prerequisites.
- [x] Push/merge the exact reviewed release packet.
- [x] Provision and apply in gated order with rollback/kill-switch proof; deployment waits on the reviewed merge.
- [ ] Run authenticated real-data smoke and record exact results.

## Evidence log

- 2026-08-28: Jonathan explicitly requested the “full version now,” superseding the prior synthetic-Development-only activation scope. No credential may be invented and every live component still has to pass its own preflight.
- 2026-08-28: Provisioned Production Evidence D1 `22795053-4d63-4b2d-b1de-722177238fac`, Production 7shifts D1 `dfb87d4f-f2e1-4860-958f-afa45df82548`, private Production R2, Queue, and DLQ. Applied both Production Evidence migrations and the Production 7shifts migration.
- 2026-08-28: Added five random Worker secrets through inactive version `ec744d23-5cdd-4c9a-97f9-b49bdf6f61a7`; values were generated in memory and never printed or stored. The currently deployed version still has all activation flags off.
- 2026-08-28: Cloudflare Email Routing reports no zones in the account. Email activation is blocked on a managed domain/zone, not on application code.
- 2026-08-28: Current-main reconciliation completed at `4418c83`, including the shared KitchenNotice changes in `SevenShiftsConnectPanel`. Focused post-reconcile set passed 41/41.
- 2026-08-28: Dual-environment local D1/R2/Queue harness passed 3/3, focused Evidence/7shifts/accounting/privacy proof passed 111/111, TypeScript and AI verification passed, Vite/Hercules production builds passed, and Wrangler dry-run listed every Development/Production binding with activation flags on except email.
- 2026-08-28: Full repository run completed 1,034 passed / 2 skipped / 2 unrelated known failures. `git diff --check 4418c83` passed with line-ending notices only.
- 2026-08-28: PR #234 merged as `cd74d360c799ca8a07b0468595ba4bbefe2e57e1`; post-merge CI, Supabase Preview, Pages, and Workers Builds all passed. Live version `88425759-73a4-4d92-a550-7d961ac252cf` carries both environment planes, queues, and encryption-key bindings. Evidence and 7shifts are globally available in both environments; email alone remains disabled because no Email Routing zone exists.
- 2026-08-28: The first real browser startup smoke caught React hook-order error #310: the D-157 wake effect sat below App's boot/welcome early returns. The effect was moved above every early return and an exact regression test was added. Focused UI/Evidence proof passed 24/24, TypeScript and AI verification passed, both production builds passed, and a built-app browser smoke reached the welcome screen with zero console errors. The full suite is now 1,035 passed / 2 skipped / the same 2 unrelated failures; hosted redeploy is pending the follow-up review/merge.
- 2026-08-28: PR #235 merged the startup repair as `c1ef00064cff4a02c77b7f0061a7e0197eeec4fc`; the live signed-in Development kitchen and Evidence Center rendered with zero fresh console errors. That smoke also found the header pill was still hard-coded to Development, leaving the enabled Production plane unreachable from the product. The pill now reflects the selected environment and opens the existing Google-step-up Development/Production switch; focused environment/Evidence proof passed 18/18 and TypeScript/build passed.

## Decisions

- Full scope does not collapse Development and Production into one storage plane. Each environment must have distinct D1/R2/Queue resources and encryption context.
- Automation remains explicit per member/job; globally enabling the feature does not create an automation policy or post money by itself.

## Remaining uncertainty

- Cloudflare has no Email Routing zone/domain in this account; one must be supplied before email can be enabled.
- A valid 7shifts administrator token and exact company/member/job mapping still require Jonathan or the restaurant administrator.
- Production resources, keys, and migrations exist; authenticated real-evidence and opted-in money smokes remain after deploy.

## Handoff

Codex owns the preflight and bounded release implementation. Jonathan remains the credential, provider-authority, real-evidence, and Production decision owner.
