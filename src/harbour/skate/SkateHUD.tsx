import {useEffect,useRef,useState,type ReactNode,type PointerEvent as ReactPointerEvent} from 'react';
import {SKATE_DECKS,SKATE_ROUTES,SKATE_SPOTS,type SkateDeckId,type SkateRouteId,type SkateSpotId} from './park.ts';
import {SKATE_STAMPS,type SkateSnapshot} from './session.ts';
import type {SkateAction,SkateInput,SkateTrick} from './skateModel.ts';
import './skate.css';
import {createSkateAudio} from './audio.ts';

type Props={snapshot:SkateSnapshot|null;onStart():void;onWalk():void;onAction(action:SkateAction):void;onHold(input:Partial<SkateInput>):void;onPause(on:boolean):void;onRoute(id:SkateRouteId|null):void;onSpot(id:SkateSpotId):void;onDeck(id:SkateDeckId):void;onFocus():void;partnerName?:string|null;saveFailed?:boolean;presence?:ReactNode};
const compactScore=new Intl.NumberFormat('en-CA',{notation:'compact',maximumFractionDigits:1});
const format=(n:number)=>n>=10000?compactScore.format(n):Math.round(n).toLocaleString('en-CA');
export function SkateHUD(p:Props){
  const s=p.snapshot;
  const [panel,setPanel]=useState<'routes'|'decks'|'guide'|null>(null),[trick,setTrick]=useState<SkateTrick>('kickflip');
  const closeRef=useRef<HTMLButtonElement>(null),panelOrigin=useRef<HTMLElement|null>(null);
  const audio=useRef<ReturnType<typeof createSkateAudio>>(null);
  const [sound,setSound]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{setNotice(s?.message??'');const timer=window.setTimeout(()=>setNotice(''),5000);return()=>window.clearTimeout(timer);},[s?.message]);
  useEffect(()=>{audio.current?.update(s);},[s]);
  useEffect(()=>()=>{audio.current?.dispose();audio.current=null;},[]);
  function toggleSound(){
    if(audio.current){audio.current.dispose();audio.current=null;setSound(false);}
    else try{audio.current=createSkateAudio();audio.current?.update(s);setSound(Boolean(audio.current));}catch{setSound(false);}
    p.onFocus();
  }
  function show(which:typeof panel){panelOrigin.current=document.activeElement as HTMLElement;p.onPause(Boolean(which));setPanel(which);}
  function close(){setPanel(null);p.onPause(false);panelOrigin.current?.focus();}
  useEffect(()=>{if(panel)closeRef.current?.focus();},[panel]);
  useEffect(()=>{if(!s)setPanel(null);},[Boolean(s)]);
  const capture=(e:ReactPointerEvent<HTMLElement>)=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);};
  const hold=(input:Partial<SkateInput>,off:Partial<SkateInput>)=>({
    onPointerDown:(e:ReactPointerEvent<HTMLButtonElement>)=>{capture(e);p.onHold(input);},
    onPointerUp:()=>{p.onHold(off);p.onFocus();},onPointerCancel:()=>p.onHold(off),onLostPointerCapture:()=>p.onHold(off),
    onKeyDown:(e:React.KeyboardEvent<HTMLButtonElement>)=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();p.onHold(input);}},
    onKeyUp:(e:React.KeyboardEvent<HTMLButtonElement>)=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();p.onHold(off);}},onBlur:()=>p.onHold(off),
  });
  function action(a:SkateAction){p.onAction(a);p.onFocus();}
  if(!s)return <button className="skate-entry" type="button" onPointerDown={e=>e.stopPropagation()} onClick={()=>{p.onStart();p.onFocus();}}><span aria-hidden="true">◒</span><span><b>Skate the island</b><small>Your next line starts here · B</small></span><span aria-hidden="true">↗</span></button>;
  const route=s.run?SKATE_ROUTES.find(r=>r.id===s.run!.id):null,target=s.run&&!s.run.finished?route?.points[s.run.checkpoint]:null;
  return <div className="skate-hud" data-skate-mode={s.mode} onPointerDown={e=>e.stopPropagation()}>
    <div inert={panel?true:undefined} aria-hidden={panel?true:undefined}>
    <header className="skate-top"><div className="skate-wordmark"><span>Little Harbour</span><b>TIDELINE<span> SKATE CLUB</span></b></div><nav aria-label="Skate session"><button type="button" onClick={()=>show('routes')}>Explore</button><button type="button" onClick={()=>show('decks')}>Decks</button><button type="button" aria-label="Skate controls and trick guide" onClick={()=>show('guide')}>?</button><button type="button" onClick={p.onWalk}>Walk</button></nav></header>
    <div className="skate-score" aria-label={`Current combo ${s.combo} times ${s.multiplier}. Session score ${s.score}`}>
      <div className="skate-score__eyebrow">{s.combo?'KEEP THE LINE ALIVE':'FREE SKATE'}<span>{(s.speed*3.6).toFixed(0)} <small>km/h</small></span></div>
      <div className="skate-score__number">{format(s.combo||s.score)}<span>×{s.multiplier}</span></div>
      <div className="skate-score__trick" role="status">{s.event}</div>
      {s.combo>0&&<><div className="skate-chain">{s.tricks.slice(-3).join(' + ')}</div><div className="skate-combo-meter" aria-hidden="true"><i style={{transform:`scaleX(${s.comboTime})`}}/></div></>}
      <small>Best line {format(Math.max(s.best,s.progress.bestLine))} · {s.progress.discovered.length}/6 spots</small>
    </div>
    {s.balancing&&<div className="skate-balance" role="meter" aria-label="Board balance" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(s.balance*100)}><span>Balance · steer gently</span><div><i style={{left:`${50+s.balance*45}%`}}/></div></div>}
    {route&&s.run&&<div className="skate-route-live"><b>{route.name}</b><span>{s.run.finished?`${s.run.medal} · ${s.run.elapsed.toFixed(1)}s`:s.run.countdown>0?`Ready · ${Math.ceil(s.run.countdown)}`:`${s.run.elapsed.toFixed(1)}s · Gate ${s.run.checkpoint}/${route.points.length-1}`}</span>{target&&<small>{Math.round(Math.hypot(s.x-target[0],s.z-target[1]))} m to the gold ring</small>}<button type="button" aria-label="End route and free skate" onClick={()=>p.onRoute(null)}>×</button></div>}
    <div className="skate-radar" aria-label={target?'Map to your next checkpoint':'Skate spot map'}><svg viewBox="-78 -78 156 156" role="img" aria-label="Harbour skate map"><circle r="72" fill="currentColor" opacity=".1"/>{SKATE_SPOTS.map(spot=><circle key={spot.id} cx={spot.x} cy={spot.z} r={s.progress.discovered.includes(spot.id)?3.5:2} className="skate-radar__spot"/>)}{route&&<polyline points={route.points.map(a=>a.join(',')).join(' ')} fill="none" stroke="currentColor" opacity=".5" strokeDasharray="3 3"/>}{target&&<circle cx={target[0]} cy={target[1]} r="5" fill="none" stroke="currentColor" strokeWidth="2"/>}<path d="M0 5 L-3 -3 L3 -3Z" transform={`translate(${s.x} ${s.z}) rotate(${-s.yaw*180/Math.PI})`} className="skate-radar__you"/></svg><span>{p.partnerName?`Riding with ${p.partnerName}`:'Make yourself at home'}</span></div>
    <div className={`skate-discovery${notice||p.saveFailed?'':' is-quiet'}`} role="status">{notice}{p.saveFailed&&<small>Progress is only in this session; device saving is unavailable.</small>}</div>
    <div className="skate-inputs" aria-label="Skate controls">
      <div className="skate-steering" role="group" aria-label="Steer and push"><button type="button" aria-label="Steer left" {...hold({steer:-1},{steer:0})}>↶</button><button className="skate-push" type="button" {...hold({push:1},{push:0})}>Push</button><button type="button" aria-label="Steer right" {...hold({steer:1},{steer:0})}>↷</button><button className="skate-brake" type="button" {...hold({brake:true},{brake:false})}>Brake</button></div>
      <div className="skate-tricks" role="group" aria-label="Tricks"><button type="button" className="skate-ollie" onClick={()=>action('ollie')}>Ollie <kbd>J</kbd></button><button type="button" onClick={()=>action(trick)}>Flip <kbd>F</kbd></button><button type="button" {...hold({grind:true},{grind:false})}>Grind <kbd>G</kbd></button><button type="button" {...hold({manual:true},{manual:false})}>Manual <kbd>M</kbd></button></div>
    </div>
    <div className="skate-bottom"><span>W push · A/D carve · S brake · J ollie · F flip · G grind · M manual · R reset</span><button type="button" onClick={toggleSound} aria-pressed={sound} aria-label={sound?'Turn skate sound off':'Turn skate sound on'}>{sound?'Sound on':'Sound off'}</button><button type="button" onClick={()=>action('marker')}>Marker</button><button type="button" onClick={()=>action('respawn')}>Retry</button><button type="button" onClick={()=>{p.onPause(!s.paused);p.onFocus();}}>{s.paused?'Resume':'Pause'}</button></div>
    {s.paused&&!panel&&<div className="skate-pause"><b>Take a breath.</b><span>Your session is paused.</span><button type="button" onClick={()=>{p.onPause(false);p.onFocus();}}>Back to the ride</button></div>}
    </div>
    {panel&&<div className="skate-panel-shade" aria-hidden="true" onClick={close}/>}
    {panel&&<section className="skate-panel" role="dialog" aria-modal="true" aria-labelledby="skate-panel-title" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),select,input:not(:disabled)'));const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
      <header><div><span>THE ISLAND IS YOURS</span><h2 id="skate-panel-title">{panel==='routes'?'Find your next line':panel==='decks'?'A board of your own':'A little practice. A lot of freedom.'}</h2></div><button type="button" aria-label="Close skate panel" ref={closeRef} onClick={close}>×</button></header>
      {panel==='routes'&&<><p>Follow the roads, find all six spots, or chase a gold ring. Ride at your own pace; every route is optional.</p><div className="skate-route-list">{SKATE_ROUTES.map(r=><button type="button" key={r.id} onClick={()=>{setPanel(null);p.onRoute(r.id);p.onFocus();}}><span className="skate-route-mark" aria-hidden="true">↗</span><span><b>{r.name}</b><small>{r.detail}</small></span><span>{s.progress.routeBest[r.id]?`${s.progress.routeBest[r.id]!.toFixed(1)}s`:`${r.seconds[0]}s gold`} →</span></button>)}</div><h3>The spot book</h3><div className="skate-spots">{SKATE_SPOTS.map(spot=>{const discovered=s.progress.discovered.includes(spot.id);return <button type="button" key={spot.id} disabled={!discovered&&spot.id!=='tideline'} onClick={()=>{setPanel(null);p.onSpot(spot.id);p.onFocus();}}><b>{spot.name}</b><small>{discovered?'Discovered · session here':spot.id==='tideline'?'Start at the park':`${spot.x<0?'West':'East'} island · find it on your board`}</small></button>;})}</div>{p.presence&&<div className="skate-sharing">{p.presence}</div>}<p className="skate-note">Explore with Bianca by both turning on Walk together. Her live rider appears while she is sharing this island.</p></>}
      {panel==='decks'&&<><p>Every deck rides the same. Find quiet corners of the island to collect the rest.</p><div className="skate-decks">{SKATE_DECKS.map(d=><button type="button" key={d.id} disabled={s.progress.discovered.length<d.discoveries} aria-pressed={s.progress.deck===d.id} onClick={()=>p.onDeck(d.id)}><span className="skate-deck-art" style={{background:d.colour,color:d.ink}} aria-hidden="true"><i>H</i><em>HARBOUR</em></span><b>{d.name}</b><small>{d.discoveries>s.progress.discovered.length?`Find ${d.discoveries} spots`:s.progress.deck===d.id?'Under your feet':'Ready to ride'}</small></button>)}</div><h3>Little milestones</h3><div className="skate-stamps">{SKATE_STAMPS.map(t=><div key={t.id} data-earned={s.progress.stamps.includes(t.id)}><span aria-hidden="true">{s.progress.stamps.includes(t.id)?'✦':'◇'}</span><b>{t.name}</b><small>{t.hint}</small></div>)}</div></>}
      {panel==='guide'&&<><p>Push to gather speed, then let go and coast. Carve with left and right. Your board keeps its momentum in the air.</p><ol className="skate-lessons"><li><b>Start a line</b><span>W / ↑ pushes. A / D carves. S / ↓ brakes. Shift pushes harder. B puts the board away. The large buttons do the same on a phone.</span></li><li><b>Pop, flip, catch</b><span>J ollies. F kickflips, H heelflips, V shuvits, T 360-flips, and L grabs. Tricks pop from the ground or follow a finished air trick. Steer in the air for a 180 or 360; face along your travel when you land.</span></li><li><b>Find the rail</b><span>Ollie towards a rail along its length, then hold G / Grind as you come down. Steer gently against the balance needle. Release to ride off, or ollie out.</span></li><li><b>Keep it alive</b><span>Hold M / Manual on flat ground to connect tricks. New tricks grow the multiplier; repeating one is worth less. Ride cleanly for 2.4 seconds to bank the combo.</span></li><li><b>Make it yours</b><span>Stop and Set marker to save a practice start. R / Retry takes you back and ends an active route. P pauses. Space still opens all Hearth tools.</span></li></ol><label className="skate-trick-select">Phone flip button<select value={trick} onChange={e=>setTrick(e.target.value as SkateTrick)}><option value="kickflip">Kickflip</option><option value="heelflip">Heelflip</option><option value="shuvit">Pop shuvit</option><option value="360-flip">360 flip</option><option value="grab">Melon grab</option></select></label><p className="skate-note">Scores and discoveries belong to this person on this device. They never move money or change your household’s Journey. Reduced motion keeps the riding and quiets the extra motion.</p></>}
    </section>}
  </div>;
}
