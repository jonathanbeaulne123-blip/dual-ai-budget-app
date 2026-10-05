/**
 * The building grammar's palettes (STYLE §1.3, §2): one sheet per neighbourhood style, each authored in the three
 * dressings. Dressings RE-MATERIALISE (STYLE §1.3.4): Classic is the style's own material (Ligurian stucco, croft
 * stone, ochre render, dark board-and-batten, pastel boardwalk paint, tin and clapboard on the prairie); Taylor's
 * Scrapbook is pastel card with white paper edges, washi tape and scalloped eaves; Newfoundland is jellybean clapboard
 * with white corner boards, white fascias, dark shingle and split granite. The grammar reads `skin` and `eave` for
 * the construction and the colours below for the paint. Pure data (RGB triples), no three.js objects.
 */
import {rgb,mix,shade,type RGB} from '../../../art/cardKit.ts';
import {mountainArtPalette} from '../../../mountain/art/palette.ts';
import {SCENE_DRESSING} from '../../../scene/place.ts';
import type {DressingTheme} from '../../neighbourhoods/types.ts';

/** How a wall is built: the construction the grammar draws on every face. */
export type WallSkin='stucco'|'stone'|'render'|'board'|'paper'|'clapboard'|'shingle'|'tin';
/** How an eave is finished: a plain card eave, a Taylor paper scallop, a Newfoundland white fascia. */
export type EaveFinish='plain'|'scallop'|'fascia';

export interface BuildingPalette {
  theme: DressingTheme;
  style: string;
  /** The style's house wall construction in this dressing. */
  skin: WallSkin;
  eave: EaveFinish;
  ink: RGB;
  /** Wall paints, picked by `BuildingRecord.paint` (the solver's index). */
  walls: readonly RGB[];
  roofs: readonly RGB[];
  ridge: RGB;
  /** Cornices, stringcourses, window surrounds, corner boards, fascias. */
  trim: RGB;
  /** Window frames and mullions. */
  frame: RGB;
  shutters: readonly RGB[];
  door: RGB;
  /** The neighbourhood's door accent (sumac in the Hollow, bush-plane yellow on the Flats). */
  doorAccent: RGB;
  plinth: RGB;
  plinthDark: RGB;
  /** The darker base course (zoccolo) on stucco and render. */
  base: RGB;
  stone: RGB; stoneLit: RGB; stoneDark: RGB;
  timber: RGB; timberLight: RGB; timberDark: RGB; plank: RGB;
  /** Glass by day, and the warm interior glow of a lit window at night (the `glow` bucket). */
  glass: RGB; glow: RGB; lamp: RGB;
  iron: RGB; brass: RGB; copper: RGB; verdigris: RGB; verdigrisLit: RGB; galvanised: RGB;
  terra: RGB; flowers: readonly RGB[]; leaf: RGB;
  awnings: readonly RGB[];
  /** Awning stripes for `params.awningStripe` (the boardwalk's coral, hull blue, red, sea green). */
  stripes: readonly RGB[];
  canvas: RGB; tin: RGB; tinAlt: RGB; rust: RGB;
  /** Rock strata, light → dark (arches, hoodoos). */
  strata: readonly RGB[];
  slate: RGB; brick: RGB; quoin: RGB; chapel: RGB; thatch: RGB;
  paperEdge: RGB; tape: readonly RGB[];
  /** Named one-offs: Our home's pink, the Fund bank's ochre, the campanile's brick, the elevator's red, the beacon. */
  special: Readonly<Record<string,RGB>>;
}

const C=rgb;
const list=(...h:string[])=>h.map(C);

