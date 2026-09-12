# Hercules Workspace — Development release

- **Authorization:** Jonathan explicitly requested “push merge and deploy” after the local implementation handoff. This authorizes the scoped Development code release; meaningful-context/provider activation, Google writes, the Supabase grant migration and billing changes remain separate.
- **Risk:** Release. Decision owner Jonathan; Codex integrates and deploys, with independent read-only money and privacy review.
- **Source:** `codex/hercules-workspace@c5ab193565ab7bc9c086590670f3652e5cf4426c`, originally based on `02a5539d`.
- **Verified current base:** `origin/main@8048daf06406c7fbf344694d99c340f2fcf033c1`.
- **Budget delta (5):** preserve scoped deterministic reads, existing Final Confirm and receipt authority; no accepted household records are changed by deployment.
- **Engagement delta (3):** publish compatible workspace code while keeping current Plan, Time Machine, legacy Hercules and all themes available.

## Integration and independent review

Rebased onto current main. The five conflicts were resolved by retaining both Time Machine and Hercules routes/presence mappings, both test-focus mappings, and both sets of living documentation. Workspace is now **D-249** because main already used D-247 for Time Machine and D-248 for the current-on Plan deployment guard. `planFeature.ts`, `Books.tsx`, Time Machine components and its financial readers remain identical to current main.

Both independent auditors returned **CONDITIONAL PASS** for disabled-workspace Development release. The workspace singleton command guard closes the earlier compound authorization bypass; accepted receipts are checked before paused-workspace admission. Private Agent ownership, reviewed shared copies, independent Google receipts and all off switches remain intact. Their review was source-based; fresh focused CI/build and deployment checks are required below.

## Cloudflare preflight and release profile

The existing Worker had version `378cd87a-1fc0-45f5-82e6-8e0926cf173b` at 100% traffic before this release. The new R2 bucket did not exist and no Workflows were listed. Containers returned an explicit Workers Paid requirement. No billing upgrade was attempted.

The ordinary deployment retains empty workspace Agent/R2/Workflow bindings and all activation flags off, but creates no paid container application. The original pinned container configuration is retained in `workers/workspace/container-config.json`; the preparation script produces an explicit later deployment profile from current config. That profile cannot silently enable execution or disclosure. Supabase migration 022 is not applied by this deployment.

## Required evidence

Fresh Release-risk focused gate covers rebase routing, current Plan defaults, Time Machine, workspace contracts, privacy, provider budgets and confirmed-action recovery. The ordinary build checks both App and Worker types. PR CI and Cloudflare build must pass before merge; the resulting main deployment and live no-store Worker/assets are verified separately. No exhaustive gate is authorized. Original browser/runtime/export evidence and open live/physical acceptance are retained in [the implementation worksession](2026-09-12-hercules-workspace.md).

The final GitHub merge, CI/deploy links, Worker version and live smoke result are returned with the release handoff. Workspace activation remains an open program gate after a successful code deployment.
