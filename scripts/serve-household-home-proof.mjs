/** Actual Household Home / Our Path / Status Centre surfaces with exclusively fictional local books (Vision v2 Horizon A evidence). */
import { createServer } from 'vite';
import { createServer as createPortProbe } from 'node:net';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const css = [...readFileSync('src/main.tsx','utf8').matchAll(/import "\.\/(.*\.css)";/g)].map(([,path])=>`import '/src/${path}';`).join('\n');
const entry = `${css}
import React,{useState,useRef} from 'react';import{createRoot}from'react-dom/client';
import{HouseholdHome}from'/src/HouseholdHome.tsx';import{ChapterRoom}from'/src/ChapterPanel.tsx';import{ComfortControls}from'/src/theme/ComfortControls.tsx';
import{planLifeFixture}from'/test/fixtures/plan-life.ts';import{resolveThemeScene,sceneTokens}from'/src/theme/scenes.ts';
import{openChapter,recordRitualHeld,offerMove}from'/src/core/chapters.ts';
const q=new URLSearchParams(location.search),theme=q.get('theme')||'classic',surface=q.get('surface')||'home',quiet=q.get('quiet')==='1';
const scene=resolveThemeScene(theme,surface==='home'?'home':surface==='path'?'plan':'more','household');Object.assign(document.documentElement.dataset,{theme,scene:scene.id,material:scene.material,sceneLighting:scene.dark?'dark':'light',atmosphere:'paused',quiet:quiet?'true':'false'});for(const[key,value]of Object.entries(sceneTokens(scene)))document.documentElement.style.setProperty(key,value);
function seeded(){let h=planLifeFixture('household');h=openChapter(h,{memberId:'MEM-001',foundationId:'make-rent-boring',at:'2026-09-01T12:00:00.000Z'}).household;const ritual=h.rituals[0];h=recordRitualHeld(h,{memberId:'MEM-001',ritualId:ritual.id,onDate:'2026-09-04'}).household;h=offerMove(h,{memberId:'MEM-002',chapterId:h.chapters[0].id,text:'Confirm which payday the pre-rent check belongs to',needsAcknowledgment:true}).household;return h;}
function Proof(){const[state,setState]=useState(seeded);const ref=useRef(state);ref.current=state;const command=async fn=>{const result=fn(ref.current);ref.current=result.household;setState(result.household);return {...result,ok:true};};
if(surface==='path')return React.createElement('div',{className:'app our-path our-path--household','data-ledger-tab':'plan'},React.createElement(ChapterRoom,{household:state,memberId:'MEM-001',today:'2026-09-12',onCommand:command,busy:false}));
if(surface==='comfort')return React.createElement('div',{className:'app more-surfaces status-centre','data-ledger-tab':'more'},React.createElement(ComfortControls,{environment:'development'}));
return React.createElement('div',{className:'app','data-ledger-tab':'home'},React.createElement(HouseholdHome,{household:state,memberId:'MEM-001',today:'2026-09-12',freshness:'current',busy:false,onCommand:command,onGo:()=>{}}));}
createRoot(document.getElementById('root')).render(React.createElement(Proof));`;
export async function startHouseholdHomeProof({port=5186}={}) {
if(port===0){const probe=createPortProbe();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));port=probe.address().port;await new Promise(resolve=>probe.close(resolve));}
const cacheDir=mkdtempSync(join(tmpdir(),'hearth-home-'));
const server=await createServer({configFile:false,cacheDir,server:{host:'127.0.0.1',port,strictPort:true},plugins:[{name:'home-proof',resolveId(id){if(id==='/home-proof.js')return'\0home-proof';},load(id){if(id==='\0home-proof')return entry;},configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(req.method==='POST'){res.statusCode=503;res.end(JSON.stringify({ok:false}));return;}if(req.url?.split('?')[0]!=='/home-proof')return next();res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml('/home-proof','<!doctype html><html lang="en"><head><title>Fictional Hearth Home proof</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/home-proof.js"></script></body></html>'));});}}]});await server.listen();
return {url:`http://127.0.0.1:${server.httpServer.address().port}/home-proof`,async close(){await server.close();rmSync(cacheDir,{recursive:true,force:true});}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const proof=await startHouseholdHomeProof();console.log(`Fictional Home proof: ${proof.url}`);process.once('SIGINT',async()=>{await proof.close();process.exit(0);});}
