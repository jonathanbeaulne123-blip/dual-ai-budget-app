import type { WorldDefinition } from './definition.ts';

/** Schema fixture only. No geographic point, shape, or route is authored here. */
export function emptyWorldDefinition(rev = 'horizon-geo-0'): WorldDefinition {
  return {
    id: 'horizon', geographyRevision: rev, extent: { w: 2000, h: 1800 }, seaLevel: 0,
    heightfield: { kind: 'empty', revision: rev },
    water: [], landforms: [], districts: [], hosts: [], places: [], beds: [], lines: [],
    structures: [], crossings: [], thresholds: [], reserves: [],
    sky: { ceiling: 0, launches: [], landings: [], gates: [] },
    underground: { doors: [], rooms: [] }, lights: [], views: [], lanterns: [], protected: [],
    journey: {
      stations: [],
      yearWalk: { id: 'yearWalk', profile: '', surface: '', points: [], districtIds: [] },
      homestead: [], kittyPlaza: { id: 'kittyPlaza', empty: true },
      lod: { l0Triangles: 0, l0DrawCalls: 0, l1Triangles: 0 },
    },
  };
}
