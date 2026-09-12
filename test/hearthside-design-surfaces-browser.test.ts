import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser, type Page } from '@playwright/test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import type { DesignSurfaceTheme } from '../src/hearthside/designSurfaceContracts.ts';
import type {} from './fixtures/hearthsideSurfaceProof.tsx';

describe('actual export and native surfaces in a browser', () => {
  let server: ViteDevServer, browser: Browser, page: Page, address: string;
  let cacheDir: string;
  const errors: string[] = [], artifactDirectory = process.env.HEARTH_ARTIFACTS_DIR ?? '/tmp/hearthside-surfaces-proof';
  beforeAll(async () => {
    // This middleware page has one entry. The default HTML crawl includes
    // unrelated App/Workspace fixtures and can leave their optimizer running.
    cacheDir = await mkdtemp(join(tmpdir(), 'hearthside-surfaces-vite-'));
    const startedAt = performance.now();
    server = await createServer({ configFile: false, root: process.cwd(), cacheDir, optimizeDeps: { entries: ['test/fixtures/hearthsideSurfaceProof.tsx'] }, esbuild: { jsx: 'automatic' }, logLevel: 'error', server: { host: '127.0.0.1', port: 0 }, plugins: [{ name: 'hearthside-surfaces-proof', configureServer(vite) {
      vite.middlewares.use('/__hearthside_surfaces', (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Hearthside local synthetic surface proof</title><style>body{margin:0;background:#e5ddd0;font-family:system-ui}main{padding:16px 10px 180px}nav{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:0 auto 24px;max-width:1300px}nav button{min-height:44px;padding:8px 14px}nav span{font-size:13px}</style></head><body><div id="root"></div><script type="module" src="/test/fixtures/hearthsideSurfaceProof.tsx"></script></body></html>'); });
    } }] });
    await server.listen(); address = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}/__hearthside_surfaces`;
    browser = await chromium.launch({ channel: 'chrome', headless: true }); page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.on('pageerror', error => errors.push(error.message));
    await mkdir(artifactDirectory, { recursive: true }); await page.goto(address); await page.getByRole('button', { name: 'Open export', exact: true }).waitFor();
    await writeFile(`${artifactDirectory}/startup.json`, JSON.stringify({ coldStartupMs: Math.round(performance.now() - startedAt), entry: 'hearthsideSurfaceProof.tsx', errors }, null, 2));
  }, 60_000);
  afterAll(async () => { await browser?.close(); await server?.close(); if (cacheDir) await rm(cacheDir, { recursive: true, force: true }); });
  beforeEach(async () => { await page.goto(address); await page.getByRole('button', { name: 'Open export', exact: true }).waitFor(); });

  it('keeps all three authored treatments readable at every required width and enlarged text', async () => {
    await page.getByRole('button', { name: 'Open export', exact: true }).click();
    for (const theme of ['classic', 'taylor', 'newfoundland'] as DesignSurfaceTheme[]) {
      await page.evaluate(theme => window.hearthsideSurfaceProof.patch({ theme }), theme);
      for (const width of [320, 390, 719, 720, 1100, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForFunction(() => document.querySelector('section.design-surface') !== null);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${theme} at ${width}px`).toBe(true);
        const controls = await page.locator('.design-surface button, .design-surface input, .design-surface select').evaluateAll(els => els.map(el => ({ w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height })));
        expect(controls.every(control => control.w >= 44 && control.h >= 44)).toBe(true);
      }
      await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: `${artifactDirectory}/${theme}-phone.png`, fullPage: true });
      await page.evaluate(() => document.documentElement.style.fontSize = '200%'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.evaluate(() => document.documentElement.style.fontSize = '');
      await page.emulateMedia({ colorScheme: 'dark' });
      const ratios = await page.locator('.design-surface button').evaluateAll(buttons => buttons.map(button => {
        const channels = (color: string) => color.match(/[\d.]+/g)!.map(Number);
        const luminance = (color: string) => channels(color).slice(0, 3).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i]!, 0);
        let element: Element | null = button, background = 'rgb(255, 255, 255)';
        while (element) { const candidate = getComputedStyle(element).backgroundColor, values = channels(candidate); if (values.length === 3 || values[3] !== 0) { background = candidate; break; } element = element.parentElement; }
        const a = luminance(getComputedStyle(button).color), b = luminance(background); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      }));
      expect(ratios.every(ratio => ratio >= 4.5), `${theme} dark control text`).toBe(true);
      await page.emulateMedia({ colorScheme: 'light' });
    }
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.screenshot({ path: `${artifactDirectory}/newfoundland-desktop.png`, fullPage: true });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' }); await page.screenshot({ path: `${artifactDirectory}/newfoundland-dark.png`, fullPage: true });
    expect(await page.getByRole('button', { name: 'Check this piece' }).isEnabled()).toBe(true); await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  });

  it('runs actual capture, worker review and a user-downloaded verified package', async () => {
    await page.getByRole('button', { name: 'Open export', exact: true }).click();
    await page.getByLabel('Height, in millimetres').fill('120');
    await page.getByRole('button', { name: 'Check this piece' }).click();
    await page.getByRole('region', { name: 'Review production files' }).waitFor({ timeout: 60_000 });
    expect(await page.getByRole('button', { name: 'Create production package' }).isDisabled()).toBe(true);
    await page.getByLabel('I have reviewed the checks', { exact: false }).check();
    await page.getByRole('button', { name: 'Create production package' }).click();
    await page.getByRole('link', { name: /Download production package/ }).waitFor({ timeout: 120_000 });
    const count = await page.evaluate(() => window.hearthsideSurfaceProof.urls.length); expect(count).toBe(1);
    const waiting = page.waitForEvent('download'); await page.getByRole('link', { name: /Download production package/ }).click(); const download = await waiting;
    const archive = unzipSync(new Uint8Array(await readFile((await download.path())!)));
    expect(download.suggestedFilename()).toBe('Hearthside-synthetic-cat-r12.zip'); expect(Object.keys(archive)).toEqual(expect.arrayContaining(['kitty.stl', 'kitty.3mf', 'kitty.glb', 'paint/source-paint.json', 'geometry-sheet.pdf', 'manifest.json']));
    const manifest = JSON.parse(new TextDecoder().decode(archive['manifest.json']!)); expect(manifest.heightMm).toBe(120); expect(manifest.designRevision).toBe(12); expect(manifest.report.printerReady).toBe(false); expect(manifest.repair).toBeNull();
    expect(new TextDecoder().decode(archive['source-design.json']!)).not.toMatch(/synthetic-house|synthetic-member/);
    await page.screenshot({ path: `${artifactDirectory}/production-package-ready.png`, fullPage: true });
    await page.evaluate(() => window.hearthsideSurfaceProof.patch({ theme: 'taylor' })); expect(await page.getByLabel('Height, in millimetres').inputValue()).toBe('120'); expect(await page.getByRole('link', { name: /Download production package/ }).count()).toBe(1);
    await page.evaluate(() => window.hearthsideSurfaceProof.patch({ householdId: 'other-synthetic-house', revision: 13 }));
    await page.getByText('Selected design · revision 13').waitFor(); expect(await page.getByRole('link', { name: /Download production package/ }).count()).toBe(0); expect(await page.evaluate(() => window.hearthsideSurfaceProof.revoked.length)).toBe(1);
  }, 180_000);

  it('requires exact repair approval, cancels the actual worker, and returns keyboard focus', async () => {
    await page.getByRole('button', { name: 'Open export', exact: true }).click();
    await page.getByLabel('Construction', { exact: true }).selectOption('hollow'); await page.getByRole('button', { name: 'Check this piece' }).click();
    await page.getByRole('region', { name: 'Review production files' }).waitFor({ timeout: 60_000 });
    await page.getByLabel('I have reviewed the checks', { exact: false }).check(); expect(await page.getByRole('button', { name: 'Create production package' }).isDisabled()).toBe(true);
    await page.getByLabel('I approve these exact changes', { exact: false }).check(); expect(await page.getByRole('button', { name: 'Create production package' }).isEnabled()).toBe(true);
    await page.getByRole('button', { name: 'Create production package' }).click(); await page.getByRole('button', { name: 'Cancel preparation' }).click();
    expect(await page.getByRole('region', { name: 'Review production files' }).count()).toBe(0); expect(await page.getByRole('link', { name: /Download production package/ }).count()).toBe(0);
    await page.getByLabel('Height, in millimetres').focus(); await page.keyboard.press('Escape'); await page.locator('.design-surface').waitFor({ state: 'detached' });
    // This scope remount preserved its own opener. A fresh direct entry returns to
    // its actual toolbar button under React StrictMode.
    await page.getByRole('button', { name: 'Open export', exact: true }).click(); await page.getByRole('heading', { level: 2 }).waitFor();
    expect(await page.getByRole('heading', { level: 2 }).evaluate(el => el === document.activeElement)).toBe(true); await page.keyboard.press('Escape');
    expect(await page.getByRole('button', { name: 'Open export', exact: true }).evaluate(el => el === document.activeElement)).toBe(true);
  }, 90_000);

  it('provides a truthful browser fallback and revokes its model when the flag closes', async () => {
    await page.getByRole('button', { name: 'Open AR', exact: true }).click(); await page.getByText('The Hearth companion adds live interactions', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Prepare a 3D model file' }).click(); await page.getByRole('link', { name: 'Download the selected GLB model' }).waitFor({ timeout: 30_000 });
    expect(await page.getByText('Current backing is unavailable.', { exact: false }).count()).toBe(1);
    const proof = await page.evaluate(() => ({ opened: window.hearthsideSurfaceProof.opened.length, urls: window.hearthsideSurfaceProof.urls.length, revoked: window.hearthsideSurfaceProof.revoked.length })); expect(proof.opened).toBe(0);await page.locator('model-viewer').waitFor();await page.waitForFunction(()=>Boolean((document.querySelector('model-viewer') as HTMLElement&{loaded:boolean})?.loaded));expect(await page.locator('model-viewer').getAttribute('ar-modes')).toBe('webxr quick-look');expect(await page.locator('model-viewer').getAttribute('src')).toMatch(/^blob:/);await page.locator('model-viewer').focus();await page.keyboard.press('ArrowRight');
    await page.evaluate(() => window.hearthsideSurfaceProof.patch({ enabled: false })); await page.getByText('Interactive AR is not enabled', { exact: false }).waitFor();
    expect(await page.getByRole('link', { name: 'Download the selected GLB model' }).count()).toBe(0); expect(await page.evaluate(() => window.hearthsideSurfaceProof.revoked.length)).toBe(proof.revoked + 1);
  });

  it('opens actual canonical meshes through the native controller and delegates coin intent to review only', async () => {
    await page.evaluate(() => window.hearthsideSurfaceProof.patch({ enabled: true, native: true, surface: 'native' })); await page.getByRole('button', { name: 'Place this cat in my room' }).click();
    await page.getByText('Your interactive AR room is open.', { exact: false }).waitFor({ timeout: 30_000 });
    const capture = await page.evaluate(() => { const p = window.hearthsideSurfaceProof; const scene = p.opened.at(-1)!.scene; return { height: Math.max(...scene.meshes.flatMap(mesh => mesh.positions.filter((_, i) => i % 3 === 1))), count: scene.meshes.length, textures: scene.meshes.filter(mesh => mesh.texturePng).length, backing: scene.backing, listeners: p.listeners.size }; });
    expect(capture.height).toBeCloseTo(.16); expect(capture.count).toBeLessThanOrEqual(64); expect(capture.textures).toBeGreaterThanOrEqual(6); expect(capture.backing).toEqual({ status: 'unavailable' }); expect(capture.listeners).toBe(1);
    await page.evaluate(() => { window.hearthsideSurfaceProof.emit('funding-intent', { eventId: 'coin-1' }); window.hearthsideSurfaceProof.emit('funding-intent', { eventId: 'coin-1' }); });
    await page.getByRole('button', { name: 'Return to AR' }).waitFor(); expect(await page.evaluate(() => window.hearthsideSurfaceProof.intents.length)).toBe(1); expect(await page.evaluate(() => window.hearthsideSurfaceProof.updates.length)).toBe(0);
    await page.evaluate(() => { const p = window.hearthsideSurfaceProof; p.patch({ receipt: { identity: p.opened.at(-1)!.scene.identity, receiptId: 'accepted-1', backing: { status: 'available', step: 4 }, kind: 'contribution', status: 'accepted' } }); });
    await page.waitForFunction(() => window.hearthsideSurfaceProof.updates.length === 1);
    await page.getByRole('button', { name: 'Return to AR' }).click(); expect(await page.evaluate(() => window.hearthsideSurfaceProof.resumed.length)).toBe(1);
    await page.evaluate(() => window.hearthsideSurfaceProof.emit('background')); await page.getByRole('button', { name: 'Return to AR' }).waitFor();
    await page.evaluate(() => { window.hearthsideSurfaceProof.emit('tracking', { state: 'lost' }); }); await page.getByText('Move the phone gently', { exact: false }).waitFor();
    await page.evaluate(() => window.hearthsideSurfaceProof.patch({ householdId: 'last-synthetic-house' })); await page.getByRole('button', { name: 'Place this cat in my room' }).waitFor();
    await page.waitForFunction(() => window.hearthsideSurfaceProof.listeners.size === 0); await page.evaluate(() => window.hearthsideSurfaceProof.emit('funding-intent', { eventId: 'late-coin' }));
    expect(await page.evaluate(() => window.hearthsideSurfaceProof.intents.length)).toBe(1); expect(await page.evaluate(() => window.hearthsideSurfaceProof.closed.length)).toBeGreaterThan(0);
    await page.evaluate(() => window.hearthsideSurfaceProof.denyCamera = true); await page.getByRole('button', { name: 'Place this cat in my room' }).click(); await page.getByText('Camera access was declined.', { exact: false }).waitFor();
    expect(errors).toEqual([]);
  }, 90_000);
});
