import {expect,it} from 'vitest';
import {chromium,type BrowserContext,type Page} from '@playwright/test';
import {createServer} from 'vite';
import {realpath} from 'node:fs/promises';
import {financialAuditHash} from '../src/core/commandIdentity.ts';
import {projectKittyDesign} from '../src/hearthside/design.ts';
import type {KittyDesignDocument} from '../src/hearthside/designContracts.ts';
import {startHearthsideActualAppAuthority} from './fixtures/hearthsideActualAppAuthority.ts';
import {installLedgerBrowserProbe} from '../scripts/lib/ledger-browser-probe.mjs';

type ProbeCommand={id:string;ackAt:number|null;postedIds:string[];sequence:number;receiptValid:boolean};
const prefix='hs-v2-proof';

it('runs two actual App clients through real local LedgerRoom, Studio and recipient Vault authority',async()=>{
 const householdId=`HH-HEARTHSIDE-WEB-${crypto.randomUUID()}`,appRoot=process.cwd();
 const authority=await startHearthsideActualAppAuthority(householdId);
 const server=await createServer({configFile:false,envFile:false,root:appRoot,cacheDir:'/tmp/hearthside-v2-vite-cache',logLevel:'error',
  optimizeDeps:{exclude:['@electric-sql/pglite']},worker:{format:'es'},define:{
   'import.meta.env.VITE_HEARTHSIDE':'"1"','import.meta.env.VITE_HEARTHSIDE_DESIGN':'"1"','import.meta.env.VITE_HEARTHSIDE_VAULT':'"1"',
   'import.meta.env.VITE_HEARTHSIDE_WORKSPACE':'"0"','import.meta.env.VITE_HEARTHSIDE_GUESTS':'"0"','import.meta.env.VITE_HEARTHSIDE_AR':'"0"','import.meta.env.VITE_HEARTHSIDE_EXPORTS':'"0"',
   'import.meta.env.VITE_LEDGER_SYNC_V2':'"1"','import.meta.env.VITE_LEDGER_SYNC_LOCAL_AUTH':'"1"','import.meta.env.VITE_PRODUCTION_CONTINUITY':'"0"',
   'import.meta.env.VITE_HERCULES_PLAY':'"1"','import.meta.env.VITE_HERCULES_DRESSING_ROOM':'"1"','import.meta.env.VITE_HERCULES_WORKSPACE':'"0"'},
  server:{host:'127.0.0.1',port:0,fs:{allow:[appRoot,await realpath(appRoot+'/node_modules')]},proxy:{
   '/ledger-sync':{target:authority.base,ws:true},'/api/hearthside-vault':{target:authority.base},
  }}});await server.listen();
 const origin=`http://127.0.0.1:${(server.httpServer!.address() as {port:number}).port}`;
 const browser=await chromium.launch({channel:'chrome',headless:true}),contexts:BrowserContext[]=[],errors:string[]=[],legacyRest:string[]=[];
 const open=async(memberId:string)=>{
  const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});contexts.push(context);
  await context.addInitScript(installLedgerBrowserProbe,{prefix});
  await context.route('**/*',route=>{const url=new URL(route.request().url());return url.origin===origin?route.continue():route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',error=>errors.push(`${memberId}: ${error.message}`));
  page.on('request',request=>{if(/\/rest\/v1\/(household_snapshots|continuity_command_events)|publish_continuity_snapshot/.test(request.url()))legacyRest.push(request.url());});
  await page.goto(`${origin}/test/browser/ledger-sync-app.html?household=${householdId}&member=${memberId}`,{waitUntil:'domcontentloaded'});await ready(page);return page;
 };
 try{
  const one=await open('MEM-001'),two=await open('MEM-002');
  await Promise.all([openHearthside(one),openHearthside(two)]);
  const initial=await authority.household(),initialHash=await financialAuditHash(initial),initialSequence=(await authority.snapshot()).sequence;

  // Stable shared intention: ordinary App command, real ACK and one exact route on both clients.
  const intentionTitle=`${prefix} Friday soup`,intentionIds=await commandIds(one);
  await one.locator('#hearthside-add-intention').click();const intentionDraft=one.getByRole('region',{name:'Intention draft'});
  await intentionDraft.getByLabel('What shall we call it?').fill(intentionTitle);
  await intentionDraft.getByLabel('Why it matters').fill('A synthetic local continuity proof, without provider or hosted data.');
  await intentionDraft.getByRole('button',{name:'Save our intention',exact:true}).click();
  const intentionReceipt=await receiptAfter(one,intentionIds);await expect.poll(async()=>(await authority.snapshot()).sequence).toBe(intentionReceipt.sequence);
  await one.getByRole('heading',{name:intentionTitle,exact:true}).waitFor();const intentionPath=new URL(one.url()).pathname;
  expect(intentionPath).toMatch(/^\/hearthside\/experiences\/EXP-/);
  const otherIntention=two.locator('.hsr-object-index').getByRole('button',{name:new RegExp(`^Intention ${intentionTitle}`)});await otherIntention.waitFor();await otherIntention.click();
  await two.getByRole('heading',{name:intentionTitle,exact:true}).waitFor();expect(new URL(two.url()).pathname).toBe(intentionPath);
  await one.reload({waitUntil:'domcontentloaded'});await ready(one);await one.getByRole('heading',{name:intentionTitle,exact:true}).waitFor();expect(new URL(one.url()).pathname).toBe(intentionPath);
  expect((await authority.household()).hearthside?.experiences.filter(row=>row.title===intentionTitle)).toHaveLength(1);

  // One atomic canonical Task and Calendar record, each linked to the same intention.
  const taskTitle=`${prefix} put out bowls`,taskIds=await commandIds(one);await one.getByRole('button',{name:'Choose a next step',exact:true}).click();
  const taskDraft=one.getByRole('region',{name:'Connected task draft'});await taskDraft.getByLabel('What needs doing').fill(taskTitle);await taskDraft.getByLabel('Who will take it').selectOption('MEM-001');
  await taskDraft.getByRole('button',{name:'Add this connected task',exact:true}).click();const taskReceipt=await receiptAfter(one,taskIds);
  const taskArticle=two.locator('.hearthside-linked article').filter({hasText:taskTitle});await taskArticle.waitFor();
  let accepted=await authority.household();const task=accepted.tasks?.find(row=>row.title===taskTitle);expect(task).toMatchObject({visibility:'household',assigneeId:'MEM-001',deleted:false});
  expect(accepted.hearthside?.experiences.find(row=>row.title===intentionTitle)?.references.filter(row=>row.kind==='task'&&row.id===task!.id)).toHaveLength(1);
  await taskArticle.getByRole('button',{name:'Open',exact:true}).click();await two.locator('#planner-focused-task').waitFor();await two.getByRole('button',{name:'Return to Hearthside',exact:true}).click();await two.getByRole('heading',{name:intentionTitle,exact:true}).waitFor();

  const dateTitle=`${prefix} soup night`,dateIds=await commandIds(one);await one.getByRole('button',{name:'Make time for this',exact:true}).click();
  const dateDraft=one.getByRole('region',{name:'Connected date draft'});await dateDraft.getByLabel('What we are making time for').fill(dateTitle);await dateDraft.getByLabel('Starts').fill('2026-09-25');
  await dateDraft.getByRole('button',{name:'Add this date to Calendar',exact:true}).click();const dateReceipt=await receiptAfter(one,dateIds);
  const dateArticle=two.locator('.hearthside-linked article').filter({hasText:dateTitle});await dateArticle.waitFor();accepted=await authority.household();const date=accepted.nativeEvents?.find(row=>row.title===dateTitle);
  expect(date).toMatchObject({visibility:'household',allDay:true,deleted:false});expect(accepted.hearthside?.experiences.find(row=>row.title===intentionTitle)?.references.filter(row=>row.kind==='calendar-event'&&row.id===date!.id)).toHaveLength(1);
  await dateArticle.getByRole('button',{name:'Open',exact:true}).click();await two.getByLabel('Event title',{exact:true}).waitFor();expect(await two.getByLabel('Event title',{exact:true}).inputValue()).toBe(dateTitle);
  await two.getByRole('button',{name:'Return to Hearthside',exact:true}).click();await two.getByRole('heading',{name:intentionTitle,exact:true}).waitFor();
  expect(taskReceipt.sequence).toBeGreaterThan(initialSequence);expect(dateReceipt.sequence).toBeGreaterThan(taskReceipt.sequence);
  expect(await financialAuditHash(accepted)).toBe(initialHash);

  // The ordinary financial draft does not touch authority until its exact Final Confirm.
  const beforeReview=await authority.snapshot(),beforeReviewHousehold=await authority.household();
  await one.getByRole('button',{name:'Record',exact:true}).click();await one.getByRole('button',{name:'Purchase: record one',exact:true}).click();
  await one.getByLabel('Amount (CAD)',{exact:true}).fill('1.23');await one.getByRole('button',{name:'Enter',exact:true}).click();
  await one.getByRole('button',{name:'Groceries',exact:true}).click();
  const continueToAccount=one.getByRole('button',{name:'Continue to account',exact:true});if(await continueToAccount.isVisible())await continueToAccount.click();
  await one.locator('[data-entry-section="account"] button.swipe-cat:not(.more):not([disabled])').first().click();await one.locator('#add-note').fill(`${prefix}-final-confirm`);await one.getByRole('button',{name:'Continue',exact:true}).click();
  const finalIds=await commandIds(one);await one.waitForTimeout(250);
  const stillReview=await authority.snapshot(),stillReviewHousehold=await authority.household();expect(stillReview.sequence).toBe(beforeReview.sequence);expect(stillReviewHousehold.transactions).toEqual(beforeReviewHousehold.transactions);
  await one.locator('[data-add-confirm]').click();const finalReceipt=await receiptAfter(one,finalIds);expect(finalReceipt.postedIds.filter(id=>id.startsWith('TXN'))).toHaveLength(1);
  const afterFinal=await authority.household();expect(afterFinal.transactions.filter(row=>row.note===`${prefix}-final-confirm`)).toHaveLength(1);
  await expect.poll(()=>two.locator('.app').getAttribute('data-ledger-transaction-count')).toBe(String(afterFinal.transactions.length));
  const acceptedFinancialHash=await financialAuditHash(afterFinal);expect(acceptedFinancialHash).not.toBe(initialHash);

  // Simultaneous real Studio gestures converge; one member's undo leaves the partner's line.
  await openStudio(one);await openHearthside(two);await two.locator('#hearthside-room-studio').click();await two.locator('.hearthside[data-room="studio"]').waitFor();
  await one.getByRole('button',{name:'Start a piece',exact:true}).click();await one.getByRole('button',{name:'Leave the making table',exact:true}).waitFor();
  const shelf=two.locator('.studio-shelf-pieces>button').first();await shelf.waitFor();await shelf.click();await two.getByRole('button',{name:'Join this piece',exact:true}).click();
  for(const page of [one,two]){await page.getByRole('button',{name:'Paint and decorate',exact:true}).click();await page.getByText('Paint with the keyboard',{exact:true}).click();await page.getByRole('button',{name:'Add point at 50%, 50%',exact:true}).click();}
  const beforePaint=(await authority.snapshot()).sequence;await Promise.all([one,two].map(page=>page.getByRole('button',{name:'Finish my 1-point line',exact:true}).click()));
  await Promise.all([one,two].map(page=>page.getByRole('button',{name:'Finish my 0-point line',exact:true}).waitFor()));
  const designIndex=(await authority.household()).hearthside?.designs.at(0);expect(designIndex).toBeTruthy();
  let designResult=await authority.design('MEM-001',{kind:'read',designId:designIndex!.designId});expect(designResult.status).toBe(200);
  let document=(designResult.body as {document:KittyDesignDocument}).document,projected=projectKittyDesign(document),strokes=projected.pieces[0]!.piece.paint.strokes;
  expect((await authority.snapshot()).sequence).toBeGreaterThanOrEqual(beforePaint+2);expect(strokes).toHaveLength(2);expect(new Set(document.operations.filter(row=>row.operation.kind==='append-stroke').map(row=>row.actorId))).toEqual(new Set(['MEM-001','MEM-002']));
  await one.getByRole('button',{name:'Undo my last gesture',exact:true}).click();await expect.poll(async()=>((await authority.design('MEM-001',{kind:'read',designId:designIndex!.designId})).body as {document:KittyDesignDocument}).document.revision).toBeGreaterThan(document.revision);
  designResult=await authority.design('MEM-002',{kind:'read',designId:designIndex!.designId});document=(designResult.body as {document:KittyDesignDocument}).document;projected=projectKittyDesign(document);strokes=projected.pieces[0]!.piece.paint.strokes;
  expect(strokes).toHaveLength(1);expect(document.operations.find(row=>row.operation.kind==='undo-gesture')?.actorId).toBe('MEM-001');

  // Private Vault draft stays author-only until exact recipient publication; withdrawal revokes it.
  await Promise.all([openLetters(one),openLetters(two)]);const secret=`${prefix} private words`,letterTitle=`${prefix} private letter`;
  await one.getByLabel('Letter title').fill(letterTitle);await one.getByLabel('Your words').fill(secret);await one.getByRole('button',{name:'Save private draft',exact:true}).click();
  await one.getByText('Private cloud draft saved. It is still only yours.',{exact:true}).waitFor();
  const authorDraft=await authority.vaultSnapshot('MEM-001'),recipientBefore=await authority.vaultSnapshot('MEM-002');expect(authorDraft.status).toBe(200);expect(JSON.stringify(authorDraft.body)).toContain(secret);expect(JSON.stringify(recipientBefore.body)).not.toContain(secret);
  await one.getByLabel('Jonathan').check();await one.getByRole('button',{name:'Review sharing',exact:true}).click();await one.getByRole('button',{name:'Publish this exact letter',exact:true}).waitFor();
  expect(JSON.stringify((await authority.vaultSnapshot('MEM-002')).body)).not.toContain(secret);
  await one.getByRole('button',{name:'Publish this exact letter',exact:true}).click();await one.getByText('Your letter is available to its chosen recipient.',{exact:true}).waitFor();
  await two.getByRole('button',{name:'Refresh letters',exact:true}).click();const received=two.locator('.letters-cabinet').getByRole('button',{name:new RegExp(letterTitle)}).last();await received.waitFor();await received.click();await two.getByText(secret,{exact:true}).waitFor();
  const recipientAfter=await authority.vaultSnapshot('MEM-002');const publicationId=findPublicationId(recipientAfter.body,letterTitle);expect(publicationId).toBeTruthy();
  const outsider=await authority.vaultSnapshot('MEM-outsider');expect(outsider.status).toBe(200);expect(JSON.stringify(outsider.body)).not.toContain(secret);expect((await authority.vaultCommand('MEM-outsider',{operation:'read-publication',id:publicationId})).status).toBe(404);
  const sent=one.locator('.letters-cabinet').getByRole('button',{name:new RegExp(letterTitle)}).last();await sent.click();await one.getByRole('button',{name:'Withdraw this publication',exact:true}).click();await one.getByRole('button',{name:'Withdraw access now',exact:true}).click();
  await one.getByText('Access to this publication is withdrawn.',{exact:true}).waitFor();expect((await authority.vaultCommand('MEM-002',{operation:'read-publication',id:publicationId})).status).not.toBe(200);

  expect(await financialAuditHash(await authority.household())).toBe(acceptedFinancialHash);
  expect(errors).toEqual([]);expect(legacyRest).toEqual([]);
  expect([intentionReceipt,taskReceipt,dateReceipt,finalReceipt].every(row=>row.receiptValid)).toBe(true);
 }finally{await Promise.all(contexts.map(context=>context.close()));await browser.close();await server.close();await authority.dispose();}
},180000);

