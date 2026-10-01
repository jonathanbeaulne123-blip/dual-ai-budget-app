# Acceptance-runner review resolution

All four source-review findings are addressed before final execution. The review camera first arrives provisionally and waits for the destination geometry, then requires an actual floor and reseats; its observed final eye must be exactly1.65m above that floor. All poses wait for corridor furniture and rendered frames. Console errors and WebGL context loss join retained capture errors. Both serialized lanes include public/mountain in their fingerprints. Horizon and Journey now verify served raw renderer/entry/harness sources as well as served and actually-loaded assets. Each capture variant uses a fresh browser process after the earlier33/36 preview lost its last three contexts.

Node syntax checks passed for all four capture scripts/helpers and Python AST checks passed for both lane runners. These are source validation only; final live captures and route/test execution remain pending. No camera definition, source world, test assertion or acceptance threshold was relaxed.

The WebGL context audit ends after the final capture and before intentional page closure: native pagehide disposes its renderer with forceContextLoss (rendererOwner.ts). Console errors and asset failures remain retained. This separates deliberate cleanup from loss during rendering; it does not suppress an active-capture error.

Additional source review corrected the chunk-readiness condition before any final capture: scheduler.queued() returns {route,view} arrays, not a numeric count. The capture now requires both actual queues empty, alongside region/corridor completion and rendered frames. No missing queue schema is treated as ready.
