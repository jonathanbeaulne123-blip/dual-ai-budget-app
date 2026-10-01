/** Measured exceptions after seeded authoring, never during candidate generation.
 * Keeping the original RNG and occupancy sequence preserves every other plant.
 * Records match the full original object, not a mutable output array index.
 * Source proof: mountain-planting-comparison + mountain-non-tree-json-proof.
 * Final Awning proof: after/attempts/final-awning-plant-intersections/non-tree-proof.json. */
export const PLANTING_LANDING_OMISSIONS=[
  {
    "tier": "full",
    "kind": "trees",
    "branch": "library-balcony",
    "baselineIndex": 93,
    "item": {
      "x": 76.71510755062812,
      "y": 33.205651390212694,
      "z": -175.55890146277292,
      "size": 0.8717180470936,
      "spin": 2.9613083188042513,
      "kind": "pine",
      "tint": 0.4197951168753207,
      "lean": 0.024358183918520807
    },
    "reason": "Confirmed crown intersects new visible return support, branch triangle 736."
  },
  {
    "tier": "full",
    "kind": "tufts",
    "branch": "library-balcony",
    "baselineIndex": 246,
    "item": {
      "x": 90.15681270626428,
      "y": 30.75041616422224,
      "z": -168.35933335304483,
      "size": 0.9319905158597976,
      "spin": 5.812322807457764,
      "tint": 0.9890655272174627
    },
    "reason": "Confirmed source tuft triangle intersects new visible return, branch triangle 1359."
  },
  {
    "tier": "full",
    "kind": "shrubs",
    "branch": "hearth-awning",
    "baselineIndex": 4,
    "item": {
      "x": 29.08388087379753,
      "y": 14.69486445381949,
      "z": -90.97538761948014,
      "size": 0.8,
      "spin": -2.0143743028758467,
      "kind": "hedge",
      "tint": 0.7438481692224741,
      "stretch": 2.6
    },
    "reason": "Confirmed source shrubs primitive intersects approved visible return, branch triangle 205."
  },
  {
    "tier": "full",
    "kind": "tufts",
    "branch": "hearth-awning",
    "baselineIndex": 202,
    "item": {
      "x": 27.897866696716434,
      "y": 14.704051274872423,
      "z": -90.89674800291674,
      "size": 0.7756135426927357,
      "spin": 3.914219045760576,
      "tint": 0.4799235549289733
    },
    "reason": "Confirmed source tufts primitive intersects approved visible return, branch triangle 229."
  },
  {
    "tier": "full",
    "kind": "tufts",
    "branch": "hearth-awning",
    "baselineIndex": 203,
    "item": {
      "x": 26.79316441371584,
      "y": 15.316349064330353,
      "z": -92.41773810141407,
      "size": 0.5064880652353168,
      "spin": 3.020307205938036,
      "tint": 0.7114720805548131
    },
    "reason": "Confirmed source tufts primitive intersects approved visible return, branch triangle 225."
  }
] as const;
export function keepAuthoredPlant(tier:'full'|'lite',kind:'trees'|'shrubs'|'flowers'|'tufts',item:object):boolean{
  return !PLANTING_LANDING_OMISSIONS.some(record=>record.tier===tier&&record.kind===kind&&Object.entries(record.item).every(([key,value])=>(item as Record<string,unknown>)[key]===value)&&Object.keys(item).length===Object.keys(record.item).length);
}
