/** A fictional shelf of the Queen's household (2026-09-16): every umbrella bank and both pay banks, stood by the cellar's own room
    world at the kiln's states — bisque (nothing in), half glazed, fully glazed, and frosted glass. Seats are ordinary DOM boxes with
    `data-room-vessel`, exactly as the cellar rail marks its jars, so this is the room code the cellar runs, only larger.
    `?state=half|bisque|full|glass` picks one state for every seat; `state=mixed` (default) shows a row of each. */
import { createServer } from 'vite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer as createPortProbe } from 'node:net';
import { pathToFileURL } from 'node:url';

const entry = `import React from 'react';import{createRoot}from'react-dom/client';import'/src/styles.css';import'/src/queen/queen-home.css';
import{QueenRoomWorld}from'/src/queen/QueenRoomWorld.tsx';import{UMBRELLA_BANK_MODELS,PAY_BANK_MODELS}from'/src/queen/world/bankModels.ts';
const q=new URLSearchParams(location.search),state=q.get('state')||'mixed';
const keys=[...Object.keys(UMBRELLA_BANK_MODELS).map(id=>['umbrella:'+id,UMBRELLA_BANK_MODELS[id].name]),...Object.keys(PAY_BANK_MODELS).map(id=>['pay:'+id,PAY_BANK_MODELS[id].name])];
const states=state==='mixed'?['bisque','half','full','glass']:[state];
const look={bisque:{fill:0},half:{fill:0.5},full:{fill:1},glass:{fill:0,glass:true}};
const vessels=states.flatMap(s=>keys.map(([key])=>({id:s+':'+key,kind:'bill',fill:look[s].fill,model:{key,glass:Boolean(look[s].glass)}})));
function Shelf(){const root=React.useRef(null);return React.createElement('section',{ref:root,className:'bank-shelf',style:{position:'relative',minHeight:'100vh',padding:'12px',background:'#2c2824'}},
 React.createElement(QueenRoomWorld,{room:'cellar',root,vessels,mode:'3d'}),
 ...states.map(s=>React.createElement('div',{key:s,style:{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px',marginBottom:'8px'}},
  React.createElement('p',{style:{gridColumn:'1/-1',margin:0,color:'#f3ead8',font:'12px var(--mono)'}},s),
  ...keys.map(([key,name])=>React.createElement('div',{key,style:{display:'flex',flexDirection:'column',alignItems:'center'}},
    React.createElement('span',{'data-room-vessel':s+':'+key,style:{display:'block',width:'90px',height:'130px'}}),
    React.createElement('span',{style:{color:'#f3ead8',font:'11px var(--mono)'}},name))))));}
createRoot(document.getElementById('root')).render(React.createElement(Shelf));`;

export async function startBankModelsProof({ port = 5190 } = {}) {
  if (port === 0) { const probe = createPortProbe(); await new Promise((r) => probe.listen(0, '127.0.0.1', r)); port = probe.address().port; await new Promise((r) => probe.close(r)); }
  const cacheDir = mkdtempSync(join(tmpdir(), 'hearth-banks-'));
  const server = await createServer({ configFile: false, cacheDir, server: { host: '127.0.0.1', port, strictPort: true }, plugins: [{ name: 'banks-proof', resolveId(id) { if (id === '/banks-proof.js') return '\0banks-proof'; }, load(id) { if (id === '\0banks-proof') return entry; }, configureServer(vite) { vite.middlewares.use(async (req, res, next) => { if (req.url?.split('?')[0] !== '/banks-proof') return next(); res.setHeader('Content-Type', 'text/html'); res.end(await vite.transformIndexHtml('/banks-proof', '<!doctype html><html lang="en"><head><title>Fictional bank models proof</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/banks-proof.js"></script></body></html>')); }); } }] });
  await server.listen();
  return { url: `http://127.0.0.1:${server.httpServer.address().port}/banks-proof`, async close() { await server.close(); rmSync(cacheDir, { recursive: true, force: true }); } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const proof = await startBankModelsProof(); console.log(`Fictional bank models proof: ${proof.url}`); }
