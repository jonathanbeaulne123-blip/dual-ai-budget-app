# v5 boundary failures: saved-data classification

Source: `/tmp/mountain-funicular-foot-candidate-proof-v5/geometry-results.json`. Reproducible JSON-only classification: `/tmp/mountain-funicular-v5-boundary-classify.py`; full indexed witnesses, source SHA256 and bounds: `/tmp/mountain-funicular-v5-boundary-classification.json`. No runtime, imports, tests, geometry edits or tolerance changes.

1,108 failing samples among 12,768 samples on 608 boundary edges. Reasons overlap: **841 new >40° samples over a recorded ≤40° baseline; 129 new >6 cm steps over a recorded ≤6 cm baseline**. A further 97 steep samples select the new apron over already-steep baseline terrain; those are changed physical faces, not preserved native geometry. Only 27 steep samples retain exactly the old terrain host. All 16 continuous route/offset sweeps have zero failures; they do not cover every apron boundary.

| Cluster (Horizon X/Z bounds) | Samples | Actionable distinction |
|---|---:|---|
| A: station threshold west/north, X1287.806–1288.866 / Z729.027–730.929 | 894 | 795 newly steep; 98 new steps; max88.199794°. Actual 55.65m threshold meets 55.188700413m terrain here. |
| B: station east/southeast fringe, X1292.118–1293.626 / Z723.889–725.660 |112|16 newly steep (max53.033982°), 25 new steps; 70 contacts with existing station post2; one exactly retained0.330087m threshold step.|
| C: west apron side, X1285.140–1286.413 / Z726.876–727.895 |73|21 newly steep plus52 new-apron faces over old steep terrain; max61.340039°. No >6cm sample step here.|
| D: south/east corner, X1289.170–1289.611 / Z721.314–721.695 |24|9 newly steep plus6 changed-apron/6 unchanged-terrain steep; one new7.4516cm step; **4 contacts with new apron itself**. Max63.964289°.|
| E: remote southern tip, X1285.363–1285.612 / Z717.906–718.101 |5|All5 are new steps, max15.4208cm; slopes≤17.0432°, so checking slope alone misses these.|

## Exact repair witnesses

- A new step: `[1288.305590917407,55.60975724104382,730.64]`, current31.0791cm versus baseline0; another at `[1288.2551315301337,55.59652271206781,730.62]`, current32.9808cm versus baseline0. Current floor is apron, baseline terrain55.188700413.
- A old threshold step is separately real: `[1288.2164375644531,55.650001389885155,730.6]`, current46.1300977cm versus baseline46.1299587cm. The1.390micrometre difference is explicitly recorded, not an acceptance allowance. **Current apron slope88.1997938° versus old slab slope0° is new.** Three such samples are slightly larger old steps;63 are reduced but remain>6cm. No inherited-step exemption makes the new top acceptable.
- A unchanged selected terrain can still have a new apron departure step: `[1288.6555334848692,55.188700413,730.8709801156751]`, current21.5638cm versus baseline0. Do not group solely by current floor ID.
- B retained station step: `[1293.392455237578,55.650000000000006,725.6076241081837]`, current=baseline33.0086955756cm, same threshold host and slope0. This is the sole equal old >6cm step in the saved failures.
- D new physical side contact: `[1289.3674642973842,54.61826729854404,721.4423093517603]`, new7.4515688cm step, floor terrain both versions, contact `mountainV2.funicularFoot.apron`.
- E new tip step: `[1285.3629973943728,54.75418522730949,717.906207049858]`,15.4208227cm versus baseline0.

## Evidence limits

The audit samples each edge at20/50/80%, sweeping7 positions spaced2cm across its normal. `delta`/`beforeDelta` are consecutive selected-floor changes, not triangle facet grades. First sample has no previous baseline value. Saved failure objects omit edge index/t/k/previous point, so do not infer exact predecessor host from adjacent failed objects. New slope/step labels compare recorded old field, not a fresh original-main replay.

All74 contact failures lack baseline contact queries.70 identify existing station post2,58 of these retain exactly the same station/slab surface; the other12 select new apron. These support “existing blocker, contact inheritance unproven,” not a blanket inherited pass. Four identify the new apron and warrant repair. `headroom:null` serializes Infinity in this harness; no recorded finite headroom failure. maxTop88.1997939 remains a genuine universal-top failure and is not weakened by this classification.
