/** Bounded recreational recordings. Stored only in the existing identity-scoped device save. */
import {crossesRaceGate, type RaceGate} from '../mountain/race.ts';
import type {Point3} from '../mountain/definition.ts';

export type ReplayCourse = {id:string; revision?:string|number; points:readonly (readonly [number,number])[]; gates?:readonly RaceGate[]};
/** Seconds, position, board yaw. No identity, ledger, input stream or presence data. */
export type ReplaySample = readonly [number,number,number,number,number];
export type RaceReplay = {version:1; course:string; signature:string; seconds:number; samples:ReplaySample[]};
export type GhostPose = {x:number;y:number;z:number;yaw:number;mode:'race'|'replay'};
export type ReplayAction = 'play'|'stop'|'toggle-ghost';
export const REPLAY_MAX_SAMPLES=2000, REPLAY_MAX_SECONDS=300, REPLAY_SAMPLE_SECONDS=.2;
const position=(s:ReplaySample):Point3=>[s[1],s[2],s[3]];
/** Includes actual ordered gate geometry; a course edit cannot silently reuse an old run. */
export function courseSignature(course:ReplayCourse):string {
  const text=JSON.stringify([course.id,course.revision??0,course.points,course.gates??[]]);
  let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
  return `race-1-${(hash>>>0).toString(16)}`;
}
export function decodeRaceReplay(value:unknown,course:ReplayCourse):RaceReplay|null {
  if(!value||typeof value!=='object'||!course.gates?.length)return null;
  const r=value as RaceReplay;
  if(r.version!==1||r.course!==course.id||r.signature!==courseSignature(course)||!Number.isFinite(r.seconds)||r.seconds<1||r.seconds>REPLAY_MAX_SECONDS||!Array.isArray(r.samples)||r.samples.length<2||r.samples.length>REPLAY_MAX_SAMPLES)return null;
  let gate=1;
  for(let i=0;i<r.samples.length;i++){
    const s=r.samples[i]!;
    if(!Array.isArray(s)||s.length!==5||!s.every(n=>typeof n==='number'&&Number.isFinite(n))||s[0]<0||s[0]>r.seconds||Math.abs(s[1])>2000||Math.abs(s[2])>2000||Math.abs(s[3])>2000||Math.abs(s[4])>Math.PI*4)return null;
    if(!i){const start=course.gates[0]!.at;if(s[0]!==0||Math.hypot(s[1]-start[0],s[2]-start[1],s[3]-start[2])>3)return null;continue;}
    const prev=r.samples[i-1]!,dt=s[0]-prev[0];
    if(dt<=0||dt>.5||Math.hypot(s[1]-prev[1],s[2]-prev[2],s[3]-prev[3])>60*dt+.05)return null;
    if(gate<course.gates.length&&crossesRaceGate(position(prev),position(s),course.gates[gate]!))gate++;
  }
  if(Math.abs(r.samples[r.samples.length-1]![0]-r.seconds)>.00001||gate!==course.gates.length)return null;
  return {version:1,course:r.course,signature:r.signature,seconds:r.seconds,samples:r.samples.map(s=>[...s] as ReplaySample)};
}
export function replayPose(replay:RaceReplay,seconds:number,mode:GhostPose['mode']='race'):GhostPose|null {
  if(!Number.isFinite(seconds)||seconds<0||seconds>replay.seconds)return null;
  let lo=0,hi=replay.samples.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(replay.samples[mid]![0]<=seconds)lo=mid;else hi=mid;}
  const a=replay.samples[lo]!,b=replay.samples[hi]!,u=Math.min(1,Math.max(0,(seconds-a[0])/(b[0]-a[0])));
  const mix=(n:number)=>a[n]!+(b[n]!-a[n]!)*u;
  return {x:mix(1),y:mix(2),z:mix(3),yaw:a[4]+Math.atan2(Math.sin(b[4]-a[4]),Math.cos(b[4]-a[4]))*u,mode};
}
export type RaceRecorder={sample(s:ReplaySample,gateCrossed?:boolean):void;invalidate():void;finish(seconds:number):RaceReplay|null};
export function createRaceRecorder(course:ReplayCourse):RaceRecorder {
  const samples:ReplaySample[]=[];let previous:ReplaySample|null=null,invalid=false;
  function push(s:ReplaySample){if(samples.at(-1)?.[0]===s[0])return;samples.push(s);if(samples.length>REPLAY_MAX_SAMPLES)invalid=true;}
  return {
    sample(s,gateCrossed=false){if(invalid)return;if(s[0]>REPLAY_MAX_SECONDS){invalid=true;return;}if(gateCrossed&&previous)push(previous);if(!samples.length||gateCrossed||s[0]-samples.at(-1)![0]>=REPLAY_SAMPLE_SECONDS-.00001)push(s);previous=s;},
    invalidate(){invalid=true;},
    finish(seconds){if(invalid||!previous)return null;push(previous);return decodeRaceReplay({version:1,course:course.id,signature:courseSignature(course),seconds,samples},course);},
  };
}
