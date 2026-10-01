# Draft PR wrap-up checks

Jonathan requested ending further work and creating a draft PR. These receipts deliberately retain unsuccessful and incomplete checks.

- Focused final ground/render/streaming/cache tests: 15 passed, 4 failed, four files. All four failures are synthetic-grid ground-collar inversion exceptions.
- High quick gate: diff and AI surface passed; the compiler stage did not finish. Stopped at the 300-second deadline, 307.964 seconds including termination, exit -9. Time budget breached; no gate or current compiler pass.
- Fresh bake: stopped at 300.433 seconds, exit -15. Incomplete.
- Byte-exact check: stopped after the unsuccessful bake to avoid another duplicate regeneration, 17.849 seconds, exit -15. Incomplete.
- All 1,970 captured source inputs are unchanged. The existing served world, terrain and native export hashes match the passing actual-served v7 preflight; this is not fresh source/bake parity.
- Changed/new file and archive-content review found no secret signatures or local-only file types.

The existing baked assets and historical passing production-builder byte check are retained. The branch remains a draft with the test, budget and final acceptance blockers listed in the current handoff.

Standalone native export check passed with exit 0: 696,991 bytes, 941 road samples and 391 course points. This does not replace the unfinished full-world byte check.
