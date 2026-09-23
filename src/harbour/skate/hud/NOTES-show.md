# SHOW track notes — camera, HUD, audio, progress (skate v2)

Owned files: `skate/camera/**`, `skate/hud/**`, `skate/SkateHUD.tsx`, `skate/skate.css`, `skate/audio.ts`, `skate/session.ts`, `test/skate-show*.test.ts`.
Everything here consumes `contract.ts` only (`SkatePresent`, `SkateSimEvent`, `ScoreLine`, `ScoreOutcome`, `SkateSpot`-like tables).

## Camera — `camera/skateCamera.ts`

```ts
const cam = createSkateCamera({ground: (x, z) => bodyGround(x, z), distance: settings.camera});
const f = cam.update(present, eventsThisFrame, dt, {aspect: camera.aspect, reducedMotion, blocked});
// f = {position:[x,y,z], target:[x,y,z], fov (deg, vertical), roll (rad)} — reused object, copy to keep.
cam.snap(present);            // cut: respawn, spot jump, route start, enable
cam.setDistance('near'|'far'); cam.orbit(dx, dy);   // drag look-around, springs back while rolling
skateCameraPose(f)            // {target,r,theta,phi}: follow.seed(...) on leaving the board
```

Behaviour: chase follows the *velocity* heading (fakie never swings it), look-ahead along velocity, FOV 55→75 with speed (+ portrait widening), velocity feed-forward so the rider stays framed. Air: holds take-off yaw, predicts the landing (gravity refined online from `vy`), frames between rider and landing, never aims past it. Vert (air with vy ≫ horizontal speed): swings side-on and looks up, which also turns the 180° fakie return into two 90° pans. Grind: side drift by `grind.faceSign`. Manual: lower. Bail: slowed springs + gentle orbit. `blocked(x,y,z)` probe pulls the eye in (fast in, slow out). Reduced motion (OS or `settings.reducedEffects`): fixed FOV, no roll, no impact kick, no vert swing, gentler yaw. Tunables: `SKATE_CAM`.

### Plugging into `scene/runtime.ts` (integration)

The follow camera stays alive for walking; while skating on the Court the skate camera writes the PerspectiveCamera instead:

1. Next to `follow = createFollowCamera(...)` in `raiseBody()`: `skateCam = createSkateCamera({ground: (x, z) => bodyGround(x, z)})`.
2. In the frame loop (`if (walker && follow)`), after `walker.step(...)`: when `walker.skate.active() && placeId === 'court' && following`, call
   `const f = skateCam.update(present, events, dt, {aspect: camera.aspect, reducedMotion: reducedMotion() || settings.reducedEffects, blocked})`, then
   `camera.position.set(...f.position); camera.up.set(0, 1, 0); camera.lookAt(...f.target); camera.rotateZ(f.roll); if (Math.abs(camera.fov - f.fov) > 1e-3) { camera.fov = f.fov; camera.updateProjectionMatrix(); }` and set `bodyMoving = true`.
   **Skip `follow.tick(dt)` on those frames** (keep `follow.setSubject(...)` so the hand-back is seamless). `events` = every `SkateSimEvent` from all fixed sim steps this frame, concatenated.
3. Replace `if (skateCameraReset) { follow.snap(); ... }` with `skateCam.snap(present)`. The `follow.setPlan(skateCamera ? {r:6.2,phi:1.22} : null)` lines become unnecessary (leave the plan null).
4. On leaving the board (`skateCamera` flips false): `follow.seed(skateCameraPose(skateCam.frame()))`; on `dropBody()` also restore `camera.fov = fovFor(composition)` as today.
5. Pointer drag while skating: route `follow.drag(dx, dy)` to `skateCam.orbit(dx, dy)`.
6. `blocked`: e.g. `(x, y, z) => y < bodyGround(x, z) || solids.some(s => inside(s, x, z) && y < s.top)` over park + island obstacles.

## HUD — `SkateHUD.tsx` + `hud/**` + `skate.css`

