/** Actual Planner surface with exclusively fictional local books (D-245 evidence). */
import { createServer } from 'vite';
import { createServer as createPortProbe } from 'node:net';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const css = [...readFileSync('src/main.tsx','utf8').matchAll(/import "\.\/(.*\.css)";/g)].map(([,path])=>`import '/src/${path}';`).join('\n');
const entry = `${css}
import React,{useState,useRef} from 'react';import{createRoot}from'react-dom/client';
import{Planner}from'/src/planner/Planner.tsx';
import{catalogHousehold,postEntry,addRecurrence,saveBoardTask}from'/src/core/index.ts';
import{saveTask,saveTaskList,completeTask}from'/src/core/tasks.ts';
import{resolveThemeScene,sceneTokens}from'/src/theme/scenes.ts';
const q=new URLSearchParams(location.search),theme=q.get('theme')||'classic',view=q.get('view')||'household',quiet=q.get('quiet')==='1',tab=q.get('tab')||'';
const scene=resolveThemeScene(theme,'more',view);Object.assign(document.documentElement.dataset,{theme,scene:scene.id,material:scene.material,sceneLighting:scene.dark?'dark':'light',atmosphere:'paused',quiet:quiet?'true':'false',worldPage:'more'});for(const[key,value]of Object.entries(sceneTokens(scene)))document.documentElement.style.setProperty(key,value);
const TODAY='2026-09-14',B='MEM-001',J='MEM-002';
const task=(id,patch)=>({memberId:B,id:'TASK-'+id,expectedRevision:0,task:{visibility:'household',title:'',notes:'',listId:null,parentId:null,doDate:TODAY,dueDate:null,repeat:'none',cue:'none',assigneeId:null,backupId:null,chapterId:null,planReference:null,moneyLink:null,expectedAmountCents:null,deleted:false,...patch}});
function seeded(){let h=catalogHousehold();
h=postEntry(h,{date:'2026-09-10',type:'income',amount:1060,accountId:'ACC-CHEQUING',subcategoryId:'SUB-INCOME-WAGES',createdBy:B,note:'Pay',confirmDuplicate:true}).household;
h=addRecurrence(h,{cadence:'monthly',nextDate:'2026-09-18',type:'expense',amount:'140',accountId:'ACC-CHEQUING',subcategoryId:'SUB-HOUSING-ELECTRIC',note:'Hydro',kind:'bill'}).household;
h=addRecurrence(h,{cadence:'biweekly',nextDate:'2026-09-18',type:'income',amount:'900',accountId:'ACC-CHEQUING',subcategoryId:'SUB-INCOME-WAGES',note:'Paycheque',kind:'paycheck'}).household;
h=saveTaskList(h,{memberId:B,id:'LIST-wedding',expectedRevision:0,list:{name:'Wedding',visibility:'household',deleted:false}}).household;
h=saveTask(h,task('vet',{title:'Call the vet about Hercules',assigneeId:B,backupId:J})).household;
h=saveTask(h,task('hotel',{title:'Book the wedding hotel',expectedAmountCents:60000,doDate:'2026-09-16',dueDate:'2026-09-19',listId:'LIST-wedding',assigneeId:J})).household;
h=saveTask(h,task('tires',{title:'Tires',expectedAmountCents:78000,doDate:'2026-09-17',assigneeId:J,backupId:B})).household;
h=saveTask(h,task('bins',{title:'Bins out',doDate:'2026-09-15',repeat:'weekly'})).household;
h=saveTask(h,task('bread',{title:'Learn to make sourdough',doDate:null})).household;
h=saveTask(h,task('gift',{title:'Pick up the anniversary gift',doDate:'2026-09-12'})).household;
h=saveTask(h,task('milk',{title:'Milk and eggs',doDate:'2026-09-13'})).household;
h=completeTask(h,{memberId:B,id:'TASK-milk',expectedRevision:1,completedAt:'2026-09-13T21:00:00.000Z'}).household;
h=saveTask(h,{...task('secret',{title:'Surprise for Bianca',visibility:'personal'}),memberId:J}).household;
h=saveBoardTask(h,{memberId:B,id:'BOARD-TASK-old',title:'Feed Hercules (old board)',assigneeId:null,dueDate:null,completed:false,expectedVersion:0}).household;
return h;}
function Proof(){const[state,setState]=useState(seeded);const ref=useRef(state);ref.current=state;const command=async fn=>{const result=fn(ref.current);ref.current=result.household;setState(result.household);return {...result,ok:true,kind:'accepted-local'};};
return React.createElement('div',{className:'app','data-ledger-tab':'more'},React.createElement(Planner,{household:state,memberId:view==='personal'?J:B,view,today:TODAY,busy:false,onCommand:command,onRecord:()=>{},key:tab}));}
createRoot(document.getElementById('root')).render(React.createElement(Proof));`;
export async function startPlannerProof({port=5187}={}) {
if(port===0){const probe=createPortProbe();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));port=probe.address().port;await new Promise(resolve=>probe.close(resolve));}
const cacheDir=mkdtempSync(join(tmpdir(),'hearth-planner-'));
const server=await createServer({configFile:false,cacheDir,server:{host:'127.0.0.1',port,strictPort:true},plugins:[{name:'planner-proof',resolveId(id){if(id==='/planner-proof.js')return'\0planner-proof';},load(id){if(id==='\0planner-proof')return entry;},configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(req.method==='POST'){res.statusCode=503;res.end(JSON.stringify({ok:false}));return;}if(req.url?.split('?')[0]!=='/planner-proof')return next();res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/planner-proof','<!doctype html><html lang="en"><head><title>Fictional Hearth Planner proof</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/planner-proof.js"></script></body></html>'));});}}]});await server.listen();
return {url:`http://127.0.0.1:${server.httpServer.address().port}/planner-proof`,async close(){await server.close();rmSync(cacheDir,{recursive:true,force:true});}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const proof=await startPlannerProof();console.log(`Fictional Planner proof: ${proof.url}`);process.once('SIGINT',async()=>{await proof.close();process.exit(0);});}
