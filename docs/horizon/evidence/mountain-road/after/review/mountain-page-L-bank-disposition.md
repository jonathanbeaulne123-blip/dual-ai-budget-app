# Page L bank-only candidate disposition

The two measured bank-only candidates are rejected. No checkout change was made. They do not justify relaxing the original portrait8-pixel rule or changing S3/Quay Bridge.

## Tight candidate, measured by root

Input/output: `/tmp/mountain-page-L-tight-bank-observed/report.json`; all12 pages, both orientations. Source unchanged. Original portrait Boathouse count reproduced5; candidate still5. It changed29 lattice vertices, max lowering2.202424526m, with interpolated influence x1365–1420,z1295–1320. L landscape Boathouse13→15 and Lantern Row5188→5203; portrait Lantern Row3036→3045. Both horizon tests remain true. Every other authored-page subject count and horizon test remains exactly unchanged in this saved-bake replay. No screenshot/composition approval is inferred from those counts.

The reported87 increased underside gaps have two different physical meanings:

- **63 genuine new town.quayLink underside exposures**. Every one previously had gap≤0.02m. Worst at `[1402.628789589,5.920192374,1307.476298023]`: ground5.782735558→4.832488367; actual slab underside5.569910871; previously buried0.212824688m, now visibly open0.737422504m. Walking floor itself remains5.919910871, which explains why zero changed walking floors is not sufficient acceptance.
- **24 samples beneath the existing Quay Bridge span**. They already had positive bridge clearance; they are not24 new unsupported decks. Ground lowering increases some existing gaps by up to0.494443058m. This candidate still should not change that protected bridge setting gratuitously.

One affected positive-area face remains above40° and **gets steeper**, rather than staying unchanged:40.298653653°→40.603649041°. Its existing steep classification is not permission to worsen it. Exact indices `[104533,104534,104934]` remain in the report.

Two former terrain-first upper façade rays now encounter the actual town.quayLink slab. The remaining terrain-first façade rays move inward toward its supporting bank (e.g. upper ray29: `[1400.395695392,5.635153654,1305.523663867]`). S3 and the Quay Bridge retain their original hits. A broader/deeper blind bank cut would progressively excavate supporting earth without yet proving visibility.

## What is established

Keeping the existing5m lattice, exact source bed vertices, and all original solids, **neither a wide-support-preserving cap nor a much tighter2.2m bank cut is a viable repair**. The first preserves support but exposes no additional portrait ray; the second exposes slab undersides and worsens an existing steep face but still gains no portrait pixel. Continuing that scalar cap family is not justified.

This is a bounded infeasibility result for the tested terrain-cap method, **not a mathematical proof that all geometry with the original camera is impossible**. The earlier solid-only ray check still shows six directions without direct solid hits; those rays pass through earth that currently supports or blends to the walkway. A finer bank mesh with fully designed support, or a locally regraded town.quayLink together with its bank and joins, could change that situation. Neither has been fitted or controller-verified. Such work would be a new designed harbour walkway/bank intervention; it is not a small automatic terrain trim. There is no evidence requiring any native Mountain change, S3 deletion, or landmark-bridge edit.

## Bounded alternatives

1. **Authored portrait-eye proposal**, pending root's saved-bake measurement. Original eye `[1460,4.6,1300]` is1.6m above the quay's exact y3 slab. Existing proposed rises0.3/0.6/1.0m put the eye at4.9/5.2/5.6 (1.9/2.2/2.6m above that same physical floor). Target `[1285,4,1315]`,45° horizontal FOV and original8px criterion remain unchanged. This is an explicit view-composition choice, not a change to the walking controller or quay floor. A successful variant must keep Lantern Row and horizon passing and be visually reviewed; the first passing sampled rise is not a mathematically minimal change.
2. **Keep camera exact and reconstruct the local town.quayLink/bank**. Preserve plan route/S3/bridge/native geometry; study a bounded walkway elevation/support redesign around the current bank crossings near x1400–1403,z1305–1310. No exact displacement, safe grade, finished support mesh or acceptance result exists yet. This cannot honestly be presented as ready or implicitly approved. A larger source fitting/ground/support/continuity exercise would be needed before asking for a concrete geometry choice.

Do not offer a choice to remove blockers, lower thresholds, or treat the five current pixels as sufficient. C/D/F portrait failures remain separately retained debts (4/8,0/8,0/8) and were not modified.

## Raised-eye fallback rejected; next bounded XY batch

Root's `/tmp/mountain-page-L-eye-options/report.json` shows that +0.3,+0.6,+1.0m vertical-only portrait changes all still give Boathouse5. Lantern Row decreases3036→2879/2720/2516; all horizons pass. There is no successful raised-eye proposal to present.

Prepared root-only `/tmp/mountain-page-L-quay-probe.mjs`:33 total plan positions including the original, within the existing quay slab x1436–1484,z1291/1295/1300. Each proposal uses the actual walkable floor +1.6m, unchanged target and45° horizontal FOV. It rejects locations lacking the actual quay slab/bed under nine0.35m-radius disk samples, inconsistent floor, or a solid within sampled body clearance. It records rejected standing locations rather than silently removing them. Only standing candidates receive the original60×130 pixel proof, including Lantern Row, Boathouse, horizon and every host-target ray's first blocker. It sorts passing sampled candidates by distance from original; that is a practical sampled choice, not a claim of mathematical global minimum. No world/camera source is applied. Syntax checked only.

```
node /tmp/mountain-page-L-quay-probe.mjs "$PWD" /absolute/fresh-page-L-quay-probe
```
