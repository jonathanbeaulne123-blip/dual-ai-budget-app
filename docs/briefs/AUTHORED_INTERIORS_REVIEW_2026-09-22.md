# Two rooms worth spending time in

Review candidate for Jonathan and a second implementation/UX reviewer. Integration owner: Codex. Branch: `codex/authored-interiors`, based on freshly fetched `main@aaf7867d`. **Local only. Not a release approval.**

## What to try

Start `http://127.0.0.1:4188/__review` on this computer. The page is labelled fictional local state and uses the actual app with loopback command, creative-document and Vault authorities. It does not activate hosted services.

1. **Study → Library.** Walk or look around the original fitted reading room. Choose Today, Accounts, Spending, Bills, Goals, Contributions or Record from the bound volumes. Furniture uses the same working book. Read exact figures, then Put it back.
2. **Making → Pottery Studio.** Choose the wheel, glaze bench or kiln. Explicitly start or join a piece. Shape its body, paint a surface, undo your own gesture, then review and fire the selected revision.
3. Put it back. Open **Our piece cabinet**, then choose the saved piece. The cabinet reads actual accepted sculpture and paint. Reload an open bench: the piece and bench remain addressed; joining is still deliberate.
4. Explore Classic, Taylor and Newfoundland through the existing appearance controls. Try the narrow layout as well as desktop. The room is scenery and navigation; financial or creative acceptance remains in the existing tools.

## Implemented

- Original Three.js timber/ceramic architecture: fitted Library joinery, arched lights, books, instruments, readable desk, garden doorway, plants, brass and turned legs; a terracotta workshop with hollow pottery, fitted pigment cabinet, kiln, roof trusses and drying linen.
- Three authored fittings/material treatments: Classic timber and brass; Taylor manuscript folios, pinned leaves and swatch proofs; Newfoundland shiplap, merchant chart chest, rope and harbour colours. No downloaded image assets, copied photography or lyrics.
- Reachable semantic room controls, distinct phone rail and desktop volumes/stations; real Books chapters and canonical creative tools.
- A read-only accepted-piece cabinet checks environment, household, owner/audience, canonical index revision and nest visibility before showing artwork. Missing artwork remains unavailable; it is not silently replaced.
- Optional bench address on current and legacy routes; bench and piece selection survive controlled route updates and reload. Correct Making address and return paths. Camera records strip tool-only state.
- Source-only room art owns and disposes its geometry/materials. Outdoor lawn signs stop drawing through interior floors. Financial formulas and writers are untouched.

## Scope and authority

Risk **Medium-High**: navigation and creative selection across scopes; not a new financial authority. Budget benefit (5): existing exact figures and source tools are more reachable. Engagement benefit (3): two functional authored rooms, rather than another whole-app reskin.

No deployment, merge, native, hosted schema/service activation, Production operation, old PR #501 recovery, or real household data mutation. Artwork actions still require existing accepted creative commands; money still requires existing editable review/Final Confirm. Personal scope keeps the app's existing world presentation; its studio receives bench continuity but this change does not move the Harbour rollout into Personal.

## Observed browser evidence

Using the actual app and labelled fictional household:

- Library Today opened the canonical Standing Book; exact operating balance, next commitment and original financial controls remained readable. Put it back returned to Library.
- Making entered the room instead of jumping directly to a generic Studio.
- Glaze entry produced `surface=pottery&bench=paint`. A piece was explicitly created, body dipped sea-glass, body changed to pear, then firing revision 3 reviewed and accepted as creative revision 4.
- Fired and kept appeared only after acknowledgement. Our piece cabinet showed Fired / revision 4. Selecting it reopened the same pear shape and paint, with editing locked until deliberately joined/reopened.
- Desktop at 1440 and phone at 390 were visually inspected. Duplicate Studio chrome and a phone cabinet overlap were corrected. The final header correction still needs a fresh visual pass.
- Browser control later repeatedly detached/timed out, so this is not complete all-device evidence.

## Independent review

