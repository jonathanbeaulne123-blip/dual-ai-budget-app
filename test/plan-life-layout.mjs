/** Actual Plan + conversational components; fixture server serves fictional books only. */
import { startPlanLifeProof } from '../scripts/serve-plan-life-proof.mjs';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const output = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/plan-life');
mkdirSync(output, { recursive: true });
const proof = await startPlanLifeProof({port:0});
const browser = await chromium.launch({ headless: true });
const records = [], errors = [];
let page;
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  page = await context.newPage();
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [390, 1440]) for (const theme of ['classic', 'taylor', 'newfoundland']) for (const view of ['personal', 'household']) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${proof.url}?theme=${theme}&view=${view}`);
    await page.getByRole('main', { name: new RegExp(view, 'i') }).waitFor();
    const sections = page.getByRole('navigation', { name: 'Plan sections' });
    // nav is a real nav landmark; all controls use accessible names.
    const nav = name => page.locator('.plan-studio__rail').getByRole('button', { name, exact: true });
    const navigate=async name=>{const menu=page.locator('.plan-tool-menu');if(!await menu.evaluate(el=>el.open))await menu.locator('summary').click();await nav(name).click();};
    await navigate('Protect');
    await page.getByRole('heading', { name: 'Rehearse a difficult month' }).waitFor();
    await page.getByLabel('Unexpected cost (CAD)').fill('5000');
    assert.match(await page.locator('.plan-experiment').innerText(), /first needs/);
    await page.getByRole('button', { name: 'Restore the baseline' }).click();
    await page.getByRole('button', { name: 'Edit / link evidence' }).first().click();
    const editor = page.locator('.plan-decision-editor');
    await editor.getByLabel('Amount this month (CAD)').fill('950');
    await editor.getByRole('button', { name: 'Save to private draft' }).click();
    await editor.waitFor({ state: 'hidden' });
    assert.match(await page.locator('.plan-decision-cards').innerText(), /950\.00/);
    await navigate('Prepare');
    await page.getByRole('heading', { name: 'What are we forgetting?' }).waitFor();
    assert.match(await page.locator('.plan-path').innerText(), /150\.00 per payday/);
    await page.getByRole('button', { name: 'Use this month’s payday contributions in my draft' }).click();
    await page.locator('.plan-discovery select').selectOption('vehicle');
    await page.getByRole('button', { name: 'Seasonal tires and service · explore' }).click();
    await page.getByLabel('What is this for?', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await navigate('Build');
    await page.getByRole('heading', { name: 'Rehearse a different life' }).waitFor();
    await page.getByRole('button', { name: 'Compare a smaller monthly contribution' }).click();
    await page.getByRole('heading', { name: 'Compare the consequence, then choose' }).waitFor();
    assert.match(await page.locator('.plan-comparison').innerText(), /Working draft/);
    await page.getByRole('button', { name: 'Edit build', exact: true }).click();
    await page.getByRole('button', { name: 'Edit / link evidence' }).click();
    await editor.getByLabel('Contribution this month (CAD)').fill('160');
    await editor.getByRole('button', { name: 'Save to private draft' }).click();
    await editor.waitFor({ state: 'hidden' });
    await navigate('Scenarios');
    await page.getByRole('button', { name: /Bring this alternative into draft review/ }).click();
    await navigate('Everyday');
    await page.getByLabel('Purchase or experience (CAD)').fill('120');
    assert.match(await page.locator('.plan-purchase-result').innerText(), /fits the visible commitments/);
    await page.getByLabel('Purchase or experience (CAD)').fill('99999');
    assert.match(await page.locator('.plan-purchase-result').innerText(), /needs a choice/);
    await page.getByLabel('Purchase or experience (CAD)').fill('120');
    await page.screenshot({ path: join(output, `${theme}-${view}-${width}-everyday.png`), fullPage: true });
    await navigate('Learn');
    assert.ok((await page.locator('.plan-lesson').innerText()).length > 350);
    await navigate('Bridge');
    await page.getByLabel('What I choose to share').selectOption('constraint');
    await page.getByLabel('One fact I may share').fill('Friday evenings stay free');
    await page.getByRole('button', { name: 'Save privately and review' }).click();
    await page.getByText('Exact disclosure review', { exact: true }).waitFor();
    await navigate('Sitdown');
    await page.getByLabel('Your private preparation').fill('Fictional private note retained');
    await page.getByRole('button', { name: 'Save preparation privately' }).click();
    if (view === 'household') {
      await page.getByLabel('A decision to carry forward').fill('Get two quotes');
      await page.getByLabel('One practical rhythm for this Chapter').fill('Ten minutes on Sundays');
      await page.getByRole('button', { name: 'Save and continue' }).click();
      await page.getByRole('heading', { name: 'Notice', exact: true }).waitFor();
      await navigate('Overview'); await navigate('Sitdown');
      assert.equal(await page.getByLabel('One practical rhythm for this Chapter').inputValue(), 'Ten minutes on Sundays');
    }
    await navigate('Reflection');
    await navigate('Overview');
    // Conversation handoff keeps the full composer and a bounded editable action.
    assert.equal(await page.locator('.plan-tool-menu').evaluate(el=>el.open), false);
    assert.equal(await page.locator('.plan-studio input:visible, .plan-studio textarea:visible, .plan-studio select:visible').count(), 0);
    await page.screenshot({path:join(output, `${theme}-${view}-${width}-quiet-overview.png`),fullPage:true});
    await page.getByRole('button', { name: 'Help me create a plan', exact:true }).click();
    const guide=page.getByRole('region',{name:'Plan conversation'});
    const composer=page.getByRole('textbox', {name:/Ask Hercules/}).filter({visible:true});
    await guide.getByRole('heading',{name:/What would make this month/}).waitFor();
    const say=async text=>{await composer.fill(text);await composer.press('Enter');};
    await say('A calmer week');
    await guide.getByRole('heading',{name:/future money/}).waitFor();
    await page.screenshot({path:join(output, `${theme}-${view}-${width}-guided-question.png`),fullPage:true});
    await guide.getByRole('button',{name:'Pause planning',exact:true}).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button',{name:'Continue planning with Hercules',exact:true}).evaluate(el=>el===document.activeElement),true);
    await page.getByRole('button',{name:'Continue planning with Hercules',exact:true}).click();
    await guide.getByRole('heading',{name:/future money/}).waitFor();
    await guide.getByRole('button',{name:'Continue without adding expected money'}).click();
    for(const text of [/Which bills/,/future cost/,/one thing/]){
      await guide.getByRole('heading',{name:text}).waitFor();
      await guide.getByRole('button',{name:'Keep this open for now',exact:true}).click();
    }
    await guide.getByRole('heading',{name:/ordinary spending/}).waitFor();
    await guide.getByRole('combobox').selectOption('unlinked');
    await guide.getByRole('heading',{name:/allowance cover/}).waitFor();
    await say('Fictional weekend pleasures');
    await guide.getByRole('heading',{name:/How much room/}).waitFor();
    await say('$75');
    await guide.getByRole('heading',{name:/From what date/}).waitFor();
    await say('2026-09-20');
    await guide.getByRole('heading',{name:/leave room for/}).waitFor();
    await say('Keep Friday evenings free');
    await page.getByRole('button',{name:'Review changes',exact:true}).filter({visible:true}).click();
    await page.getByRole('heading',{name:'Check your changes',exact:true}).waitFor();
    assert.match(await page.locator('.hercules-action-card:visible').innerText(),/Fictional weekend pleasures/);
    const guideAxe=await new AxeBuilder({page}).include('.hercules-actions').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(guideAxe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
    await page.screenshot({path:join(output, `${theme}-${view}-${width}-guided-review.png`),fullPage:true});
    await page.getByRole('button',{name:'Final Confirm',exact:true}).filter({visible:true}).click();
    await page.getByText(/Saved[.]/).filter({visible:true}).first().waitFor();
    if(width>=1100)await page.locator('.hercules-dismiss:visible').click();else await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelector('.plan-conversation-invitation button')===document.activeElement,{},{timeout:5000});
    await navigate('Everyday');
    await page.locator('.plan-decision-cards').getByRole('heading',{name:'Fictional weekend pleasures',exact:true}).waitFor();
    await navigate('Overview');
    // Focus and layout across every lens, including appended controls.
    const checks = [];
    for (const lens of ['Protect', 'Prepare', 'Build', 'Everyday']) {
      await navigate(lens);
      const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, minButton: Math.min(...[...document.querySelectorAll('.plan-studio button')].filter(node => node.getBoundingClientRect().width && node.getBoundingClientRect().height).map(node => node.getBoundingClientRect().height)) }));
      assert.ok(geometry.scrollWidth <= width + 1, JSON.stringify({ width, theme, view, lens, geometry }));
      assert.ok(geometry.minButton >= 43.5, JSON.stringify({ width, theme, view, lens, geometry }));
      const axe = await new AxeBuilder({ page }).include('.plan-studio').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      assert.deepEqual(axe.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), [], JSON.stringify({ width, theme, view, lens }));
      checks.push({ lens, ...geometry, axeViolations: 0 });
    }
    await page.keyboard.press('Tab');
    const focusVisible = await page.evaluate(() => { const node = document.activeElement, style = getComputedStyle(node); return node !== document.body && style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0; });
    assert.equal(focusVisible, true);
    records.push({ width, theme, view, checks, focusVisible });
    console.log(`PASS ${theme} ${view} ${width}`);
  }
  for (const width of [320, 720, 1100, 1920]) {
    await page.setViewportSize({ width, height: 1000 }); await page.goto(`${proof.url}?theme=taylor&view=household`);
    await page.locator('.plan-studio').waitFor();
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(scroll <= width + 1, `Boundary width ${width} overflow ${scroll}`);
  }
  assert.deepEqual(errors, []);
} catch (error) {
  if (page) { writeFileSync(join(output, "failure.txt"), await page.locator("body").innerText()); await page.screenshot({ path: join(output, "failure.png"), fullPage: true }); }
  throw error;
} finally {
  writeFileSync(join(output, 'report.json'), JSON.stringify({ records, errors }, null, 2));
  await browser.close();
  await proof.close();
}
