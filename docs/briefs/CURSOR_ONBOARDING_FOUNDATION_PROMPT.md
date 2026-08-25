# Cursor prompt — Onboarding Slice A: foundation and target contract

> Send this only after the D-128/D-129 planning branch is available on `main` or explicitly provided to Cursor. Cursor must not start from an older roadmap or invent missing decisions.

```text
You are implementing Hearth Onboarding Slice A: the foundation and target contract.

Repository:
https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app

Required authority, in order:
1. Jonathan's latest explicit instruction
2. docs/ONBOARDING_PART2_STORYBOARD.md
3. D-128 and D-129 in docs/DECISIONS.md
4. docs/ONBOARDING_UPDATE.md
5. docs/CLOUD_CONTINUITY.md and existing command contracts

Do not begin until all named planning documents are present on your baseline. Create a current-main branch named cursor/onboarding-foundation-d129. Do not merge or copy an older onboarding experiment.

Purpose:
Build the reusable, declarative onboarding coordinator and visual/interaction primitives. Do not implement the financial scenarios, opening-balance command, final Hercules copy, or final visual polish in this slice.

Use your other AI models as independent reviewers for:
- React/state-machine architecture;
- keyboard/focus/target locking;
- responsive geometry and target/dialogue collision;
- state identity, interruption, and exactly-once progress;
- performance of blur/scale/walking choreography.

Locked product behavior:
- The real Home renders, then onboarding automatically begins for the first eligible Google member+household+environment.
- One persistent Skip tutorial action exists. Replay is More → Replay tutorial. Do not add a chapter picker or settings toolbar to the scene.
- Only the highlighted real control and Skip are operable. No timer advances a scene.
- Text types quickly; first tap reveals, required semantic action advances.
- Hercules route plans end beside/on the real target and use the nav control as the continuous page-transition anchor.
- Simulated camera scrolls the real target into a safe rectangle, slightly scales/lifts it, and blurs/dims the background. Never browser-zoom and never clone a fake interactive control.
- Dialogue automatically chooses top/bottom or the least-obstructed desktop quadrant.
- Phone rotation pauses for portrait; desktop resize recomputes and continues.
- Full onboarding motion is mandatory even when prefers-reduced-motion is set. This deliberate D-129 exception applies only to onboarding; do not remove Hearth's existing reduced-motion behavior elsewhere.
- No tutorial-specific sound.
- Practice is ephemeral and isolated by D-128. It must not enter Household, PGlite, command ingest, persistence, continuity, reports, streaks, Health, or accepted-money progress.
- Tutorial copy is deterministic and versioned. No AI/provider request is required.
- Progress identity is environment + household id + authenticated Google member identity + registry/chapter version. Layout-only progress also keys phone/desktop.
- Resume only from a declared safe step. Never replay or infer a money confirmation.

Implement:
1. Pure onboarding registry/types/validation in src/core/onboarding/.
2. A coordinator reducer/state machine with explicit states for eligibility, entering, routing, focusing, typing, waiting-action, reacting, saving-progress, paused-conflict, skipped, completed, and target-missing.
3. Semantic expected-action events. Arbitrary click, DOM text, toast, timeout, or model reply must never complete a step.
4. Stable data-onboarding-id target contract plus a small registration/resolution adapter. Add only the minimum anchors needed to prove the foundation with representative Home/nav/dialog targets; do not annotate every feature yet.
5. Focus/interaction-lock layer that preserves the real target's pointer and keyboard semantics, traps unrelated in-app interaction, restores focus on exit, and does not interfere with browser controls.
6. Pure safe-rectangle and dialogue-placement geometry with header/nav/safe-area/keyboard/Hercules exclusions.
7. Route-plan abstraction that can later adapt to Hercules and OfficeIntent without embedding scene sequence in page components.
8. Ephemeral PracticeSession container with explicit destroy/copy-to-draft interfaces. The copy adapter remains a stub/contract in Slice A and may not call a command.
9. Progress-store interface and an in-memory/local test adapter. Do not add hosted schema, migrations, REST calls, or new Google scopes. The later continuity adapter will implement the same interface.
10. One persistent Skip action and a More → Replay tutorial entry wired to the coordinator shell. If adding the replay control would require unfinished scenario content, gate it behind the foundation feature flag and label it truthfully.
11. Diagnostics that record only ids/states/geometry reason codes—no household notes, amounts, names, or journal content.

Do not:
- edit supabase/, migrations, SQL, Cloudflare, Workers, Auth/RLS, environment flags, deployment workflows, or secrets;
- call the hosted household project;
- add or change money commands;
- write Practice data into Household or localStorage snapshots;
- alter existing Hercules chat/provider behavior;
- introduce Framer Motion, GSAP, Lottie, Rive, or another animation dependency without a measured proof that CSS/Web Animations cannot satisfy the foundation;
- scatter tutorial sequencing through App.tsx, page components, or CSS selectors;
- use querySelector guesses based on classes/text;
- push, open a PR, or deploy until the requested local proof and independent review report are complete.

Required proofs:
- registry rejects duplicate chapter/scene/target ids and invalid safety/completion combinations;
- exact identity/version eligibility, skip, replay, and completion;
- refresh resumes only last safe step;
- arbitrary clicks, timers, toasts, and stale semantic events cannot advance;
- household/member/environment switch invalidates the active scene;
- target loss unlocks safely and reports target-missing;
- focus returns correctly after skip/complete;
- phone geometry at 320, 390, and 430 CSS px including keyboard/safe-area cases;
- desktop geometry at 720, 1024, 1280, and a live resize;
- phone rotation pause and portrait restore;
- onboarding full motion remains active under prefers-reduced-motion while non-onboarding existing motion rules remain unchanged;
- Practice destroy proves no Household mutation, PGlite call, persistence, outbox, report, streak, or Health delta;
- no new network calls during deterministic tutorial delivery.

Run the canonical repository tests, TypeScript check, build, and any ai:verify/check scripts that exist on the current baseline. Use serial Vitest if parallel workers contend.

Handoff:
- root cause/current architecture versus new foundation;
- changed-file list;
- state and event tables;
- target and geometry contracts;
- exact tests and results;
- independent reviewer findings and repairs;
- residual risks;
- confirmation that no migration/provider/hosted/deployment work occurred;
- proposed next anchors for Slice B/C, without implementing them.
```
