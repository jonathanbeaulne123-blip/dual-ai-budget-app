# Current ride replays before the last geometry build

The original Thresholds file passes25/25; original RideSituations passes6/7, including R3. R1 remains an explicitly deferred, failed120m carve. With approved road-frame/landing and shared-surface repairs in place, its measured failure endpoint is83.9153837063m instead of83.75m with unchanged inputs. This is an observed before/after difference, not an isolated attribution to one repair. Its unchanged120m speed check still fails, no-bail remains true, and the trace still has an airborne crest/landing followed by offbed fadeBack. This is not an uninterrupted route pass. The temporary observation reproduces those two original assertions and records every situation failure; its source is retained as text and removed from active tests.

The BoardPace all-pad loop fails at southPortal because the actual through-road metadata deliberately retains road pace. A test-contract correction must prove named through beds and exact profile legality while retaining ordinary dismount and pickup assertions. No physics change is proposed. These logs use the intermediate saved assets and are not final post-bake acceptance.

Current S1–S4 replay completed with exit 0: 6 passed and the 2 existing todo cases retained, in 108.56 s. The S1 report remains 301.1 simulated seconds over two legs across existing land defects; this is not an uninterrupted Mountain Road acceptance claim. Source log: `skate-lines-current.txt`.

Final current BoardPace replay: **17/17, exit 0, 2.28 s** (`mountain-current-pace-material-confirmed.txt`). The corrected test preserves exact through-road ownership/profile checks and reads actual supporting material. Foot Quay is gravel; the preceding cobble claim inferred from a shared pace tuple was wrong and its failed 16/17 attempt is preserved. South Portal and Foot bicycle fast / board threshold assertions remain explicit.

Current RideSituations: **7/7** (`mountain-current-pace-and-rides.txt`, whose overall process is exit 1 because it also contains the failed earlier Pace assumption). R1 remains an explicitly deferred, failed downhill-carve behavior below the unchanged 120 m requirement; its recorded failure distance is now 83.9153837063 m, with the current trace preserved. A green assertion of that known failure is not a completed road ride.

Current harbour-skate-model replay remains **17/19, exit 1** (`skate-model-current.txt`): the two baseline failures remain, with eight blocked timed-route chords. The introduced ninth chord (`full:mountain-descent:9`) is absent. This is a no-new-witness result, not a green suite.

Current Horizon Beds: **17/17, exit 0, 60.46 s** (`beds-current.txt`). Source-owned widths, Year Walk host geometry and the updated carried-route contract pass; printed unrelated diagnostic inventory is retained. This predates the pending walking-apron/Orchard proposals and is not the final frozen lane.
