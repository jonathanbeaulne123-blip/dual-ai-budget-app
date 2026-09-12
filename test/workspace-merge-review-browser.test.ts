import {it,expect,beforeAll,afterAll} from 'vitest';
import {createServer,type ViteDevServer} from 'vite';
import {chromium,type Browser,type Page} from '@playwright/test';
import type {} from './fixtures/workspaceMergeReviewProof.tsx';
let server:ViteDevServer,browser:Browser,address:string;
beforeAll(async()=>{
 server=await createServer({configFile:false,root:process.cwd(),cacheDir:'node_modules/.workspace-merge-review',esbuild:{jsx:'automatic'},logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{name:'review',configureServer(vite){vite.middlewares.use('/__merge_review',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/test/fixtures/workspaceMergeReviewProof.tsx"></script></body></html>');});}}]});
 await server.listen();address=`http://127.0.0.1:${(server.httpServer!.address()as{port:number}).port}/__merge_review`;browser=await chromium.launch({headless:true});
},30000);
afterAll(async()=>{await browser?.close();await server?.close();});
async function open(){const page=await browser.newPage({viewport:{width:390,height:900}});page.setDefaultTimeout(5000);await page.goto(address);return page;}
async function saveAndApprove(page:Page){
 await page.getByLabel('A page for this intention').fill('This source belongs to our evening.');
 await page.getByRole('button',{name:'Save privately to Workspace'}).click();
 await page.getByText('Written by you. Review before sharing or relying on this work.').waitFor();
 const experienceId=(await page.evaluate(()=>window.workspaceMergeProof.snapshot())).projects[0]!.id;
 await page.getByText('What an activated Hercules run can use',{exact:true}).click();
 await page.getByLabel('I reviewed this context and the provider disclosure.').check();
 await page.evaluate(()=>window.workspaceMergeProof.execution());
 await page.getByRole('button',{name:'Approve this context for activated runs'}).click();
 await page.getByText('This version has your disclosure approval.').waitFor({state:'attached'});
 return experienceId;
}
it('finishes its first StrictMode refresh without requiring a focus or reconnect event',async()=>{
 const page=await open();try{
  await page.getByRole('button',{name:'Save privately to Workspace'}).waitFor();
  expect(await page.getByRole('alert').count()).toBe(0);
  await page.getByLabel('A page for this intention').fill('The first opening works.');
  await page.getByRole('button',{name:'Save privately to Workspace'}).click();
  await expect.poll(async()=>(await page.evaluate(()=>window.workspaceMergeProof.snapshot())).projects.length).toBe(1);
 }finally{await page.close();}
});
it.each(['classic','taylor','newfoundland']as const)('opens an explicitly separate private report and preserves the intention in %s',async theme=>{
 const page=await open();try{
  await page.evaluate(value=>window.workspaceMergeProof.theme(value),theme);
  const experienceId=await saveAndApprove(page);
  await page.getByLabel('A page for this intention').fill('PRIVATE_UNSAVED_INTENTION_CANARY');
  await page.evaluate(id=>sessionStorage.setItem('hercules-workspace:synthetic-person:development:HH-proof:MEM-001',JSON.stringify({projectId:id,composer:'Restored private selection'})),experienceId);
  await page.getByRole('button',{name:'Report a bug',exact:true}).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('heading',{name:'A bug to put right',exact:true}).waitFor();
  expect(await page.getByLabel('A page for this intention').count()).toBe(0);
  const snapshot=await page.evaluate(()=>window.workspaceMergeProof.snapshot()),report=snapshot.projects.find(p=>p.title==='A bug to put right')!;
  expect(report.id).not.toBe(experienceId);expect(report.experience).toBeUndefined();
  expect(JSON.stringify(report)).not.toContain('PRIVATE_UNSAVED_INTENTION_CANARY');
  expect(report.messages).toEqual([]);
  await page.getByLabel('Talk to Hercules').fill('REPORT_ONLY_CANARY: the app stopped responding.');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect.poll(async()=>(await page.evaluate(()=>window.workspaceMergeProof.snapshot())).projects.find(p=>p.id===report.id)?.messages.length).toBe(1);
  const after=await page.evaluate(()=>window.workspaceMergeProof.snapshot());
  expect(after.projects.find(p=>p.id===report.id)?.messages[0]?.text).toContain('REPORT_ONLY_CANARY');
  expect(after.projects.find(p=>p.id===experienceId)?.messages).toEqual([]);
  const posts=await page.evaluate(()=>window.workspaceMergeProof.posts())as Array<{command:{type:string};projectId:string}>;
  expect(posts.filter(p=>p.command.type==='create'&&p.projectId===report.id)).toHaveLength(1);
  expect(after.projects.find(p=>p.id===experienceId)?.experience?.providerApprovalDigest).not.toBeNull();
  await page.evaluate(()=>window.workspaceMergeProof.returnToIntention());
  await page.getByLabel('A page for this intention').waitFor();
  expect(await page.getByLabel('A page for this intention').inputValue()).toBe('PRIVATE_UNSAVED_INTENTION_CANARY');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }finally{await page.close();}
},30000);
