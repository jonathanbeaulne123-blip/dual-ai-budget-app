import { StrictMode } from 'react';
import {createRoot} from 'react-dom/client';
import {App} from '../../src/App.tsx';
import {ThemeProvider} from '../../src/theme/ThemeProvider.tsx';
import {KitchenErrorBoundary} from '../../src/KitchenErrorBoundary.tsx';
import {completedExistingBooksHousehold} from '../fixtures/existing-books-onboarding.ts';
import {assembleHousehold} from '../../src/core/sync.ts';
import {financialAuditHash} from '../../src/core/commandIdentity.ts';
import {saveHousehold} from '../../src/storage.ts';
import {saveSession} from '../../src/session.ts';
import {clearCapturedIntent} from '../../src/ledgerSync/capture.ts';
import {generateDemoSuite} from '../../src/core/demoSuite.ts';
import {todayKey} from '../../src/core/calendar.ts';
import {commitHearthside} from '../../src/hearthside/commands.ts';
import '../../src/styles.css';
import '../../src/office.css';
import '../../src/office-phone.css';
import '../../src/office-wide.css';
import '../../src/ledger-story.css';
import '../../src/hearth-theme.css';
import '../../src/hercules.css';
import '../../src/theme/worlds.css';
import '../../src/theme/kinds.css';
import '../../src/theme/whisper.css';
import '../../src/theme/status-fold.css';
import '../../src/mobile-canon.css';
import '../../src/theme/mobile-worlds.css';
import '../../src/theme/page-worlds.css';
import '../../src/theme/page-calendar.css';
import '../../src/theme/page-plan.css';
import '../../src/theme/page-more.css';
import '../../src/theme/page-books.css';
// `?seed=demo` (Development-only, like everything here) loads the Demo Suite's synthetic "doing well" habitat instead of the small fictional house, so populated stones and plinths can be captured.
const seed=new URLSearchParams(location.search).get('seed')==='demo';
const householdId=seed?'HH-WHOLE-HOUSE-HABITAT-REVIEW':'HH-WHOLE-HOUSE-FICTIONAL-REVIEW',memberId=new URLSearchParams(location.search).get('member')==='MEM-002'?'MEM-002':'MEM-001';
const endpoint=`/ledger-sync/v2/development/${householdId}`,headers={Authorization:`Bearer local:${memberId}`,'Content-Type':'application/json'};
let response=await fetch(endpoint+'/snapshot',{headers});
if(!response.ok&&seed){
  const generated=await generateDemoSuite({today:todayKey(),profile:'habitat-well',seed:4242,buildSha:'whole-house-review'});
  const household={...generated.household,householdId,linked:true,commandReceipts:[]};
  clearCapturedIntent(household);household.booksAcceptedHash=await financialAuditHash(household);
  const imported=await fetch(endpoint+'/import',{method:'POST',headers,body:JSON.stringify(household)});if(!imported.ok)throw Error(await imported.text());
  response=await fetch(endpoint+'/snapshot',{headers});
}
if(!response.ok){
  let household=completedExistingBooksHousehold('2026-09-19T12:00:00.000Z');
  household={...household,householdId,name:'Alex & Sam · fictional local house',linked:true,commandReceipts:[]};
  household.members=household.members.map((member,index)=>({...member,name:index?'Sam (fictional)':'Alex (fictional)'}));
  for(const [id,title,intention,horizon] of [['EXP-FUNDED-WEEKEND','A weekend by the water','A small funded weekend, a place to stay and time together.','season'],['EXP-FREE-EVENING','An evening with the good mugs','Tea, a record, and a words-only memory. No purchase needed.','tonight']] as const){
    clearCapturedIntent(household);household=commitHearthside(household,{version:1,id:crypto.randomUUID(),scope:{environment:'development',householdId,memberId:'MEM-001'},operation:{kind:'experience.save',expectedRevision:0,value:{version:1,id,revision:1,title,intention,horizon,state:'dreaming',createdBy:'MEM-001',references:[]}}}).household;
  }
  clearCapturedIntent(household);household.booksAcceptedHash=await financialAuditHash(household);
  const imported=await fetch(endpoint+'/import',{method:'POST',headers,body:JSON.stringify(household)});if(!imported.ok)throw Error(await imported.text());
  response=await fetch(endpoint+'/snapshot',{headers});
}
if(!response.ok)throw Error(await response.text());
const replica=await response.json();
const household=assembleHousehold(replica.shared,replica.personal,{linked:true});
saveSession('development',{householdId,memberId,view:'household'});
await saveHousehold(household,{operatingEnvironment:'development',memberId,activate:true});
createRoot(document.getElementById('root')!).render(<StrictMode><ThemeProvider><KitchenErrorBoundary><App/></KitchenErrorBoundary></ThemeProvider></StrictMode>);
