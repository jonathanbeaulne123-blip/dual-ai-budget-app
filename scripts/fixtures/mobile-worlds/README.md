# Mobile world component fixtures

Local-only Vite source specimens, adapted from the finished mobile review at bf33c87. They render actual React components with fictional catalogue/forecast fixtures. They do not load the user's account or household; some actions mutate only the in-memory fictional model. No hosted writes. They are not Vite build entries and do not ship in dist.

`node scripts/check-mobile-theme-components.mjs` checks 20 component families in each of the three themes at320x568 and390x844, including expanded Ledge and chapter states, with screenshot, overflow, JS error and WCAG A/AA output. Set HEARTH_THEME_ORIGIN to a running localhost Vite server. Results are written to .artifacts by default. This is local component evidence, not physical-device or authenticated proof. The full-App script is scripts/check-theme-pages.mjs.

The fixtures retain the mobile review's source states (including unavailable accepted scenario sources), not a substitute financial implementation. world-fixture.tsx binds appearance without connecting Auth. Primary appearance lifecycle/no-write evidence is test/mobile-appearance.test.ts.

`node scripts/check-mobile-theme-geometry.mjs` adds36 scene-header hitbox checks, four authored-dark warning contrast measurements, pause/entry/reduced-motion checks, relative expanded Ledge position and CSS200% reflow. CSS zoom is not physical/native-browser zoom proof.
