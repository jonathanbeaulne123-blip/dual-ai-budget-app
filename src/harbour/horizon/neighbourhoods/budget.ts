/**
 * CONTRACT §6 district budget (full / lite triangles, the baked land plus the dressing) and the integration's recorded
 * overruns (D-WW182, 2026-10-12). Two districts cannot meet the cap with the places as authored and nothing the bake's
 * fitter may drop: the Bight (its land alone holds 145.0k / 59.4k, PR 2) and the landing (the Reach and Long Sands share it;
 * buildings, keep-palms, lanterns and festoons alone pass the lite cap). Their ceilings are what the integration measured —
 * a ratchet: they may only fall, and each is owed a fix (the Bight: a lite simplification of its land; the landing: a hand
 * trim of Long Sands' lite in its quality pass). Every other district holds the contract.
 */
export const DISTRICT_BUDGET = { full: 150_000, lite: 60_000 } as const;
export const BUDGET_OVERRUN_CEILING: Readonly<Record<string, { full: number; lite: number }>> = {
  bight: { full: 158_737, lite: 63_817 },
  landing: { full: 160_469, lite: 66_110 },
};
export const districtBudget = (id: string): { full: number; lite: number } => BUDGET_OVERRUN_CEILING[id] ?? DISTRICT_BUDGET;