async function ready(page:Page){
 await page.locator('[data-books-readiness="ready"][data-ledger-live="true"]').waitFor({timeout:90000});
 for(const button of await page.getByRole('button',{name:'Not now',exact:true}).all())if(await button.isVisible())await button.click();
 const close=page.getByRole('button',{name:'Close reminders',exact:true});if(await close.count()&&await close.isVisible())await close.click();
}
async function openHearthside(page:Page){
 await page.getByRole('navigation',{name:'House rooms'}).getByRole('button',{name:'Together',exact:true}).click();await page.locator('.hearthside').waitFor();
 await page.locator('#hearthside-room-common').click();await page.locator('.hearthside[data-room="common"]').waitFor();await page.locator('#hearthside-add-intention').waitFor();
}
async function openStudio(page:Page){
 await openHearthside(page);await page.locator('#hearthside-room-studio').click();await page.locator('.hearthside[data-room="studio"]').waitFor();await page.locator('#hearthside-open-studio').click();await page.getByRole('region',{name:'Our pottery Studio'}).waitFor();
}
async function openLetters(page:Page){
 await openHearthside(page);await page.locator('#hearthside-open-letters').click();await page.getByRole('heading',{name:/The writing desk|The letter folio|Letters by the window/}).waitFor();
}
async function commandIds(page:Page){return page.evaluate(()=>Object.keys((window as unknown as {__ledgerAcceptance:{commands:Record<string,unknown>}}).__ledgerAcceptance.commands));}
async function receiptAfter(page:Page,before:string[]):Promise<ProbeCommand>{
 await page.waitForFunction(ids=>Object.values((window as unknown as {__ledgerAcceptance:{commands:Record<string,ProbeCommand>}}).__ledgerAcceptance.commands).some(row=>!ids.includes(row.id)&&row.ackAt),before,{timeout:45000});
 return page.evaluate(ids=>Object.values((window as unknown as {__ledgerAcceptance:{commands:Record<string,ProbeCommand>}}).__ledgerAcceptance.commands).find(row=>!ids.includes(row.id)&&row.ackAt)!,before);
}
function findPublicationId(value:unknown,title:string):string{
 if(!value||typeof value!=='object')return '';
 if('title' in value&&value.title===title&&'id' in value&&typeof value.id==='string')return value.id;
 for(const child of Object.values(value)) {const found=findPublicationId(child,title);if(found)return found;}
 return '';
}
