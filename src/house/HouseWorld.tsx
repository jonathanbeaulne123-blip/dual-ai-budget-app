import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { DateKey } from "../core/calendar.ts";
import type { Household, LedgerView, KittyGlaze } from "../core/types.ts";
import { publishFurniture, unpublishFurniture } from "../core/officeLayout.ts";
import { formatCad } from "../core/money.ts";
import { cellarJars } from "../core/queenCellar.ts";
import { kittyBankBackingStep } from "../core/kittyBanks.ts";
import { queenBankPiece, queenBankFired, queenBankGlaze } from "../queen/world/queenAuthoring.ts";
import { booksPresentationFloor, householdWallet, projectHouseholdFund } from "../core/index.ts";
import { readHouseReturn, saveHouseReturn, houseIdentity } from "./navigation.ts";
import { houseCameraRoute, houseCameraSlot, houseComposition, sameHouseCameraRoute } from "./returnCache.ts";
import { projectKittyNest } from "../core/kittyNest.ts";
import { HOUSE_LEVELS, HOUSE_ROOMS, type HouseRoute, type HouseRoom, type HouseLevel } from "../hearthside/houseRoutes.ts";
import { useAppearance } from "../theme/ThemeProvider.tsx";
import { HOUSE_PLACES, ROOM_NAMES } from "./navigation.ts";
import { DEFAULT_QUEEN_STYLE, type QueenStyle } from "./queenStyle.ts";
import type { HouseRuntime } from "./world/runtime.ts";
import { renderTierFor } from "./world/tier.ts";
import { livingEvidence } from "./interpretation.ts";
import { interpretationSourceRevision, supportedAtFor, useSupportedHouseInterpretation, type InterpretationGate } from "./supportedInterpretation.ts";
import { houseTargets } from "./houseTargets.ts";
import { QueenDressing } from "./QueenDressing.tsx";
import "./houseWorld.css";


