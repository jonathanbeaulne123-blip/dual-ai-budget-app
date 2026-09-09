import { useId } from "react";
import type { ThemeScene } from "./scenes.ts";
import { useAppearance, useAtmosphereVisibility } from "./ThemeProvider.tsx";
import { Sprig } from "./LivingArtwork.tsx";

function RedGuitar() {
  return <g transform="rotate(15 75 100)"><path d="M63 68Q28 41 24 88Q7 108 30 137Q68 171 104 136Q129 108 105 88Q116 49 82 66Z" fill="#b92543" stroke="#6e2838" strokeWidth="2"/><path d="M63 89H88V104H63Z" fill="#252d33"/><path d="M69 15H81V114H69Z" fill="#574431" stroke="#dbbd8f" strokeWidth="2"/><path d="M67 5H85V28H67Z" fill="#c52c46"/><path d="M66 117H87" stroke="#d8c5a9" strokeWidth="5"/><path d="M73 18V121M77 18V121" stroke="#f5d5b5" strokeWidth="1"/>{[[36,94],[44,124],[96,108],[40,81],[82,139]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="2" fill="#ffc8a8"/>)}</g>;
}
function Lipstick() {
  return <g transform="rotate(-12 40 80)"><rect x="25" y="73" width="37" height="61" rx="3" fill="#2b2c32"/><path d="M27 67H60V86H27Z" fill="#c5a780"/><path d="M32 67V36Q32 22 54 14V67Z" fill="#c02c49"/><path d="M30 125H56" stroke="#e2cab1" strokeWidth="2"/></g>;
}
function Container({colour="#416d84"}:{colour?:string}) {
  return <g><rect width="180" height="74" rx="2" fill={colour} stroke="#536b74" strokeWidth="2"/>{Array.from({length:15},(_,i)=><path key={i} d={`M${7+i*12} 7V68`} stroke="#e1eef0" strokeWidth="2" opacity=".23"/>)}<path d="M0 4H180M0 71H180" stroke="#d2ba57" strokeWidth="4"/></g>;
}
function DiscoBall() {
 return <g><path d="M75 0V30" stroke="#879ac0"/><circle cx="75" cy="88" r="58" fill="#b8cfeb" stroke="#5f7fae" strokeWidth="2"/>{[-2,-1,0,1,2].map(i=><ellipse key={i} cx="75" cy="88" rx={Math.abs(i)*17+4} ry="58" fill="none" stroke="#eef3fb" strokeWidth="2"/>)}{[56,74,93,112].map(y=><path key={y} d={`M23 ${y}Q75 ${y+12} 127 ${y}`} stroke="#f4f1fc" strokeWidth="2" fill="none"/>)}<path d="M136 36v18m-9-9h18" stroke="#e8cda1" strokeWidth="2"/></g>;
}
function MoonstoneRecord() {
  return <g><circle cx="76" cy="90" r="66" fill="#466783" stroke="#c0d2df" strokeWidth="2"/><path d="M18 74Q70 14 124 52T23 123M30 43Q91 100 136 64M20 117Q68 70 126 130" fill="none" stroke="#91b1c7" strokeWidth="13" opacity=".4"/>{[39,47,55,62].map(r=><circle key={r} cx="76" cy="90" r={r} fill="none" stroke="#d6e0de" opacity=".25"/>)}<circle cx="76" cy="90" r="23" fill="#e4d8be"/><circle cx="76" cy="90" r="4" fill="#23354b"/></g>;
}
function Lighthouse() {
  return <g><path d="M48 178L59 60H96L107 178Z" fill="#fff9e9" stroke="#637985" strokeWidth="2"/><path d="M51 61H104V40H51ZM47 40L77 20 108 40Z" fill="#ad584e"/><path d="M60 47H95V56H60" stroke="#fff2c5" strokeWidth="3"/><path d="M67 178V148H86V178" fill="#526773"/><path d="M70 87H84V102H70Z" fill="#8eaab2"/><path d="M60 124H94" stroke="#d4cdbc" strokeWidth="2"/></g>;
}
function Umbrella() {
  return <g><path d="M14 86Q20 19 76 21Q134 27 140 86Q121 70 107 87Q88 71 74 86Q49 70 35 86Q24 76 14 86Z" fill="#e6bd43" stroke="#6f6c4d" strokeWidth="2"/><path d="M76 21Q45 39 35 86M76 21Q91 33 107 87M76 13V151Q76 177 97 162" fill="none" stroke="#586a72" strokeWidth="3"/></g>;
}
export function CalendarOrnament({scene}:{scene:ThemeScene}) {
  if(scene.id==="red")return <RedGuitar/>;
  if(scene.id==="midnights")return <DiscoBall/>;
  if(scene.id==="rain")return <Umbrella/>;
  if(scene.id==="cape-spear")return <Lighthouse/>;
  return <g><rect x="27" y="26" width="100" height="125" rx="3" fill="#fff8e8" stroke="#a28c6d" strokeWidth="2"/><path d="M28 51H126" stroke="#b67b57" strokeWidth="17"/><path d="M48 14V37M106 14V37" stroke="#697e63" strokeWidth="5"/>{[0,1,2].map(y=><path key={y} d={`M43 ${78+y*24}h68`} stroke="#c3c9ac" strokeWidth="8"/>)}<g transform="translate(99 98) scale(.4)"><Sprig/></g></g>;
}
function SceneLandscape({scene,wide=false}:{scene:ThemeScene;wide?:boolean}) {
  const id=useId().replace(/:/g,"");
  return <>
    <defs><linearGradient id={id} x2="0" y2="1"><stop stopColor={scene.id==="midnights"?"#c1c9eb":scene.id==="red"?"#e1c2a5":scene.id==="rain"?"#9bb9c4":scene.id==="cape-spear"?"#c7d5d9":"#dce0c8"}/><stop offset="1" stopColor={scene.id==="midnights"?"#eee7f3":scene.id==="red"?"#f8ecdc":scene.id==="rain"?"#e2ebe5":scene.id==="cape-spear"?"#f2f1df":"#f6ecda"}/></linearGradient></defs>
    <rect width="1600" height="600" fill={`url(#${id})`} opacity={wide?'.5':'0'}/>
    {scene.id==="red"?<>
      <path className="living-ribbon" d="M70-20Q10 170 128 218T54 510M1540-20Q1410 120 1520 294T1495 621" stroke="#b62643" strokeWidth="13" fill="none" opacity=".7"/>
      <g transform={wide?"translate(-25 235) scale(1.7)":"translate(1100 65) scale(2.7)"}><RedGuitar/></g>
      <g transform="translate(1460 340) scale(1.5)"><Lipstick/></g>
      <g transform={wide?"translate(1450 55)":"translate(1370 25)"} fill="#d73e55" stroke="#e98a93" strokeWidth="3"><path d="M0 20C-30-10-48 24 0 59C48 24 30-10 0 20ZM84 20C54-10 36 24 84 59C132 24 114-10 84 20Z"/><path d="M27 24H57" fill="none"/></g>
      <g transform="translate(18 500) rotate(-8)" fill="#292a2d"><path d="M0 18H160V23H0ZM0 34H103V39H0"/><path d="M0 50H122V56H0" fill="#b62643"/></g>
    </>:scene.id==="midnights"?<>
      <path d="M-50 71Q200-24 305 179T800 313T1630 123M-50 382Q276 218 496 437T1100 448T1670 321" stroke="#7797ca" strokeWidth="60" fill="none" opacity=".18"/>
      <g transform={wide?"translate(-85 285) scale(2.5)":"translate(1110 70) scale(2.5)"}><MoonstoneRecord/></g>
      {[[88,91],[269,229],[1511,76],[1371,292],[1430,485],[135,512],[810,34]].map(([x,y],i)=><g key={i} stroke="#6d79a0"><path d={`M${x} ${(y??0)-5}v10m-5-5h10`} strokeWidth="1.5"/><circle cx={x} cy={y} r="14" fill="#efd4a1" stroke="none" opacity=".04"/></g>)}
      <g transform="translate(1430 25)"><DiscoBall/></g>
      <g transform="translate(1450 410)"><circle r="42" fill="#203347" stroke="#c1cdd3" strokeWidth="2"/><path d="M0-28V0L20 9" stroke="#e4c889" strokeWidth="3" fill="none"/></g>
    </>:scene.id==="rain"?<>
      <path d="M0 470Q400 380 850 460T1600 467V600H0Z" fill="#87adb4" opacity=".3"/>
      <path d="M0 292Q259 166 519 265T1030 225T1600 281V415H0Z" fill="#7e9390" opacity=".24"/>
      <g transform={wide?"translate(-62 320)":"translate(990 342)"}><Container/><g transform="translate(12 -79)"><Container colour="#618196"/></g><g transform="translate(185 0)"><Container colour="#b98069"/></g><g transform="translate(184 -79)"><Container colour="#d2b952"/></g></g>
      <g transform={wide?"translate(1450 152)":"translate(1340 30)"} fill="none" stroke="#5f8199" strokeWidth="5"><path d="M30 370V124L179 10 202 28 52 157M30 126L202 28M30 148V353M179 11V265"/><path d="M46 124l20 16m8-42 18 15m9-37 18 15m9-37 18 15m7-36 18 14" strokeWidth="2"/><path d="M164 265h29v9h-29" stroke="#d6b94b" strokeWidth="5"/></g>
      <g transform={wide?"translate(1450 336)":"translate(1420 297)"}><Umbrella/></g>
      <g className="calendar-rain" stroke="#4c8296" opacity=".42" strokeWidth="2">{Array.from({length:18},(_,i)=><path key={i} d={`M${i<9?i*28:1355+(i-9)*30} ${27+(i%5)*76}l-10 28`}/>)}</g>
      <g className="living-water" fill="none" stroke="#dff1ef" strokeWidth="3"><ellipse cx="116" cy="515" rx="100" ry="12"/><ellipse cx="1490" cy="549" rx="90" ry="9"/></g>
    </>:scene.id==="cape-spear"?<>
      <circle cx="1190" cy="102" r="64" fill="#fffce7" opacity=".5"/>
      <path d="M0 275Q800 235 1600 272V600H0Z" fill="#7babb8" opacity=".5"/>
      <path d="M0 387L153 359 271 451 353 483 595 600H0ZM1600 299L1427 345 1369 450 1243 479 1120 600H1600Z" fill="#879a8c"/>
      <path d="M0 420L153 390 271 481 421 552M1600 333L1448 387 1400 471 1311 507" fill="none" stroke="#b7b5a0" strokeWidth="10"/>
      <g transform={wide?"translate(1420 89) scale(1.5)":"translate(1290 80) scale(1.2)"}><Lighthouse/></g>
      <path className="living-water" d="M290 315q80-11 160 0t160 0M900 380q80-11 160 0t160 0M620 466q80-11 160 0" fill="none" stroke="#f4f3db" strokeWidth="3"/>
      <g transform="translate(20 407)"><Sprig/></g><g transform="translate(1490 450)"><Sprig/></g>
    </>:<>
      <path d="M0 36H1600M0 575H1600" stroke="#bc9a75" strokeWidth="3" opacity=".4"/>
      <g transform={wide?"translate(-5 84) scale(1.5)":"translate(1180 31) scale(2.2)"}><CalendarOrnament scene={scene}/></g>
      <g transform="translate(1440 376) scale(1.3)"><Sprig/></g>
      <g transform="translate(24 432)"><ellipse cx="56" cy="79" rx="64" ry="20" fill="none" stroke="#b89777" strokeWidth="4" opacity=".35"/><path d="M20 35H93L85 87H28Z" fill="#fff8e8" stroke="#c4b698" strokeWidth="2"/><path d="M92 47q38-9 27 21q-3 12-30 8" fill="none" stroke="#fff8e8" strokeWidth="9"/><path className="living-steam" d="M45 20q-15-18 0-34M66 20q15-18 0-34" fill="none" stroke="#a9b49b" strokeWidth="3"/></g>
    </>}
    {(scene.id==="rain"||scene.id==="cape-spear")&&<path className="calendar-fog" d="M-90 152Q310 48 700 160T1700 120V228Q1250 170 890 253T-90 249Z" fill="#f3f5ec" opacity=".25"/>}
  </>;
}
export function CalendarHeadingArtwork({scene}:{scene:ThemeScene}) {
  return <svg className="scene-artwork calendar-heading-art" viewBox="0 0 1600 600" preserveAspectRatio="xMaxYMid meet" aria-hidden="true" focusable="false"><SceneLandscape scene={scene}/></svg>;
}
function CalendarSceneryPanel({index}:{index:number}) {
  const {scene}=useAppearance();const ref=useAtmosphereVisibility();
  return <div ref={ref} className={`calendar-scenery-panel calendar-scenery-${index}`}><svg viewBox="0 0 1600 600" preserveAspectRatio="xMidYMid meet" focusable="false"><SceneLandscape scene={scene} wide/></svg></div>;
}
export function CalendarScenery() {
  return <div className="calendar-scenery">{[0,1,2].map(i=><CalendarSceneryPanel key={i} index={i}/>)}</div>;
}

export function CalendarBinding({planner=false}:{planner?:boolean}) {
 const {scene}=useAppearance();const ref=useAtmosphereVisibility();
 return <div ref={ref} className={"calendar-binding"+(planner?" is-planner":"")} aria-hidden="true"><span className="calendar-binding-rings"/><svg viewBox="0 0 150 180" focusable="false"><CalendarOrnament scene={scene}/></svg><span className="calendar-binding-lines"/></div>;
}
