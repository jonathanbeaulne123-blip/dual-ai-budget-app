/** Explicit local measurement only. No account, position or identity is collected. */
export type FrameResources = {calls:number;geometries:number;textures:number};
export type FrameStudy = {
  version:1; label:string; recording:boolean; samples:number; capped:boolean;
  elapsedMs:number; paintedFps:number|null; p50Ms:number|null;p95Ms:number|null;p99Ms:number|null;
  over33msPercent:number|null; cpuP95Ms:number|null; interruptions:number;
  first:FrameResources|null;last:FrameResources|null;peak:FrameResources|null;
  note:string;
};
const LIMIT=18_000;
const percentile=(values:number[],p:number)=>values.length?values.slice().sort((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*p)-1)]!:null;
export function createFrameStudy(){
  let recording=false,label='',previous:number|null=null,intervals:number[]=[],cpu:number[]=[],interruptions=0,capped=false;
  let first:FrameResources|null=null,last:FrameResources|null=null,peak:FrameResources|null=null;
  const snapshot=():FrameStudy=>{
    const elapsedMs=intervals.reduce((a,b)=>a+b,0);
    return {version:1,label,recording,samples:intervals.length,capped,elapsedMs,
      paintedFps:elapsedMs>0?intervals.length*1000/elapsedMs:null,p50Ms:percentile(intervals,.5),p95Ms:percentile(intervals,.95),p99Ms:percentile(intervals,.99),
      over33msPercent:intervals.length?100*intervals.filter(n=>n>1000/30+.5).length/intervals.length:null,cpuP95Ms:percentile(cpu,.95),interruptions,
      first:first&&{...first},last:last&&{...last},peak:peak&&{...peak},
      note:'Painted-frame intervals during this manual capture; not GPU timings. Resource values are object counts, not GPU bytes. Record the physical device separately. Hidden/suspended/tool intervals interrupt capture; an interrupted or capped capture is not continuous traversal proof.'};
  };
  return {
    start(name:string){label=name.trim().slice(0,80)||'Traversal';recording=true;previous=null;intervals=[];cpu=[];interruptions=0;capped=false;first=last=peak=null;return snapshot();},
    frame(now:number,cpuMs:number,resources:FrameResources){
      if(!recording||!Number.isFinite(now)||!Number.isFinite(cpuMs)||cpuMs<0)return;
      if(previous!==null){const gap=now-previous;if(gap<=0)return;intervals.push(gap);cpu.push(cpuMs);}
      previous=now;last={...resources};first??={...resources};peak={calls:Math.max(peak?.calls??0,resources.calls),geometries:Math.max(peak?.geometries??0,resources.geometries),textures:Math.max(peak?.textures??0,resources.textures)};
      if(intervals.length>=LIMIT){recording=false;capped=true;}
    },
    interrupt(){if(recording&&previous!==null){interruptions++;previous=null;}},
    stop(){recording=false;previous=null;return snapshot();},
    snapshot,
  };
}
