# Onboarding Update — Part 2 motion and interaction storyboard

> **Status:** Product direction locked as D-129 on 2026-08-25; ready to brief the foundation slice after the planning branch is shared.
> **Authority:** [ONBOARDING_UPDATE.md](ONBOARDING_UPDATE.md), D-128, D-129, and Jonathan's answers to Part 2 questions 1–36.
> **Boundary:** This document plans interaction and motion. It authorizes no runtime implementation, hosted migration, deployment, provider call, or real household posting.

## 1. Experience sentence

Hearth onboarding is a guided live-kitchen sequence using classic Pokémon dialogue and player-control rhythm with Hearth's own artwork and smooth modern camera treatment: the real interface loads, Hercules emerges from his paper bag, walks a deliberate route to the exact control, the camera focuses and blurs around that control, dialogue moves out of the way, and the member performs the highlighted action before anything continues.

It is not a tooltip carousel, movie, chatbot conversation, or second copy of Hearth.

## 2. Locked interaction contract

### Start, control, and exit

- On the first eligible Google-member opening of a household, render the real Home first, let its layout settle, then start automatically.
- Hercules emerges from the paper bag. There is no separate full-screen trailer or `Start` gate.
- One persistent **Skip tutorial** action is available throughout. Do not add pause, chapter-picker, or settings buttons to the scene chrome.
- Skipping leaves the member in the ordinary app at a safe boundary. Replay lives in **More → Replay tutorial**.
- While a scene waits for a specific interaction, every unrelated in-app control is disabled. The highlighted real control and Skip remain operable.
- The scene never advances on a timer. Text and motion may finish, but the coordinator waits indefinitely for the required member action.
- A money draft cannot be escaped halfway through an acceptance attempt. Before Confirm begins, Skip cancels the tutorial draft and exits without a write. While Confirm is pending, the coordinator waits for its typed result, then resumes or reports the failure.
- Browser close, crash, or refresh resumes only at the last safe step. It never recreates or repeats a confirmation.

### Pokémon-inspired dialogue rhythm

- Use Hearth's visual identity; copy no Pokémon art, characters, sounds, names, pixels, or trade dress.
- Dialogue is a bordered Hearth paper panel that alternates between the top and bottom safe zones.
- Placement is computed from the focused control, Hercules, keyboard, bottom navigation, and viewport—not hard-coded per screen size.
- Text types quickly. First tap reveals the complete current message. The required action, or a second tap on explanation-only scenes, advances.
- Dialogue is deterministic and versioned. No model or provider call is required to deliver or complete onboarding.
- No tutorial-specific sound is used.

### Hercules

- Hercules walks the full visible route rather than teleporting.
- On page changes he walks to the actual navigation control, paws it, remains visually attached to that same location through the scene transition, then continues walking from the corresponding new-page entrance to the target.
- Route planning must end beside, above, or perched on the target without covering its label or hit area.
- At the target he faces it and performs one restrained paw/tap gesture.
- Successful steps receive a paw stamp, a small double-hop, and one short line.
- Incorrect input receives a funny confused reaction, an exact correction, and another wait for the member to fix it. Hercules may never repair a financial choice automatically or joke about the member.
- The default copy is highly personal and frequently funny. Copy is stored as semantic meaning plus selectable tone variants so later testing can offer **Gentle**, **Classic Hercules**, and **Extra cheeky** without changing accounting meaning or step completion.

### Camera and focus

- “Camera” is simulated; never use browser zoom and never clone a fake interactive control.
- Scroll the real target into its safe rectangle, slightly scale/lift its real surface, blur and darken the background, and keep the target crisp.
- The target remains the actual accessible control. Pointer and keyboard input outside the target is captured by the onboarding layer.
- The focus layer must account for sticky headers, phone bottom navigation, the dialogue panel, Hercules, safe-area insets, and the software keyboard.
- Phone rotation pauses and asks the member to restore portrait. Desktop resize recalculates the same step and continues.

### Progress and completion

- A small paw-print trail represents the core chapters. It shows progress, not a score or streak.
- Concept completion is shared for environment + household + Google member.
- Phone and desktop location lessons are separately completable. A financial concept learned on one device is not repeated on another.
- The final scene animates Hercules across the completed paw trail, stamps a personalized Ready for September card, briefly animates the room's configured instruments, and exposes one button: **Ready for September**.
- That button completes onboarding and enters the normal Home. Replay remains in More.

