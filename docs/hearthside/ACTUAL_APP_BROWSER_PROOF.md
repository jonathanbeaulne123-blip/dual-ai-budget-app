# Actual App shell and Hearthside continuity proof

Risk: Medium (test infrastructure; product repairs remain root-owned). Budget delta (5): navigation must preserve the accepted financial hash, receipt count, and operational data. Engagement delta (3): the shared rooms remain reachable from real Home, with useful phone composition and exact returns from connected tools.

The package owns only `test/hearthside-actual-app-browser.test.ts`, `test/fixtures/hearthsideActualApp.ts`, and this note. Its isolated base is `2db4891c82eaf825eceeafefa1a9426457e4c20a`. No App, authority, CSS, package, or configuration source is changed. The regression intentionally needs the integrated root fixes described below; the unmodified base does not satisfy it.

## Harness boundary

The test serves the real `index.html`, `src/main.tsx`, App, and imported surfaces. It begins on a blank local seeding page, uses `completedExistingBooksHousehold`, ordinary Task/Calendar/Hearthside commands to build fictional content, then `saveHousehold` and `saveSession` to open those local books. It waits for real App/PGlite readiness. It preserves `navigator.locks` and does not substitute readiness, App state, authentication, command outcomes, or an accepted server receipt.

The Vite server does not load environment files or the repository's hosted proxy configuration. HTTP requests outside its exact local origin and requests to local service/API paths are blocked. Its filesystem allowance is limited to the tested source root and the resolved, existing dependency directory, including PGlite's actual WASM/data files. No dependencies are copied or installed.

This is explicitly a **local legacy-storage shell run**: `VITE_LEDGER_SYNC_V2=0`, `VITE_LEDGER_SYNC_LOCAL_AUTH=0`, `VITE_PRODUCTION_CONTINUITY=0`. Hearthside presentation and the existing Hercules play/dressing/Workspace UI flags are enabled only inside this local Vite process. Every Hearthside service/design/native/export activation flag is explicitly off. Remote fonts/weather are blocked, so captures use the available local/fallback fonts and scenery. A fresh browser context contains no authenticated subject or hosted capability. Shared save remains disabled; no authenticated write, cloud continuity, two-device acceptance, physical device, native AR, or deployment claim follows from this test.

## Assertions and artifacts

- Actual shared Home navigation to Common Room; stable exact intention URL after browser reload.
- Exact connected Task and native Calendar event open in the real tool. Return restores the intention URL and the triggering control's focus. The Task case also reloads the tool before returning, exercising a fresh lazy Hearthside mount.
- The existing `hearth:open-fitting` event contract is dispatched with the synthetic household/member scope from actual Home. It must arrive at Studio `surface=wardrobe`. This proves the existing event adapter, not a hosted chat's generated wardrobe action.
- All three themes: Common Room at 320, 390, 719, 720, 1100, 1440, and 1920 pixels; Studio at 390 and 1440. No horizontal overflow; visible navigation controls stay within the viewport with their existing target size. At 390×900 the authored room heading and a complete placed note fit above fixed navigation/any visible Fund or return chrome. The App's generic theme-scene heading is absent on Hearthside.
- At 320 pixels and 200% root text size, the native object index remains keyboard-operable; opening and returning restores its exact focus. Reduced motion is enabled throughout.
- Closed Hercules offers “A little company” in Hearthside, with no automatic Rent/Phones reminder. Returning to ordinary Home restores its canonical reminder, and no Hercules provider request occurs.
- The disconnected shared intention submit stays disabled. The stored financial audit hash, household revision, receipt count, and full shared-life metadata remain unchanged after the journey.

Screenshots include full pages and first viewports for Common/Studio at 390/1440 in every theme, plus Common at 320. `evidence.json` records geometry, blocked requests, errors, fixture hash, and before/after hashes of the tested App/surface/CSS files. Artifacts use `HEARTH_ARTIFACTS_DIR` or `/tmp/hearthside-actual-app-proof`; no household export or screenshot is committed.

## Run

From the checkout containing these test files, use the repository's existing Node runtime and dependencies:

```sh
node node_modules/vitest/vitest.mjs run test/hearthside-actual-app-browser.test.ts --maxWorkers=1
```

To examine another local integration checkout read-only, set `HEARTH_APP_PROOF_ROOT` to its absolute path. The local fixture is served from the test package but imports the selected checkout's actual commands and storage modules. No file is written into that selected checkout.

## Findings closed by root integration

1. The old fitting event selected the Studio room but did not open the wardrobe surface. Root added the exact scoped surface route, including mounted-room notification.
2. A return after reloading Planner restored the exact intention but lost keyboard focus: App's two animation frames ran before lazy Hearthside remounted. Root moved the recorded-focus consumption to that scoped mount and scrolls the target into view.
3. The App's generic theme scene repeated Hearthside's own arrival, pushing the room below the phone fold. Root removed that duplicate scene/pseudo-art for this destination, retained atmosphere controls, and tightened phone header/room spacing. The strict complete-object-above-navigation assertion caught the remaining spacing issue.

4. An unsolicited financial reminder over the shared room competed with the chosen free intention. Root narrowed the closed resident presentation for Hearthside; ordinary Home retains its reminder and manual Hercules remains available.

The first Vite harness attempt needed its symlinked PGlite resource directory added to the allowlist; that was a test setup issue, not an App workaround. The first cold startup exceeded a 30-second readiness wait, so the fixture now uses the existing browser-proof convention of a bounded 90-second readiness wait. These earlier attempts are not passing evidence.

Final measured evidence: one actual-App browser test passed in **24.93 seconds** (24.49 seconds test work), against the root after its final Nest integration. All 27 geometry cases, three enlarged-text keyboard cases, exact returns/reload, wardrobe, resident/Home reminder transitions, no-provider assertions, and unchanged-data assertions passed. Page errors and geometry failures were empty; all recorded source/CSS hashes remained unchanged during the run. The tested App SHA-256 was `3ac695e006d133ecc9b49452553cf4cf45f4b485ee35be9eb76b8cfc18642ce5`. The narrow strict TypeScript check of the two owned test/fixture files and their imported dependencies passed; its only subsequent source change adjusted string selectors for the actual desktop companion variant, exercised by the final browser run.

No Fund grip/return bar was rendered on this fixture's Hearthside route; geometry explicitly accounts for those controls if present. This does not claim an expanded Fund-panel interaction proof. The root's whole-program High/build and later physical/authenticated gates remain separate.
