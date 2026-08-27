# Hearth worksession — Shift tab camera (D-152 on D-153)

- **Status:** CLOSED; merged #217; kitchen live
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/shift-tab-camera-6319` (merged)
- **Baseline SHA:** `e50fb75625fa1ab48953abaaf338e1a7bd58c403`
- **Head SHA:** merge `048e61910ad964b494c1115d64cd6eec39effb46`
- **PR or issue:** [#217](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/217)
- **Risk:** Medium (OCR already exists; new surface; Confirm still posts)
- **Decision owner:** Jonathan (ordered camera on Shift page; get it done without him)
- **Environment impact:** kitchen Worker publish from GitHub `main`; no household rows

## Household outcome

On **Shift → Today**, Bianca or Jonathan can photograph a tip sheet (or pick a photo). The scan drafts Confirm fields on this page. Confirm still posts. The tab never writes money. Home Timesheet / Add camera path stays.

## Budget delta (5)

**+1** — end-of-night totals can be drafted where punch already lives, so posted wages/tips are less likely to wait on Add.

## Engagement delta (3)

**+2** — Shift tab is the sit-down surface; camera is one of the reasons to open it.

## Verified baseline

**Facts**

- Shift tab is live (D-153, #213). Punch on Today clocks out in place (`clockOutStayOnShiftPage`); Home Timesheet still opens Add.
- Camera + `WorkShiftFlow` live on Shift Today and Add (shared `ShiftReportScanBar`).
- Demo kitchen job `Demo Bistro` exists for both MEM-001 (Bianca) and MEM-002 (Jonathan).

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
- [x] Kitchen Worker live `c942e55b`; bundle `index-Ce4ACG2v.js`

## Plan

- [x] Shared `ShiftReportScanBar`
- [x] WorkShiftPage inline review
- [x] Bianca demo job
- [x] Duplicate retry stays on `postWorkShift`
- [x] Tests, auditors, handoff
- [x] Merge #217 and kitchen deploy

## Evidence log

- Focused: `pnpm exec vitest run test/shift-page-scan.test.ts test/shift-duplicate-retry.test.ts test/shift-report-draft.test.ts test/document-scan-worker.test.ts`
- Full: `pnpm check` → **895 passed / 2 skipped**
- Books auditor: prior P1 (expense-pad retry) closed; **PASS WITH NOTES**
- Privacy auditor: **PASS WITH NOTES**
- UX auditor: **PASS WITH NOTES**
- Merge: `048e619` via #217
- Cloudflare Workers `33111839360` Deploy green; version `c942e55b-a53d-403e-9ab1-3c17c1f9957d`
- Live bundle `index-Ce4ACG2v.js` contains Take shift-report photo / Choose tip sheet photo / Optional camera draft / Bianca demo job
- Browser: Development, demo kitchen, Already off camera chips visible; no Confirm

## Decisions

Same-day Confirm on Shift stays on the tab. Add anyway retries `postWorkShift` even if Add mode is still expense.

## Remaining uncertainty

OCR quality depends on model vision. Switching Today/Report/Jobs mid-flow unmounts wizard step (draft state survives).

## Handoff

Merged and kitchen-live. Next owner: Jonathan — hard-refresh the kitchen, Development, Shift → Already off?, photograph a tip sheet if you want. Confirm still posts. Not Production books.
