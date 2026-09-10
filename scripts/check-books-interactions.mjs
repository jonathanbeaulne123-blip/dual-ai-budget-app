import AxeBuilder from '@axe-core/playwright';
export async function checkBooks({page,out,theme,scope,state}) {
 await page.setViewportSize({width:1440,height:1000});
 const receipt={states:[],targets:true};
 const root=page.locator('.books-theme-c');
 const nav=scope==='household'?page.locator('.household-books-nav'):page.locator('[data-books-tabs="table"]');
 const settle=async()=>{await page.locator('.deferred-surface[aria-busy=true]').waitFor({state:'hidden',timeout:90000});};
 async function capture(name){
  for(const width of [320,390,720,1100,1440]){
   await page.setViewportSize({width,height:1000});
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(`Books ${name} overflow ${width}`);
   const small=await root.locator('button:visible,summary:visible').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {name:e.textContent.trim().slice(0,32),w:r.width,h:r.height};}).filter(r=>r.w<43.9||r.h<43.9));
   if(small.length)throw Error('Books targets '+name+' '+width+' '+JSON.stringify(small));
   if(width===390||width===1440){await root.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${theme}-${scope}-${name}-${width}.png`});}
  }
  const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
  if(violations.length)throw Error(`Books ${name} axe ${JSON.stringify(violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})))}`);
  receipt.states.push(name);
 }
 if(process.env.HEARTH_BOOKS_ACCOUNTS_ONLY!=='1'){
 const fund=nav.getByRole('button',{name:scope==='household'?'Fund':'Household Fund',exact:true});
 if(await fund.count()){await fund.click();await settle();await capture('fund');}else receipt.fund='Not exposed in this personal ledger; entry preserved';
 if(scope==='household'){await page.locator('.household-fund-tabs').getByRole('button',{name:'Register',exact:true}).click();await capture('fund-register');}
 }
 await nav.getByRole('button',{name:scope==='household'?'Accounts':'Wallet',exact:true}).click();await settle();await capture('accounts');
 const detail=root.locator('details:visible').filter({has:page.locator('summary').filter({hasText:'Add an account'})}).first();
 if(await detail.count()){await detail.locator('summary').click();await capture('account-form-expanded');await detail.locator('summary').click();}
 const tile=root.locator('.wallet-tile').first();if(await tile.count()){await tile.click();await capture('account-room');await tile.click();}
 if(process.env.HEARTH_BOOKS_ACCOUNTS_ONLY==='1'){await page.setViewportSize({width:390,height:1000});return receipt;}
 await nav.getByRole('button',{name:scope==='household'?'Activity':'All activity',exact:true}).click();await settle();
 const search=page.getByLabel('Search activity',{exact:true});await search.fill('No matching illustrative entry');await capture('activity-empty');await search.fill('');await capture('activity');
 const source=page.locator('.ledger-source-amount').first();
 if(await source.count()){await source.click();await capture('source-expanded');await page.keyboard.press('Escape');}
 const audit=page.locator('.books-audit-office');if(await audit.getAttribute('open')===null)await audit.locator('summary').click();
 for(const label of ['Journal','Trial balance','Statements','Reconcile','Close pack','Chart','Ask']){
  await page.locator('[data-books-tabs="audit"]').getByRole('button',{name:label,exact:true}).click();await settle();
  if(label==='Reconcile')await page.getByRole('textbox',{name:'Statement balance (CAD)',exact:true}).fill('1234567.89');
  await capture(label.toLowerCase().replaceAll(' ','-'));
 }
 // Import previews only. Never choose files or submit a financial command.
 if(scope==='household')await page.locator('[data-books-tabs="audit"]').getByRole('button',{name:'Import',exact:true}).click();
 else await nav.getByRole('button',{name:'Import',exact:true}).click();
 await settle();await capture('import');
 await nav.getByRole('button',{name:scope==='household'?'Overview':'Wallet',exact:true}).click();
 if(await audit.getAttribute('open')!==null)await audit.locator('summary').click();
 await page.setViewportSize({width:390,height:1000});return receipt;
}
