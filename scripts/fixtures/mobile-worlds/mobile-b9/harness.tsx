// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {FundStage} from '/src/FundStage';
import {FundLedge} from '/src/FundLedge';
import {Level} from '/src/Level';
import {MonthSpread} from '/src/MonthSpread';
import {trustFixture} from '/test/fixtures/fund-trust';
import {catalogHousehold,configureHouseholdFund,buildSharedLedgerStory,sharedMonthCourse,fundWalk,proposeHouseholdFundContribution,confirmHouseholdFundContribution} from '/src/core/index';
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
const q=new URLSearchParams(location.search),today='2026-09-08';let initial=trustFixture().h;
if(q.has('zero'))initial=configureHouseholdFund(catalogHousehold(),{custodianMemberId:'MEM-001',openedOn:'2026-01-01',createdBy:'MEM-001'}).household;
if(q.has('empty'))initial=catalogHousehold();
if(q.has('long'))initial.members=initial.members.map(m=>({...m,name:'Alexandra With A Very Long Fictional Household Member Name'}));
function App(){const [h,setH]=useState(initial),[room,setRoom]=useState(q.has('personal')?'personal':'household');const mode=q.get('mode'),walk=fundWalk(h,today.slice(0,7),today);const course=sharedMonthCourse(h,today);if(q.has('untied')){course.tiesToProjection=false;walk.tiesToProjection=false;}
return <main style={{maxWidth:innerWidth>=720?850:430,margin:'auto',padding:14,paddingBottom:140}}><header style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:20}}><span>Development · fictional</span><button style={{minHeight:44}} onClick={()=>setRoom(room==='personal'?'household':'personal')}>Open {room==='personal'?'Shared':'Personal'}</button></header>{q.has('ledge')?<FundLedge household={h} today={today} view={room} memberId='MEM-001' busy={false} onKitchen={()=>{throw Error('Unexpected write')}} onOpenAccount={()=>{}} onOpen={()=>{}}/>:mode==='course'?<MonthSpread household={h} course={course} story={buildSharedLedgerStory(h,today)} nameOf={id=>h.members.find(m=>m.id===id)?.name??'A member'} custodianName="Bianca" scopeKey={room} onOpenFund={()=>{}} onOpenRegister={()=>{}} onOpenHealth={()=>{}}/>:mode==='classic'?<Level household={h} walk={walk} compact={innerWidth<720} presentation={q.has('loading')?'loading':q.has('error')?'error':undefined} scopeKey={room}/>:<FundStage household={h} today={today} memberId="MEM-001" view={room} presentation="phone" widgetId="level" busy={false} onKitchen={()=>{throw Error('Unexpected write')}} onOpenAccount={()=>{}} onOpenDestination={()=>{}}/>}<button style={{minHeight:44,marginTop:20}} data-source-update onClick={()=>{const p=proposeHouseholdFundContribution(h,{memberId:'MEM-002',contributorMemberId:'MEM-002',amount:'100',date:today});setH(confirmHouseholdFundContribution(p.household,{memberId:'MEM-001',proposalEventId:p.postedIds[0]}).household);}}>Load next fictional accepted source</button></main>}
createRoot(document.getElementById('root')).render(<MobileWorldFixture><App/></MobileWorldFixture>);


import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
