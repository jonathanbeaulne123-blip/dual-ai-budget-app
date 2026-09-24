# Hearth Mountain — iPhone + Mac acceptance checklist

**Status: NOT PASSED.** This is a manual test sheet, not evidence that any gate has
passed. Jonathan has an iPhone and this Mac; no controller is confirmed. Controller
acceptance remains untested. No deployment or hosted-data operation is authorized by
this sheet.

The current fictional review is **Mac loopback only**:
`/__review?seed=mountain&story=growing&run=first&member=MEM-001`.
Use the review server's existing local origin. An iPhone cannot reach the Mac's
loopback address. Physical-phone and two-device testing are blocked until a separately
authorized safe test host is available. Do not expose the local server or create a
deployment merely to complete this checklist.

## Record before each session

- [ ] Record date, candidate commit, device/model, OS, browser/version, viewport,
  orientation, display refresh rate, low-power mode and whether the device feels warm.
- [ ] Confirm fictional Development review data, the intended member and story, and
  the exact host. Record Classic, Taylor or Newfoundland and Sound/reduced-motion settings.
- [ ] Start from a fresh review load; visit each district once, return to town, then
  allow 30 seconds for initial loading to settle. Keep the tab foregrounded for captures.

## iPhone frame time and repeated-lap resource gate — NOT PASSED

Use the review-only **MountainRehearsal** drawer: start frame capture immediately before
movement; stop after the run; export its JSON. Preserve each export with device and
candidate details. Do not replace physical iPhone evidence with Mac responsive emulation.

- [ ] Capture three minutes of ordinary touch exploration, a full Summit to Sea race,
  both transport rides, and a busy town/district view. Include normal loading and
  transition stutters. Repeat while the phone is warm after at least ten minutes.
- [ ] Record active-capture duration, frame count, achieved frame rate and frame-gap
  **p50, p95, p99, maximum**, plus visible freezes. A mean alone cannot pass this gate.
- [ ] Target: sustained **30 fps**. Proposed frame-gap limits for acceptance are
  **p50 ≤ 33.3 ms, p95 ≤ 33.3 ms, p99 ≤ 50 ms**, with no repeated stalls above 100 ms.
  Confirm these percentile limits before signing off; they are test criteria, not
  previously approved or measured results. Record failures rather than discarding runs.
- [ ] Warm all six districts, return to the same town pose, and record settled resource
  counts. Complete **five identical loops** visiting all districts, reserve plots and
  both transport endpoints; return to that pose and wait 30 seconds after each loop.
- [ ] Record geometries, textures, programs and other available counts at baseline,
  each peak and each settled return. Settled counts must return to the warmed baseline;
  any accumulating resource count is a failure to investigate. Also record crashes,
  reloads, degraded input and increasing frame times. Repeat a theme round-trip through
  all three themes and return to the original theme before comparing counts.
- [ ] The drawer reports **counts, not GPU bytes**. Do not label them GPU memory or
  a megabyte limit. Record Safari/device memory measurements if available; otherwise
  mark the absolute memory budget **UNMEASURED**. Count stability alone cannot close it.

## Travel and recreation — NOT PASSED

- [ ] On Mac keyboard and iPhone touch, approach and leave every station manually.
  Confirm platform support, clear entrances, readable boarding controls and a camera
  that keeps the person and destination understandable.
- [ ] Ride every funicular leg and both gondola directions. Check cabin/rail alignment,
  departure, arrival height and control return. Test **Finish scenic ride**, mid-ride
  room entry and return, and quick travel during a ride. No stranded rider, camera snap
  through walls, residual motion or arrival below ground is acceptable.
- [ ] Complete one ordinary clean Summit to Sea run on keyboard and one on touch:
  correct countdown, all ordered gates, finish, elapsed result, restart and local best.
  Record any bail, missed gate, steering ambiguity or accidental UI interception.
- [ ] On each available input, independently ride **dam promenade**, **library balcony**
  and **hearth awning**, including approach, full width, underpasses and road rejoin.
  Confirm visible decks match physical support and no prop blocks the racing line.
- [ ] Controller: **NOT TESTED — hardware not confirmed**. Do not infer controller
  acceptance from keyboard or touch results.

## Two-device elevated presence — NOT PASSED / host required

- [ ] On the authorized test host, open the same fictional household as its two intended
  members, one on Mac and one on iPhone. Explicitly opt in to Walk Together on both.
- [ ] At Hearth Terrace, Library Woods, Summit Commons, an elevated branch and a
  transport endpoint, compare each person's position/height and selected appearance
  on the other device. Walk under and over the same bridge to expose height mistakes.
- [ ] Test transport arrival, room entry/exit and reconnect. Confirm positions recover
  at the right height without stale duplicates, teleports into walls or invented presence.
- [ ] Turn sharing off on either device and confirm the remote person disappears;
  reconnect must not silently re-enable sharing. Record both devices and timestamps.

## Accessibility, art and listening — NOT PASSED

- [ ] With Mac keyboard and iPhone VoiceOver, open Mountain & town, choose destinations,
  inspect Fund evidence, board/skip transport and use race controls. Check labels,
  reading order, focus visibility, dialog focus/return, errors and touch target reach.
- [ ] In the reading edition, reach every essential destination and budgeting action
  without WebGL or precise movement. Review is not Final Confirm; scenery never posts.
- [ ] Enable system reduced motion before load and again during play. Check stable
  essential state, comfortable camera changes and readable progress without relying
  on ambient animation. Repeat with Sound off; essential feedback remains available.
- [ ] Inspect all six biomes, distant destination silhouettes, summit dome, reserved
  plots, station entries and town channel/causeways in **all three themes**. Check phone
  framing, legible signs, door visibility, floating/hidden scenery and collision agreement.
- [ ] With Sound explicitly on, listen on the actual Mac and iPhone to wind, water,
  leaves and material footsteps. Check balance, clipping, repetitive loops, mute,
  interruption/resume and overlap during travel. Mark absent or uncomfortable sound;
  code paths or an audio preference are not listening acceptance.

## Sign-off record

For each gate attach: **PASS / FAIL / BLOCKED / NOT TESTED**, candidate commit,
device/input, capture or notes, reproducible issue and owner. All rows above currently
remain **NOT PASSED**. A failed capture, unavailable host, timeout, missing controller
or missing memory measurement must keep its corresponding gate open. Local tests,
Mac browser checks and a successful build do not substitute for these measurements.
