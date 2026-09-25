/**
 * Hearth Mountain's painted palettes: one value ladder per material and three authored
 * theme dressings that differ in ARCHITECTURE and MATERIAL, not only hue:
 *  - Classic Hearth: timber-and-brass. Dressed stone, honey timber, green gables, brass.
 *  - Taylor's Scrapbook: album-and-washi. Pastel card with white paper edges, washi tape,
 *    scalloped eaves, heart and star stencils.
 *  - Newfoundland: jellybean clapboard. Saltbox roofs, bright primaries with white trim,
 *    grey granite, rope and buoys.
 * Pure data; no three.js objects (colours are RGB triples for the card kit).
 */
import type {PlaceDressing} from '../../scene/place.ts';
import {COURT_DRESSING} from '../../court/dressing.ts';
import {rgb,shade,mix,type RGB} from '../../art/cardKit.ts';

export type RoofStyle='gable'|'scallop'|'saltbox';
export type WallStyle='stone-timber'|'paper'|'clapboard';
export type MountainArtPalette={
  theme:PlaceDressing['theme'];
  roof:RoofStyle;wall:WallStyle;
  ink:string;pencil:RGB;chalk:RGB;
  stone:RGB;stoneDark:RGB;coping:RGB;mortar:RGB;
  /** Natural rock (crags, ledges, scree): the terrain's rock, a value lighter so its ledges catch the sun. */
  rock:RGB;
  timber:RGB;timberLight:RGB;plank:RGB;
  roofTile:RGB;roofAlt:RGB;
  trim:RGB;brass:RGB;iron:RGB;
  plaster:RGB;
  /** House walls, one per building in turn (Newfoundland's jellybean row). */
  walls:readonly RGB[];
  glass:RGB;glassFrame:RGB;
  road:RGB;roadWear:RGB;verge:RGB;gravel:RGB;
  water:string;waterDeep:RGB;foam:RGB;
  leaf:readonly RGB[];birch:RGB;pine:readonly RGB[];blossom:readonly RGB[];fruit:RGB;
  flowers:readonly RGB[];heath:RGB;
  signBoard:RGB;signText:string;accent:RGB;second:RGB;paperEdge:RGB;tape:readonly RGB[];
  cloth:readonly RGB[];
  lamp:RGB;
};