## 3. Practice kitchen contract — D-128

- Practice uses lavender/blue paper, dotted borders, and a persistent **Practice — nothing here is real** ribbon.
- Ordinary transaction teaching always uses Practice.
- Work teaching simulates a four-hour Practice shift. No real clock time or provider service is consumed.
- Practice mirrors the real draft/review interaction, but its terminal button is **Finish practice**, not Confirm.
- Practice activity never enters journal rows, PGlite ingest, continuity snapshots/outbox, reports, duplicate history, work history, streaks, reminders, Health, or progress claiming accepted money.
- After successful Practice review, **Copy to real draft** may be offered. It is an explicit new action, produces only an ordinary draft, and still requires the real review and Confirm boundary.
- Leaving or finishing the chapter destroys its ephemeral Practice state.

## 4. Deliberate motion accessibility exception

Jonathan directed full onboarding animation with no reduced-motion substitute. The onboarding layer therefore does not change its choreography in response to `prefers-reduced-motion` and does not provide a Reduce movement control.

This is a deliberate, documented exception to the reduced-motion acceptance gate in Part 1. It must not be described as WCAG-conformant. The motion is entirely client-side; API quotas, Workers AI limits, cloud rate limits, and provider usage do not constrain it. Only device capability/performance may shorten frame detail without changing the required route and focus sequence.

This exception applies only to the onboarding layer. Do not remove the existing reduced-motion behavior from the rest of Hearth as collateral work.

## 5. Scene grammar

Every step is one declarative scene:

```ts
type OnboardingScene = {
  id: string;
  chapterId: string;
  route: HearthTab;
  targetId?: string;
  entrance: "bag" | "current" | "nav" | "page-edge";
  routePlan: HerculesRouteSegment[];
  dialogue: SemanticDialogueKey;
  dialoguePlacement: "auto-opposite-target";
  camera: "focus" | "wide" | "celebration";
  expectedAction: OnboardingExpectedAction;
  safety: "no-write" | "draft-only" | "practice" | "real-confirm";
  resume: "same-step" | "last-safe-step" | "chapter-start";
  successPose: HerculesPose;
  mistakePose?: HerculesPose;
};
```

Coordinator order:

1. Resolve eligibility and last safe progress.
2. Resolve the stable `data-onboarding-id` target.
3. Lock unrelated controls.
4. Calculate the safe target rectangle and dialogue zone.
5. Walk Hercules along the registered route.
6. Scroll/focus/blur the real target.
7. Type the deterministic dialogue.
8. Wait for the exact expected semantic event.
9. Validate that the event belongs to this member, household, environment, scene, and draft identity.
10. Play success or mistake reaction.
11. Save progress only when the scene's completion condition is true.

No step may infer completion from a toast, DOM text, elapsed time, arbitrary click, or model response.

## 6. Core storyboard

### Chapter 0 — Welcome home

**Trigger:** first eligible Google-member household entry after Home layout settles.

1. Normal Home appears for a short visual beat.
2. Other controls lock; Skip tutorial appears.
3. Paper bag rustles; Hercules emerges and walks into a clear Home position.
4. Camera holds a wide view. Dialogue occupies the zone opposite Hercules.
5. Hercules introduces his rules: he explains, points, and keeps his paws off Confirm.
6. Bianca taps to reveal/advance. A paw print completes Welcome.

Phone: bag begins above bottom navigation and Hercules moves to the outer edge of the Home object rail.
Desktop: bag begins near the lower desk edge; Hercules walks onto the Office surface without covering an instrument.

### Chapter 1 — The two books

1. Hercules walks to the Household/Personal view switch.
2. Camera scrolls/focuses the switch; dialogue moves opposite it.
3. Bianca taps Personal. Hercules explains that it is her page but not yet a privacy promise before the security cutover.
4. Bianca taps Household. Hercules explains the shared ledger.
5. Development is focused briefly and described as the September trial environment.
6. The concept paw completes for every device; location completion is recorded for this shell only.

### Chapter 2 — Bring the books to today

This is real money setup and uses the real Confirm boundary.

