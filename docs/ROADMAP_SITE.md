# Hearth roadmap website

## Purpose

`/roadmap/` is Hearth's read-only product-health and investor roadmap. It turns dated audit evidence, evidence gates, investor benchmarks, the canonical phase horizon, and an additive update history into a page that can be revisited as the project grows.

Jonathan selected **public access with no privacy or login guard** on 2026-08-27 because the roadmap's people and data are synthetic. The permanent release address is `https://hearth-books.jonathan-beaulne123.workers.dev/roadmap/`. Publication still requires the ordinary reviewed push and GitHub-to-Cloudflare deployment gate.

The site is a communication artifact, not a ledger surface. It does not load household records, Supabase, authentication state, local storage, analytics, or model endpoints.

## Structure

| File | Responsibility |
|---|---|
| `public/roadmap/index.html` | Semantic page structure and fallback copy |
| `public/roadmap/roadmap-data.js` | Structured roadmap content and source links |
| `public/roadmap/app.js` | Read-only rendering, tabs, and filters |
| `public/roadmap/styles.css` | Responsive, keyboard-visible, reduced-motion presentation |
| `PRODUCT_HEALTH_AND_VIABILITY_AUDIT_2026-08-27.md` | Full dated audit behind the initial snapshot |

Vite copies `public/roadmap/` into `dist/roadmap/`. Hearth's existing Cloudflare Workers + Assets pipeline can therefore publish it at `/roadmap/` without adding a second host or deployment stack.

## Additive update protocol

1. Append new facts, gates, phases, priorities, or update records in `public/roadmap/roadmap-data.js`. Do not remove an earlier roadmap item merely because it is filtered or superseded.
2. Give every new evidence snapshot an `as-of` date, exact repository baseline, confidence, and source trail. Preserve prior snapshots when a score or conclusion changes.
3. Keep unknown investor rows labelled `Unknown` until Hearth has a defined cohort, denominator, observation window, and privacy-safe measurement.
4. Re-verify any external benchmark before changing it. Record the source and date; never present a benchmark as Hearth performance.
5. Keep the page read-only. Any future form, analytics, sign-in, comments, or household-data connection requires a separate privacy and architecture decision.
6. Run the roadmap tests, the full Hearth test suite, and the production build. Confirm the built `/roadmap/` route at desktop and phone widths before requesting deployment.
7. Deployment remains an explicit approval step. Public, indexable access with no login guard is selected; confirm the exact reviewed commit and deployment approval before publishing it.

## Local review

Run Hearth's normal development server and open `/roadmap/`. The roadmap is independent of the household app, so reviewing it does not create, change, or sync any money data.

## Evidence boundary

The first site snapshot is dated **2026-08-27** and audits `main@93df0ec`. Its test count, build size, code-size measurements, scores, and investor verdict are historical evidence. They do not update automatically and must not be described as current without a fresh audit.