const C=(h:string)=>rgb(h);
export function mountainArtPalette(d:PlaceDressing):MountainArtPalette{
  const court=COURT_DRESSING[d.theme];
  const base={ink:court.ink,pencil:shade(C(court.ink),1.6),chalk:C('#fbf5e6'),water:d.sea,foam:C('#f4f7f2'),lamp:C('#ffd98e')};
  if(d.theme==='taylor')return {...base,theme:d.theme,roof:'scallop',wall:'paper',
    stone:C('#dcc8c4'),stoneDark:C('#b9a2a6'),rock:C('#c8bcb0'),coping:C('#f3e6e3'),mortar:C('#cdb2b8'),
    timber:C('#b08a92'),timberLight:C('#cfaab2'),plank:C('#d9bcc0'),
    roofTile:C('#8c6f93'),roofAlt:C('#c3899f'),trim:C('#fff8f4'),brass:C('#d9b26a'),iron:C('#6d5a74'),
    plaster:C('#f5ebe6'),walls:[C('#f1d6de'),C('#dcd3ec'),C('#f3e2cf'),C('#d4e4d8')],
    glass:C('#cfe3ea'),glassFrame:C('#8c6f93'),
    road:C('#d9c7c0'),roadWear:C('#c7b0ab'),verge:C('#bba58f'),gravel:C('#d8c9c1'),
    waterDeep:C('#7aa3bd'),
    leaf:[C('#8fb07e'),C('#a4bf8b'),C('#7f9f76'),C('#b3c79a')],birch:C('#f4ece4'),pine:[C('#6f8f72'),C('#5f7f68')],blossom:[C('#f3c4d2'),C('#fbe0e8'),C('#e8a6bd')],fruit:C('#d76a95'),
    flowers:[C('#d76a95'),C('#f2c14e'),C('#b89ad6'),C('#fbe0e8'),C('#8fc1d8')],heath:C('#b596ae'),
    signBoard:C('#fff8f4'),signText:'#6d4a64',accent:C(court.accent),second:C(court.second),paperEdge:C('#ffffff'),tape:[C('#e8a6bd'),C('#a9c9dd'),C('#f2d38a')],
    cloth:[C('#f3c4d2'),C('#dcd3ec'),C('#fff4d8'),C('#c9e2d6')]};
  if(d.theme==='newfoundland')return {...base,theme:d.theme,roof:'saltbox',wall:'clapboard',
    stone:C('#8e9a9c'),stoneDark:C('#66737a'),rock:C('#8a9597'),coping:C('#b7c0bf'),mortar:C('#59656b'),
    timber:C('#6d4b36'),timberLight:C('#93704f'),plank:C('#a98a66'),
    roofTile:C('#3b4a52'),roofAlt:C('#2f5b63'),trim:C('#f5f3ea'),brass:C('#d9b45b'),iron:C('#2e3a40'),
    plaster:C('#f3f1ea'),walls:[C('#c8453a'),C('#e7b53c'),C('#2f8a96'),C('#3f6fb0'),C('#79a353'),C('#d9772f')],
    glass:C('#bfd9df'),glassFrame:C('#f5f3ea'),
    road:C('#9aa3a3'),roadWear:C('#838d8e'),verge:C('#8c7a5c'),gravel:C('#aeb3ae'),
    waterDeep:C('#2f6f80'),
    leaf:[C('#557a4a'),C('#638a55'),C('#4a6b42'),C('#6f9660')],birch:C('#e7e6dc'),pine:[C('#3f5f45'),C('#35553f')],blossom:[C('#f2d7e0'),C('#fbeee8')],fruit:C('#c8453a'),
    flowers:[C('#e7b53c'),C('#c8453a'),C('#7b6fb8'),C('#f3f1ea'),C('#e39d9a')],heath:C('#8a6f7a'),
    signBoard:C('#2f5b63'),signText:'#f5f3ea',accent:C('#c8453a'),second:C('#e7b53c'),paperEdge:C('#f5f3ea'),tape:[C('#c8453a'),C('#e7b53c')],
    cloth:[C('#f5f3ea'),C('#c8453a'),C('#3f6fb0'),C('#e7b53c')]};
  return {...base,theme:d.theme,roof:'gable',wall:'stone-timber',
    stone:C('#d3bf99'),stoneDark:C('#a99270'),rock:C('#a3998a'),coping:C('#e6d6b6'),mortar:C('#8f7d60'),
    timber:C('#6b4a32'),timberLight:C('#9a7250'),plank:C('#b08a5e'),
    roofTile:C('#4d664b'),roofAlt:C('#8a5a3c'),trim:C('#f2e6c8'),brass:C('#caa252'),iron:C('#3f3a33'),
    plaster:C('#eadcbc'),walls:[C('#eadcbc'),C('#e3cfa6'),C('#d9c3a0'),C('#efe2c6')],
    glass:C('#bcd9d2'),glassFrame:C('#6b4a32'),
    road:C('#c9b891'),roadWear:C('#b39f78'),verge:C('#9c8663'),gravel:C('#cbbb98'),
    waterDeep:C('#4f8a93'),
    leaf:[C('#5f7f45'),C('#6f8d4d'),C('#4f6b3a'),C('#7f9a56')],birch:C('#efe6d2'),pine:[C('#445f3c'),C('#3a5236')],blossom:[C('#f6d6d2'),C('#fbeee6'),C('#eab8b0')],fruit:C('#c9563d'),
    flowers:[C('#c9563d'),C('#e9c46a'),C('#8f6fb0'),C('#f4efe6'),C('#e8a9a0')],heath:C('#8d7278'),
    signBoard:C('#6b4a32'),signText:'#f2e6c8',accent:C(court.accent),second:C(court.second),paperEdge:C('#f4efe6'),tape:[C('#caa252')],
    cloth:[C('#f4efe6'),C('#e8a9a0'),C('#bcd9d2'),C('#e9c46a')]};
}
export const tint=(c:RGB,k:number):RGB=>shade(c,k);
export const blend=(a:RGB,b:RGB,t:number):RGB=>mix(a,b,t);
