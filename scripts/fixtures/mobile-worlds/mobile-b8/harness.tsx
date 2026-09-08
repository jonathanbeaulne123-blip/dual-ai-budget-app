// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {booksPresentationFloor} from '/src/core/ledgerExperience';
import {LedgerPage} from '/src/Ledger';
import {catalogHousehold,postEntry} from '/src/core/index';
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
const q=new URLSearchParams(location.search);let initial=catalogHousehold();
for(const date of ['2026-09-07','2026-09-08'])initial=postEntry(initial,{date,type:'expense',amount:'47.23',note:q.has('long')?'Fictional groceries and household supplies with an unusually long receipt description':'Groceries',place:'Maple Market',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',createdBy:'MEM-001',confirmDuplicate:true}).household;
initial.transactions=initial.transactions.map(tx=>({...tx,potentialDuplicate:true,amountCents:q.has('huge')?123456789012:tx.amountCents}));if(q.has('empty'))initial.transactions=[];if(q.has('protected'))initial.transactions=initial.transactions.map(tx=>({...tx,source:'shift'}));
function App(){const [h,setH]=useState(initial),[room,setRoom]=useState(q.has('personal')?'personal':'household'),[busy,setBusy]=useState(q.has('busy'));const current=useRef(h);current.current=h;const [writes,setWrites]=useState(0);
return <main style={{maxWidth:innerWidth>=720?720:430,margin:'auto',padding:14,paddingBottom:140}}><header style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span>Development · fictional</span><button style={{minHeight:44}} onClick={()=>setRoom(room==='personal'?'household':'personal')}>Open {room==='personal'?'Shared':'Personal'}</button></header><LedgerPage household={booksPresentationFloor(h,'MEM-001',room)} writeHousehold={h} presentedTransactions memberId="MEM-001" view={room} sourceFocus={null} onClearSource={()=>{}} onChange={()=>{throw Error('Legacy write');}} onRemove={()=>{}} busy={busy} onDuplicateCommand={async fn=>{setBusy(true);await new Promise(r=>setTimeout(r,100));if(q.has('rejected')){setBusy(false);return {ok:false,userMessage:'Ledger unavailable'};}const result=fn(current.current);current.current=result.household;setH(result.household);setWrites(w=>w+1);setBusy(false);return {ok:true};}}/><output data-proof>{JSON.stringify({writes,flags:h.transactions.map(tx=>tx.isDuplicate)})}</output></main>}
createRoot(document.getElementById('root')).render(<MobileWorldFixture><App/></MobileWorldFixture>);


import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
