// Actual Plan, local synthetic books only; no financial save/post.
import AxeBuilder from '@axe-core/playwright';
export async function checkPlan({page,out,theme,scope,state}) {
 const receipt={states:[],budgetCancel:false,bankDraft:false};
 async function capture(name){
  for(const width of [320,390,720,1099,1100,1440]) {
   await page.setViewportSize({width,height:1000});
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(`${theme} ${scope} ${name} overflow ${width}`);
   if(width===390||width===1440)await page.screenshot({path:`${out}/${theme}-${scope}-${name}-${width}.png`,fullPage:true});
  }
  const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
  if(violations.length)throw Error(`${name} axe: ${JSON.stringify(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})))}`);
  receipt.states.push(name);
 }
 await page.setViewportSize({width:1440,height:1000});
 const edit=page.locator('.budget-edit-trigger').first();
 if(await edit.count()){
  await edit.click();const input=page.locator('.budget-edit input');await input.fill('1234567.89');
  await capture('budget-draft');await input.fill('invalid');await input.press('Enter');await capture('budget-error');await input.focus();await page.keyboard.press('Escape');
  if(!await edit.evaluate(e=>e===document.activeElement))throw Error('Budget cancel lost focus');receipt.budgetCancel=true;
 }
 await page.locator('.plan-categories summary').click();await page.getByRole('textbox',{name:'Category name',exact:true}).fill('A category still being planned');await capture('category-draft');await page.locator('.plan-categories summary').click();
 const bank=page.locator('.kitty-banks');await bank.locator('summary').filter({hasText:scope==='household'?'Add shared bank':'Add personal bank'}).click();
 await bank.getByRole('textbox',{name:'New bank name',exact:true}).fill('An unfinished adventure');
 await bank.getByRole('textbox',{name:'New bank target',exact:true}).fill('1234567.89');
 await capture('bank-draft');
 if(await bank.getByRole('textbox',{name:'New bank name',exact:true}).inputValue()!=='An unfinished adventure')throw Error('Bank draft lost on resize');receipt.bankDraft=true;
 await bank.locator('summary').filter({hasText:scope==='household'?'Add shared bank':'Add personal bank'}).click();
 if(scope==='household'&&state!=='empty') {
  const source=bank.locator('select[aria-label^="Source for"]').first();
  const options=await source.locator('option').evaluateAll(es=>es.map(e=>e.value).filter(Boolean));
  if(options.length){await source.selectOption(options[0]);await bank.locator('input[aria-label^="Contribution for"]').first().fill('25');await bank.getByRole('button',{name:'Review contribution',exact:true}).first().click();await page.getByRole('heading',{name:'Confirm this bank',exact:true}).waitFor();await capture('bank-confirm');await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();receipt.confirmCancelled=true;}
 }
 const purchase=bank.getByRole('button',{name:'Mark purchased',exact:true});
 if(await purchase.count()){await purchase.first().click();await capture('purchase-draft');await bank.getByRole('button',{name:'Review purchase',exact:true}).click();await capture('purchase-confirm');await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();await bank.getByRole('button',{name:'Not yet',exact:true}).click();receipt.purchaseCancelled=true;}
 const guide=page.locator('.sit-guide');
 if(scope==='household'){
  await guide.locator('.sit-act1-well summary').click();
  const fact=guide.locator('.sit-fact').first();if(await fact.count()){await fact.click();if(await fact.getAttribute('aria-expanded')!=='true')throw Error('Fact expansion missing');}
  await capture('sit-expanded');await guide.locator('.sit-act1-well summary').click();
 }
 const targets=await page.locator('.plan-categories :is(.budget-edit-trigger,.budget-remove)').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height};}));
 if(targets.some(r=>r.w<44||r.h<44))throw Error('Budget targets below44px');receipt.targets=targets;
 await page.setViewportSize({width:390,height:1000});
 return receipt;
}
