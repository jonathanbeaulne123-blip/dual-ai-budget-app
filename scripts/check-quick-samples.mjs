// Local synthetic App + worker proof. No non-local network requests are allowed.
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
const origin = process.env.HEARTH_TEST_ORIGIN || 'http://127.0.0.1:5189';
const out = process.env.HEARTH_ARTIFACTS_DIR || '/tmp/hearth-quick-samples';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
await context.route('**/*', r => new URL(r.request().url()).origin === origin && !/^\/(hercules|ledger-sync|sync|documents|bank|work)\//.test(new URL(r.request().url()).pathname) ? r.continue() : r.abort());
await context.addInitScript(() => { delete Object.getPrototypeOf(navigator).locks; });
const page = await context.newPage();
page.setDefaultTimeout(60000);
const evidence = { geometry: [], accessibility: [], errors: [] };
page.on('pageerror', error => evidence.errors.push(String(error)));
try {
  await page.goto(origin);
  evidence.worker = await page.evaluate(async () => {
    const { catalogHousehold, postEntry } = await import('/src/core/index.ts');
    const { prepareQuickSample } = await import('/src/prepareQuickSample.ts');
    const h = catalogHousehold();
    const row = postEntry(h, { date:'2026-09-11', type:'income', amount:1, accountId:'ACC-CHEQUING', subcategoryId:'SUB-INCOME-BIANCA', createdBy:'MEM-001' }).household.transactions[0];
    h.transactions = Array.from({length:2000}, (_, i) => ({...row, id:`existing-${i}`}));
    let frames = 0, longestFrame = 0, previous = performance.now(), running = true;
    const tick = now => { frames++; longestFrame = Math.max(longestFrame, now-previous); previous = now; if(running) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const start = performance.now();
    const result = await prepareQuickSample(h, { today:'2026-09-11', months:6, seed:81, memberId:'MEM-001', accountId:'ACC-CHEQUING', visibility:'household' });
    running = false;
    return { elapsedMs:performance.now()-start, frames, longestFrameMs:longestFrame, rows:result.household.transactions.length-h.transactions.length, plans:result.household.potentialExpenses.length, retained:result.household.transactions.length };
  });
  if(evidence.worker.rows!==88 || evidence.worker.plans!==84 || evidence.worker.retained!==2088 || evidence.worker.frames<5) throw Error('Worker preparation failed or did not yield interaction frames');
  const bundledWorker=(await readdir('dist/assets')).find(name=>name.startsWith('quickSample.worker-')&&name.endsWith('.js'));
  if(!bundledWorker)throw Error('Run vite build before this browser proof');
  evidence.bundledWorker=await page.evaluate(async file=>{
    const {catalogHousehold}=await import('/src/core/index.ts');
    return await new Promise((resolve,reject)=>{
      const worker=new Worker(`/dist/assets/${file}`,{type:'module'});
      const timer=setTimeout(()=>{worker.terminate();reject(Error('Built worker timed out'));},15000);
      worker.onmessage=e=>{clearTimeout(timer);worker.terminate();if(e.data.error)reject(Error(e.data.error));else resolve({rows:e.data.result.household.transactions.length,plans:e.data.result.household.potentialExpenses.length});};
      worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(Error('Built worker failed'));};
      worker.postMessage({household:catalogHousehold(),input:{today:'2026-09-11',months:3,seed:81,memberId:'MEM-001',accountId:'ACC-CHEQUING',visibility:'household'}});
    });
  },bundledWorker);
  if(evidence.bundledWorker.rows!==40 || evidence.bundledWorker.plans!==42)throw Error('Built worker row count mismatch');
  await page.evaluate(async () => {
    const { completedExistingBooksHousehold } = await import('/test/fixtures/existing-books-onboarding.ts');
    const { saveHousehold } = await import('/src/storage.ts');
    const { saveSession } = await import('/src/session.ts');
    const { financialAuditHash, addAccount } = await import('/src/core/index.ts');
    let h = completedExistingBooksHousehold('2026-09-11T12:00:00.000Z');
    h.kitchen.books.closedMonths=[];
    h = addAccount(h,{name:'Fictional Personal cash',kind:'chequing',scope:'personal',ownerMemberId:'MEM-002'}).household;
    h.booksAcceptedHash=await financialAuditHash(h);
    await saveHousehold(h,{memberId:'MEM-002',activate:true});
    saveSession('development',{householdId:h.householdId,memberId:'MEM-002',view:'household'});
  });
  await page.goto(origin);
  try { await page.locator('.app[data-books-readiness=ready]').waitFor({timeout:30000}); }
  catch(error) {
    const retry=page.getByRole('button',{name:'Retry validation',exact:true});
    if(!await retry.isVisible())throw error;
    await retry.click();
    await page.locator('.app[data-books-readiness=ready]').waitFor({timeout:60000});
    evidence.startupRetry=true;
  }
  const due=page.locator('[aria-labelledby="due-preview-title"]');if(await due.isVisible())await due.getByRole('button',{name:'Not now',exact:true}).click();
  const close=page.getByRole('button',{name:'Close reminders',exact:true});if(await close.count())await close.click();
  await page.locator('nav.nav').getByRole('button',{name:'More',exact:true}).click();
  for(const theme of ['classic','taylor','newfoundland']) {
    await page.locator(`[data-preview-theme="${theme}"]`).click();
    await page.getByRole('button',{name:'Use theme',exact:true}).click();
    for(const scope of ['household','personal']) {
      await page.locator('.view-switch button').nth(scope==='household'?0:1).click();
      const panel=page.getByTestId('quick-sample-panel');
      await panel.getByRole('combobox',{name:'Sample history'}).selectOption('6');
      for(const width of [320,390,1440]) {
        await page.setViewportSize({width,height:1000});
        await panel.scrollIntoViewIfNeeded();
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
        if(overflow)throw Error(`Page overflow: ${theme}/${scope}/${width}`);
        await page.screenshot({path:`${out}/${theme}-${scope}-${width}.png`});
        evidence.geometry.push({theme,scope,width,overflow});
      }
      const violations=(await new AxeBuilder({page}).include('[data-testid="quick-sample-panel"]').include('[data-testid="demo-suite-panel"]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
      evidence.accessibility.push({theme,scope,violations:violations.map(v=>v.id)});
      if(violations.length)throw Error(`Sample accessibility: ${JSON.stringify(violations)}`);
      await panel.getByRole('button',{name:'Quick sample data',exact:true}).click();
      const dialog=page.getByRole('dialog'); await dialog.waitFor();
      if(!(await dialog.textContent()).includes('future Calendar expenses'))throw Error('Incorrect review count');
      await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
      await panel.getByRole('button',{name:'Quick sample data',exact:true}).focus();
      await page.keyboard.press('Enter');await dialog.waitFor();
      await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
    }
  }
  evidence.cancelAndKeyboard=true;
  await page.locator('.view-switch button').nth(0).click();
  const samplePanel=page.getByTestId('quick-sample-panel');
  await samplePanel.getByRole('combobox',{name:'Sample history'}).selectOption('3');
  await samplePanel.getByRole('button',{name:'Quick sample data',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Confirm sample data',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden',timeout:60000});
  evidence.accepted=await page.evaluate(async()=>{
    const {loadHousehold}=await import('/src/storage.ts');
    const {inspectBrowserBooks}=await import('/src/ledger/engine.ts');
    const h=await loadHousehold('development');
    const inspection=await inspectBrowserBooks(h);
    return {rows:h.transactions.filter(t=>t.note.startsWith('Fictional sample')).length,plans:h.potentialExpenses.filter(p=>p.title.startsWith('Fictional sample plan')).length,booksMatch:inspection.ok};
  });
  if((evidence.accepted.rows<32||evidence.accepted.rows>48)||evidence.accepted.plans!==42||!evidence.accepted.booksMatch)throw Error('Sample Confirm did not persist matching books');
  if(evidence.errors.length) throw Error(evidence.errors.join('\n'));
  console.log(JSON.stringify(evidence));
} catch(error) {
  await page.screenshot({path:`${out}/failure.png`});
  console.error((await page.locator('body').innerText()).slice(0,5000));
  throw error;
} finally {
  await writeFile(`${out}/evidence.json`,JSON.stringify(evidence,null,2));
  await browser.close();
}
