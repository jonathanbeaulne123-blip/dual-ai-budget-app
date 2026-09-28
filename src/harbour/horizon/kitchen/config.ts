import {DECK,GALLEY,type Point} from '../movers/fleet/layout.ts';
import type {Ingredient,IngredientId,KitchenAssists,KitchenService,KitchenState,KitchenStation,Recipe,RecipeId,ServiceId} from './types.ts';

export const INGREDIENTS:Record<IngredientId,Ingredient>={
 tomato:{id:'tomato',label:'Tomato',icon:'●',color:'#d95b47',prepSeconds:3,cook:{from:'prepared',appliance:'sauce',seconds:9,warning:9,burn:17}},
 lettuce:{id:'lettuce',label:'Lettuce',icon:'✿',color:'#6e9d57',prepSeconds:3},
 bread:{id:'bread',label:'Bread',icon:'▰',color:'#ceac72',prepSeconds:0,cook:{from:'raw',appliance:'toast',seconds:7,warning:9,burn:17}},
 fish:{id:'fish',label:'Fish',icon:'◀',color:'#84a7b0',prepSeconds:0,cook:{from:'raw',appliance:'grill',seconds:11,warning:10,burn:19}},
 pasta:{id:'pasta',label:'Pasta',icon:'≋',color:'#e1bf6d',prepSeconds:0,cook:{from:'raw',appliance:'boil',seconds:12,warning:10,burn:19}},
 patty:{id:'patty',label:'Patty',icon:'▱',color:'#996959',prepSeconds:0,cook:{from:'raw',appliance:'grill',seconds:11,warning:10,burn:19}},
 bun:{id:'bun',label:'Bun',icon:'◒',color:'#d6a668',prepSeconds:0},
};
export const RECIPES:Record<RecipeId,Recipe>={
 salad:{id:'salad',label:'Garden salad',icon:'✿',components:[{ingredient:'tomato',phase:'prepared'},{ingredient:'lettuce',phase:'prepared'}],patience:115,score:100},
 bruschetta:{id:'bruschetta',label:'Tomato bruschetta',icon:'▰',components:[{ingredient:'bread',phase:'ready'},{ingredient:'tomato',phase:'prepared'}],patience:130,score:130},
 fish:{id:'fish',label:'Grilled fish plate',icon:'◀',components:[{ingredient:'fish',phase:'ready'},{ingredient:'lettuce',phase:'prepared'}],patience:140,score:150},
 pasta:{id:'pasta',label:'Tomato pasta',icon:'≋',components:[{ingredient:'pasta',phase:'ready'},{ingredient:'tomato',phase:'ready'}],patience:200,score:190},
 burger:{id:'burger',label:'Deck burger',icon:'◒',components:[{ingredient:'patty',phase:'ready'},{ingredient:'lettuce',phase:'prepared'},{ingredient:'tomato',phase:'prepared'},{ingredient:'bun',phase:'raw'}],patience:180,score:210},
};
export const SERVICES:Record<ServiceId,KitchenService>={
 first:{id:'first',label:'First Service',subtitle:'Toast, chop, plate, deliver and wash one real dish.',seconds:0,recipes:['bruschetta'],interval:60,maxOrders:1,area:'galley',trolley:false,thresholds:[1,1,1]},
 lunch:{id:'lunch',label:'Lunch at Anchor',subtitle:'A compact four-minute galley service.',seconds:240,recipes:['salad','bruschetta','fish','pasta'],interval:27,maxOrders:3,area:'galley',trolley:false,thresholds:[2,4,6]},
 sunset:{id:'sunset',label:'Sunset Deck Service',subtitle:'Finish at the deck grill and deliver to outdoor dining.',seconds:270,recipes:['fish','burger','salad','bruschetta'],interval:32,maxOrders:3,area:'deck',trolley:false,thresholds:[2,4,6]},
 banquet:{id:'banquet',label:"Captain’s Banquet",subtitle:'Load the trolley, release it, then secure its serving dock.',seconds:300,recipes:['salad','bruschetta','fish','pasta','burger'],interval:31,maxOrders:3,area:'galley',trolley:true,thresholds:[2,4,6]},
 practice:{id:'practice',label:'Practice / relaxed',subtitle:'No clock, no expiring orders. Finish whenever you choose.',seconds:0,recipes:['salad','bruschetta','fish','pasta','burger'],interval:20,maxOrders:3,area:'galley',trolley:false,thresholds:[1,3,5]},
};
export const DEFAULT_ASSISTS:KitchenAssists={forgiveness:1,hazards:true,patience:1,warning:'normal',prep:'toggle'};
export const TROLLEY_DOCKS:readonly Point[]=[{x:-2.7,y:DECK.main,z:-4.7},{x:2.7,y:DECK.main,z:-4.7}];
export const TROLLEY_SECONDS=10;
export const TASK_SECONDS={wash:3,extinguish:2} as const;
const added=(id:string,label:string,kind:KitchenStation['kind'],x:number,z:number,dx:number,dz:number,area:'galley'|'deck'='galley'):KitchenStation=>({id:'yacht.kitchen.'+id,label,kind,at:{x,y:DECK.main,z},surface:{x,y:DECK.main+.9,z},approach:{x:x+dx,y:DECK.main,z:z+dz},facing:Math.atan2(-dx,-dz),capacity:2,area});
export const STATIONS:KitchenStation[]=[...GALLEY.map(s=>({id:s.id,label:s.label,kind:({cold:'storage',cook:'appliance'} as Record<string,KitchenStation['kind']>)[s.role]??s.role as KitchenStation['kind'],at:{...s.at},approach:{...s.approach},surface:{...s.surface},facing:s.facing,capacity:s.role==='plate'||s.role==='return'?4:2,area:'galley' as const,...(s.role==='storage'?{ingredients:['bread','pasta','bun'] as IngredientId[]}:s.role==='cold'?{ingredients:['tomato','lettuce','fish','patty'] as IngredientId[]}:s.role==='cook'?{appliances:['toast','grill','boil','sauce']}: {})})),
 {...added('extinguisher','Fire extinguisher','extinguisher',-2.1,-11.7,0,1.3),capacity:1},
 {...added('deck-grill','Deck grill','appliance',6,-14,-1.35,0,'deck'),appliances:['grill','toast'],capacity:2},
 {...added('deck-pass','Outdoor dining pass','serve',4.65,-17,-1.6,0,'deck'),capacity:1},
 added('trolley','Serving trolley','trolley',-2.7,-4.7,0,-1.3),
];
export function stationsFor(state:KitchenState):KitchenStation[]{
 return STATIONS.filter(s=>state.stationIds.includes(s.id)).map(s=>{
  if(s.kind!=='trolley')return state.service==='sunset'&&s.id==='yacht.galley.hob'?{...s,appliances:s.appliances?.filter(a=>a!=='grill')}:s;
  const a=TROLLEY_DOCKS[state.trolley.dock]!,b=TROLLEY_DOCKS[1-state.trolley.dock]!,t=state.trolley.progress;
  const at={x:a.x+(b.x-a.x)*t,y:a.y,z:a.z+(b.z-a.z)*t};
  return{...s,at,surface:{...at,y:at.y+.9},approach:{...at,z:at.z-1.3}};
 });
}