1. Hercules walks to Books navigation and paws it; the new page opens from that same visual anchor.
2. Camera focuses **Bring accounts to today**.
3. Use one Toronto as-of date for the session.
4. Show existing shared accounts plus the current member's Personal accounts. **Add account** opens the ordinary account editor and returns to the same setup list.
5. Bianca enters real current balances/debts one account at a time. Zero stays skipped.
6. The review visibly shows each account, signed amount, scope, and the balancing Opening equity line.
7. Hercules explains Opening equity as a starting line—not income, spending, or invented history.
8. Bianca alone presses Confirm. Hercules moves away from the button before it becomes active.
9. Coordinator waits for the typed command result. Exactly-once acceptance completes the chapter; rejection remains on the exact field; uncertainty routes to recovery and never celebrates.

This locks the opening-truth recommendations: automatic entry through onboarding, existing account editor reuse, and current-member shared + Personal scope. Another member enters their own Personal opening truth from their identity.

### Chapter 3 — Read the wallet

1. Hercules continues from the Books entrance to the Wallet/story tile.
2. Camera focuses the first configured account rather than a hard-coded Chequing tile.
3. Bianca opens each configured account room and verifies the displayed balance.
4. Hercules contrasts account (“where value sits or what is owed”) with category (“why it moved”).
5. A mismatch offers a route back to opening correction; no automatic correction occurs.

### Chapter 4 — Post one ordinary thing in Practice

1. Hercules walks to Add and paws it.
2. Practice ribbon and lavender paper enter before any amount field activates.
3. A clearly invented grocery scenario is presented; Bianca enters the digits as cents.
4. Camera progresses through amount, category, ownership, account, and review as separate focused steps.
5. Wrong input triggers the confused reaction and exact field guidance.
6. Terminal action is **Finish practice**. No command runtime or continuity event fires.
7. Success earns a paw stamp. **Copy to real draft** is available but not required and never posts.

### Chapter 5 — Correct the footprint

1. Remain in Practice and display the completed practice entry in a temporary Recent changes surface.
2. Hercules walks to Reverse/Correct and explains that the original footprint remains visible.
3. Bianca performs the correction herself.
4. The simulated reversal and replacement must balance internally but are destroyed at chapter exit.
5. Hercules double-hops after the corrected practice history agrees.

### Chapter 6 — Put September on the board

1. Hercules walks to Calendar navigation and continues from its corresponding entrance.
2. Camera focuses **Add repeating**.
3. Bianca creates one real September reminder using the existing recurrence form.
4. The tutorial prefers reminder-only first. If Bianca chooses post-first, the ordinary real Confirm boundary applies.
5. Hercules explains that a date reminds; Paid/Confirm writes.
6. Calendar displays the created item, and the paw completes.

### Chapter 7 — Teach the job

1. If no current-member job exists, Hercules routes to **Add job**.
2. Camera focuses the job editor one meaningful group at a time: role, wage/take-home mode, tips/tip-outs, pay/tip days, and landing accounts.
3. Bianca performs required choices; Hercules never fills financial values invisibly.
4. Save creates configuration only and does not post money.
5. If a job already exists, Hercules offers a focused review rather than duplicating it.

### Chapter 8 — Simulate a four-hour shift

1. Hercules walks back to Home/Timesheet using the actual navigation route.
2. Practice ribbon appears before the punch interaction.
3. Bianca taps Clock in. The practice clock animates through a four-hour shift without waiting in real time.
4. Optional job rules demonstrate breaks, sales, cash tips, credit tips, and tip-outs only when configured.
5. Bianca clocks out and reviews wages, tips before/after tip-outs, and destinations.
6. Terminal action is **Finish practice shift**. It creates no shift, income, receivable, report, streak, Calendar event, or cloud state.
7. **Copy to real draft** is available only as an explicit draft path.

### Chapter 9 — Ask the books

1. Hercules walks to Books → Ask.
2. Camera focuses a deterministic suggested question grounded in the configured books.
3. Bianca taps the question and sees the on-device answer.
4. Hercules explains that he can quote and navigate but cannot Confirm or post.
5. No model response is necessary for chapter completion.

### Chapter 10 — Finish clean

1. Hercules walks to Health/Lamp using the appropriate shell route.
2. Camera focuses the current Health result.
3. If clean, explain that the books agree with themselves.
4. If findings exist, focus the first actionable finding and explain it honestly; do not block the entire tutorial unless money validity is uncertain.
5. Explain device-independent cloud continuity: no phone must remain online; offline accepted work waits to resync.

### Chapter 11 — Ready for September

