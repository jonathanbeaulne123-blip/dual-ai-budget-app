# Hearthside guest assembly — 2026-09-12

- Integration owner: root Codex. One writer in isolated `codex/hearthside-guest-assembly`.
- Repository: dual-ai-budget-app; root baseline `429db8ef0447dac6347e89e945dd04aad05e84fb`. Current root source captured read-only in local dependency commit `8fd9a84`; approved revision-zero reader/current existing-test consumers refreshed in local dependency commit `79f543a`.
- Risk: High for the authority being verified; this package adds tests and evidence only.
- Budget delta (5): prove guest publication and toys never alter money or disclose financial payload/scale.
- Engagement delta (3): prove exact reviewed pottery, furniture and a jointly kept audio memory can be visited by a selected guest, with deliberate revocation.
- Outcome: actual GuestRoom → LedgerRoom → Vault → private R2 assembly runs under signed synthetic authenticated principals.
- Scope: new test and two fixture modules; evidence docs. Production source, shared interfaces and configuration remain integration-owner files.
- Non-scope: hosted auth/service activation/schema application, real invitations, provider calls, physical/native/browser presentation acceptance.
- Independent review: the parent owns final integration review. Earlier Entry controller/bridge/client review by the design agent at `f8942a1` reported no additional concrete blocker; that bounded review does not review this new test package.
- Concrete compatibility finding: guest piece revision zero was offered by the picker but rejected by its decoder. Root applied a piece-only zero allowance; the actual assembly regression verifies successful untouched legacy publication and continued rejection for revision-zero memory.

Validation:

- Direct runtime command: `pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never exec vitest run test/hearthside-guest-assembly.test.ts` — 3/3 actual Miniflare tests passed; 4.44 seconds total.
- Scoped High: `pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --base=09c9dd5 --focus=test/hearthside-guest-assembly.test.ts --focus-reason="Actual GuestRoom LedgerRoom Vault assembly, exact publication and recipient-bound withdrawal"` — passed, 39.007 seconds, no budget breach; TypeScript 27.668 seconds; 3 tests/1 file. Base/head at gate `09c9dd55c2e812eef422bbe2215a0b1f322f32dd`; tested working-tree fingerprint `cce8f3ae31d47836cf116f91b057ed0df6dbcf4d965d5d5515e82ed950456525`. This was the precommit gate, with the five new package files untracked. This evidence-only closeout was added afterward; test source is unchanged.
- `git diff --check` passed. Runtime and High logs: `/tmp/hearthside-guest-assembly-runtime.log`, `/tmp/hearthside-guest-assembly-high.log`.
- First High attempt failed on incomplete isolated compiler dependencies (old package tree, missing platform declaration include and a read-only proof fixture). No assembly-source TypeScript error was reported. Local dependency-only commit `09c9dd5` completed the frozen consumers/platform include and this checkout now reads the existing root node_modules. No package installation occurred.
- Handoff contains only five new files. Do not integrate dependency-only commits `8fd9a84`, `79f543a` or `09c9dd5`; root already owns those integrated sources and its revision-zero decoder fix.
- The broader P12 guest archive/browser suites and root full-program gate remain the integration owner's responsibility. No build was repeated for this test-only package. No hosted actions were performed.

