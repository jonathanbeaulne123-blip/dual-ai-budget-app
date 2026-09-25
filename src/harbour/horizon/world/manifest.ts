import source from './MANIFEST.json';

/** The JSON is the sole manifest; this type follows the committed source. */
export type HorizonManifest = typeof source;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
      !Array.isArray(value.thresholds) || !record(value.journey)) {
    throw new Error('Invalid Horizon manifest');
  }
  return value as HorizonManifest;
}

export const HORIZON_MANIFEST = parseHorizonManifest(source);

/** The recommended factor remains readable, but no land bake may use it until D13 is confirmed. */
export function requireScaleFactor(manifest: HorizonManifest = HORIZON_MANIFEST): number {
  if (!manifest.scale.status.trim().toLowerCase().startsWith('confirmed')) throw new Error('D13 open');
  return manifest.scale.factor;
}
