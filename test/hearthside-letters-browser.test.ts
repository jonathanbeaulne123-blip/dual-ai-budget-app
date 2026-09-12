import { afterAll, beforeAll, expect, it } from 'vitest';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { chromium, type Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
let server: Server, browser: Browser, base = '';
declare global { interface Window {
  lettersProof: { render(theme: string): void; dispose(): void; uploads: { manifest: { contentType: string; byteLength: number }; blob: Blob }[] };
  lettersObjectUrls: Set<string>;
} }
const evidence = '/tmp/hearthside-letters-proof';
beforeAll(async () => {
  const result = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: String.raw`
    import React from 'react'; import {createRoot} from 'react-dom/client'; import {Letters} from './src/hearthside/Letters.tsx';
    const scope={environment:'development',householdId:'HH-SYNTHETIC',memberId:'MEM-A',subject:'synthetic-a'};
    const content={title:'An ordinary lovely evening',text:'Thank you for the tea, the laughter, and a little time together.\n\nWe do not need a photograph to keep this day.',mediaIds:[]};
    const drafts=new Map(), uploads=[], root=createRoot(document.getElementById('root'));
    const client={snapshot:async()=>({version:1,drafts:[{version:1,id:'cloud-draft',revision:1,content,updatedAt:Date.now()}],publications:[],serverTime:Date.now(),mail:[{id:'letter',kind:'letter',state:'active',title:'For an ordinary day',role:'received',ownerMemberId:'MEM-B',recipientMemberIds:['MEM-A'],releaseAt:null,preparedAt:Date.now(),sealed:false}]}),command:async input=>input.operation==='read-publication'?{id:'letter',kind:'letter',digest:'synthetic',content,releaseAt:null,media:[]}:null,media:async()=>new Blob(),queueMedia:async(manifest,blob)=>uploads.push({manifest,blob}),resumeUploads:async()=>[],removeQueuedMedia:async()=>{}};
    const props={client,scope,roster:[{memberId:'MEM-A',name:'Alex'},{memberId:'MEM-B',name:'Sam'}],onClose:()=>{},publishReviewed:async()=>{throw Error('Synthetic read-only proof')},storage:{list:async()=>[...drafts.values()],put:async(s,d)=>drafts.set(d.id,d),remove:async(s,id)=>drafts.delete(id)}};
    if(location.search.includes('device-storage')) props.storage=undefined;
    window.lettersProof={render:theme=>root.render(<React.StrictMode><Letters {...props} theme={theme}/></React.StrictMode>),dispose:()=>root.unmount(),uploads}; window.lettersProof.render('classic');
  ` }, bundle: true, write: false, outfile: 'proof.js', platform: 'browser', format: 'iife', target: 'es2022' });
  const js = result.outputFiles.find(file => file.path.endsWith('.js'))!.text, css = result.outputFiles.find(file => file.path.endsWith('.css'))!.text;
  server = createServer((request, response) => {
    if (request.url === '/proof.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(js); }
    else { response.setHeader('Content-Type', 'text/html'); response.end(`<html lang="en"><head><title>Letters — synthetic proof</title><style>body{margin:0;font-family:system-ui,sans-serif}*{box-sizing:border-box}${css}</style></head><body><main id="root"></main><script src="/proof.js"></script></body></html>`); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Local proof server unavailable'); base = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  await mkdir(evidence, { recursive: true });
}, 60_000);
afterAll(async () => { await browser?.close(); if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
it('renders authored three-theme compositions at all required widths, with keyboard and accessible reading', async () => {
  for (const theme of ['classic', 'taylor', 'newfoundland']) {
    const context = await browser.newContext({ reducedMotion: 'reduce' }); const page = await context.newPage();
    await page.goto(base); await page.evaluate(theme => window.lettersProof.render(theme), theme);
    for (const width of [320, 390, 719, 720, 1100, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 }); await page.getByLabel('Your words', { exact: true }).waitFor();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme} ${width}px overflow`).toBe(true);
      if (width === 390 || width === 1440) {
        await page.screenshot({ path: `${evidence}/${theme}-${width}.png`, fullPage: true });
        const accessibility = await new AxeBuilder({ page }).include('.letters-room').analyze();
        expect(accessibility.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), `${theme} ${width}px accessibility`).toEqual([]);
      }
    }
    await page.getByRole('button', { name: /For an ordinary day/ }).focus(); await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'An ordinary lovely evening' }).waitFor(); expect(await page.getByText('Thank you for the tea', { exact: false }).isVisible()).toBe(true);
    await page.getByRole('button', { name: 'Back to writing' }).click();
    expect(await page.getByRole('button', { name: /For an ordinary day/ }).evaluate(el => el === document.activeElement)).toBe(true);
    await context.close();
  }
}, 90_000);
it('prepares photos without EXIF and records/plays a synthetic voice note without autoplay', async () => {
  const context = await browser.newContext({ permissions: ['microphone'] }), page = await context.newPage();
  await page.addInitScript(() => {
    const create = URL.createObjectURL, revoke = URL.revokeObjectURL; window.lettersObjectUrls = new Set();
    URL.createObjectURL = blob => { const url = create(blob); window.lettersObjectUrls.add(url); return url; };
    URL.revokeObjectURL = url => { revoke(url); window.lettersObjectUrls.delete(url); };
  });
  await page.goto(base);
  const image = await sharp({ create: { width: 2000, height: 1200, channels: 3, background: '#669999' } }).jpeg().withMetadata({ exif: { IFD0: { Artist: 'Synthetic private EXIF' } } }).toBuffer();
  await page.getByLabel('Add a photo', { exact: true }).setInputFiles({ name: 'synthetic-private.jpg', mimeType: 'image/jpeg', buffer: image });
  await page.getByText('Attachment kept privately.', { exact: false }).waitFor();
  const prepared = await page.evaluate(async () => {
    const item = window.lettersProof.uploads[0]!;
    const bytes = new Uint8Array(await item.blob.arrayBuffer()); const bitmap = await createImageBitmap(item.blob);
    const result = { type: item.manifest.contentType, length: bytes.length, metadata: new TextDecoder().decode(bytes).includes('Synthetic private EXIF'), width: bitmap.width }; bitmap.close(); return result;
  });
  expect(prepared).toMatchObject({ type: 'image/jpeg', metadata: false, width: 1600 });
  await page.getByRole('button', { name: 'Record a voice note' }).click(); await page.getByRole('button', { name: 'Stop and keep voice note' }).waitFor();
  await page.waitForTimeout(800); await page.getByRole('button', { name: 'Stop and keep voice note' }).click();
  await page.locator('audio').waitFor(); expect(await page.locator('audio').getAttribute('autoplay')).toBeNull();
  expect(await page.evaluate(() => window.lettersProof.uploads.map(item => item.manifest.contentType))).toEqual(['image/jpeg', 'audio/webm']);
  await page.evaluate(() => window.lettersProof.dispose());
  expect(await page.evaluate(() => window.lettersObjectUrls.size)).toBe(0);
  await context.close();
}, 60_000);
it('keeps large-text dark appearance usable in each theme', async () => {
  for (const theme of ['classic', 'taylor', 'newfoundland']) {
    const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 1000 } }), page = await context.newPage();
    await page.goto(base); await page.evaluate(theme => { window.lettersProof.render(theme); document.documentElement.style.fontSize = '24px'; }, theme);
    await page.getByLabel('Your words', { exact: true }).waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), theme).toBe(true);
    const accessibility = await new AxeBuilder({ page }).include('.letters-room').analyze(); expect(accessibility.violations.map(v => v.id), theme).toEqual([]);
    await page.screenshot({ path: `${evidence}/${theme}-390-dark-large.png`, fullPage: true }); await context.close();
  }
}, 60_000);
it('keeps the real device draft cache usable through StrictMode and reload', async () => {
  const context = await browser.newContext(), page = await context.newPage();
  const pageErrors: string[] = []; page.on('pageerror', error => pageErrors.push(error.message));
  page.setDefaultTimeout(8000);
  await page.goto(`${base}/?device-storage`);
  await page.getByLabel('Letter title', { exact: true }).fill('Private continuity');
  await page.getByLabel('Your words', { exact: true }).fill('These words stay with this account.');
  await expect.poll(async () => page.getByRole('status').allTextContents()).toContain('Private draft kept on this device');
  await page.reload();
  await page.getByRole('button', { name: /Private continuity/ }).click();
  expect(pageErrors).toEqual([]);
  expect(await page.locator('.letters-compose').count()).toBe(1);
  expect(await page.getByLabel('Your words', { exact: true }).inputValue()).toBe('These words stay with this account.');
  expect(await page.getByRole('alert').count()).toBe(0);
  await context.close();
}, 30_000);
