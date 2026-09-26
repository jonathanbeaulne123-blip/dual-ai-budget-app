import {afterEach,describe,expect,it,vi} from 'vitest';
import {createWorldAmbience,SPLASH_ECHOES,VARIO} from '../src/harbour/mountain/audio.ts';

function stubAudio(){
  const param=()=>({value:0,cancelScheduledValues:vi.fn(),setTargetAtTime:vi.fn(),setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()});
  const node=()=>({connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),gain:param(),frequency:param(),Q:param(),type:'sine',onended:null as (()=>void)|null});
  const clock={now:1},oscillators:ReturnType<typeof node>[]=[],sources:ReturnType<typeof node>[]=[],listeners=new Map<string,()=>void>();
  const doc={hidden:false,addEventListener:(event:string,fn:()=>void)=>listeners.set(event,fn),removeEventListener:(event:string)=>listeners.delete(event)};
  vi.stubGlobal('document',doc);
  vi.stubGlobal('AudioContext',class {
    sampleRate=100;destination={};state='running';get currentTime(){return clock.now;}
    createGain=node;createBiquadFilter=node;
    createBufferSource(){const s=node();sources.push(s);return s;}
    createOscillator(){const o=node();oscillators.push(o);return o;}
    createBuffer(){return {getChannelData:()=>new Float32Array(200)};}
    resume=async()=>{};close=async()=>{};
  });
  const audio=createWorldAmbience()!,beds=sources.length;
  return {audio,clock,oscillators,doc,listeners,burstCount:()=>sources.length-beds,starts:()=>sources.slice(beds).map(s=>s.start.mock.calls[0]![0] as number)};
}

describe('Horizon mover sounds',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it('snaps once per deliberate launch, rate-limited, and only once ambience is enabled',()=>{
    const {audio,clock,burstCount}=stubAudio();
    audio.snap();expect(burstCount()).toBe(0);
    audio.update(0,0,0,0,false,false,false);audio.snap();const one=burstCount();expect(one).toBeGreaterThan(0);
    audio.snap();expect(burstCount()).toBe(one);
    clock.now=2;audio.snap();expect(burstCount()).toBe(one*2);
    audio.update(0,0,0,0,false,false,true);clock.now=3;audio.snap();expect(burstCount()).toBe(one*2);// calm view is silent
  });
  it('echoes the Deep splash three times, 1.1 s apart, each softer',()=>{
    const {audio,starts}=stubAudio();audio.update(0,0,0,0,false,false,false);audio.splashEcho();
    expect(SPLASH_ECHOES.map(e=>e.delay)).toEqual([0,1.1,2.2]);
    expect(SPLASH_ECHOES.every((e,i)=>i===0||e.level<SPLASH_ECHOES[i-1]!.level)).toBe(true);
    const times=[...new Set(starts().map(t=>Math.round((t-1)*10)/10))].filter(t=>[0,1.1,2.2].includes(t));expect(times).toEqual([0,1.1,2.2]);
  });
  it('chirps the vario every 0.6 s in lift ≥ 0.5, pitch rising with lift, silent in sink, hidden or calm',()=>{
    const {audio,clock,oscillators,doc,listeners}=stubAudio();audio.update(0,0,0,0,false,false,false);
    audio.vario(.4);expect(oscillators).toHaveLength(0);
    audio.vario(1);expect(oscillators).toHaveLength(1);
    clock.now=1.3;audio.vario(3);expect(oscillators).toHaveLength(1);
    clock.now=1.61;audio.vario(3);expect(oscillators).toHaveLength(2);
    const hz=oscillators.map(o=>o.frequency.setValueAtTime.mock.calls[0]![0] as number);expect(hz[1]).toBeGreaterThan(hz[0]!);expect(hz[0]).toBe(VARIO.baseHz+VARIO.hzPerMs);
    clock.now=3;audio.vario(-1);audio.vario(NaN);expect(oscillators).toHaveLength(2);
    audio.update(0,0,0,0,false,false,true);clock.now=4;audio.vario(2);expect(oscillators).toHaveLength(2);
    audio.update(0,0,0,0,false,false,false);doc.hidden=true;listeners.get('visibilitychange')!();clock.now=5;audio.vario(2);expect(oscillators).toHaveLength(2);
  });
});
