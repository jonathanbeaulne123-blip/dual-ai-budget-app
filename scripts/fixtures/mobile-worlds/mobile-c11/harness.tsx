// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import {createRoot} from 'react-dom/client';import {WorkShiftPage} from '/src/WorkShiftPage';import {seedDemoHousehold} from '/src/core/index';
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
const h=seedDemoHousehold({today:'2026-09-08',environment:'development'});const noop=()=>{};createRoot(document.getElementById('root')).render(<MobileWorldFixture><main style={{maxWidth:1000,margin:'auto',padding:14}}><p>Development · fictional Work</p><WorkShiftPage household={h} memberId='MEM-001' memberName='Bianca' today='2026-09-08' environment='development' busy={false} onClockIn={noop} onAbandon={noop} onStartBreak={noop} onEndBreak={noop} onChooseTimeline={noop} onClockOut={noop} onConfirmShift={noop} onCorrect={noop} onAskSaveJob={noop} onArchiveJob={noop} onOpenCalendar={noop}/></main></MobileWorldFixture>);

import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
