/** Plan Studio v3 (D-273…D-277) on the actual production components, with exclusively fictional local books.
    `?state=waiting|agreed|set|resume|short|landed|first|badge` · `view=household|personal` · `theme=classic|taylor|newfoundland`
    · `lite=1` · `member=MEM-002` · `tent=1` (inside Our Path's tent) · `dark=1`.
    `landed` is proof-only: it wraps the adapter to add one fictional undivided contribution, because no split command exists yet.
    The bottom bar is a STAND-IN for the App's navigation, so the drawer sits where it will in the App. */
import { createServer } from 'vite';
import { createServer as createPortProbe } from 'node:net';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const css = [...readFileSync('src/main.tsx','utf8').matchAll(/import "\.\/(.*\.css)";/g)].map(([,path])=>`import '/src/${path}';`).join('\n');
const entry = `${css}
import React,{useState,useRef} from 'react';import{createRoot}from'react-dom/client';
import{PlanStudio}from'/src/PlanStudio.tsx';import{KittyBanks}from'/src/KittyBanks.tsx';import{PathTentContext}from'/src/path/tentContext.ts';
import{planLifeFixture}from'/test/fixtures/plan-life.ts';import{resolveThemeScene,sceneTokens}from'/src/theme/scenes.ts';
import{acknowledgeHouseholdPlan,appendPlanSitdownTurn,addRecurrence,catalogHousehold,configureHouseholdFund,proposeHouseholdFundContribution,confirmHouseholdFundContribution}from'/src/core/index.ts';
import{openChapter}from'/src/core/chapters.ts';import{fundContributionReviewDigest}from'/src/core/fundContributionSources.ts';
import{planStudioFundSnapshot}from'/src/plan-v3/model.ts';
const q=new URLSearchParams(location.search),view=q.get('view')||'household',theme=q.get('theme')||'classic',state=q.get('state')||'waiting',lite=q.get('lite'),tent=q.get('tent')==='1',dark=q.get('dark')==='1';
const today='2026-09-11';
try{localStorage.setItem('hearth.planV3.lite',lite==='1'?'1':'0');if(q.get('hint')!=='1')localStorage.setItem('hearth.planV3.drawerHint','1');else localStorage.removeItem('hearth.planV3.drawerHint');}catch{}
const scene=resolveThemeScene(theme,'plan',view);const palette=dark?{...scene,dark:true,palette:{...scene.palette,paper:'#1d1a16',card:'#27231e',ink:'#f1e9dc',muted:'#bfb3a2',line:'#4a4239'}}:scene;
Object.assign(document.documentElement.dataset,{theme,scene:scene.id,material:scene.material,sceneLighting:dark?'dark':'light',atmosphere:'paused'});for(const[key,value]of Object.entries(sceneTokens(palette)))document.documentElement.style.setProperty(key,value);
document.body.style.background='var(--paper)';
function ack(h,member){const v=h.planVersions.find(r=>r.scope==='household'&&r.state==='proposed');return acknowledgeHouseholdPlan(h,{planVersionId:v.id,expectedDigest:v.digest,memberId:member,createdBy:member}).household;}
function seeded(){
 if(state==='first'){let h=catalogHousehold();h.members=h.members.map((row,i)=>({...row,name:i===0?'Alex (fictional)':'Sam (fictional)'}));
  if(view==='household'){h=configureHouseholdFund(h,{custodianMemberId:'MEM-001',openedOn:'2026-09-01',createdBy:'MEM-001'}).household;const o=proposeHouseholdFundContribution(h,{memberId:'MEM-002',contributorMemberId:'MEM-002',date:'2026-09-03',amount:'1400',source:{version:1,kind:'external-received',explanation:'Fictional'}});h=confirmHouseholdFundContribution(o.household,{memberId:'MEM-001',proposalEventId:o.postedIds[0],received:true,expectedProposalDigest:fundContributionReviewDigest(o.household,o.postedIds[0])}).household;
   h=addRecurrence(h,{cadence:'monthly',nextDate:'2026-09-18',type:'expense',amount:'900',accountId:'ACC-VISA',subcategoryId:'SUB-HOUSING-ELECTRIC',note:'Fictional rent',fundingDefault:{fundId:h.householdFund.id,fundedCents:'full',destinationAccountId:'ACC-VISA'}}).household;}
  return h;}
 let h=planLifeFixture(view);
 if(view!=='household')return h;
 h=openChapter(h,{memberId:'MEM-001',foundationId:'make-rent-boring',at:'2026-09-01T12:00:00.000Z'}).household;
 if(state==='agreed'||state==='set'){h=ack(h,'MEM-001');h=ack(h,'MEM-002');}
 if(state==='set'){const v=h.planVersions.find(r=>r.scope==='household'&&r.state==='active');h=appendPlanSitdownTurn(h,{sitDownSessionId:'SITDOWN-FICTION',monthKey:'2026-09',planDraftId:'LIFE-DRAFT',memberId:'MEM-001',text:'Fictional: carrying September forward.',checkpoint:{stage:7,close:true,planVersionId:v.id}}).household;}
 if(state==='resume')h=appendPlanSitdownTurn(h,{sitDownSessionId:'SITDOWN-FICTION',monthKey:'2026-09',planDraftId:'LIFE-DRAFT',memberId:'MEM-002',text:'Paused at Prepare.',checkpoint:{stage:3}}).household;
 if(state==='short')h=addRecurrence(h,{cadence:'monthly',nextDate:'2026-09-22',type:'expense',amount:'3400',accountId:'ACC-VISA',subcategoryId:'SUB-HOUSING-ELECTRIC',note:'Fictional car repair',fundingDefault:{fundId:h.householdFund.id,fundedCents:'full',destinationAccountId:'ACC-VISA'}}).household;
 if(state==='badge')h={...h,planBridgeDecisions:[{id:'BRIDGE-FICTION',monthKey:'2026-09',kind:'contribution',label:'Fictional extra contribution',amountCents:20000,offeredByMemberId:'MEM-002',state:'proposed',createdAt:'2026-09-10T00:00:00.000Z',updatedAt:'2026-09-10T00:00:00.000Z'}]};
 return h;
}
// Proof only: one fictional contribution that has landed but is not divided yet.
const landedSource=(h,o)=>{const s=planStudioFundSnapshot(h,o);return{...s,undividedContributions:[{id:'FICTION-LANDED',memberId:'MEM-002',memberName:'Sam (fictional)',amountCents:140000,date:today,suggestion:{prepare:80000,protect:0,build:12500,everyday:47500},waitingOn:['Sam (fictional)']}]};};
function Proof(){const[household,setHousehold]=useState(seeded),[member,setMember]=useState(q.get('member')||'MEM-001'),[leftTent,setLeftTent]=useState(false);const ref=useRef(household),receipts=useRef(new Map());ref.current=household;
 const command=async(fn,options)=>{try{const result=fn(ref.current);ref.current=result.household;setHousehold(result.household);if(options?.confirmationId)receipts.current.set(options.confirmationId,'accepted');return{...result,kind:'synchronized',ok:true,postedExactlyOnce:true,postedNothing:false,confirmationId:options?.confirmationId};}catch(error){return{ok:false,userMessage:error instanceof Error?error.message:'Refused (fictional proof)'};}};
 const studio=React.createElement(PlanStudio,{key:member,household,view,memberId:member,today,busy:false,onCommand:command,contextIdentity:'proof',snapshotSource:state==='landed'?landedSource:undefined,
  goalsContent:context=>React.createElement(KittyBanks,{planContext:context,household,booksHousehold:household,view,createdBy:member,onCommand:command,onReadSubmission:async id=>receipts.current.get(id)||null})});
 return React.createElement('div',{className:'app','data-ledger-tab':'plan',style:{paddingBottom:'calc(var(--nav) + 12px)'}},
  React.createElement('p',{className:'proof-banner',style:{margin:0,padding:'4px 12px',background:'#fff',color:'#111',fontSize:12}},'Fictional local proof · Plan Studio v3 · '+theme+' / '+view+' / '+state+' ',React.createElement('button',{style:{minHeight:32},onClick:()=>setMember(member==='MEM-001'?'MEM-002':'MEM-001')},'Switch fictional member ('+member+')'),leftTent?React.createElement('b',{role:'status'},' Back on the island (proof)'):null),
  tent?React.createElement(PathTentContext.Provider,{value:{leaveTent:()=>setLeftTent(true)}},studio):studio,
  React.createElement('nav',{'aria-label':'Stand-in app navigation','data-proof-standin':'nav',style:{position:'fixed',left:0,right:0,bottom:0,height:'var(--nav)',background:'#fff',borderTop:'1px solid #d8d8d8',display:'flex',alignItems:'center',justifyContent:'space-around',zIndex:30,fontSize:12,color:'#555'}},['Home','Calendar','Add','Books','Plan'].map(label=>React.createElement('span',{key:label,'aria-current':label==='Plan'?'page':undefined},label))));
}
createRoot(document.getElementById('root')).render(React.createElement(Proof));`;
export async function startPlanV3Proof({port=5186}={}) {
if(port===0){const probe=createPortProbe();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));port=probe.address().port;await new Promise(resolve=>probe.close(resolve));}
const cacheDir=mkdtempSync(join(tmpdir(),'hearth-plan-v3-'));
const server=await createServer({configFile:false,define:{'import.meta.env.VITE_HERCULES_CHAT':JSON.stringify('0'),'import.meta.env.VITE_PLAN_STUDIO_V3':JSON.stringify('1')},cacheDir,server:{host:'127.0.0.1',port,strictPort:true},plugins:[{name:'plan-v3-proof',resolveId(id){if(id==='/plan-v3-proof.js')return'\0plan-v3-proof';},load(id){if(id==='\0plan-v3-proof')return entry;},configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(req.method==='POST'){res.statusCode=503;res.end(JSON.stringify({ok:false,error:'Fictional local proof; external providers disabled'}));return;}if(req.url?.split('?')[0]!=='/plan-v3-proof')return next();res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/plan-v3-proof','<!doctype html><html lang="en"><head><title>Fictional Plan Studio v3 proof</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/plan-v3-proof.js"></script></body></html>'));});}}]});
await server.listen();
return {url:`http://127.0.0.1:${server.httpServer.address().port}/plan-v3-proof`,async close(){await server.close();rmSync(cacheDir,{recursive:true,force:true});}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const proof=await startPlanV3Proof();console.log(`Fictional Plan Studio v3 proof: ${proof.url}`);process.once('SIGINT',async()=>{await proof.close();process.exit(0);});}
