/**
 * The building grammar's synthetic fixture: one or more records per `BuildingKind`, at the prototypes' measured sizes
 * (protos/<place>/SPEC.md), around the origin on a gentle synthetic slope. The tests and the kit sheet
 * (`scripts/horizon/kit-sheet-buildings.mjs`) draw exactly these. Not world data: modules place the real records.
 */
import type {BuildingKind,BuildingRecord,RoofSpec} from '../../neighbourhoods/types.ts';

const roof=(form:RoofSpec['form'],pitch:number,overhang=0,material='tile'):RoofSpec=>({form,pitch,overhang,material});
type R=Omit<BuildingRecord,'districtId'|'at'|'yaw'|'collide'>&{collide?:boolean;yaw?:number};
const H='harbour.ligurian',CR='crown.croft',HO='hollow.orchard',SC='scholars.library',LA='landing.boardwalk',FL='flats.prairie',SH='shared';
const SPECS:R[]=[
  {id:'row.a',kind:'rowHouse',style:H,size:{w:8,d:9,h:9.9},roof:roof('gable',22,.75),storeys:3,paint:0},
  {id:'row.b',kind:'rowHouse',style:H,size:{w:6.2,d:8,h:12.9},roof:roof('gable',22,.75),storeys:4,paint:3,params:{altana:true}},
  {id:'row.c',kind:'rowHouse',style:H,size:{w:5.5,d:7,h:6.9},roof:roof('gable',22,.75),storeys:2,paint:7},
  {id:'home',kind:'villa',style:H,size:{w:16,d:22,h:4.6},roof:roof('hip',22,.6),storeys:1,params:{kitchenFace:'back'},hostId:'home'},
  {id:'bank',kind:'palazzo',style:H,size:{w:20,d:18,h:6.3},roof:roof('hip',18,.7),params:{arcades:3},hostId:'bank'},
  {id:'campanile',kind:'campanile',style:H,size:{w:5.4,d:5.4,h:22},roof:roof('pyramid',0),params:{belfryOpen:true},landmarkId:'campanile'},
  {id:'loggia',kind:'loggia',style:H,size:{w:12,d:5,h:4.2},roof:roof('hip',20,.4),params:{arcades:3}},
  {id:'kiosk',kind:'kiosk',style:H,size:{w:2.6,d:2.6,h:2.6},roof:roof('pyramid',30,.5)},
  {id:'croft.big',kind:'croft',style:CR,size:{w:12,d:6,h:2.7},roof:roof('gable',36,.35,'slate'),paint:0},
  {id:'croft.small',kind:'croft',style:CR,size:{w:8,d:5,h:2.7},roof:roof('gable',36,.35,'slate'),paint:1},
  {id:'westwatch',kind:'chapel',style:CR,size:{w:6,d:11,h:4.2},roof:roof('gable',47,.35,'slate'),landmarkId:'westwatch'},
  {id:'longhouse',kind:'longhouse',style:CR,size:{w:15,d:6.5,h:2.8},roof:roof('gable',36,.4)},
  {id:'barn',kind:'barn',style:CR,size:{w:9,d:7,h:3.4},roof:roof('gable',37,.35)},
  {id:'shieling',kind:'shieling',style:CR,size:{w:4,d:3,h:1.9},roof:roof('gable',40,.3)},
  {id:'lift.station',kind:'liftStation',style:CR,size:{w:5,d:4,h:2.6},roof:roof('gable',30,.5,'slate')},
  {id:'lift.tower',kind:'liftTower',style:CR,size:{w:3.2,d:.6,h:7},roof:roof('none',0)},
  {id:'kiln',kind:'kiln',style:HO,size:{w:6,d:5,h:3},roof:roof('hip',24,.6),params:{chimneyH:11}},
  {id:'cottage',kind:'cottage',style:HO,size:{w:9,d:6.5,h:3},roof:roof('hip',28,.85)},
  {id:'studio',kind:'studio',style:HO,size:{w:10,d:7,h:3.8},roof:roof('shed',14,.7)},
  {id:'hollow.bridge',kind:'coveredBridge',style:HO,size:{w:16,d:4.4,h:2.7},roof:roof('gable',35,.45)},
  {id:'library',kind:'library',style:SC,size:{w:42,d:30,h:5.2},roof:roof('gable',50,.9,'copper'),hostId:'library',landmarkId:'library'},
  {id:'boathouse',kind:'boathouse',style:LA,size:{w:20,d:14,h:4},roof:roof('gable',21.8,.45),hostId:'boathouse'},
  {id:'store.a',kind:'storefront',style:LA,size:{w:12,d:9,h:4.4},roof:roof('flat',0),paint:3,params:{awningStripe:0}},
  {id:'store.b',kind:'storefront',style:LA,size:{w:14,d:9,h:7.6},roof:roof('flat',0),paint:4,params:{awningStripe:1}},
  {id:'guard',kind:'lifeguardTower',style:LA,size:{w:3.4,d:3.2,h:2.3},roof:roof('flat',0),paint:0},
  {id:'shack',kind:'shack',style:LA,size:{w:9,d:11,h:4.2},roof:roof('flat',0)},
  {id:'wheel',kind:'ferrisWheel',style:LA,size:{w:18,d:6,h:30},roof:roof('none',0),params:{radius:13,hubH:16,gondolas:16},landmarkId:'wheel'},
  {id:'hangar',kind:'quonset',style:FL,size:{w:26,d:24,h:.6},roof:roof('barrel',0),params:{openFront:true}},
  {id:'elevator',kind:'elevator',style:FL,size:{w:8,d:10,h:21},roof:roof('gable',40),landmarkId:'elevator'},
  {id:'station',kind:'station',style:FL,size:{w:16,d:8,h:3.4},roof:roof('hip',26,1.2)},
  {id:'observatory',kind:'observatory',style:FL,size:{w:4,d:4,h:2.4},roof:roof('cone',0)},
  {id:'arch',kind:'arch',style:FL,size:{w:10,d:2.4,h:7},roof:roof('none',0)},
  {id:'hoodoo',kind:'hoodoo',style:FL,size:{w:2.2,d:2.2,h:6.5},roof:roof('none',0),collide:false},
  {id:'pavilion',kind:'pavilion',style:SH,size:{w:7.2,d:7.2,h:3.1},roof:roof('cone',0,1,'slate'),door:{face:'front',u:0}},
  {id:'hide',kind:'hide',style:SH,size:{w:4.6,d:5,h:2.3},roof:roof('shed',7,.25),params:{slots:'front,left',open:'back'}},
  {id:'deck',kind:'deck',style:SH,size:{w:7,d:4.5,h:0},roof:roof('none',0),params:{rails:'front,left,right'}},
  {id:'platform',kind:'platform',style:SH,size:{w:7,d:5,h:0},roof:roof('none',0),params:{rails:'front,left,right'}},
  {id:'windpump',kind:'windpump',style:SH,size:{w:3.4,d:3.4,h:11},roof:roof('none',0)},
  {id:'shed',kind:'shed',style:SH,size:{w:4,d:3,h:2.3},roof:roof('shed',14,.3)},
  {id:'gate',kind:'gate',style:SH,size:{w:7,d:.64,h:4.3},roof:roof('none',0)},
  {id:'wall',kind:'wall',style:SH,size:{w:12,d:.6,h:1.1},roof:roof('none',0)},
];
/** A gentle synthetic slope with a little relief, so plinths and footings show. */
export const fixtureGround=(x:number,z:number):number=>.035*x-.02*z+.25*Math.sin(x*.21)*Math.cos(z*.17);
/** The fixture records, each at the origin with its floor on the highest ground under it. */
export function buildingFixtures(at:(i:number,rec:R)=>[number,number]=()=>[0,0]):BuildingRecord[]{
  return SPECS.map((s,i)=>{const [x,z]=at(i,s),yaw=s.yaw??0,hx=s.size.w/2,hz=s.size.d/2,c=Math.cos(yaw),sn=Math.sin(yaw);
    let floor=-Infinity;for(const u of [-1,0,1])for(const v of [-1,0,1])floor=Math.max(floor,fixtureGround(x+u*hx*c+v*hz*sn,z+v*hz*c-u*hx*sn));
    return {...s,districtId:'fixture',at:[x,floor+.25,z],yaw,collide:s.collide??true} as BuildingRecord;});
}
export const FIXTURE_KINDS=[...new Set(SPECS.map(s=>s.kind))] as BuildingKind[];
