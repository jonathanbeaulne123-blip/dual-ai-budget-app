import type {XYZ} from '../land/interfaces.ts';
/** Airport-owned geometry. The strip and Horizon Drive remain the baked authorities. */
export const AIRPORT={id:'horizon-airport',floor:38,runway:{a:[425,38,520] as XYZ,b:[445,38,860] as XYZ,width:30},stands:{kestrel:{x:410.5,y:38,z:614,yaw:Math.PI/2},swift:{x:410.5,y:38,z:631,yaw:Math.PI/2},heron:{x:410.5,y:38,z:649,yaw:Math.PI/2}},arrival:{x:385,y:38,z:650,yaw:0},terminal:{x:394,z:675,w:22,d:26},hangar:{x:395,z:585,w:24,d:26},roadEdge:[367.439,34.133,692.332] as XYZ} as const;
export type AirportBox={id:string;x:number;y:number;z:number;w:number;h:number;d:number;material:'stone'|'cedar'|'copper'|'glass'|'paving'|'paint'|'soil';solid:boolean;roof?:boolean};
export type AirportDeck={id:string;a:XYZ;b:XYZ;width:number};
export const AIRPORT_DECKS:AirportDeck[]=[
 {id:'arrival-drive',a:AIRPORT.roadEdge,b:[377.389,35.3,691.312],width:6},
 {id:'arrival-turn',a:[377.389,35.3,691.312],b:[378,36,685],width:6},
 {id:'arrival-climb',a:[378,36,685],b:[378,38,659],width:6},
 {id:'arrival-level',a:[378,38,659],b:[378,38,650],width:6},
 {id:'terminal-entry',a:[394,38,650],b:[394,38,666],width:6},
 {id:'arrival-court',a:[378,38,652],b:[394,38,650],width:12},
 {id:'public-promenade',a:[401,38,596],b:[401,38,656],width:4},
 {id:'terminal-garden-link',a:[401,38,656],b:[394,38,656],width:4},
 {id:'apron',a:[413,38,600],b:[416,38,651],width:12},
 {id:'hangar-apron',a:[395,38,585],b:[420,38,585],width:22},
 {id:'terminal-front',a:[384,38,650],b:[384,38,659],width:5},
 {id:'cafe-terrace',a:[403,38,674],b:[409,38,674],width:16},
 {id:'roof-ramp',a:[380,38,652],b:[380,42.2,683.75],width:2.5},
 {id:'roof-landing',a:[380,42.2,683.75],b:[380,42.2,685],width:2.5},
 {id:'roof-link',a:[380,42.2,685],b:[395,42.2,685],width:2.5},
];
export const AIRPORT_BOXES:AirportBox[]=[];
const box=(id:string,x:number,y:number,z:number,w:number,h:number,d:number,material:AirportBox['material'],solid=true,roof=false)=>AIRPORT_BOXES.push({id,x,y,z,w,h,d,material,solid,roof});
// A real through-terminal: north entry and east terrace opening, no portal or invisible interior.
box('terminal-floor',394,37.85,675,22,.3,26,'stone');
box('terminal-west',383,40,678, .25,4,20,'cedar');
box('terminal-south',394,40,688,22,4,.25,'cedar');
box('terminal-entry-left',387,40,662,8,4,.25,'glass');
box('terminal-entry-right',401,40,662,8,4,.25,'glass');
box('terminal-east-north',405,40,666,.25,4,8,'glass');
box('terminal-east-south',405,40,684,.25,4,8,'glass');
box('observation-roof',394,42,675,24,.4,28,'copper',true,true);
for(const [id,x,z,w,d] of [['north',394,660.9,24,.15],['east',405.9,675,.15,28],['south',394,689,24,.15],['west',382.1,671,.15,20]] as const)box('roof-rail-'+id,x,42.75,z,w,1.1,d,'glass');
// Hangar opens completely onto the apron on the east side; clear span fits the 10 m wing.
box('hangar-floor',395,37.85,585,24,.3,26,'stone');
box('hangar-west',383,41.5,585,.3,7,26,'cedar');
box('hangar-north',395,41.5,572,24,7,.3,'cedar');
box('hangar-south-west',390,41.5,598,14,7,.3,'cedar');
box('hangar-south-east',405,41.5,598,4,7,.3,'cedar');
box('hangar-roof',395,45,585,26,.4,28,'copper',true,true);
box('workbench',386,38.5,576,4,1,1.5,'cedar');
box('tool-cabinet',384,39,580,1,2,3,'copper');
box('cafe-counter',389,38.55,684,6,1.1,1.6,'cedar');
box('flight-desk',401,38.5,665,3,1,1,'cedar');
box('tower-base',395,42.5,706,5,9,5,'stone');
box('tower-cabin',395,48,706,8,2,8,'glass');
box('tower-cap',395,49.2,706,9,.4,9,'copper',true,true);
for(const [x,z] of [[389,671],[389,677],[407,670],[407,678],[398,643]] as const){
 box(`bench-${x}-${z}`,x,38.25,z,2,.5,.65,'cedar');
}
for(const z of [612,634])box('garden-'+z,393,38.3,z,9,.6,8,'soil');
/** Projection is shared by support, rendering and tests. */
export function deckAt(deck:AirportDeck,x:number,z:number){const [a,b]=[deck.a,deck.b],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),t=((x-a[0])*dx+(z-a[2])*dz)/(length*length),side=((x-a[0])*dz-(z-a[2])*dx)/length;return t>=0&&t<=1&&Math.abs(side)<=deck.width/2?{y:a[1]+(b[1]-a[1])*t,slope:Math.atan2(Math.abs(b[1]-a[1]),length)*180/Math.PI}:null;}
export const AIRPORT_VIEWS=[
 {id:'airport',label:'Horizon Airport',eye:[355,62,720] as XYZ,target:[403,39,640] as XYZ,ground:[385,38,650] as XYZ},
 {id:'airport-terminal',label:'The departure room',eye:[393,40,681] as XYZ,target:[404,39.5,668] as XYZ,ground:[393,38,681] as XYZ},
 {id:'airport-roof',label:'Observation terrace',eye:[398,44,684] as XYZ,target:[440,39,630] as XYZ,ground:[398,42.2,684] as XYZ},
 {id:'airport-approach',label:'Runway 18 approach',eye:[417,65,400] as XYZ,target:[438,38,720] as XYZ,ground:[401,38,641] as XYZ},
];

export const AIRPORT_SEATS=[{id:'cafe-window',x:389,y:38.5,z:671,yaw:Math.PI/2},{id:'cafe-garden',x:389,y:38.5,z:677,yaw:Math.PI/2},{id:'terrace',x:407,y:38.5,z:678,yaw:Math.PI/2},{id:'garden',x:398,y:38.5,z:643,yaw:0}];
