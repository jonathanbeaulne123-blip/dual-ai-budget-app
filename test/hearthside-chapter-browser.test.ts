import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type {} from './fixtures/hearthsideChapterProof.tsx';

describe('Chapter controls in the actual browser components', () => {
  let server: ViteDevServer, browser: Browser, page: Page, address: string;
  const errors: string[] = [], directory = '/tmp/hearthside-chapters-proof';
  beforeAll(async () => {
    server = await createServer({ configFile: false, root: process.cwd(), cacheDir: 'node_modules/.hearthside-chapters-vite', esbuild: { jsx: 'automatic' }, logLevel: 'error', server: { host: '127.0.0.1', port: 0 }, plugins: [{ name: 'chapter-proof', configureServer(vite) { vite.middlewares.use('/__chapter_proof', (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html lang="en" data-theme="classic"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Local synthetic Chapter proof</title></head><body><div id="root"></div><script type="module" src="/test/fixtures/hearthsideChapterProof.tsx"></script></body></html>'); }); } }] });
    await server.listen(); address = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}/__chapter_proof`; browser = await chromium.launch({ channel: 'chrome', headless: true }); page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.on('pageerror', error => errors.push(error.message)); await mkdir(directory, { recursive: true });
  }, 30_000);
  beforeEach(async () => { errors.length = 0; await page.goto(address); await page.getByRole('heading', { name: 'Make Rent Boring' }).first().waitFor(); });
  afterAll(async () => { await browser?.close(); await server?.close(); });
  it('reviews a Ritual, takes its one Task, completes it, pauses only self, and closes the exact Chapter together', async () => {
    expect(await page.getByRole('button', { name: 'Prepare this occurrence' }).count()).toBe(0);
    await page.getByLabel('Current participant').selectOption('MEM-002'); await page.getByRole('button', { name: 'I agree to these Ritual terms' }).click();
    await page.getByLabel('Current participant').selectOption('MEM-001'); await page.getByRole('button', { name: 'Prepare this occurrence' }).click(); await page.getByRole('button', { name: 'Take this occurrence' }).click();
    await page.getByRole('region', { name: 'This Ritual occurrence' }).getByRole('button', { name: 'Mark done' }).click();
    const done = await page.evaluate(() => window.chapterProof.household()); expect(done.tasks!.filter(task => task.chapterSource?.kind === 'ritual-occurrence' && task.completedAt)).toHaveLength(1); expect(done.rituals![0]!.heldOn).toEqual([]);
    await page.getByRole('button', { name: 'Pause my Ritual participation' }).click(); expect((await page.evaluate(() => window.chapterProof.household())).rituals![0]!.ownerMemberId).toBe('MEM-001');
    await page.getByLabel('What carries forward').fill('Our Sunday tea and two-minute check.'); await page.getByRole('button', { name: /Review: Established/ }).click();
    expect((await page.evaluate(() => window.chapterProof.household())).chapters![0]!.closure).toBeUndefined(); await page.getByRole('button', { name: 'Propose and give my closure agreement' }).click();
    expect((await page.evaluate(() => window.chapterProof.household())).chapters![0]!.state).toBe('open');
    await page.getByLabel('Current participant').selectOption('MEM-002'); await page.getByRole('button', { name: 'I agree to close this Chapter' }).click();
    expect((await page.evaluate(() => window.chapterProof.household())).chapters![0]!.state).toBe('established'); await page.getByRole('heading', { name: 'Habits holding quietly' }).waitFor(); expect(errors).toEqual([]);
  });
  it('offers real acceptance for a Move, preserves ownership when paused, and clears drafts on scope switch', async () => {
    const move = page.locator('.move-list li').first(); await move.getByRole('button', { name: 'Take this task' }).click(); await move.getByRole('button', { name: 'Pause my participation' }).click();
    let h = await page.evaluate(() => window.chapterProof.household()); expect(h.tasks![0]!.assigneeId).toBe('MEM-001'); expect(h.tasks![0]!.completedAt).toBeNull();
    await move.getByRole('button', { name: 'Resume my participation' }).click(); await move.getByRole('button', { name: 'Mark done' }).click();
    await page.getByLabel('Offer a small Move').fill('Private unsaved text from this household'); await page.getByLabel('What carries forward').fill('Only for this Chapter');
    await page.evaluate(() => { const h = window.chapterProof.household(); h.householdId = 'another-synthetic-house'; window.chapterProof.replace(h); });
    await expect.poll(() => page.getByLabel('Offer a small Move').inputValue()).toBe('');
    await expect.poll(() => page.getByLabel('What carries forward').inputValue()).toBe('');
    expect(errors).toEqual([]);
  });
  it('attaches an existing financial receipt without creating any financial activity', async () => {
    await page.evaluate(() => window.chapterProof.funded()); const before = await page.evaluate(() => window.chapterProof.household());
    await page.getByRole('button', { name: 'Propose a shared change' }).click(); await page.getByLabel('Evidence source').selectOption({ label: 'Bank · Our breathing room' }); await page.getByRole('button', { name: 'Propose and give my agreement', exact: true }).click();
    await page.getByLabel('Current participant').selectOption('MEM-002'); await page.getByRole('button', { name: 'I agree to these Ritual terms' }).click();
    await page.getByLabel('Current participant').selectOption('MEM-001'); await page.getByRole('button', { name: 'Prepare this occurrence' }).click(); await page.getByRole('button', { name: 'Take this occurrence' }).click();
    const button = page.getByRole('button', { name: 'Attach receipt and complete' }); expect(await button.isDisabled()).toBe(true); await page.getByLabel('Existing accepted evidence').selectOption({ index: 1 }); await button.click();
    const after = await page.evaluate(() => window.chapterProof.household()); expect(after.transactions).toEqual(before.transactions); expect(after.goalContributions).toEqual(before.goalContributions); expect(after.tasks!.find(task => task.chapterSource?.kind === 'ritual-occurrence')!.completionEvidence).toMatchObject({ kind: 'goal-contribution', contributionId: before.goalContributions![0]!.id }); expect(errors).toEqual([]);
  });
  it('keeps actual review and edit controls readable across all themes, widths, enlarged text and keyboard', async () => {
    await page.getByRole('button', { name: 'Propose a shared change' }).click();
    for (const theme of ['classic', 'taylor', 'newfoundland'] as const) {
      await page.evaluate(value => window.chapterProof.theme(value), theme);
      for (const width of [320,390,719,720,1100,1440,1920]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        const inaccessible = await page.locator('.chapter-ritual button,.chapter-ritual input,.chapter-ritual select,.chapter-ritual textarea').evaluateAll(elements => elements.filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1); }).length); expect(inaccessible).toBe(0);
      }
      await page.setViewportSize({ width: 390, height: 1000 }); await page.screenshot({ path: `${directory}/${theme}-phone.png`, fullPage: true });
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; window.chapterProof.theme('taylor', true); }); await page.getByLabel('Ritual action').focus(); await page.keyboard.press('Tab'); expect(await page.getByLabel('Shared cue').evaluate(el => el === document.activeElement)).toBe(true); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); expect(await page.getByRole('button', { name: 'Add a Ritual', exact: true }).evaluate(el => getComputedStyle(el).color === getComputedStyle(el).backgroundColor)).toBe(false); await page.screenshot({ path: `${directory}/dark-enlarged.png`, fullPage: true }); expect(errors).toEqual([]);
  }, 40_000);
});
