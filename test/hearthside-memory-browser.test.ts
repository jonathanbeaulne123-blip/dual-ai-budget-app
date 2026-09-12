import { afterAll, beforeAll, expect, it } from 'vitest';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { chromium, type Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
let browser: Browser, server: Server, base = '';
declare global { interface Window {
  memoryProof: { render(theme: string, member?: string): void; dispose(): void; loseCopy(): void; loseActivation(): void; hold(kind: 'review' | 'compose'): void; held(): boolean; release(): void; changeCandidate(): void; calls(): { operation: string; id?: string; input?: { id?: string } }[]; shared(): unknown; uploads: { blob: Blob }[] };
  memoryObjectUrls: Set<string>;
} }
const proof = '/tmp/hearthside-memory-proof';
beforeAll(async () => {
  const photo = await sharp({ create: { width: 360, height: 240, channels: 3, background: '#608a86' } }).jpeg().toBuffer();
  const result = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react';import{createRoot}from'react-dom/client';import{MemoryPublication}from'./src/hearthside/MemoryPublication.tsx';
    import{memoryCompositionDigest}from'./src/hearthside/memoryPublication.ts';
    const bytes=Uint8Array.from(atob(${JSON.stringify(photo.toString('base64'))}),c=>c.charCodeAt(0));const blob=new Blob([bytes],{type:'image/jpeg'});
    let actor='MEM-A',theme='classic',loseCopy=false,loseActivation=false;const uploads=[],root=createRoot(document.getElementById('root'));
    const original=()=>({version:1,id:'MEMORY-SYNTHETIC',revision:1,title:'A little time together',date:null,experienceId:null,media:[{version:1,contentId:'own-photo',revision:1,kind:'image',alt:'A synthetic teal square for this local proof'}],designs:[],recollections:[{memberId:actor,text:'A slow morning, warm tea, and room for our own words.'}],hideAmounts:true,approvals:[],withdrawn:false});
    let current=JSON.parse(localStorage.getItem('memory-proof-draft')||'null')||original(),canonical=JSON.parse(localStorage.getItem('memory-proof-canonical')||'null');
    let held=null;const pause=async kind=>{if(held?.kind===kind){held.entered=true;await held.wait;}};
    const reviews=JSON.parse(localStorage.getItem('memory-proof-reviews')||'{}'),calls=JSON.parse(localStorage.getItem('memory-proof-calls')||'[]');
    const save=()=>{localStorage.setItem('memory-proof-draft',JSON.stringify(current));localStorage.setItem('memory-proof-canonical',JSON.stringify(canonical));localStorage.setItem('memory-proof-reviews',JSON.stringify(reviews));localStorage.setItem('memory-proof-calls',JSON.stringify(calls));};
    const manifest=id=>({id,contentType:'image/jpeg',sha256:'b'.repeat(64),byteLength:bytes.length,status:'uploaded'});
    const client={snapshot:async()=>({mail:[{id:'private-source-letter',kind:'letter',state:'active',title:'A private letter with one attachment',sealed:false}]}),
      command:async input=>{calls.push(input);save();
        if(input.operation==='read-publication')return{media:[manifest('private-photo')],content:{text:'Private letter words never enter the memory'}};
        if(input.operation==='copy-media'){const m=manifest(input.input.id);if(loseCopy){loseCopy=false;throw Error('Lost copy acknowledgement');}return{...m,copySource:{publicationId:'private-source-letter'},owner:{subject:'private-actor-subject'}};}
        if(input.operation==='prepare-memory'){const v=input.input,digest=await memoryCompositionDigest(v.candidate);const r={version:1,id:v.id,ownerMemberId:actor,recipientMemberIds:['MEM-A','MEM-B'],digest:'a'.repeat(64),state:'prepared',memory:{composition:v.candidate,compositionDigest:digest,expectedRevision:v.expectedRevision},binding:{version:1,publicationId:v.id,publicationDigest:'a'.repeat(64),memoryId:v.candidate.id,memoryRevision:v.candidate.revision,compositionDigest:digest},media:v.candidate.media.map(m=>manifest(m.contentId)),approvedMemberIds:[]};reviews[v.id]=reviews[v.id]||r;save();return structuredClone(reviews[v.id]);}
        const r=reviews[input.id];if(!r||r.state==='revoked')throw Error('NOT_FOUND');
        if(input.operation==='review-memory'){if(canonical?.publication?.publicationId!==r.id||await memoryCompositionDigest(canonical)!==r.binding.compositionDigest)throw Error('MEMORY_CHANGED');const reviewed=structuredClone(r);await pause('review');return reviewed;}
        if(input.operation==='approve'){if(input.digest!==r.digest)throw Error('COMPOSITION_CHANGED');if(!r.approvedMemberIds.includes(actor))r.approvedMemberIds.push(actor);save();return{};}
        if(input.operation==='activate'){if(canonical.approvals.length!==2)throw Error('APPROVAL_REQUIRED');r.state='active';save();if(loseActivation){loseActivation=false;throw Error('Lost activation acknowledgement');}return{version:1,publicationId:r.id,digest:r.digest,state:'active',memory:r.binding};}
        if(input.operation==='withdraw'){r.state='revoked';save();return{version:1,publicationId:r.id,digest:r.digest,state:'revoked',memory:r.binding};}
        throw Error(input.operation);
      },media:async()=>blob,queueMedia:async(manifest,blob)=>uploads.push({manifest,blob}),resumeUploads:async()=>[]};
    function render(){const scope={environment:'development',householdId:'HH-SYNTHETIC',memberId:actor,subject:actor==='MEM-A'?'synthetic-a':'synthetic-b'};
      root.render(<React.StrictMode><MemoryPublication client={client} scope={scope} theme={theme} candidate={current} roster={[{memberId:'MEM-A',name:'Alex'},{memberId:'MEM-B',name:'Sam'}]} editable={!canonical}
        onChange={value=>{current=value;save();render();}} compose={async value=>{canonical=structuredClone(value);current=structuredClone(value);save();render();await pause('compose');return true;}}
        keep={async binding=>{const r=reviews[binding.publicationId];if(!r.approvedMemberIds.includes(actor))throw Error('APPROVAL_REQUIRED');canonical.approvals=[...canonical.approvals.filter(a=>a.memberId!==actor),{memberId:actor,revision:canonical.revision}];current=structuredClone(canonical);save();render();return true;}}
        withdraw={async()=>{canonical.withdrawn=true;canonical.approvals=[];current=structuredClone(canonical);save();render();return true;}}/></React.StrictMode>);}
    window.memoryProof={render:(next,member)=>{theme=next;if(member&&member!==actor){actor=member;current=canonical?structuredClone(canonical):original();}render();},dispose:()=>root.unmount(),loseCopy:()=>{loseCopy=true;},loseActivation:()=>{loseActivation=true;},hold:kind=>{let release;const wait=new Promise(resolve=>release=resolve);held={kind,wait,release,entered:false};},held:()=>Boolean(held?.entered),release:()=>{held?.release();held=null;},changeCandidate:()=>{const{publication,...next}=current;current={...next,revision:current.revision+1,title:'A changed composition',approvals:[]};save();render();},calls:()=>calls,shared:()=>canonical,uploads};render();
  ` }, bundle: true, write: false, outfile: 'memory-proof.js', platform: 'browser', format: 'iife', target: 'es2022' });
  const js = result.outputFiles.find(f => f.path.endsWith('.js'))!.text, css = result.outputFiles.find(f => f.path.endsWith('.css'))!.text;
  server = createServer((request, response) => {
    if (request.url === '/memory-proof.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(js); }
    else { response.setHeader('Content-Type', 'text/html'); response.end(`<html lang="en"><head><title>Memory — synthetic local proof</title><style>body{margin:0;padding:12px;font-family:system-ui,sans-serif}*{box-sizing:border-box}${css}</style></head><body><main><h2>Our memory</h2><div id="root"></div></main><script src="/memory-proof.js"></script></body></html>`); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('Local proof unavailable'); base = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true }); await mkdir(proof, { recursive: true });
}, 60_000);
afterAll(async () => { await browser?.close(); if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
it('rejects a stale compose acknowledgement or manual review after the same memory candidate changes', async () => {
  for (const kind of ['compose', 'review'] as const) {
    const context = await browser.newContext(), page = await context.newPage();
    try {
      await page.goto(base);
      if (kind === 'review') {
        await page.getByRole('button', { name: 'Share this composition for us to review' }).click();
        await page.getByRole('heading', { name: 'We each choose this whole composition' }).waitFor();
      }
      await page.evaluate(kind => window.memoryProof.hold(kind), kind);
      await page.getByRole('button', { name: kind === 'compose' ? 'Share this composition for us to review' : 'Refresh our choices', exact: true }).click();
      await expect.poll(() => page.evaluate(() => window.memoryProof.held())).toBe(true);
      await page.evaluate(() => window.memoryProof.changeCandidate());
      await page.getByRole('heading', { name: 'We each choose this whole composition' }).waitFor({ state: 'hidden' });
      await page.evaluate(() => window.memoryProof.release());
      await page.getByRole('alert').filter({ hasText: 'This memory or its audience changed.' }).waitFor({ timeout: 5000 });
      expect(await page.getByRole('button', { name: 'Keep this exact version', exact: true }).count()).toBe(0);
      expect(await page.getByText('This exact composition is ready for each of us to review and keep.', { exact: true }).count()).toBe(0);
      expect(await page.evaluate(() => window.memoryProof.calls().filter(c => c.operation === 'approve' || c.operation === 'activate'))).toEqual([]);
    } finally { await context.close(); }
  }
}, 30000);
it('renders the exact shared review in all themes and required widths with keyboard and accessibility proof', async () => {
  for (const theme of ['classic', 'taylor', 'newfoundland']) {
    const context = await browser.newContext({ reducedMotion: 'reduce' }), page = await context.newPage();
    await page.goto(base); await page.evaluate(theme => window.memoryProof.render(theme), theme);
    await page.getByRole('button', { name: 'Share this composition for us to review' }).click();
    await page.getByRole('heading', { name: 'We each choose this whole composition' }).waitFor();
    await page.getByRole('button', { name: 'Open photo', exact: false }).click(); await page.locator('.memory-attachment-view img').waitFor();
    for (const width of [320, 390, 719, 720, 1100, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme} ${width}px`).toBe(true);
      if (width === 390 || width === 1440) {
        const a11y = await new AxeBuilder({ page }).include('.memory-publication').analyze();
        expect(a11y.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), `${theme} ${width}px`).toEqual([]);
        await page.screenshot({ path: `${proof}/${theme}-${width}.png`, fullPage: true });
      }
    }
    await page.getByRole('button', { name: 'Keep this exact version', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'You chose to keep this version' }).waitFor();
    await page.evaluate(theme => window.memoryProof.render(theme, 'MEM-B'), theme);
    await page.getByRole('button', { name: 'Keep this exact version', exact: true }).click();
    await page.getByRole('button', { name: 'You chose to keep this version' }).waitFor();
    await page.evaluate(theme => window.memoryProof.render(theme, 'MEM-A'), theme);
    if (theme === 'classic') {
      await page.evaluate(() => window.memoryProof.loseActivation());
      await page.getByRole('button', { name: 'Place our kept memory' }).click();
      await page.getByRole('alert').filter({ hasText: 'same pending copy' }).waitFor();
    }
    await page.getByRole('button', { name: 'Place our kept memory' }).click(); await page.getByText('Kept by us, just as we reviewed it.').waitFor();
    if (theme === 'classic') {
      const ids = await page.evaluate(() => window.memoryProof.calls().filter(c => c.operation === 'activate').map(c => c.id));
      expect(ids).toHaveLength(2); expect(ids[0]).toBe(ids[1]);
    }
    await context.close();
  }
}, 90_000);
it('requires explicit source-copy review, restores the same IndexedDB identity after lost acknowledgement and releases Blob URLs', async () => {
  const context = await browser.newContext(), page = await context.newPage();
  await page.addInitScript(() => {
    const create = URL.createObjectURL, revoke = URL.revokeObjectURL; window.memoryObjectUrls = new Set();
    URL.createObjectURL = blob => { const url = create(blob); window.memoryObjectUrls.add(url); return url; };
    URL.revokeObjectURL = url => { revoke(url); window.memoryObjectUrls.delete(url); };
  });
  await page.goto(base); await page.getByRole('button', { name: 'Choose from my letters' }).click();
  await page.getByRole('button', { name: 'A private letter with one attachment' }).click();
  await page.getByRole('button', { name: 'Review a separate copy' }).click();
  expect(await page.getByRole('heading', { name: 'Only this attachment becomes a new copy' }).evaluate(el => el === document.activeElement)).toBe(true);
  expect(await page.evaluate(() => window.memoryProof.calls().filter(c => c.operation === 'copy-media'))).toEqual([]);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.getByRole('button', { name: 'Review a separate copy' }).evaluate(el => el === document.activeElement)).toBe(true);
  await page.getByRole('button', { name: 'Review a separate copy' }).click(); await page.evaluate(() => window.memoryProof.loseCopy());
  await page.getByRole('button', { name: 'Add this separate copy to my draft' }).click();
  await page.getByRole('alert').filter({ hasText: 'same pending copy' }).waitFor();
  const before = await page.evaluate(() => window.memoryProof.calls().find(c => c.operation === 'copy-media')!.input!.id);
  await page.reload(); await page.getByRole('button', { name: 'Retry adding this copy' }).click();
  await page.getByText('A separate copy is in your draft.', { exact: false }).waitFor();
  const after = await page.evaluate(() => window.memoryProof.calls().filter(c => c.operation === 'copy-media').map(c => c.input!.id));
  expect(after).toEqual([before, before]);
  await page.getByRole('button', { name: 'Share this composition for us to review' }).click();
  await page.getByRole('heading', { name: 'We each choose this whole composition' }).waitFor();
  const shared = await page.evaluate(() => JSON.stringify(window.memoryProof.shared()));
  expect(shared).not.toContain('private-source-letter'); expect(shared).not.toContain('private-actor-subject'); expect(shared).not.toContain('Private letter words');
  await page.getByRole('button', { name: 'Open photo', exact: false }).first().click(); await page.locator('.memory-attachment-view img').waitFor();
  await page.getByRole('button', { name: 'Withdraw this shared copy', exact: true }).click();
  await page.getByRole('button', { name: 'Withdraw this shared copy now' }).click();
  await page.getByText('This shared copy has been withdrawn.', { exact: true }).waitFor();
  expect(await page.evaluate(() => window.memoryObjectUrls.size)).toBe(0);
  await page.evaluate(() => window.memoryProof.dispose()); expect(await page.evaluate(() => window.memoryObjectUrls.size)).toBe(0);
  await context.close();
}, 60_000);
it('supports large-text dark themes and normalizes new photos before the private upload queue', async () => {
  for (const theme of ['classic', 'taylor', 'newfoundland']) {
    const context = await browser.newContext({ colorScheme: 'dark', reducedMotion: 'reduce', viewport: { width: 390, height: 1000 } }), page = await context.newPage();
    await page.goto(base); await page.evaluate(theme => { window.memoryProof.render(theme); document.documentElement.style.fontSize = '24px'; }, theme);
    await page.getByLabel('Add a photo to this memory').waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), theme).toBe(true);
    const a11y = await new AxeBuilder({ page }).include('.memory-publication').analyze(); expect(a11y.violations.map(v => v.id), theme).toEqual([]);
    await page.screenshot({ path: `${proof}/${theme}-390-dark-large.png`, fullPage: true }); await context.close();
  }
  const context = await browser.newContext(), page = await context.newPage(); await page.goto(base);
  const photo = await sharp({ create: { width: 2000, height: 1200, channels: 3, background: '#afbbcc' } }).jpeg().withMetadata({ exif: { IFD0: { Artist: 'Private memory EXIF' } } }).toBuffer();
  await page.getByLabel('Add a photo to this memory').setInputFiles({ name: 'private.jpg', mimeType: 'image/jpeg', buffer: photo });
  await page.getByText('Your photo is privately uploaded', { exact: false }).waitFor();
  expect(await page.evaluate(async () => {
    const blob = window.memoryProof.uploads[0]!.blob, bytes = new Uint8Array(await blob.arrayBuffer()), bitmap = await createImageBitmap(blob);
    const value = { type: blob.type, privateMetadata: new TextDecoder().decode(bytes).includes('Private memory EXIF'), width: bitmap.width }; bitmap.close(); return value;
  })).toEqual({ type: 'image/jpeg', privateMetadata: false, width: 1600 });
  expect(await page.evaluate(() => window.memoryProof.calls().filter(c => c.operation === 'prepare-memory'))).toEqual([]); await context.close();
}, 60_000);
