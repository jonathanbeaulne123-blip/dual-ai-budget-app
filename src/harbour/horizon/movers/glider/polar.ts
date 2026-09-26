/**
 * The glider's polar and the canopy's toggle table (FLIGHT.md §2.2, §3.3).
 * Pure numbers: no scene, no runtime. Speeds are m/s (= engine units per second at scale 1.0).
 */
import {HORIZON_MANIFEST} from '../../world/manifest.ts';

/** [airspeed m/s, still-air sink m/s], bar pushed out full → pulled in full. */
export type PolarPoint=readonly [number,number];

/** FLIGHT.md §2.2's five points: the fallback if the manifest ever lacks `sky.gliderPolar`. */
export const FLIGHT_POLAR:readonly PolarPoint[]=Object.freeze([[8,1.3],[9,1.05],[11,1.2],[14,1.8],[17,3]] as const);

function manifestPolar():readonly PolarPoint[]{
  const raw=(HORIZON_MANIFEST.sky as {gliderPolar?:unknown}).gliderPolar;
  if(!Array.isArray(raw)||raw.length<2)return FLIGHT_POLAR;
  const points=raw.map(p=>Array.isArray(p)?[Number(p[0]),Number(p[1])] as const:null);
  if(points.some(p=>!p||!Number.isFinite(p[0])||!Number.isFinite(p[1])))return FLIGHT_POLAR;
  const sorted=(points as PolarPoint[]).slice().sort((a,b)=>a[0]-b[0]);
  return sorted.every((p,i)=>i===0||p[0]>sorted[i-1]![0])?Object.freeze(sorted):FLIGHT_POLAR;
}

/** The polar in use: `MANIFEST.sky.gliderPolar`, else FLIGHT.md §2.2. */
export const GLIDER_POLAR:readonly PolarPoint[]=manifestPolar();

export const GLIDER_MIN_MS=GLIDER_POLAR[0]![0];
export const GLIDER_MAX_MS=GLIDER_POLAR.at(-1)![0];
/** Trim: bar released. The manifest's `sky.glider.speed_ms`. */
export const GLIDER_TRIM_MS=HORIZON_MANIFEST.sky.glider.speed_ms;
/** Below this the wing stalls (FLIGHT.md §2.2). */
export const STALL_MS=7.5;
/** Stall recovery: airspeed back to this over `STALL_RECOVERY_S`, losing `STALL_HEIGHT_LOSS` m, bar ignored. */
export const STALL_RECOVERY_MS=9;
export const STALL_RECOVERY_S=1.5;
export const STALL_HEIGHT_LOSS=6;
/** Airspeed moves toward the bar's target at these rates (m/s²). */
export const PULL_ACCEL=2;
export const PUSH_ACCEL=1.5;
/** Airspeed at the lip after the run (FLIGHT.md §2.1). */
export const LAUNCH_MS=9;

/**
 * Fritsch–Carlson monotone cubic Hermite tangents: smooth through every point, no overshoot,
 * flat at the local minimum (9 m/s, min sink), so sink never dips below 1.05 and rises monotonically above 9.
 */
function tangents(points:readonly PolarPoint[]):number[]{
  const n=points.length,d:number[]=[],m:number[]=new Array(n).fill(0);
  for(let i=0;i+1<n;i++)d.push((points[i+1]![1]-points[i]![1])/(points[i+1]![0]-points[i]![0]));
  m[0]=d[0]!;m[n-1]=d[n-2]!;
  for(let i=1;i+1<n;i++){
    const a=d[i-1]!,b=d[i]!;
    if(a*b<=0){m[i]=0;continue;}
    const h0=points[i]![0]-points[i-1]![0],h1=points[i+1]![0]-points[i]![0],w1=2*h1+h0,w2=h1+2*h0;
    m[i]=(w1+w2)/(w1/a+w2/b);
  }
  // End tangents must not overshoot either (Fritsch–Carlson end rule).
  if(d[0]!*m[0]!<=0)m[0]=0;
  if(d[n-2]!*m[n-1]!<=0)m[n-1]=0;
  return m;
}
const TANGENTS=tangents(GLIDER_POLAR);

/** Still-air sink (m/s, positive down) at `airspeed`, clamped to the polar's 8…17 range. */
export function sinkAt(airspeed:number):number{
  const p=GLIDER_POLAR,v=Math.min(GLIDER_MAX_MS,Math.max(GLIDER_MIN_MS,airspeed));
  let i=0;while(i+2<p.length&&v>p[i+1]![0])i++;
  const [x0,y0]=p[i]!,[x1,y1]=p[i+1]!,h=x1-x0,t=(v-x0)/h,t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*y0+(t3-2*t2+t)*h*TANGENTS[i]!+(-2*t3+3*t2)*y1+(t3-t2)*h*TANGENTS[i+1]!;
}

/** Bar −1…1 → target airspeed: −1 = 8 (pushed out full), 0 = trim 11, +1 = 17 (pulled in full); linear each side. */
export function barTarget(bar:number):number{
  const b=Math.max(-1,Math.min(1,Number.isFinite(bar)?bar:0));
  return b<0?GLIDER_TRIM_MS+b*(GLIDER_TRIM_MS-GLIDER_MIN_MS):GLIDER_TRIM_MS+b*(GLIDER_MAX_MS-GLIDER_TRIM_MS);
}

/** Glide ratio at an airspeed in still air, level wings. */
export const glideRatio=(airspeed:number)=>airspeed/sinkAt(airspeed);

/** One row of the canopy's toggle table (FLIGHT.md §3.3). */
export interface ChuteRow{toggles:'up'|'half'|'full'|'flare';brake:number;forward:number;sink:number}
const chute=HORIZON_MANIFEST.sky.parachute;
/** The square canopy: forward speed and sink by brake (0 = hands up, 1 = full brakes); `flare` is the last 5 m at full brakes, 2 → 0 forward and 1.5 → 0.5 sink. */
export const CHUTE_POLAR:readonly ChuteRow[]=Object.freeze([
  {toggles:'up',brake:0,forward:chute.forward_ms,sink:chute.sink_ms},
  {toggles:'half',brake:.5,forward:4,sink:2.2},
  {toggles:'full',brake:1,forward:2,sink:1.5},
  {toggles:'flare',brake:1,forward:0,sink:.5},
] as const);

/** Forward speed and sink for a brake setting 0…1, linear between the up / half / full rows. */
export function chuteAt(brake:number):{forward:number;sink:number}{
  const b=Math.max(0,Math.min(1,Number.isFinite(brake)?brake:0)),[up,half,full]=CHUTE_POLAR as [ChuteRow,ChuteRow,ChuteRow];
  const [a,c,f]=b<=.5?[up,half,b/.5]:[half,full,(b-.5)/.5];
  return{forward:a.forward+(c.forward-a.forward)*f,sink:a.sink+(c.sink-a.sink)*f};
}

export const CHUTE={
  gravity:12,
  freefallCap:chute.freefallCap_ms,
  planeTau:.5,
  leanMax:8,
  freefallWind:.5,
  autoPullAgl:chute.autoPull_agl_m*HORIZON_MANIFEST.scale.factor,
  minBailAgl:chute.minBail_agl_m*HORIZON_MANIFEST.scale.factor,
  openingSeconds:1.2,
  openedSink:3,
  fullBrakeSeconds:3,
  mushSink:4,
  mushReleaseSeconds:1,
  yawRate:40*Math.PI/180,
  turnSink:.5,
  flareAgl:5,
  standUpGroundSpeed:3,
} as const;
