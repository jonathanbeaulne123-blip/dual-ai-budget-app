// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import {createRoot} from 'react-dom/client';import {HerculesPresence} from '/src/Hercules';import {catalogHousehold,emitOfficeIntent} from '/src/core/index';
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
const h=catalogHousehold();createRoot(document.getElementById('root')).render(<MobileWorldFixture><main><p>Development · fictional</p><button onClick={()=>emitOfficeIntent({type:'expand',id:'fund'})}>Open Fund instrument</button><HerculesPresence household={h} today='2026-09-08' tab={location.search?'home':'shift'} adding={false} memberId='MEM-001' view='household' onOpenAdd={()=>{}} onGo={()=>{}} onLedger={()=>{}} onOpenSource={()=>{}}/></main></MobileWorldFixture>);


import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
