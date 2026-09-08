// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {TimesheetBody} from '/src/widgets/Timesheet';
import {catalogHousehold,clockInShift,startShiftBreak,endShiftBreak,clockOutShift,abandonOpenShift,chooseOpenShiftTimeline,shiftPostingStreak} from '/src/core/index';
import {openShiftReview,runReviewedOpenShift,runReviewedShiftChoice} from '/src/openShiftReview';
import '/src/styles.css';
import '/src/office.css';
import '/src/office-phone.css';
import '/src/office-wide.css';
import '/src/ledger-story.css';
import '/src/month-spread.css';
import '/src/desk-plates.css';
import '/src/charter-founding.css';
import '/src/charter.css';
import '/src/hearth-theme.css';
import '/src/hercules.css';
const query=new URLSearchParams(location.search),today='2026-09-08',member='MEM-002';
let initial=clockInShift(catalogHousehold(),{memberId:member}).household;
initial.kitchen.openShifts[0].startedAt=new Date(Date.now()-6.25*3600000).toISOString();
if(query.has('break')){initial=startShiftBreak(initial,{memberId:member,kind:'unpaid'}).household;initial.kitchen.openShifts[0].breaks[0].startedAt=new Date(Date.now()-20*60000).toISOString();}
if(query.has('empty'))initial=catalogHousehold();
if(query.has('confirming'))initial=clockOutShift(initial,{memberId:member}).household;
if(query.has('conflict'))initial.kitchen.openShifts.push({...initial.kitchen.openShifts[0],id:'second-device',sourceDeviceId:'Fictional laptop'});
if(query.has('long'))initial.members.find(m=>m.id===member).name='Alexandra With A Very Long Fictional Household Member Name';
function App(){const [h,setH]=useState(initial),[room,setRoom]=useState('personal'),[busy,setBusy]=useState(query.has('busy'));const current=useRef(h);current.current=h;const review=openShiftReview(h,member);const [actions,setActions]=useState([]);
const run=(name,fn,keepId)=>{setBusy(true);setTimeout(()=>{const result=keepId?runReviewedShiftChoice(current.current,member,review,keepId,fn):runReviewedOpenShift(current.current,member,review,fn);current.current=result.household;setH(result.household);setActions(a=>[...a,name]);setBusy(false);},150);};
return <main style={{maxWidth:innerWidth>=720?700:390,margin:'auto',padding:14,paddingBottom:180}}><header style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:14}}><span>Development · fictional</span><button style={{minHeight:44}} onClick={()=>setRoom(room==='personal'?'household':'personal')}>Open {room==='personal'?'Shared':'Personal'}</button></header><p>{room==='personal'?'Personal':'Shared'} · own shift</p><section className="card shift-punch"><TimesheetBody household={h} view={room} memberId={member} memberName={h.members.find(m=>m.id===member).name} today={today} streak={shiftPostingStreak(h,today)} busy={busy} onClockIn={()=>{setH(clockInShift(h,{memberId:member}).household);setActions(a=>[...a,'in']);}} onStartBreak={kind=>run(kind,value=>startShiftBreak(value,{memberId:member,kind}))} onEndBreak={()=>run('end',value=>endShiftBreak(value,{memberId:member}))} onSignOut={()=>run('out',value=>clockOutShift(value,{memberId:member}))} onAbandon={()=>run('discard',value=>abandonOpenShift(value,{memberId:member}))} onChooseTimeline={keepId=>run('choose',value=>chooseOpenShiftTimeline(value,{memberId:member,keepId}),keepId)} onFinished={()=>{}} inlineConfirm /></section><output data-proof>{JSON.stringify({actions,transactions:h.transactions.length,shifts:h.shifts.length,status:h.kitchen.openShifts[0]?.status})}</output><nav style={{position:'fixed',bottom:0,left:0,right:0,background:'var(--paper)',borderTop:'1px solid var(--line)',padding:12,display:'flex',justifyContent:'space-around'}}>{['Shift','Books','Add'].map(s=><button key={s} style={{minHeight:44}}>{s}</button>)}</nav></main>}
createRoot(document.getElementById('root')).render(<MobileWorldFixture><App/></MobileWorldFixture>);


import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
