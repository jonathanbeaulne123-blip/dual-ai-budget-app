// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import {createRoot} from 'react-dom/client';import {Till} from '/src/Till';import {catalogHousehold,configureHouseholdFund,postEntry} from '/src/core/index';
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
const q=new URLSearchParams(location.search);let h=configureHouseholdFund(catalogHousehold(),{custodianMemberId:'MEM-001',openedOn:'2026-09-01',createdBy:'MEM-001'}).household;if(q.has('spent'))h=postEntry(h,{date:'2026-09-08',type:'expense',amount:'20',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',createdBy:'MEM-001',confirmDuplicate:true}).household;createRoot(document.getElementById('root')).render(<MobileWorldFixture><main style={{maxWidth:720,margin:'auto',padding:14}}><Till household={h} memberId='MEM-001' today='2026-09-08' busy={false} showSwipe={true} offlinePending={false} onOpenSwipe={()=>{}} onSeeEverything={()=>{}} onCommand={()=>{throw Error('unexpected write')}}/></main></MobileWorldFixture>);


import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
