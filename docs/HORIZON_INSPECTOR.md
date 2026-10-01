# Horizon Inspector

The Inspector is a local diagnostic view for Journey Board and Horizon. It reads a narrow set of technical fields; it does not read the ledger, Hercules conversations, form contents, credentials or request bodies.

## Controls

- Press an unmodified `=` once to toggle. `+`, modified keys, held-key repeats and typing in forms or chat are ignored. The app's other zoom controls remain available.
- Press `F8` to preserve an incident without first opening the overlay. Capture incident is also a separate button.
- Status Centre → Horizon Inspector opens the visible settings alternative. The expanded Inspector lets you remap toggle and capture to `=`, `F8`, `F9` or `F10`, choose 15–120 seconds of history, and switch recording off. Compact or expanded layout is remembered.
- In development and testing, local recording begins before the overlay is opened. In ordinary builds it begins only when switched on. Turning it off clears the rolling history.

## Evidence

Capture incident immediately freezes the current allowlisted state, up to 45 seconds of recent samples and events, the actual available build identifier, and a unique incident ID. Until an image exists, the captured view hides the live scene. Choosing a browser image temporarily reveals the live scene behind the saved diagnostics and labels it as a later capture; afterward the frozen preview returns. Browser image capture needs the user's permission and source choice and has its own timestamp. A blank or failed image remains an explicit no-image incident. Review the captured frame before including it in export.

Copy report copies a readable text report. Export incident downloads a ZIP named for its incident ID with `report.txt` and `incident.json`; an approved image is `screenshot.png`. The share-safe option masks known form, chat and card regions when a browser-tab image aligns with the Hearth viewport; otherwise it omits the image. Other private pixels may remain, so review the image before including it. No upload occurs.

The compact view shows build, scene, time, location, movement, camera, performance and interaction. The expanded view adds context, technical rendering state, recent events, recording controls and inspect mode. Inspect mode blocks underlying clicks and points to a stable Horizon district or Journey UI identity where available. Missing fields say Not instrumented or Not applicable.

Horizon frame times and renderer counters come from its actual render loop. The last 90 rendered frames form the displayed FPS and frame-time graph; p95 and >50 ms spikes are calculated from that window. Idle, hidden and paused periods have no active FPS reading. CPU sampling and GPU time are separate concepts; GPU time and total memory are not supported here. Journey Board does not expose the same render timing and is labelled accordingly.

Coordinates use Horizon world units (X east, Y up, Z north). Journey map X/Y refer to the map and are not player coordinates. Player, camera and map coordinates remain separate in structured export. The evidence is not deterministic replay.

## Current instrumentation limits

The recorder captures Horizon scene entry, camera changes, jump and selected interaction requests, some mount, fleet and parachute transitions, Journey entry and zoom, uncaught errors by error class, and checks for non-finite positions, map revision mismatch, persistent camera transition and asset failures. The board, vehicle, yacht, parachute and cooking readouts come from active controllers. There is no universal semantic event bridge for every outcome, particularly house-editor actions. Optional ground-contact, movement-vector and camera-target markers use live Horizon coordinates. Collision shapes and selected-object bounds are not exposed. Browser display capture cannot automatically prove that the selected source includes the whole app. Masking covers only the named regions and does not establish that an image is private.
