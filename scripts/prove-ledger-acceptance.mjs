/** Ordinary-App measurement. Local fixture mode cannot certify hosted or physical LTE gates. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { installLedgerBrowserProbe } from './lib/ledger-browser-probe.mjs';
import { evaluateLedgerTrial, correctedTime } from './lib/ledger-acceptance.mjs';

const url=process.env.HEARTH_LEDGER_APP_URL??'http://localhost:5194';
const local=['localhost','127.0.0.1'].includes(new URL(url).hostname);
const count=Number(process.env.HEARTH_LEDGER_SAMPLES??100);
if(!Number.isInteger(count)||count<1||count>500)throw new Error('Use 1–500 samples; acceptance requires at least100.');
const household=process.env.HEARTH_LEDGER_HOUSEHOLD??(local?`HH-ACCEPTANCE-${crypto.randomUUID()}`:null);
if(!household)throw new Error('Explicit Development household required for hosted measurement.');
const release=process.env.HEARTH_LEDGER_RELEASE??'unrecorded-local';
const condition=process.env.HEARTH_LEDGER_CONDITION??'warm';
if(!['warm','cold'].includes(condition))throw new Error('Use warm or cold condition.');
const idleMs=condition==='cold'?30000:0;
const prefix=`proof-${crypto.randomUUID().slice(0,8)}`;
const output=process.env.HEARTH_LEDGER_PROOF_OUTPUT??`artifacts/ledger-sync/${prefix}.json`;
const browser=await chromium.launch({headless:process.env.HEARTH_LEDGER_HEADFUL!=='1',...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
const pages=[],contexts=[],errors=[],clocks={},samples=[];
let coldOpenMs=[],transactionCount=null,concurrentPairs=0,maxPairWindowMs=null;
const startupDismissals=[];
const participants=[];
let lostOperations=null,duplicatedOperations=null,conflictDialogs=null,privacyLeaks=null;
const calibration=page=>page.evaluate(async local=>{
  const session=JSON.parse(localStorage.getItem('hearth:session:v1:development')??'null');
  const auth=JSON.parse(localStorage.getItem('hearth:v1:supabase-auth:development')??'null');
  if(!session?.householdId||(!local&&!auth?.accessToken))throw new Error('Authenticated Development session required.');
  const readings=[];
  for(let i=0;i<7;i++){
    const t0=performance.timeOrigin+performance.now();
    const response=await fetch('/sync/clock',{method:'POST',headers:{'Content-Type':'application/json',...(!local?{Authorization:`Bearer ${auth.accessToken}`}:{})},body:JSON.stringify({environment:'development',householdId:session.householdId,memberId:session.memberId})});
    const body=await response.json(),t3=performance.timeOrigin+performance.now();
    if(!response.ok||body.source!==(local?'local-test-clock':'authenticated-cloud-clock'))throw new Error('Clock endpoint refused calibration.');
    const t1=body.serverReceivedAtMs,t2=body.serverSentAtMs,network=t3-t0-(t2-t1);
    if(![t1,t2].every(Number.isFinite)||t2<t1||network<0)continue;
    readings.push({sentAt:t0,receivedAt:t3,offsetMs:((t0-t1)+(t3-t2))/2,uncertaintyMs:Math.ceil(network/2)+1,source:body.source});
  }
  readings.sort((a,b)=>a.uncertaintyMs-b.uncertaintyMs);
  if(!readings.length||readings[0].uncertaintyMs>50)throw new Error('Clock uncertainty exceeds50ms.');
  return readings[0];
},local);
async function ready(page){
  await page.locator('[data-books-readiness="ready"][data-ledger-live="true"]').waitFor({timeout:90000});
  const due = page.locator('[aria-labelledby="due-preview-title"]');
  const dismiss = due.getByRole('button',{name:'Not now',exact:true});
  if(await dismiss.count()) { await dismiss.click(); startupDismissals.push({page:pages.indexOf(page),kind:'due-preview'}); }
  await page.waitForFunction(()=>window.__ledgerAcceptance?.currentReady===true,{},{timeout:15000});
}
async function activity(page){
  const notNow=page.getByRole('button',{name:'Not now',exact:true});for(const button of await notNow.all())if(await button.isVisible())await button.click();
  await page.keyboard.press('Control+k');
  await page.getByRole('button',{name:'Household table',exact:true}).click();
  await page.locator('[data-books-tabs="table"]').getByRole('button',{name:'All activity',exact:true}).click();
  await page.getByPlaceholder('Search notes, place, category…').fill(prefix);
  // Establish an open results viewport before any Confirm. Never scroll a new
  // row into view after receipt and count that as spontaneous partner paint.
  await page.getByPlaceholder('Search notes, place, category…').evaluate(node=>node.scrollIntoView({block:'start'}));
}
async function draft(page,index){
  await page.getByRole('button',{name:'Add money',exact:true}).click();
  await page.getByRole('menuitem',{name:'Add expense',exact:true}).click();
  for(const digit of String(101+index))await page.getByRole('button',{name:digit,exact:true}).click();
  await page.getByRole('button',{name:'Groceries',exact:true}).click();
  await page.getByRole('button',{name:'Enter',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.locator('[data-add-account-tiles] button[aria-label$=" Visa"]').click();
  await page.locator('#add-note').fill(`${prefix}-${index}`);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
}
async function collect(author,partner,beforeIds){
  await pages[author].waitForFunction(ids=>Object.values(window.__ledgerAcceptance.commands).some(c=>!ids.includes(c.id)&&c.ackAt),beforeIds,{timeout:45000});
  const command=await pages[author].evaluate(ids=>Object.values(window.__ledgerAcceptance.commands).find(c=>!ids.includes(c.id)&&c.ackAt),beforeIds);
  const rowIds=command.postedIds.filter(id=>id.startsWith('TXN'));
  if(rowIds.length!==1)throw new Error('Expected one identified expense row.');
  const rowId=rowIds[0];
  await Promise.all([author,partner].map(i=>pages[i].waitForFunction(id=>window.__ledgerAcceptance.rows[id]?.paintAt,rowId,{timeout:5000}).catch(()=>{})));
  // Saved can be outside the viewport: absence is a failed metric, never inferred from wire ACK.
  await pages[author].waitForFunction(id=>window.__ledgerAcceptance.commands[id]?.savedPaintAt,command.id,{timeout:5000}).catch(()=>{});
  const snapshots=await Promise.all(pages.map(page=>page.evaluate(()=>window.__ledgerAcceptance)));
  const completed=snapshots[author].commands[command.id];
  const matches=await pages[partner].locator(`[data-ledger-row-id="${rowId}"]`).count();
  const bytes=snapshots.flatMap(s=>s.frames).filter(f=>f.id===command.id||(f.sequence===command.sequence&&f.type==='event')).reduce((n,f)=>n+f.bytes,0);
  samples.push({id:command.id,author:String(author),partner:String(partner),confirmAt:command.confirmAt,authorPaintAt:snapshots[author].rows[rowId]?.paintAt??null,
    ackAt:command.ackAt,savedPaintAt:completed.savedPaintAt??null,partnerPaintAt:snapshots[partner].rows[rowId]?.paintAt??null,bytes,visibleRowMatches:matches,
    receiptMatches:completed.receiptValid?1:0,rowId});
}
try {
  for(let i=0;i<2;i++){
    const storageState=process.env[i===0?'HEARTH_LEDGER_AUTHOR_STATE':'HEARTH_LEDGER_PARTNER_STATE'];
    const context=await browser.newContext({viewport:{width:1400,height:1000},...(storageState?{storageState}:{})});contexts.push(context);
    await context.addInitScript(installLedgerBrowserProbe,{prefix});
    const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(local?`${url}/test/browser/ledger-sync-app.html?household=${household}&member=MEM-00${i+1}&scale=5000`:url,{waitUntil:'domcontentloaded'});
    await ready(page);
    if(local){await page.goto(`${url}/test/browser/ledger-sync-app.html?open=1`,{waitUntil:'domcontentloaded'});await ready(page);}
    const state=await page.evaluate(async local=>{
      const session=JSON.parse(localStorage.getItem('hearth:session:v1:development')??'null');
      const auth=JSON.parse(localStorage.getItem('hearth:v1:supabase-auth:development')??'null');
      const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('');
      const subject=local?session?.memberId:auth?.userId;
      if(!session?.memberId||!subject)throw new Error('Missing authenticated trial participant.');
      return {session,probe:window.__ledgerAcceptance,memberHash:await hash(session.memberId),subjectHash:await hash(subject)};
    },local);
    if(state.session?.householdId!==household)throw new Error('Selected household does not match authorized trial target.');
    if(participants.some(p=>p.memberHash===state.memberHash||p.subjectHash===state.subjectHash))throw new Error('Two different authenticated members are required.');
    participants.push({id:String(i),memberHash:state.memberHash,subjectHash:state.subjectHash});
    coldOpenMs.push(state.probe.coldOpenMs);transactionCount=transactionCount===null?state.probe.transactionCount:Math.min(transactionCount,state.probe.transactionCount);
    await activity(page);
    const clock=await calibration(page);clocks[String(i)]={before:{...clock,at:clock.sentAt}};
  }
  // Concurrent pair first; every confirmation uses the visible ordinary Add flow.
  await Promise.all(pages.map((page,i)=>draft(page,i)));
  const before=await Promise.all(pages.map(page=>page.evaluate(()=>Object.keys(window.__ledgerAcceptance.commands))));
  await Promise.all(pages.map(page=>page.locator('[data-add-confirm]').click()));
  await Promise.all([collect(0,1,before[0]),collect(1,0,before[1])]);
  samples.sort((a,b)=>Number(a.author)-Number(b.author));concurrentPairs=1;
  for(let i=2;i<Math.max(2,count);i++){
    await Promise.all(pages.map(async page=>{
      const search=page.getByPlaceholder('Search notes, place, category…');
      await search.fill(`${prefix}-${i}`);await search.evaluate(node=>node.scrollIntoView({block:'center'}));
    }));
    await draft(pages[0],i);
    if(idleMs)await pages[0].waitForTimeout(idleMs);
    const ids=await pages[0].evaluate(()=>Object.keys(window.__ledgerAcceptance.commands));
    await pages[0].locator('[data-add-confirm]').click();await collect(0,1,ids);
  }
  for(let i=0;i<2;i++){const clock=await calibration(pages[i]);clocks[String(i)].after={...clock,at:clock.receivedAt};}
  maxPairWindowMs=Math.abs(correctedTime(samples[0].confirmAt,clocks['0']).at-correctedTime(samples[1].confirmAt,clocks['1']).at);
  lostOperations=0;duplicatedOperations=0;
  const probes=await Promise.all(pages.map(page=>page.evaluate(()=>window.__ledgerAcceptance)));
  for(const probe of probes)for(let i=0;i<Math.max(2,count);i++){
    const rows=Object.values(probe.canonicalTrialRows).filter(row=>row.note===`${prefix}-${i}`);
    if(rows.length===0)lostOperations++;
    if(rows.length>1)duplicatedOperations+=rows.length-1;
    if(rows.some(row=>row.amountCents!==101+i))errors.push('CANONICAL_AMOUNT_MISMATCH');
  }
  conflictDialogs=probes.reduce((n,p)=>n+p.conflictDialogs,0);privacyLeaks=probes.reduce((n,p)=>n+p.privacyLeaks,0);
  errors.push(...probes.flatMap(p=>p.errors));
} catch(error){
  errors.push(error.message);
  if(local)for(let i=0;i<pages.length;i++){
    const diagnostic=await pages[i].evaluate(()=>({readiness:document.querySelector('[data-books-readiness]')?.dataset.booksReadiness,live:document.querySelector('.sync-freshness')?.textContent,body:document.body.innerText.slice(0,2000),probe:window.__ledgerAcceptance})).catch(()=>null);
    await mkdir('artifacts/ledger-sync',{recursive:true});
    await writeFile(`artifacts/ledger-sync/${prefix}-failure-${i}.json`,JSON.stringify(diagnostic,null,2));
    await pages[i].screenshot({path:`artifacts/ledger-sync/${prefix}-failure-${i}.png`}).catch(()=>{});
  }
} finally {
  const trial={version:1,url,release,condition,participants,concurrentCommandIds:samples.slice(0,2).map(s=>s.id),startupDismissals,idleBeforeConfirmMs:idleMs,requestedSamples:Math.max(2,count),transactionCount,clocks,coldOpenMs,samples,concurrentPairs,maxPairWindowMs,
    lostOperations,duplicatedOperations,conflictDialogs,privacyLeaks,errors,evidenceClass:local?'local-ordinary-app-browser':'hosted-ordinary-app-browser',
    limitations:['Two-frame paint upper bound; not exact physical paint.','Cold-open in local mode is fresh document with previously imported IndexedDB replica.','Bytes count framed commands, events and ACKs across both clients; control frames and HTTP are excluded.','Privacy metric checks scope markers and Personal envelope recipient; separate adversarial canary tests are required.','A thirty-second idle with background presence is not a proven cold LTE radio.','Physical Toronto LTE warm and cold proof remains required.']};
  const evaluation=evaluateLedgerTrial(trial);if(errors.length){evaluation.pass=false;evaluation.failures.push(...errors);}
  if(local&&!evaluation.pass)for(let i=0;i<pages.length;i++){
    await mkdir('artifacts/ledger-sync',{recursive:true});
    await pages[i].screenshot({path:`artifacts/ledger-sync/${prefix}-result-${i}.png`}).catch(()=>{});
  }
  await mkdir(new URL('.',new URL(output,`file://${process.cwd()}/`)),{recursive:true});
  await writeFile(output,JSON.stringify({trial,evaluation},null,2));
  console.log(JSON.stringify({output,...evaluation},null,2));
  await Promise.all(contexts.map(context=>context.close()));await browser.close();
  if(!evaluation.pass)process.exitCode=1;
}
