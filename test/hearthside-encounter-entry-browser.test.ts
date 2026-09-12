import {afterAll,beforeAll,expect,it} from 'vitest';
import {build} from 'esbuild';
import {createServer,type Server} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {chromium,expect as uiExpect,type Browser,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {encounterPatchPlugin} from './hearthside-encounter-patch.ts';
import {encounterEntryWorker} from './fixtures/hearthside-encounter-entry-worker.ts';
import {encounterEntryBrowser} from './fixtures/hearthside-encounter-entry-browser.ts';
import {encounterPack} from '../src/hearthside/encounterPacks.ts';
import type {EncounterContent} from '../src/hearthside/encounterEntryController.ts';
import type {MemoryComposition} from '../src/hearthside/contracts.ts';
let browser:Browser,server:Server,mf:Miniflare,base='',loseKind='',loseUpload=false;
const calls:{path:string;body:any;status:number;error?:string}[]=[];
declare global{interface Window{entryProof:{theme(value:string):void;openEncounter(id:string):void;content():Promise<EncounterContent>;draft():MemoryComposition|null;dispose():void};entryTools:any;}}
beforeAll(async()=>{
  const vaultIntegrated=(await readFile('workers/hearthsideVault.ts','utf8')).includes('new HearthsideVaultEncounters(');
  const [worker,app]=await Promise.all([
    build({stdin:{resolveDir:process.cwd(),contents:encounterEntryWorker},bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',external:['cloudflare:*','node:*'],plugins:vaultIntegrated?[]:[encounterPatchPlugin()]}),
    build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:encounterEntryBrowser},bundle:true,write:false,outfile:'entry.js',platform:'browser',format:'iife',target:'es2022'})]);
  mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:worker.outputFiles[0]!.text,compatibilityDate:'2026-08-27',compatibilityFlags:['nodejs_compat'],durableObjects:{VAULTS:{className:'EntryVault',useSQLite:true},ROOMS:{className:'EntryRoom',useSQLite:true}},r2Buckets:['MEDIA']}));
  const js=app.outputFiles.find(f=>f.path.endsWith('.js'))!.text,css=app.outputFiles.find(f=>f.path.endsWith('.css'))!.text;
  server=createServer(async(request,response)=>{
    if(request.url==='/entry.js'){response.setHeader('Content-Type','text/javascript');response.end(js);return;}
    if(request.url?.startsWith('/api/')||request.url?.startsWith('/ledger-sync/')||request.url?.startsWith('/fixture/')){
      try{const chunks:Buffer[]=[];for await(const chunk of request)chunks.push(Buffer.from(chunk));const bytes=Buffer.concat(chunks),headers=new Headers();for(const [name,value]of Object.entries(request.headers))if(value)headers.set(name,Array.isArray(value)?value.join(','):value);
        const result=await mf.dispatchFetch('http://localhost'+request.url,{method:request.method,headers:Object.fromEntries(headers.entries()),...(bytes.length?{body:bytes}:{})});
        const body=headers.get('content-type')?.includes('application/json')&&bytes.length?JSON.parse(bytes.toString()):null;
        calls.push({path:request.url,body,status:result.status,...(!result.ok?{error:await result.clone().text()}:{})});
        if(result.ok&&(loseKind&&body?.operation?.kind===loseKind||loseUpload&&request.method==='PUT')){loseKind='';loseUpload=false;response.writeHead(502,{'Content-Type':'application/json'});response.end(JSON.stringify({error:'SYNTHETIC_LOST_ACK'}));return;}
        response.writeHead(result.status,Object.fromEntries(result.headers.entries()));response.end(Buffer.from(await result.arrayBuffer()));
      }catch(e){response.writeHead(500,{'Content-Type':'application/json'});response.end(JSON.stringify({error:String(e)}));}return;
    }
    response.setHeader('Content-Type','text/html');response.end(`<html lang="en"><head><title>Hearthside entry — synthetic authenticated proof</title><style>body{font-family:system-ui;margin:0;padding:12px}*{box-sizing:border-box}img,svg{max-width:100%}${css}</style></head><body><main><h1>Our shared home</h1><div id="root"></div></main><script src="/entry.js"></script></body></html>`);
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('NO_SERVER');base=`http://127.0.0.1:${address.port}`;
  browser=await chromium.launch({headless:true});await mkdir('/tmp/hearthside-encounter-entry-proof',{recursive:true});
},60000);
afterAll(async()=>{await browser?.close();if(server)await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await mf?.dispose();});
async function answer(page:Page,text:string){await page.locator('.encounter-private-paper textarea').fill(text);await page.getByRole('button',{name:'Save my private answer',exact:true}).click();await uiExpect(page.getByRole('status').filter({hasText:'Your answer is saved privately'})).toBeVisible();}
async function reveal(page:Page){await page.getByRole('button',{name:'Review my choice to reveal',exact:true}).click();await page.getByRole('button',{name:'Choose to reveal this version',exact:true}).click();await uiExpect(page.getByRole('status').filter({hasText:'Your choice is saved'})).toBeVisible();}
async function refresh(page:Page){await page.getByRole('button',{name:'Refresh our encounter',exact:true}).click();await uiExpect(page.getByRole('status').filter({hasText:'The current encounter is open.'})).toBeVisible();}
async function make(page:Page,text:string){await page.getByRole('button',{name:'Continue to making',exact:true}).click();await page.locator('.encounter-make textarea').fill(text);await page.locator('.encounter-colours button').nth(1).click();await page.getByRole('button',{name:'Place my contribution',exact:true}).click();await uiExpect(page.getByRole('status').filter({hasText:'Your contribution is shared'})).toBeVisible();}
async function keep(page:Page){await page.getByRole('button',{name:'Review our keepsake',exact:true}).click();await page.getByLabel('I reviewed this whole composition and both people’s words.').check();await page.getByRole('button',{name:'Keep this exact composition',exact:true}).focus();await page.keyboard.press('Enter');await uiExpect(page.getByRole('button',{name:'You chose to keep this composition',exact:true})).toBeVisible();}
async function pair(packId:string){
  const pack=encounterPack(packId),ca=await browser.newContext({reducedMotion:'reduce'}),cb=await browser.newContext({reducedMotion:'reduce'}),a=await ca.newPage(),b=await cb.newPage();
  await a.goto(base+'/?actor=A');await a.evaluate(theme=>window.entryProof.theme(theme),pack.theme);const starting=a.waitForResponse(r=>r.url().includes('/encounter-command'),{timeout:5000}).catch(async e=>{throw Error(String(e)+'\n'+await a.locator('body').innerText()+'\n'+JSON.stringify(calls.slice(-8)));});await a.getByRole('button',{name:`Begin ${pack.title}`,exact:true}).click();const started=await starting;expect(started.ok(),await started.text()).toBe(true);await a.waitForURL(/\/encounters\//);
  await a.getByRole('heading',{name:pack.title,exact:true}).waitFor();const id=(await a.evaluate(()=>window.entryProof.content())).state.encounters!.at(-1)!.id;
  await b.goto(base+'/?actor=B');await b.evaluate(({id,theme})=>{window.entryProof.theme(theme);window.entryProof.openEncounter(id);},{id,theme:pack.theme});await b.getByRole('heading',{name:pack.title,exact:true}).waitFor();
  await answer(a,'Alex noticed the quiet light.');await uiExpect(b.getByText('Alex noticed the quiet light.',{exact:true})).toHaveCount(0);await answer(b,'Sam noticed the warm sound.');await reveal(b);await refresh(a);await reveal(a);await make(a,'A little light');await refresh(b);await make(b,'A warm room');await keep(b);await refresh(a);await keep(a);
  return{a,b,ca,cb,id,pack};
}
it('opens stable routes from all three seasonal worlds, uses two authenticated clients, and creates actual Studio or reviewed memory outcomes',async()=>{
  for(const packId of ['classic-spring-window','taylor-spring-spread','newfoundland-spring-ice']){
    const {a,b,ca,cb,id,pack}=await pair(packId);
    for(const width of [320,390,719,720,1100,1440,1920]){await a.setViewportSize({width,height:1000});expect(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${pack.theme}/${width}`).toBe(true);}
    const axe=await new AxeBuilder({page:a}).include('.encounter-entry').analyze();expect(axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
    if(pack.keep.medium==='studio'){
      loseKind='encounter.create-piece';await a.getByRole('button',{name:'Make this piece from our choices',exact:true}).click();await a.getByRole('button',{name:'Retry saved shared action',exact:true}).waitFor({timeout:5000}).catch(async e=>{throw Error(String(e)+'\n'+await a.locator('body').innerText()+'\n'+JSON.stringify(calls.slice(-8)));});
      const original=calls.filter(c=>c.body?.operation?.kind==='encounter.create-piece').at(-1)!.body.id;
      await a.reload();await a.getByRole('button',{name:'Retry saved shared action',exact:true}).click();await a.getByRole('heading',{name:'Our actual Studio piece',exact:true}).waitFor();
      const attempts=calls.filter(c=>c.body?.operation?.kind==='encounter.create-piece').map(c=>c.body.id);expect(attempts.slice(-2)).toEqual([original,original]);
      const state=(await a.evaluate(()=>window.entryProof.content())).state;expect(state.designs).toHaveLength(1);expect(state.designs[0]!.bankId).toBeNull();expect(state.encounters!.find(e=>e.id===id)!.outcomes).toHaveLength(1);
      await refresh(b);await b.getByRole('button',{name:'Continue with our actual Studio piece',exact:true}).click();await b.getByRole('heading',{name:'Our actual Studio piece',exact:true}).waitFor();expect(new URL(b.url()).pathname).toBe(new URL(a.url()).pathname);
    }else{
      if(pack.theme==='taylor')loseUpload=true;
      await a.getByRole('button',{name:'Open this card as a memory draft',exact:true}).click();
      if(pack.theme==='taylor'){await a.getByRole('button',{name:'Resume this reviewed memory draft',exact:true}).waitFor();await a.reload();await a.getByRole('button',{name:'Resume this reviewed memory draft',exact:true}).click();}
      await a.getByRole('region',{name:'Actual memory draft and review'}).waitFor();const draft=await a.evaluate(()=>window.entryProof.draft());expect(draft!.recollections).toEqual([{memberId:'A',text:'Alex noticed the quiet light.'}]);expect(JSON.stringify(draft)).not.toContain('Sam noticed');
      await a.getByRole('button',{name:'Share this composition for us to review',exact:true}).click();await a.getByRole('heading',{name:'We each choose this whole composition',exact:true}).waitFor();
      await a.getByRole('button',{name:'Keep this exact version',exact:true}).click();await a.getByRole('button',{name:'You chose to keep this version',exact:true}).waitFor();
      await b.getByRole('button',{name:'Refresh the shared room',exact:true}).click();await b.getByRole('button',{name:'Open our memory review',exact:true}).click();await b.getByRole('button',{name:'Keep this exact version',exact:true}).click();await b.getByRole('button',{name:'You chose to keep this version',exact:true}).waitFor();
      await a.getByRole('button',{name:'Refresh the shared room',exact:true}).click();await a.getByRole('button',{name:'Open our memory review',exact:true}).click();
      await a.getByRole('button',{name:'Refresh our choices',exact:true}).click();await a.getByRole('button',{name:'Place our kept memory',exact:true}).click();await a.getByText('Kept by us, just as we reviewed it.',{exact:true}).waitFor();
      await a.getByRole('button',{name:'Back to our encounter',exact:true}).click();await a.waitForURL(/\/encounters\//);
      await a.getByRole('button',{name:'Refresh the shared room',exact:true}).click();await a.getByRole('button',{name:'Link this kept memory to our encounter',exact:true}).click();await a.getByText('This exact kept memory is linked here.',{exact:true}).waitFor();
      const state=(await a.evaluate(()=>window.entryProof.content())).state;expect(state.encounters!.find(e=>e.id===id)!.outcomes).toEqual([{kind:'memory',id:draft!.id,revision:1,recipeDigest:expect.any(String)}]);
      const uploads=calls.filter(c=>c.path.endsWith('/media/'+draft!.media[0]!.contentId));expect(new Set(uploads.map(c=>c.path)).size).toBe(1);
      if(pack.theme==='taylor'){
        const interrupted=await a.evaluate(async id=>{
          const {connection,EncounterEntryController:Controller,readContent}=window.entryTools;let opened=0;
          const controller=new Controller(connection,readContent,{onOpenEncounter:()=>opened++,onOpenPiece:()=>opened++,onMemoryDraft:async()=>{opened++;return true;},onOpenMemory:()=>opened++});
          const fresh=await controller.refresh(),encounter=fresh.state.encounters.find((e:any)=>e.id===id),bridge=await controller.bridgeFor(encounter);
          const original=crypto.subtle.digest.bind(crypto.subtle);let reached!:()=>void,release!:()=>void;
          const hashing=new Promise<void>(resolve=>reached=resolve),resume=new Promise<void>(resolve=>release=resolve);
          crypto.subtle.digest=async(algorithm,data)=>{if(data instanceof ArrayBuffer&&new Uint8Array(data)[0]===137){reached();await resume;}return original(algorithm,data);};
          try{const pending=controller.resumeMemory(bridge).then(()=>'',(e:Error)=>e.message);await hashing;controller.close();release();return {error:await pending,opened};}
          finally{crypto.subtle.digest=original;controller.close();release();}
        },id);
        expect(interrupted).toEqual({error:'SCOPE_CHANGED',opened:0});
      }

    }
    await a.setViewportSize({width:390,height:1000});await a.screenshot({path:`/tmp/hearthside-encounter-entry-proof/${pack.theme}-actual-outcome.png`,fullPage:true});await ca.close();await cb.close();
  }
  expect(calls.filter(c=>c.path.includes('encounter-command')).every(c=>!JSON.stringify(c.body).includes('noticed the'))).toBe(true);
},180000);
it('persists only a scoped shared request, validates receipts and corrupt recovery, and stops after an account leaves',async()=>{
  const context=await browser.newContext(),page=await context.newPage();await page.goto(base+'/?actor=A');
  const result=await page.evaluate(async()=>{
    const {EncounterSharedClient:Client,connection,canonical,sha256String}=window.entryTools,scope={...connection.scope,householdId:'HH-CLIENT-PROBE'},sent:any[]=[];
    let mode='malformed';const request=async(_path:string,options:RequestInit)=>{const body=JSON.parse(String(options.body));sent.push(body);
      if(mode==='malformed')return new Response('truncated',{status:200});if(mode==='reject')return Response.json({error:'ENCOUNTER_CHANGED'},{status:409});
      return Response.json({version:1,receipt:{id:'HS-ENCOUNTER-'+body.id,actor:scope.memberId,digest:sha256String(canonical(body)),sequence:1,postedIds:[],commandKind:'hearthsideEncounter'}});};
    const command={kind:'encounter.pause',id:'probe'},first=new Client(scope,async()=>'NEVER-PERSIST-ME',request);let uncertain='';try{await first.submit(command);}catch(e){uncertain=(e as Error).message;}
    const pending=await first.pending(),other=new Client({...scope,subject:'other-account'},async()=>'different',request),isolated=await other.pending();
    first.close();other.close();const retry=new Client(scope,async()=>'TRANSIENT-TOKEN',request);mode='valid';await retry.retry();const cleared=await retry.pending();
    // A same-author second tab reserves the exact same command identity in one real IDB transaction.
    const second=new Client(scope,async()=>'TRANSIENT-TOKEN',request);mode='malformed';await Promise.allSettled([retry.submit(command),second.submit(command)]);const concurrent=sent.slice(-2).map(r=>r.id);
    mode='reject';try{await retry.retry();}catch{}const rejected=await retry.pending();second.close();retry.close();
    let release!:(v:string)=>void,network=0;const leaving=new Client(scope,()=>new Promise<string>(r=>release=r),async()=>{network++;return new Response('');});const action=leaving.submit(command).catch((e:Error)=>e.message);
    while(!release)await new Promise(r=>setTimeout(r,0));leaving.close();release('transient');const closed=await action;
    const recovered=new Client(scope,async()=>'transient',request),afterClose=await recovered.pending();recovered.close();
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('hearthside-encounter-shared-requests-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction('pending','readwrite');tx.objectStore('pending').put({...afterClose,authorization:'SHOULD-NOT-BE-ACCEPTED'},canonical(scope));tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
    const corrupted=new Client(scope,async()=>{network++;return'transient';},request);let corrupt='';try{await corrupted.retry();}catch(e){corrupt=(e as Error).message;}corrupted.close();
    return{uncertain,pending,isolated,cleared,ids:sent.slice(0,2).map(r=>r.id),concurrent,rejected,closed,network,afterClose,corrupt};
  });
  expect(result.uncertain).toBe('ENCOUNTER_RECEIPT_UNCERTAIN');expect(result.isolated).toBeNull();expect(result.cleared).toBeNull();expect(result.ids[0]).toBe(result.ids[1]);expect(result.concurrent[0]).toBe(result.concurrent[1]);
  expect(JSON.stringify(result.pending)).not.toContain('PERSIST');expect(result.rejected).toBeNull();expect(result.closed).toBe('SCOPE_CHANGED');expect(result.network).toBe(0);expect(result.afterClose).not.toBeNull();expect(result.corrupt).toBe('ENCOUNTER_RECOVERY_INVALID');await context.close();
},30000);
it('blocks changed compositions and withdrawn private reveals before resuming a private memory upload or opening a draft',async()=>{
  const {a,b,ca,cb,id}=await pair('taylor-summer-setlist');
  loseUpload=true;await a.getByRole('button',{name:'Open this card as a memory draft',exact:true}).click();await a.getByRole('button',{name:'Resume this reviewed memory draft',exact:true}).waitFor();
  const before=calls.filter(c=>c.path.includes('/media/')).length;
  const result=await a.evaluate(async id=>{
    const tools=window.entryTools,{connection,EncounterEntryController:Controller,readContent,encounterCompositionDigest:digestOf}=tools;
    let opened=0;const callbacks={onOpenEncounter:()=>opened++,onOpenPiece:()=>opened++,onMemoryDraft:async()=>{opened++;return true;},onOpenMemory:()=>opened++};
    const controller=new Controller(connection,readContent,callbacks),fresh=await controller.refresh(),encounter=fresh.state.encounters.find((e:any)=>e.id===id),digest=await digestOf(encounter),bridge=await controller.bridgeFor(encounter);
    let changed='';try{await controller.studio(id,'f'.repeat(64));}catch(e){changed=(e as Error).message;}
    const wrong=new Controller(connection,async()=>({...fresh,householdId:'HH-OTHER'}),callbacks);let switched='';try{await wrong.refresh();}catch(e){switched=(e as Error).message;}wrong.close();
    await connection.client.command({operation:'encounter-private',input:{encounterId:id,action:'withdraw',id:crypto.randomUUID()}});
    let withdrawn='';try{await controller.resumeMemory(bridge);}catch(e){withdrawn=(e as Error).message;}
    const recoverable=await controller.bridges.read(connection.scope,id,digest);controller.close();return{changed,switched,withdrawn,opened,recoverable:Boolean(recoverable)};
  },id);
  expect(result).toEqual({changed:'ENCOUNTER_CHANGED',switched:'ENCOUNTER_SCOPE_CHANGED',withdrawn:'REVEAL_REQUIRED',opened:0,recoverable:true});expect(calls.filter(c=>c.path.includes('/media/')).length).toBe(before);
  await refresh(b);await b.getByRole('heading',{name:'This reveal is withdrawn'}).waitFor();await uiExpect(b.getByText('Alex noticed the quiet light.',{exact:true})).toHaveCount(0);await ca.close();await cb.close();
},60000);
