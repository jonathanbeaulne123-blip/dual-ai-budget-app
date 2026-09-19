import {describe,it,expect,beforeAll,afterAll,afterEach} from 'vitest';
import {createServer,type ViteDevServer} from 'vite';
import {chromium,type Browser,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sharedLifeRestoreHarness} from './fixtures/hearthsideSharedLifeRestoreRuntime.ts';
import type {LedgerCommand} from '../src/ledgerSync/protocol.ts';
import type {SharedLifeRestoreIntent} from '../src/hearthside/sharedLifeRestoreContracts.ts';
import type {} from './fixtures/hearthsideSharedLifeRestoreProof.tsx';

describe('shared-life review: actual React surface and Worker authority',()=>{
 let server:ViteDevServer,browser:Browser,page:Page,address:string,cacheDir:string;const apps=new Map<string,Awaited<ReturnType<typeof sharedLifeRestoreHarness>>>(),commands=new Map<string,LedgerCommand>(),errors:string[]=[];
 beforeAll(async()=>{
  for(const householdId of ['HH-browser-a','HH-browser-b']){
   const app=await sharedLifeRestoreHarness(householdId);apps.set(householdId,app);
   const experience={version:1 as const,id:'EXP-evening',revision:1,title:'An evening at home',intention:'The kettle, a little music, and time to talk.',state:'dreaming' as const,horizon:'tonight' as const,createdBy:'MEM-001',references:[]};
   expect(await app.submit({kind:'experience.save',expectedRevision:0,value:experience})).toMatchObject({type:'ack'});
   const note={version:1 as const,id:'NOTE-welcome',revision:1,authorId:'MEM-001',text:'There is room for an ordinary evening together.',room:'common' as const,experienceId:experience.id,archived:false};
   expect(await app.submit({kind:'note.save',expectedRevision:0,value:note})).toMatchObject({type:'ack'});
   expect((await app.post('restore-test',{kind:'checkpoint'})).status).toBe(200);
   expect(await app.submit({kind:'experience.save',expectedRevision:1,value:{...experience,revision:2,title:'A weekend away',intention:'Make space for a longer adventure.',state:'lived'}})).toMatchObject({type:'ack'});
   expect(await app.submit({kind:'note.save',expectedRevision:1,value:{...note,revision:2,text:'Bring the raincoat; we might walk by the water.'}})).toMatchObject({type:'ack'});
  }
  cacheDir=await mkdtemp(join(tmpdir(),'hearthside-restore-vite-'));
  // The middleware page is the only entry; unrelated app HTML must not enter this fixture's dependency crawl.
  server=await createServer({configFile:false,root:process.cwd(),cacheDir,optimizeDeps:{entries:['test/fixtures/hearthsideSharedLifeRestoreProof.tsx']},esbuild:{jsx:'automatic'},logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{name:'restore-proof',configureServer(vite){
   vite.middlewares.use('/__restore_proof',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic shared-life restore proof</title><style>body{margin:0;background:#f6f2e8;font-family:system-ui;color:#352b24}*{box-sizing:border-box}</style></head><body><div id="root"></div><script type="module" src="/test/fixtures/hearthsideSharedLifeRestoreProof.tsx"></script></body></html>');});
   vite.middlewares.use('/__restore_api',(req,res)=>{void(async()=>{try{
    let text='';for await(const chunk of req)text+=String(chunk);const body=JSON.parse(text) as {householdId:string;memberId:string;action:string;input:SharedLifeRestoreIntent};const app=apps.get(body.householdId);if(!app)throw Error('FORBIDDEN');
    let result:unknown;
    if(body.action==='state')result=await app.household(body.memberId);
    else if(body.action==='command'){
     const key=JSON.stringify([body.householdId,body.memberId,body.input.id]);let command=commands.get(key);if(!command){command=await app.restoreCommand(body.input.operation,body.memberId);commands.set(key,command);}result=await app.send(command,body.memberId);
    }else{const response=body.action==='points'?await app.get('points',body.memberId):await app.post('shared-life-restore',body.input,body.memberId);res.statusCode=response.status;result=await response.json();}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
   }catch(error){res.statusCode=409;res.end(String(error));}})();});
  }}]});await server.listen();address=`http://127.0.0.1:${(server.httpServer!.address()as{port:number}).port}/__restore_proof`;browser=await chromium.launch({channel:'chrome',headless:true});page=await (await browser.newContext({viewport:{width:1440,height:1000}})).newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});await mkdir('/tmp/hearthside-shared-life-restore-proof',{recursive:true});
 },60000);
 afterEach(async(context)=>{if(context.task.result?.state==='fail'){console.error(await page.locator('body').innerText());await page.screenshot({path:'/tmp/hearthside-shared-life-restore-proof/failure.png',fullPage:true});}});
 afterAll(async()=>{await browser?.close();await server?.close();for(const app of apps.values())await app.dispose();if(cacheDir)await rm(cacheDir,{recursive:true,force:true});});
 async function choosePoint(){await page.getByLabel('Saved point',{exact:true}).selectOption({label:'Accepted ledger revision 2'});await page.getByRole('checkbox',{name:/A weekend away/}).waitFor();}
 it('reviews exact words, survives uncertain reply/reload and scope changes, then requires both members before apply',async()=>{
  await page.goto(address);await choosePoint();await page.getByRole('checkbox',{name:/A weekend away/}).focus();await page.keyboard.press('Space');await page.getByRole('heading',{name:'A weekend away',exact:true}).waitFor();
  expect(await page.getByRole('button',{name:'Invite us to review these changes'}).isEnabled()).toBe(true);await page.evaluate(()=>window.sharedLifeRestoreProof.loseReply());await page.getByRole('button',{name:'Invite us to review these changes'}).click();await page.getByRole('button',{name:'Check and retry this same request'}).waitFor();
  const count=(await apps.get('HH-browser-a')!.household()).hearthside!.restoreReviews!.length;expect(count).toBe(1);
  await page.reload();await page.getByRole('button',{name:'Check and retry this same request'}).waitFor();await page.evaluate(()=>window.sharedLifeRestoreProof.scope('HH-browser-b'));await page.getByText(/HH-browser-b/).waitFor();expect(await page.getByRole('button',{name:'Check and retry this same request'}).count()).toBe(0);
  await page.evaluate(()=>window.sharedLifeRestoreProof.scope('HH-browser-a'));await page.getByRole('button',{name:'Check and retry this same request'}).click();await page.getByRole('button',{name:'Check and retry this same request'}).waitFor({state:'hidden'});expect((await apps.get('HH-browser-a')!.household()).hearthside!.restoreReviews).toHaveLength(count);
  await page.getByRole('button',{name:'Review 1 · 0 of 2 approvals'}).click();await page.getByRole('button',{name:'I approve these exact changes'}).waitFor();expect(await page.getByRole('button',{name:'Restore these changes',exact:true}).isDisabled()).toBe(true);
  await page.evaluate(()=>window.sharedLifeRestoreProof.online(false));await page.getByRole('button',{name:'I approve these exact changes'}).waitFor({state:'hidden'});await page.evaluate(()=>window.sharedLifeRestoreProof.online(true));await page.getByRole('button',{name:'I approve these exact changes'}).click();await page.getByRole('button',{name:'I approved this review'}).waitFor();
  await page.evaluate(()=>window.sharedLifeRestoreProof.scope('HH-browser-a','MEM-002'));await page.getByRole('button',{name:'Review 1 · 1 of 2 approvals'}).click();await page.getByRole('button',{name:'I approve these exact changes'}).click();await page.getByRole('button',{name:'I approved this review'}).waitFor();expect(await page.getByRole('button',{name:'Restore these changes',exact:true}).isEnabled()).toBe(true);
  await page.getByRole('button',{name:'Restore these changes',exact:true}).click();await page.getByRole('heading',{name:'Restored together'}).waitFor();const after=await apps.get('HH-browser-a')!.household();expect(after.hearthside!.experiences[0]).toMatchObject({revision:3,title:'An evening at home',state:'lived'});expect(errors).toEqual([]);
 },45000);
 it('renders authored material in three themes at seven widths; controls, focus, enlarged text and reduced motion remain accessible',async()=>{
  await page.goto(address);await page.getByLabel('Saved point',{exact:true}).selectOption({label:'Accepted ledger revision 2'});await page.getByRole('checkbox',{name:/Bring the raincoat/}).check();await page.getByRole('heading',{name:/Bring the raincoat/}).waitFor();
  for(const theme of ['classic','taylor','newfoundland'] as const){
   await page.evaluate(value=>window.sharedLifeRestoreProof.theme(value),theme);
   for(const width of [320,390,719,720,1100,1440,1920]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${theme} ${width}`).toBe(true);expect(await page.locator('.shared-life-restore button,.shared-life-restore select').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left< -1||r.right>innerWidth+1||r.height<43);}).length)).toBe(0);}
   for(const width of [390,1440]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`/tmp/hearthside-shared-life-restore-proof/${theme}-${width}.png`,fullPage:true});}
   const axe=await new AxeBuilder({page}).include('.shared-life-restore').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  }
  await page.setViewportSize({width:390,height:1000});await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.getByRole('button',{name:'Invite us to review these changes'}).focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');expect(await page.getByRole('button',{name:'Invite us to review these changes'}).evaluate(el=>el===document.activeElement&&getComputedStyle(el).outlineStyle!=='none')).toBe(true);await page.keyboard.press('Enter');await page.getByRole('button',{name:'Cancel this review'}).click();await page.getByRole('heading',{name:'Review cancelled'}).waitFor();await page.getByRole('button',{name:'Back to our room'}).click();expect(await page.evaluate(()=>window.sharedLifeRestoreProof.closed())).toBe(1);expect(errors).toEqual([]);
 },60000);
});