type Props={household:Household;memberId:string;scope:LedgerView;today:DateKey;route:HouseRoute;ready:boolean;freshness:string;interpretationGate?:InterpretationGate;onNavigate:(room:HouseRoom,level:HouseLevel,replace?:boolean)=>void;onOpen:(target:string,object?:string)=>void;onClose:()=>void};
export function HouseWorld({household,memberId,scope,today,route,ready,freshness,interpretationGate,onNavigate,onOpen,onClose}:Props){
  const appearance=useAppearance(),theme=appearance.preview??appearance.saved.theme;
  const host=useRef<HTMLDivElement>(null),runtime=useRef<HouseRuntime|null>(null),buttons=useRef(new Map<string,HTMLElement>());
  const [status,setStatus]=useState<"loading"|"ready"|"fallback">("loading"),[overview,setOverview]=useState(false),[walking,setWalking]=useState(false),[preview,setPreview]=useState<QueenStyle|null>(null),[queenView,setQueenView]=useState<"front"|"back"|"roots"|"detail">("front");
  // Where the world says each object's control stands. The world never writes
  // to the controls itself: a write between two reads is a forced layout.
  const [twins,setTwins]=useState<Record<string,{x:number;y:number}>>({});
  const targets=houseTargets(scope,route.room,route.level);
  const place=HOUSE_PLACES[route.room][route.level],zone=`${route.room}:${route.level}`;
  const nest=useMemo(()=>projectKittyNest(household,memberId,scope,today),[household,memberId,scope,today]);
  const bankRows=useMemo(()=>nest.categories.flatMap(category=>category.children).filter(bank=>bank.tier==="goal"&&bank.state==="open"),[nest]);
  const jarRows=useMemo(()=>cellarJars(nest,household,today),[nest,household,today]);
  const homeObjects=useMemo(()=>({banks:bankRows.map(bank=>{const piece=queenBankPiece(bank);return {bank,piece,glaze:queenBankGlaze(bank) as KittyGlaze,fired:queenBankFired(piece),step:bank.goal?kittyBankBackingStep(household,bank.goal,today):0};}),jars:jarRows.map(jar=>({jar}))}),[bankRows,jarRows,household,today]);
  const identity={environment:household.environment,householdId:household.householdId,memberId,scope};
  const navigationRef=useRef(onNavigate);navigationRef.current=onNavigate;
  const routeRef=useRef(route);routeRef.current=route;
  const cameraMode=useRef({overview,walking});cameraMode.current={overview,walking};
  const pointerDown=useRef<{x:number;y:number}|null>(null);
  const position=useMemo(()=>{const fund=projectHouseholdFund(household,today);if(scope!=="household"||fund.configured)return {label:nest.sourceLabel,cents:nest.totalCents};const wallet=householdWallet(booksPresentationFloor(household,memberId,scope),today);return {label:"Shared operating cash · Fund not set up",cents:wallet.tiles.filter(tile=>tile.kind==="chequing"||tile.kind==="other").reduce((sum,tile)=>sum+tile.balanceCents,0)};},[household,memberId,scope,today,nest]);
  const commitment=useMemo(()=>nest.categories.flatMap(c=>c.children).filter(bank=>bank.date&&bank.state==="open").sort((a,b)=>a.date!.localeCompare(b.date!))[0],[nest]);
  const currentEvidence=useMemo(()=>livingEvidence(household,memberId,scope),[household.hearthside,household.personalLife,memberId,scope]);
  const supported=useSupportedHouseInterpretation({identity:{environment:household.environment,householdId:household.householdId,memberId,scope},gate:interpretationGate??{current:true,freshness:"current",detail:"Current local books"},current:{bloom:currentEvidence},fallback:{bloom:[]},sourceRevision:interpretationSourceRevision(household,scope),supportedAt:supportedAtFor(household,today)});
  const evidence=supported.value.bloom;
  const evidenceSignature=JSON.stringify(evidence);
  const currentDestination=useRef({zone,phoneTarget:place.target,target:undefined as string|undefined,overview,queenView:undefined as typeof queenView|undefined});
  currentDestination.current={zone,phoneTarget:place.target,target:route.surface==="queen"?"queen":undefined,overview,queenView:route.surface==="queen"?queenView:undefined};
  useEffect(()=>{
    const element=host.current;if(!element)return;let cancelled=false;setStatus("loading");
    void import("./world/runtime.ts").then(({mountHouseWorld})=>{
      if(cancelled)return;
      // A phone or a small machine carries the 3.5 MB court copy of her, not
      // the 12.9 MB master — the harbour's own routing, read the same way.
      const tier=renderTierFor(element.getBoundingClientRect().width||window.innerWidth);
      try{const world=mountHouseWorld(element,theme,()=>buttons.current,()=>setStatus("ready"),()=>setStatus("fallback"),(room,level)=>navigationRef.current(room as HouseRoom,level as HouseLevel,true),{tier,onProject:rows=>setTwins(Object.fromEntries(rows.map(row=>[row.id,{x:row.x,y:row.y}])))});runtime.current=world;world.go(currentDestination.current);world.setQueen(preview??appearance.saved.queen??DEFAULT_QUEEN_STYLE,evidence);world.setHome(homeObjects);world.setWalking(walking);}
      catch{setStatus("fallback");}
    }).catch(()=>setStatus("fallback"));
    return()=>{cancelled=true;runtime.current?.dispose();runtime.current=null;};
    // Theme changes replace scene resources, never scope data or the focused tool.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[theme]);
  useEffect(()=>{runtime.current?.go(currentDestination.current);},[zone,overview,route.surface,queenView,status]);
  useEffect(()=>{runtime.current?.setQueen(preview??appearance.saved.queen??DEFAULT_QUEEN_STYLE,evidence);},[preview,appearance.saved.queen,evidenceSignature]);
  useEffect(()=>{runtime.current?.setWalking(walking);},[walking,status]);
  useEffect(()=>{runtime.current?.setHome(homeObjects);},[homeObjects,status]);
  useEffect(()=>{
    const restore=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.identity===houseIdentity(identity)&&Array.isArray(detail.camera)&&detail.camera.length===3&&detail.camera.every(Number.isFinite))runtime.current?.go({...currentDestination.current,camera:detail.camera});};
    const remember=()=>{const current=routeRef.current;saveHouseReturn(localStorage,identity,current,{scroll:window.scrollY,focus:document.activeElement instanceof HTMLElement?document.activeElement.id||"house-world-title":"house-world-title"});if(!cameraMode.current.overview&&!cameraMode.current.walking&&!current.surface){const composition=houseComposition(host.current?.getBoundingClientRect().width||window.innerWidth);saveHouseReturn(localStorage,identity,houseCameraRoute(current),{camera:runtime.current?.camera(),cameraComposition:composition},houseCameraSlot(current,composition));}};
    const saved=readHouseReturn(localStorage,identity,houseCameraSlot(routeRef.current,houseComposition(host.current?.getBoundingClientRect().width||window.innerWidth)));if(saved?.camera&&sameHouseCameraRoute(saved.route,routeRef.current))runtime.current?.go({...currentDestination.current,camera:saved.camera});
    window.addEventListener("hearth:house-return",restore);window.addEventListener("pagehide",remember);
    return()=>{window.removeEventListener("hearth:house-return",restore);window.removeEventListener("pagehide",remember);};
  },[scope,memberId,household.householdId,status]);
  useEffect(()=>{if(overview)requestAnimationFrame(()=>host.current?.closest(".house-world")?.scrollIntoView({block:"start",behavior:"instant"}));},[overview]);
  useEffect(()=>{setOverview(false);setPreview(null);},[scope,memberId,household.householdId]);
  useLayoutEffect(()=>{
    const publish=()=>{const rect=host.current?.getBoundingClientRect();if(!rect||window.innerWidth<720||route.surface){unpublishFurniture("house-window");return;}const x=Math.max(220,rect.right-160),y=Math.max(180,Math.min(window.innerHeight-115,rect.top+rect.height*.65));publishFurniture({id:"house-window",kind:"sill",perchable:true,warn:false,rect:{x,y,w:140,h:12}});};
    publish();window.addEventListener("resize",publish);window.addEventListener("scroll",publish,{passive:true});return()=>{unpublishFurniture("house-window");window.removeEventListener("resize",publish);window.removeEventListener("scroll",publish);};
  },[zone,route.surface]);
  const choose=(target:string)=>{setOverview(false);onOpen(target);};
  const floorScroller=useRef<HTMLDivElement>(null),scrollLock=useRef(false),scrollTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>{const element=floorScroller.current;if(!element||route.surface)return;scrollLock.current=true;element.scrollTop=HOUSE_LEVELS.indexOf(route.level)*element.clientHeight;clearTimeout(scrollTimer.current);scrollTimer.current=setTimeout(()=>{scrollLock.current=false;},150);return()=>clearTimeout(scrollTimer.current);},[route.room,route.level,route.surface]);
  function floorScroll(){const element=floorScroller.current;if(!element||scrollLock.current||overview)return;clearTimeout(scrollTimer.current);scrollTimer.current=setTimeout(()=>{const index=Math.max(0,Math.min(2,Math.round(element.scrollTop/element.clientHeight))),level=HOUSE_LEVELS[index]!;if(level!==route.level)onNavigate(route.room,level,true);},160);}
  return <section className={`house-world house-world--${theme}${overview?" is-overview":""}${route.surface?" has-open-object":""}`} data-world-status={status} data-world-scope={scope} aria-label={`${scope==="personal"?"My":"Our"} house`}>
    <header className="house-world__header"><div><span className="house-world__scope">{scope==="personal"?"My private house":"Our home"}</span><h1 id="house-world-title" tabIndex={-1}>{overview?"The whole house":ROOM_NAMES[route.room]}<span> / {overview?"Choose a wing":place.title}</span></h1>{supported.statusLine&&<small className="house-world__supported" role="status">{supported.statusLine}</small>}</div><button onClick={()=>setOverview(value=>!value)} aria-pressed={overview}>{overview?"Return to room":"See the whole house"}</button></header>
    <div className="house-world__stage" tabIndex={walking?0:undefined} aria-label={walking?"Walking area. Arrow keys move your avatar through doorways and stairs. Tap a path to walk there. Furniture remains directly available.":undefined} onPointerDown={event=>{pointerDown.current={x:event.clientX,y:event.clientY};}} onPointerUp={event=>{const start=pointerDown.current;pointerDown.current=null;if(walking&&start&&Math.hypot(start.x-event.clientX,start.y-event.clientY)<8&&!(event.target as HTMLElement).closest("button,input,textarea,select,a"))runtime.current?.walkTo(event.clientX,event.clientY);}} onKeyDown={event=>{if(!walking||event.target!==event.currentTarget)return;if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)){event.preventDefault();runtime.current?.walk(event.key.slice(5).toLowerCase() as "left"|"right"|"up"|"down");}}}>
      <div className="house-world__canvas" ref={host}/>
      {status!=="ready"&&<HouseIllustration room={route.room} theme={theme}/>}
      <div className="house-world__vignette" aria-hidden="true"/>
      <nav className="house-world__levels" aria-label={`${ROOM_NAMES[route.room]} levels`}>{HOUSE_LEVELS.map(level=><button key={level} onClick={()=>{setOverview(false);onNavigate(route.room,level);}} aria-current={route.level===level?"location":undefined} aria-label={`${HOUSE_PLACES[route.room][level].title}, ${level==="above"?"upstairs":level==="below"?"downstairs":"main floor"}`}><span aria-hidden="true">{level==="above"?"↑":level==="below"?"↓":"·"}</span>{HOUSE_PLACES[route.room][level].title}</button>)}</nav>
      {overview?<nav className="house-world__section-nav" aria-label="Enter a wing">{HOUSE_ROOMS.map(room=><button key={room} onClick={()=>{setOverview(false);onNavigate(room,"middle");}}><span>{ROOM_NAMES[room]}</span><small>{HOUSE_PLACES[room].above.title} / {HOUSE_PLACES[room].below.title}</small></button>)}</nav>:<>
        <div className="house-world__anchors" aria-hidden={status!=="ready"}>{targets.map(({id,label})=>{const at=twins[id];return <button key={id} id={`house-object-${id}`} data-projected="true" hidden={!at} style={at?{left:`${at.x}px`,top:`${at.y}px`}:undefined} ref={element=>{if(element)buttons.current.set(id,element);else buttons.current.delete(id);}} onClick={()=>choose(id)}><span className="house-world__pin" aria-hidden="true">✦</span><span>{label}</span></button>;})}</div>
        {!route.surface&&<div className="house-world__floor-scroll" ref={floorScroller} onScroll={floorScroll} aria-label="Scroll through this wing">{HOUSE_LEVELS.map(level=><section className="house-world__floor" key={level} data-house-level={level} inert={level!==route.level} aria-label={HOUSE_PLACES[route.room][level].title}><div className="house-world__invitation"><p className="kicker">{ROOM_NAMES[route.room]} · {level==="above"?"Upstairs":level==="below"?"Downstairs":"Come inside"}</p><h2>{HOUSE_PLACES[route.room][level].title}</h2><p>{scope==="personal"&&route.room==="together"&&level==="middle"?"A studio and a quiet place for your own words.":HOUSE_PLACES[route.room][level].subtitle}</p><details className="house-world__object-actions" open={status==="fallback"}><summary>Room actions</summary><div>{houseTargets(scope,route.room,level).map(({id,label})=><button id={`house-action-${route.room}-${level}-${id}`} key={id} onClick={()=>choose(id)}>{label} <span aria-hidden="true">↗</span></button>)}</div></details></div></section>)}</div>}
      </>}
      <div className="house-world__walk"><button aria-pressed={walking} onClick={()=>setWalking(!walking)}>{walking?"Finish exploring":"Walk around"}</button>{walking&&<><button aria-label="Walk left" onClick={()=>runtime.current?.walk("left")}>←</button><button aria-label="Walk right" onClick={()=>runtime.current?.walk("right")}>→</button><button aria-label="Walk upstairs" onClick={()=>runtime.current?.walk("up")}>↑</button><button aria-label="Walk downstairs" onClick={()=>runtime.current?.walk("down")}>↓</button><small>Furniture opens with one tap.</small></>}</div>
      {route.surface&&<button className="house-world__put-back" onClick={onClose}>← Put it back in {place.title}</button>}
      {status==="fallback"&&<p className="house-world__fallback" role="status">Illustrated house · all room actions remain available.</p>}
    </div>
    {route.room==="home"&&route.level!=="middle"&&!route.surface&&<nav className="house-world__kept-objects" aria-label={route.level==="above"?"Your ceramic banks":"Your bill jars"}>{(route.level==="above"?bankRows.map(bank=>({id:bank.id,label:bank.name,paid:false})):jarRows.map(jar=>({id:jar.bankId,label:jar.label,paid:jar.paid}))).map(row=><button id={`house-bank-${row.id}`} key={row.id} onClick={()=>onOpen(route.level==="above"?"loft-banks":"cellar-bills",`bank/${row.id}`)}>{row.label}{row.paid?" · paid receipt":""}</button>)}</nav>}
    {route.room==="home"&&<aside className="house-world__position" aria-label="Dated position and next commitment"><div><small>{position.label} · {today}</small><strong>{ready?formatCad(position.cents):"Checking the books"}</strong><span>{freshness}</span></div><button onClick={()=>choose("cellar-bills")}><small>Next dated commitment</small><strong>{commitment?.name??"No dated commitment"}</strong><span>{commitment?`${commitment.date} · ${formatCad(commitment.targetCents)}`:"Add a date when you are ready"}</span></button></aside>}
    {route.surface==="queen"&&<QueenDressing key={`${scope}:${memberId}`} onPreview={setPreview} onView={setQueenView} evidence={evidence}/>}
    <nav className="house-world__doors" aria-label="House doorways">{HOUSE_ROOMS.map(room=><button key={room} aria-current={room===route.room?"page":undefined} onClick={()=>{setOverview(false);onNavigate(room,"middle");}}><span className="house-world__door" aria-hidden="true"/><span>{ROOM_NAMES[room]}</span></button>)}</nav>
  </section>;
}
function HouseIllustration({room,theme}:{room:HouseRoom;theme:string}){
  return <svg className="house-world__illustration" viewBox="0 0 1200 650" role="img" aria-label="An illustrated cutaway of the connected wings" style={{"--active-wing":HOUSE_ROOMS.indexOf(room)} as CSSProperties}><defs><linearGradient id="house-illustrated-sky" x2="0" y2="1"><stop stopColor={theme==="newfoundland"?"#b0cbd2":theme==="taylor"?"#ecd5d7":"#d3c3a7"}/><stop offset="1" stopColor="#647e77"/></linearGradient></defs><rect width="1200" height="650" fill="url(#house-illustrated-sky)"/>{HOUSE_ROOMS.map((wing,i)=><g key={wing} transform={`translate(${50+i*(1100/HOUSE_ROOMS.length)} 80) scale(${4/HOUSE_ROOMS.length})`} opacity={room===wing?1:.76}><path d="M0 60L130 0 260 60V490H0Z" fill={theme==="taylor"?["#e4bdc3","#aaa298","#d8c691","#b7c2aa","#cbb7cd"][i]:theme==="newfoundland"?["#b75a4e","#488c98","#c9ae5a","#608778","#8a6f50"][i]:"#b59a73"} stroke="#554e3d" strokeWidth="12"/>{[0,1,2].map(y=><g key={y} transform={`translate(18 ${80+y*132})`}><rect width="224" height="118" fill={y===0?"#cfbfa0":y===1?"#eee0bd":"#827c67"}/><rect x="20" y="14" width="48" height="57" rx="22" fill="#b4d0cf" stroke="#796548" strokeWidth="6"/><path d="M3 110H225" stroke="#5f4a36" strokeWidth="12"/><path d="M86 89H184M101 90V109M171 90V109" stroke="#765342" strokeWidth="10"/>{i===0?<g fill="#7f8b54"><ellipse cx="131" cy="74" rx="22" ry="29"/><path d="M123 72L101 32M134 67L150 20" stroke="#66734b" strokeWidth="7"/></g>:i===1?<path d="M97 84V52L131 64 168 51V82L132 96Z" fill="#f4e8c7" stroke="#565244" strokeWidth="5"/>:i===2?<ellipse cx="137" cy="77" rx="37" ry="13" fill="#456b58"/>:<g><rect x="95" y="34" width="85" height="44" fill="#ece0b8" stroke="#836a46" strokeWidth="7"/><ellipse cx="136" cy="80" rx="16" ry="24" fill="#c2795d"/></g>}</g>)}</g>)}</svg>;
}
