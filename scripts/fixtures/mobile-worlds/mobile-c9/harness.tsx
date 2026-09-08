// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import {useState} from 'react';import {createRoot} from 'react-dom/client';import {useDialog} from '/src/useDialog';import {DocumentCamera} from '/src/imports/DocumentCamera';import {captureQualityWarnings} from '/src/imports/captureQuality';
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
window.fixtureCaptures=[];window.fixtureParentClosed=0;function App(){const nested=location.search.includes('nested'),parent=useDialog(nested,()=>window.fixtureParentClosed++);const [open,setOpen]=useState(false),[warnings,setWarnings]=useState([]);return <main ref={parent} role={nested?'dialog':undefined} aria-modal={nested?true:undefined}><p>Development · fictional camera stream</p><button style={{minHeight:44}} onClick={()=>setOpen(true)}>Open camera</button><DocumentCamera open={open} onClose={()=>setOpen(false)} onCapture={(file,quality)=>{window.fixtureCaptures.push({name:file.name,quality});setWarnings(captureQualityWarnings(quality));}}/>{warnings.map(w=><p key={w}>{w}</p>)}</main>};createRoot(document.getElementById('root')).render(<MobileWorldFixture><App/></MobileWorldFixture>);


import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
