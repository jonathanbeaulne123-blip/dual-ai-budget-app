import AxeBuilder from '@axe-core/playwright';
export async function checkMore({page,out,theme,scope,state}) {
 const receipt={states:[]};
 const widths=[320,390,720,1100,1440];
 async function capture(name){
  for(const width of widths){await page.setViewportSize({width,height:1000});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(`${name} overflow ${width}`);if(width===390||width===1440)await page.screenshot({path:`${out}/${theme}-${scope}-${name}-${width}.png`});}
  const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
  if(violations.length)throw Error(`${name} axe ${JSON.stringify(violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})))}`);
  receipt.states.push(name);
 }
 const seed=page.getByRole('textbox',{name:'Replay seed',exact:true});await seed.fill('1234567890');
 const category=page.getByRole('textbox',{name:'Category name',exact:true});await category.fill('A long unfinished category for another day');
 await category.evaluate(e=>window.__moreDraft=e);
 await page.locator('[data-preview-theme="'+(theme==='classic'?'taylor':'classic')+'"]').click();
 await capture('appearance-preview');
 if(await category.evaluate(e=>e!==window.__moreDraft)||await category.inputValue()!=='A long unfinished category for another day')throw Error('Theme preview lost actual category draft');
 await page.getByRole('button',{name:'Cancel preview',exact:true}).click();
 if(await seed.inputValue()!=='1234567890')throw Error('Preview lost seed');
 await category.fill('');await page.getByRole('button',{name:'Save category',exact:true}).click();await capture('category-error');
 await category.fill('Still unsaved');
 for(const name of ['Start from scratch','Sign out and clear this phone','Post due recurring']){
  await page.getByRole('button',{name,exact:true}).last().click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();await capture(name.toLowerCase().replaceAll(' ','-'));
  await dialog.getByRole('button',{name:/Cancel|Not now|Keep/i}).first().click();
  await dialog.waitFor({state:'hidden'});
 }
 if(scope==='household'){
  const charter=page.getByRole('button',{name:'Open the charter',exact:true});
  if(await charter.count()){await charter.click();await capture('charter-open');await page.getByRole('button',{name:'close',exact:true}).click();}

  const preview=page.locator('.guided-preview__details');await preview.locator('summary').click();await capture('guided-expanded');await preview.locator('summary').click();
 }
 await page.locator('#phone-display-timezone').scrollIntoViewIfNeeded();await capture('clock-and-place');
 const restore=page.getByRole('button',{name:'Restore',exact:true});if(await restore.count()&&await restore.first().isEnabled()){await restore.first().click();await capture('restore-review');await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();}
 const targets=await page.locator('.more-surfaces button:visible,.more-surfaces summary:visible').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {name:e.textContent.trim().slice(0,45),width:r.width,height:r.height};}).filter(r=>r.width<43.9||r.height<43.9));
 if(targets.length)throw Error('More small targets '+JSON.stringify(targets));
 receipt.draftPreserved=true;receipt.guardsCancelled=true;receipt.targets=true;
 await page.setViewportSize({width:390,height:1000});return receipt;
}
