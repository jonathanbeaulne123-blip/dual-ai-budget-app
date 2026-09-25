# Skateboard charge jump and air controls

Base: `origin/main@04640be8`. Branch: `codex/skate-charge-air-tricks`. Risk: Medium-High. Local recreational behavior only; no financial command, Auth, sync, schema, deployment or Production state changes.

Jonathan's requested control: hold Space to charge a skateboard jump, release to take off farther at the current travel speed, use arrows for board tricks while airborne, and WASD for backflips and spins. The control mapping is recorded in [D-299](../DECISIONS.md): A/D spin; W/S start back/front flips on a new airborne press. Ordinary flick-it, pointer, touch and gamepad tricks remain available.

Implementation: the keyboard input owns the one-second charge and clears it on pause, board exit or stage blur. The simulation adds charged airtime only to Space pops, including release after an unpopped ledge launch. Body flips scale to the available airtime, bail if unfinished, render around the rider's middle, and receive a named scoring event when completed. The HUD hints and stage description use the same mapping across Classic Hearth, Taylor's Scrapbook and Newfoundland.

Focused proof: 111 tests in four files passed (`skate-input`, `skate-sim-tricks`, `skate-tricks`, `harbour-walk-focus`). The Medium-High quick gate passed TypeScript and 579 selected tests in 292.0 seconds, within its 300-second budget. The modified look suite passed; two `skate-look-craft` assertions failed with identical values on the untouched mountain checkout and are existing baseline failures. The gate reports UI proof required. Physical keyboard feel, touch parity, WebGL appearance and live deployment remain open acceptance work.
