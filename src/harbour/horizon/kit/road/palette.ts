/**
 * The road kit's palettes (ROAD.md §4, STYLE §1.3): Mountain v2's material ladders (`mountain/art/palette.ts`,
 * built from the same scene dressing the placed region uses) plus the few road-only colours. Three dressings
 * re-materialise the kit (STYLE §1.3.4): Classic dressed warm stone, honey timber, iron and brass; Taylor pastel
 * card with white paper edges, washi tape and paper lanterns; Newfoundland split granite, weathered and painted
 * plank, galvanised storm lanterns on rope brackets. Pure data: RGB triples for the card kit.
 */
import {SCENE_DRESSING} from '../../../scene/place.ts';
import {mountainArtPalette,type MountainArtPalette} from '../../../mountain/art/palette.ts';
import {rgb,mix,shade,type RGB} from '../../../art/cardKit.ts';

export type RoadTheme='classic'|'taylor'|'newfoundland';
export type RoadKitPalette=MountainArtPalette&{
  theme:RoadTheme;
  /** STYLE §1.5 `paved` (worn road) and `plaza` (flags). The deck itself is drawn by `runtime/cards.ts`. */
  paved:RGB;flags:RGB;
  /** ROAD.md §4.2: painted markings, warm white; the night chalk they take (sky/night.ts NIGHT_LIGHT_CARDS.chalk). */
  marking:RGB;
  /** Lamp post body, lantern frame, lantern roof. */
  post:RGB;postBand:RGB;frame:RGB;lanternRoof:RGB;
  /** Post-and-rail: posts, rails, the steel band on the top rail, the caps. */
  railPost:RGB;rail:RGB;railBand:RGB;railCap:RGB;
  /** Galvanised metal (Newfoundland storm lantern) and rope (the rope bracket, bollard turns). */
  galvanised:RGB;rope:RGB;
  /** The lamp glass colour by day (unlit) and the lit colour at night (STYLE §1.11 `#ffd98e`). */
  glassDay:RGB;glassNight:RGB;
};

const C=rgb;
export function roadKitPalette(theme:RoadTheme):RoadKitPalette{
  const pal=mountainArtPalette(SCENE_DRESSING[theme]);
  const lampLit=C('#ffd98e');
  if(theme==='taylor')return {...pal,theme,
    paved:C('#c9b891'),flags:C('#dcc8c4'),marking:C('#fbf3ef'),
    post:pal.timberLight,postBand:pal.tape[0]!,frame:pal.trim,lanternRoof:pal.roofAlt,
    railPost:pal.timber,rail:pal.timberLight,railBand:pal.tape[1]!,railCap:pal.paperEdge,
    galvanised:C('#b9a9bf'),rope:C('#e8a6bd'),
    glassDay:mix(lampLit,C('#fff4e8'),.55),glassNight:lampLit};
  if(theme==='newfoundland')return {...pal,theme,
    paved:C('#c9b891'),flags:C('#aeb3ae'),marking:C('#f5f3ea'),
    post:pal.trim,postBand:C('#2f5b63'),frame:C('#8d979a'),lanternRoof:C('#5d686c'),
    railPost:C('#8a7a66'),rail:pal.trim,railBand:C('#8d979a'),railCap:C('#2f5b63'),
    galvanised:C('#9aa4a6'),rope:C('#c9b38a'),
    glassDay:mix(lampLit,C('#e9f0ee'),.55),glassNight:lampLit};
  return {...pal,theme,
    paved:C('#c9b891'),flags:C('#d3bf99'),marking:C('#efe7d2'),
    post:pal.iron,postBand:pal.brass,frame:pal.brass,lanternRoof:pal.iron,
    railPost:pal.timber,rail:pal.timberLight,railBand:pal.iron,railCap:pal.brass,
    galvanised:C('#8f948f'),rope:C('#c9b38a'),
    glassDay:mix(lampLit,C('#f4ecd8'),.5),glassNight:lampLit};
}

/**
 * The corridor surfaces as `runtime/cards.ts` paints them. The Horizon land (terrain and every baked solid) carries no
 * dressing today (its district cards are built once, not per theme), so the deck, kerbs, sidewalks and retaining walls
 * take the Classic values of STYLE §1.3.1 / §1.5 in every dressing; the corridor art (markings, guards, lamps, stops)
 * is dressed.
 */
export const CORRIDOR_SURFACE=Object.freeze({
  road:C('#c9b891'),verge:C('#9c8663'),chalk:C('#fbf5e6'),
  stone:C('#d3bf99'),stoneDark:C('#a99270'),coping:C('#e6d6b6'),mortar:C('#8f7d60'),
  flags:C('#d3bf99'),ink:C('#5b5447'),
  /** STYLE §1.1 pencil (ink × 1.25 value) for wall joints (lines); `seam` is the lit joint strip colour on paving. */
  pencil:shade(C('#5b5447'),1.25),seam:mix(C('#c9b891'),C('#5b5447'),.34),
});
/** Pavement bands (ROAD.md §4.1, like Mountain v2's ROAD_BANDS): the colour of each band id. */
export const PAVEMENT_BANDS=Object.freeze({
  crown:mix(CORRIDOR_SURFACE.road,CORRIDOR_SURFACE.chalk,.22),
  lane:CORRIDOR_SURFACE.road,
  wheel:mix(CORRIDOR_SURFACE.road,CORRIDOR_SURFACE.chalk,.14),
  shoulder:shade(CORRIDOR_SURFACE.road,.955),
  edge:mix(CORRIDOR_SURFACE.road,CORRIDOR_SURFACE.verge,.5),
  gutter:mix(CORRIDOR_SURFACE.road,CORRIDOR_SURFACE.stoneDark,.5),
});
export type PavementBand=keyof typeof PAVEMENT_BANDS;
