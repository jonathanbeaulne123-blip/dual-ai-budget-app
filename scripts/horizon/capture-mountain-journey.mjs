import {chromium} from '@playwright/test';import{mkdirSync,writeFileSync,readFileSync}from'node:fs';import{resolve}from'node:path';import{createHash}from'node:crypto';
const out=resolve('docs/horizon/evidence/mountain-road/after/journey');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),records=[],errors=[];
const worldSha256=createHash('sha256').update(readFileSync('public/horizon/world/horizon-geo-1.journey.json.gz')).digest('hex');
try{for(const tier of['full','lite'])for(const theme of['classic','taylor','newfoundland'])for(const width of[1100,...(process.argv.includes('--responsive')?[320,390,720]:[])]){
 const page=await browser.newPage({viewport:{width,height:width<720?844:720}});page.on('pageerror',e=>errors.push({theme,tier,width,error:e.message}));
 await page.goto(`http://127.0.0.1:5209/docs/horizon/evidence/mountain-road/after/journey/harness/?theme=${theme}&tier=${tier}`);
 await page.waitForFunction(()=>window.__ready===true,null,{timeout:180000});
 for(const [id,target,zoom]of(width===1100?[['mountain',{x:1300,y:620},'region'],['stillwater',{x:1180,y:710},'region'],['foot',{x:1280,y:735},'stop']]:[['foot',{x:1280,y:735},'stop']])){
  const stats=await page.evaluate(([target,zoom])=>window.__cap.frame(target,zoom),[target,zoom]);await page.waitForTimeout(250);
  const file=`${theme}-${tier}-${id}${width===1100?'':`-${width}`}.jpg`;await page.locator('#host').screenshot({path:out+'/'+file,type:'jpeg',quality:86,timeout:60000});records.push({file,theme,tier,width,stats});console.log(file);
 }
 await page.close();
}}finally{writeFileSync(out+'/captures.json',JSON.stringify({method:'Actual Journey board renderer and fictional fixture; headless Chromium SwiftShader, not device evidence',worldSha256,clock:'Journey is an authored printed map with fixed daylight. These images apply to both world day and world night; no second night scene was invented.',records,errors},null,2));await browser.close();}
