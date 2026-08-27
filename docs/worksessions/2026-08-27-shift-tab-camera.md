# Hearth worksession — Shift tab camera (D-152 on D-153)

- **Status:** OPEN
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/shift-tab-camera-6319`
- **Baseline SHA:** `891cc5dfe535dc4244cd87577af18e47a0fdd3f1` (`origin/main`)
- **Head SHA:** (in progress)
- **PR or issue:** (draft after first commit)
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

- Shift tab is live (D-153, #213). Punch on Today still calls App `beginSignOut` / `beginFinishedShift`, which open Add.
- Camera + `WorkShiftFlow` live only in the Add sheet when `shiftGate` is signOut/finished and the member has a job (D-152, #208).
- Demo kitchen job `Demo Bistro` is MEM-002 (Jonathan) only. Welcome often picks Bianca (MEM-001).

**Inferences**

- Jonathan wants the #208 camera on the Shift page, not a second OCR pipeline.

## Scope

### In scope

- Shared scan bar used by Add and Shift Today.
- Clock out / Already off on Shift stay on the tab and host scan + Confirm.
- Demo job for Bianca so Development demo can exercise the camera.
- Copy: BatchImport still refuses shift-report rows; point people at Shift → Today.

### Out of scope

- New Worker scan endpoint.
- Auto-post from OCR.
- Removing Home Timesheet or Add camera.
- Production household data, schema, secrets.

## Acceptance evidence

- [ ] Shift Today after Clock out / Already off shows Take shift-report photo + WorkShiftFlow
- [ ] Scan still uses `documentHint: shift-report`; notes still omitted
- [ ] Confirm still posts via existing `postWorkShift`
- [ ] Add sheet still has the same camera
- [ ] Focused tests + `pnpm check`

## Plan

- [ ] Shared `ShiftReportScanBar`
- [ ] WorkShiftPage inline review
- [ ] Bianca demo job
- [ ] Tests, auditors, handoff
