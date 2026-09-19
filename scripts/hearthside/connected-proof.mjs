import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(60000);
const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));const out=process.env.HEARTH_ARTIFACTS_DIR??'/tmp/hearthside-connected-proof';await mkdir(out,{recursive:true});
try{
 await page.goto('http://127.0.0.1:5195/hearthside-specimen.html');await page.locator('.hearthside').waitFor();
 for(const theme of ['classic','taylor','newfoundland']){
  await page.getByLabel('World',{exact:true}).selectOption(theme);
  for(const width of [320,390,719,720,1100,1440,1920]){
   await page.setViewportSize({width,height:900});
   for(const room of ['common','studio','conservatory','theatre']){
    await page.locator('#hearthside-room-'+room).click();await page.locator(`.hsr[data-room="${room}"]`).waitFor();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow)throw Error(`Overflow ${theme} ${room} ${width}`);
    checks.push({theme,width,room,overflow});if(width===390||width===1440)await page.screenshot({path:`${out}/${theme}-${room}-${width}.png`,fullPage:true});
   }
  }
 }
 await page.setViewportSize({width:390,height:900});await page.locator('#hearthside-room-common').click();
 const origin=page.locator('.hsr-object-index li').filter({hasText:'An evening at home'}).getByRole('button').first();const originId=await origin.getAttribute('id');await origin.click();await page.locator('#hearthside-focus-title').waitFor();
 const intentionPath=page.url();await page.getByRole('button',{name:'Choose a next step',exact:true}).click();await page.getByLabel('What needs doing',{exact:true}).fill('Choose a favourite recipe');await page.getByLabel(/^Who will take it/).selectOption('MEM-002');await page.getByRole('button',{name:'Add this connected task',exact:true}).click();await page.locator('.hearthside-linked').getByText('Choose a favourite recipe',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Make time for this',exact:true}).click();await page.getByLabel('Starts',{exact:true}).fill('2026-09-20');await page.getByRole('button',{name:'Add this date to Calendar',exact:true}).click();await page.locator('.hearthside-linked article').nth(1).waitFor();
 if(await page.locator('.hearthside-linked article').count()!==2)throw Error('Duplicate or missing canonical references');
 await page.getByRole('button',{name:'Make something for this',exact:true}).click();await page.locator('.collaborative-studio').waitFor();if(!new URL(page.url()).searchParams.has('surface'))throw Error('Tool route missing');
 await page.goBack();await page.locator('#hearthside-focus-title').waitFor();if(page.url()!==intentionPath)throw Error('Browser Back lost originating intention');
 await page.goBack();await page.locator('.hsr[data-room="common"]').waitFor();if(await page.evaluate(()=>document.activeElement?.id)!==originId)throw Error('Browser Back lost room object focus');
 checks.push({journey:'one intention -> assigned canonical task + Calendar date -> Studio -> Back to intention -> Back to original room object',passed:true});
 if(errors.length)throw Error(JSON.stringify(errors));await writeFile(`${out}/evidence.json`,JSON.stringify({scope:'Integrated Hearthside component and canonical domain commands with fictional in-browser authority; not full App authentication or device proof',checks,errors},null,2));console.log(JSON.stringify({records:checks.length,errors}));
}catch(e){await page.screenshot({path:`${out}/failure.png`,fullPage:true});console.error(e);console.error((await page.locator('body').innerText()).slice(-6000));process.exitCode=1;}finally{await browser.close();}
