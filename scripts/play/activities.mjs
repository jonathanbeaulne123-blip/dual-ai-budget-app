import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:850},reducedMotion:'reduce'});page.setDefaultTimeout(30000);
const passed=[],errors=[];page.on('pageerror',e=>errors.push(String(e)));
try {
 await page.goto('http://127.0.0.1:5198/?toys');
 await page.getByRole('button',{name:'Curiosities',exact:true}).click();
 await page.getByRole('button',{name:'Compose three stills',exact:true}).click();
 await expect(page.locator('.play-contact-sheet>button')).toHaveCount(3);
 const image=page.waitForEvent('download');await page.getByRole('button',{name:'Export contact sheet',exact:true}).click();await (await image).saveAs('docs/evidence/hercules-play/contact-sheet.png');passed.push('Camera three stills and contact sheet export');
 await page.getByRole('button',{name:/^The Curious Key/}).click();
 for(let solution=0;solution<3;solution++){
  await page.getByLabel('Cabinet arrangement').selectOption(String(solution));
  const target=[[0,1,2],[2,0,1],[1,2,0]][solution];for(let i=0;i<3;i++)for(let n=0;n<target[i];n++)await page.getByRole('button',{name:new RegExp('^Piece '+(i+1)+':')}).click();
  await expect(page.locator('.play-secret-drawer')).toHaveAttribute('data-open','true');
 }passed.push('Three replayable cabinet solutions');
 await page.getByRole('button',{name:/^The Velvet Theatre/}).click();await page.getByRole('button',{name:'Open storyboard',exact:true}).click();await expect(page.locator('.play-storyboard figure')).toHaveCount(4);passed.push('Theatre reduced-motion storyboard');
 await page.getByRole('button',{name:/^The Keepsake Projector/}).click();await page.getByLabel('Your caption').fill('A fictional household celebration');
 for(let i=0;i<6;i++){const portrait=await page.locator('.play-mini-stage>svg').getAttribute('aria-label');const title=await page.locator('.play-mini-stage>p').textContent();expect(portrait).toBe(title);await page.getByRole('button',{name:'Next still',exact:true}).click();}passed.push('Projector cycles matching image and label');
 await page.getByRole('button',{name:/^The Celebration Lantern/}).click();await page.getByRole('button',{name:'Light the still scene',exact:true}).click();const lantern=page.waitForEvent('download');await page.getByRole('button',{name:'Export commemorative portrait',exact:true}).click();await (await lantern).saveAs('docs/evidence/hercules-play/lantern-portrait.png');passed.push('Lantern still replay and export');
 await page.getByRole('button',{name:'Gallery',exact:true}).click();await page.getByRole('button',{name:'Choose a display',exact:true}).click();await page.getByLabel('Display position').selectOption('portrait-5');await page.getByLabel('Object',{exact:true}).selectOption('frame-0');await page.getByLabel('Lose next acknowledgement').check();await page.getByRole('button',{name:'Apply to display',exact:true}).click();await page.getByRole('button',{name:'Retry unconfirmed room save',exact:true}).waitFor();const generation=await page.locator('[data-proof]').getAttribute('data-generation');await page.getByRole('button',{name:'Retry unconfirmed room save',exact:true}).click();await expect(page.getByRole('button',{name:'Retry unconfirmed room save',exact:true})).toHaveCount(0);expect(await page.locator('[data-proof]').getAttribute('data-generation')).toBe(generation);passed.push('Lost acknowledgement recovered without duplicate command');
 await page.getByLabel('Fixture member').selectOption('MEM-002');await page.getByRole('button',{name:'Gallery',exact:true}).click();await page.getByRole('button',{name:'Choose a display',exact:true}).click();await page.getByLabel('Display position').selectOption('portrait-5');await expect(page.getByLabel('Object',{exact:true})).toHaveValue('frame-0');passed.push('Second synthetic member sees accepted shared placement');
} catch(e){errors.push(String(e));}
await writeFile('docs/evidence/hercules-play/activities-report.json',JSON.stringify({passed,errors,scope:'Local synthetic authority. No hosted or physical-device claim.'},null,2));console.log({passed,errors});await browser.close();
