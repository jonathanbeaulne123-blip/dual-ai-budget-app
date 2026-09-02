# Hearth worksession — Register slice 8 release

- **Status:** CLOSED; MERGED; KITCHEN PUBLISHED; LIVE HTTP VERIFIED
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/register-8-release`
- **Current integration baseline SHA:** `2b9f77051b4abfdddce2fd2f580e41a36a6c8772`
- **Merged main SHA:** `347e4ff0ce31cd5959e5a24b511c14fd1d34a791`
- **PR or issue:** #299; supersedes draft #285
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development

## Household outcome

Jonathan and Bianca can open the Register from the Month Spread or Household table and read what the month owes, which confirmed Fund dollars cover each obligation, and what remains unfunded. One scale and one FIFO projection remain authoritative.

## Budget delta (5)

`+3` — the existing conserved contribution register becomes directly inspectable without changing a cent, allocation, obligation, contribution, or command.

## Engagement delta (3)

`+2` — the month becomes a calm paper instrument with one obvious doorway from the Spread and an equivalent phone fact list.

## Verified baseline

Facts:

- Current `origin/main@813e2b4` contains the released Ask confirmation, Clerk weekly document, metronome, and Till custody fence.
- Slice 8 source head `36e255d` was display-only and unmounted; current main had no Register component.
- Independent books review found no P0/P1 money, privacy, or writer defect.
- Independent UX review blocked release on absent kitchen placement and forced-colors provenance.

Inference:

- Integrating the pure drawing into the existing Household table preserves one allocator and gives the Month Spread a direct, reversible navigation path.

## Scope

### In scope

- Register drawing and geometry projection from Slice 8
- Household table placement and Month Spread opener
- forced-colors source distinctions and an honest semantic keyboard path
- focused projection, DOM, privacy, and integration tests
- Development release evidence

### Out of scope

- money commands, allocation changes, Fund events, recurrence changes
- hosted schema or household rows, Supabase, Auth/RLS, secrets, providers
- Production data or Production continuity

## Acceptance evidence

- [x] Focused Register/contribution tests: 26 passed
- [x] Placement/view rerun: 13 passed after one integration-order repair
- [x] TypeScript passed
- [x] Current-main full repository test and production build: 1,706 passed, 3 intentional skips; 416 modules built
- [x] Browser widths: 320/390/720/1100 px, no body overflow, working route, honest refusal, no console errors
- [x] Independent feature-head review: three PASS verdicts, no P0/P1/P2
- [x] GitHub main CI, Cloudflare deployment, live HTTP and asset markers

## Plan

- [x] Reconcile old Slice 8 with current main
- [x] Repair accessibility and mount the Register
- [x] Add integration and privacy proof
- [x] Run local full release gates
- [x] Push, merge, deploy, and verify Development live

## Evidence log

- Clean isolated writer worktree based on `origin/main@813e2b4`.
- `pnpm exec vitest run test/register-view.test.ts test/contribution-register.test.ts test/contribution-purpose.test.ts --maxWorkers=1`: 3 files, 26 tests passed.
- Combined Register/Month Spread/privacy run reached 71 passed and exposed one effect-order placement defect; after moving the one-shot request effect behind the ordinary view reset, the focused placement rerun passed 13/13.
- `pnpm exec tsc --noEmit`: passed with the bundled Windows Node runtime.
- `pnpm check:windows`: 225 fast files passed with 1 skipped and 18 books files passed with 1 skipped; 1,691 tests passed with 3 intentional skips in total, followed by TypeScript, Vite (413 modules), Hercules Pro UI, and redirect-guard proof.
- After the final legend-spacing repair, the focused 13-test Register lane, TypeScript, Vite build, and Hercules Pro UI build passed again.
- Local browser at 320/390/720/1100 px: one Shared Register at every width, no document overflow, exact Month Spread-to-Register navigation, honest refusal when the local Development household has no configured Fund, and no console errors. At 1100 px the four legend extents were separately remeasured after the overlap repair.
- Exact-candidate keyboard review found that a named scroll tab stop did not move with ArrowRight or End at 320 px. The misleading focus target was removed; the complete semantic fact list remains the keyboard and screen-reader path, while touch/pointer users can still pan the drawing.
- `origin/main` advanced to the released Till Slice 2 while PR #299 opened. Register rebased cleanly except for preserving both release records in this shared handoff file. The post-rebase `pnpm check:windows` passed 226 fast files plus 18 serial books files: 1,706 tests passed, 3 intentionally skipped, followed by TypeScript, Vite's 416-module production build, Hercules Pro UI, and redirect guard.
- Exact-head PR CI `33659646340` and Cloudflare preview `33659646250` passed before merge. #299 merged as `347e4ff0ce31cd5959e5a24b511c14fd1d34a791`.
- Post-merge main CI `33660752312` passed. D-041 Cloudflare run `33660752817` passed with `VITE_PRODUCTION_CONTINUITY=0` and published Worker version `87b740c9-3af7-4ee7-96e1-f41f76efa9ee`.
- Live `GET https://hearth-books.jonathan-beaulne123.workers.dev/` returned HTTP 200 with `Cache-Control: no-store`. Live assets `/assets/Books-zKkvo2sl.js`, `/assets/Books-Dkup-FAr.css`, and `/assets/Office-hcpC2ocS.js` contain the Shared Register pane, exact `Open the register` route, and honest untied-state copy.

## Decisions

The host maps the configured Fund custodian to the existing `hers` paper tone and the other active household member to `his`; the drawing itself still does not infer identities from ids, array order, signed-in viewer, or contribution size. Shared Books is the only host. Personal Books neither offers nor mounts this shared provenance drawing.

## Remaining uncertainty

The authenticated ready-state was not seeded into local household data; its conserved projection and DOM are covered by focused tests, while the local household correctly exercised the fail-closed state. Physical forced-colors emulation was unavailable; source patterns and focused selectors were independently reviewed. Neither uncertainty changes books, privacy, writer, or release integrity.

## Handoff

Register Slice 8 is closed on merged `main` and the verified Development kitchen. The old unmounted #285 is superseded. Production and hosted household data remain out of scope.
