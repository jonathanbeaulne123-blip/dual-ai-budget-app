/** Isolated lifecycle regression: no native world solve, terrain import or WebGL.
 * Geometry itself is covered by the separate exact served-asset tests. */
import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import type {StructureSolid} from '../src/harbour/horizon/land/interfaces.ts';
const probe=vi.hoisted(()=>({builds:[] as {ids:string[]|undefined;cached:boolean;cancelled:boolean;disposed:boolean;tier:string;patch:unknown}[]}));
vi.mock('../src/harbour/scene/place.ts',()=>({SCENE_DRESSING:{classic:{},taylor:{},newfoundland:{}}}));
vi.mock('../src/harbour/horizon/regions/mountainV2/graph.ts',()=>({regionPathGraph:()=>({})}));
vi.mock('../src/harbour/horizon/regions/mountainV2/rides.ts',()=>({regionRides:()=>({})}));
vi.mock('../src/harbour/horizon/regions/mountainV2/geography.ts',()=>({
  mouthExclusion:()=>undefined,terraceBedExclusion:()=>undefined,
  createRegionGeography(options:{walkingJoinSolids?:StructureSolid[]}){
    const count=options.walkingJoinSolids?.filter(s=>(s.sourceId??s.id.split('@')[0])==='mountainV2.funicularFoot.apron').length??0;
    const ground=()=>100-count,hit=(drawn:boolean)=>({id:count&&drawn?'station:funicular:town:planks':'terrain',y:count&&drawn?100:ground(),nx:0,ny:1,nz:0,material:count&&drawn?'wood':'grass',slope:0});
    const provider={owns:()=>true,ground,waterLevel:()=>null,surface:()=>hit(true),ceiling:()=>Infinity,contact:()=>null};
    return {contains:()=>true,requiresScene:()=>true,groundAt:ground,groundCeiling:ground,walkingGroundPatch:count?{generation:count}:undefined,
      surface:()=>({id:hit(true).id,y:hit(true).y,n:[0,1,0],material:hit(true).material,slope:0}),ceiling:()=>null,blocked:()=>false,waterLevel:()=>null,provider,
      whileDrawn:(drawn:()=>boolean)=>({...provider,surface:()=>hit(drawn())})};
  },
}));
vi.mock('../src/harbour/horizon/regions/mountainV2/scene.ts',()=>({
  mountRegionSteps:function*(_scene:unknown,tier:string,_dressing:unknown,options:{walkingJoinSolids?:StructureSolid[];groundCache?:Map<string,unknown>;walkingGroundPatch?:unknown}){
    const record={ids:options.walkingJoinSolids?.map(s=>s.id),cached:options.groundCache?.has('prepared-ground')??false,cancelled:false,disposed:false,tier,patch:options.walkingGroundPatch};probe.builds.push(record);
    options.groundCache?.set('prepared-ground',{});let complete=false;
    try {yield;complete=true;return {group:{visible:false},dispose(){record.disposed=true;},stats:()=>({})};}
    finally {if(!complete)record.cancelled=true;}
  },
}));
import {createMountainV2Region} from '../src/harbour/horizon/regions/mountainV2/index.ts';
import {createBuildTask} from '../src/house/world/buildTask.ts';
const fragment=(suffix:string):StructureSolid=>({id:'mountainV2.funicularFoot.apron@'+suffix,sourceId:'mountainV2.funicularFoot.apron',kind:'landing',positions:[],indices:[],surface:'paved',role:'deck',districtId:'lakeside',bedIds:[],walkable:true});
const other:StructureSolid={...fragment('other'),id:'unrelated@lakeside',sourceId:'unrelated'};

