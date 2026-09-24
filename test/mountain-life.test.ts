import {describe,it,expect,vi,afterEach} from 'vitest';
import {createMountainRecovery,mountainRecoveryKey,type RecoveryStorage} from '../src/harbour/mountain/recovery.ts';
import {MOUNTAIN_INTERACTIONS,activateMountainInteraction,initialMountainInteractionState,mountainInteractionLabel,mountainWildlifePose} from '../src/harbour/mountain/life.ts';
import {buildMountainLife} from '../src/harbour/mountain/lifeScene.ts';
import {SCENE_DRESSING} from '../src/harbour/scene/place.ts';
import type {HarbourReading} from '../src/harbour/data/reading.ts';
import type {Mesh} from 'three';
import {createWorldAmbience} from '../src/harbour/mountain/audio.ts';

const scope={environment:'development',householdId:'fictional'};
type Reading=Pick<HarbourReading,'condition'|'freshness'|'basin'|'mountainCareDays'>;
const reading=(state:Reading['condition']['state'],revision=1,extra:Partial<Reading>={}):Reading=>({
  freshness:'current',condition:{state,days:state==='weathered'?30:state==='wilting'?7:0,words:'Supported selector'},mountainCareDays:4,
  basin:{identity:'development:fictional:fund',revision,asOf:'2026-09-24',known:true,balanceCents:1,kittyCents:0,freeCents:1,pendingCents:0,targetCents:100,flows:[]},...extra,
});
const storage=()=>{const data=new Map<string,string>();return {data,getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};};

describe('observed mountain recovery',()=>{
  it('never invents a repair from healthy first load or previously unseen historical wear',()=>{
    const store=storage(),history=createMountainRecovery(scope,store);
    expect(history.observe(reading('settled')).repairs).toBe(0);
    expect(history.observe(reading('growing',2)).repairs).toBe(0);
    expect(createMountainRecovery(scope,store).observe(reading('settled',3)).repaired).toBe(false);
  });
  it('retains supported wear through unknown evidence, reload and observed recovery exactly once',()=>{
    const store=storage(),first=createMountainRecovery(scope,store);
    expect(first.observe(reading('weathered')).wear).toBe(1);
    expect(first.observe(reading('checking',2))).toMatchObject({wear:1,repaired:false,frozen:true,careDays:4});
    const revisit=createMountainRecovery(scope,store);
    expect(revisit.snapshot()).toMatchObject({wear:1,frozen:true});
    expect(revisit.observe(reading('settled',3))).toMatchObject({wear:0,repairs:1,frozen:false});
    expect(revisit.observe(reading('settled',3)).repairs).toBe(1);
    expect(createMountainRecovery(scope,store).observe(reading('settled',3)).repairs).toBe(1);
  });
  it('freezes backwards revisions, dates, conflicting same-cursor facts and unknown backing',()=>{
    const history=createMountainRecovery(scope,storage());history.observe(reading('weathered',5));
    const stale=reading('settled',4),conflict=reading('settled',5),backwards=reading('settled',6),unknown=reading('settled',6);
    backwards.basin!.asOf='2026-09-23';unknown.basin!.known=false;
    for(const r of [stale,conflict,backwards,unknown,reading('settled',6,{freshness:'stale'})])expect(history.observe(r)).toMatchObject({wear:1,repairs:0,frozen:true});
  });
  it('isolates households, environments and replacement Funds',()=>{
    const store=storage(),first=createMountainRecovery(scope,store);first.observe(reading('weathered'));first.observe(reading('settled',2));
    for(const other of [{...scope,householdId:'other'},{...scope,environment:'production'}]) {
      const next=createMountainRecovery(other,store);expect(next.snapshot().repairs).toBe(0);expect(next.observe(reading('weathered',3)).frozen).toBe(true);
    }
    const replacement=reading('settled',3);replacement.basin!.identity='development:fictional:new-fund';
    expect(first.observe(replacement).repairs).toBe(0);
    expect(mountainRecoveryKey({environment:'a:b',householdId:'c'})).not.toBe(mountainRecoveryKey({environment:'a',householdId:'b:c'}));
  });
  it('uses no balance, spending, pending contribution, elapsed time or partner input to create damage',()=>{
    const history=createMountainRecovery(scope,storage()),r=reading('settled');
    Object.assign(r.basin!,{balanceCents:-100000,kittyCents:0,pendingCents:900000});
    expect(history.observe(r)).toMatchObject({wear:0,repairs:0});
    r.basin!.asOf='2029-09-24';expect(history.observe(r)).toMatchObject({wear:0,repairs:0});
  });
  it('handles malformed storage and unavailable storage without losing current-session evidence',()=>{
    const store=storage();store.setItem(mountainRecoveryKey(scope),'{broken');
    expect(createMountainRecovery(scope,store).snapshot().repairs).toBe(0);
    const blocked:RecoveryStorage={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};
    const history=createMountainRecovery(scope,blocked);history.observe(reading('wilting'));expect(history.observe(reading('settled',2)).repairs).toBe(1);
    expect(createMountainRecovery(scope,blocked).snapshot().repairs).toBe(0);
  });
  it('caps decorative bindings while continuing to observe valid recovery cycles',()=>{
    const history=createMountainRecovery(scope,storage());
    for(let i=1;i<20;i+=2){history.observe(reading('wilting',i));history.observe(reading('settled',i+1));}
    expect(history.snapshot().repairs).toBe(4);
  });
});

