/** Plan Studio v3 integrated with the money model (D-282): both flags ON (`VITE_PLAN_STUDIO_V3`, `VITE_FUND_MODEL_V2`), the real
    components, fictional local books only, sorted by `migrateFundModel` in the page.
    `?page=studio|category` · `state=sorted|proposed|divided|agreed` · `member=MEM-001|MEM-002` · `theme=classic|taylor|newfoundland` · `lite=1`.
    - sorted: Sam's (fictional) contribution landed and is not divided yet; the open Chapter was meant for August, so its reminder shows.
    - proposed: Sam proposed the split; Alex is asked to say yes.
    - divided: the split is agreed; Alex (the custodian) suggested a Protect refill that Sam confirms.
    - agreed: divided, and both agreed the September plan.
    The bottom bar is a STAND-IN for the App's navigation. */
import { createServer } from 'vite';
import { createServer as createPortProbe } from 'node:net';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const css = [...readFileSync('src/main.tsx','utf8').matchAll(/import "\.\/(.*\.css)";/g)].map(([,path])=>`import '/src/${path}';`).join('\n');
const entry = `${css}
import React,{useState,useRef} from 'react';import{createRoot}from'react-dom/client';
import{PlanStudio}from'/src/PlanStudio.tsx';import{KittyBanks}from'/src/KittyBanks.tsx';import{AddCategoryForm}from'/src/AddCategoryForm.tsx';
import{planLifeFixture}from'/test/fixtures/plan-life.ts';import{resolveThemeScene,sceneTokens}from'/src/theme/scenes.ts';
import{acknowledgeHouseholdPlan,setHouseholdFundMonthPlan}from'/src/core/index.ts';import{openChapter}from'/src/core/chapters.ts';
import{migrateFundModel,proposeFundDivision,agreeFundDivision,proposeProtectRefill}from'/src/core/fundModelCommands.ts';import{undividedContributions,proposedDivision}from'/src/core/fundModel.ts';
const q=new URLSearchParams(location.search),page=q.get('page')||'studio',theme=q.get('theme')||'classic',state=q.get('state')||'sorted',lite=q.get('lite');
const today='2026-09-11';
// Without lite=, the device default decides (Lite under reduced motion).
try{if(lite===null)localStorage.removeItem('hearth.planV3.lite');else localStorage.setItem('hearth.planV3.lite',lite==='1'?'1':'0');localStorage.setItem('hearth.planV3.drawerHint','1');}catch{}
const scene=resolveThemeScene(theme,'plan','household');
Object.assign(document.documentElement.dataset,{theme,scene:scene.id,material:scene.material,sceneLighting:'light',atmosphere:'paused'});for(const[key,value]of Object.entries(sceneTokens(scene)))document.documentElement.style.setProperty(key,value);
document.body.style.background='var(--paper)';
const at=(d)=>'2026-09-'+d+'T12:00:00.000Z';
function seeded(){
 let h=planLifeFixture('household',{fundModel:2});
 h=openChapter(h,{memberId:'MEM-001',foundationId:'make-rent-boring',intendedMonth:'2026-08',at:'2026-08-03T12:00:00.000Z'}).household;
 h=setHouseholdFundMonthPlan(h,{memberId:'MEM-001',monthKey:'2026-09',target:'4000',buffer:'400'}).household;
 h=migrateFundModel(h,{memberId:'MEM-001',at:at('10')}).household;
 if(state==='sorted')return h;
 const landed=undividedContributions(h,{view:'household',today})[0];
 const split=proposedDivision(h,landed.eventId,{memberId:'MEM-002',today});
 h=proposeFundDivision(h,{memberId:'MEM-002',contributionEventId:landed.eventId,split,at:at('11')}).household;
 if(state==='proposed')return h;
 const row=h.fundModelRows.find(r=>r.kind==='division');
 h=agreeFundDivision(h,{memberId:'MEM-001',id:row.id,revision:row.revision,at:at('11')}).household;
 h=proposeProtectRefill(h,{memberId:'MEM-001',monthKey:'2026-09',toFund:'everyday',amountCents:5000,note:'Fictional: a slower week',at:at('11')}).household;
 if(state==='divided')return h;
 const v=h.planVersions.find(r=>r.scope==='household'&&r.state==='proposed');
 for(const m of['MEM-001','MEM-002'])h=acknowledgeHouseholdPlan(h,{planVersionId:v.id,expectedDigest:v.digest,memberId:m,createdBy:m}).household;
 return h;
}
function Proof(){const[household,setHousehold]=useState(seeded),[member,setMember]=useState(q.get('member')||'MEM-001');const ref=useRef(household),receipts=useRef(new Map());ref.current=household;
 const command=async(fn,options)=>{try{const result=fn(ref.current);ref.current=result.household;setHousehold(result.household);if(options?.confirmationId)receipts.current.set(options.confirmationId,'accepted');return{...result,kind:'synchronized',ok:true,postedExactlyOnce:true,postedNothing:false,confirmationId:options?.confirmationId};}catch(error){return{ok:false,userMessage:error instanceof Error?error.message:'Refused (fictional proof)'};}};
 const banner=React.createElement('p',{className:'proof-banner',style:{margin:0,padding:'4px 12px',background:'#fff',color:'#111',fontSize:12}},'Fictional local proof · Plan Studio v3 + money model · '+theme+' / '+page+' / '+state+' ',React.createElement('button',{style:{minHeight:32},onClick:()=>setMember(member==='MEM-001'?'MEM-002':'MEM-001')},'Switch fictional member ('+member+')'));
 if(page==='category')return React.createElement('div',{className:'app','data-ledger-tab':'books'},banner,React.createElement('main',{style:{padding:'12px 16px'}},React.createElement(AddCategoryForm,{household,onSave:next=>{ref.current=next;setHousehold(next);}})));
 const studio=React.createElement(PlanStudio,{key:member,household,view:'household',memberId:member,today,busy:false,onCommand:command,contextIdentity:'proof',
  goalsContent:context=>React.createElement(KittyBanks,{planContext:context,household,booksHousehold:household,view:'household',createdBy:member,onCommand:command,onReadSubmission:async id=>receipts.current.get(id)||null})});
 return React.createElement('div',{className:'app','data-ledger-tab':'plan',style:{paddingBottom:'calc(var(--nav) + 12px)'}},banner,studio,
  React.createElement('nav',{'aria-label':'Stand-in app navigation','data-proof-standin':'nav',style:{position:'fixed',left:0,right:0,bottom:0,height:'var(--nav)',background:'#fff',borderTop:'1px solid #d8d8d8',display:'flex',alignItems:'center',justifyContent:'space-around',zIndex:30,fontSize:12,color:'#555'}},['Home','Calendar','Add','Books','Plan'].map(label=>React.createElement('span',{key:label,'aria-current':label==='Plan'?'page':undefined},label))));
}
createRoot(document.getElementById('root')).render(React.createElement(Proof));`;
export async function startPlanV3IntegratedProof({port=5187}={}) {
if(port===0){const probe=createPortProbe();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));port=probe.address().port;await new Promise(resolve=>probe.close(resolve));}
process.env.VITE_PLAN_STUDIO_V3='1';process.env.VITE_FUND_MODEL_V2='1';
const cacheDir=mkdtempSync(join(tmpdir(),'hearth-plan-v3-int-'));
const server=await createServer({configFile:false,define:{'import.meta.env.VITE_HERCULES_CHAT':JSON.stringify('0'),'import.meta.env.VITE_PLAN_STUDIO_V3':JSON.stringify('1'),'import.meta.env.VITE_FUND_MODEL_V2':JSON.stringify('1')},cacheDir,server:{host:'127.0.0.1',port,strictPort:true},plugins:[{name:'plan-v3-int-proof',resolveId(id){if(id==='/plan-v3-int-proof.js')return'\0plan-v3-int-proof';},load(id){if(id==='\0plan-v3-int-proof')return entry;},configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(req.method==='POST'){res.statusCode=503;res.end(JSON.stringify({ok:false,error:'Fictional local proof; external providers disabled'}));return;}if(req.url?.split('?')[0]!=='/plan-v3-int-proof')return next();res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/plan-v3-int-proof','<!doctype html><html lang="en"><head><title>Fictional Plan Studio v3 integrated proof</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/plan-v3-int-proof.js"></script></body></html>'));});}}]});
await server.listen();
return {url:`http://127.0.0.1:${server.httpServer.address().port}/plan-v3-int-proof`,async close(){await server.close();rmSync(cacheDir,{recursive:true,force:true});}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const proof=await startPlanV3IntegratedProof();console.log(`Fictional Plan Studio v3 integrated proof: ${proof.url}`);process.once('SIGINT',async()=>{await proof.close();process.exit(0);});}
