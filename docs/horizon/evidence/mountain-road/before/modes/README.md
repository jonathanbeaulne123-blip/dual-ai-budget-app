# Mountain multi-mode baseline probe

From the repository root, create `/tmp/mountain-modes-probe`, then run:

```sh
node docs/horizon/evidence/mountain-road/before/modes/probe.mjs "$PWD"
node docs/horizon/evidence/mountain-road/before/modes/native-probe.mjs "$PWD"
```

The first command writes `routes.json`, which the second reads. All new outputs go to `/tmp/mountain-modes-probe`; these retained scripts and baseline results remain unchanged. Baseline source and bake are `324cd5f246ab295af5cf64d553ebf78fad57f7b5`. Read [SUMMARY](SUMMARY.md) for exclusions, time limits and native-controller distinctions.

Uses the real baked world, full-resolution terrain, static collision solids, and always-active Mountain v2 region with terrace exclusions. Bicycle and Horizon board use their unmodified real controllers. Headless camera collision is omitted only; body collision is unchanged. Walking extracts the exact `move()` function from Horizon runtime source and applies the runtime unsupported/water checks. Walking stops at the first airborne handoff because continuing would require the separate parachute controller.

Every attempt places once at 0.5 m along its route. It sends only normal controller input thereafter, never teleports, resumes, resets, or retries. A controller-triggered fadeBack is recorded and immediately terminates the attempt. Full chain attempts are distinct from independent reach attempts. Endpoint completion tolerance is 0.5 m. Distance is monotonic progress projected in a local ±20 m search window, with total actual plan travel also retained.

The scripted rider uses pure pursuit and an ordinary 1.3–4 m/s bend speed plan, no jump or pop. This is deliberately a baseline, not a proof of skilled human acceptance. A fail can reflect the driver as well as the world. In particular, brake slides, tight-bend pursuit, profile legal-bed restrictions and wheelbase steps warrant classification before calling a world defect. It uses all unmodified profile parameters.

Contacts are sampled through geography at body radius every frame; events and one-second trace samples supplement them. Bail, fadeBack, route departure over 8 m, five seconds without 0.2 m forward progress, water, first walking airborne handoff or time limit terminate attempts.

Two initial harness setup attempts produced no completed results: one was manually interrupted to omit expensive camera collision and remove a tiny reverse-course waypoint at the lane start; another started outside the repo and failed terrain asset loading. The finished run is the corrected harness. These were not route retries.

Walking hard-codes `gateOpen=()=>true`: this assumes region/chunks are ready and cannot verify runtime streaming or gate behavior. Camera, UI and the airborne/parachute continuation are omitted. Native skate uses its native Mountain ground/collision rather than Horizon baked body collisions; its six admitted trials do not establish whole-Horizon acceptance.
