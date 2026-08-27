# Hearth worksession — Shift tab camera (D-152 on D-153)

- **Status:** OPEN — PR ready; Jonathan asked to finish without him (merge + kitchen publish)
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/shift-tab-camera-6319`
- **Baseline SHA:** `891cc5dfe535dc4244cd87577af18e47a0fdd3f1` (`origin/main`)
- **Head SHA:** (this commit)
- **PR or issue:** [#217](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/217)
- **Risk:** Medium (OCR already exists; new surface; Confirm still posts)
- **Decision owner:** Jonathan (ordered camera on Shift page; get it done without him)
- **Environment impact:** none on household rows; kitchen Worker publish follows merge to `main`

## Household outcome

On **Shift → Today**, Bianca or Jonathan can photograph a tip sheet (or pick a photo). The scan drafts Confirm fields on this page. Confirm still posts. The tab never writes money. Home Timesheet / Add camera path stays.

## Budget delta (5)

**+1** — end-of-night totals can be drafted where punch already lives, so posted wages/tips are less likely to wait on Add.

## Engagement delta (3)

**+2** — Shift tab is the sit-down surface; camera is one of the reasons to open it.

## Verified baseline

**Facts**

- Shift tab is live (D-153, #213). Punch on Today now clocks out in place (`clockOutStayOnShiftPage`); Home Timesheet still opens Add.
- Camera + `WorkShiftFlow` live on Shift Today and Add (shared `ShiftReportScanBar`).
- Demo kitchen job `Demo Bistro` exists for both MEM-001 (Bianca) and MEM-002 (Jonathan).

**Inferences**

- Jonathan wants the #208 camera on the Shift page, not a second OCR pipeline.

## Scope

### In scope

- Shared scan bar used by Add and Shift Today.
- Clock out / Already off on Shift stay on the tab and host scan + Confirm.
- Demo job for Bianca so Development demo can exercise the camera.
- Copy: BatchImport still refuses shift-report rows; point people at Shift → Today.
- Same-day Confirm retry stays on `postWorkShift`.

### Out of scope

- New Worker scan endpoint.
- Auto-post from OCR.
- Removing Home Timesheet or Add camera.
- Production household data, schema, secrets.

## Acceptance evidence

- [x] Shift Today after Clock out / Already off shows Take shift-report photo + WorkShiftFlow
- [x] Scan still uses `documentHint: shift-report`; notes still omitted
- [x] Confirm still posts via existing `postWorkShift`
- [x] Add sheet still has the same camera
- [x] Same-day retry stays a shift, not an expense pad
- [x] Focused tests + `pnpm check` → **895 passed / 2 skipped**

## Plan

- [x] Shared `ShiftReportScanBar`
- [x] WorkShiftPage inline review
- [x] Bianca demo job
- [x] Duplicate retry stays on `postWorkShift`
- [x] Tests, auditors, handoff

## Evidence log

- Focused: `pnpm exec vitest run test/shift-page-scan.test.ts test/shift-duplicate-retry.test.ts test/shift-report-draft.test.ts test/document-scan-worker.test.ts`
- Full: `pnpm check` → **895 passed / 2 skipped**; `tsc` + vite build green; client chunk `index-DOj0PobS.js`
- Books auditor: prior P1 (expense-pad retry) closed; **PASS WITH NOTES** (P3 helper alignment on Shift Add anyway — applied)
- Privacy auditor: **PASS WITH NOTES** (warnings can still echo names on-device; Add prompt still says Shift → Today)
- UX auditor: **PASS WITH NOTES** (pane-switch unmounts wizard step; chip 44px advisory)

## Decisions

Same-day Confirm on Shift stays on the tab. Add anyway retries `postWorkShift` even if Add mode is still expense.

## Remaining uncertainty

OCR quality depends on model vision. Switching Today/Report/Jobs mid-flow unmounts wizard step (draft state survives). Preview hostname is not the kitchen.

## Handoff

PR #217, not yet merged. Next: merge → GitHub `main` Cloudflare Workers deploy → hard-refresh kitchen, Development demo, Bianca, Shift → Already off? → camera chips. Do not Confirm unless intending a fictional demo post.
