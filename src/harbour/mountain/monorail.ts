import {MONORAIL_STOPS,transportPoint,type Point3} from './definition.ts';

export type MonorailPhase='doors-open'|'doors-closing'|'moving';
export type MonorailView='window'|'front'|'outside';
export type MonorailState={
  station:number;next:number;queue:number[];phase:MonorailPhase;progress:number;speed:number;
  dwell:number;paused:boolean;brake:boolean;throttle:0.5|1|1.5;seated:boolean;companion:boolean;view:MonorailView;
};
const valid=(n:number)=>Number.isInteger(n)&&n>=0&&n<MONORAIL_STOPS.length;
const segmentLength=(a:number,b:number)=>{
  let total=0,previous=transportPoint('monorail',a,b,0);
  for(let i=1;i<=20;i++){const point=transportPoint('monorail',a,b,i/20);total+=Math.hypot(point[0]-previous[0],point[1]-previous[1],point[2]-previous[2]);previous=point;}
  return total;
};
const lengths=MONORAIL_STOPS.slice(1).map((_,i)=>segmentLength(i,i+1));
export function monorailOrder(station:number,queue:readonly number[]):number[]{
  const unique=[...new Set(queue.filter(n=>valid(n)&&n!==station))];
  if(!unique.length)return [];
  const first=unique[0]!,direction=Math.sign(first-station);
  const ahead=unique.filter(n=>(n-station)*direction>0).sort((a,b)=>(a-b)*direction);
  const behind=unique.filter(n=>(n-station)*direction<0).sort((a,b)=>(b-a)*direction);
  return [...ahead,...behind];
}
export function boardMonorail(station:number,companion=false):MonorailState{
  const start=valid(station)?station:0;
  return {station:start,next:start,queue:[],phase:'doors-open',progress:0,speed:0,dwell:0,paused:false,brake:false,throttle:1,seated:false,companion,view:'window'};
}
export function selectMonorailStop(state:MonorailState,stop:number):MonorailState{
  if(!valid(stop)||stop===state.station&&state.phase==='doors-open')return state;
  const queue=state.queue.includes(stop)?state.queue.filter(n=>n!==stop):[...state.queue,stop];
  // Preserve the moving direction until the car reaches the next platform.
  const origin=state.phase==='moving'?state.next:state.station;
  const direction=state.phase==='moving'?Math.sign(state.next-state.station):undefined;
  const ordered=direction===undefined?monorailOrder(origin,queue):[
    ...queue.filter(n=>(n-origin)*direction>=0).sort((a,b)=>(a-b)*direction),
    ...queue.filter(n=>(n-origin)*direction<0).sort((a,b)=>(b-a)*direction),
  ];
  return {...state,queue:ordered,dwell:state.phase==='doors-open'&&ordered.length?Math.max(state.dwell,1.5):state.dwell};
}
export function monorailPosition(state:MonorailState):Point3{
  return state.phase==='moving'?transportPoint('monorail',state.station,state.next,state.progress):MONORAIL_STOPS[state.station]!.at;
}
/** A fixed, deterministic train clock. The car stops only at selected floors and brakes before each platform. */
export function advanceMonorail(state:MonorailState,seconds:number):MonorailState{
  if(state.paused||!Number.isFinite(seconds)||seconds<=0)return state;
  const dt=Math.min(seconds,.1);
  if(state.phase==='doors-open'){
    if(!state.queue.length)return state;
    const dwell=state.dwell-dt;
    return dwell>0?{...state,dwell}:{...state,phase:'doors-closing',dwell:.9};
  }
  if(state.phase==='doors-closing'){
    const dwell=state.dwell-dt;
    if(dwell>0)return {...state,dwell};
    const target=state.queue[0]!;
    return {...state,phase:'moving',next:state.station+Math.sign(target-state.station),progress:0,speed:0,dwell:0};
  }
  const length=lengths[Math.min(state.station,state.next)]??1;
  const remaining=(1-state.progress)*length;
  const maxSpeed=12*state.throttle;
  const braking=Math.sqrt(Math.max(0,remaining)*8);
  const desired=state.brake?0:Math.min(maxSpeed,braking);
  const speed=Math.max(0,Math.min(maxSpeed,state.speed+Math.max(-(state.brake?6:4)*dt,Math.min(3*dt,desired-state.speed))));
  const progress=remaining<.08&&!state.brake?1:Math.min(1,state.progress+speed*dt/length);
  if(progress<1)return {...state,progress,speed};
  const station=state.next,queue=state.queue.filter(n=>n!==station);
  if(state.queue.includes(station)||!queue.length)return {...state,station,next:station,queue,phase:'doors-open',progress:0,speed:0,dwell:queue.length?3:0};
  return {...state,station,next:station+Math.sign(queue[0]!-station),queue,progress:0,speed:Math.min(speed,7)};
}
