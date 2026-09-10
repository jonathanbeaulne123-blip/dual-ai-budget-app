# Hercules slice 2 — personality and private continuity

Status: implemented and verified locally. Jonathan authorized slice 2 in this task. No push, merge, deployment, schema application, secrets or live provider-data tests.

Base: local slice-1 commit `636bfeb62c9df89ca8eb13ae6d77aca13a21ee2f`; main verified `2e113f69d03872eddc22ac461378a0f3e33f6c55`. Branch `codex/hercules-personality-memory`. Single writer; independent Codex authority and UI read reviews completed. No Claude usage.

Risk: High. **Budget delta (5):** private context stays member/view scoped; fresh financial facts and Final Confirm retain authority. **Engagement delta (3):** affectionate little diva voice, bounded conversation continuity and reviewable explicit preferences.

## Implemented behavior

- Member-personal profile round trip through shaping, split/overlay/assembly, import parity, backup, command admission and event replay. Existing v2 authority carries the profile; no new table or binding. Actor binding and resource revisions protect preferences, conversation generation and deletions.
- Recent conversations stay separate by environment, household, member and ledger view. User/reply pairs share one atomic acknowledged command. Pending complete session exchanges support follow-ups; failed saves remain explicitly unsaved and retry uses the same ID. Scope switches invalidate pending replies, controls and gestures.
- Versioned affectionate-diva voice, longer paragraph-preserving answers, bounded disclosed history and validated presentation cues. Local fallback remains warm through financial stress. Casual companion narration requests lower Gemini thinking; the independent grounded read-tool planner retains its reasoning.
- Finite explicit preferences with edit, forget, remembering off and separate conversation clearing. Remembered receipts and revision-guarded Undo appear only after ACK. An invalidated preference or Undo leaves the queue without blocking subsequent conversation.
- Controls in chat and Hercules outfits use authored Classic, Taylor and Newfoundland styles. Desktop disclosure is clickable, expanded chat stays within the viewport, and compact answers can open the full conversation.
- Legacy shared chat/notes remain an accurately attributed read-only archive and never enter new active model history. Ordinary Development households no longer receive bulk synthetic disclosure without an actual fixture marker.
- Retention: 30 days / 300 turns per view; expired context is excluded immediately and durable pruning occurs on the next private mutation. Model context is at most six complete pairs / 8,000 characters. Credentials are scrubbed; previous amounts are not fresh financial authority.

## Verification

Final High quick gate **passed: 277 tests in 18 files** (190 fast / 87 serial), AI surface verification, TypeScript and diff checks. Total **341.146 seconds**, exceeding the five-minute target by **41.146 seconds**; TypeScript was the slowest phase at 210.710 seconds. This is a passing gate with a recorded time-budget breach, not an exhaustive-suite result. Source fingerprint `4f6f52dcc7eaec13e5350ba2a2861c9fcd030a18887145458482786d61208e27`, base/head above; evidence log `/tmp/hercules-s2-frozen-gate.log`. Only final evidence/index documentation changed afterward. The prior iteration also passed in 197.933 seconds; final evidence supersedes it.

Production build **passed**: TypeScript, Vite, Hercules Pro UI packaging and the no-redirects check. Vite completed in 12.22 seconds. Dependency warnings remain for PGlite eval/Node browser externals and chunks above 500 kB; these did not fail the build. Log: `/tmp/hercules-s2-build.log`.

Actual local App browser proof: **21 cases passed** — expanded chat memory controls in Shared and Personal views at 320, 390 and 1440px in all three themes (18), plus the desktop More on this desk → Hercules outfits entry in all three themes (3). No control overflow, axe WCAG A/AA violations within the new memory controls, or uncaught page errors. Disclosure was operated by pointer and the desktop opener by keyboard. Screenshots inspected, including expanded desktop and wardrobe controls.

Browser evidence: `.artifacts/hercules-slice-2/report.json`, `personal/report.json`, `wardrobe-report.json` and matching screenshots/runners. These use a fresh local synthetic demo, installed Chrome and reduced motion. All non-local requests were blocked and local Hercules endpoints returned controlled 503 responses. Web Locks were disabled only in these isolated browser contexts to exercise the existing local fallback. No real household, cloud, or provider request was made. This is not physical-device, full-page accessibility, Web Locks/PGlite compatibility, or authenticated two-device proof.

Mounted UI regressions prove pending conversation continuity, stable-ID retry, scope cancellation, restoration of the previous preference without a second Undo, and recovery after a stale Undo. Authority tests prove private/shared exclusion, paired atomic ACKs, unrelated-command preservation, old-client refusal, actor binding, resource conflicts and late-candidate cancellation. Mocked Gemini route tests exercise ordered history, preference/character prompts, optional cues and malformed output fallback.

Earlier exploratory `test/companion-office-update.test.ts` exposed an existing source-string assertion for `herculesTapIntent` that is already absent in the slice-1 HEAD. It was not changed or counted as passing evidence. The other 12 assertions passed. No exhaustive lane was requested or run.

## Remaining release gates

- Deploy the profile-compatible server before admitting new companion clients; rollback must preserve private profile fields. No deployment performed here.
- Run the 24-scenario live dialogue quality rubric, including latency and stressed/follow-up conversations. Mocked provider tests do not establish Gemini's live personality quality.
- Verify authenticated continuity on two real devices, privacy across members, real offline/reconnect recovery and physical accessibility.
- Slice 3 implements useful discovery/predictive suggestions. The promised 3D wardrobe and expanded catalogue remain slices 4 onward; this slice adds memory settings to the existing outfits surface only.

References: [approved plan](../briefs/HERCULES_LIVING_COMPANION_PLAN.md), current CLOUD_CONTINUITY and DECISIONS; official Workers/Durable Objects guidance and [Gemini thinking documentation](https://ai.google.dev/gemini-api/docs/gemini-3) consulted.
