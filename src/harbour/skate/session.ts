import {SKATE_DECKS,SKATE_ROUTES,SKATE_SPOTS,type SkateDeckId,type SkateRouteId} from './park.ts';
import type {SkateState} from './skateModel.ts';

export type SkateProgress={version:1;deck:SkateDeckId;discovered:string[];bestLine:number;routeBest:Partial<Record<SkateRouteId,number>>;stamps:string[]};
export const freshSkateProgress=():SkateProgress=>({version:1,deck:'tideline',discovered:[],bestLine:0,routeBest:{},stamps:[]});
export const SKATE_STAMPS=[
  {id:'first-landing',name:'Wheels down',hint:'Land your first ollie.'},
  {id:'flip',name:'Turn it over',hint:'Land a flip trick and bank the line.'},
  {id:'grind',name:'Find the groove',hint:'Grind a rail and bank the line.'},
  {id:'manual',name:'Two wheels',hint:'Link a manual into a banked line.'},
  {id:'line',name:'A line of your own',hint:'Bank a 2,000-point combo.'},
  {id:'explorer',name:'Island wheels',hint:'Discover all six skate spots.'},
] as const;
export function skateProgressKey(environment:string,householdId:string,memberId:string):string {
  return `hearth.harbour.skate.v1:${[environment,householdId,memberId].map(encodeURIComponent).join(':')}`;
}
export function decodeSkateProgress(raw:string|null):SkateProgress {
  const fresh=freshSkateProgress();
  try{
    if(!raw||raw.length>8000)return fresh;
    const p=JSON.parse(raw);if(!p||p.version!==1)return fresh;
    fresh.discovered=SKATE_SPOTS.filter(s=>Array.isArray(p.discovered)&&p.discovered.includes(s.id)).map(s=>s.id);
    fresh.stamps=SKATE_STAMPS.filter(s=>Array.isArray(p.stamps)&&p.stamps.includes(s.id)).map(s=>s.id);
    fresh.bestLine=Number.isSafeInteger(p.bestLine)&&p.bestLine>=0&&p.bestLine<=1e9?p.bestLine:0;
    const deck=SKATE_DECKS.find(d=>d.id===p.deck&&d.discoveries<=fresh.discovered.length);if(deck)fresh.deck=deck.id;
    for(const r of SKATE_ROUTES){const v=p.routeBest?.[r.id];if(typeof v==='number'&&Number.isFinite(v)&&v>=1&&v<=3600)fresh.routeBest[r.id]=v;}
  }catch{/* An unavailable or corrupt device save starts a playable session. */}
  return fresh;
}
export function readSkateProgress(store:Pick<Storage,'getItem'>,key:string):SkateProgress {try{return decodeSkateProgress(store.getItem(key));}catch{return freshSkateProgress();}}
export function saveSkateProgress(store:Pick<Storage,'setItem'>,key:string,progress:SkateProgress):boolean {try{store.setItem(key,JSON.stringify(progress));return true;}catch{return false;}}
export type SkateRun={id:SkateRouteId;checkpoint:number;elapsed:number;countdown:number;finished:boolean;medal:string|null};
export type SkateSession={progress:SkateProgress;run:SkateRun|null;message:string;revision:number;lastEvent:number;lineTags:string[]};
export const createSkateSession=(progress=freshSkateProgress()):SkateSession=>({progress,run:null,message:'Your island. Your line.',revision:0,lastEvent:0,lineTags:[]});
export function startSkateRoute(session:SkateSession,id:SkateRouteId):void {
  session.run={id,checkpoint:1,elapsed:0,countdown:3,finished:false,medal:null};session.message='Ready at the start · 3, 2, 1';session.lineTags=[];
}
export function skateMedal(id:SkateRouteId,seconds:number):string {
  const r=SKATE_ROUTES.find(r=>r.id===id)!;return seconds<=r.seconds[0]?'Gold':seconds<=r.seconds[1]?'Silver':seconds<=r.seconds[2]?'Bronze':'Finished';
}
export function stepSkateSession(session:SkateSession,s:SkateState,dt:number):void {
  const before=JSON.stringify(session.progress),p=session.progress;
  for(const spot of SKATE_SPOTS){if(!p.discovered.includes(spot.id)&&Math.abs(s.x-spot.x)<=spot.halfWidth&&Math.abs(s.z-spot.z)<=spot.halfDepth){p.discovered=[...p.discovered,spot.id];session.message=`Discovered ${spot.name} · ${p.discovered.length} / ${SKATE_SPOTS.length}`;}}
  if(s.event.id!==session.lastEvent){
    session.lastEvent=s.event.id;
    if(s.event.kind==='trick'||s.event.kind==='grind')session.lineTags=[...new Set([...session.lineTags,s.event.text])];
    if(s.event.kind==='bail')session.lineTags=[];
    if(s.event.kind==='bank'){
      const award=(id:string)=>{if(!p.stamps.includes(id))p.stamps=[...p.stamps,id];};
      if(s.landings>0)award('first-landing');
      if(session.lineTags.some(t=>/flip/i.test(t)))award('flip');
      if(session.lineTags.some(t=>/grind|flatbar|rail|ledge/i.test(t)))award('grind');
      if(session.lineTags.includes('Manual'))award('manual');
      if(s.event.points>=2000)award('line');
      session.lineTags=[];
    }
  }
  // Model combo tags cover multiple physics events occurring inside one visual frame.
  if(s.comboTricks.length)session.lineTags=[...new Set([...session.lineTags,...s.comboTricks])];
  p.bestLine=Math.max(p.bestLine,s.best);
  if(p.discovered.length===SKATE_SPOTS.length&&!p.stamps.includes('explorer'))p.stamps=[...p.stamps,'explorer'];
  const run=session.run;
  if(run&&!run.finished){
    if(run.countdown>0){run.countdown=Math.max(0,run.countdown-Math.min(.1,Math.max(0,dt)));if(run.countdown===0)session.message='Go · find the first gold ring';}
    else{
      run.elapsed+=Math.min(.1,Math.max(0,dt));
      const route=SKATE_ROUTES.find(r=>r.id===run.id)!,target=route.points[run.checkpoint];
      if(target&&s.mode!=='bail'&&Math.hypot(s.x-target[0],s.z-target[1])<2.8){
        run.checkpoint++;
        if(run.checkpoint>=route.points.length){
          run.finished=true;run.medal=skateMedal(run.id,run.elapsed);
          p.routeBest={...p.routeBest,[run.id]:Math.min(p.routeBest[run.id]??Infinity,run.elapsed)};
          session.message=`${route.name} · ${run.medal} · ${run.elapsed.toFixed(1)}s`;
        }else session.message=`Checkpoint ${run.checkpoint} / ${route.points.length-1}`;
      }
    }
  }
  if(before!==JSON.stringify(p))session.revision++;
}
export type SkateSnapshot={active:boolean;paused:boolean;speed:number;mode:SkateState['mode'];combo:number;multiplier:number;comboTime:number;score:number;best:number;balance:number;balancing:boolean;tricks:string[];event:string;eventId:number;eventKind:string;x:number;z:number;yaw:number;progress:SkateProgress;run:SkateRun|null;message:string;revision:number};
export function skateSnapshot(s:SkateState,session:SkateSession,paused=false):SkateSnapshot {
  return {active:true,paused,speed:s.speed,mode:s.mode,combo:Math.round(s.combo),multiplier:s.multiplier,comboTime:Math.max(0,1-s.comboAge/2.4),score:s.score,best:s.best,balance:s.balance,balancing:s.mode==='grind'||s.manualTime>0,tricks:s.comboTricks,event:s.event.text,eventId:s.event.id,eventKind:s.event.kind,x:s.x,z:s.z,yaw:s.yaw,
    progress:{...session.progress,discovered:[...session.progress.discovered],stamps:[...session.progress.stamps],routeBest:{...session.progress.routeBest}},run:session.run?{...session.run}:null,message:session.message,revision:session.revision};
}
