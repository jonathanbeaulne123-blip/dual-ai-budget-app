import type { ThemeScene } from './scenes.ts';
import { useAppearance, useAtmosphereVisibility } from './ThemeProvider.tsx';
import { Sprig } from './LivingArtwork.tsx';

function Guitar({gold=false}:{gold?:boolean}) {
 return <g transform="rotate(18 75 105)"><path d="M59 79Q24 49 25 92Q-1 127 32 155Q70 181 109 151Q134 121 107 92Q109 50 82 78Z" fill={gold?'#d8c9ad':'#d7a569'} stroke="#795b3a" strokeWidth="3"/><circle cx="69" cy="111" r="17" fill="#584433" stroke="#f5e4b5" strokeWidth="4"/><path d="M61 18H77V115H61Z" fill="#876447"/><path d="M58 3H81V29H58Z" fill="#b78c57" stroke="#785739" strokeWidth="2"/><path d="M51 147H89" stroke="#604f3d" strokeWidth="6"/><path d="M65 12V147M70 12V147M74 12V147" stroke="#fff5da" strokeWidth="1"/>{gold&&<g className="plan-glimmer" fill="#fffdf1">{[[35,94],[99,106],[41,140],[88,153],[23,122]].map(([x,y],i)=><path key={i} d={`M${x} ${(y??0)-5}l2 4 5 1-5 2-2 4-1-4-5-2 5-1Z`}/>)}</g>}</g>;
}
function Boot(){return <g><path d="M35 15Q62 26 91 15L82 98Q91 123 118 134Q135 148 114 154H41Q24 149 26 126L35 88Z" fill="#fff9e9" stroke="#aa906c" strokeWidth="3"/><path d="M26 132H46V159H27M46 153H118" stroke="#8c7456" strokeWidth="5"/><path d="M47 37Q63 74 79 37M43 59Q64 95 83 58M52 39L61 47 73 37" stroke="#d4ba82" strokeWidth="3" fill="none"/></g>;}
function Butterfly(){return <g className="plan-butterfly"><path d="M73 71Q21 5 18 52Q12 82 63 88Q14 90 40 120Q58 135 73 91Q90 135 109 118Q130 88 83 88Q134 79 125 42Q114 9 76 72Z" fill="#58bdb5" stroke="#347c84" strokeWidth="2"/><path d="M75 66V100M74 68L64 53M77 68L86 53" fill="none" stroke="#356a71" strokeWidth="3"/><path d="M35 53L63 77M108 49L86 78" stroke="#d0f0da" strokeWidth="3"/></g>;}
function Daisy(){return <g><path d="M65 159Q94 112 75 56" fill="none" stroke="#688958" strokeWidth="4"/><path d="M73 129Q21 102 42 93Q68 85 78 114M79 111Q112 71 123 89Q128 105 79 120" fill="#91ac75"/>{Array.from({length:8},(_,i)=><ellipse key={i} cx="75" cy="32" rx="9" ry="22" fill="#fffdf1" stroke="#e0dcb8" transform={`rotate(${i*45} 75 57)`}/>)}<circle cx="75" cy="57" r="13" fill="#d9b656"/></g>;}
function Mug(){return <g><ellipse cx="70" cy="149" rx="59" ry="12" fill="none" stroke="#b69778" strokeWidth="3" opacity=".5"/><path d="M29 76H104L95 137Q68 151 39 137Z" fill="#fcf3dc" stroke="#b39a7c" strokeWidth="3"/><path d="M104 85Q143 73 134 104Q130 119 101 116" fill="none" stroke="#b39a7c" strokeWidth="7"/><ellipse cx="66" cy="77" rx="37" ry="9" fill="#806346"/><path className="living-steam" d="M51 58q-19-19 0-38M76 59q20-19 0-39" stroke="#81927b" strokeWidth="3" fill="none"/></g>;}
function PinNote(){return <g><rect x="17" y="26" width="112" height="130" rx="3" fill="#fff7dc" stroke="#b49e76" strokeWidth="2"/><path d="M38 63H109M38 83H95M38 103H108M38 123H80" stroke="#a8ae91" strokeWidth="3"/><path d="M75 14V43" stroke="#6a6f55" strokeWidth="3"/><circle cx="75" cy="22" r="9" fill="#a66d4f"/></g>;}
function Gulls(){return <g className="plan-gulls" fill="none" stroke="#eef6ed" strokeWidth="4"><path d="M12 67q20-20 40 0q20-20 40 0M71 104q14-14 28 0q14-14 28 0"/></g>;}
export function PlanOrnament({scene}:{scene:ThemeScene}) {
 return scene.id==='fearless'?<Guitar gold/>:scene.id==='debut'?<Butterfly/>:scene.theme==='newfoundland'?<g><path d="M7 137L52 80 82 113 121 63 147 137Z" fill="#839f7e"/><path d="M15 151H143" stroke="#5c9cad" strokeWidth="7"/><Gulls/></g>:<PinNote/>;
}
function Coast({summit=false}:{summit?:boolean}) {
 return <><path d="M0 240Q710 200 1600 238V600H0Z" fill="#76adbf" opacity=".65"/><path d="M-30 330L110 263 202 313 327 430 425 600H0ZM1600 222L1460 237 1311 297 1257 376 1170 422 1110 600H1600Z" fill="#6c8984"/><path d="M-30 325L110 253 202 303 327 420M1600 215L1460 227 1311 287 1257 366 1170 412" fill="none" stroke="#b8b48a" strokeWidth="17"/><path d="M50 600Q236 492 188 390T117 283" fill="none" stroke="#dfd4ad" strokeWidth="17"/>
 <path className="living-water" d="M300 292q90-10 180 0t180 0M850 380q90-10 180 0M550 490q110-12 220 0" fill="none" stroke="#e5f0e3" strokeWidth="3"/>
 <path className="plan-cloud" d="M-50 186Q190 145 377 191T816 167T1680 157" stroke="#fff9e8" strokeWidth="32" fill="none" opacity=".4"/>
 <g transform="translate(1290 65)"><Gulls/></g><g transform="translate(76 92) scale(.7)"><Gulls/></g>
 {summit?<g fill="#9da69b" stroke="#dce4d6" strokeWidth="4"><path d="M0 523L204 475 293 503V600H0ZM1600 485L1462 505 1400 600H1600Z"/>{[0,1,2,3,4].map(i=><path key={i} d={`M${i*53} ${523-i*11}v77m-20-40h60`}/>)}</g>:<g>{[0,1,2,3].map(i=><g key={i} transform={`translate(${1330+i*54} ${328-i*17})`}><path d="M0 16L24 0 47 16V66H0Z" fill={['#f4eddc','#bc6e5a','#e3c46b','#d9e8e0'][i]} stroke="#597780" strokeWidth="2"/><path d="M7 14L24 4 40 14M9 29H18V40H9ZM29 29H38V40H29Z" fill="#f6faf1"/><path d="M20 66V48H30V66" fill="#526d76"/></g>)}</g>}
 <g className="plan-leaves" fill="#b4ad5d">{[0,1,2,3,4].map(i=><g key={i} transform={`translate(${i%2?1510:35} ${360+i*45})`}><path d="M0 55Q-11 22 11 0M0 40Q-44 10-39 31Q-29 49 0 40M0 25Q44-6 35 18Q24 36 0 25"/></g>)}</g></>;
}
function Landscape({scene,variant=0,heading=false}:{scene:ThemeScene;variant?:number;heading?:boolean}) {
 const gold=scene.id==='fearless';
 if(scene.theme==='newfoundland')return variant===0?<Coast summit={scene.id==='summit'}/>:<>
  <path className="living-water" d="M40 176q75-12 150 0M1340 335q90-10 180 0M34 475q70-9 140 0" fill="none" stroke="#f2f7e9" strokeWidth="3"/>
  <g transform={variant===1?'translate(20 30)':'translate(1440 60)'}><Gulls/></g>
  <path d="M-20 600L32 409 87 460 125 431 176 600ZM1600 600L1550 390 1480 448 1450 527 1420 600Z" fill="#8ba59a" opacity=".65"/>
  <path d="M25 576Q69 513 50 467M1500 560Q1520 477 1550 448" fill="none" stroke="#e1d5a9" strokeWidth="9"/>
  <g className="plan-leaves" transform="translate(3 380)"><Sprig/></g><g className="plan-leaves" transform="translate(1490 390)"><Sprig/></g>
 </>;
 return <>
 {scene.theme==='taylor'?<>
  <path d="M-50 41Q245 88 200 272T410 601M1600 70Q1402 115 1430 300T1230 610" stroke={gold?'#d8b966':'#81c7c6'} strokeWidth="90" opacity=".25" fill="none"/>
  {gold?<><path d="M0 50Q260 198 550 29M1050 20Q1360 172 1600 40" fill="none" stroke="#967d43" strokeWidth="2"/>{[50,130,220,320,410,1190,1300,1410,1510].map((x,i)=><g key={x}><path d={`M${x} ${i<5?65+Math.sin(i)*44:60+Math.sin(i)*40}v22`} stroke="#947d48" strokeWidth="2"/><circle cx={x} cy={i<5?95+Math.sin(i)*44:90+Math.sin(i)*40} r="8" fill="#fff1a9" stroke="#d7b269" strokeWidth="2"/></g>)}<g className="plan-fringe" stroke="#c5a04d" strokeWidth="3">{Array.from({length:28},(_,i)=><path key={i} d={`M${i<14?12+i*11:1440+(i-14)*11} 365v${70+(i%5)*13}`}/>)}</g><g transform={heading?'translate(1040 208) scale(1.7)':'translate(1430 215) scale(1.1)'}><Boot/></g><g className="plan-glimmer" fill="#b58c36">{[[60,225],[1440,190],[1330,510],[180,525],[1540,52]].map(([x,y],i)=><path key={i} d={`M${x} ${(y??0)-12}l4 8 10 4-10 3-4 10-3-10-10-3 10-4Z`}/>)}</g></>:<><g transform="translate(1400 355)"><Daisy/></g><g transform="translate(8 370) scale(1.1)"><Daisy/></g><g transform="translate(1420 65)"><Butterfly/></g><g transform="translate(5 95) scale(.7)"><Butterfly/></g></>}
  <g transform={heading?'translate(1280 90) scale(2.2)':variant===1?'translate(1450 150) scale(1.15)':'translate(-15 145) scale(1.3)'}><Guitar gold={gold}/></g>
  {variant===1&&<g transform="translate(8 160) rotate(-7 80 70)"><PinNote/></g>}
 </>:<><path d="M0 34H1600M0 566H1600" stroke="#ac8969" strokeWidth="3" opacity=".4"/><g transform={heading?'translate(1160 55) scale(2.4)':'translate(12 112) rotate(-8 75 80)'}><PinNote/></g><g transform="translate(1420 361)"><Mug/></g><g className="plan-leaves" transform="translate(14 329) scale(1.2)"><Sprig/></g><g className="plan-leaves" transform="translate(1500 -65) scale(1.3)"><Sprig/></g></>}
 </>;
}
function ClosingStillLife({scene}:{scene:ThemeScene}) {
 return <g transform="translate(290 125)">
  {scene.theme==='newfoundland'?<><path d="M-40 350L30 240 120 268 180 205 305 350Z" fill="#739a92"/><path d="M20 340Q170 300 120 230" fill="none" stroke="#ead9ad" strokeWidth="13"/><g transform="translate(130 25) scale(1.6)"><Gulls/></g><g transform="translate(-35 170)"><Daisy/></g></>:<>
   <g transform="rotate(-9 180 160)"><path d="M0 38Q82 10 170 36Q262 13 343 36V292Q255 269 170 293Q81 270 0 292Z" fill="#fff8e8" stroke="var(--line)" strokeWidth="3"/><path d="M170 36V292" stroke="var(--theme-second)" strokeWidth="3"/>{[90,123,156,189,222].map(y=><path key={y} d={`M23 ${y}h120m47 0h126`} stroke="#c5c3a0" strokeWidth="2"/>)}<path d="M265 27V160L280 144 295 162V27" fill="var(--theme-accent)" opacity=".6"/></g>
   <g transform="translate(-60 185) scale(1.3)">{scene.theme==='classic'?<Mug/>:scene.id==='debut'?<Daisy/>:<Boot/>}</g>
   <g transform="translate(255 70) scale(1.25)">{scene.theme==='classic'?<Sprig/>:scene.id==='debut'?<Butterfly/>:<Guitar gold/>}</g>
  </>}
 </g>;
}
export function PlanHeadingArtwork({scene}:{scene:ThemeScene}) {
 return <svg className="scene-artwork plan-heading-art" viewBox="0 0 1600 280" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">
 {scene.theme==='newfoundland'?<g transform="translate(0 -130)"><Coast summit={scene.id==='summit'}/></g>:<g className="plan-title-objects">
  <path d="M0 247Q500 194 1600 242" fill="none" stroke="var(--theme-second)" strokeWidth="18" opacity=".15"/>
  <g transform="translate(940 32) scale(1.2)">{scene.theme==='classic'?<PinNote/>:<Guitar gold={scene.id==='fearless'}/>}</g>
  <g transform="translate(1090 102) scale(.9)">{scene.theme==='classic'?<Mug/>:scene.id==='debut'?<Daisy/>:<Boot/>}</g>
  <g transform="translate(740 130) scale(.8)">{scene.theme==='classic'?<Sprig/>:scene.id==='debut'?<Butterfly/>:<g className="plan-fringe" stroke="#ba9746" strokeWidth="3">{Array.from({length:22},(_,i)=><path key={i} d={`M${i*7} 0v${40+Math.sin(i/7)*55}`}/>)}</g>}</g>
 </g>}
 </svg>;
}
function Panel({index}:{index:number}){const{scene}=useAppearance();const ref=useAtmosphereVisibility();return <div ref={ref} className={`plan-scenery-panel plan-scenery-${index}`}><svg viewBox="0 0 1600 600" preserveAspectRatio="xMidYMid meet" focusable="false"><Landscape scene={scene} variant={index}/>{index===2&&<ClosingStillLife scene={scene}/>}</svg></div>;}
export function PlanScenery(){return <div className="plan-scenery">{[0,1,2].map(i=><Panel index={i} key={i}/>)}</div>;}
