import {afterAll,beforeAll,expect,it} from 'vitest';
import {createServer,type ViteDevServer} from 'vite';
import {chromium,type Browser,type Page} from '@playwright/test';
let server:ViteDevServer,browser:Browser,page:Page;
beforeAll(async()=>{
 server=await createServer({configFile:false,root:process.cwd(),cacheDir:'node_modules/.hearthside-nest-export-vite',server:{host:'127.0.0.1',port:0},logLevel:'error',plugins:[{name:'nest-export',configureServer(vite){vite.middlewares.use('/__nest_export',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script></head><body>Native authored capture fixture</body></html>');});}}]});
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage();await page.goto('http://127.0.0.1:'+(server.httpServer!.address() as {port:number}).port+'/__nest_export');
},60_000);
afterAll(async()=>{await browser?.close();await server?.close();});
it('captures the real crown and all theme category props at chosen physical dimensions with immutable recipe, native GLB and exact package manifest',async()=>{
 const result=await page.evaluate(async()=>{
  const importer=new Function('p','return import(p)'),{newKittyPiece}=await importer('/src/core/kittyStudio.ts'),{captureAuthoredKitty}=await importer('/src/hearthside/exportCapture.ts'),{prepareKittyExport,finishKittyExport}=await importer('/src/hearthside/exportKitty.ts'),{nativeSceneFromDesign}=await importer('/src/hearthside/nativeBridge.ts');
  const piece=newKittyPiece('PIECE-crown','2026-09-12T12:00:00.000Z');piece.sculpt.body='tall';piece.paint.strokes=[{part:'body',tool:'brush',color:'#ab2233',size:12,opacity:1,mirror:false,pts:[.3,.4,.4,.4]}];
  const plain={version:1,documentId:'DESIGN-crown',revision:0,piece,heightMm:160,construction:'solid'},base=captureAuthoredKitty(plain),selection={...plain,appearance:{version:1,tier:'king',category:null,theme:'newfoundland'}},crowned=captureAuthoredKitty(selection);
  document.documentElement.dataset.theme='taylor';const changedTheme=captureAuthoredKitty(selection),same=JSON.stringify(crowned)===JSON.stringify(changedTheme);
  const height=(capture:any)=>{let lo=Infinity,hi=-Infinity;for(const mesh of capture.meshes)for(let i=1;i<mesh.positions.length;i+=3){lo=Math.min(lo,mesh.positions[i]);hi=Math.max(hi,mesh.positions[i]);}return hi-lo;};
  const themed=[];for(const theme of ['classic','taylor','newfoundland'])for(const category of ['protect','everyday','build','prepare']){const value=captureAuthoredKitty({...plain,appearance:{version:1,tier:'plan',category,theme}});themed.push({theme,category,extra:value.meshes.length-base.meshes.length,height:height(value)});}
  const {paintedSnapshot}=await importer('/src/hearthside/paintedSnapshot.tsx'),plainPaper=await paintedSnapshot(piece,new AbortController().signal),crownPaper=await paintedSnapshot(piece,new AbortController().signal,selection.appearance);const paperChanged=String(new Uint8Array(await plainPaper.arrayBuffer()))!==String(new Uint8Array(await crownPaper.arrayBuffer()));
  const prepared=await prepareKittyExport(selection,crowned),pack=await finishKittyExport(prepared),decode=(bytes:Uint8Array)=>new TextDecoder().decode(bytes);
  const identity={environment:'development',householdId:'HH-nest-capture',memberId:'MEM-001',designId:selection.documentId,pieceId:piece.id,revision:0};
  const a=nativeSceneFromDesign({identity,piece,appearance:selection.appearance},{status:'unavailable'},'/hearthside/rooms/studio'),b=nativeSceneFromDesign({identity,piece,appearance:selection.appearance},{status:'available',step:10},'/hearthside/rooms/studio');
  return {paperChanged,extra:crowned.meshes.length-base.meshes.length,same,height:height(crowned),themed,source:crowned.source,manifest:pack.manifest,sourceCopy:JSON.parse(decode(pack.files.get('source-design.json'))),files:[...pack.files.keys()],nativeSame:a.glbBase64===b.glbBase64&&JSON.stringify(a.meshes)===JSON.stringify(b.meshes),nativeBacking:a.backing};
 });
 expect(result.paperChanged).toBe(true);expect(result.extra).toBeGreaterThan(0);expect(result.same).toBe(true);expect(result.height).toBeCloseTo(160,5);expect(result.source).toBe('authored-kitty-nest-v1');for(const row of result.themed){expect(row.extra,JSON.stringify(row)).toBeGreaterThan(0);expect(row.height).toBeCloseTo(160,5);}
 expect(result.manifest.appearance).toEqual({version:1,tier:'king',category:null,theme:'newfoundland'});expect(result.manifest.sourceGeometry).toBe('authored-kitty-nest-v1');expect(result.sourceCopy.appearance).toEqual(result.manifest.appearance);expect(result.files).toEqual(expect.arrayContaining(['kitty.stl','kitty.3mf','kitty.glb','geometry-sheet.pdf','paint/source-paint.json','manifest.json']));expect(result.nativeSame).toBe(true);expect(result.nativeBacking).toEqual({status:'unavailable'});
},60_000);
