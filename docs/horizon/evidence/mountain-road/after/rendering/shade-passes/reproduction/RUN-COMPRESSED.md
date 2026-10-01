# Lossless attachment storage correction — root execution only

`run-compressed.mjs` keeps the original driver and all frozen render inputs untouched. `compression-audit.patch` contains the complete Node-side change; the browser append remains byte-identical. The interrupted uncompressed attempt at `/tmp/mountain-shade-parity-v2-matrix` remains preserved as exit130 with no completed pairs, not a pass.

Each raw color/shadow attachment is encoded with Node gzip(level6), immediately gunzipped and checked with `Buffer.equals` against the original raw bytes before saving. `rgba-compression.ndjson` retains raw and compressed SHA256/lengths and the exact round-trip flag for every attachment. Pixel comparisons read `.rgba.gz` through `gunzipSync` and execute the same unmodified difference function. PNG/state outputs and all source/asset preflight checks are unchanged. Compression time is outside the recorded browser render-submit timing. No lossy storage, tolerance or pixel change is introduced.

Full requested matrix, after the existing owned smoke passed:

```sh
node /tmp/mountain-shade-parity-plan/run-compressed.mjs --root '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book' --out /tmp/mountain-shade-parity-v2-matrix-compressed --poses /tmp/mountain-shade-parity-plan/poses.json --district crown --themes classic,taylor,newfoundland --tiers full,lite --times day,night --modes color,shadow --season spring --sequential
```

Separate actual nonflat Long Sands36-pair proof:

```sh
node /tmp/mountain-shade-parity-plan/run-compressed.mjs --root '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book' --out /tmp/mountain-shade-parity-v2-long-sands-compressed --poses /tmp/mountain-shade-parity-plan/long-sands/poses.json --district reach --themes classic,taylor,newfoundland --tiers full,lite --times day,night --modes color --season spring --sequential
```

Separate two-peak CPU sample,31 submissions per version/pose:

```sh
node /tmp/mountain-shade-parity-plan/run-compressed.mjs --root '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book' --out /tmp/mountain-shade-parity-v2-cpu-compressed --poses /tmp/mountain-shade-parity-plan/poses-cpu.json --district crown --themes newfoundland --tiers lite --times night --modes color --season spring --sequential --cpu-repeats 30
```

No job was launched by this agent. Do not remove or overwrite existing evidence directories; the driver still refuses an existing summary.
