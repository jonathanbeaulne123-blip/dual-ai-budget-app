// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarPage } from '/src/Calendar';
import { ConfirmSheet } from '/src/Confirm';
import { catalogHousehold, addRecurrence, postEntry, postOneRecurrence, reversePostedMoney, addAppointment, postVisit } from '/src/core/index';
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
const query=new URLSearchParams(location.search),today='2026-09-18';
let initial=catalogHousehold();
if(!query.has('empty')) {
for(const [date,amount,note] of [['2026-09-01',1650,'Rent'],['2026-09-03',15,'Coffee'],['2026-09-06',50,'Hydro'],['2026-09-11',120,'Groceries'],[today,120,'Groceries']]) initial=postEntry(initial,{date,type:'expense',amount:query.has('huge')?987654321.98:amount,accountId:'ACC-CHEQUING',subcategoryId:'SUB-FOOD-GROCERIES',note:query.has('huge')?'A long fictional payment with a deliberately long description for the small phone '+note:note,confirmDuplicate:true}).household;
initial=addRecurrence(initial,{nextDate:today,cadence:'monthly',type:'transfer',accountId:'ACC-CHEQUING',transferToAccountId:'ACC-VISA',subcategoryId:'',amount:1000,note:'Visa payment'}).household;
}
if(query.has('corrected')){initial=addAppointment(initial,{title:'Fictional visit',kind:'dentist',nextDate:today,cadence:{kind:'once'},typicalCost:200,typicalRecovery:0,subcategoryId:'SUB-HEALTH-DENTAL',accountId:'ACC-CHEQUING'}).household;const p=postVisit(initial,{date:today,appointmentId:initial.appointments[0].id,amount:200,expectedRecovery:0,confirmDuplicate:true});initial=reversePostedMoney(p.household,p.postedIds[0],{reversalDate:today}).household;}
function App(){const [h,setH]=useState(initial),[guard,setGuard]=useState(null),[room,setRoom]=useState('household');window.fixtureTransactions=h.transactions.length;
return <div style={{maxWidth:1100,margin:'auto',padding:14,paddingBottom:140}}><header style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:12,marginBottom:16}}><span>Development · fictional</span><button onClick={()=>setRoom(room==='household'?'personal':'household')}>Open {room==='household'?'Personal':'Shared'}</button></header>
<CalendarPage household={h} today={today} environment="development" memberId="MEM-001" view={room} busy={query.has('busy')} onCommand={()=>{throw Error('Unexpected command')}} onAskPost={(id,summary)=>setGuard({id,summary})} onAskPostDue={()=>{}} onAskSaveRepeating={()=>{}} onAskVisit={()=>{}} onAskSettle={()=>{}} onAskWriteOff={()=>{}} onAskStartJar={()=>{}} onOpenPlan={()=>{}} onOpenShiftEnvelope={()=>{}} />
<nav style={{position:'fixed',bottom:0,left:0,right:0,background:'var(--paper)',borderTop:'1px solid var(--line)',display:'flex',justifyContent:'space-around',padding:12,zIndex:4}}><button style={{minHeight:44}}>Home</button><button style={{minHeight:44}}>Books</button><button style={{minHeight:44}}>Add</button></nav>
{guard&&<ConfirmSheet title="Post this recurring item?" body={guard.summary} confirmLabel="Confirm" onCancel={()=>setGuard(null)} onConfirm={()=>{setH(postOneRecurrence(h,guard.id,today).household);setGuard(null)}}/>}</div>}
createRoot(document.getElementById('root')).render(<MobileWorldFixture><App/></MobileWorldFixture>);


import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
