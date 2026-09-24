/**
 * Tideline Skate Club v2 · world — the park's painted-card palettes.
 *
 * Authored per theme so the park sits in each world rather than on top of it.
 * The island's light is bright (hemisphere + sun at ~2.2, no tone mapping), so
 * these are painted a step darker than they read. Every theme keeps one VALUE
 * ladder so the park reads in greyscale and to colour-blind eyes too:
 *
 *   lawn (mid-dark) < cut sides (dark-mid) < ramp ply (mid) < pad (mid-light)
 *   < feature tops (light), with coping and chalk the brightest marks and ink
 *   and rails the darkest. `test/skate-world-mesh.test.ts` checks the ladder.
 *
 * Classic: warm cream stone, terracotta stripes, a sage bowl deck.
 * Taylor: a scrapbook — paper-white tops on a blush pad, a lilac street
 * section, rose ply with plum cut sides, gold coping.
 * Newfoundland: salt-box primaries on sea-grey — teal and mustard ply, red
 * decks and rails, an ochre bowl deck, navy cut sides.
 */
import type { ThemeId } from '../../../theme/scenes.ts';

export type SkatePalette = {
  /** Pad card; the street section (`padAlt`) and the transition court (`padWarm`) are separate pours. */
  pad: string; padAlt: string; padWarm: string;
  /** Apron setts, the kerb band at the pad's edge, and the verge the apron fades into. */
  apron: string; kerb: string; verge: string;
  /** Concrete features: tops, bowl interior, the bowl block's deck, cut sides. */
  concrete: string; bowl: string; bowlDeck: string; wall: string;
  /** Painted ply: transition tops, decks, cut sides (Newfoundland gets a second ramp colour). */
  wood: string; woodAlt: string; woodDeck: string; woodSide: string;
  /** Coping (bright, so a lip reads at speed), painted rails (dark, so a rail reads against the pad), posts' steel. */
  coping: string; rail: string; steel: string;
  /** Ink for cut edges, pencil for slab joints, chalk for highlights and scuffs, shadow for contact shade. */
  ink: string; pencil: string; chalk: string; shadow: string;
  /** Lip bands, stair nosings, court markings; curb paint. */
  paint: string; curb: string;
  wax: string; stencil: string;
  planter: string; soil: string; leaf: string; bloom: string;
  /** Round the edges: hedges, cut-paper fence flats (and their second colour), bleacher ply. */
  hedge: string; fence: string; fenceAlt: string;
  lantern: string; post: string;
};

export const SKATE_PALETTES: Readonly<Record<ThemeId, SkatePalette>> = Object.freeze({
  classic: {
    pad: '#c4b797', padAlt: '#a3947a', padWarm: '#c29f7e',
    apron: '#a8977a', kerb: '#857357', verge: '#7d9a58',
    concrete: '#d8cbad', bowl: '#c2b597', bowlDeck: '#9fae84', wall: '#8f7a5c',
    wood: '#d49e5f', woodAlt: '#c88f56', woodDeck: '#b07e4e', woodSide: '#6e4d33',
    coping: '#eef0ea', rail: '#3f5246', steel: '#a9b0ad',
    ink: '#33281f', pencil: '#6f604a', chalk: '#fbf6ea', shadow: '#2a1e14',
    paint: '#c4553b', curb: '#c9a24f',
    wax: '#6b5a44', stencil: '#6b4a32',
    planter: '#a8916c', soil: '#5c4230', leaf: '#4f6b3a', bloom: '#c9563d',
    hedge: '#56733f', fence: '#efe4cc', fenceAlt: '#c4553b',
    lantern: '#ffe2a8', post: '#6b4a32',
  },
  taylor: {
    pad: '#d6c6bb', padAlt: '#ab98c2', padWarm: '#dfa9b8',
    apron: '#c2a9b1', kerb: '#7d5575', verge: '#9fbf86',
    concrete: '#f6eee8', bowl: '#c6b0da', bowlDeck: '#cfb27a', wall: '#835a7c',
    wood: '#e38aab', woodAlt: '#c486bd', woodDeck: '#9e5480', woodSide: '#5e3456',
    coping: '#f7e4aa', rail: '#5e3456', steel: '#b9b0bf',
    ink: '#44203f', pencil: '#8f6a88', chalk: '#fffafc', shadow: '#3a1834',
    paint: '#c2406f', curb: '#d9b26a',
    wax: '#7a5a70', stencil: '#6e4f93',
    planter: '#77629b', soil: '#6d5260', leaf: '#6f8f6a', bloom: '#d76a95',
    hedge: '#6a8a64', fence: '#fff4f6', fenceAlt: '#c486bd',
    lantern: '#fff0f4', post: '#8e6a86',
  },
  newfoundland: {
    pad: '#b3bebe', padAlt: '#8a9a9f', padWarm: '#b1a684',
    apron: '#95a1a2', kerb: '#566874', verge: '#6a8d5a',
    concrete: '#dfe5e3', bowl: '#adbfc2', bowlDeck: '#c49a45', wall: '#3b5a70',
    wood: '#4a93a6', woodAlt: '#d6ae55', woodDeck: '#b0544a', woodSide: '#243f55',
    coping: '#f2efe6', rail: '#b33c33', steel: '#98a4a6',
    ink: '#1b2f3b', pencil: '#5d707a', chalk: '#ffffff', shadow: '#12222c',
    paint: '#d69f3c', curb: '#b75a4e',
    wax: '#48585c', stencil: '#b75a4e',
    planter: '#6d4b36', soil: '#3f3026', leaf: '#4d6b45', bloom: '#c9ae5a',
    hedge: '#4f6e47', fence: '#f1ede2', fenceAlt: '#b33c33',
    lantern: '#fff3e0', post: '#6d4b36',
  },
});

export const skatePalette = (theme: ThemeId | string | undefined): SkatePalette =>
  (theme && theme in SKATE_PALETTES ? SKATE_PALETTES[theme as ThemeId] : SKATE_PALETTES.classic);
