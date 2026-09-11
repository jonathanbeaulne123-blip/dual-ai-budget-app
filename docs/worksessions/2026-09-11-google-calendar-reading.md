# Hearth worksession — Google calendar reading

- Status: VERIFIED LOCALLY — Development release in progress
- Owner / decision owner: Jonathan
- Assignee: Codex
- Opened: 2026-09-11, America/Toronto
- Branch: codex/google-calendar-reading
- Baseline: 7d29bf5911e54e44c60bb955bb0588c2307a8a92
- Risk: High (Google permissions and private display scope)
- Environment: Development

## Household outcome
Read own and subscribed shared Google calendars without needing to write reminders or disconnect household identity.

## Budget delta (5)
External calendar events remain display-only; Calendar reads never post expenses or change Google events.

## Engagement delta (3)
Show own and shared calendars, direct reconnect/refresh, useful loading and partial failure feedback across themes.

## Verified defects
Only primary calendar fetched; no pagination; fixed summer UTC offset; expired account has only Disconnect; one failed account aborts every account; canceled load can strand busy state. Hearth sign-in is intentionally separate from direct Calendar consent.

## Scope and decisions
Read only the current member's device credential, including calendars Google grants that account reader access. Never consume another member's cached token. Keep bearer storage household-scoped and local. Preserve successful calendars when another fails. Qualify event ids by calendar; expand multi-day display within the visible window and use household timezone. Explicit Connect can enable Calendar, but no background OAuth and no reminder writes during refresh. Disconnect removes the local Google connection without unlinking Hearth identity.

## Evidence
Independent read-only investigation: google_calendar_trace confirmed expiry recovery, partial failure and busy-state defects. Official Google CalendarList.list and Events.list documentation consulted for access roles, pagination, bounds and canceled events. 

- High-risk quick gate passed 111 tests in seven files in 56.076 seconds, including startup and month rehearsal. Exact command (runtime Node PATH prepended): `pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --focus=test/google-calendar-reading.test.ts --focus=test/google-calendar-ui.test.ts --focus=test/google.test.ts --focus=test/google-bridge-scope.test.ts --focus=test/hercules-calendar-integration.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Google calendar reading, private credential scope, expired connection recovery, and Calendar mount integration"`.
- Initial test failure was a test spy shared between onCommand and onAskPost; separated spies, then passed. Initial browser fixture lacked accepted-books metadata, and its navigation locator used visible “Cal” instead of accessible “Calendar”; corrected fixture and selector.
- `pnpm exec vite build` passed in 8.57 seconds (existing PGlite/eval/bundle warnings).
- `node scripts/check-google-calendar-reading.mjs` passed 18 theme/scope/viewport cases (Classic, Taylor, Newfoundland; Shared, Personal; 320/390/1440), six axe scans, keyboard Refresh, and both synthetic calendars. 40 mocked Google reads, zero writes, zero browser errors. Evidence: `/tmp/hearth-google-calendar-reading/evidence.json`; screenshots in the same directory. Mobile screenshot visually checked.
- Independent review found no actionable defects; requested disabled-service Connect coverage was added and passed with the actual command callback.

## Release review
CONDITIONAL: code review, scoped tests, build and synthetic browser evidence pass. Exhaustive tests were not requested. Actual authenticated Google access and physical-device proof remain open. Release execution follows Jonathan's earlier push/merge/deploy authorization in this ongoing Development repair session. No secrets, schema, Google writes, household data changes, or Production activation.

Rollback: revert this client correction and redeploy the Worker assets if Calendar startup or credential scope regresses. No data migration or cleanup is required.

## Handoff
PR and deployment receipt to be reported in the task. No authenticated Google data read or external events written. After deployment, Jonathan must use Connect/Reconnect Calendar on the relevant device to supply any missing/expired Calendar consent; app identity alone is insufficient.
