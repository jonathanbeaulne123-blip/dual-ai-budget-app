/** Actual Calendar page with exclusively fictional books: kind carriers, legend-as-filter, multi-day runs, Whisper asides (feedback rows 5–7 evidence). */
import { createServer } from 'vite';
import { createServer as createPortProbe } from 'node:net';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const css = [...readFileSync('src/main.tsx','utf8').matchAll(/import "\.\/(.*\.css)";/g)].map(([,path])=>`import '/src/${path}';`).join('\n');
const entry = `${css}
import React from 'react';import{createRoot}from'react-dom/client';
import{CalendarPage}from'/src/Calendar.tsx';import{catalogHousehold,addRecurrence,addPotentialExpense,addAppointment}from'/src/core/index.ts';import{resolveThemeScene,sceneTokens}from'/src/theme/scenes.ts';
const q=new URLSearchParams(location.search),theme=q.get('theme')||'classic',view=q.get('view')||'household',dark=q.get('dark')==='1';
const scene=dark&&theme==='taylor'?{...resolveThemeScene('taylor','ledger','household')}:dark&&theme==='newfoundland'?resolveThemeScene('newfoundland','shift','household'):resolveThemeScene(theme,'calendar',view);
Object.assign(document.documentElement.dataset,{theme,scene:scene.id,material:scene.material,sceneLighting:scene.dark?'dark':'light',atmosphere:'paused'});for(const[key,value]of Object.entries(sceneTokens(scene)))document.documentElement.style.setProperty(key,value);
const event=(patch)=>({version:1,id:'EVENT-trip',revision:1,createdBy:'MEM-001',visibility:'household',title:'Cabin weekend',start:'2026-09-11',end:'2026-09-13',allDay:true,timezone:'America/Toronto',fold:'earlier',repeat:'none',until:null,location:'',notes:'',exceptions:{},deleted:false,createdAt:'2026-09-01T12:00:00.000Z',updatedAt:'2026-09-01T12:00:00.000Z',...patch});
let household={...catalogHousehold(),nativeEvents:[event(),event({id:'EVENT-week',title:'Parents visiting',start:'2026-09-22',end:'2026-09-27'})]};
const acc='ACC-CHEQUING',sub='SUB-LIFE-FUN';
household=addRecurrence(household,{cadence:'monthly',nextDate:'2026-09-15',type:'expense',amount:'128.40',accountId:acc,subcategoryId:sub,note:'Hydro',kind:'bill'}).household;
household=addRecurrence(household,{cadence:'monthly',nextDate:'2026-09-03',type:'expense',amount:'16.99',accountId:acc,subcategoryId:sub,note:'Streaming',kind:'subscription'}).household;
household=addRecurrence(household,{cadence:'biweekly',nextDate:'2026-09-10',type:'income',amount:'1420',accountId:acc,subcategoryId:'SUB-INCOME-WAGES',note:'Pay',kind:'paycheck'}).household;
household=addPotentialExpense(household,{date:'2026-09-29',title:'Wedding travel',amount:'600',accountId:acc,subcategoryId:sub,createdBy:'MEM-001',visibility:'both'}).household;
household=addAppointment(household,{title:'Dentist',nextDate:'2026-09-17',subcategoryId:sub,accountId:acc,typicalCost:'90'}).household;
const noop=()=>{};
function Proof(){return React.createElement('div',{className:'app calendar-stage','data-ledger-tab':'calendar','data-calendar-view':view},React.createElement(CalendarPage,{household,today:'2026-09-08',environment:'development',memberId:'MEM-001',view,busy:false,onCommand:noop,onAskPost:noop,onAskPostDue:noop,onAskSaveRepeating:noop,onAskVisit:noop,onAskSettle:noop,onAskWriteOff:noop,onAskStartJar:noop,onOpenPlan:noop,onOpenShiftEnvelope:noop}));}
createRoot(document.getElementById('root')).render(React.createElement(Proof));`;
export async function startCalendarKindsProof({port=5187}={}) {
if(port===0){const probe=createPortProbe();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));port=probe.address().port;await new Promise(resolve=>probe.close(resolve));}
const cacheDir=mkdtempSync(join(tmpdir(),'hearth-calendar-'));
const server=await createServer({configFile:false,cacheDir,server:{host:'127.0.0.1',port,strictPort:true},plugins:[{name:'calendar-proof',resolveId(id){if(id==='/calendar-proof.js')return'\0calendar-proof';},load(id){if(id==='\0calendar-proof')return entry;},configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(req.method==='POST'){res.statusCode=503;res.end(JSON.stringify({ok:false}));return;}if(req.url?.split('?')[0]!=='/calendar-proof')return next();res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/calendar-proof','<!doctype html><html lang="en"><head><title>Fictional Hearth Calendar proof</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/calendar-proof.js"></script></body></html>'));});}}]});await server.listen();
return {url:`http://127.0.0.1:${server.httpServer.address().port}/calendar-proof`,async close(){await server.close();rmSync(cacheDir,{recursive:true,force:true});}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const proof=await startCalendarKindsProof();console.log(`Fictional Calendar proof: ${proof.url}`);process.once('SIGINT',async()=>{await proof.close();process.exit(0);});}