describe('late funicular apron replaces a complete region generation',()=>{
  it.each(['full','lite'] as const)('keeps retained providers current and ground/art cached together in %s',tier=>{
    const solids:StructureSolid[]=[],region=createMountainV2Region({walkingJoinSolids:solids});let drawn=true;
    const provider=region.provider,visibleProvider=region.providerWhileDrawn(()=>drawn);
    const oldScene=region.mount({} as never,tier,{} as never),oldBuild=probe.builds.at(-1)!;
    expect(oldBuild.ids).toEqual([]);expect(oldBuild.patch).toBeUndefined();expect(provider.ground(0,0)).toBe(100);
    solids.push(fragment('lakeside'));
    // Mutating the loader's array cannot change art behind the old geography.
    expect(oldBuild.ids).toEqual([]);expect(visibleProvider.ground(0,0)).toBe(100);
    const invalidate=vi.fn(()=>{expect(provider.ground(0,0)).toBe(100);oldScene.dispose();drawn=false;});
    expect(region.refreshWalkingJoinSolids(solids,invalidate)).toBe(true);expect(invalidate).toHaveBeenCalledOnce();expect(oldBuild.disposed).toBe(true);
    expect(region.provider).toBe(provider);expect(provider.ground(0,0)).toBe(99);expect(visibleProvider.ground(0,0)).toBe(99);
    expect(visibleProvider.surface(0,0,100)?.id).toBe('terrain'); // no invisible plank support during rebuild
    const nextScene=region.mount({} as never,tier,{} as never),nextBuild=probe.builds.at(-1)!;
    expect(nextBuild.ids).toEqual(['mountainV2.funicularFoot.apron@lakeside']);expect(nextBuild.cached).toBe(false);expect(nextBuild.patch).toEqual({generation:1});
    drawn=true;expect(visibleProvider.surface(0,0,100)?.id).toBe('station:funicular:town:planks');
    solids.push(other);expect(region.refreshWalkingJoinSolids(solids,invalidate)).toBe(false);expect(invalidate).toHaveBeenCalledOnce();nextScene.dispose();
  });
  it('cancels an in-flight generation before a second source fragment is published',()=>{
    const solids=[fragment('one')],region=createMountainV2Region({walkingJoinSolids:solids}),provider=region.provider;
    // Zero budget permits one generator yield; there is no renderer or clock wait.
    const task=createBuildTask(region.mountSteps({} as never,'lite',{} as never),0,()=>0);expect(task.advance()).toBeUndefined();const pending=probe.builds.at(-1)!;
    solids.push(fragment('two'));
    expect(region.refreshWalkingJoinSolids(solids,()=>{expect(provider.ground(0,0)).toBe(99);task.cancel();})).toBe(true);
    expect(pending.cancelled).toBe(true);expect(task.advance()).toBeUndefined();expect(provider.ground(0,0)).toBe(98);
    region.mount({} as never,'lite',{} as never);expect(probe.builds.at(-1)?.ids).toEqual(solids.map(s=>s.id));expect(probe.builds.at(-1)?.cached).toBe(false);expect(probe.builds.at(-1)?.patch).toEqual({generation:2});
  });
  it('closes the creation-to-first-mount race and leaves native/default callers alone',()=>{
    const solids:StructureSolid[]=[],region=createMountainV2Region({walkingJoinSolids:solids});solids.push(fragment('lakeside'));
    expect(region.refreshWalkingJoinSolids(solids,()=>{})).toBe(true);region.mount({} as never,'full',{} as never);expect(probe.builds.at(-1)?.ids).toEqual(solids.map(s=>s.id));
    const native=createMountainV2Region(),invalidate=vi.fn();expect(native.refreshWalkingJoinSolids([other],invalidate)).toBe(false);expect(invalidate).not.toHaveBeenCalled();native.mount({} as never,'full',{} as never);expect(probe.builds.at(-1)?.ids).toBeUndefined();
  });
  it('wires initial delivery and later chunks through the same region invalidation',()=>{
    const runtime=readFileSync('src/harbour/horizon/runtime/index.ts','utf8');
    const initial=runtime.slice(runtime.indexOf('const placed=await placing'),runtime.indexOf('function createRuntime'));
    expect(initial).toContain('placed?.region.refreshWalkingJoinSolids(assets.cuts.solids,()=>{});');
    const arrival=runtime.slice(runtime.indexOf('const offChunk='),runtime.indexOf('function gateOpen'));
    expect(arrival).toContain('placed?.region.refreshWalkingJoinSolids(cuts.solids,releaseRegion);');
    const release=runtime.slice(runtime.indexOf('function releaseRegion'),runtime.indexOf('function showRegion'));
    expect(release).toContain('regionTask?.cancel()');expect(release).toContain('regionScene?.dispose()');expect(release).toContain('showRegion(false)');
  });
});
