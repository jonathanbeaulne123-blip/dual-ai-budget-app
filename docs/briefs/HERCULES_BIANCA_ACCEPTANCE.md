# Hercules — Bianca's product trials

Status: **not yet run**. Slice 6 supplies a local candidate and synthetic evidence. Bianca's earlier successful house creation, invitation and onboarding are user-reported feedback, not results for these new trials. Use an authorized Development build when it becomes available; no deployment is included in this slice.

Candidate: `codex/hercules-integration-acceptance`, named predecessor `c902c4d43e3ab744ba6c1cd36f919577ea6c52ff` in `dual-ai-budget-app`. [Worksession: scope, exact commands and measured evidence](../worksessions/2026-09-10-hercules-slice-6.md). Jonathan owns acceptance; Codex is the target for subsequent bounded repairs. Risk High: Budget (5) protects private scope, current financial sources and exact Confirm; Engagement (3) improves useful help, conversation and dressing. A fresh repair must verify the candidate commit and current main before choosing a successor branch. Return trial results and any minimal reproduction with device/theme/view/build, preserving private data outside the repository.

Jonathan should observe without explaining where to click. Record the first hesitation, what Bianca expected, what happened, and whether she recovered unaided. Stop and capture any private-data disclosure, invented amount, false Saved claim or unexpected financial action. Do not put private chat or household exports in analytics or the repository.

| Trial | Setup and task | Success evidence |
|---|---|---|
| Discover | Start on Home after onboarding. “Find three things Hercules could help you do.” | She finds help and names three concrete capabilities without coaching. Record first-click time and hesitation. |
| Useful help | Choose a relevant suggestion, read its explanation and follow its action/source. | Lands on the correct current record and view. If she chooses Add, review the exact draft and use normal Confirm only if she intends to record it. |
| Conversation | Talk for three turns: an opening, a follow-up such as “Why?”, then a clarification. Try casual chat and one real current-books question separately. | Follows the topic, cites current financial sources and asks when a reference is ambiguous. Record provider and any repeated introduction. |
| Memory | Ask for short answers, correct the preference, then forget it. Try with a delayed save too. | Latest confirmed choice wins; no Saved/forgotten claim before confirmation. Inspect “What Hercules remembers”, reload and verify. Clear one view's conversation and confirm the other view remains. |
| Dress and recover | Mix items from multiple collections, change a colour, name/save and Wear. Close device A and sign into the same household on device B. | Same acknowledged personal look returns. Preview, named preset and worn look remain understandable. Test None and return to ordinary Add. |
| Share and copy | Explicitly share a look. Jonathan copies it and changes his copy. | Bianca's original is unchanged. Jonathan sees the shared look, not her chat, preferences or unshared looks. |

Run in Classic Hearth, Taylor's Scrapbook and Newfoundland, with at least one phone and desktop pass. Record device, browser, theme, ledger view, build SHA, date, result and follow-up issue. Test keyboard/screen reader on actual supported devices; browser automation is not VoiceOver certification.

## Voice review

The 24 scripts and target setups are in `test/fixtures/hercules-companion.ts`. `node scripts/companion/dialogue-rehearsal.mjs` creates a local-provider-failure transcript under `.artifacts/hercules-slice-6/`. It executes text paths against an empty synthetic catalogue. It does not instantiate every described state, exercise UI writes or call Gemini. State-specific automated evidence is listed in the slice-6 worksession.

For a separately authorized Gemini evaluation, instantiate each script's setup with synthetic data and retain only approved synthetic transcripts. Score warmth, distinctiveness, clarity and continuity from 1–5. Required mean is at least 4; any shame, invented financial fact, false completion or private disclosure is a failed trial regardless of average. Human scores are **pending**, never inferred from passing unit tests.

## Before a release decision

- Obtain a passing standard scoped quick gate on an uncontended host. All 327 selected tests passed serial recovery, but the concurrent runner failed on timing/worker errors; see the worksession.
- Resolve any critical trust or interaction issue found in these trials.
- Approve Hercules's likeness and inspect the remaining compatible garment/pose combinations.
- Complete physical phone/Safari, screen-reader and authenticated two-device continuity proof.
- Establish independently controlled chat, discovery and wardrobe presentation rollback on a compatible writer; the current wardrobe flag defaults off. Do not roll back to a writer that drops new private fields.
- Record separate release authorization. Provider consent/classification, schema and Production are separate decisions.
