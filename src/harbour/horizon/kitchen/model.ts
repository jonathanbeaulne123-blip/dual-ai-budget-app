import {DEFAULT_ASSISTS,INGREDIENTS,RECIPES,SERVICES,STATIONS,TROLLEY_SECONDS,TASK_SECONDS,stationsFor} from './config.ts';
import type {ChefId,ChefPose,ChefState,IngredientId,KitchenAction,KitchenActionResult,KitchenEngine,KitchenEvent,KitchenItem,KitchenState,KitchenStation,Recipe} from './types.ts';

const clone=<T>(value:T):T=>structuredClone(value);
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const round=(n:number)=>Math.round(n*1e6)/1e6;
const sid=(s:string)=>'yacht.galley.'+s;
const distance=(a:ChefPose|{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const poseValid=(p:ChefPose)=>p&&[p.x,p.y,p.z,p.yaw].every(finite)&&Math.abs(p.x)<=9&&Math.abs(p.z)<=25&&p.y>=0&&p.y<=11;
const cookingDemand=(r:Recipe)=>r.components.filter(c=>c.phase==='ready').length;
function cookingFits(recipes:Recipe[],stations:KitchenStation[]){
 const slots=stations.filter(s=>s.kind==='appliance').flatMap(s=>Array.from({length:s.capacity},()=>s.appliances??[]));
 const tasks=recipes.flatMap(r=>r.components.filter(c=>c.phase==='ready').map(c=>INGREDIENTS[c.ingredient].cook!.appliance));
 tasks.sort((a,b)=>slots.filter(s=>s.includes(a)).length-slots.filter(s=>s.includes(b)).length);
 const used=new Set<number>();const assign=(n:number):boolean=>n===tasks.length||slots.some((slot,i)=>{if(used.has(i)||!slot.includes(tasks[n]!))return false;used.add(i);if(assign(n+1))return true;used.delete(i);return false;});
 return assign(0);
}
const chef=(id:ChefId):ChefState=>({id,label:id===0?'Chef 1':'Chef 2',pose:{x:id===0?-1.3:1.3,y:3.85,z:-10,yaw:0},held:null,target:null,selection:0,task:null,connected:true,ready:false});
const empty=(seed:number):KitchenState=>({version:1,phase:'idle',service:'first',players:1,assists:{...DEFAULT_ASSISTS},seed:seed>>>0,elapsed:0,remaining:0,score:0,served:0,missed:0,sequence:0,bestSequence:0,chefs:[chef(0)],items:{},orders:[],stationIds:[],fires:{},events:[],eventSeq:0,nextId:1,nextOrderAt:0,tutorial:0,trolley:{dock:0,secured:true,progress:0},pauseReason:null,result:null});
function parts(item:KitchenItem,state:KitchenState){return item.contents.map(id=>state.items[id]!).filter(Boolean);}
function matches(recipe:Recipe,items:KitchenItem[],complete=false){
 const left=recipe.components.slice();for(const item of items){const i=left.findIndex(c=>c.ingredient===item.ingredient&&c.phase===item.phase);if(i<0)return false;left.splice(i,1);}return !complete||left.length===0;
}
export function itemLabel(item:KitchenItem,state:KitchenState):string{
 if(item.kind==='extinguisher')return 'Fire extinguisher';
 if(item.kind==='plate'){if(item.dirty)return 'Dirty plate';if(!item.contents.length)return 'Clean plate';const list=parts(item,state),recipe=Object.values(RECIPES).find(r=>matches(r,list,true));return recipe?.label??'Plate · '+list.map(i=>itemLabel(i,state)).join(' + ');}
 return `${item.phase==='raw'?'Whole':item.phase==='prepared'?'Chopped':item.phase==='cooking'?'Cooking':item.phase==='ready'?'Ready':'Burnt'} ${INGREDIENTS[item.ingredient!]?.label??'ingredient'}`;
}
export {stationsFor} from './config.ts';
export function createKitchenEngine(options:{seed?:number;canReach?:(pose:ChefPose,station:KitchenStation)=>boolean}={}):KitchenEngine{
 const initialSeed=(options.seed??84721)>>>0;let s=empty(initialSeed),remainder=0;const heldPrep=new Set<ChefId>();
 const currentStation=(id:string|null|undefined)=>stationsFor(s).find(st=>st.id===id);
 const contents=(id:string)=>Object.values(s.items).filter(i=>i.location.kind==='station'&&i.location.station===id).sort((a,b)=>(a.location as {slot:number}).slot-(b.location as {slot:number}).slot);
 const slot=(st:KitchenStation)=>{const taken=new Set(contents(st.id).map(i=>(i.location as {slot:number}).slot));for(let i=0;i<st.capacity;i++)if(!taken.has(i))return i;return -1;};
 function emit(kind:KitchenEvent['kind'],message:string,id?:ChefId){s.events.push({seq:++s.eventSeq,kind,message,...(id===undefined?{}:{chef:id})});if(s.events.length>32)s.events.shift();}
 const result=(ok:boolean,message:string,id?:ChefId):KitchenActionResult=>{if(message)emit('feedback',message,id);return{ok,message};};
 function put(item:KitchenItem,st:KitchenStation){const at=slot(st);if(at<0)return false;item.location={kind:'station',station:st.id,slot:at};return true;}
 function newItem(kind:KitchenItem['kind'],ingredient?:IngredientId){const id='item-'+s.nextId++;const item:KitchenItem={id,kind,...(ingredient?{ingredient}:{}),phase:'raw',progress:0,cookElapsed:0,contents:[],dirty:false,location:{kind:'discarded'}};s.items[id]=item;return item;}
 function reach(c:ChefState,st:KitchenStation){const dx=st.at.x-c.pose.x,dz=st.at.z-c.pose.z,n=Math.hypot(dx,dz);return Math.abs(c.pose.y-st.approach.y)<.65&&distance(c.pose,st.approach)<=2&&(n<.2||(Math.sin(c.pose.yaw)*dx+Math.cos(c.pose.yaw)*dz)/n>=.15)&&(!options.canReach||options.canReach(c.pose,st));}
 function take(c:ChefState,item:KitchenItem){if(c.held)return false;for(const other of s.chefs)if(other.task&&item.location.kind==='station'&&other.task.station===item.location.station)other.task=null;c.held=item.id;item.location={kind:'hands',chef:c.id};return true;}
 function drop(c:ChefState){c.held=null;c.task=null;}
 function discard(item:KitchenItem){for(const id of item.contents){const part=s.items[id];if(part)discard(part);}item.contents=[];item.location={kind:'discarded'};}
 function tutorial(n:number){if(s.service==='first')s.tutorial=Math.max(s.tutorial,n);}
 function recipeFor(item:KitchenItem){return item.kind==='plate'&&!item.dirty?Object.values(RECIPES).find(r=>matches(r,parts(item,s),true)):undefined;}
 function finish(){if(s.phase==='results'||s.phase==='idle'||s.phase==='menu')return;for(const o of s.orders)if(o.status==='waiting'){o.status='missed';s.missed++;}s.sequence=0;const thresholds=SERVICES[s.service].thresholds;const stars=thresholds.filter(n=>s.served>=Math.ceil(n*(s.players===1?.8:1))).length;s.result={id:`kitchen-${s.service}-${s.seed}-${s.nextId}-${s.eventSeq}`,service:s.service,players:s.players,score:s.score,served:s.served,missed:s.missed,bestSequence:s.bestSequence,stars,recipes:[...new Set(s.orders.filter(o=>o.status==='served').map(o=>o.recipe))]};s.phase='results';for(const c of s.chefs)c.task=null;emit('result',`${s.served} dishes served · service score ${s.score}`);}
 function deliver(item:KitchenItem,c?:ChefState){
  const recipe=recipeFor(item);if(!recipe)return result(false,'This plate needs the exact prepared or cooked recipe components.',c?.id);
  const order=s.orders.find(o=>o.status==='waiting'&&o.recipe===recipe.id);if(!order)return result(false,`${recipe.label} is complete; wait for its order.`,c?.id);
  order.status='served';s.served++;s.sequence++;s.bestSequence=Math.max(s.bestSequence,s.sequence);s.score+=recipe.score+Math.round(order.total?30*order.remaining/order.total:30)+Math.min(5,s.sequence)*5;
  for(const id of item.contents)discard(s.items[id]!);item.contents=[];item.dirty=true;item.progress=0;item.location={kind:'return',remaining:6};if(c)drop(c);tutorial(5);emit('serve',`${recipe.label} delivered. Dirty plate returns in 6 seconds.`,c?.id);return{ok:true,message:'Delivered'};
 }
 function assembly(plate:KitchenItem,ingredient:KitchenItem,c:ChefState){
  if(plate.dirty||ingredient.kind!=='ingredient'||!Object.values(RECIPES).some(r=>matches(r,[...parts(plate,s),ingredient])))return result(false,'That ingredient or preparation does not fit this plate. Use a clear plate or the waste bin.',c.id);
  ingredient.location={kind:'container',container:plate.id};plate.contents.push(ingredient.id);if(c.held===ingredient.id)drop(c);tutorial(4);return result(true,itemLabel(plate,s),c.id);
 }
 function chooseTask(c:ChefState,st:KitchenStation){
  if(c.task?.station===st.id&&s.assists.prep==='toggle'){c.task=null;return result(true,'Preparation paused; progress kept.',c.id);}
  if(s.chefs.some(other=>other.id!==c.id&&other.task?.station===st.id))return result(false,'The other chef is already working here.',c.id);
  if(st.kind==='trolley'){
   if(!s.trolley.secured&&s.trolley.progress<1)return result(false,'Trolley moving to its marked dock.',c.id);
   if(s.trolley.secured){s.trolley.secured=false;s.trolley.progress=0;return result(true,'Trolley released. Secure it at the next dock.',c.id);}
   s.trolley.dock=1-s.trolley.dock;s.trolley.progress=0;s.trolley.secured=true;
   if(s.trolley.dock===1)for(const item of contents(st.id))if(recipeFor(item))deliver(item);
   return result(true,'Trolley secured.',c.id);
  }
  if(s.fires[st.id]){if(s.items[c.held??'']?.kind!=='extinguisher')return result(false,'Collect the extinguisher and prepare here to put out the fire.',c.id);c.task={station:st.id,kind:'extinguish'};heldPrep.add(c.id);return result(true,'Extinguishing.',c.id);}
  const item=contents(st.id).find(i=>st.kind==='wash'?i.kind==='plate'&&i.dirty:i.kind==='ingredient'&&i.phase==='raw'&&INGREDIENTS[i.ingredient!].prepSeconds>0);
  if(!item||st.kind!=='prep'&&st.kind!=='wash')return result(false,'Place a whole vegetable on preparation, or a dirty plate in the sink.',c.id);
  c.task={station:st.id,kind:st.kind==='wash'?'wash':'prepare'};heldPrep.add(c.id);return result(true,st.kind==='wash'?'Washing.':'Preparing.',c.id);
 }
 function toss(c:ChefState,a:KitchenAction){
  const item=s.items[c.held??''],to=a.to;if(!item||item.kind!=='ingredient'||!['raw','prepared'].includes(item.phase)||!to||!to.point||![to.point.x,to.point.y,to.point.z].every(finite)||distance(c.pose,to.point)>5)return result(false,'Toss a loose, cool ingredient to an empty counter or free chef within 5 metres.',c.id);
  if((to.station===undefined)===(to.chef===undefined))return result(false,'Choose one toss destination.',c.id);
  const receiver=to.chef===undefined?null:s.chefs.find(x=>x.id===to.chef),st=currentStation(to.station);
  if(receiver){if(receiver.id===c.id||!receiver.connected||receiver.held||Math.hypot(receiver.pose.x-to.point.x,receiver.pose.z-to.point.z)>.5||Math.abs(receiver.pose.y+.9-to.point.y)>.5||Object.values(s.items).some(i=>i.location.kind==='transit'&&i.location.chef===receiver.id))return result(false,'That chef cannot catch this ingredient.',c.id);}
  else if(!st||!['counter','prep','appliance'].includes(st.kind)||distance(st.surface,to.point)>.75||slot(st)<0||contents(st.id).length||s.fires[st.id]||Object.values(s.items).some(i=>i.location.kind==='transit'&&i.location.station===st.id)||st.kind==='appliance'&&(!st.appliances?.includes(INGREDIENTS[item.ingredient!].cook?.appliance??'')||item.phase!==INGREDIENTS[item.ingredient!].cook?.from))return result(false,'The toss needs an empty compatible work surface.',c.id);
  const destination=receiver?{...receiver.pose,y:receiver.pose.y+.9}:st!.surface;
  const targetStation=st??{...STATIONS[0]!,at:receiver!.pose,approach:receiver!.pose,surface:receiver!.pose};
  if(options.canReach&&!options.canReach(c.pose,targetStation))return result(false,'The toss path is blocked.',c.id);
  const dx=destination.x-c.pose.x,dz=destination.z-c.pose.z;if(Math.sin(c.pose.yaw)*dx+Math.cos(c.pose.yaw)*dz<0)return result(false,'Face the toss destination first.',c.id);
  item.location={kind:'transit',from:{x:c.pose.x,y:c.pose.y+1,z:c.pose.z},to:{...destination},remaining:.45,...(receiver?{chef:receiver.id}:{station:st!.id})};drop(c);return result(true,'Ingredient passed.',c.id);
 }
 function beginCooking(item:KitchenItem,st:KitchenStation){const rule=INGREDIENTS[item.ingredient!]?.cook;if(item.kind==='ingredient'&&rule&&item.phase===rule.from&&st.appliances?.includes(rule.appliance)){item.phase='cooking';item.cookElapsed=0;item.progress=0;return true;}return false;}
 function random(){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
 function addOrder(){
  const service=SERVICES[s.service],stations=stationsFor(s),available=new Set(stations.flatMap(st=>st.ingredients??[])),appliances=new Set(stations.filter(st=>!s.fires[st.id]).flatMap(st=>st.appliances??[]));
  const waiting=s.orders.filter(o=>o.status==='waiting'),capacity=stations.filter(st=>st.kind==='appliance'&&!s.fires[st.id]).reduce((n,st)=>n+st.capacity,0),demand=waiting.reduce((n,o)=>n+cookingDemand(RECIPES[o.recipe]),0);
  if(waiting.length>=Math.min(service.maxOrders,s.players===1?2:3))return false;
  let choices=service.recipes.filter(id=>RECIPES[id].components.every(c=>available.has(c.ingredient)&&(c.phase!=='prepared'||INGREDIENTS[c.ingredient].prepSeconds>0)&&(c.phase!=='ready'||appliances.has(INGREDIENTS[c.ingredient].cook?.appliance??'')))&&demand+cookingDemand(RECIPES[id])<=capacity&&cookingFits([...waiting.map(o=>RECIPES[o.recipe]),RECIPES[id]],stations.filter(st=>!s.fires[st.id])));
  if(s.service==='sunset'&&s.orders.length===0&&choices.includes('fish'))choices=['fish'];
  if(!choices.length)return false;
  const id=choices[Math.floor(random()*choices.length)]!,recipe=RECIPES[id],total=service.seconds?recipe.patience*(s.players===1?1.35:1)*s.assists.patience+(service.area==='deck'?30:service.trolley?20:0):0;
  s.orders.push({id:'order-'+s.nextId++,recipe:id,remaining:total,total,status:'waiting'});return true;
 }
 function feedbackAction(id:ChefId,a:KitchenAction):KitchenActionResult{
  const c=s.chefs.find(c=>c.id===id);if(!c||!c.connected)return{ok:false,message:'Chef is disconnected.'};
  if(a.type==='ready'){
   if(s.phase==='playing'&&s.service==='practice'){finish();return{ok:true,message:'Practice complete.'};}
   if(s.phase!=='ready')return{ok:false,message:'Choose a service first.'};c.ready=true;if(s.chefs.every(c=>c.ready&&c.connected)){s.phase='playing';addOrder();s.nextOrderAt=SERVICES[s.service].interval*(s.players===1?1.45:1);emit('feedback','Service started. Pick up ingredients and follow the order.');}return{ok:true,message:'Ready'};
  }
  if(s.phase!=='playing')return{ok:false,message:'The service is not playing.'};
  if(a.type==='toss')return toss(c,a);
  const st=currentStation(a.target??c.target);if(!st||!reach(c,st))return result(false,'Face the highlighted station and move within reach.',id);
  if(c.target!==st.id){c.target=st.id;c.selection=0;}
  if(a.type==='cycle'){const items=contents(st.id),n=st.ingredients?.length??Math.max(1,items.length);c.selection=(c.selection+1)%n;return result(true,st.ingredients?INGREDIENTS[st.ingredients[c.selection]!].label:items[c.selection]?itemLabel(items[c.selection]!,s):'Use interact to pick up or place; prepare to work.',id);}
  if(a.type==='prepare')return chooseTask(c,st);
  if(a.type!=='interact')return{ok:false,message:'Unknown action.'};
  c.task=null;const held=s.items[c.held??''],list=contents(st.id);
  if(st.kind==='trolley'&&!s.trolley.secured)return result(false,'Secure the trolley before handling its dishes.',id);
  if(s.fires[st.id])return result(false,'Extinguish this station before touching the food.',id);
  if(st.kind==='storage'){if(held)return result(false,'Put down the held item first.',id);const ingredient=a.ingredient??st.ingredients?.[c.selection%(st.ingredients?.length??1)];if(!ingredient||!st.ingredients?.includes(ingredient))return result(false,'That ingredient is not stored here.',id);take(c,newItem('ingredient',ingredient));if(ingredient==='bread')tutorial(1);return result(true,INGREDIENTS[ingredient].label,id);}
  if(st.kind==='waste'){if(!held)return result(false,'Carry unwanted food or a dirty plate here.',id);if(held.kind==='extinguisher')return result(false,'Return the extinguisher to its hook.',id);if(held.kind==='plate'){for(const p of held.contents)discard(s.items[p]!);held.contents=[];held.dirty=true;held.progress=0;held.location={kind:'return',remaining:3};}else discard(held);drop(c);return result(true,'Food discarded. Plates return for washing.',id);}
  if(st.kind==='serve'){if(!held)return result(false,'Bring a completed plate.',id);if(s.service==='sunset'&&st.id!== 'yacht.kitchen.deck-pass')return result(false,'This service delivers to the outdoor dining pass.',id);if(s.service==='banquet')return result(false,'Load the serving trolley and secure its serving dock.',id);return deliver(held,c);}
  if(!held){const choices=st.kind==='plate'?list.filter(i=>i.kind==='plate'&&!i.dirty):list;const item=choices[c.selection%Math.max(1,choices.length)];if(!item)return result(false,st.kind==='plate'?'Clean plates are circulating; collect returns and wash them.':'This surface is empty.',id);if(item.phase==='cooking')return result(false,'Still cooking. Cycle to another slot or wait until ready.',id);take(c,item);return result(true,itemLabel(item,s),id);}
  if(held.kind==='ingredient'){
   const plate=list.find(i=>i.kind==='plate'&&!i.dirty&&Object.values(RECIPES).some(r=>matches(r,[...parts(i,s),held])));if(plate)return assembly(plate,held,c);
  }
  if(held.kind==='plate'&&!held.dirty){const ingredient=list.find(i=>i.kind==='ingredient'&&Object.values(RECIPES).some(r=>matches(r,[...parts(held,s),i])));if(ingredient)return assembly(held,ingredient,c);}
  if(st.kind==='appliance'){const rule=held.kind==='ingredient'?INGREDIENTS[held.ingredient!].cook:null;if(!rule||held.phase!==rule.from||!st.appliances?.includes(rule.appliance))return result(false,'This appliance needs an uncooked compatible ingredient.',id);}
  if(st.kind==='wash'&&(held.kind!=='plate'||!held.dirty))return result(false,'Only dirty plates need washing.',id);
  if(st.kind==='plate'&&held.kind!=='plate')return result(false,'Place a clean plate here before adding recipe components.',id);
  if(st.kind==='extinguisher'&&held.kind!=='extinguisher'||st.kind!=='extinguisher'&&held.kind==='extinguisher')return result(false,'The extinguisher belongs on its wall hook.',id);
  if(st.kind==='trolley'&&held.kind!=='plate')return result(false,'The trolley carries plated dishes.',id);
  if(st.kind==='trolley'&&s.trolley.dock===1)return result(false,'Load dishes at the galley dock. Release the trolley to send it back.',id);
  if(!put(held,st))return result(false,'This station is full. Use another clear surface.',id);
  if(st.kind==='appliance')beginCooking(held,st);drop(c);return result(true,`Placed at ${st.label}.`,id);
 }
 function step(dt:number){
  s.elapsed=round(s.elapsed+dt);if(SERVICES[s.service].seconds){const before=s.remaining;s.remaining=Math.max(0,round(s.remaining-dt));if(before>30&&s.remaining<=30)emit('warning','30 seconds left in this service. Finish the plates already underway.');}
  if(!s.trolley.secured)s.trolley.progress=Math.min(1,round(s.trolley.progress+dt/TROLLEY_SECONDS));
  for(const c of s.chefs){const task=c.task,st=currentStation(task?.station);if(!task||!st)continue;if(!c.connected||!reach(c,st)||s.assists.prep==='hold'&&!heldPrep.has(c.id)){c.task=null;continue;}
   const item=task.kind==='extinguish'?s.items[c.held??'']:contents(st.id).find(i=>task.kind==='wash'?i.kind==='plate'&&i.dirty:i.kind==='ingredient'&&i.phase==='raw'&&INGREDIENTS[i.ingredient!].prepSeconds>0);
   if(!item){c.task=null;continue;}item.progress=round(item.progress+dt);
   const duration=task.kind==='extinguish'?TASK_SECONDS.extinguish:task.kind==='wash'?TASK_SECONDS.wash:INGREDIENTS[item.ingredient!].prepSeconds;
   if(item.progress>=duration){item.progress=0;c.task=null;if(task.kind==='extinguish'){delete s.fires[st.id];emit('feedback','Fire out. Bin the burnt food and start again.',c.id);}else if(task.kind==='wash'){item.dirty=false;put(item,currentStation(sid('plate'))!);emit('wash','Clean plate ready to reuse.',c.id);if(s.service==='first'&&s.served){tutorial(6);finish();}}else{item.phase='prepared';tutorial(3);emit('prepare',`${INGREDIENTS[item.ingredient!].label} chopped.`,c.id);}}
  }
  for(const item of Object.values(s.items)){
   const loc=item.location;
   if(loc.kind==='return'){loc.remaining=Math.max(0,round(loc.remaining-dt));if(loc.remaining===0)put(item,currentStation(sid('return'))!);}
   else if(loc.kind==='transit'){loc.remaining=Math.max(0,round(loc.remaining-dt));if(loc.remaining===0){const c=loc.chef===undefined?null:s.chefs.find(c=>c.id===loc.chef),st=currentStation(loc.station);if(c?.connected&&!c.held)take(c,item);else if(st&&put(item,st)){if(st.kind==='appliance')beginCooking(item,st);}else item.location={kind:'return',remaining:0};}}
   else if(loc.kind==='station'&&item.kind==='ingredient'){
    const st=currentStation(loc.station),cook=INGREDIENTS[item.ingredient!].cook;if(!st||st.kind!=='appliance'||!cook||!['cooking','ready','burnt'].includes(item.phase))continue;
    const before=item.cookElapsed;item.cookElapsed=round(before+dt);item.progress=Math.min(1,item.cookElapsed/cook.seconds);
    if(item.phase==='cooking'&&item.cookElapsed>=cook.seconds){item.phase='ready';tutorial(2);emit('ready',`${INGREDIENTS[item.ingredient!].label} ready at ${st.label}.`);}
    const warning=cook.seconds+cook.warning*s.assists.forgiveness,burn=cook.seconds+cook.burn*s.assists.forgiveness;
    if(before<warning&&item.cookElapsed>=warning)emit('warning',`${st.label}: collect the food before it burns.`);
    if(item.phase==='ready'&&item.cookElapsed>=burn){item.phase='burnt';emit('burn',`${st.label}: burnt food. Use the waste bin.`);}
    if(s.assists.hazards&&item.phase==='burnt'&&before<burn+8&&item.cookElapsed>=burn+8){s.fires[st.id]=1;emit('burn',`${st.label}: small contained fire. Bring the extinguisher.`);}
   }
  }
  if(s.phase!=='playing')return;
  for(const order of s.orders)if(order.status==='waiting'&&order.total>0){const before=order.remaining;order.remaining=Math.max(0,round(order.remaining-dt));if(before>order.total*.25&&order.remaining<=order.total*.25)emit('warning',`${RECIPES[order.recipe].label}: the order has a quarter of its patience left.`);if(order.remaining===0){order.status='missed';s.missed++;s.sequence=0;emit('miss',`${RECIPES[order.recipe].label} missed. The next order is a fresh chance.`);}}
  if(s.service!=='first'&&(s.elapsed>=s.nextOrderAt||!s.orders.some(o=>o.status==='waiting'))){addOrder();s.nextOrderAt=s.elapsed+SERVICES[s.service].interval*(s.players===1?1.45:1);}
  if(SERVICES[s.service].seconds&&s.remaining===0)finish();
 }
 function releaseChef(c:ChefState){const item=s.items[c.held??''];if(item){item.location={kind:'return',remaining:0};c.held=null;}c.task=null;heldPrep.delete(c.id);}
 const engine:KitchenEngine={
  state:()=>s,open(){if(s.phase==='idle'||s.phase==='results')s.phase='menu';},
  start(service,players,assists={}){if(!SERVICES[service]||![1,2].includes(players))return;const nextId=s.nextId+1,entryPose={...s.chefs[0]!.pose};s=empty(initialSeed);s.nextId=nextId;s.phase='ready';s.service=service;s.players=players;s.remaining=SERVICES[service].seconds;s.assists={...DEFAULT_ASSISTS,...(service==='practice'?{forgiveness:2,hazards:false}:{}),...assists};s.assists.forgiveness=finite(s.assists.forgiveness)?Math.max(.5,Math.min(5,s.assists.forgiveness)):DEFAULT_ASSISTS.forgiveness;s.assists.patience=finite(s.assists.patience)?Math.max(.5,Math.min(3,s.assists.patience)):DEFAULT_ASSISTS.patience;s.chefs=players===2?[chef(0),chef(1)]:[chef(0)];s.chefs[0]!.pose=entryPose;s.stationIds=STATIONS.filter(st=>st.area!=='deck'||service==='sunset').filter(st=>st.kind!=='trolley'||service==='banquet').map(st=>st.id);for(let i=0;i<(players===1?3:4);i++)put(newItem('plate'),currentStation(sid('plate'))!);put(newItem('extinguisher'),currentStation('yacht.kitchen.extinguisher')!);heldPrep.clear();remainder=0;},
  action:feedbackAction,
  setPose(id,pose){const c=s.chefs.find(c=>c.id===id);if(c&&poseValid(pose))c.pose={...pose};},
  setTarget(id,target){const c=s.chefs.find(c=>c.id===id),next=currentStation(target)?.id??null;if(c&&c.target!==next){c.target=next;c.selection=0;}},
  setPreparing(id,held){if(held)heldPrep.add(id);else{heldPrep.delete(id);if(s.assists.prep==='hold'){const c=s.chefs.find(c=>c.id===id);if(c)c.task=null;}}},
  update(seconds){if(s.phase!=='playing'||!finite(seconds)||seconds<=0)return;remainder+=Math.min(600,seconds);while(remainder>=.05-1e-9&&s.phase==='playing'){remainder-=.05;step(.05);}},
  pause(reason='Paused together.'){if(s.phase==='playing'){s.phase='paused';s.pauseReason=reason;heldPrep.clear();}},
  resume(){if(s.phase==='paused'){s.phase=s.orders.length?'playing':'ready';s.pauseReason=null;remainder=0;}},
  disconnect(id){const c=s.chefs.find(c=>c.id===id);if(!c)return;releaseChef(c);c.connected=false;engine.pause(`${c.label} disconnected. Reconnect or continue with one chef.`);},
  reconnect(id){const c=s.chefs.find(c=>c.id===id);if(c)c.connected=true;},
  leaveChef(id){const c=s.chefs.find(c=>c.id===id);if(!c)return;releaseChef(c);if(s.chefs.length===1){engine.exit();return;}s.chefs=s.chefs.filter(c=>c.id!==id);const remaining=s.chefs[0]!;if(remaining.id!==0){if(remaining.held)s.items[remaining.held]!.location={kind:'hands',chef:0};remaining.id=0;remaining.label='Chef 1';}s.players=1;s.nextOrderAt=Math.max(s.nextOrderAt,s.elapsed+SERVICES[s.service].interval*1.45);},
  exit(){const nextId=s.nextId;s=empty(initialSeed);s.nextId=nextId;remainder=0;heldPrep.clear();},
  snapshot:()=>clone(s),
  restore(value){if(!validSnapshot(value))return false;const candidate=clone(value);if(['ready','playing','paused'].includes(candidate.phase)){candidate.phase='paused';candidate.pauseReason='Interrupted service. Resume when both chefs are ready.';for(const c of candidate.chefs)c.task=null;}s=candidate;remainder=0;heldPrep.clear();return true;},
 };
 return engine;
}

/** Validate the complete ownership graph before installing an interrupted session. */
function validSnapshot(value:unknown):value is KitchenState{
 try{
  const s=value as KitchenState;if(!s||s.version!==1||!['idle','menu','ready','playing','paused','results'].includes(s.phase)||!SERVICES[s.service]||![1,2].includes(s.players)||!Array.isArray(s.chefs)||s.chefs.length!==s.players||!Array.isArray(s.orders)||!Array.isArray(s.stationIds)||!Array.isArray(s.events)||!s.items||typeof s.items!=='object'||!s.fires)return false;
  if(![s.seed,s.elapsed,s.remaining,s.score,s.served,s.missed,s.sequence,s.bestSequence,s.eventSeq,s.nextId,s.nextOrderAt,s.tutorial].every(n=>finite(n)&&n>=0)||!Number.isInteger(s.nextId)||s.nextId<1||s.elapsed>86400||s.orders.length>10000||Object.keys(s.items).length>10000)return false;
  if(!s.assists||![s.assists.forgiveness,s.assists.patience].every(n=>finite(n)&&n>=.5&&n<=5)||typeof s.assists.hazards!=='boolean'||!['normal','gentle'].includes(s.assists.warning)||!['hold','toggle'].includes(s.assists.prep))return false;
  if(!s.trolley||![0,1].includes(s.trolley.dock)||!finite(s.trolley.progress)||s.trolley.progress<0||s.trolley.progress>1||typeof s.trolley.secured!=='boolean')return false;
  const expected=STATIONS.filter(st=>st.area!=='deck'||s.service==='sunset').filter(st=>st.kind!=='trolley'||s.service==='banquet').map(st=>st.id);
  if(s.phase!=='idle'&&s.phase!=='menu'&&(s.stationIds.length!==expected.length||expected.some(id=>!s.stationIds.includes(id))))return false;
  if(new Set(s.stationIds).size!==s.stationIds.length||s.stationIds.some(id=>!STATIONS.some(st=>st.id===id)))return false;
  const stations=new Map(stationsFor(s).map(st=>[st.id,st])),locations=new Set<string>(),claimed=new Set<string>();
  const items=Object.values(s.items),plates=items.filter(i=>i.kind==='plate'),tools=items.filter(i=>i.kind==='extinguisher');
  if(!['idle','menu'].includes(s.phase)&&(plates.length<3||plates.length>4||tools.length!==1))return false;
  if(plates.some(i=>i.location?.kind==='discarded')||tools.some(i=>i.location?.kind==='discarded'))return false;
  for(const c of s.chefs){if(![0,1].includes(c.id)||claimed.has('chef'+c.id)||!poseValid(c.pose)||typeof c.connected!=='boolean'||typeof c.ready!=='boolean'||!Number.isInteger(c.selection)||c.selection<0||c.target!==null&&!stations.has(c.target))return false;claimed.add('chef'+c.id);if(c.task&&(!stations.has(c.task.station)||!['prepare','wash','extinguish'].includes(c.task.kind)))return false;if(c.held){const item=s.items[c.held];if(!item||item.location.kind!=='hands'||item.location.chef!==c.id)return false;}}
  for(const [id,item]of Object.entries(s.items)){
   if(!item||item.id!==id||!/^item-\d+$/.test(id)||Number(id.slice(5))>=s.nextId||!['ingredient','plate','extinguisher'].includes(item.kind)||!['raw','prepared','cooking','ready','burnt'].includes(item.phase)||![item.progress,item.cookElapsed].every(n=>finite(n)&&n>=0)||!Array.isArray(item.contents)||typeof item.dirty!=='boolean')return false;
   if(item.kind==='ingredient'&&!INGREDIENTS[item.ingredient!]||item.kind!=='plate'&&(item.contents.length||item.dirty)||item.kind==='plate'&&item.dirty&&item.contents.length)return false;
   if(item.kind!=='ingredient'&&(item.phase!=='raw'||item.ingredient!==undefined))return false;
   if(item.kind==='ingredient'){const rule=INGREDIENTS[item.ingredient!];if(item.phase==='prepared'&&!rule.prepSeconds||['cooking','ready','burnt'].includes(item.phase)&&!rule.cook)return false;}
   for(const part of item.contents){if(claimed.has(part))return false;claimed.add(part);const p=s.items[part];if(!p||p.kind!=='ingredient'||p.location.kind!=='container'||p.location.container!==id)return false;}
   if(item.kind==='plate'&&item.contents.length&&!Object.values(RECIPES).some(r=>matches(r,parts(item,s))))return false;
   const loc=item.location;if(!loc)return false;
   if(loc.kind==='hands'){if(s.chefs.find(c=>c.id===loc.chef)?.held!==id)return false;}
   else if(loc.kind==='station'){const st=stations.get(loc.station),key=loc.station+':'+loc.slot;if(!st||!Number.isInteger(loc.slot)||loc.slot<0||loc.slot>=st.capacity||locations.has(key))return false;if(item.phase==='cooking'&&(st.kind!=='appliance'||!st.appliances?.includes(INGREDIENTS[item.ingredient!].cook?.appliance??'')))return false;locations.add(key);}
   else if(loc.kind==='container'){const plate=s.items[loc.container];if(!plate||plate.kind!=='plate'||!plate.contents.includes(id))return false;}
   else if(loc.kind==='return'){if(!finite(loc.remaining)||loc.remaining<0||loc.remaining>60)return false;}
   else if(loc.kind==='transit'){if(item.kind!=='ingredient'||!['raw','prepared'].includes(item.phase)||!finite(loc.remaining)||loc.remaining<0||loc.remaining>1||![loc.from.x,loc.from.y,loc.from.z,loc.to.x,loc.to.y,loc.to.z].every(finite)||distance(loc.from,loc.to)>6||(loc.station===undefined)===(loc.chef===undefined)||loc.station!==undefined&&!stations.has(loc.station)||loc.chef!==undefined&&!s.chefs.some(c=>c.id===loc.chef))return false;const key='transit:'+(loc.station??loc.chef);if(locations.has(key))return false;locations.add(key);}
   else if(loc.kind!=='discarded')return false;
  }
  const orderIds=new Set<string>();for(const o of s.orders){if(!o||!RECIPES[o.recipe]||!SERVICES[s.service].recipes.includes(o.recipe)||orderIds.has(o.id)||![o.remaining,o.total].every(n=>finite(n)&&n>=0)||o.remaining>o.total||!['waiting','served','missed'].includes(o.status))return false;orderIds.add(o.id);}
  if(s.served!==s.orders.filter(o=>o.status==='served').length||s.missed!==s.orders.filter(o=>o.status==='missed').length)return false;
  for(const [id,n]of Object.entries(s.fires))if(stations.get(id)?.kind!=='appliance'||!finite(n)||n<=0)return false;
  if(s.events.length>32||s.events.some((e,i)=>!Number.isInteger(e.seq)||e.seq<=0||e.seq>s.eventSeq||i>0&&e.seq<=s.events[i-1]!.seq||typeof e.message!=='string'))return false;
  if(s.phase==='results'&&!s.result||s.result&&(s.result.service!==s.service||s.result.score!==s.score||s.result.served!==s.served||s.result.missed!==s.missed||s.result.bestSequence!==s.bestSequence||s.result.players!==s.players||!Number.isInteger(s.result.stars)||s.result.stars<0||s.result.stars>3||!s.result.id||!Array.isArray(s.result.recipes)||s.result.recipes.some(id=>!RECIPES[id])))return false;
  return true;
 }catch{return false;}
}
