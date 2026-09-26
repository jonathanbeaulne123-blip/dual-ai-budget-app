import {RIVER,nearestOnRoute,mountainBaseHeight} from './definition.ts';
import {PATH_EDGES} from './pathGraph.ts';
import {queryWorldSurface} from './surfaces.ts';
/**
 * `snap()` is a mover's one on-purpose sound (the glider's sail on launch, the parachute's pull);
 * `splashEcho()` the Deep's three echoes up the Throat; `vario(lift)` the flight instrument, called
 * every frame with net lift in m/s. All three share the bell's guards: silent until a deliberate
 * gesture enabled ambience, and when muted, hidden or quiet (calm view).
 */
export type WorldAmbience={update(x:number,y:number,z:number,speed:number,wood:boolean,walking:boolean,quiet:boolean):void;bell():void;snap():void;splashEcho():void;vario(lift:number):void;pause():void;dispose():void};
/** The Deep's echoes (FLIGHT.md §5): three, 1.1 s apart, each softer. */
export const SPLASH_ECHOES:readonly {delay:number;level:number}[]=[{delay:0,level:.16},{delay:1.1,level:.08},{delay:2.2,level:.035}];
/** The vario chirps every 0.6 s while net lift is at least 0.5 m/s; its pitch rises with lift. Silence in sink is the tell. */
export const VARIO={interval:.6,threshold:.5,baseHz:620,hzPerMs:140,maxLift:5} as const;

/**
 * A small bronze bell's partials (ratio to the strike note, level, seconds to fade): the
 * hum an octave down, the prime, a minor-third tierce, the quint, the nominal and two
 * upper partials — inharmonic, as a cast bell is — the low ones ringing longest.
 */
export const BELL_PARTIALS:readonly (readonly [number,number,number])[]=[[.5,.05,2.8],[1,.1,2.2],[1.183,.06,1.6],[1.506,.035,1.2],[2,.045,1],[2.662,.02,.7],[3.011,.012,.5]];
export type FootSurface='wood'|'stone'|'gravel'|'grass'|'snow'|'metal';
/**
 * What a foot lands on, from the contract's surfaces: decks by their material (timber
 * bridges and platforms ring as wood, the dam's promenade and metal branches as metal),
 * the paved road, lanes and stairs as stone, worn paths as gravel, open ground as grass,
 * and the summit's snow above its line.
 */
export function footSurfaceAt(x:number,y:number,z:number,woodHint=false):FootSurface{
  if(woodHint)return 'wood';
  const hit=queryWorldSurface({x,z,y,stepHeight:.6},(px,pz)=>pz<-48?mountainBaseHeight(px,pz):-.05);
  if(hit.id!=='terrain'){if(hit.material==='wood')return 'wood';if(hit.material==='metal')return 'metal';return 'stone';}
  if(y>100)return 'snow';
  for(const e of PATH_EDGES)if(e.kind==='path'&&Math.abs(e.points[0]![0]-x)+Math.abs(e.points[0]![2]-z)<e.length+4&&nearestOnRoute(x,z,e.points).distance<e.halfWidth+.2)return 'gravel';
  return 'grass';
}
/** Each surface's footfall: a filtered noise burst (type, centre, Q, length, level) and an optional second crunch. */
const STEPS:Record<FootSurface,{type:BiquadFilterType;f:number;q:number;len:number;level:number;crunch?:number}>={
  grass:{type:'lowpass',f:420,q:.7,len:.08,level:.12},
  gravel:{type:'bandpass',f:2600,q:.9,len:.07,level:.2,crunch:.035},
  stone:{type:'bandpass',f:1300,q:1.6,len:.05,level:.17},
  wood:{type:'bandpass',f:320,q:3.2,len:.09,level:.22},
  snow:{type:'bandpass',f:1800,q:.6,len:.13,level:.1,crunch:.05},
  metal:{type:'bandpass',f:3200,q:6,len:.07,level:.1},
};

