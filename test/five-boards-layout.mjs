/** Local production-component proof with fictional data; never contacts hosted services. */
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const out=resolve(process.env.HEARTH_ARTIFACTS_DIR||'.artifacts/five-boards');mkdirSync(out,{recursive:true});
const cacheDir=mkdtempSync(join(tmpdir(),'hearth-boards-proof-'));
const css=[...readFileSync('src/main.tsx','utf8').matchAll(/import "\.\/(.*\.css)";/g)].map(([,path])=>`import '/src/${path}';`).join('\n');
const entry=`${css}
import {createElement as el,useState,useRef} from 'react';import {createRoot} from 'react-dom/client';
import {SharedBoards} from '/src/widgets/SharedBoards.tsx';import {CalendarPage} from '/src/Calendar.tsx';import {BooksPage} from '/src/Books.tsx';
import {catalogHousehold,saveBoardTask,saveBoardMilestone,addGoal,addRecurrence,postEntry} from '/src/core/index.ts';
import {resolveThemeScene,sceneTokens} from '/src/theme/scenes.ts';
const q=new URLSearchParams(location.search),theme=q.get('theme')||'classic',route=q.get('route')||'boards',scene=resolveThemeScene(theme,route==='books'?'ledger':route==='calendar'?'calendar':'home','household');
Object.assign(document.documentElement.dataset,{theme,scene:scene.id,material:scene.material,sceneLighting:scene.dark?'dark':'light',atmosphere:'paused'});
for(const[k,v]of Object.entries(sceneTokens(scene)))document.documentElement.style.setProperty(k,v);
let initial=catalogHousehold();initial.householdId='HH-boards-geometry';
initial=saveBoardTask(initial,{id:'BOARD-TASK-feed',memberId:'MEM-001',expectedVersion:0,title:'Pick up groceries and feed Hercules',assigneeId:'MEM-001',dueDate:'2026-09-10',completed:false}).household;
initial=saveBoardMilestone(initial,{id:'BOARD-MILESTONE-coast',memberId:'MEM-001',expectedVersion:0,title:'A weekend by the coast',dueDate:'2026-10-15',completed:false}).household;
initial=addGoal(initial,{name:'Our next little adventure',target:'500',shared:true}).household;
initial=addRecurrence(initial,{nextDate:'2026-09-10',cadence:'monthly',type:'expense',accountId:'ACC-CHEQUING',subcategoryId:'SUB-FOOD-GROCERIES',amount:'75',note:'Groceries for the week'}).household;
initial=postEntry(initial,{date:'2026-09-08',type:'expense',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',amount:'32.45',note:'Fictional groceries',createdBy:'MEM-001',confirmDuplicate:true}).household;
const noop=()=>{};function App(){const[h,setH]=useState(initial),[account,setAccount]=useState(null),[error,setError]=useState(''),current=useRef(h);current.current=h;
const onCommand=fn=>{try{const next=fn(current.current).household;current.current=next;setH(next);setError('');}catch(e){setError(e.message);}};
const shared={household:h,memberId:'MEM-001',view:'household',today:'2026-09-08',busy:false,onCommand};
return el('main',{className:'app','data-ledger-tab':route==='books'?'ledger':route==='calendar'?'calendar':'home',style:{padding:12,maxWidth:1100,margin:'auto'}},el('p',{style:{fontSize:12}},'Fictional local component proof'),error&&el('p',{role:'alert'},error),
route==='boards'?el(SharedBoards,{...shared,onOpenGoals:()=>window.proofActions.push('goals')}):
route==='calendar'?el(CalendarPage,{...shared,environment:'development',onAskPost:noop,onAskPostDue:noop,onAskSaveRepeating:noop,onAskVisit:noop,onAskSettle:noop,onAskWriteOff:noop,onAskStartJar:noop,onOpenPlan:noop,onOpenShiftEnvelope:noop}):
el(BooksPage,{...shared,booksHousehold:h,booksStatus:null,focusedAccountId:account,sourceFocus:null,onFocusAccount:setAccount,onClearSource:noop,onChange:setH,onRemove:noop,onPayAccount:noop,onAddToAccount:noop,onGoMore:noop}));}
window.proofActions=[];createRoot(document.getElementById('root')).render(el(App));`;
const server=await createServer({configFile:false,cacheDir,server:{host:'127.0.0.1',port:0},plugins:[{name:'boards-proof',resolveId(id){if(id==='/boards-proof.js')return '\0boards-proof';},load(id){if(id==='\0boards-proof')return entry;},configureServer(server){server.middlewares.use(async(req,res,next)=>{if(req.url?.split('?')[0]!=='/boards-proof')return next();res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/boards-proof','<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/boards-proof.js"></script></body></html>'));});}}]});
const records=[];let browser,page;const errors=[];
try{
  await server.listen();browser=await chromium.launch({headless:true});page=await browser.newPage({reducedMotion:'reduce'});
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  page.on('pageerror',e=>errors.push(e.message));
  for(const width of[320,390,719,1100,1440])for(const theme of['classic','taylor','newfoundland'])for(const route of['boards','calendar','books']){
    await page.setViewportSize({width,height:1000});await page.goto(server.resolvedUrls.local[0]+'boards-proof?theme='+theme+'&route='+route);
    await page.getByText('Fictional local component proof',{exact:true}).waitFor({timeout:90000});
    if(route==='boards'){
      for(const label of ['Notes','Photos','To-do','Goals','Shift Ask']){
        const tab=page.getByRole('tab',{name:label,exact:true});await tab.click();
        const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
        assert.ok(geometry.scroll<=geometry.width+1,JSON.stringify({width,theme,route,label,...geometry}));
        records.push({width,theme,route,board:label,...geometry});
        if(width===390||width===1440)await page.screenshot({path:join(out,theme+'-'+width+'-'+label.replaceAll(' ','-')+'.png'),fullPage:true});
      }
    }else{
      const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(geometry.scroll<=geometry.width+1,JSON.stringify({width,theme,route,...geometry}));records.push({width,theme,route,...geometry});
      if(width===390||width===1440)await page.screenshot({path:join(out,theme+'-'+width+'-'+route+'.png'),fullPage:true});
    }
  }
  assert.deepEqual(errors,[]);console.log('PASS '+records.length+' integrated theme/width/surface geometry cases. Fictional local components; no hosted proof.');
}catch(error){if(page)await page.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{writeFileSync(join(out,'report.json'),JSON.stringify({records,errors},null,2));await browser?.close();await server.close();rmSync(cacheDir,{recursive:true,force:true});}
