// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import {createRoot} from 'react-dom/client';import {HerculesPresence} from '/src/Hercules';import {throughSittingOne} from '/test/fixtures/onboardingReturnHousehold';import {saveReturnMessage} from '/src/core/onboarding/returnMessage';import {seedDemoHousehold} from '/src/core/index';
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
const h=throughSittingOne();saveReturnMessage({environment:h.environment,householdId:h.householdId,memberId:'MEM-001',chapterId:'ch-04-accounts',tab:'ledger',setAt:'2026-09-08T17:00:00Z'});window.resumeDest='';const forbidden=()=>{throw Error('read cannot write')};createRoot(document.getElementById('root')).render(<MobileWorldFixture><main className='app' style={{maxWidth:1000,margin:'auto'}}><p>Development · fictional return</p><div style={{height:1000}}>Your existing room</div><button id='last-action'>Last room action</button><HerculesPresence household={h} today='2026-09-08' tab='home' adding={false} memberId='MEM-001' view='household' onOpenAdd={forbidden} onGo={x=>window.resumeDest=x} onLedger={forbidden} onOpenSource={forbidden} onOpenAccounts={()=>window.resumeDest='personal:wallet'}/><nav style={{position:'fixed',bottom:0,left:0,right:0,height:'var(--nav)',background:'var(--paper-2)'}}>Existing navigation</nav></main></MobileWorldFixture>);

import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