/** Quiet original synthesis, enabled by a deliberate gesture. No downloaded sound or second frame loop. */
export function createWorldAmbience():WorldAmbience|null{
  if(typeof AudioContext==='undefined')return null;
  const ctx=new AudioContext(),master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
  const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);
  let seed=1973;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/4294967296-.5)*.4;}
  function bed(freq:number,type:BiquadFilterType){const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;source.loop=true;filter.type=type;filter.frequency.value=freq;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(master);source.start();return {source,filter,gain};}
  const wind=bed(350,'lowpass'),water=bed(1900,'bandpass'),leaves=bed(800,'highpass');
  let dead=false,muted=true,lastBell=-Infinity,lastSnap=-Infinity,lastEcho=-Infinity,lastVario=-Infinity,last:{x:number;z:number}|null=null,stride=0,lastStep=0,foot=0;
  const tones=new Set<{oscillator:OscillatorNode;gain:GainNode}>();
  const stopTones=()=>{for(const tone of tones){try{tone.oscillator.stop();}catch{}tone.oscillator.disconnect();tone.gain.disconnect();}tones.clear();};
  const ease=(param:AudioParam,value:number)=>{param.cancelScheduledValues(ctx.currentTime);param.setTargetAtTime(value,ctx.currentTime,.5);};
  const pause=()=>{if(!dead){muted=true;stopTones();ease(master.gain,0);last=null;stride=0;}};
  const visibility=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',visibility);
  const burst=(at:number,s:typeof STEPS[FootSurface],level:number)=>{
    const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();src.buffer=buffer;filter.type=s.type;filter.frequency.value=s.f*(.92+Math.random()*.16);filter.Q.value=s.q;
    gain.gain.setValueAtTime(level,at);gain.gain.exponentialRampToValueAtTime(.001,at+s.len);src.connect(filter);filter.connect(gain);gain.connect(master);
    src.start(at,Math.random()*1.5);src.stop(at+s.len+.02);src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();};
  };
  const silent=()=>dead||muted||document.hidden||ctx.state!=='running';
  const chirp=(at:number,freq:number,level:number,length:number)=>{
    const oscillator=ctx.createOscillator(),gain=ctx.createGain(),tone={oscillator,gain};tones.add(tone);
    oscillator.type='sine';oscillator.frequency.setValueAtTime(freq,at);oscillator.frequency.exponentialRampToValueAtTime(freq*1.12,at+length);
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(level,at+.01);gain.gain.exponentialRampToValueAtTime(.0005,at+length);
    oscillator.connect(gain);gain.connect(master);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();tones.delete(tone);};oscillator.start(at);oscillator.stop(at+length+.02);
  };
  void ctx.resume().catch(()=>{});
  return {
    pause,
    snap(){
      if(silent()||ctx.currentTime-lastSnap<.7)return;
      lastSnap=ctx.currentTime;const now=ctx.currentTime;
      // Cloth going taut: a bright crack, a low thump of the sail filling, a short flutter.
      burst(now,{type:'highpass',f:1800,q:.8,len:.035,level:.16},.16);
      burst(now+.012,{type:'lowpass',f:260,q:1.1,len:.12,level:.2},.2);
      burst(now+.05,{type:'bandpass',f:900,q:2.4,len:.06,level:.07},.07);
    },
    splashEcho(){
      if(silent()||ctx.currentTime-lastEcho<.7)return;
      lastEcho=ctx.currentTime;const now=ctx.currentTime;
      for(const echo of SPLASH_ECHOES){burst(now+echo.delay,{type:'lowpass',f:700,q:.8,len:.45,level:echo.level},echo.level);burst(now+echo.delay+.03,{type:'bandpass',f:2200,q:1.2,len:.2,level:echo.level*.4},echo.level*.4);}
    },
    vario(lift){
      if(silent()||!Number.isFinite(lift)||lift<VARIO.threshold||ctx.currentTime-lastVario<VARIO.interval)return;
      lastVario=ctx.currentTime;chirp(ctx.currentTime,VARIO.baseHz+VARIO.hzPerMs*Math.min(lift,VARIO.maxLift),.035,.09);
    },
    bell(){
      if(silent()||ctx.currentTime-lastBell<.7)return;
      lastBell=ctx.currentTime;const strike=660,now=ctx.currentTime;
      // Inharmonic partials, each with its own decay; a little detune gives the beat of a real casting.
      BELL_PARTIALS.forEach(([ratio,level,decay],k)=>{
        const oscillator=ctx.createOscillator(),gain=ctx.createGain(),tone={oscillator,gain};tones.add(tone);
        oscillator.type='sine';oscillator.frequency.value=strike*ratio*(1+(k%2?.0015:-.001));gain.gain.setValueAtTime(.0001,now);
        gain.gain.exponentialRampToValueAtTime(level,now+.006+k*.001);gain.gain.exponentialRampToValueAtTime(.0005,now+decay);
        oscillator.connect(gain);gain.connect(master);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();tones.delete(tone);};oscillator.start(now);oscillator.stop(now+decay+.05);
      });
      // The clapper's strike: a bright, very short noise.
      burst(now,{type:'highpass',f:2400,q:.7,len:.03,level:.09},.09);
    },
    update(x,y,z,speed,wood,walking,quiet){
      if(dead)return;if(quiet||document.hidden){pause();return;}
      muted=false;
      ease(master.gain,.22);
      const altitude=Math.max(0,Math.min(1,y/110)),river=nearestOnRoute(x,z,RIVER).distance;
      ease(wind.gain.gain,.16+altitude*.34);ease(water.gain.gain,Math.max(0,1-river/35)*.5+(z>25?.12:0));ease(leaves.gain.gain,z<-60&&y<80?.08:0);
      if(last&&walking&&speed>.1){const distance=Math.hypot(x-last.x,z-last.z);if(distance<3)stride+=distance;}
      if(stride>.78&&ctx.currentTime-lastStep>.16){
        stride=0;lastStep=ctx.currentTime;foot=1-foot;
        const kind=footSurfaceAt(x,y,z,wood),s=STEPS[kind],level=s.level*(foot?1:.85)*Math.min(1.3,.7+speed*.15);
        burst(ctx.currentTime,s,level);if(s.crunch)burst(ctx.currentTime+s.crunch,s,level*.6);
      }
      last={x,z};
    },
    dispose(){if(dead)return;dead=true;stopTones();document.removeEventListener('visibilitychange',visibility);for(const b of [wind,water,leaves]){b.source.stop();b.source.disconnect();b.filter.disconnect();b.gain.disconnect();}master.disconnect();void ctx.close().catch(()=>{});},
  };
}
