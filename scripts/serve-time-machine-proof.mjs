/** Actual time machine surface with exclusively fictional local books (D-246 evidence). */
import { createServer } from 'vite';
import { createServer as createPortProbe } from 'node:net';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const css = [...readFileSync('src/main.tsx','utf8').matchAll(/import "\.\/(.*\.css)";/g)].map(([,path])=>`import '/src/${path}';`).join('\n');
const entry = `${css}
import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{TimeMachine}from'/src/timeMachine/TimeMachine.tsx';
import{HOUSEHOLD_FUND_ID,addGoal,catalogHousehold,addRecurrence,configureHouseholdFund,confirmHouseholdFundContribution,contributeToGoal,postEntry,proposeHouseholdFundContribution}from'/src/core/index.ts';
import{fundContributionReviewDigest}from'/src/core/fundContributionSources.ts';
import{resolveThemeScene,sceneTokens}from'/src/theme/scenes.ts';
const q=new URLSearchParams(location.search),theme=q.get('theme')||'classic',view=q.get('view')||'household',quiet=q.get('quiet')==='1';
const scene=resolveThemeScene(theme,'ledger',view);Object.assign(document.documentElement.dataset,{theme,scene:scene.id,material:scene.material,sceneLighting:scene.dark?'dark':'light',atmosphere:'paused',quiet:quiet?'true':'false',worldPage:'ledger'});for(const[key,value]of Object.entries(sceneTokens(scene)))document.documentElement.style.setProperty(key,value);
const TODAY='2026-09-12',B='MEM-001',J='MEM-002';
function contribute(h,date,amount){const proposal=proposeHouseholdFundContribution(h,{source:{version:1,kind:'external-received',explanation:'Fictional evidence contribution from untracked savings.'},memberId:J,contributorMemberId:J,amount,date});h=proposal.household;return confirmHouseholdFundContribution(h,{received:true,expectedProposalDigest:fundContributionReviewDigest(h,proposal.postedIds[0]),memberId:B,proposalEventId:proposal.postedIds[0]}).household;}
function seeded(){let h=catalogHousehold();
h=configureHouseholdFund(h,{custodianMemberId:B,openedOn:'2026-04-01',createdBy:B}).household;
for(const[date,amount]of[['2026-04-03','1400'],['2026-05-03','1400'],['2026-06-03','1500'],['2026-07-03','1500'],['2026-08-03','1600'],['2026-09-03','1600']])h=contribute(h,date,amount);
const spend=[['2026-04-08','320','SUB-FOOD-GROCERIES'],['2026-04-19','140','SUB-HOUSING-ELECTRIC'],['2026-05-09','410','SUB-FOOD-GROCERIES'],['2026-05-21','96','SUB-TRANSPORT-FUEL'],['2026-06-07','388','SUB-FOOD-GROCERIES'],['2026-06-18','260','SUB-LIFE-FUN'],['2026-07-06','402','SUB-FOOD-GROCERIES'],['2026-07-22','610','SUB-LIFE-FUN'],['2026-08-05','444','SUB-FOOD-GROCERIES'],['2026-08-14','188','SUB-HOUSING-ELECTRIC'],['2026-08-27','96','SUB-TRANSPORT-FUEL'],['2026-09-04','216','SUB-FOOD-GROCERIES'],['2026-09-09','74','SUB-LIFE-PHONE']];
for(const[date,amount,subcategoryId]of spend)h=postEntry(h,{date,type:'expense',amount,accountId:'ACC-VISA',subcategoryId,createdBy:B,visibility:'household',confirmDuplicate:true}).household;
for(const[date,amount]of[['2026-04-15','2400'],['2026-05-15','2400'],['2026-06-15','2500'],['2026-07-15','2400'],['2026-08-15','2600'],['2026-09-10','2400']])h=postEntry(h,{date,type:'income',amount,accountId:'ACC-CHEQUING',subcategoryId:'SUB-INCOME-WAGES',createdBy:J,note:'Pay',confirmDuplicate:true}).household;
h=addRecurrence(h,{cadence:'monthly',nextDate:'2026-09-18',type:'expense',amount:'140',accountId:'ACC-CHEQUING',subcategoryId:'SUB-HOUSING-ELECTRIC',note:'Hydro',kind:'bill',fundingDefault:{fundId:HOUSEHOLD_FUND_ID,fundedCents:'full',destinationAccountId:'ACC-VISA'}}).household;
h=addGoal(h,{name:'Japan',target:'5000',shared:true}).household;
h=addGoal(h,{name:'Tires',target:'600',shared:true}).household;
const japan=h.goals.find(g=>g.name==='Japan').id,tires=h.goals.find(g=>g.name==='Tires').id;
for(const[date,amount]of[['2026-04-20','200'],['2026-05-20','200'],['2026-06-20','250'],['2026-07-20','250'],['2026-08-20','300'],['2026-09-06','300']])h=contributeToGoal(h,japan,amount,{createdBy:J,date}).household;
for(const[date,amount]of[['2026-05-25','200'],['2026-06-25','200'],['2026-07-25','200']])h=contributeToGoal(h,tires,amount,{createdBy:B,date}).household;
return h;}
function Proof(){const[household]=useState(seeded);
return React.createElement('div',{className:'app','data-ledger-tab':'ledger'},React.createElement(TimeMachine,{household,memberId:view==='personal'?J:B,view,today:TODAY,onOpenBooks:()=>{}}));}
createRoot(document.getElementById('root')).render(React.createElement(Proof));`;
export async function startTimeMachineProof({port=5189}={}) {
if(port===0){const probe=createPortProbe();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));port=probe.address().port;await new Promise(resolve=>probe.close(resolve));}
const cacheDir=mkdtempSync(join(tmpdir(),'hearth-time-machine-'));
const server=await createServer({configFile:false,cacheDir,server:{host:'127.0.0.1',port,strictPort:true},plugins:[{name:'time-machine-proof',resolveId(id){if(id==='/time-machine-proof.js')return'\0time-machine-proof';},load(id){if(id==='\0time-machine-proof')return entry;},configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(req.method==='POST'){res.statusCode=503;res.end(JSON.stringify({ok:false}));return;}if(req.url?.split('?')[0]!=='/time-machine-proof')return next();res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/time-machine-proof','<!doctype html><html lang="en"><head><title>Fictional Hearth time machine proof</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/time-machine-proof.js"></script></body></html>'));});}}]});await server.listen();
return {url:`http://127.0.0.1:${server.httpServer.address().port}/time-machine-proof`,async close(){await server.close();rmSync(cacheDir,{recursive:true,force:true});}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const proof=await startTimeMachineProof();console.log(`Fictional time machine proof: ${proof.url}`);process.once('SIGINT',async()=>{await proof.close();process.exit(0);});}