Read-only mechanics/privacy review found and prompted fixes for blocked doorway geometry, wrong balcony bounds, overlapping old furniture, lost bench/selection updates, invalid piece bench routes, camera-state contamination and an extra return step. No automatic creative/money write or audience leak was found in the new cabinet. Final follow-up verified the phone cabinet height correction and wardrobe bench cleanup. No remaining concrete blocker was found in this bounded source review. The cabinet still loads all indexed designs on demand; pagination and large-cabinet performance remain open.

## Validation

See `docs/evidence/authored-interiors/` locally for logs. Logs are local-only; this packet contains the portable result summary.

- Initial focused run: 63/64 passed in 136.00s; the room-budget test hit its 15s timeout. This is a failure, not a pass.
- TypeScript completed without diagnostics. The quick-gate type phase passed in **517.6s**, exceeding its budget. The gate was stopped in discovery after approximately 12 minutes and is **not green**.
- Required App-startup-inclusive regression attempt was stopped after approximately 10 minutes, with overlapping React act warnings and no final summary. Its result is **incomplete**.
- Bounded run before the final assertion correction: **69/70 passed in 88.12s**. The sole failure expected an old kiln heat label that was intentionally replaced: its legacy bank-only reading could misdescribe newly fired free pieces. Updated that assertion; room recheck **32/32 passed in 16.35s**.
- Final route/geometry recheck, including clearing a pottery bench when entering wardrobe: **18/18 passed in 14.44s**.
- Production web bundling passed in **4m46s**. Workspace TypeScript and the Hercules UI build also completed without diagnostics. Bundling warned about existing large chunks/PGlite Node externals; this is not a performance clearance.
- **Final candidate focused run: 7 suites / 70 tests passed in 34.35s**, including canonical creative UI and the month-rehearsal command regression. **Final candidate web bundle passed in 1m59s** after the last source corrections. The final drawer/header changes have independent source review but no fresh browser screenshot; browser automation repeatedly detached.

## Explicit gaps before merge/release

- Complete the final all-theme width matrix (320, 390, 719, 720, 1100, 1440, 1920), enlarged text, keyboard/screen-reader and physical-device review.
- Reproduce the App-startup suite and obtain a budget-compliant quick gate on the final commit in a clean, uncongested run.
- Bound large-cabinet loading/pagination and measure production interaction/frame timing and repeated room cycles. Geometry/disposal tests are useful evidence, not a substitute for measured device performance.
- The old 3D bank-pottery rack still uses the legacy bank artwork reading. New canonical free pieces live in the accepted-piece cabinet and actual making surface; rendering those exact pieces on the physical rack is follow-up work.
- Complete two-member, private/shared and interrupted acknowledgement browser acceptance. Existing boundaries remain in place; the new UI does not prove hosted continuity.

## Continue safely

Use this branch and worktree. Keep the room changes isolated. Do not restart a whole-house overhaul or activate parked systems. Re-run the focused commands in the worksession, review remaining visual gaps, and return a merge recommendation with measured evidence and explicit exceptions. Jonathan owns acceptance and release decisions.

## Reproduce locally

From `.codex-work/authored-interiors`, with the repository Node/pnpm runtime:

```sh
pnpm install --frozen-lockfile
HEARTH_REVIEW_PORT=4188 node scripts/serve-whole-house-review.mjs
```

Focused validation (not the exhaustive gate):

```sh
pnpm exec vitest run test/authored-interiors.test.ts test/whole-house-navigation.test.ts test/harbour-bindery.test.ts test/harbour-rooms.test.ts test/harbour-source-fences.test.ts test/hearthside-nest-design-ui.test.ts test/month-rehearsal-mainline.test.ts --maxWorkers=1 --testTimeout=30000
pnpm exec vite build
pnpm typecheck:workspace
pnpm build:hercules-pro-ui
```

The review server binds loopback, skips `.env` and uses fictional authorities. The observed creative changes are test data only. No household export, credentials, private chat, or third-party image asset is part of this packet. Browser viewport reset was attempted after the responsive pass but the browser had detached; no final browser cleanup is claimed.
