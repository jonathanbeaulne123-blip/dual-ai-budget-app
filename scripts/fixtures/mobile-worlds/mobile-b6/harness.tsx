// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import {useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {FundStage} from '/src/FundStage';
import {trustFixture} from '/test/fixtures/fund-trust';
import {Ask} from '/src/Ask';
import {FundLedge} from '/src/FundLedge';
import {forecastReceiptHousehold} from '/test/fixtures/forecast-receipts';
import {addGoal,addRecurrence,configureHouseholdFund,catalogHousehold,proposeHouseholdFundContribution,confirmHouseholdFundContribution} from '/src/core/index';
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
const query=new URLSearchParams(location.search),today='2026-09-08';
let h=forecastReceiptHousehold(query.has('card')?'card':'cash',query.has('empty')?0:8);
if(query.has('custodian'))h=trustFixture().h;
if(query.has('huge')){const p=proposeHouseholdFundContribution(h,{memberId:'MEM-002',contributorMemberId:'MEM-002',amount:'987654321.98',date:'2026-09-07'});h=confirmHouseholdFundContribution(p.household,{memberId:'MEM-001',proposalEventId:p.postedIds[0]}).household;}
function App(){const [room,setRoom]=useState('personal'),[closed,setClosed]=useState(false);const ref=useRef(0);const source=useMemo(()=>{const generation=ref.current;return {household:h,isCurrent:()=>ref.current===generation,accepted:{kind:'accepted',ownBooks:query.has('unavailable')?'unavailable':'ready',acceptedRevision:h.revision,acceptedStateId:`fictional:${h.revision}:${generation}`,scope:{environment:h.environment,householdId:h.householdId,memberId:'MEM-002',subject:'fictional-browser-person',viewerRoom:room,targetRoom:'household',fundId:h.householdFund.id,authorityGeneration:String(generation)}}};},[room]);
return <div style={{maxWidth:query.has('desk')?1000:390,margin:'auto',padding:14,paddingBottom:180}}><header style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:12,marginBottom:16}}><span>Development · fictional</span><button onClick={()=>{ref.current++;setRoom(room==='personal'?'household':'personal')}}>Open {room==='personal'?'Shared':'Personal'}</button></header><p style={{fontSize:12}}>Shared Fund · opened from {room==='personal'?'Personal':'Shared'}</p>
{query.has('custodian')?<FundStage widgetId='level' household={h} memberId='MEM-001' today={today} view={room} busy={false} presentation={query.has('desk')?'desk':'phone'} onKitchen={()=>{throw Error('Unexpected financial action')}} onOpenAccount={()=>{}} onOpenDestination={()=>{}} />:query.has('ledge')?<><p>Home · fictional component proof</p><FundLedge household={h} today={today} view={room} memberId="MEM-002" busy={false} scenarioSource={source} onKitchen={()=>{throw Error('Unexpected financial action')}} onOpenAccount={()=>{}} onOpen={()=>{}} /></>:<Ask viewerRoom={room} household={h} memberId="MEM-002" today={today} busy={false} scenarioSource={source} presentation={query.has('desk')?'desk':'phone'} onMove={()=>{throw Error('Unexpected financial action')}} />}
<nav style={{position:'fixed',bottom:0,left:0,right:0,background:'var(--paper)',borderTop:'1px solid var(--line)',display:'flex',justifyContent:'space-around',padding:12,zIndex:4}}><button style={{minHeight:44}}>Shift</button><button style={{minHeight:44}}>Books</button><button style={{minHeight:44}}>Add</button></nav></div>}
createRoot(document.getElementById('root')).render(<MobileWorldFixture><App/></MobileWorldFixture>);


import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
