// Invoked by the actual-page world harness. Only local synthetic drafts; never save/post.
import AxeBuilder from '@axe-core/playwright';
export async function checkCalendar({page,out,theme,scope,state}) {
 const receipt={panes:[],dateKeyboard:false,monthKeyboard:false,draftCancel:false};
 const tab=name=>page.getByRole('tab',{name,exact:true}).click();
 const capture=async(name)=>{
  for(const width of [320,390,720,1440]) {
   await page.setViewportSize({width,height:1000});
   await page.locator('.calendar-stage').scrollIntoViewIfNeeded();
   if(width===390||width===1440)await page.screenshot({path:`${out}/${theme}-${scope}-${name}-${width}.png`,fullPage:true});
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(`${name} overflow at ${width}`);
  }
  const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
  if(violations.length)throw Error(`${name} axe: ${JSON.stringify(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})))}`);
  receipt.panes.push(name);console.log(theme,scope,state,name,"checked");
 };
 const selected=page.locator('.cal-day[aria-pressed=true]');
 const before=await selected.getAttribute('data-calendar-date');
 await selected.focus();await page.keyboard.press('ArrowRight');
 receipt.dateKeyboard=(await page.locator('.cal-day[aria-pressed=true]').getAttribute('data-calendar-date'))!==before;
 if(!receipt.dateKeyboard||!await page.locator('.calendar-selected-day').isVisible())throw Error('Date keyboard/detail failed');
 await page.locator('.calendar-upcoming summary').click();await capture('day-expanded');
 await page.getByRole('button',{name:'Next month',exact:true}).click();
 await page.getByRole('button',{name:'Previous month',exact:true}).click();
 await tab('Month');const range=page.getByRole('slider',{name:'Day of the month',exact:true});
 await range.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');receipt.monthKeyboard=(await range.inputValue())==='2';
 if(!receipt.monthKeyboard)throw Error('Month keyboard failed');
 await page.locator('.weight-list summary').click();await capture('month');
 await tab('Appointments');await capture('appointments');
 if(state!=='normal'){await tab('Bills');await capture('bills');await tab('Calendar');await page.setViewportSize({width:390,height:1000});return receipt;}
 await page.locator('.visit-world').getByRole('button',{name:'Add',exact:true}).click();
 await page.locator('#visit-title').fill('A long illustrative appointment title for our calendar');await page.locator('#visit-cost').fill('123456.78');
 await capture('appointment-draft');
 await page.locator('.visit-world').getByRole('button',{name:'Upcoming',exact:true}).click();
 await page.locator('.visit-world').getByRole('button',{name:'Open the log',exact:true}).click();await capture('medical-log');
 await tab('Bills');await capture('bills');
 await page.getByRole('button',{name:'Add repeating',exact:true}).click();
 await page.locator('#repeating-note').fill('A very long illustrative bill name with more details');await page.locator('#repeating-amount').fill('1234567.89');
 await capture('bill-draft');
 await page.locator('.calendar-stage').getByRole('button',{name:'Cancel',exact:true}).click();
 receipt.draftCancel=await page.getByRole('button',{name:'Add repeating',exact:true}).isVisible();
 await tab('Calendar');await page.setViewportSize({width:390,height:1000});
 return receipt;
}
