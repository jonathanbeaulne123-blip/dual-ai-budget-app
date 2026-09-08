# Hearth mobile — Phase 2 review

Implementation stack: A1–A5, B1–B9, C1–C12, SC01–SC06, Proof and Return, followed by final integration. All changes are local and in stacked draft pull requests; no merge, deployment, hosted schema or Production activation was performed.

## Authority and retained decisions

Jonathan's latest instruction makes Claude's vision, layout and exact style authoritative. Compatible additions stay within existing Books and Hercules surfaces. His explicit “just build it” overrides the two-week G2 sheet-build gate only.

- Earned, received and explicitly contributed money remain distinct. Fund scenarios are bounded, dated and separately labelled; a possible shift never silently becomes a Fund contribution.
- The Apron shows an accepted receipt and the separate current Shared Ask. It does not claim the shift reduced that Ask.
- Shared and Personal are labelled explicitly. Personal Shift/Books navigation remains; gesture motion alone never posts money.
- Claude's three Work tabs, Fold, Fund sheet, chapter spreads, instrument composition, paper palette and typefaces remain the visual authority. Conventional phone cards/controls use5px/3px corners and44px targets.

## Verification and limits

Final integration passed133 selected assertions plus TypeScript/AI/diff in166.486s and the570-module production bundle build. Four viewport widths and simulated native pinch1→1.6 at320/390 passed; [exact integration evidence](worksessions/2026-09-08-mobile-phase2-integration.md). Per-slice results, exact base/fingerprint, repaired findings and qualifications are retained below. These are focused quick gates, source reviews and local fictional component/browser proofs, not an exhaustive test-lane or hosted certification claim.

- Physical-device acceptance remains open: B2 G3 blank-entry target was measured at14 taps versus21 before, still above the under10 target; prefilled path4 versus4. No physical timing certification is claimed.
- Real-device QR/OAuth, camera/OCR, physical background/battery and pinch checks were not performed. Synthetic camera/browser evidence is labelled in its slice.
- Earlier SC04/SC06 combined gates had timing failures and SC04/SC05/SC06 runs breached five minutes; those historical outcomes remain recorded. Later scoped proofs do not turn them into clean historical runs. C6's observed toast-unmount failure was fixed and verified by C7.
- Development and Production are unchanged by this task. Existing physical sync/latency acceptance gates are not closed by mobile UX browser evidence.

## Stack, in dependency order

