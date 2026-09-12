import { useId } from 'react';
import type { HearthsideRoom } from './contracts.ts';
import { WORLD_MATERIALS } from './catalogue.ts';

/** Original vector scene layers. Interactive objects remain ordinary semantic controls. */
export function RoomIllustration({room,theme}:{room:HearthsideRoom;theme:keyof typeof WORLD_MATERIALS}) {
  const id=useId().replace(/:/g,''), p=WORLD_MATERIALS[theme], coast=theme==='newfoundland', paper=theme==='taylor';
  return <svg className="hearthside-illustration" viewBox="0 0 1200 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-light`} x2=".2" y2="1"><stop stopColor={p.light}/><stop offset="1" stopColor={p.wall}/></linearGradient>
      <linearGradient id={`${id}-floor`} x2="0" y2="1"><stop stopColor={p.wood}/><stop offset="1" stopColor={p.ink}/></linearGradient>
      <pattern id={`${id}-grain`} width="73" height="16" patternUnits="userSpaceOnUse"><path d="M0 3Q22 9 73 2M0 12Q50 5 73 13" fill="none" stroke={p.ink} strokeOpacity=".07"/></pattern>
      <clipPath id={`${id}-window`}><path d={coast?'M765 150L895 74 1025 150V405H765Z':'M766 150Q895 32 1024 150V405H766Z'}/></clipPath>
    </defs>
    <path fill={p.wall} d="M0 0H1200V720H0Z"/><path fill={`url(#${id}-light)`} d="M170 0H1070V490H170Z"/>
    <path fill={p.wood} opacity=".13" d="M0 0L170 80V490L0 625ZM1200 0L1070 80V490L1200 625Z"/>
    <path fill={`url(#${id}-floor)`} d="M0 490H1200V720H0Z"/><path fill={`url(#${id}-grain)`} d="M0 490H1200V720H0Z"/>
    {[0,1,2,3,4,5,6,7,8].map(n=><path key={n} d={`M${150*n} 720L${430+42*n} 490`} stroke={p.cloth} strokeOpacity=".13"/>)}
    <path d="M0 490H1200" stroke={p.wood} strokeWidth="14"/>
    <g clipPath={`url(#${id}-window)`}>
      <rect x="760" y="50" width="280" height="360" fill={coast?'#aac9d4':paper?'#efb6c7':'#bec5a0'}/>
      <circle cx="947" cy="160" r="45" fill={p.light}/>
      {coast?<><path d="M700 295Q800 250 875 275T1100 282V420H700" fill="#557d86"/>{[0,1,2,3].map(n=><path key={n} d={`M750 ${320+n*20}Q860 ${300+n*20} 1027 ${320+n*20}`} fill="none" stroke="#b0d2d5"/>)}<path d="M782 275V210L822 173 861 210V275" fill="#a25c4a"/><path d="M870 280V242L905 210 940 242V280" fill="#eadbb9"/><path d="M820 208H835V232H820M795 227H809V249H795" fill="#f2d697"/></>:<><path d="M740 335Q835 250 910 300T1060 315V430H740" fill={p.garden}/><path d="M760 270Q802 220 840 280T1060 255" stroke={p.cloth} strokeWidth="14" fill="none" opacity=".35"/></>}
    </g>
    <path d={coast?'M765 150L895 74 1025 150V405H765Z':'M766 150Q895 32 1024 150V405H766Z'} fill="none" stroke={p.wood} strokeWidth="13"/>
    <path d="M895 85V408M765 250H1025" stroke={p.wood} strokeWidth="9"/>
    <path d="M757 408H1040" stroke={p.cloth} strokeWidth="22"/>
    {paper?<><path d="M118 93Q400 166 680 70" stroke="#c78494" strokeWidth="7" fill="none"/>{[150,245,370,510,640].map((x,n)=><g key={x} transform={`translate(${x} ${105+n%2*18}) rotate(${n%2?10:-9})`}><rect width="42" height="64" rx="2" fill={n%2?p.cloth:'#ddba8c'}/><path d="M12 -6H30V12H12" fill="#ad8c67" opacity=".6"/></g>)}</>:<path d="M172 85H1068" stroke={p.wood} strokeWidth="20" opacity=".8"/>}
    {room==='common'&&<>
      <ellipse cx="615" cy="618" rx="420" ry="66" fill={p.cloth} opacity=".15"/>
      <g transform="translate(150 350)"><rect x="0" y="25" width="400" height="180" rx="43" fill={coast?'#587976':paper?'#b57386':'#958066'}/><rect x="34" width="330" height="110" rx="30" fill={p.cloth} opacity=".28"/><path d="M50 189V226M347 189V226" stroke={p.wood} strokeWidth="20"/><rect x="53" y="45" width="103" height="89" rx="20" fill={p.wall} transform="rotate(-7 100 90)"/><rect x="248" y="42" width="79" height="83" rx="19" fill={p.garden}/></g>
      <g transform="translate(525 462)"><ellipse cx="150" cy="65" rx="177" ry="66" fill={p.ink} opacity=".19"/><path d="M22 76L12 194M271 76L292 194" stroke={p.wood} strokeWidth="20"/><ellipse cx="150" cy="60" rx="190" ry="69" fill={p.wood}/><ellipse cx="150" cy="47" rx="190" ry="62" fill={p.cloth}/><path d="M80 14L149 19 139 79 70 67Z" fill={paper?'#ebbad2':'#e9d5a9'}/><ellipse cx="212" cy="42" rx="23" ry="13" fill={p.wood}/><path d="M191 42V69Q212 89 233 69V42" fill={p.wall}/></g>
    </>}
    {room==='studio'&&<>
      <path d="M194 194H638M194 313H638" stroke={p.wood} strokeWidth="20"/>{[0,1,2,3,4].map(n=><g key={n} transform={`translate(${222+n*86} ${n%2?251:130})`}><path d="M0 44Q-6 9 10 1L20 10 31 1Q46 13 38 44Z" fill={n%2?p.garden:p.cloth}/></g>)}
      <path d="M217 506L180 701M976 506L1021 701" stroke={p.wood} strokeWidth="30"/><path d="M163 463L1010 463 1101 543 89 543Z" fill={p.wood}/><path d="M163 450L1010 450 1101 520 89 520Z" fill={p.cloth}/>
      <ellipse cx="559" cy="480" rx="158" ry="36" fill={p.wall} stroke={p.wood} strokeWidth="9"/>
      {[0,1,2,3].map(n=><g key={n}><ellipse cx={768+n*40} cy="481" rx="15" ry="9" fill={['#b7756a','#759a94','#d2b878','#71768b'][n]}/><path d={`M${254+n*15} 475L${277+n*15} 423`} stroke={p.wood} strokeWidth="6"/></g>)}
      <path d="M510 463Q478 407 522 367L543 345 560 376 590 344 610 395Q639 451 606 464Z" fill="#dac7a8"/>
    </>}
    {room==='conservatory'&&<>
      <path d="M80 490L215 70Q515 -10 711 120V490M210 70V490M447 13V490M80 284H709" fill="none" stroke={p.wood} strokeWidth="10" opacity=".4"/>
      {[160,290,405,580,1070].map((x,n)=><g key={x} transform={`translate(${x} ${462-n%2*25})`}><path d="M-35 0L-25 77H25L35 0Z" fill={n%2?'#ba8773':p.cloth}/><path d="M0 0Q-30 -120 13 -185M0 0Q52 -100 40 -145" fill="none" stroke={p.garden} strokeWidth="9"/>{[-40,-85,-133].map((y,i)=><ellipse key={y} cx={i%2?15:-18} cy={y} rx="30" ry="12" fill={p.garden} transform={`rotate(${i%2?-40:35} 0 ${y})`}/>)}</g>)}
      <path d="M380 575H918V606H380Z" fill={p.cloth}/><path d="M414 605V670M883 605V670" stroke={p.wood} strokeWidth="16"/>
      {[0,1,2].map(n=><g key={n} transform={`translate(${455+n*137} 538) rotate(${n*5-5})`}><rect x="-35" y="-35" width="94" height="68" fill={p.wall}/><path d="M-16 -14Q7 -28 24 -10T41 9" stroke={p.garden} fill="none" strokeWidth="3"/></g>)}
    </>}
    {room==='theatre'&&<>
      <path d="M182 134H694V438H182Z" fill={p.wood}/><path d="M203 154H673V417H203Z" fill={p.cloth}/><path d="M198 161Q270 198 230 410M679 161Q603 215 644 410" fill="none" stroke={paper?'#b67583':coast?'#507078':'#8a6358'} strokeWidth="75"/>
      <path d="M318 158H558V414H318Z" fill={p.wall} opacity=".5"/>
      <path d="M550 580L260 165 650 165Z" fill={p.light} opacity=".15"/>
      <path d="M474 560H646V601H474Z" fill={p.ink}/><circle cx="508" cy="543" r="41" fill={p.wood}/><circle cx="598" cy="543" r="41" fill={p.wood}/><circle cx="508" cy="543" r="12" fill={p.cloth}/><circle cx="598" cy="543" r="12" fill={p.cloth}/><path d="M645 568L682 551V600L645 588" fill={p.wood}/>
      <path d="M439 607H680M466 607L445 700M650 607L670 700" stroke={p.wood} strokeWidth="17"/>
      <path d="M147 669Q137 538 243 544T334 680M816 680Q811 541 914 551T1016 690" stroke={p.cloth} strokeWidth="62" fill="none"/>
    </>}
    <g transform="translate(1100 475)"><path d="M-27 0L-20 53H18L29 0" fill={p.cloth}/><path d="M0 0V-101M0 -34L-39 -66M0 -61L35 -100" stroke={p.garden} strokeWidth="7"/><ellipse cx="-29" cy="-74" rx="25" ry="11" fill={p.garden} transform="rotate(34 -29 -74)"/><ellipse cx="32" cy="-108" rx="28" ry="13" fill={p.garden} transform="rotate(-38 32 -108)"/></g>
  </svg>;
}