/** The dressing's base (the island-wide materials), from the mountain palette so the town and the mountain agree. */
function base(theme:DressingTheme):BuildingPalette{
  const m=mountainArtPalette(SCENE_DRESSING[theme]),ink=C(m.ink);
  const common={theme,style:'shared',ink,lamp:m.lamp,brass:m.brass,iron:m.iron,glass:m.glass,special:{}};
  if(theme==='taylor')return {...common,skin:'paper',eave:'scallop',
    walls:m.walls,roofs:[m.roofTile,m.roofAlt],ridge:m.paperEdge,trim:m.paperEdge,frame:m.glassFrame,shutters:list('#c46f8e','#b79ad6'),door:C('#a65d7c'),doorAccent:C('#c46f8e'),
    plinth:m.stone,plinthDark:m.stoneDark,base:m.stoneDark,stone:m.stone,stoneLit:m.coping,stoneDark:m.stoneDark,
    timber:m.timber,timberLight:m.timberLight,timberDark:shade(m.timber,.75),plank:m.plank,
    glow:C('#ffe2b8'),copper:C('#d9a07e'),verdigris:C('#9fcbbb'),verdigrisLit:C('#c4e2d6'),galvanised:C('#c9c3d6'),
    terra:C('#e8a08a'),flowers:list('#ff8fb1','#f2c14e','#b89ad6'),leaf:C('#8fb07e'),
    awnings:list('#f2a7bd','#c7b0e6','#fff1c9','#a9d8c0'),stripes:list('#f2a7bd','#a9c9dd','#c7b0e6','#a9d8c0'),
    canvas:C('#fff4e4'),tin:C('#d6d2e2'),tinAlt:C('#e4e0ee'),rust:C('#e3a99a'),strata:list('#f2d9c4','#e3bfa6','#cf9f8a','#b98478'),
    slate:C('#9f8fae'),brick:C('#e0a5a0'),quoin:C('#ffffff'),chapel:C('#fff8f4'),thatch:C('#d9bc9c'),paperEdge:m.paperEdge,tape:m.tape};
  if(theme==='newfoundland')return {...common,skin:'clapboard',eave:'fascia',
    walls:m.walls,roofs:[m.roofTile,m.roofAlt,C('#3d3a36')],ridge:C('#2a2826'),trim:m.trim,frame:m.trim,shutters:[m.trim],door:C('#1f2a33'),doorAccent:C('#c8453a'),
    plinth:m.stone,plinthDark:m.stoneDark,base:m.mortar,stone:m.stone,stoneLit:m.coping,stoneDark:m.stoneDark,
    timber:m.timber,timberLight:m.timberLight,timberDark:shade(m.timber,.72),plank:m.plank,
    glow:C('#ffd58a'),copper:C('#b8734a'),verdigris:C('#6a9e90'),verdigrisLit:C('#8ab8aa'),galvanised:C('#a9b0b2'),
    terra:C('#b5653f'),flowers:list('#e7b53c','#c8453a','#7b6fb8'),leaf:C('#557a4a'),
    awnings:list('#f5f3ea','#c8453a','#3f6fb0','#e7b53c'),stripes:list('#c8453a','#2f5b63','#e7b53c','#3f6fb0'),
    canvas:C('#e7e1d2'),tin:C('#8e979a'),tinAlt:C('#9da5a7'),rust:C('#9b4a32'),strata:list('#c7826a','#b06a52','#934f3e','#6f3b30'),
    slate:C('#3d4449'),brick:C('#9b3b2a'),quoin:m.trim,chapel:C('#f5f3ea'),thatch:C('#6e7a4a'),paperEdge:m.trim,tape:m.tape};
  return {...common,skin:'stucco',eave:'plain',
    walls:m.walls,roofs:list('#b8683f','#ae5f3b','#bf7247'),ridge:C('#9a4a30'),trim:m.trim,frame:m.timber,shutters:[m.timber],door:C('#4a3426'),doorAccent:C('#a94429'),
    plinth:m.stone,plinthDark:m.stoneDark,base:m.mortar,stone:m.stone,stoneLit:m.coping,stoneDark:m.stoneDark,
    timber:m.timber,timberLight:m.timberLight,timberDark:C('#4a3526'),plank:m.plank,
    glow:C('#ffcf7a'),copper:C('#b8734a'),verdigris:C('#7fa495'),verdigrisLit:C('#9ac0ae'),galvanised:C('#a9b1b3'),
    terra:C('#b8683f'),flowers:list('#c4303a','#e9c46a','#8f6fb0'),leaf:C('#5f7f45'),
    awnings:list('#efe6d2','#7d3b2f','#3f5f4a','#d9c27a'),stripes:list('#e8806a','#3f8fb0','#e05a5a','#2f8f7a'),
    canvas:C('#e9dfc6'),tin:C('#9aa3a6'),tinAlt:C('#a7b0b2'),rust:C('#a8603a'),strata:list('#d7ac6b','#c79a5a','#b9864b','#8f6236'),
    slate:C('#5f6f78'),brick:C('#a9573d'),quoin:C('#e3d2b0'),chapel:C('#d9d2c3'),thatch:C('#8a7448'),paperEdge:C('#f4efe6'),tape:[m.brass]};
}

