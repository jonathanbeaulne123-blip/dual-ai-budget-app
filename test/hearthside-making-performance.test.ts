import {expect,it} from 'vitest';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

it('measures real Studio response and releases WebGL resources across repeated room returns',async()=>{
 const server=await createServer({configFile:false,root:process.cwd(),cacheDir:'/tmp/hearthside-making-performance-vite',esbuild:{jsx:'automatic'},logLevel:'error',server:{host:'127.0.0.1',port:0},optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime','three','@capacitor/core']},plugins:[{name:'making-proof',configureServer(vite){vite.middlewares.use('/__making_performance',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local making performance</title><style>body{margin:0;font:16px system-ui}main{padding:16px 12px 180px}button{min-height:44px}.collaborative-studio-stage{min-width:0}.kitty-stage{height:380px!important}</style></head><body><div id="root"></div><script type="module" src="/test/fixtures/hearthsideMakingPerformanceProof.tsx"></script></body></html>');});}}]});await server.listen();
 const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[],directory='/tmp/hearthside-making-performance';await mkdir(directory,{recursive:true});page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
 await page.addInitScript(()=>{
  const audit={contexts:0,lostEvents:0,released:[] as Record<string,number>[],pointerMs:[] as number[],keyboardMs:[] as number[],frames:[] as number[],capture:false};
  (window as unknown as {makingAudit:typeof audit}).makingAudit=audit;
  const getContext=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:unknown[]){
   const gl=Reflect.apply(getContext,this,args) as WebGL2RenderingContext|null;
   if(!gl||!['webgl','webgl2','experimental-webgl'].includes(String(args[0]))||(gl as unknown as {audited?:boolean}).audited)return gl;
   (gl as unknown as {audited?:boolean}).audited=true;audit.contexts++;this.addEventListener('webglcontextlost',()=>{audit.lostEvents++;});
   const sets=new Map<string,Set<unknown>>();
   for(const name of ['Buffer','Texture','Framebuffer','Renderbuffer','Program','Shader','VertexArray']){
    const methods=gl as unknown as Record<string,(...args:unknown[])=>unknown>,create=methods['create'+name],remove=methods['delete'+name];if(!create||!remove)continue;const live=new Set<unknown>();sets.set(name,live);
    methods['create'+name]=function(...args){const result=Reflect.apply(create,gl,args);if(result)live.add(result);return result;};methods['delete'+name]=function(...args){live.delete(args[0]);return Reflect.apply(remove,gl,args);};
   }
   const extension=gl.getExtension.bind(gl);let released=false;
   gl.getExtension=((name:string)=>{const result=extension(name);if(name==='WEBGL_lose_context'&&result&&!result.audited){result.audited=true;const lose=result.loseContext.bind(result);result.loseContext=()=>{if(!released){released=true;audit.contexts--;audit.released.push(Object.fromEntries([...sets].map(([name,live])=>[name,live.size])));}lose();};}return result;}) as typeof gl.getExtension;
   return gl;
  } as typeof getContext;
  const raf=requestAnimationFrame;
  window.requestAnimationFrame=function(callback){return raf(time=>{if(audit.capture)audit.frames.push(time);callback(time);});};
  document.addEventListener('keydown',event=>{if(!audit.capture||!(event.target instanceof Element)||!event.target.closest('.collaborative-studio'))return;const start=performance.now();raf(()=>audit.keyboardMs.push(performance.now()-start));},true);
  document.addEventListener('pointermove',event=>{if(!audit.capture||!(event.target instanceof Element)||!event.target.closest('.kitty-stage'))return;const start=performance.now();raf(()=>audit.pointerMs.push(performance.now()-start));},true);
 });
 let releaseScene=()=>{};const sceneGate=new Promise<void>(resolve=>{releaseScene=resolve;});await page.route('**/*RoomEnvironment*',async route=>{await sceneGate;await route.continue();});
 try{
  await page.goto(`http://127.0.0.1:${(server.httpServer!.address() as {port:number}).port}/__making_performance`);
  const evidence:unknown[]=[];
  for(let cycle=0;cycle<5;cycle++){
   const width=cycle%2?390:1440;await page.setViewportSize({width,height:1000});
   await page.getByRole('button',{name:'Enter making table',exact:true}).click();await page.getByRole('button',{name:cycle?'Join this piece':'Start a piece',exact:true}).click();
   if(cycle===0){await page.locator('.kitty-stage .kitty-flat').waitFor();releaseScene();}await page.locator('.kitty-stage canvas').waitFor();await page.getByRole('button',{name:'Paint and decorate',exact:true}).click();
   const stage=page.locator('.kitty-stage');await stage.scrollIntoViewIfNeeded();const box=(await stage.boundingBox())!;
   await page.evaluate(()=>{const a=(window as unknown as {makingAudit:{capture:boolean;frames:number[];pointerMs:number[];keyboardMs:number[]}}).makingAudit;a.capture=true;a.frames=[];a.pointerMs=[];a.keyboardMs=[];});
   await page.mouse.move(box.x+box.width*.4,box.y+box.height*.55);await page.mouse.down();
   for(let sample=0;sample<30;sample++)await page.mouse.move(box.x+box.width*(.4+sample*.004),box.y+box.height*(.55+Math.sin(sample*.5)*.015));
   await page.mouse.up();await page.getByText('Your brush mark is kept.',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Sea glass',exact:true}).focus();for(let sample=0;sample<12;sample++)await page.keyboard.press('Space');
   await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await page.evaluate(()=>{(window as unknown as {makingAudit:{capture:boolean}}).makingAudit.capture=false;});
   const timing=await page.evaluate(()=>{const a=(window as unknown as {makingAudit:{frames:number[];pointerMs:number[];keyboardMs:number[]}}).makingAudit,frames=[...new Set(a.frames)].sort((a,b)=>a-b),durations=a.pointerMs.slice().sort((a,b)=>a-b);const keys=a.keyboardMs.slice().sort((a,b)=>a-b);return {keyboardSamples:keys.length,p95KeyboardToFrameMs:keys[Math.ceil(keys.length*.95)-1],pointerSamples:durations.length,p95PointerToFrameMs:durations[Math.ceil(durations.length*.95)-1],observedAnimationFrameRate:frames.length>1?(frames.length-1)*1000/(frames.at(-1)!-frames[0]!):0};});
   expect(timing.pointerSamples).toBeGreaterThanOrEqual(25);expect(timing.p95PointerToFrameMs).toBeLessThan(100);expect(timing.keyboardSamples).toBeGreaterThanOrEqual(10);expect(timing.p95KeyboardToFrameMs).toBeLessThan(100);
   await page.getByRole('button',{name:'Return to room',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as unknown as {makingAudit:{contexts:number}}).makingAudit.contexts)).toBe(0);evidence.push({cycle,width,...timing});
  }
  const resources=await page.evaluate(()=>(window as unknown as {makingAudit:{released:Record<string,number>[]}}).makingAudit.released);expect(resources.length).toBeGreaterThanOrEqual(5);for(const retained of resources){expect(retained).toEqual(resources[0]);expect(retained).toMatchObject({Buffer:0,Renderbuffer:0,Shader:0,VertexArray:0});}await expect.poll(()=>page.evaluate(()=>(window as unknown as {makingAudit:{lostEvents:number}}).makingAudit.lostEvents)).toBe(resources.length);
  expect(errors).toEqual([]);await writeFile(directory+'/evidence.json',JSON.stringify({fixture:'headless Chrome on local Mac; synthetic in-browser authority; no device FPS certification',measurements:evidence,resourcesBeforeContextLoss:resources,allContextsReleased:true,vendorCacheNote:'Three retains fixed renderer-local texture, framebuffer and depth-program caches until forceContextLoss; their counts must not grow between visits.'},null,2));
 }catch(error){await page.screenshot({path:directory+'/failure.png',fullPage:true});await writeFile(directory+'/failure.json',JSON.stringify({error:String(error),errors,audit:await page.evaluate(()=>(window as unknown as {makingAudit:unknown}).makingAudit)}));throw error;}finally{releaseScene();await browser.close();await server.close();}
},120000);
