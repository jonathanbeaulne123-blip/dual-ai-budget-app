import {expect,it} from 'vitest';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile} from 'node:fs/promises';
it('opens the actual own-account street without importing App, mounting books, or requiring a household',async()=>{
 const server=await createServer({configFile:false,root:process.cwd(),cacheDir:'/tmp/hearthside-street-vite',esbuild:{jsx:'automatic'},logLevel:'error',define:{'import.meta.env.VITE_HEARTHSIDE_GUESTS':'"1"'},server:{host:'127.0.0.1',port:0},optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime','@capacitor/core']}});await server.listen();
 const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:390,height:900}}),page=await context.newPage(),requests:string[]=[],errors:string[]=[],base=`http://127.0.0.1:${(server.httpServer!.address() as {port:number}).port}`,directory='/tmp/hearthside-street-entry-proof';await mkdir(directory,{recursive:true});
 page.setDefaultTimeout(10000);page.on('request',request=>requests.push(request.url()));page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{const request=route.request(),url=request.url();if(url.startsWith(base+'/api/hearthside-guests/')){
  expect(url).toBe(base+'/api/hearthside-guests/development/street');const actor=request.headers().authorization;await route.fulfill({json:{version:1,visits:[],cards:actor==='Bearer synthetic-guest-two'?[{version:1,id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',label:'Second guest card',redeemBefore:Date.now()+86400000,revoked:false}]:[]}});return;
 }if(!url.startsWith(base)&&!url.startsWith('data:')){await route.abort();return;}await route.continue();});
 try{
  await page.goto(base+'/hearthside/street');await page.getByRole('heading',{name:'A door someone opened for you.'}).waitFor();
  const useSession=async(which:string)=>page.evaluate(which=>{localStorage.setItem('hearth:v1:supabase-auth:development',JSON.stringify({accessToken:'synthetic-'+which,refreshToken:'synthetic-refresh',userId:which,sessionId:which+'-session',googleSubject:which+'-google',email:which+'@example.test',displayName:which==='guest-one'?'First guest':'Second guest',expiresAt:Date.now()+3600000}));window.dispatchEvent(new Event('hearth:supabase-session-changed'));},which);
  await useSession('guest-one');await page.getByRole('heading',{name:'Your street has room to grow.'}).waitFor();
  expect(await page.getByRole('button',{name:'Prepare our room',exact:true}).count()).toBe(0);expect(await page.getByText('Signed in as First guest', {exact:true}).count()).toBe(1);
  for(const width of [320,390,720,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`${directory}/street-${width}.png`,fullPage:true});}
  await useSession('guest-two');await page.getByText('Second guest card',{exact:true}).waitFor();expect(await page.getByText('Signed in as First guest',{exact:true}).count()).toBe(0);
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('heading',{name:'A door someone opened for you.'}).waitFor();expect(await page.getByText('Second guest card',{exact:true}).count()).toBe(0);
  expect(requests.filter(url=>/\/src\/App\.tsx|pglite|ledger-sync|\/rest\/v1\//.test(url))).toEqual([]);expect(errors).toEqual([]);
  await writeFile(directory+'/evidence.json',JSON.stringify({route:'/hearthside/street',actualMain:true,syntheticSessions:true,householdRequired:false,appImported:false,privateReplicaRequests:false,scopeSwitch:true,signOut:true,axeViolations:0,widths:[320,390,720,1440]},null,2));
 }catch(error){await writeFile(directory+'/errors.json',JSON.stringify({errors,requests},null,2));await page.screenshot({path:directory+'/failure.png',fullPage:true});await writeFile(directory+'/failure.html',await page.content());throw error;}finally{await browser.close();await server.close();}
},90000);