type Sheet=(p:BuildingPalette)=>Partial<BuildingPalette>;
/** Style sheets: Classic from the prototypes' measured hexes; Taylor and Newfoundland authored from STYLE §2. */
const SHEETS:Record<string,Record<DressingTheme,Sheet>>={
  // Little Harbour, "cobblestone Italy" (STYLE §2.1 as amended; protos/harbour §5).
  'harbour.ligurian':{
    classic:()=>({skin:'stucco',eave:'plain',
      walls:list('#e3a857','#d98b5f','#e8c27d','#c9675a','#efd9b0','#e5a48a','#d9b04c','#b85c4b','#f0c9a8','#cf8f52','#e9b98f','#c97b4e'),
      shutters:list('#4a6b45','#3d5f4a','#56774b','#4a6b45','#6b5038'),roofs:list('#b4583c','#a9502f','#bf6a45','#b06040'),ridge:C('#9a4a30'),
      trim:C('#f3e6c8'),frame:C('#f3e6c8'),plinth:C('#a79a86'),plinthDark:C('#8a7e6c'),base:C('#8f8372'),glass:C('#3f4a52'),glow:C('#ffc77a'),
      iron:C('#2b2622'),terra:C('#b8683f'),door:C('#4a3426'),flowers:list('#c4303a','#c2307a','#d6409a'),leaf:C('#5e7d3e'),
      awnings:list('#efe6d2','#7d3b2f','#3f5f4a','#d9c27a'),quoin:C('#e3d2b0'),
      special:{villa:C('#e6b39a'),bank:C('#c8834e'),bankJoint:C('#a96a3e'),campanile:C('#b8714f'),bell:C('#9a7a3c'),lemon:C('#f2d02e'),bougainvillea:C('#c2307a')}}),
    taylor:p=>({skin:'paper',eave:'scallop',
      walls:list('#f3c9d3','#dcc8ec','#cfe6d6','#f6e5b4','#c9dcf2','#f7d6c0'),roofs:list('#e58fa6','#b79ad6','#8fc7a8','#f0b37e','#9fbde6'),ridge:C('#fffaf3'),
      trim:C('#fffaf3'),frame:C('#c46f8e'),shutters:list('#c46f8e'),door:C('#a65d7c'),plinth:C('#e8d8d0'),plinthDark:C('#d3bfb8'),base:C('#e3c9c4'),
      glass:C('#cfe3ea'),awnings:list('#f2a7bd','#c7b0e6','#fff1c9','#a9d8c0'),flowers:list('#ff8fb1','#f7c6d4','#d76a95'),terra:C('#efb7a2'),quoin:C('#ffffff'),
      special:{villa:C('#f7cfd8'),bank:C('#f6e5b4'),bankJoint:C('#e3c9a0'),campanile:C('#f1d6de'),bell:C('#d9b26a'),lemon:C('#f6e08a'),bougainvillea:C('#ff8fb1')},tape:p.tape}),
    newfoundland:()=>({skin:'clapboard',eave:'fascia',
      walls:list('#c0392b','#e0a526','#2e86ab','#3a7d44','#7d3c98','#e67e22','#1f6f8b','#d35454','#f2d24b'),roofs:list('#3d3a36','#4a3530','#2f3a3d','#3a3a3a'),ridge:C('#2a2826'),
      trim:C('#fbfaf5'),frame:C('#fbfaf5'),shutters:list('#fbfaf5'),door:C('#1f2a33'),plinth:C('#7f7d77'),plinthDark:C('#5f5d58'),base:C('#8b877d'),
      awnings:list('#fbfaf5'),flowers:list('#c4453a','#e7b53c','#7b6fb8'),terra:C('#a85a3a'),quoin:C('#fbfaf5'),
      special:{villa:C('#d35454'),bank:C('#2e86ab'),bankJoint:C('#1f6f8b'),campanile:C('#8e2f25'),bell:C('#b08a3c'),lemon:C('#f2d24b'),bougainvillea:C('#c8453a')}}),
  },
  // The Highlands (protos/highlands §2.10 PALS).
  'crown.croft':{
    classic:()=>({skin:'stone',eave:'plain',walls:list('#a3998a','#aaa092','#9d9384'),stone:C('#a3998a'),stoneLit:C('#c4bba9'),stoneDark:C('#7c7268'),plinth:C('#7c7268'),plinthDark:C('#62594f'),
      timber:C('#4a3526'),timberLight:C('#6b5238'),roofs:list('#5a4a3c','#5e4d3d'),slate:C('#6b6f74'),ridge:C('#4a3e33'),chapel:C('#d9d2c3'),glow:C('#ffd98e'),glass:C('#e9dcb8'),
      trim:C('#d9d2c3'),frame:C('#4a3526'),door:C('#4a3526'),plank:C('#8a6c4c'),verdigris:C('#7fa495'),verdigrisLit:C('#9ac0ae'),
      special:{steel:C('#5d6166'),cabin:C('#b23a2e'),lichen:C('#d9892f'),cable:C('#2d2822')}}),
    taylor:()=>({skin:'paper',eave:'scallop',walls:list('#d8cbc9','#e2d6d4'),stone:C('#d8cbc9'),stoneLit:C('#f1e9e6'),stoneDark:C('#b5a2a4'),plinth:C('#b5a2a4'),plinthDark:C('#9d8a8d'),
      timber:C('#8c6f93'),timberLight:C('#a98aa0'),roofs:list('#c3899f'),slate:C('#9f8fae'),ridge:C('#ffffff'),chapel:C('#fff8f4'),glow:C('#ffe3f0'),
      trim:C('#ffffff'),frame:C('#8c6f93'),door:C('#a65d7c'),plank:C('#d9b8be'),verdigris:C('#9fcbbb'),verdigrisLit:C('#c4e2d6'),
      special:{steel:C('#8c6f93'),cabin:C('#c3899f'),lichen:C('#e8a6bd'),cable:C('#523349')}}),
    newfoundland:()=>({skin:'stone',eave:'fascia',walls:list('#8e9a9c','#97a2a4'),stone:C('#8e9a9c'),stoneLit:C('#a7b0b2'),stoneDark:C('#59656b'),plinth:C('#59656b'),plinthDark:C('#454f54'),
      timber:C('#3d4449'),timberLight:C('#59656b'),roofs:list('#2f5b63'),slate:C('#3d4449'),ridge:C('#f5f3ea'),chapel:C('#f5f3ea'),glow:C('#f5e6b0'),
      trim:C('#f5f3ea'),frame:C('#f5f3ea'),door:C('#c8453a'),plank:C('#8f7d68'),verdigris:C('#6a9e90'),verdigrisLit:C('#8ab8aa'),
      special:{steel:C('#3d4449'),cabin:C('#f5f3ea'),lichen:C('#c7902a'),cable:C('#2d2822')}}),
  },
  // The Hollow (STYLE §2.2): ochre render, kiln brick, mine timber; sumac red doors.
  'hollow.orchard':{
    classic:()=>({skin:'render',eave:'plain',walls:list('#d7ac6b','#dcb57a','#cfa262'),roofs:list('#8a5a3c','#94603f'),ridge:C('#6f4630'),base:C('#a8824c'),
      timber:C('#4a3526'),timberLight:C('#6b4a32'),trim:C('#efe2c6'),frame:C('#4a3526'),door:C('#4a3526'),doorAccent:C('#c4553a'),brick:C('#a9573d'),
      plinth:C('#b39f78'),plinthDark:C('#8f7d60'),flowers:list('#c4553a','#f4efe6','#b89ad6')}),
    taylor:()=>({skin:'paper',eave:'scallop',walls:list('#f3e2cf','#ecd5c2','#f0dcc8'),roofs:list('#b98a6e','#c79a7c'),ridge:C('#ffffff'),base:C('#d9bfa4'),
      timber:C('#a07a64'),timberLight:C('#c09a84'),trim:C('#ffffff'),frame:C('#a07a64'),door:C('#a07a64'),doorAccent:C('#d9775f'),brick:C('#d98f7a'),
      plinth:C('#e3cbb6'),plinthDark:C('#cdb29c'),tape:list('#e8a06a','#c9a35a','#d9775f'),special:{plaid:C('#d9775f'),plaid2:C('#8f9a6e')}}),
    newfoundland:()=>({skin:'clapboard',eave:'fascia',walls:list('#9b3b2a','#a84432'),roofs:list('#3b4a52','#3d3a36'),ridge:C('#2a2826'),
      timber:C('#6d4b36'),timberLight:C('#93704f'),trim:C('#f5f3ea'),frame:C('#f5f3ea'),door:C('#2f5b63'),doorAccent:C('#e7b53c'),brick:C('#8e2f25')}),
  },
  // Scholars' Edge, the Library (protos/scholars SPEC): dark board-and-batten, verdigris, copper.
  'scholars.library':{
    classic:()=>({skin:'board',eave:'plain',walls:list('#4a3526'),timber:C('#4a3526'),timberDark:C('#36271c'),timberLight:C('#6b4a32'),plinth:C('#77716a'),plinthDark:C('#5f5a54'),
      roofs:list('#7fa495'),verdigris:C('#7fa495'),verdigrisLit:C('#9ac0ae'),copper:C('#b8734a'),glass:C('#bcd9d2'),glow:C('#ffcf7a'),frame:C('#2e2018'),door:C('#2a1c13'),trim:C('#2f2117'),
      lamp:C('#ffd98e'),special:{seam:C('#6a9384'),lantern:C('#e8dcc0'),post:C('#3a2a1e')}}),
    taylor:()=>({skin:'paper',eave:'scallop',walls:list('#d9d6cc'),timber:C('#b9b3a6'),timberDark:C('#a39d90'),timberLight:C('#e7e3da'),plinth:C('#cfc6c0'),plinthDark:C('#b8aea8'),
      roofs:list('#a9c8bb'),verdigris:C('#a9c8bb'),verdigrisLit:C('#cfe3da'),copper:C('#e2b39a'),glass:C('#e8eef0'),glow:C('#ffe2b8'),frame:C('#7d7f86'),door:C('#7d6a78'),trim:C('#ffffff'),
      special:{seam:C('#8fb2a5'),lantern:C('#fff8ee'),post:C('#8c7d86')}}),
    newfoundland:()=>({skin:'shingle',eave:'fascia',walls:list('#a9aaa4'),timber:C('#a9aaa4'),timberDark:C('#8c8d88'),timberLight:C('#c3c4be'),plinth:C('#8e9a9c'),plinthDark:C('#66737a'),
      roofs:list('#6a9e90'),verdigris:C('#6a9e90'),verdigrisLit:C('#8ab8aa'),copper:C('#a9b0b2'),glass:C('#bfd9df'),glow:C('#ffd58a'),frame:C('#f5f3ea'),door:C('#2f5b63'),trim:C('#f5f3ea'),
      special:{seam:C('#5a8a7e'),lantern:C('#d9dcd6'),post:C('#3d4449')}}),
  },
  // The Landing & Long Sands, Direction B "California boardwalk" (protos/long-sands §5–§10).
  'landing.boardwalk':{
    classic:()=>({skin:'stucco',eave:'plain',walls:list('#7fb8d8','#8fcfc0','#f2d27a','#f0b4a8','#b9a6d6','#f4f1ea','#e8806a'),roofs:list('#c27a5a','#b86f50'),ridge:C('#a8654a'),
      trim:C('#f4f1ea'),frame:C('#f4f1ea'),glass:C('#3a434b'),glow:C('#ffd18a'),door:C('#3f8fb0'),plinth:C('#d8ccb4'),plinthDark:C('#bcae94'),base:C('#e0d5c2'),
      stripes:list('#e8806a','#3f8fb0','#e05a5a','#2f8f7a'),timber:C('#a9825c'),timberLight:C('#c9a47e'),
      special:{boathouse:C('#f4f1ea'),boatDoor:C('#3f8fb0'),stilt:C('#f4f1ea'),flag:C('#d94a3a'),band:C('#f2d27a'),wheel:C('#f4f1ea'),spoke:C('#e9e1d0'),hub:C('#e8806a'),bulbA:C('#ffd28a'),bulbB:C('#9fe0ff')}}),
    taylor:p=>({skin:'paper',eave:'scallop',walls:list('#c9dcf2','#cfe6d6','#f6e5b4','#f7d6c0','#dcc8ec','#fffaf3','#f3c9d3'),roofs:list('#f0b37e','#e58fa6'),ridge:C('#ffffff'),
      trim:C('#ffffff'),frame:C('#8c6f93'),glass:C('#cfe3ea'),door:C('#9fbde6'),stripes:list('#f2a7bd','#a9c9dd','#f6e08a','#a9d8c0'),
      special:{boathouse:C('#fffaf3'),boatDoor:C('#a9c9dd'),stilt:C('#ffffff'),flag:C('#e8a6bd'),band:C('#fff1c9'),wheel:C('#ffffff'),spoke:C('#f7e8ee'),hub:C('#f2a7bd'),bulbA:C('#ffe6b0'),bulbB:C('#f7c6d4')},tape:p.tape}),
    newfoundland:()=>({skin:'clapboard',eave:'fascia',walls:list('#3f6fb0','#2f8a96','#e7b53c','#c8453a','#79a353','#f5f3ea','#d9772f'),roofs:list('#3b4a52','#2f5b63'),ridge:C('#2a2826'),
      trim:C('#f5f3ea'),frame:C('#f5f3ea'),door:C('#c8453a'),stripes:list('#c8453a','#2f5b63','#e7b53c','#3f6fb0'),timber:C('#8c7a62'),timberLight:C('#a99478'),
      special:{boathouse:C('#c8453a'),boatDoor:C('#f5f3ea'),stilt:C('#8c7a62'),flag:C('#c8453a'),band:C('#f5f3ea'),wheel:C('#f5f3ea'),spoke:C('#d9dcd6'),hub:C('#c8453a'),bulbA:C('#ffd58a'),bulbB:C('#f5f3ea')}}),
  },
  // The Flats, the approved hybrid (protos/flats §2–§8): tin, canvas, timber, ochre rock; bush-plane yellow on doors.
  'flats.prairie':{
    classic:()=>({skin:'board',eave:'plain',walls:list('#a0794f','#8e6a46'),timber:C('#8e6a46'),timberLight:C('#b08a5e'),timberDark:C('#5a4334'),roofs:list('#7a6a58','#9aa3a6'),ridge:C('#5a4334'),
      tin:C('#9aa3a6'),tinAlt:C('#a7b0b2'),rust:C('#a8603a'),canvas:C('#e9dfc6'),doorAccent:C('#e8c547'),door:C('#e8c547'),trim:C('#efe6cf'),frame:C('#5a4334'),plinth:C('#b9864b'),plinthDark:C('#8f6236'),
      strata:list('#d7ac6b','#c79a5a','#b9864b','#8f6236'),
      special:{elevator:C('#9e4535'),band:C('#efe6cf'),beaconG:C('#9fe6a8'),beaconW:C('#fff1c2'),cap:C('#5a4334'),dome:C('#efe8d6'),pathLamp:C('#ff6a4a')}}),
    taylor:p=>({skin:'paper',eave:'scallop',walls:list('#e9d3c2','#e3cbb8'),timber:C('#c9a48c'),timberLight:C('#e0c2ad'),timberDark:C('#a5846e'),roofs:list('#c3899f','#d6d2e2'),ridge:C('#ffffff'),
      tin:C('#d6d2e2'),tinAlt:C('#e4e0ee'),rust:C('#e3b49a'),canvas:C('#fff4e4'),doorAccent:C('#f2d38a'),door:C('#f2d38a'),trim:C('#ffffff'),frame:C('#a5846e'),plinth:C('#e8cdb4'),plinthDark:C('#d2b498'),
      strata:p.strata,special:{elevator:C('#e8a6bd'),band:C('#f2d38a'),beaconG:C('#c9f0cf'),beaconW:C('#fff8e0'),cap:C('#c3899f'),dome:C('#fffaf3'),pathLamp:C('#ff9fb8'),star:C('#d9b26a')}}),
    newfoundland:p=>({skin:'clapboard',eave:'fascia',walls:list('#c8453a','#b33f35'),timber:C('#6d4b36'),timberLight:C('#93704f'),timberDark:C('#4a3426'),roofs:list('#3b4a52','#3d3a36'),ridge:C('#2a2826'),
      tin:C('#b0453a'),tinAlt:C('#c04e42'),rust:C('#7e3428'),canvas:C('#e7e1d2'),doorAccent:C('#e7b53c'),door:C('#e7b53c'),trim:C('#f5f3ea'),frame:C('#f5f3ea'),plinth:C('#8e9a9c'),plinthDark:C('#66737a'),
      strata:p.strata,special:{elevator:C('#c8453a'),band:C('#f5f3ea'),beaconG:C('#9fe6a8'),beaconW:C('#f6f4ea'),cap:C('#2f5b63'),dome:C('#f5f3ea'),pathLamp:C('#e5533d')}}),
  },
};

/** The palette for one style in one dressing. Unknown styles fall back to the dressing's island-wide base. */
export function buildingPalette(theme:DressingTheme,style:string):BuildingPalette{
  const p=base(theme),sheet=SHEETS[style]?.[theme];
  if(!sheet)return {...p,style,special:sharedSpecial(p)};
  const o=sheet(p);
  return {...p,...o,style,special:{...sharedSpecial(p),...(o.special??{})}};
}
function sharedSpecial(p:BuildingPalette):Record<string,RGB>{
  return {sail:mix(p.canvas,p.paperEdge,.3),tank:C(p.theme==='taylor'?'#c9dcf2':p.theme==='newfoundland'?'#8e979a':'#9db0ba'),vane:C(p.theme==='taylor'?'#e58fa6':p.theme==='newfoundland'?'#c8453a':'#a94429')};
}
/** Every authored style sheet (the kit sheet and the tests walk these). */
export const BUILDING_STYLES=Object.keys(SHEETS);
