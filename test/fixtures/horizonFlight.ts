/**
 * Shared fixtures for the M6 wiring tests (camera, controller, reduced motion): the real baked Horizon
 * (world definition + terrain, decoded exactly as the runtime does) and a small synthetic world whose ground,
 * water, hosts and path nodes are chosen so every §2.4 row can be reached deliberately.
 */
import {readFileSync} from 'node:fs';
import {parseHorizonDefinition} from '../../src/house/world/horizonAssets.ts';
import {decodeTerrainAsset} from '../../src/harbour/horizon/land/terrain/asset.ts';
import {createHorizonGeography} from '../../src/harbour/horizon/runtime/geography.ts';
import type {LandCuts,WaterCut} from '../../src/harbour/horizon/land/interfaces.ts';
import type {Host,Threshold,WorldDefinition} from '../../src/harbour/horizon/world/definition.ts';
import {createGliderEnv,type GliderEnv,type GliderGeography} from '../../src/harbour/horizon/movers/glider/env.ts';
import {IDLE_INPUT,type FlightModeController,type ModeInput} from '../../src/harbour/horizon/movers/shared/mode.ts';

let real:{world:WorldDefinition;env:GliderEnv;cuts:LandCuts;geography:ReturnType<typeof createHorizonGeography>}|null=null;
/** The baked island (≈ 1 s to decode once per file). Thermals read 15:30, the frozen afternoon. */
export function realHorizon(){
  if(real)return real;
  const gz=readFileSync('public/horizon/world/horizon-geo-1.json.gz'),world=parseHorizonDefinition(gz.buffer.slice(gz.byteOffset,gz.byteOffset+gz.byteLength));
  const bin=readFileSync('public/horizon/terrain/horizon-geo-1.bin'),field=decodeTerrainAsset(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength),'full');
  const cuts:LandCuts={...world.collision,solids:world.geometry.solids,diagnostics:[]};
  const geography=createHorizonGeography(field,cuts);
  real={world,cuts,geography,env:createGliderEnv({world,geography,cuts},{hour:()=>15.5})};
  return real;
}

/**
 * A flat synthetic island at h 20 (world 2000 × 1800), with:
 * - a lake (level 19.5 over a bed at 15) in x 900…1000, z 850…1050;
 * - a hill (a 60 m sine bump at [700, 700], r 150) for the camera's floor;
 * - a host (the "barn", floor 20, roof +10) at x 780…800, z 600…640;
 * - path nodes: one on the lake's east shore, one near the barn, one in the south.
 * The envelope (launches, landings, gates, the Throat) is the real one.
 */
export const LAKE={x:[900,1000] as const,z:[850,1050] as const,level:19.5,bed:15};
export const HILL={x:700,z:700,r:150,h:60};
export const BARN:Host={id:'barn',placeIds:[],door:{id:'door.barn',xy:[790,640],height:20},apron:[],arrivalThresholds:[],height:20,roofHeight:10,footprint:[[780,600],[800,600],[800,640],[780,640]]};
export function syntheticGround(x:number,z:number):number{
  if(x>=LAKE.x[0]&&x<=LAKE.x[1]&&z>=LAKE.z[0]&&z<=LAKE.z[1])return LAKE.bed;
  const d=Math.hypot(x-HILL.x,z-HILL.z);
  return 20+(d<HILL.r?HILL.h*.5*(1+Math.cos(Math.PI*d/HILL.r)):0);
}
export function syntheticEnv(options:{hosts?:Host[]}={}):GliderEnv{
  const {world}=realHorizon();
  const geography:GliderGeography={
    ground:syntheticGround,
    surface(x,z,y,step=.48){if(x<0||z<0||x>2000||z>1800)return null;const g=syntheticGround(x,z);return y===undefined||g<=y+step?{y:g,slope:2,material:'grass'}:null;},
    blocked:(x,z)=>x<.5||z<.5||x>1999.5||z>1799.5,
  };
  const lake:WaterCut={id:'water.test',kind:'lake',outline:[[LAKE.x[0],LAKE.z[0]],[LAKE.x[1],LAKE.z[0]],[LAKE.x[1],LAKE.z[1]],[LAKE.x[0],LAKE.z[1]]],points:[],level:LAKE.level,width:100,depth:5,bank:0};
  const pathGraph={nodes:[{id:'shore.east',at:[1006,20,950] as const,kind:'junction' as const},{id:'barn.yard',at:[820,20,620] as const,kind:'junction' as const},{id:'south',at:[1040,20,1300] as const,kind:'junction' as const}],edges:[]};
  return createGliderEnv({world:{sky:world.sky,hosts:options.hosts??[BARN],pathGraph},geography,cuts:{waters:[lake],mouths:[]}},{hour:()=>15.5});
}

/** A launch threshold anywhere (the controller falls back to an edge ±3 m across `at`). */
export const pad=(id:string,x:number,z:number,h:number):Threshold=>({id,at:[x,z],height:h,modes:['feet→glider'],action:'run off'});
export const input=(patch:Partial<ModeInput>={}):ModeInput=>({...IDLE_INPUT,...patch});
export const FRAME=1/60;
/** Run frames until `stop` (or `maxSeconds`), recording what each frame produced. */
export function fly(c:FlightModeController,control:(t:number)=>Partial<ModeInput>,stop:()=>boolean,maxSeconds=300){
  const frames:{t:number;phase:string;sound:string|null;camera:ReturnType<FlightModeController['camera']>;pose:ReturnType<FlightModeController['bodyPose']>}[]=[];
  let t=0;
  while(t<maxSeconds&&!stop()){c.update(FRAME,input(control(t)));t+=FRAME;frames.push({t,phase:(c as {phase?:()=>string}).phase?.()??'',sound:c.sound(),camera:c.camera(),pose:c.bodyPose()});if(c.finished?.())break;}
  return frames;
}
