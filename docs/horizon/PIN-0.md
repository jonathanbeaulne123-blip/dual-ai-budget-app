# PIN-0 — recorded baseline

Immutable annotated tag `PIN-0` points to `0bb2d6792ef9e64a87ad140d28de5e8361643bb0`, the actual merge of PR #546 on 2026-09-25. Its tree is byte-for-byte identical to verified prerequisite head `3edc140c3b4c121bd786760e1130e19c865fb4db`.

Jonathan instructed “ok now do pass 1” after the merge. The land branch starts at this tag. The earlier requested Claude and physical Mac/iPhone checks remain unperformed; this record does not turn them into passing evidence. The land pass retains its own Claude, visual and physical-device gates before merge.

Baseline geography and presence: `hearth-mountain-geo-2`. Land geography: `horizon-geo-1`, mounted through the dev-only Horizon harness. No tag will be moved if main later changes.

The first land commit creates `land/interfaces.ts` and records this merge in `docs/DECISIONS.md`. This documentation commit is above, not the target of, PIN-0.
