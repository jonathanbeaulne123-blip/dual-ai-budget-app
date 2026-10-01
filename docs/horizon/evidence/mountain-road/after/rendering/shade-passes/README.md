# Contact-shade rendering proof

Completed locally on frozen intermediate world `472dcf42f57f15f9c484185828512804c2b712bb19e1d63cdbb904a72a082600` and terrain `0dc23c32ca9af9d39f1719fecc5bd7b2f1017562af0f7b2c1bfa046cb44b0c76`. This isolates the shade helper and its corridor-art integration. It does not certify the final bake or a physical device.

| Check | Result |
|---|---|
| Persistent 12-pose matrix | 288/288 exact scene-image pairs; no errors |
| Shadow color attachment | 144/144 exact; 72 full nonempty, 72 lite empty |
| Actual nonflat Long Sands stop | 36/36 exact image pairs |
| Two warmed CPU views | 30 submissions/version/view; medians old/new 0.2/0.4 ms and 0.1/0.3 ms |
| Type-only callback fix | Helper/test emitted JavaScript byte-identical; 14/14 tests pass |

The CPU change costs approximately 0.2 ms per measured submission. These are browser CPU/WebGL submission durations, not GPU timings or device framerate. First shader-compilation samples remain separate in each summary. The shadow comparison does not read the actual depth texture. Library is flat in this frozen asset; Long Sands supplies the nonflat witness. Source triangle order, material sides, uncertain faces and the shared light cap remain checked.

Each folder retains the complete summary (lossless gzip where large), exact source proof, compression records and a manifest identifying every original attachment. Original images, pixel bytes and served bundles remain at the recorded temporary paths; their binaries were not all copied here. Every compressed pixel record was decoded and compared byte-for-byte before storage. Reproduction files retain their original input paths and hashes. The independent matrix review is in `../../review/mountain-shade-matrix-review.md`. Final-world full-scene captures, all district budget cases and device acceptance are separate.
