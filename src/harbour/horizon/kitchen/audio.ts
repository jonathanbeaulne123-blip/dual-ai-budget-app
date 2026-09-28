import type {KitchenEvent} from './types.ts';

export type KitchenAudio={enabled:(on:boolean)=>Promise<void>;sound:(event:KitchenEvent,gentle?:boolean)=>void;reset:()=>void;pause:()=>void;dispose:()=>void};
/** Short original kitchen cues. Construction is silent; only a sound-toggle/start gesture enables it. */
export function createKitchenAudio():KitchenAudio{
  let context:AudioContext|null=null,master:GainNode|null=null,on=false,dead=false,lastSequence=-1,generation=0;
  const tones=new Set<{oscillator:OscillatorNode;gain:GainNode}>(),lastCue=new Map<string,number>();
  const stop=()=>{for(const tone of tones){try{tone.oscillator.stop();}catch{/* Already ended. */}tone.oscillator.disconnect();tone.gain.disconnect();}tones.clear();};
  const pause=()=>{generation++;on=false;stop();if(master&&context)master.gain.setValueAtTime(0,context.currentTime);};
  const hidden=()=>{if(typeof document!=='undefined'&&document.hidden)pause();};
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',hidden);
  function note(frequency:number,delay:number,duration:number,level:number,type:OscillatorType='sine'){
    if(!context||!master)return;const oscillator=context.createOscillator(),gain=context.createGain(),at=context.currentTime+delay,tone={oscillator,gain};tones.add(tone);oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,at);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(level,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);oscillator.connect(gain);gain.connect(master);oscillator.onended=()=>{tones.delete(tone);oscillator.disconnect();gain.disconnect();};oscillator.start(at);oscillator.stop(at+duration+.02);
  }
  return{
    async enabled(value){
      if(dead)return;if(!value){pause();return;}
      if(!context){if(typeof AudioContext==='undefined')return;try{context=new AudioContext();master=context.createGain();master.gain.value=0;master.connect(context.destination);}catch{return;}}
      const attempt=++generation;try{await context.resume();if(dead||attempt!==generation)return;on=true;master!.gain.setValueAtTime(.18,context.currentTime);}catch{if(attempt===generation)on=false;}
    },
    sound(event,gentle=false){
      // Consume even muted events so a later sound gesture cannot replay a warning backlog.
      if(event.seq<=lastSequence)return;lastSequence=event.seq;
      if(dead||!on||!context||context.state!=='running'||typeof document!=='undefined'&&document.hidden)return;
      const now=context.currentTime,previous=lastCue.get(event.kind)??-Infinity;if(now-previous<.18)return;lastCue.set(event.kind,now);
      const level=gentle?.07:.14;
      switch(event.kind){
        case 'prepare':note(510,0,.07,level,'triangle');note(760,.08,.08,level*.7);break;
        case 'wash':note(610,0,.15,level);note(820,.08,.2,level*.7);break;
        case 'ready':note(780,0,.19,level);note(1040,.13,.26,level*.8);break;
        case 'warning':note(540,0,.16,level);if(!gentle)note(540,.22,.16,level);break;
        case 'burn':note(320,0,.22,level,'triangle');note(240,.2,.26,level*.7,'triangle');break;
        case 'serve':note(660,0,.16,level);note(830,.1,.18,level);note(990,.2,.3,level*.8);break;
        case 'miss':note(440,0,.14,level*.6);note(330,.12,.2,level*.5);break;
        case 'result':note(520,0,.22,level);note(660,.14,.22,level);note(780,.28,.4,level);break;
        case 'feedback':break;
      }
    },reset(){lastSequence=-1;lastCue.clear();stop();},pause,
    dispose(){if(dead)return;dead=true;pause();if(typeof document!=='undefined')document.removeEventListener('visibilitychange',hidden);master?.disconnect();if(context)void context.close().catch(()=>{});context=null;master=null;},
  };
}
