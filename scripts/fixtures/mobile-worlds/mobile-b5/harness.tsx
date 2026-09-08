// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { KittyBanks } from '/src/KittyBanks';
import { catalogHousehold, addGoal, contributeToGoal, fundGoal, postEntry } from '/src/core/index';
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
const query=new URLSearchParams(location.search), today='2026-09-08', member='MEM-001';
let initial=catalogHousehold();
const personal=query.has('personal');
if(personal) initial={...initial,accounts:[...initial.accounts,{...initial.accounts.find(a=>a.id==='ACC-CHEQUING'),id:'OWN-CASH',name:'My Personal cash',scope:'personal',ownerMemberId:member}]};
if(!query.has('empty')) {
 initial=addGoal(initial,{name:query.has('huge')?'Newfoundland and a long fictional family journey along the entire coast':'Newfoundland · next summer',target:query.has('huge')?987654321.98:3000,shared:!personal,ownerMemberId:member}).household;
 initial=postEntry(initial,{date:today,type:'income',amount:5000,accountId:personal?'OWN-CASH':'ACC-CHEQUING',subcategoryId:'SUB-INCOME-WAGES',visibility:personal?'personal':'household',createdBy:member,confirmDuplicate:true}).household;
 initial=fundGoal(initial,{goalId:initial.goals[0].id,amount:1150,fromAccountId:personal?'OWN-CASH':'ACC-CHEQUING',date:today,createdBy:member}).household;
}
function Harness(){const [h,setH]=useState(initial);window.fixtureTransactions=h.transactions.length;window.fixtureSaved=h.goals[0]?.savedCents;
return <main style={{maxWidth:700,margin:'0 auto',padding:12}}><p>Development · fictional fixture</p><KittyBanks household={h} booksHousehold={h} environment="development" view={personal?'personal':'household'} createdBy={member} busy={query.has('busy')} onCommand={fn=>setH(current=>fn(current).household)}/><p style={{height:700}}>End of fixture</p></main>};
createRoot(document.getElementById('root')).render(<MobileWorldFixture><Harness/></MobileWorldFixture>);


import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