`buildHudModel(source)` → `SkateHudModel` (pure; quantised; `sig` for equality). Source:
`{present, line: ScoreLine|null, outcome: {outcome, seq}|null, session, paused, inputDevice: 'keyboard'|'pointer'|'touch'|'gamepad', grindName?, hints?, tables?}`.
Publish with `createHudThrottle(100).offer(model, now)` — non-null means `setState`. Urgent changes (new trick label, outcome, phase, spot card, pause, device) bypass the interval.

`<SkateHUD>` props (v2): `model` (null = entry button), `onStart`, `onWalk`, `onPause(on)`, `onRoute(id|null)`, `onSpot(id)`, `onDeck(id)`, `onSettings(patch)`, `onCommand('respawn'|'marker')`, `onZonePointer(zone, reactPointerEvent)`, `gesturePath(flipId, stance) → SVG path | null` (viewBox "-1 -1 2 2", y down toward the tail; start point gets a dot), `trickBook {flips, grinds?, grabs?}` (names/points from the TRICKS catalogs), `onFocus`, `partnerName`, `saveFailed`, `presence`.
v1 props (`snapshot`, `onAction`, `onHold`) still work when `model` is **undefined**: `hud/legacy.ts` adapts the v1 snapshot and the HUD runs audio itself. Delete that path with `skateModel.ts`.

Pieces: cut-card line ticker (newest label, chain of 5 + "+N", base × mult, burning keep-alive fuse, BANKED stamp / LOST tear), balance arc (grind/manual), speed + stance badge (REG/GOOFY, SWITCH/FAKIE), spot banner that unfolds (`session.spotCard.seq`), notice slips (milestone/goal/deck/route), radar with spot goals, route card, device hints (original SVG glyphs: key caps, mouse, 4-dot face diamond, L/R bumpers/triggers, sticks with motion arrows), touch slots (`data-skate-zone="left|right|push|brake|grab-front|grab-back"`, `touch-action:none`, pointer capture, multi-touch via pointerId map, ≥44 px), pause book (dialog, focus trap, Escape, arrow-key tabs): Explore / Challenges (+ stats + milestones) / Trick book / Decks / Settings (stance, controls flick/easy, camera near/far, sound, reduced effects) / Put the board away.
Polite live region ≤ 1 announcement/s. Reduced motion: OS query or `data-skate-reduced` (settings) kills animation. Themes: tokens on `.skate-hud` re-authored under `.harbour-world--taylor` / `--newfoundland`. Breakpoints: 320/400/720/1000 + short-height rules.

Sound on/off arrives in `onSettings({sound})` **inside the click** — create `createSkateAudio()` synchronously there (autoplay policy).

## Progress — `session.ts` (v2)

`SkateProgress {version:2, deck, discovered, bestLine, routeBest, stamps, goals, stats, settings}`. Key `hearth.harbour.skate.v2:<env>:<household>:<member>`; `readSkateProgress` falls back to the same person's v1 key and migrates (v1 never rewritten). Decode bounds every number, drops unknown spot/route/stamp/deck ids, rejects > 32 000 chars.
Drive per frame: `observeSkate(session, present, events, outcome|null, dt)` (discovery + spot card, Own the Spot, stats, milestones, routes). Tables: `setSkateTables({spots: field.spots, grindables: field.grindables, features, flips, grinds})` once the PARK field and TRICKS catalogs exist — goals regenerate from them (deterministic by spot id). Settings: `setSkateSettings(session, patch)`; decks: `chooseSkateDeck(session, id)` (unlock = park `discoveries` OR `DECK_GOAL_UNLOCK` goals).
Own the Spot: 3 goals/spot — bank N in one line here; grind a named grindable X m (optionally a named grind) or land a flip; air height off a feature / flip off a feature / manual seconds. Evaluated only from events + outcomes inside the spot rectangle.
v1 adapter kept: `stepSkateSession`, `skateSnapshot`, `SkateSnapshot` (rider.ts + existing tests unchanged).

## Audio — `audio.ts`

`createSkateAudio({volume?, createContext?}) → {update(present|null, events, dt, {paused?, hidden?}), setVolume, dispose, disposed} | null`. WebAudio synthesis only; master ceiling `SKATE_AUDIO_CEILING` 0.42; ≤ 10 concurrent one-shots; silent when paused/hidden/null. Surface voices: `SURFACE_VOICE`.
