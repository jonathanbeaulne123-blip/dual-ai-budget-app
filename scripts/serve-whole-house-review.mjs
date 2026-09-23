import {build} from 'esbuild';
import {createServer} from 'vite';
import {mkdir,realpath,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Loopback-only fictional review. This never loads an .env or deploys a Worker.
const root=process.cwd(),runtime=resolve(root,'.whole-house-review');
const reviewPort=Number(process.env.HEARTH_REVIEW_PORT??4186);
if(!Number.isInteger(reviewPort)||reviewPort<1024||reviewPort>65535)throw Error('Invalid review port');
const reviewUrl=`http://127.0.0.1:${reviewPort}/__review`;
await mkdir(runtime,{recursive:true});
await build({entryPoints:[resolve(root,'test/fixtures/hearthsideActualAppAuthority.ts')],bundle:true,packages:'external',platform:'node',format:'esm',target:'node22',outfile:resolve(runtime,'authority.mjs')});
const {startHearthsideActualAppAuthority}=await import(pathToFileURL(resolve(runtime,'authority.mjs')).href);
const householdId='HH-WHOLE-HOUSE-FICTIONAL-REVIEW';
const authority=await startHearthsideActualAppAuthority(householdId,resolve(runtime,'authority-state'));
const flags={HEARTH_HOUSE_WORLD:1,HEARTH_HARBOUR:1,HEARTHSIDE:1,HEARTHSIDE_DESIGN:1,HEARTHSIDE_VAULT:1,HEARTHSIDE_WORKSPACE:0,HEARTHSIDE_GUESTS:0,HEARTHSIDE_AR:0,HEARTHSIDE_EXPORTS:0,LEDGER_SYNC_V2:1,LEDGER_SYNC_LOCAL_AUTH:1,PRODUCTION_CONTINUITY:0,HERCULES_PLAY:1,HERCULES_DRESSING_ROOM:1,HERCULES_WORKSPACE:0};
const banner='<aside id="whole-house-review-label" style="position:relative;z-index:100000;background:#283f36;color:#fff6d7;padding:7px 14px;font:12px system-ui;text-align:center">Fictional local house · real app commands · no hosted services <a style="color:inherit;margin-left:15px" href="/__review?member=MEM-001">Alex</a> <a style="color:inherit;margin-left:10px" href="/__review?member=MEM-002">Sam</a> <a style="color:inherit;margin-left:15px" href="/__review?seed=demo">Demo habitat</a></aside>';
const server=await createServer({configFile:false,envFile:false,root,cacheDir:resolve(runtime,'vite-cache'),logLevel:'warn',esbuild:{jsx:'automatic'},optimizeDeps:{exclude:['@electric-sql/pglite']},worker:{format:'es'},
  define:Object.fromEntries(Object.entries(flags).map(([key,value])=>[`import.meta.env.VITE_${key}`,JSON.stringify(String(value))])),
  server:{host:'127.0.0.1',port:reviewPort,strictPort:true,fs:{allow:[root,await realpath(resolve(root,'node_modules'))]},proxy:{'/ledger-sync':{target:authority.base,ws:true},'/api/hearthside-vault':{target:authority.base}}},
  plugins:[{name:'fictional-whole-house-review',transformIndexHtml(html){return html.replace('<body>','<body>'+banner);},configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/__review')return next();res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hearth · fictional whole house review</title></head><body>${banner}<div id="root"><p>Opening the fictional local house…</p></div><script type="module" src="/test/browser/whole-house-review.tsx"></script></body></html>`);});}}]
});
await server.listen();
await writeFile(resolve(runtime,'server.json'),JSON.stringify({url:reviewUrl,householdId,localAuthority:authority.base,startedAt:new Date().toISOString(),hosted:false},null,2));
console.log(`Hearth actual-app review: ${reviewUrl}`);
console.log('Fictional loopback LedgerRoom, creative journals and Vault. No hosted activation.');
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await server.close();await authority.dispose();process.exit(0);});
