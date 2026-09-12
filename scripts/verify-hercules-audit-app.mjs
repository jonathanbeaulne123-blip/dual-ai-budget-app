import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = 'http://127.0.0.1:5192', out = process.env.HEARTH_ARTIFACTS_DIR || '/tmp/hercules-audit-app';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true }), records = [], errors = [];
try {
  for (const theme of process.env.PROOF_THEME ? [process.env.PROOF_THEME] : ['classic', 'taylor', 'newfoundland'])
  for (const view of ['household', 'personal'])
  for (const width of process.env.PROOF_WIDTH ? [Number(process.env.PROOF_WIDTH)] : [320, 390, 720, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.route('**/*', r => r.request().url().startsWith(base) || r.request().url().startsWith('data:') ? r.continue() : r.abort());
    for (const file of ['pglite.data', 'initdb.wasm', 'pglite.wasm']) await context.route(`**/${file}*`, r => r.fulfill({ path: `node_modules/@electric-sql/pglite/dist/${file}`, contentType: file.endsWith('wasm') ? 'application/wasm' : 'application/octet-stream' }));
    const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(String(e)));
    try {
      await page.goto(`${base}/test/browser/category-split-app.html?theme=${theme}&view=${view}`);
      await page.getByRole('button', { name: 'Add money', exact: true }).waitFor({ timeout: 90000 });
      await page.getByRole('button', { name: 'Add money', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Add expense', exact: true }).click();
      if (width < 720) await page.getByRole('button', { name: 'Type amount', exact: true }).click();
      await page.getByLabel('Amount (CAD)', { exact: true }).fill('12.50');
      await page.getByRole('button', { name: 'Ask Hercules', exact: true }).click();
      const workspace = page.getByRole('region', { name: 'Hercules workspace', exact: true });
      await workspace.waitFor();
      await workspace.getByRole('button', { name: 'Open room ↗', exact: true }).click();
      await page.locator('.hw--room').waitFor();
      if (await workspace.count() !== 1) throw new Error('More than one Workspace mounted');
      await workspace.getByRole('button', { name: 'Existing conversations & guided actions', exact: true }).click();
      await workspace.waitFor({ state: 'hidden' });
      const composer = page.locator('textarea[aria-label="Ask Hercules"]:visible');
      await composer.waitFor();
      if ((await composer.boundingBox()).width < 160) throw new Error('Conversation composer squeezed by secondary controls');
      await composer.fill('Keep this while I change rooms.');
      // Explicit handoff keeps the earlier conversation mounted privately.
      await page.getByRole('button', { name: 'Open workspace', exact: true }).click();
      await workspace.waitFor();
      if (await composer.count()) throw new Error('Legacy composer is still visible under Workspace');
      await workspace.getByRole('button', { name: 'Existing conversations & guided actions', exact: true }).click();
      await composer.waitFor();
      if (await composer.inputValue() !== 'Keep this while I change rooms.') throw new Error('Legacy composer lost across handoff');
      await page.screenshot({ path: `${out}/${theme}-${view}-${width}.png` });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Add money', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Add expense', exact: true }).click();
      if (await page.getByLabel('Amount (CAD)', { exact: true }).inputValue() !== '12.50') throw new Error('Paused Add draft lost across rooms');
      records.push({ theme, view, width, singleConversation: true, composerPreserved: true, addPausedAndRestored: true });
    } catch (error) {
      await page.screenshot({ path: `${out}/failure-${theme}-${view}-${width}.png` });
      console.log({ theme, view, width }); throw error;
    } finally { await context.close(); }
  }
} catch (e) { errors.push(String(e)); }
finally { await browser.close(); }
await writeFile(`${out}/report.json`, JSON.stringify({ records, errors }, null, 2));
console.log(JSON.stringify({ cases: records.length, errors }, null, 2));
if (errors.length) process.exitCode = 1;
