/**
 * Ground paint (`GroundPaint`): the colour of each surface token in each dressing (STYLE §1.5 grounds, §3 neighbourhood
 * sheets). Paint never re-shapes ground: the runtime dressing layer drapes a decal over the final ground and colours it
 * from this table; `tone` (0…1, default 0.5) lightens or darkens the swatch by ±8 %.
 */
import type { DressingTheme, GroundPaint } from './types.ts';

export type GroundSurface = GroundPaint['surface'];
export const GROUND_PAINT: Record<DressingTheme, Record<GroundSurface, string>> = {
  classic: {
    cobble: '#9a9184', brick: '#a8664f', travertine: '#d8cdb4', gravel: '#bdb3a0', sand: '#e2d3ad', duff: '#6e5a43', sedge: '#7f8a55', mown: '#8fae64',
    meadow: '#9cae68', prairie: '#c2ad6c', ochre: '#c58a4e', scree: '#a59c90', snow: '#eef1f2', mud: '#6f604c', pasture: '#93a964', concrete: '#c7c3ba',
  },
  taylor: {
    cobble: '#b0a595', brick: '#c4806a', travertine: '#ece0c6', gravel: '#d3c8b2', sand: '#f0e2bf', duff: '#86704f', sedge: '#97a066', mown: '#a8c47a',
    meadow: '#b3c47e', prairie: '#d8c283', ochre: '#d99f62', scree: '#bab1a4', snow: '#f7f8f8', mud: '#877660', pasture: '#abc07a', concrete: '#dcd8cf',
  },
  newfoundland: {
    cobble: '#878783', brick: '#8e5a4c', travertine: '#c3bdaa', gravel: '#a6a398', sand: '#cfc6a8', duff: '#584a3b', sedge: '#6c7650', mown: '#78945a',
    meadow: '#83935c', prairie: '#a89766', ochre: '#a87650', scree: '#8f8c86', snow: '#e8edf0', mud: '#5b5144', pasture: '#7d915a', concrete: '#b2b0aa',
  },
};

/** The paint colour (linear 0…1 RGB in sRGB-encoded hex space, as the card kit's `rgb()` reads it) of one ground patch. */
export function groundPaintHex(theme: DressingTheme, surface: GroundSurface): string { return GROUND_PAINT[theme][surface] ?? GROUND_PAINT.classic.gravel; }
export const groundPaintTone = (tone: number | undefined) => 0.92 + Math.max(0, Math.min(1, tone ?? 0.5)) * 0.16;
