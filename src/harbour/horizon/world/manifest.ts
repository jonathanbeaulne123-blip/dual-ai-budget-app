import source from './MANIFEST.json';

/** The JSON is the sole manifest; this type follows the committed source. */
export type HorizonManifest = typeof source;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function point(value: unknown): boolean {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
}

/** Reject an incompatible or partial manifest before any pass builds from it. */
export function parseHorizonManifest(value: unknown): HorizonManifest {
  if (!record(value) || !record(value.scale) || typeof value.scale.factor !== 'number' ||
      !Number.isFinite(value.scale.factor) || value.scale.factor <= 0 ||
      typeof value.scale.status !== 'string' ||
      !record(value.names) || typeof value.names.idRule !== 'string' ||
      !Array.isArray(value.hosts) || !Array.isArray(value.places) ||
      !Array.isArray(value.districts) || !Array.isArray(value.neighbourhoods) ||
      !Array.isArray(value.views) || !Array.isArray(value.crossings) ||
      !Array.isArray(value.routePairNotes) || !Array.isArray(value.thresholds) ||
      !record(value.reserves) || !record(value.journey)) {
    throw new Error('Invalid Horizon manifest');
  }
  for (const crossing of value.crossings) {
    // The design manifest also names corridor/area locations; Pass 1 resolves them into v3 geometry.
    if (!record(crossing) || typeof crossing.a !== 'string' || typeof crossing.b !== 'string' ||
        typeof crossing.resolution !== 'string' || !['over', 'under', 'threshold'].includes(crossing.resolution) ||
        !(point(crossing.at) || (typeof crossing.at === 'string' && crossing.at.trim().length > 0))) {
      throw new Error('Invalid Horizon crossing');
    }
  }
  for (const note of value.routePairNotes) {
    if (!record(note) || typeof note.a !== 'string' || typeof note.b !== 'string' ||
        typeof note.verification !== 'string' || !Array.isArray(note.sharedPlanPoints) ||
        !note.sharedPlanPoints.every(point) || 'resolution' in note) {
      throw new Error('Invalid Horizon route-pair note');
    }
  }
  for (const threshold of value.thresholds) {
    if (!record(threshold) || !Array.isArray(threshold.modes) || !threshold.modes.length ||
        threshold.modes.some(mode => typeof mode !== 'string' ||
          mode.split('→').length < 2 || mode.split('→').some(step => !step.trim()))) {
      throw new Error('Invalid Horizon threshold mode sequence');
    }
  }
  const plotIds = new Set<string>();
  const retiredIds = value.reserves.retiredPlaceIds;
  if (!Array.isArray(retiredIds) || retiredIds.some(id => typeof id !== 'string')) {
    throw new Error('Invalid Horizon retired reserve IDs');
  }
  for (const area of ['terraces', 'bightShore']) {
    const reserve = value.reserves[area];
    if (!record(reserve) || !Array.isArray(reserve.plots) || !reserve.plots.every(point) ||
        !Array.isArray(reserve.rot_deg) || !reserve.rot_deg.every(Number.isFinite) ||
        !Array.isArray(reserve.placeIds) || reserve.plots.length !== reserve.rot_deg.length ||
        reserve.plots.length !== reserve.placeIds.length) {
      throw new Error('Invalid Horizon reserve arrays');
    }
    for (const id of reserve.placeIds) {
      if (typeof id !== 'string' || !id || plotIds.has(id) || retiredIds.includes(id)) {
        throw new Error('Invalid Horizon reserve ID');
      }
      plotIds.add(id);
    }
  }
  if (!record(value.reserves.small)) throw new Error('Invalid Horizon small reserves');
  for (const reserve of Object.values(value.reserves.small)) {
    if (!record(reserve) || !point(reserve.xy) || typeof reserve.placeId !== 'string' ||
        !reserve.placeId || plotIds.has(reserve.placeId) || retiredIds.includes(reserve.placeId)) {
      throw new Error('Invalid Horizon small reserve');
    }
    plotIds.add(reserve.placeId);
  }
  return value as HorizonManifest;
}

export const HORIZON_MANIFEST = parseHorizonManifest(source);

/** The recommended factor remains readable, but no land bake may use it until D13 is confirmed. */
export function requireScaleFactor(manifest: HorizonManifest = HORIZON_MANIFEST): number {
  if (!manifest.scale.status.trim().toLowerCase().startsWith('confirmed')) throw new Error('D13 open');
  return manifest.scale.factor;
}
