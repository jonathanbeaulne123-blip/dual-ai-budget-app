import type {SkateSnapshot} from './session.ts';

/** Gesture-created, original synthesized board sounds. No media or network. */
export function createSkateAudio(){
  if(typeof AudioContext==='undefined')return null;
  const context=new AudioContext(),master=context.createGain(),roll=context.createGain(),grind=context.createGain();
  master.gain.value=.55;master.connect(context.destination);roll.gain.value=grind.gain.value=0;roll.connect(master);grind.connect(master);
  const buffer=context.createBuffer(1,context.sampleRate/2,context.sampleRate),data=buffer.getChannelData(0);
  let seed=31;for(let i=0;i<data.length;i++){seed=(seed*16807)%2147483647;data[i]=(seed/2147483647)*2-1;}
  const wheels=context.createBufferSource(),filter=context.createBiquadFilter();
  wheels.buffer=buffer;wheels.loop=true;filter.type='lowpass';filter.frequency.value=700;wheels.connect(filter);filter.connect(roll);wheels.start();
  const rail=context.createOscillator();rail.type='sawtooth';rail.frequency.value=240;rail.connect(grind);rail.start();
  let lastEvent=-1,wasAir=false,disposed=false;
  function tap(hard:boolean){
    const source=context.createBufferSource(),gain=context.createGain(),tone=context.createBiquadFilter();
    source.buffer=buffer;tone.type='lowpass';tone.frequency.value=hard?550:1600;
    source.connect(tone);tone.connect(gain);gain.connect(master);
    gain.gain.setValueAtTime(hard?.16:.09,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.12);
    source.start();source.stop(context.currentTime+.14);source.onended=()=>{source.disconnect();gain.disconnect();tone.disconnect();};
  }
  void context.resume().catch(()=>{});
  return {
    update(s:SkateSnapshot|null){
      if(disposed)return;
      const quiet=!s||s.paused||document.hidden;
      const speed=quiet?0:Math.min(1,s.speed/13),grounded=s?.mode==='ride';
      roll.gain.setTargetAtTime(grounded?speed*.055:0,context.currentTime,.08);
      grind.gain.setTargetAtTime(!quiet&&s?.mode==='grind'?.018:0,context.currentTime,.035);
      wheels.playbackRate.setTargetAtTime(.6+speed*1.5,context.currentTime,.08);rail.frequency.setTargetAtTime(180+speed*170,context.currentTime,.08);
      if(s&&!quiet){
        if(s.mode==='air'&&!wasAir)tap(false);
        if(s.eventId!==lastEvent&&(s.event==='Clean landing'||s.event==='Landed fakie'||s.mode==='bail'))tap(true);
      }
      wasAir=s?.mode==='air';lastEvent=s?.eventId??-1;
    },
    dispose(){if(disposed)return;disposed=true;wheels.stop();rail.stop();void context.close().catch(()=>{});},
  };
}