describe('mountain living interaction contract',()=>{
  for(const theme of ['classic','taylor','newfoundland'] as const)it(`offers reversible authored interactions in ${theme} without a renderer`,()=>{
    let state=initialMountainInteractionState();
    expect(new Set(MOUNTAIN_INTERACTIONS.map(i=>i.id)).size).toBe(MOUNTAIN_INTERACTIONS.length);
    for(const item of MOUNTAIN_INTERACTIONS) {
      const result=activateMountainInteraction(item.id,state,theme)!;
      expect(result.words.length).toBeGreaterThan(12);expect(result.at).toEqual(item.at);
      if(item.kind==='bench')expect(mountainInteractionLabel(item,result.state)).toContain('Leave');
      if(item.kind==='gate')expect(mountainInteractionLabel(item,result.state)).toContain('Close');
      if(item.kind==='gate'||item.kind==='bench')expect(activateMountainInteraction(item.id,result.state,theme)!.state).toEqual(state);
      if(item.kind==='bell')expect(result.cue).toBe('bell');
      if(item.kind==='overlook')state=result.state;
    }
    expect(activateMountainInteraction('post-money',state,theme)).toBeNull();
  });
  it('keeps bell and wildlife still in quiet mode with an explicit textual equivalent',()=>{
    const bell=MOUNTAIN_INTERACTIONS.find(i=>i.kind==='bell')!;
    expect(activateMountainInteraction(bell.id,initialMountainInteractionState(),'classic',true)).toMatchObject({cue:null,words:expect.stringContaining('quiet')});
    for(const kind of ['birds','moths','gull'] as const)for(const time of [0,100,10000])expect(mountainWildlifePose(kind,0,time,true)).toEqual({x:0,y:0,z:0,wing:0});
  });
  for(const theme of ['classic','taylor','newfoundland'] as const)it(`disposes all ${theme} props and stops animation when quiet`,()=>{
    const scene=buildMountainLife(SCENE_DRESSING[theme]);
    expect(scene.anchors.map(a=>a.id)).toEqual(MOUNTAIN_INTERACTIONS.map(i=>i.id));
    const disposals=new Map<object,ReturnType<typeof vi.spyOn>>();
    scene.group.traverse(object=>{const mesh=object as Mesh;if(!mesh.isMesh)return;for(const resource of [mesh.geometry,...(Array.isArray(mesh.material)?mesh.material:[mesh.material])])if(!disposals.has(resource))disposals.set(resource,vi.spyOn(resource,'dispose'));});
    const gate=MOUNTAIN_INTERACTIONS.find(i=>i.kind==='gate')!;
    scene.setInteraction(activateMountainInteraction(gate.id,initialMountainInteractionState(),theme)!.state);
    expect(scene.animate(4,.02)).toBe(true);scene.setQuiet(true);
    const before=scene.group.toJSON();expect(scene.animate(30,.02)).toBe(false);expect(scene.group.toJSON()).toEqual(before);
    scene.dispose();scene.dispose();expect(scene.group.children).toHaveLength(0);
    for(const dispose of disposals.values())expect(dispose).toHaveBeenCalledOnce();
  });
});

describe('mountain bell audio lifecycle',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it('requires enabled ambience, rate-limits rings and silences on quiet, visibility and disposal',()=>{
    const param=()=>({value:0,cancelScheduledValues:vi.fn(),setTargetAtTime:vi.fn(),setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()});
    const node=()=>({connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),gain:param(),frequency:param(),type:'sine',onended:null as (()=>void)|null});
    const voices:ReturnType<typeof node>[]=[];
    let now=1;
    const close=vi.fn(async()=>{}),listeners=new Map<string,()=>void>();
    const doc={hidden:false,addEventListener:(event:string,fn:()=>void)=>listeners.set(event,fn),removeEventListener:(event:string)=>listeners.delete(event)};
    vi.stubGlobal('document',doc);
    vi.stubGlobal('AudioContext',class {
      sampleRate=100;destination={};state='running';get currentTime(){return now;}
      createGain=node;createBufferSource=node;createBiquadFilter=node;
      createOscillator(){const voice=node();voices.push(voice);return voice;}
      createBuffer(){return {getChannelData:()=>new Float32Array(200)};}
      resume=async()=>{};close=close;
    });
    const audio=createWorldAmbience()!;
    audio.bell();expect(voices).toHaveLength(0);
    audio.update(0,0,0,0,false,false,false);audio.bell();expect(voices).toHaveLength(2);
    audio.bell();expect(voices).toHaveLength(2);
    audio.update(0,0,0,0,false,false,true);now=2;audio.bell();expect(voices).toHaveLength(2);
    for(const voice of voices)expect(voice.disconnect).toHaveBeenCalled();
    audio.update(0,0,0,0,false,false,false);audio.bell();expect(voices).toHaveLength(4);
    doc.hidden=true;listeners.get('visibilitychange')!();now=3;audio.bell();expect(voices).toHaveLength(4);
    audio.dispose();audio.dispose();audio.bell();expect(close).toHaveBeenCalledOnce();expect(listeners.size).toBe(0);
  });
});
