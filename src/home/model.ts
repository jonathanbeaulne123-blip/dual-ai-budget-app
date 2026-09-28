import {BLUEPRINTS,FURNITURE,FINISHES,ROOFS,blueprint,furnishing,type Family} from './catalogue.ts';
export type Quarter=0|1|2|3;
export type HomeRoom={id:string;blueprintId:string;name:string;x:number;z:number;floor:0|1;rotation:Quarter;stored:boolean;finish:string;roof:typeof ROOFS[number]};
export type HomeObject={id:string;catalogueId:string;roomId:string|null;x:number;z:number;rotation:Quarter;stored:boolean;variant:string;supportId?:string;display?:{kind:'piece'|'memory';id:string;revision:number;designId?:string}};
export type HomeLayout={rooms:HomeRoom[];objects:HomeObject[]};
export type HomeAward={id:Family;grantedAt:string};
export type HomeArrangement={id:string;name:string;objects:HomeObject[]};
export type HomeState={version:1;revision:number;layout:HomeLayout;future:HomeLayout|null;pinned:string|null;awards:HomeAward[];arrangements:HomeArrangement[];history:{revision:number;at:string;layout:HomeLayout}[]};
/** Metres in the home's own coordinate system. The front access strip is always clear. */
export const HOME_PLOT={minX:-26,maxX:26,minZ:-16,maxZ:16,frontAccess:{x:0,z:18,width:3,depth:14}};
export const FLOOR_HEIGHT=3.2;
export const clone=<T,>(v:T):T=>structuredClone(v);
export const starterLayout=():HomeLayout=>({rooms:[{id:'home',blueprintId:'cottage',name:'My home',x:0,z:0,floor:0,rotation:0,stored:false,finish:'hearth',roof:'gable'}],objects:[{id:'welcome-bench',catalogueId:'bench',roomId:'home',x:-5,z:5,rotation:0,stored:false,variant:'hearth'},{id:'welcome-table',catalogueId:'coffee-table',roomId:'home',x:4,z:4,rotation:0,stored:false,variant:'hearth'},{id:'welcome-fern',catalogueId:'fern',roomId:'home',x:-7,z:-5,rotation:0,stored:false,variant:'hearth'}]});
export const starterHome=():HomeState=>({version:1,revision:0,layout:starterLayout(),future:null,pinned:null,awards:[],arrangements:[],history:[]});
export type Rect={x:number;z:number;width:number;depth:number};
export function roomRect(room:HomeRoom):Rect{const b=blueprint(room.blueprintId);return{x:room.x,z:room.z,width:room.rotation%2?b.depth:b.width,depth:room.rotation%2?b.width:b.depth};}
export function overlap(a:Rect,b:Rect,margin=0){return Math.abs(a.x-b.x)<(a.width+b.width)/2+margin-.001&&Math.abs(a.z-b.z)<(a.depth+b.depth)/2+margin-.001;}
export function contains(a:Rect,b:Rect,margin=0){return Math.abs(a.x-b.x)+b.width/2<=a.width/2-margin+.001&&Math.abs(a.z-b.z)+b.depth/2<=a.depth/2-margin+.001;}
export function joint(a:HomeRoom,b:HomeRoom):{axis:'x'|'z';at:number;from:number;to:number}|null{
 if(a.floor!==b.floor||a.stored||b.stored)return null;const ar=roomRect(a),br=roomRect(b);
 for(const axis of ['x','z'] as const){const cross=axis==='x'?'z':'x',size=axis==='x'?'width':'depth',cs=axis==='x'?'depth':'width';
  if(Math.abs(Math.abs(ar[axis]-br[axis])-(ar[size]+br[size])/2)>.01)continue;
  const from=Math.max(ar[cross]-ar[cs]/2,br[cross]-br[cs]/2),to=Math.min(ar[cross]+ar[cs]/2,br[cross]+br[cs]/2);
  if(to-from>=2)return{axis,at:ar[axis]+Math.sign(br[axis]-ar[axis])*ar[size]/2,from,to};
 }return null;
}
export function objectRect(o:HomeObject):Rect{const f=furnishing(o.catalogueId);return{x:o.x,z:o.z,width:o.rotation%2?f.depth:f.width,depth:o.rotation%2?f.width:f.depth};}
export function worldObject(o:HomeObject,layout:HomeLayout):Rect{const r=layout.rooms.find(r=>r.id===o.roomId),p=o.supportId?layout.objects.find(p=>p.id===o.supportId):undefined;const pa=(p?.rotation??0)*Math.PI/2,angle=(r?.rotation??0)*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle),x=o.x*Math.cos(pa)+o.z*Math.sin(pa)+(p?.x??0),z=-o.x*Math.sin(pa)+o.z*Math.cos(pa)+(p?.z??0),rect=objectRect({...o,rotation:((o.rotation+(p?.rotation??0)+(r?.rotation??0))%4) as Quarter});return{x:(r?.x??0)+x*c+z*s,z:(r?.z??0)-x*s+z*c,width:rect.width,depth:rect.depth};}
export function visibleObject(o:HomeObject,layout:HomeLayout){return !o.stored&&(!o.roomId||layout.rooms.some(r=>r.id===o.roomId&&!r.stored))&&(!o.supportId||layout.objects.some(p=>p.id===o.supportId&&!p.stored));}
export function layoutIssues(layout:HomeLayout):string[]{
 const errors:string[]=[],rooms=layout.rooms.filter(r=>!r.stored),home=rooms.find(r=>r.id==='home');
 if(!home||home.blueprintId!=='cottage'||home.x!==0||home.z!==0||home.floor!==0||home.rotation!==0)errors.push('Keep the original cottage and its entrance in place.');
 const plot={x:0,z:0,width:52,depth:32};
 for(const r of rooms){const rect=roomRect(r),b=blueprint(r.blueprintId);
  if(!contains(plot,rect,.5))errors.push(`${r.name}: stay inside the home plot.`);
  if(r.id!=='home'&&overlap(rect,HOME_PLOT.frontAccess))errors.push(`${r.name}: leave the main approach clear.`);
  if(b.upper&&r.floor!==1)errors.push(`${r.name}: this blueprint belongs upstairs.`);
  if(r.floor===1){const support=rooms.find(p=>p.floor===0&&contains(roomRect(p),rect)&&!['porch','pergola','terrace','balcony'].includes(blueprint(p.blueprintId).kind));if(!support)errors.push(`${r.name}: needs a complete room below and its stair opening.`);}
  for(const other of rooms){if(other.id<=r.id||other.floor!==r.floor)continue;if(overlap(rect,roomRect(other)))errors.push(`${r.name} overlaps ${other.name}.`);}
 }
 const connected=new Set(['home']);let changed=true;
 while(changed){changed=false;for(const r of rooms){if(connected.has(r.id))continue;const b=blueprint(r.blueprintId);if(b.kind==='outbuilding'||b.kind==='pergola'||b.kind==='terrace'||rooms.some(p=>connected.has(p.id)&&(joint(r,p)||r.floor===1&&p.floor===0&&contains(roomRect(p),roomRect(r))))){connected.add(r.id);changed=true;}}}
 for(const r of rooms)if(!connected.has(r.id))errors.push(`${r.name}: snap to a room with at least a two-metre doorway.`);
 for(const o of layout.objects){const def=furnishing(o.catalogueId);if(o.roomId&&!layout.rooms.some(r=>r.id===o.roomId))errors.push('A furnishing has lost its room. Store it before replacing the room.');if(!visibleObject(o,layout))continue;
  const room=rooms.find(r=>r.id===o.roomId),rect=worldObject(o,layout);
  if(o.supportId){const support=layout.objects.find(p=>p.id===o.supportId);if(!support||support.supportId||support.roomId!==o.roomId||!furnishing(support.catalogueId).surface||!contains(worldObject(support,layout),rect))errors.push(`${def.name}: choose a large enough display surface in this room.`);}
  else if(room){if(!contains(roomRect(room),rect,.25))errors.push(`${def.name}: keep it inside ${room.name}.`);
   if(room.blueprintId==='conservatory'&&overlap(rect,{x:room.x-roomRect(room).width/2+1.5,z:room.z-roomRect(room).depth/2+1.5,width:2,depth:2}))errors.push(`${def.name}: leave Mandevilla’s botanical corner clear.`);
   // A cross-shaped clear aisle joins every doorway, including the original front door.
   if(!['rug','art','curtain'].includes(def.shape)&&(Math.abs(rect.x-room.x)<rect.width/2+1||Math.abs(rect.z-room.z)<rect.depth/2+1))errors.push(`${def.name}: leave the central door-to-door aisle clear.`);
   // The stair flight occupies the back-left corner of any room supporting an upper room.
   if(rooms.some(up=>up.floor===1&&(up.id===room.id||room.floor===0&&contains(roomRect(room),roomRect(up)))&&overlap(rect,{x:up.x-roomRect(up).width/2+1.35,z:up.z-roomRect(up).depth/2+2.75,width:2.2,depth:5.4})))errors.push(`${def.name}: keep the stair flight clear.`);
  }else if(!contains(plot,rect,.5)||overlap(rect,HOME_PLOT.frontAccess)||rooms.some(r=>r.floor===0&&overlap(roomRect(r),rect)))errors.push(`${def.name}: choose open garden ground inside the plot.`);
 }
 for(const o of layout.objects){if(!visibleObject(o,layout)||o.supportId||['rug','art','curtain','path'].includes(furnishing(o.catalogueId).shape))continue;for(const other of layout.objects){if(other.id<=o.id||!visibleObject(other,layout)||other.supportId||other.roomId!==o.roomId||['rug','art','curtain','path'].includes(furnishing(other.catalogueId).shape))continue;if(overlap(worldObject(o,layout),worldObject(other,layout)))errors.push(`${furnishing(o.catalogueId).name} overlaps ${furnishing(other.catalogueId).name}.`);}}
 return [...new Set(errors)];
}
const fail=(text:string):never=>{throw Error(`HOME_INVALID: ${text}`);};
const record=(v:unknown,keys:string[])=>{if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!keys.includes(k)||!('value'in Object.getOwnPropertyDescriptor(v,k)!)))fail('Unsupported fields.');return v as Record<string,unknown>;};
const str=(v:unknown,max=160)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u001f]/.test(v))fail('Invalid text.');return v as string;};
const id=(v:unknown)=>{const s=str(v);if(!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(s)||['__proto__','constructor','prototype'].includes(s))fail('Invalid identity.');return s;};
const num=(v:unknown,min:number,max:number,step=1)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||Math.abs(v/step-Math.round(v/step))>.00001)fail('Invalid coordinate.');return v as number;};
const bool=(v:unknown)=>{if(typeof v!=='boolean')fail('Invalid visibility.');return v as boolean;};
const array=<T,>(v:unknown,max:number,fn:(v:unknown)=>T)=>{if(!Array.isArray(v)||v.length>max||v.some((_,i)=>!Object.hasOwn(v,i)))fail('Invalid collection.');return Array.from(v as unknown[],fn);};
const unique=<T extends {id:string}>(v:T[])=>{if(new Set(v.map(r=>r.id)).size!==v.length)fail('Duplicate identity.');return v;};
const choose=(v:unknown,ids:readonly string[])=>{const s=str(v);if(!ids.includes(s))fail('Unknown catalogue option.');return s;};
export function decodeLayout(v:unknown,validate=true):HomeLayout{const r=record(v,['rooms','objects']);const layout:HomeLayout={rooms:unique(array(r.rooms,40,v=>{const r=record(v,['id','blueprintId','name','x','z','floor','rotation','stored','finish','roof']);return{id:id(r.id),blueprintId:choose(r.blueprintId,BLUEPRINTS.map(b=>b.id)),name:str(r.name,80),x:num(r.x,-27,27),z:num(r.z,-23,23),floor:num(r.floor,0,1) as 0|1,rotation:num(r.rotation,0,3) as Quarter,stored:bool(r.stored),finish:choose(r.finish,FINISHES.map(f=>f.id)),roof:choose(r.roof,ROOFS) as HomeRoom['roof']};})),objects:unique(array(r.objects,400,v=>{const r=record(v,['id','catalogueId','roomId','x','z','rotation','stored','variant','supportId','display']);const o:HomeObject={id:id(r.id),catalogueId:choose(r.catalogueId,FURNITURE.map(f=>f.id)),roomId:r.roomId===null?null:id(r.roomId),x:num(r.x,-27,27,.25),z:num(r.z,-23,23,.25),rotation:num(r.rotation,0,3) as Quarter,stored:bool(r.stored),variant:choose(r.variant,FINISHES.map(f=>f.id))};if(r.supportId!==undefined)o.supportId=id(r.supportId);if(r.display!==undefined){const d=record(r.display,['kind','id','revision','designId']);o.display={kind:choose(d.kind,['piece','memory']) as 'piece'|'memory',id:id(d.id),revision:num(d.revision,1,Number.MAX_SAFE_INTEGER),...(d.designId!==undefined?{designId:id(d.designId)}:{})};if(o.display.kind==='piece'&&!o.display.designId)fail('A pottery display needs its original design.');if(!furnishing(o.catalogueId).surface)fail('Choose a display surface.');}return o;}))};if(validate){const issues=layoutIssues(layout);if(issues.length)fail(issues[0]!);}return layout;}
export function decodeHome(v:unknown):HomeState{if(v===undefined)return starterHome();const r=record(v,['version','revision','layout','future','pinned','awards','arrangements','history']);if(r.version!==1)fail('This home needs a newer Hearth version. Your saved original is retained.');return{version:1,revision:num(r.revision,0,Number.MAX_SAFE_INTEGER),layout:decodeLayout(r.layout),future:r.future===null?null:decodeLayout(r.future),pinned:r.pinned===null?null:choose(r.pinned,BLUEPRINTS.map(b=>b.id)),awards:unique(array(r.awards,20,v=>{const a=record(v,['id','grantedAt']);return{id:choose(a.id,['established','reading','garden','hosting','workshop','architecture','sanctuary','gallery']) as Family,grantedAt:str(a.grantedAt,40)};})),arrangements:unique(array(r.arrangements,20,v=>{const a=record(v,['id','name','objects']);return{id:id(a.id),name:str(a.name,80),objects:decodeLayout({rooms:starterLayout().rooms,objects:a.objects},false).objects};})),history:array(r.history,12,v=>{const h=record(v,['revision','at','layout']);return{revision:num(h.revision,0,Number.MAX_SAFE_INTEGER),at:str(h.at,40),layout:decodeLayout(h.layout)};})};}
export function allowedFamilies(home:HomeState){return new Set<Family>(['starter',...home.awards.map(a=>a.id)]);}
export function snapRoom(layout:HomeLayout,blueprintId:string,idValue:string):HomeRoom{
 const b=blueprint(blueprintId),r:HomeRoom={id:idValue,blueprintId,name:b.name,x:0,z:0,floor:b.upper?1:0,rotation:0,stored:false,finish:'hearth',roof:b.kind==='greenhouse'?'glass':'gable'};
 const candidates:HomeRoom[]=[];
 if(b.upper)candidates.push({...r,x:0,z:0});
 else for(const p of layout.rooms.filter(r=>!r.stored&&r.floor===0)){const a=roomRect(p);for(const [x,z] of [[p.x+a.width/2+b.width/2,p.z],[p.x-a.width/2-b.width/2,p.z],[p.x,p.z-a.depth/2-b.depth/2],[p.x,p.z+a.depth/2+b.depth/2]])candidates.push({...r,x:x!,z:z!});}
 if(['outbuilding','pergola','terrace'].includes(b.kind))for(const x of [-19,19])for(const z of [-10,10])candidates.push({...r,x,z});
 return candidates.find(c=>layoutIssues({...layout,rooms:[...layout.rooms,c]}).length===0)??{...r,stored:true};
}
/** Exports are allowlisted geometry only: no member IDs, notes, evidence, history or pottery identities. */
export function exportBlueprint(layout:HomeLayout){return{format:'hearth-home-blueprint',version:1,layout:{rooms:clone(layout.rooms).map(r=>({...r,name:blueprint(r.blueprintId).name})),objects:clone(layout.objects).map(({display:_display,...o})=>o)}};}

/** Find a clear quarter-metre placement without moving existing possessions. */
export function snapObject(layout:HomeLayout,object:HomeObject):HomeObject{
 const room=layout.rooms.find(r=>r.id===object.roomId),b=room?blueprint(room.blueprintId):null;
 const xs=b?[-b.width/2+1,b.width/2-1]:[-23,-20,20,23],zs=b?[-b.depth/2+1,b.depth/2-1]:[-13,-10,10,13];
 const candidates=[object];for(const x of xs)for(const z of zs)candidates.push({...object,x:Math.round(x*4)/4,z:Math.round(z*4)/4});
 if(b)for(let x=-b.width/2+1;x<b.width/2-1;x+=1.25)for(let z=-b.depth/2+1;z<b.depth/2-1;z+=1.25)candidates.push({...object,x,z});
 return candidates.find(c=>!layoutIssues({...layout,objects:[...layout.objects,c]}).length)??{...object,stored:true};
}
