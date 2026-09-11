import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const origin = process.env.ORIGIN || 'http://127.0.0.1:5199';
const out = process.env.OUT || '/tmp/claude-0/-home-claude/1bfc372e-ec5e-520e-b7db-64ecca36352c/scratchpad/shots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const steps = JSON.parse(process.env.STEPS || '[]');
const widths = (process.env.WIDTHS || '1100').split(',').map(Number);
for (const theme of (process.env.THEMES || 'classic').split(',')) {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: Number(process.env.H) || (width < 720 ? 900 : 1000) }, reducedMotion: process.env.RM === '1' ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${origin}/scripts/fixtures/kitty-studio/index.html?theme=${theme}&view=${process.env.VIEW || 'household'}${process.env.SEED ? '&seed=' + process.env.SEED : ''}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    let i = 0;
    for (const step of steps) {
      if (step.click) { const l = page.getByRole('button', { name: step.click, exact: true }); await (step.last ? l.last() : l.first()).click(); }
      if (step.eval) await page.evaluate(step.eval);
      if (step.wait) await page.waitForTimeout(step.wait);
      if (step.key) await page.keyboard.press(step.key);
      if (step.scroll) await page.evaluate((y) => { document.querySelector('.kitty-room').scrollTop = y; }, step.scroll);
      if (step.shot) await page.screenshot({ path: `${out}/${theme}-${width}-${step.shot}.png`, fullPage: Boolean(step.full) });
      i++;
    }
    await page.screenshot({ path: `${out}/${theme}-${width}-final.png`, fullPage: process.env.FULL === '1' });
    const scroll = await page.evaluate(() => ({ w: innerWidth, sw: document.documentElement.scrollWidth, room: document.querySelector('.kitty-room')?.scrollWidth }));
    console.log(theme, width, JSON.stringify(scroll), errors.length ? errors.slice(0, 3) : 'no errors');
    await context.close();
  }
}
await browser.close();
