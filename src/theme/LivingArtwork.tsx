import { useId } from "react";
import type { ThemeScene } from "./scenes.ts";

/** Original illustration geometry. No photograph, financial value or progress mapping. */
export function Sprig({ flowers = false }: { flowers?: boolean }) {
  return <g className="living-leaves">
    <path d="M50 158Q90 73 50 8M63 114Q17 77 12 44M68 81Q113 61 118 24" fill="none" stroke="var(--theme-second)" strokeWidth="3"/>
    {[[53,29,-35],[64,60,35],[53,96,-30],[24,67,-48],[95,51,35]].map(([x,y,r],i)=><ellipse key={i} cx={x} cy={y} rx="23" ry="10" transform={"rotate("+r+" "+x+" "+y+")"} fill="var(--theme-second)" opacity={i%2 ? ".65":".9"}/>)}
    {flowers && [[30,57],[85,38],[62,16]].map(([x,y],i)=><g key={i} transform={"translate("+x+" "+y+")"} fill="var(--theme-accent)"><circle cx="-6" r="7"/><circle cy="-6" r="7"/><circle cx="6" r="7"/><circle cy="6" r="7"/><circle r="4" fill="#fff1b0"/></g>)}
  </g>;
}
export function Crystal() {
  return <g className="living-crystal"><path d="M50 8V40" stroke="var(--theme-accent)" fill="none"/><path d="M50 40L75 73 50 114 25 73Z" fill="#d5f5ed" stroke="#608b82" strokeWidth="2"/><path d="M50 40V114M25 73H75M50 40L39 73 50 114 62 73Z" fill="none" stroke="#fffdf1" strokeWidth="2"/><path d="M81 36v16M73 44h16" stroke="var(--theme-accent)" strokeWidth="2"/></g>;
}
export function Heart() {
  return <g className="living-heart"><path d="M50 13V34" stroke="var(--theme-second)" fill="none"/><path d="M50 45C18 10 0 61 50 98C100 61 82 10 50 45Z" fill="#f1accd" stroke="#a84578" strokeWidth="2"/><path d="M29 47Q19 62 43 78" stroke="#fff6fc" strokeWidth="4" fill="none"/><circle cx="61" cy="49" r="3" fill="#fff5db"/></g>;
}
export function Feather() {
  return <g className="living-feather"><path d="M34 154Q100 64 74 8Q12 32 34 154Z" fill="#f47b37"/><path d="M30 168L72 22M39 127L22 86M48 97L28 60M57 69L43 35M46 106L85 84M55 78L89 53M64 49L84 29" fill="none" stroke="#ffdda8" strokeWidth="2"/></g>;
}
export function RowHouse({ x=0, y=0, colour="#edc744", width=95, height=190 }: {x?:number;y?:number;colour?:string;width?:number;height?:number}) {
  return <g transform={"translate("+x+" "+y+")"}>
    <path d={"M0 0H"+width+"V"+height+"H0Z"} fill={colour}/>
    {Array.from({length:Math.floor(height/9)},(_,i)=><path key={i} d={"M0 "+(i*9+5)+"H"+width} stroke="#183d50" strokeOpacity=".13"/>)}
    <path d={"M-3 0H"+(width+3)+"M0 4H"+width} stroke="#fffbe8" strokeWidth="5"/>
    {[17,75].filter(y=>y<height-70).map(y=><g key={y}>{[12,width-34].map(x=><g key={x}><rect x={x} y={y} width="23" height="36" fill="#536b74" stroke="#fffbed" strokeWidth="5"/><path d={"M"+x+" "+(y+18)+"h23"} stroke="#fffbed" strokeWidth="2"/><path d={"M"+(x+3)+" "+(y+3)+"v13l9-13"} fill="#dfe9e3" opacity=".7"/></g>)}</g>)}
    <rect x={width-36} y={height-57} width="26" height="57" fill={colour==="#edc744"?"#e7ebe4":"#b8443e"} stroke="#fffbed" strokeWidth="5"/>
    <rect x={width-30} y={height-50} width="14" height="22" fill="#a2bac0" stroke="#fffbed" strokeWidth="2"/>
    <circle cx={width-16} cy={height-19} r="2" fill="#ead99f"/>
    <path d={"M"+(width-41)+" "+height+"h39v5h-39Zm-4 5h47v5h-47"} fill="#8b9190"/>
    <rect x="7" y={height-14} width="32" height="9" fill="#f1cb3b"/>
    <path d={"M12 "+(height-14)+"q-12-17 0-14q-1-16 6-8q8-12 10 4q15-4 5 18"} fill="#4a7854"/>
    <rect x={width-5} y={height-45} width="8" height="9" fill="#698caa" stroke="#ffeddf"/>
  </g>;
}
function Clouds() {
  return <g className="living-clouds" fill="#fffaf5" opacity=".8"><path d="M30 53Q25 26 58 32Q80-6 105 31Q134 12 150 49Z"/><path d="M420 37Q433 8 458 26Q478 5 496 32Q520 23 532 48Z"/><path d="M746 65Q762 29 786 43Q812 12 837 45Q874 22 894 64Z"/></g>;
}
export function HomeArtwork({ scene }: {scene:ThemeScene}) {
  const id=useId().replace(/:/g,"");
  return <svg className="scene-artwork living-home-art" viewBox="0 0 1000 280" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={id+"sky"} x2="0" y2="1"><stop stopColor={scene.id==="lover"?"#9ecff0":scene.id==="showgirl"?"#9ce7ce":"#70b6ed"}/><stop offset="1" stopColor={scene.id==="lover"?"#f8cce2":scene.id==="showgirl"?"#e2fff0":"#eaf5ed"}/></linearGradient>
      <pattern id={id+"glitter"} width="19" height="17" patternUnits="userSpaceOnUse"><path d="M3 4l2-2 2 2-2 2ZM13 12l2-2 2 2-2 2Z" fill="#fff7c3" opacity=".8"/><circle cx="11" cy="3" r="1" fill="#96380d"/></pattern>
    </defs>
    {scene.theme==="taylor"?<>
      <rect width="1000" height="280" fill={"url(#"+id+"sky)"}/><Clouds/>
      {scene.id==="lover"?<>
        <path d="M0 198Q155 130 302 205T605 195T1000 165V280H0Z" fill="#f8d0e6" opacity=".8"/>
        <path d="M0 246Q223 176 402 230T1000 222" fill="none" stroke="#dec6ee" strokeWidth="30"/>
        <g transform="translate(772 47) scale(1.55)"><Heart/></g>
        <path className="living-ribbon" d="M713 54Q625 131 741 169T864 269" fill="none" stroke="#eee6ff" strokeWidth="12"/>
        {[[696,42],[899,96],[740,218],[935,220]].map(([x,y],i)=><path key={i} className="living-glint" d={"M"+x+" "+((y??0)-7)+"v14m-7-7h14"} stroke="#fffdf9" strokeWidth="2"/>)}
      </>:<>
        <path d="M0 0H1000V29Q730 74 500 29Q235 74 0 29Z" fill="#f37024"/><path d="M0 0H1000V29Q730 74 500 29Q235 74 0 29Z" fill={"url(#"+id+"glitter)"}/>
        <g transform="translate(731 14) rotate(-18) scale(1.45)"><Feather/></g><g transform="translate(921 87) rotate(28)"><Feather/></g>
        <g transform="translate(819 25) scale(1.45)"><Crystal/></g>
        <path d="M0 250Q500 211 1000 249V280H0Z" fill="#f37024"/><path d="M0 250Q500 211 1000 249V280H0Z" fill={"url(#"+id+"glitter)"}/>
        {[712,769,826,883,940].map(x=><circle key={x} cx={x} cy="235" r="6" fill="#fff6c9" stroke="#dd8d3e"/>)}
      </>}
    </>:scene.id==="jellybean"?<>
      <rect width="1000" height="280" fill={"url(#"+id+"sky)"}/><circle cx="561" cy="53" r="30" fill="#fff0a6"/><Clouds/>
      <path d="M0 271L595 233 1000 250V280H0Z" fill="#d8d7c9"/>
      <g transform="translate(628 67)"><RowHouse x={0} y={0} colour="#bc3c59" width={80} height={175}/><RowHouse x={83} y={7} colour="#294d60" width={77} height={168}/><RowHouse x={163} y={10} width={86} height={165}/><RowHouse x={252} y={17} colour="#49b5ad" width={77} height={158}/></g>
      <path d="M0 256L609 243 1000 258M24 271L609 245" stroke="#f9f2dc" strokeWidth="3" fill="none"/>
      <path d="M581 34Q767 88 1000 42" stroke="#4e6979" strokeWidth="1" fill="none" opacity=".55"/>
      <g className="living-leaves" transform="translate(535 133) scale(.8)"><Sprig flowers/></g>
    </>:<>
      <rect width="1000" height="280" fill={scene.theme==="classic"?"#e6e4cc":"#d7efe8"}/>
      <rect x="630" y="14" width="320" height="225" rx="110" fill={"url(#"+id+"sky)"}/><Clouds/>
      {scene.id==="quidi-vidi"&&<><path d="M640 166Q795 141 950 170V238H640Z" fill="#75b5b1"/><path className="living-water" d="M643 187q30-8 60 0t60 0t60 0t60 0t60 0M650 216q30-8 60 0t60 0t60 0t60 0" stroke="#f9ffeb" fill="none" strokeWidth="3"/><g transform="translate(699 93) scale(.55)"><RowHouse colour="#bb687e" height={125}/><RowHouse x={105} colour="#f0c961" height={125}/></g></>}
      <path d="M790 13V240M632 112H949" stroke="#fff9e7" strokeWidth="9"/>
      <path d="M0 254Q501 222 1000 248V280H0Z" fill="#c69a71"/>
      <g transform="translate(620 90)"><Sprig/><path d="M29 150h60l-9 38H38Z" fill="#be6746"/><path d="M25 150h68v9H25Z" fill="#d68a67"/></g>
      <g transform="translate(832 211)"><ellipse cx="35" cy="39" rx="49" ry="11" fill="#d4b99e"/><path d="M0 0h65l-8 35q-23 12-49 0Z" fill="#fff7e8"/><path d="M64 5q31-6 23 18q-4 11-25 7" stroke="#fff7e8" strokeWidth="8" fill="none"/><ellipse cx="32" cy="1" rx="32" ry="7" fill="#775342"/><path className="living-steam" d="M23-11q-12-15 0-29M42-11q13-19 0-36" stroke="#fffaf0" strokeWidth="3" fill="none"/></g>
    </>}
  </svg>;
}