| Draft PR | Commit | Outcome | Slice evidence |
|---|---|---|---|
| [#372](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/372) | `01ec730bbb3ca286ee831ae3d0513bf52af876aa` | Bound mobile Home to Claude’s four-object fold | [worksession](worksessions/2026-09-07-mobile-fold.md) |
| [#373](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/373) | `565efd7b7f463f80c8c3a6b31730027ce6a9bcdb` | Add Claude’s scoped Fund ledge above mobile navigation | [worksession](worksessions/2026-09-07-mobile-ledge-grip.md) |
| [#374](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/374) | `9014a78e05722c24072e8264086770d7c088d742` | Build the full mobile Fund Ledge with scoped command authority | [worksession](worksessions/2026-09-08-mobile-ledge-sheet.md) |
| [#375](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/375) | `c249f378aa5ed2acad7cfff7a2cc5af389bc3b47` | feat(mobile): open Claude chapter spreads from the three seals | [worksession](worksessions/2026-09-08-mobile-spread.md) |
| [#376](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/376) | `cd97dfa201e01f017730e6ff74f1a5216d501891` | feat(mobile): show Claude apron receipt after accepted shifts | [worksession](worksessions/2026-09-08-mobile-apron.md) |
| [#377](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/377) | `37c0cc9792df31c895ca5db0e84f4729c6e1c4d1` | feat(mobile): compose exact scoped ownership with Claude Cut | [worksession](worksessions/2026-09-08-mobile-cut.md) |
| [#378](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/378) | `246d4a49fdf88915b7c7b03b5f7ebf8bc0bfdc51` | feat(mobile): add Count rails and recover exact shift drafts | [worksession](worksessions/2026-09-08-mobile-count.md) |
| [#379](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/379) | `4c070cf85b2e5d823a7eed19503093a5354922db` | Define scoped explicit Fund scenario requests | [worksession](worksessions/2026-09-08-mobile-scenario-contract.md) |
| [#380](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/380) | `9c27a782511fe2c2e9f66bac91232fa75082c49d` | Share canonical Fund fold and prepare a bounded dated horizon | [worksession](worksessions/2026-09-08-mobile-fund-horizon.md) |
| [#381](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/381) | `7fba9a88b5767c256eb6739ab3f110279564804c` | Bound explicit cash scenarios by accepted owned source capacity | [worksession](worksessions/2026-09-08-mobile-cash-availability.md) |
| [#382](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/382) | `78b5f5e8b9b8d8c5aeaeb8663ab44af6163220e3` | Review named shift routes against supported forecast receipt assumptions | [worksession](worksessions/2026-09-08-mobile-forecast-availability.md) |
| [#383](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/383) | `a13c6c4155707cb7d1f68d68bbe5c89078a49b80` | Compose explicit Fund scenarios with conserved paired future paths | [worksession](worksessions/2026-09-08-mobile-paired-scenario.md) |
| [#384](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/384) | `24469bd5b206efca912c4c3ff5ff40024a4ffcc7` | Bind Fund scenarios to validated accepted source lifetime | [worksession](worksessions/2026-09-08-mobile-scenario-source.md) |
| [#385](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/385) | `92e5183c31c6ba31d2dd28a8f213f2dd9c3e98de` | Build Claude mobile Reach with explicit Fund scenarios | [worksession](worksessions/2026-09-08-mobile-reach.md) |
| [#386](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/386) | `b0c094b407e9619c7440f3c973cbbd3ccbd6b074` | Build Claude mobile Weight from dated cash-flow truth | [worksession](worksessions/2026-09-08-mobile-weight.md) |
| [#387](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/387) | `58fe84fdaf679a9cf901e8d7267793fac866ef6b` | Build Claude mobile Fill with scoped goal funding and purchase Confirm | [worksession](worksessions/2026-09-08-mobile-fill.md) |
| [#388](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/388) | `b873cb8afcb3dd96c7dbac2525f2d03c3cda2958` | Add Claude mobile Trust with supported source horizons | [worksession](worksessions/2026-09-08-mobile-trust.md) |
| [#389](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/389) | `10d0e8d13ee07b5e4498579e71f1813f52cec26e` | Add Claude mobile Punch with reviewed timeline actions | [worksession](worksessions/2026-09-08-mobile-punch.md) |
| [#390](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/390) | `9c2646547f82f89c74eb72b199f58121610f567d` | Build Claude Prise with scoped authoritative duplicate review | [worksession](worksessions/2026-09-08-mobile-prise.md) |
| [#391](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/391) | `56d516171cdf47f5b78cc920c0de0011f2acc935` | feat(mobile): add Claude Turn date readings without changing current Fund | [worksession](worksessions/2026-09-08-mobile-turn.md) |
| [#392](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/392) | `0d8f3f2b272606b263233c305225b52e885f64b6` | fix(mobile): make all eligible pad accounts and categories reachable | [worksession](worksessions/2026-09-08-mobile-pad-choices.md) |
| [#393](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/393) | `52f93983e7da7a003e53dba7618073409d930d09` | feat(mobile): offer honest household categories with reviewed Swipe posting | [worksession](worksessions/2026-09-08-mobile-swipe-suggestions.md) |
| [#394](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/394) | `1aee199d73cea6487d709fb128d44f7e49f921a8` | feat(mobile): reveal destructive actions before named confirmation | [worksession](worksessions/2026-09-08-mobile-danger-reveal.md) |
| [#395](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/395) | `923ca35286724c47cb18c8ace0e0536a61f6dc6c` | feat(mobile): review exact due occurrences inline | [worksession](worksessions/2026-09-08-mobile-due-rows.md) |
| [#396](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/396) | `1c724a2608f5b403c03e84d3c5159e5fd86e906f` | feat(mobile): attach reviewed claim transfers to their rows | [worksession](worksessions/2026-09-08-mobile-claim-rows.md) |
| [#397](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/397) | `adc44df6af82e6df6ad30032550f5b3e47b80025` | fix(mobile): show Till empty copy only for an empty month | [worksession](worksessions/2026-09-08-mobile-till-empty.md) |
| [#398](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/398) | `a4a7709a3c033c5be5cf7de9c53cc22f534ff02b` | feat(mobile): keep receipt Undo scoped through its visible window | [worksession](worksessions/2026-09-08-mobile-undo-window.md) |
| [#399](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/399) | `67985a04d6d96a178ecb7efb1cb4838f0da0e475` | fix(mobile): replace Hercules placeholder with page-specific invitation | [worksession](worksessions/2026-09-08-mobile-hercules-copy.md) |
| [#400](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/400) | `52817e70ce34f4ee590f9d3f7da883878f81f62e` | feat(mobile): carry explicit camera quality overrides into review | [worksession](worksessions/2026-09-08-mobile-camera-override.md) |
| [#401](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/401) | `1ee073f53f531b17039ca4a453d75266410eebb6` | feat(mobile): hand off Work setup to phone Timesheet | [worksession](worksessions/2026-09-08-mobile-work-handoff.md) |
| [#402](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/402) | `2d4d28e5e8075296a2775f089cea58feefa9a5eb` | feat(mobile): place Work evidence beneath Jobs | [worksession](worksessions/2026-09-08-mobile-work-evidence.md) |
| [#403](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/403) | `3a12133b02a487e71c4cba6018f22b1ed4df3e7c` | perf(mobile): pause elapsed shift clocks while hidden | [worksession](worksessions/2026-09-08-mobile-visible-clock.md) |
| [#404](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/404) | `b4146b279c70792ce6a729ec71b7897c02b9726f` | feat(mobile): disclose accepted sources within Books rows | [worksession](worksessions/2026-09-08-mobile-proof-seam.md) |
| [#405](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/405) | `ccd9304936479bf964ca8d0fe472e7a3ccdceaf5` | feat(mobile): resume the current chapter from Hercules return bar | [worksession](worksessions/2026-09-08-mobile-return-stitch.md) |

Final integration is the last stacked draft on Return (`ccd9304936479bf964ca8d0fe472e7a3ccdceaf5`); its HEAD is the commit containing this document. The35-draft stack is ready for local design/device review.

## Reproduction

Checkout the final integration branch `codex/mobile-phase2-integration`. The final worksession records the exact focused gate and build commands. Local source preview uses Vite on127.0.0.1:53662; the compiled preview is on127.0.0.1:53663 and requires configured Google sign-in. A labelled fictional component index is at http://127.0.0.1:53662/artifacts/browser-evidence/mobile-review/index.html. Browser harnesses use fictional data and are not deployed application routes.

Verified base: `origin/main` remained `6fb15c7a98f3336862bb743b836aa96a358a35b9` after the September8 afternoon fetch. The stack does not replace main.