1. Camera returns to a wide room view.
2. Completed paw prints animate in order.
3. Hercules walks across the trail and stamps the personalized Ready for September card.
4. Configured Wallet, Calendar, Timesheet, Ask, and Health surfaces make one brief coordinated motion.
5. Show actual completion facts, not invented amounts: accounts current, September reminder present, job configured, practice complete, Health state.
6. Expose one action: **Ready for September**.
7. Pressing it records completion and enters normal Home.

## 7. Phone choreography

- Portrait is the supported onboarding orientation. Rotation pauses and requests portrait restoration.
- Keep Hercules near an outer edge except while walking; never cover the bottom navigation.
- Reserve two dialogue zones: below the header and above the bottom navigation. Pick the zone farthest from target + Hercules.
- Scroll the target to the remaining safe rectangle before camera focus begins.
- The software keyboard may shrink the safe rectangle; recompute instead of covering the field.
- One target per frame. Multi-field forms advance their focus scene-by-scene without closing the form.
- A focused target remains at least 44 × 44 CSS pixels and keeps its accessible name.

## 8. Desktop choreography

- The Office remains the world; do not replace it with a phone-shaped tutorial card.
- Hercules uses registered instrument and navigation routes rather than arbitrary coordinates.
- Expand the target instrument through the existing expand/bump coordinator before camera focus.
- Route displaced instruments using the existing bump model. Tutorial completion restores the member's prior layout.
- Desktop resize recomputes positions and continues the current safe step.
- Dialogue chooses the open quadrant with the least overlap. It may never cover the focused instrument, Hercules, or required review/Confirm summary.

## 9. Interruption and failure matrix

| Event | Required behavior |
|---|---|
| Skip on explanation/practice step | Destroy practice/draft state, save skipped status, unlock app, open normal current page. |
| Skip before a real Confirm | Cancel the onboarding draft through its existing cancel path; no write. |
| Confirm pending | Disable Skip until a typed outcome returns; never infer success from elapsed time or toast. |
| Validation failure | Hercules reacts, camera focuses the failing field, and the same step remains active. |
| Retryable cloud failure after local acceptance | Celebrate only local acceptance truth, show pending transport honestly, and allow onboarding to continue. |
| Conflict | Pause onboarding and give the real conflict surface priority. Resume at last safe step after resolution. |
| Offline | Real locally accepted commands follow the existing outbox contract; Practice remains local ephemeral state. |
| Refresh/crash | Resume last safe scene. Never replay a submitted confirmation or retain Practice money. |
| Missing target | Unlock the page, log a target-version diagnostic without household content, and offer Skip; never spin or click a substitute. |
| Phone rotation | Pause and ask for portrait. |
| Desktop resize | Recalculate target, route, dialogue, and focus layer in place. |

## 10. Implementation slices

### Slice A — Foundation and target contract — Cursor

Build the declarative registry, coordinator state machine, target anchors, focus/lock layer, safe dialogue placement, route abstraction, member-scoped progress adapter, skip/replay, Practice-state container, and deterministic unit/component proofs. Do not wire real scenarios or redesign financial commands.

### Slice B — Real setup and Practice scenarios — Codex

Build opening truth through the typed money boundary, Practice transaction/correction, four-hour Practice shift, copy-to-real-draft adapters, and accounting/continuity proofs.

### Slice C — Phone and Office choreography — Codex

Implement the approved Hercules route plans, bag entrance, camera focus, top/bottom dialogue, mobile scrolling/orientation, Office expansion/bumping, tone variants, paw progress, and final celebration.

### Slice D — Cross-model adversarial hardening — Cursor review, Codex repairs

Use independent architecture, accessibility, responsive-layout, performance, and books reviewers across phone/desktop, interruption, offline, target loss, identity switching, and copy variants. No separate visual redesign is authorized in this slice.

## 11. Part 2 acceptance

Part 2 is planned when:

- all core scenes name route, target, dialogue placement, expected action, safety class, success, mistake, skip, and resume behavior;
- phone and desktop movement rules are distinct and compatible with their existing shells;
- D-128 Practice never touches books or continuity;
- D-129's deliberate full-motion exception is explicit rather than falsely claimed accessible;
- Cursor's Slice A prompt has an exact file/scope/test boundary;
- Jonathan can inspect the step-through storyboard and request scene changes before runtime implementation.
