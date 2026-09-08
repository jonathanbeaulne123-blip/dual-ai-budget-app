// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import '/src/office.css';
import '/src/office-phone.css';
import '/src/office-wide.css';
import '/src/ledger-story.css';
import '/src/month-spread.css';
import '/src/desk-plates.css';
import '/src/hearth-theme.css';
import '/src/hercules.css';
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {FundLedge} from '/src/FundLedge';
import {catalogHousehold,configureHouseholdFund,proposeHouseholdFundContribution,confirmHouseholdFundContribution,kitchenPrimaryNav,setFundRailSlot} from '/src/core/index';
import '/src/styles.css';
import '/src/onboarding.css';
const params=new URLSearchParams(location.search);
let h=configureHouseholdFund(catalogHousehold('development'),{custodianMemberId:'MEM-001',openedOn:'2026-08-01',createdBy:'MEM-001'}).household;
if(!params.has('empty')){const p=proposeHouseholdFundContribution(h,{memberId:'MEM-002',contributorMemberId:'MEM-002',amount:'1685',date:'2026-09-08'});h=confirmHouseholdFundContribution(p.household,{memberId:'MEM-001',proposalEventId:p.postedIds[0]}).household;}
if(params.has('refused')) h.householdFund=undefined;
if(params.has('stage') && params.get('stage')!=='level')h=setFundRailSlot(h,{memberId:params.has('custodian')?'MEM-001':'MEM-002',createdBy:params.has('custodian')?'MEM-001':'MEM-002',slot:2,widgetId:params.get('stage')}).household;
window.evidenceActions=[];
function Harness(){const[view]=useState(params.has('personal')?'personal':'household');const[opened,setOpened]=useState(false);return <div className="app"><main><h1>Hearth</h1><p>{view==='personal'?'Personal':'Shared'} · synthetic component fixture</p>{params.has('loading')?<p role="status">Loading the next view… Accepted Fund remains readable.</p>:null}{params.has('error')?<p role="alert">Connection interrupted. Accepted books remain.</p>:null}<div style={{height:600}}/><button type="button">Last page action</button><p role="status">{opened?'Opened Shared Fund register':''}</p></main>{params.has('chrome')?<><div className="onboarding-return-bar" style={{minHeight:44}} role="status">Finish here, then open Hercules.</div><button className="hercules-pill" type="button">Hercules</button></>:null}{params.has('focus')?<div className="hercules-world is-focus-open"><div className="hercules-focus-shell" role="dialog" aria-modal="true"><button type="button">Close focus mode</button></div></div>:null}<FundLedge household={h} today="2026-09-08" view={view} memberId={params.has("custodian")?"MEM-001":"MEM-002"} busy={params.has("busy")} onKitchen={()=>window.evidenceActions.push("write")} onOpenAccount={()=>window.evidenceActions.push("account")} onOpen={()=>{window.evidenceActions.push('open-shared-fund');setOpened(true);}}/><nav className="nav" data-ledger-nav={view==='personal'?'personal':'shared'}>{kitchenPrimaryNav(view).map(t=><button key={t} type="button">{t}</button>)}<button type="button">+</button></nav></div>};
createRoot(document.getElementById('root')).render(<MobileWorldFixture><Harness/></MobileWorldFixture>);


import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
