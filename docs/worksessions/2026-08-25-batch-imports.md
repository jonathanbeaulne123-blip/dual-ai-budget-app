# Worksession — Batch imports

- **Opened:** 2026-08-25, America/Toronto
- **Status:** PR #108 OPEN — Worker deployed; merge and full UI smoke remain
- **Baseline:** `origin/main@5c91060`
- **Branch:** `codex/batch-imports`
- **Owner:** Codex
- **Risk:** High — bulk external proposals can alter many financial rows after Confirm
- **Environment:** local Development and synthetic fixtures only
- **Hosted mutations / migration / Auth/RLS / Production:** none
- **Deployment:** Jonathan approved; GitHub Actions run `32872129163` completed successfully against `codex/batch-imports`

## Scope

- QFX/OFX multi-file and long-history intake.
- Selected camera/gallery detection for receipts, bills, bank statements, and card statements.
- Existing duplicate confidence system with exact Jonathan thresholds and three review tabs.
- Side-by-side imported/existing decisions.
- One final command/Confirm boundary, balanced books, provenance, and one undo snapshot.

## Product contract — D-130

Rows remain staged until final Confirm. `>90` starts cancelled but is reversible, `50–90` requires a decision, and `<50` starts kept. Replacing a posted row means excluding it through the duplicate control, never deleting history. Exact last-four may map an account; ambiguous accounts stay blank.

Selected images may reach the existing Worker providers during the disposable Development window, but only after direct user selection. The raw image is not retained in Hearth. Connected bank feeds, credentials, and money rails remain outside this slice.

## Evidence

- Focused import matrix: **7 files, 21 tests passed**.
- Full serial suite: **71 files, 477 tests passed**.
- `pnpm exec tsc --noEmit`: clean.
- `pnpm ai:verify`: verified 41 required files and proof gate.
- `pnpm build`: succeeded. Existing PGlite browser-external/eval and chunk-size warnings remain non-fatal.
- `git diff --check`: clean.
- Local Books → Import desktop walkthrough: launcher and existing flow verified; the in-app synthetic file picker became unavailable, so parser/modal handoff is proven by the jsdom UI test rather than claimed as a completed browser upload.
- PR #108: open, mergeable; CI and pull-request Cloudflare build both green on `9407312`.
- Production workflow dispatch: `32872129163` completed successfully.
- Live smoke: app `200`; `/documents/scan` allowlisted CORS preflight `204`; invalid GIF payload fails closed `400`. A subsequent blank-image provider probe was not completed because DNS resolution became unavailable after the route smoke; no real household image was sent.

## Stop point

Review and merge PR #108. Then perform one legible synthetic receipt plus synthetic OFX UI smoke. No schema is required.
