// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import {createRoot} from 'react-dom/client';import {SwipeReceiptStrip} from '/src/SwipeReceiptStrip';import '/src/swipe.css';
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
const q=new URLSearchParams(location.search),strip={token:{id:'fictional'},expiresAt:Date.now()+10000,scopeIdentity:'fixture'};window.fixtureWrites=0;createRoot(document.getElementById('root')).render(<MobileWorldFixture><main style={{maxWidth:720,margin:'auto',padding:14}}><p>Development · fictional</p><SwipeReceiptStrip strip={strip} message='Posted. Nothing moved.' disabled={q.has('busy')} reason={q.has('lifo')?'Undo your latest money change first.':null} onUndo={()=>window.fixtureWrites++}/><button style={{minHeight:44}}>I spent something</button></main></MobileWorldFixture>);


import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
