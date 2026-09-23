/**
 * Tideline Skate Club v2 · world — the park's painted-card palettes.
 *
 * Authored per theme so the park sits in each world rather than on top of it:
 * Classic is warm paper and brass, Taylor is blush card and plum ink,
 * Newfoundland paints its ramps in jellybean-row colours on fog-grey card.
 */
import type { ThemeId } from '../../../theme/scenes.ts';

export type SkatePalette = {
  /** Pad and apron card. */
  pad: string; apron: string;
  /** Concrete features: tops, bowl interior, cut sides. */
  concrete: string; bowl: string; wall: string;
  /** Painted ply: transition tops, decks, cut sides (Newfoundland gets a second ramp colour). */
  wood: string; woodAlt: string; woodDeck: string; woodSide: string;
  steel: string; ink: string;
  /** Lip bands, stair nosings, curb paint. */
  paint: string; curb: string;
  wax: string; stencil: string;
  planter: string; soil: string; leaf: string; bloom: string;
  lantern: string; post: string;
};

export const SKATE_PALETTES: Readonly<Record<ThemeId, SkatePalette>> = Object.freeze({
  classic: {
    pad: '#d9ceb5', apron: '#cbbf9f',
    concrete: '#e2d7bd', bowl: '#d3c5a4', wall: '#b9a683',
    wood: '#dcb887', woodAlt: '#d2a978', woodDeck: '#c99d6c', woodSide: '#9c7650',
    steel: '#a9b0ad', ink: '#3b2f25',
    paint: '#c9563d', curb: '#caa252',
    wax: '#6b5a44', stencil: '#6b4a32',
    planter: '#a8916c', soil: '#5c4230', leaf: '#4f6b3a', bloom: '#c9563d',
    lantern: '#ffe2a8', post: '#6b4a32',
  },
  taylor: {
    pad: '#f0e0dc', apron: '#e4cfcb',
    concrete: '#f5e8e4', bowl: '#e9d2d8', wall: '#cfb0bd',
    wood: '#ecc8d3', woodAlt: '#e2b6c6', woodDeck: '#d9a9bb', woodSide: '#a97f94',
    steel: '#b9b0bf', ink: '#5a3552',
    paint: '#d76a95', curb: '#d9b26a',
    wax: '#8a6a80', stencil: '#77629b',
    planter: '#77629b', soil: '#6d5260', leaf: '#6f8f6a', bloom: '#d76a95',
    lantern: '#fff0f4', post: '#b08a92',
  },
  newfoundland: {
    pad: '#c6cfcf', apron: '#b4c0c0',
    concrete: '#d2d9d8', bowl: '#bccacc', wall: '#8fa4a8',
    wood: '#4f98aa', woodAlt: '#d9b45b', woodDeck: '#b75a4e', woodSide: '#2f5f6c',
    steel: '#98a4a6', ink: '#1f3440',
    paint: '#d9b45b', curb: '#b75a4e',
    wax: '#48585c', stencil: '#b75a4e',
    planter: '#6d4b36', soil: '#3f3026', leaf: '#4d6b45', bloom: '#c9ae5a',
    lantern: '#fff3e0', post: '#6d4b36',
  },
});

export const skatePalette = (theme: ThemeId | string | undefined): SkatePalette =>
  (theme && theme in SKATE_PALETTES ? SKATE_PALETTES[theme as ThemeId] : SKATE_PALETTES.classic);
