import {RIVER,nearestOnRoute} from './definition.ts';
export type WorldAmbience={update(x:number,y:number,z:number,speed:number,wood:boolean,walking:boolean,quiet:boolean):void;bell():void;pause():void;dispose():void};
/** Quiet original synthesis, enabled by a deliberate gesture. No downloaded sound or second frame loop. */
export function createWorldAmbience():WorldAmbience|null{
  if(typeof AudioContext==='undefined')return null;
  const ctx=new AudioContext(),master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
  const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);
  let seed=1973;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/4294967296-.5)*.4;}
  function bed(freq:number,type:BiquadFilterType){const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;source.loop=true;filter.type=type;filter.frequency.value=freq;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(master);source.start();return {source,filter,gain};}
  const wind=bed(350,'lowpass'),water=bed(1900,'bandpass'),leaves=bed(800,'highpass');
  let dead=false,muted=true,lastBell=-Infinity,last:{x:number;z:number}|null=null,stride=0,lastStep=0;
  const tones=new Set<{oscillator:OscillatorNode;gain:GainNode}>();
  const stopTones=()=>{for(const tone of tones){try{tone.oscillator.stop();}catch{}tone.oscillator.disconnect();tone.gain.disconnect();}tones.clear();};
  const ease=(param:AudioParam,value:number)=>{param.cancelScheduledValues(ctx.currentTime);param.setTargetAtTime(value,ctx.currentTime,.5);};
  const pause=()=>{if(!dead){muted=true;stopTones();ease(master.gain,0);last=null;stride=0;}};
  const visibility=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',visibility);
  void ctx.resume().catch(()=>{});
  return {
    pause,
    bell(){
      if(dead||muted||document.hidden||ctx.state!=='running'||ctx.currentTime-lastBell<.7)return;
      lastBell=ctx.currentTime;
      // Two restrained original partials share the existing master, consent and lifecycle.
      for(const [frequency,level] of [[660,.12],[1323,.035]] as const){
        const oscillator=ctx.createOscillator(),gain=ctx.createGain(),tone={oscillator,gain};tones.add(tone);
        oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.001,ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(level,ctx.currentTime+.012);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.65);
        oscillator.connect(gain);gain.connect(master);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();tones.delete(tone);};oscillator.start();oscillator.stop(ctx.currentTime+.7);
      }
    },
    update(x,y,z,speed,wood,walking,quiet){
      if(dead)return;if(quiet||document.hidden){pause();return;}
      muted=false;
      ease(master.gain,.22);
      const altitude=Math.max(0,Math.min(1,y/110)),river=nearestOnRoute(x,z,RIVER).distance;
      ease(wind.gain.gain,.16+altitude*.34);ease(water.gain.gain,Math.max(0,1-river/35)*.5+(z>25?.12:0));ease(leaves.gain.gain,z<-60&&y<80?.08:0);
      if(last&&walking&&speed>.1){const distance=Math.hypot(x-last.x,z-last.z);if(distance<3)stride+=distance;}
      if(stride>.78&&ctx.currentTime-lastStep>.16){
        stride=0;lastStep=ctx.currentTime;const foot=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();foot.buffer=buffer;filter.type='lowpass';filter.frequency.value=wood?850:y>80?1800:500;gain.gain.setValueAtTime(.16,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.09);foot.connect(filter);filter.connect(gain);gain.connect(master);foot.start();foot.stop(ctx.currentTime+.1);foot.onended=()=>{foot.disconnect();filter.disconnect();gain.disconnect();};
      }
      last={x,z};
    },
    dispose(){if(dead)return;dead=true;stopTones();document.removeEventListener('visibilitychange',visibility);for(const b of [wind,water,leaves]){b.source.stop();b.source.disconnect();b.filter.disconnect();b.gain.disconnect();}master.disconnect();void ctx.close().catch(()=>{});},
  };
}
