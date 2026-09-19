import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),out=process.env.HEARTH_ARTIFACTS_DIR??'/tmp/hearthside-arrangement-proof',checks=[],errors=[];
await mkdir(out,{recursive:true});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
try{
 await page.goto('http://127.0.0.1:5195/hearthside-specimen.html');await page.locator('.hearthside').waitFor();
 for(const theme of ['classic','taylor','newfoundland'])for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900});await page.getByLabel('World',{exact:true}).selectOption(theme);await page.locator('#hearthside-room-common').click();
  const object=page.locator('.hsr-placed[data-kind="experience"]').first(),arrange=page.getByRole('button',{name:'Arrange An evening at home',exact:true});
  const original=await object.getAttribute('style');await arrange.click();await object.scrollIntoViewIfNeeded();
  const a=await object.boundingBox();if(!a)throw Error('Object hidden');const before=await page.locator('.hsr-arranger input').first().inputValue();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+a.width/2+30,a.y+a.height/2+36,{steps:8});await page.mouse.up();
  const after=await page.locator('.hsr-arranger input').first().inputValue();if(before===after)throw Error('Drag did not change position');
  if(await page.locator('.hearthside-focused').count())throw Error('Drag navigated to object');
  await page.locator('.hsr-arranger').getByRole('button',{name:'Cancel',exact:true}).click();if(await object.getAttribute('style')!==original)throw Error('Cancel changed accepted position');
  await arrange.click();await object.scrollIntoViewIfNeeded();const b=await object.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2-25,b.y+b.height/2+24,{steps:6});await page.mouse.up();
  const chosen=await page.locator('.hsr-arranger input').first().inputValue();await page.locator('.hsr-arranger').getByRole('button',{name:'Save position',exact:true}).click();await page.getByText('Kept in your shared home.',{exact:true}).waitFor();
  await page.waitForFunction(value=>{const e=document.querySelector('.hsr-placed[data-kind="experience"]');return e&&Math.abs(parseFloat(e.style.getPropertyValue('--hsr-x'))/100-Number(value))<=.001;},chosen);
  const accepted=await object.evaluate(e=>e.style.getPropertyValue('--hsr-x'));if(Math.abs(parseFloat(accepted)/100-Number(chosen))>.001)throw Error('Accepted coordinate differs');
  await page.getByLabel('Acting as',{exact:true}).selectOption('MEM-002');await object.waitFor();if(await object.evaluate(e=>e.style.getPropertyValue('--hsr-x'))!==accepted)throw Error('Other member lost position');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Overflow');
  await page.screenshot({path:`${out}/${theme}-${width}.png`,fullPage:true});checks.push({theme,width,cancel:true,drag:true,acceptedX:accepted,memberContinuity:true});await page.getByLabel('Acting as',{exact:true}).selectOption('MEM-001');
 }
 if(errors.length)throw Error(JSON.stringify(errors));await writeFile(`${out}/evidence.json`,JSON.stringify({scope:'Actual HouseholdRoom and commands in synthetic shared in-browser authority, no hosted/device claim',checks,errors},null,2));console.log(JSON.stringify({checks:checks.length,errors}));
}catch(e){await page.screenshot({path:`${out}/failure.png`,fullPage:true});console.error(e);console.error((await page.locator('body').innerText()).slice(-4000));process.exitCode=1;}finally{await browser.close();}
