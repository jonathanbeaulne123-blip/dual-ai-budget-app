import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext(),page=await context.newPage(),checks=[],errors=[],out=process.env.HEARTH_ARTIFACTS_DIR??'/tmp/hearthside-history-proof';
page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));await mkdir(out,{recursive:true});
try{
 await page.goto('http://127.0.0.1:5195/hearthside-specimen.html');await page.locator('.hearthside').waitFor();
 await page.locator('#hearthside-history').click();await page.getByRole('button',{name:'Record this common room',exact:true}).click();
 await page.getByLabel('Name this view',{exact:true}).fill('The good mugs, before the cocoa');await page.getByRole('button',{name:'Invite us to keep this view',exact:true}).click();
 await page.getByRole('button',{name:'Keep this exact view',exact:true}).click();await page.getByRole('button',{name:'I chose to keep this view',exact:true}).waitFor();
 await page.getByLabel('Acting as',{exact:true}).selectOption('MEM-002');await page.getByLabel('Visit a saved view',{exact:true}).selectOption({label:'1 · The good mugs, before the cocoa · awaiting our choice'});
 await page.getByRole('button',{name:'Keep this exact view',exact:true}).click();await page.getByText('A recorded room we both kept · Common room',{exact:true}).waitFor();
 for(const theme of ['classic','taylor','newfoundland'])for(const width of [320,390,719,720,1100,1440,1920]){
  await page.getByLabel('World',{exact:true}).selectOption(theme);await page.setViewportSize({width,height:900});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error(`Overflow ${theme}/${width}`);
  let axe=[];if(width===390||width===1440){const r=await new AxeBuilder({page}).include('.room-history').analyze();axe=r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));if(axe.length)throw Error(JSON.stringify(axe));await page.screenshot({path:`${out}/${theme}-${width}.png`,fullPage:true});}
  checks.push({theme,width,kept:true,overflow:false,axe});
 }
 // The author changes today's note; the recorded view continues to show its original words.
 await page.setViewportSize({width:390,height:900});const title='I put the good mugs out. See you at our table.';
 await page.locator('.room-history .hsr-object-index li').filter({hasText:title}).getByRole('button').first().click();await page.getByRole('button',{name:'Open this object in today’s room',exact:true}).click();
 await page.getByRole('button',{name:'Edit my note',exact:true}).click();await page.getByLabel('Your note',{exact:true}).fill('The cocoa is ready now.');await page.getByRole('button',{name:'Leave this note',exact:true}).click();
 await page.locator('#hearthside-room-common').click();await page.locator('#hearthside-history').click();await page.getByLabel('Visit a saved view',{exact:true}).selectOption({label:'1 · The good mugs, before the cocoa'});
 await page.locator('.room-history .hsr-object-index').getByText(title,{exact:true}).waitFor();checks.push({history:'original words survive a current note edit',passed:true});
 await page.getByRole('button',{name:'Withdraw this view',exact:true}).click();await page.getByLabel('Visit a saved view',{exact:true}).locator('option').filter({hasText:'The good mugs'}).waitFor({state:'detached'});
 await page.getByLabel('Acting as',{exact:true}).selectOption('MEM-001');if(await page.getByLabel('Visit a saved view',{exact:true}).locator('option').count()!==1)throw Error('Withdrawn view returned to partner');checks.push({withdrawal:'both members',passed:true});
 if(errors.length)throw Error(JSON.stringify(errors));await writeFile(`${out}/evidence.json`,JSON.stringify({scope:'Actual Hearthside/RoomHistory component and canonical commands, fictional in-browser household; no hosted or physical-device claim',checks,errors},null,2));console.log(JSON.stringify({checks:checks.length,errors}));
}catch(error){await page.screenshot({path:`${out}/failure.png`,fullPage:true});console.error(error);console.error((await page.locator('body').innerText()).slice(-5000));process.exitCode=1;}finally{await browser.close();}
