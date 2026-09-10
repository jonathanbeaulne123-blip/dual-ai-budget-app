# Books composition revision

Jonathan rejected the first Books visual treatment in PR #418 as below the accepted Home/Calendar/Plan/More quality. His new direction supersedes the earlier simplified-clip-art preference for Books: more realism, richer illustration, and each album/location experienced as a time capsule.

Base is the existing open PR #418, `8a185ac75ba147ff57fdb670d4ba39a9714da59d`, clean before this revision. Scope remains Books presentation in all six combinations. Risk Medium; budget delta: preserve solid financial surfaces, authority and drafts; engagement delta: coherent settings with depth, light and materially specific detail.

## Composition

- Classic: a real-feeling oak kitchen desk, bound ledger, ceramic glaze, linen, trailing plants and window light.
- reputation: tactile black-and-white editorial papers, black leather/vinyl, intricate gold and red serpents. Maintain album-era specificity; avoid drifting into generic antique-gothic decor.
- TTPD: warm monochrome writing room, typewriter, manuscript, pressed flowers, porcelain and window light; melancholy without making the reading surface dark.
- Harbour: timber wharf, mooring rope, weathered fishing boat, water reflections and Narrows hillside depth.
- Merchant: warm wood and cream interior, blue glass, coastal paintings, linen and plated scallops; authored interpretation of the restaurant references, not an exact floorplan.

Desktop uses one continuous illustrated environment behind the reading plane, with localized light/water/steam details. No repeated rows of isolated stickers. The title reveals the setting; materials carry it through the lower page. Phone receives a complete compact scene above the reading content rather than a cropped desktop icon. Existing bracelets, pause and accessibility remain.

## Assets

Built-in image generation produces original interpreted scene illustrations. Sources: supplied moodboards; official reputation archive, official TTPD Manuscript packaging, Merchant Tavern website/private-room decor. Reference photos and original moodboards remain unpublished. Generated artifacts are copied into the repository, optimized for delivery, and documented with prompts and source paths.

## Verification

Independent visual and code review passed for all six scenes. First revised Chrome pass at 320/390/720/1440/1920 had no axe violations or document overflow; subsequent 390/1440/scrolled pass confirmed persistent backgrounds, visible snakes and scallops, and motion controls. The final complete width/nested/state recapture and Medium quick gate have passed; detailed outcomes follow below. Passing checks from the first PR are historical behavior evidence, not visual acceptance of this revision. No merge or deployment authorized.

### Regression and build results

- Local Medium gate: 150 tests in 10 files passed; TypeScript, AI surface and diff checks passed. Elapsed 1,512,682 ms (25m13s), exceeding the 300,000 ms target; TypeScript took 1,005,812 ms. This is a time-budget breach, not a failed gate. Receipt started at precommit head `8a185ac` with the implementation diff; later changes were CSS cleanup, documentation and stronger capture-image validation.
- Revision commit `7407321`: GitHub test check passed (2m20s), Pages production build passed (1m4s), Cloudflare PR build passed. Build run: https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/34472470013 . No extra local production build was run after the equivalent CI build passed.
- The first long-content capture hit the existing local Books startup validation timeout during concurrent heavy checks, before reaching Books. No fixture was posted to hosted storage. The fresh isolated retry after the gate completed passed all six scenes and seven widths.

### Reproduction

Runtime PATH prepends `/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`. Actual-page proof uses this checkout’s Vite server at `http://127.0.0.1:5194`, isolated synthetic fixtures and blocked non-local requests.

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=medium --focus=test/books-worlds.test.ts --focus=test/page-worlds.test.ts --focus=test/appearance-provider.test.ts --focus=test/accounts-widget.test.ts --focus=test/books-household.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason='Books scene revision preserves drafts, focus, theme and scope changes, account reads, and App confirmation boundaries'
HEARTH_THEME_ORIGIN=http://127.0.0.1:5194 HEARTH_WORLD_PAGE=ledger HEARTH_ARTIFACTS_DIR=.artifacts/books-rich-final node scripts/check-page-worlds.mjs
```

State passes use the same browser script with `HEARTH_SKIP_NESTED=1` and `HEARTH_WORLD_STATE=empty` or `long`; loading/error uses `HEARTH_BOOKS_LOADING=1`. Each has a separate artifact directory. The harness now waits for visible scene image decoding and fails on broken assets, and records actual scrolled desktop viewports in addition to full-page layout captures.

### Final browser and visual review evidence

- Normal: all six scene/scope combinations, seven main-page widths, 90 expanded scene/state checks at five widths. Zero axe violations, unexpected page errors or document overflow.
- Empty and long: six combinations each at seven widths, zero violations/errors/overflow. Loading/error: twelve combinations at five widths, zero violations/errors.
- Persistent pause/reload, reduced motion, focused-entry quieting, offscreen suspension, charm focus and 44px hit targets passed. Scene imagery stays behind controls and beside the desktop sheet after scrolling.
- Independent normal/empty/long visual review found a reputation tablet crop that hid the red snake. Corrected with a separate tablet title framing and moved title bracelets; follow-up at720/900/1099 passed. Both snake heads are visible. The single-scene harness initially assumed its final scope was Personal; it now explicitly selects Personal before the shared motion check, and the retry passed. Neither finding required a financial component change.
- Final evidence replaces first-pass images in `docs/ux/page-worlds/books/`; original reference photos remain unpublished. Full-page screenshot limitations for sticky backgrounds are explicitly documented, with actual scrolled viewport proof included.
- Budget delta (5): financial reading surfaces, amounts, drafts and command boundaries preserved. Engagement delta (3): five richly detailed, coherent environments, plus material-specific title/reading composition and localized atmosphere.
- Remaining limits: physical devices, Safari, VoiceOver, authenticated two-device sync, import completion and browser-posted financial actions are not certified. Next owner: Jonathan for visual review of revised PR #418. Merge/deploy remain separate.
