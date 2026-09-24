#!/usr/bin/env node
/**
 * Skate Lab CLI — films named skate scenarios frame-by-frame (deterministic,
 * not wall-clock) with the real park, rider, camera and HUD, and writes a
 * filmstrip PNG + a JSON trace per scenario. Dev only: starts its own
 * loopback Vite dev server; nothing here is part of a build.
 *
 *   node scripts/skate-lab.mjs all --out /tmp/lab                 # every scenario
 *   node scripts/skate-lab.mjs kickflip vert-air --out /tmp/lab    # some
 *   node scripts/skate-lab.mjs stills --out /tmp/lab               # theme × tier park overviews
 *   node scripts/skate-lab.mjs list                                # names
 * Options: --size 480x300  --cols 4  --samples 12  --theme classic|taylor|newfoundland
 *          --tier full|lite  --avatar jonathan|bianca|default  --stance regular|goofy  --hud
 *          --port 4197  --chromium /path/to/chrome (or SKATE_LAB_CHROMIUM)
 */
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';

const argv=process.argv.slice(2),names=[],opt={};
for(let i=0;i<argv.length;i++){const a=argv[i];if(a.startsWith('--')){const k=a.slice(2);const v=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true;opt[k]=v;}else names.push(a);}
if(!names.length)names.push('list');
const root=process.cwd(),out=resolve(String(opt.out??'lab-out')),port=Number(opt.port??4197);
const [W,H]=String(opt.size??'480x300').split('x').map(Number);
const cols=Number(opt.cols??4);
const over={};for(const k of ['theme','tier','avatar','stance'])if(typeof opt[k]==='string')over[k]=opt[k];if(opt.hud)over.hud=true;over.width=W;over.height=H;

const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Skate Lab</title><style>body{margin:0;background:#111}</style></head><body><div id="skate-lab"></div><script type="module" src="/test/browser/skateLab.ts"></script></body></html>`;
const server=await createServer({configFile:false,envFile:false,root,cacheDir:resolve(root,'.whole-house-review/skate-lab-vite'),logLevel:'warn',esbuild:{jsx:'automatic'},
  server:{host:'127.0.0.1',port,strictPort:true},
  plugins:[{name:'skate-lab',configureServer(vite){vite.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/__skate-lab')return next();res.setHeader('Content-Type','text/html');res.end(html);});}}]});
await server.listen();
const fallback='/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const executablePath=opt.chromium??process.env.SKATE_LAB_CHROMIUM??(existsSync(fallback)?fallback:undefined);
const browser=await chromium.launch({...(executablePath?{executablePath}:{}),args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:Math.max(W,640),height:Math.max(H,480)}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto(`http://127.0.0.1:${port}/__skate-lab?w=${W}&h=${H}`,{waitUntil:'load'});
  await page.waitForFunction(()=>document.body.dataset.skateLab==='ready',null,{timeout:180000});
  const all=await page.evaluate(()=>window.skateLab.scenarios());
  if(names[0]==='list'){for(const s of all)console.log(`${s.name.padEnd(18)} ${s.title}`);}
  else{
    mkdirSync(out,{recursive:true});
    const save=(file,dataUrl)=>writeFileSync(join(out,file),Buffer.from(dataUrl.split(',')[1],'base64'));
    const shot=async hud=>hud?'data:image/png;base64,'+(await page.locator('#skate-lab').screenshot()).toString('base64'):page.evaluate(()=>window.skateLab.snap());
    const wanted=names.includes('all')?all.map(s=>s.name):names.filter(n=>n!=='stills');
    for(const name of wanted){
      const t0=Date.now();
      const meta=await page.evaluate(([n,o])=>window.skateLab.begin(n,o),[name,over]);
      const images=[],labels=[];
      for(const f of meta.samples){
        await page.evaluate(fr=>window.skateLab.advanceTo(fr),f);
        if(meta.hud)await page.evaluate(()=>window.skateLab.snap());
        images.push(await shot(meta.hud));
        const p=await page.evaluate(()=>window.skateLab.present());
        labels.push(`#${f} ${p.phase} ${p.speed.toFixed(1)}u/s${p.trick?' '+p.trick.flipId:''}${p.grind?' '+p.grind.grindId:''}`);
      }
      const kinds=await page.evaluate(()=>window.skateLab.kinds());
      const strip=await page.evaluate(([i,l,c,t])=>window.skateLab.compose(i,l,c,t),[images,labels,cols,`${meta.name} · ${meta.title} · ${kinds.join(' ')}`]);
      save(`${name}.png`,strip);
      const trace=await page.evaluate(()=>window.skateLab.trace());
      writeFileSync(join(out,`${name}.json`),JSON.stringify({name,title:meta.title,expect:meta.expect,kinds,frames:trace},null,0));
      console.log(`${name}: ${kinds.join(' ')} (${((Date.now()-t0)/1000).toFixed(0)}s)`);
    }
    if(names.includes('stills')){
      const cams=await page.evaluate(()=>window.skateLab.stillCameras());
      const images=[],labels=[];
      for(const theme of ['classic','taylor','newfoundland'])for(const tier of ['full','lite'])for(let i=0;i<cams.length;i++){
        images.push(await page.evaluate(([t,r,k,o])=>window.skateLab.still(t,r,k,o),[theme,tier,i,{width:W,height:H,avatar:over.avatar}]));labels.push(`${theme} · ${tier} · ${cams[i]}`);
        console.log('still',theme,tier,cams[i]);
      }
      save('stills.png',await page.evaluate(([i,l,c])=>window.skateLab.compose(i,l,c,'Tideline Park · theme × tier · fixed cameras'),[images,labels,cams.length]));
    }
  }
  if(errors.length)console.log('page errors:\n'+errors.join('\n'));
}finally{await browser.close();await server.close();}
