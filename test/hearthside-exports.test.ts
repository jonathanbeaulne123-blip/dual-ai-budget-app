import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BoxGeometry, SphereGeometry } from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { unzipSync } from 'fflate';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser, type Page } from '@playwright/test';
import { newKittyPiece } from '../src/core/kittyStudio.ts';
import { normalizeExportSelection, prepareKittyExport, finishKittyExport, zipExportFiles } from '../src/hearthside/exportKitty.ts';
import { inspectGeometry } from '../src/hearthside/exportGeometry.ts';
import type { ExportCapture, ExportMesh, ExportSelection } from '../src/hearthside/exportTypes.ts';
import { digestValue, sha256 } from '../src/hearthside/exportTypes.ts';

const decode = (v: Uint8Array) => new TextDecoder().decode(v);
const selection = (): ExportSelection => ({ version: 1, documentId: 'design-1', revision: 7, heightMm: 100, construction: 'solid', piece: newKittyPiece('piece-1', '2026-09-12T12:00:00Z') });
function cube(): ExportCapture {
  const geo = new BoxGeometry(60, 100, 60); geo.translate(0, 50, 0);
  const mesh: ExportMesh = { name: 'cube', positions: Array.from(geo.getAttribute('position').array), uv: Array.from(geo.getAttribute('uv').array), indices: Array.from(geo.index!.array), material: 0 }; geo.dispose();
  return { source: 'authored-kitty-sculpture-v1', meshes: [mesh], materials: [{ name: 'clay', color: [0.8, 0.7, 0.6, 1] }], crownY: 100, baseY: 0, crownCenter: [0, 0], baseCenter: [0, 0] };
}
function glbJson(bytes: Uint8Array) { const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); expect(view.getUint32(0, true)).toBe(0x46546c67); expect(view.getUint32(8, true)).toBe(bytes.length); return JSON.parse(decode(bytes.slice(20, 20 + view.getUint32(12, true)))); }

describe('Hearthside production files', () => {
  it('rejects unknown/accessor inputs and physical/revision mistakes without calling accessors', () => {
    let calls = 0; const bad = { ...selection(), get secret() { calls++; return 'private'; } };
    expect(() => normalizeExportSelection(bad)).toThrow('EXPORT_INVALID_INPUT'); expect(calls).toBe(0);
    expect(normalizeExportSelection({ ...selection(), revision: 0 }).revision).toBe(0);
    expect(() => normalizeExportSelection({ ...selection(), revision: -1 })).toThrow();
    expect(() => normalizeExportSelection({ ...selection(), heightMm: 0 })).toThrow();
    expect(() => normalizeExportSelection({ ...selection(), construction: 'hollow' })).toThrow();
    expect(() => normalizeExportSelection({ ...selection(), savedCents: 10000 } as ExportSelection)).toThrow();
    expect(() => normalizeExportSelection({ ...selection(), manufacturingProfile: 'maker\nnotes' })).toThrow('EXPORT_INVALID_MANUFACTURING_PROFILE');
    expect(() => normalizeExportSelection({ ...selection(), manufacturingProfile: 'Profilé français' })).toThrow('EXPORT_INVALID_MANUFACTURING_PROFILE');
    expect(() => normalizeExportSelection({ ...selection(), manufacturingProfile: ' '.repeat(301) })).toThrow('EXPORT_INVALID_MANUFACTURING_PROFILE');
  });
  it('binds an optional manufacturing profile to the exact review and downloaded record without changing geometry claims', async () => {
    const profile = 'FDM PLA, 0.4mm nozzle', withProfile = { ...selection(), manufacturingProfile: profile };
    const plain = await prepareKittyExport(selection(), cube()), prepared = await prepareKittyExport(withProfile, cube());
    expect(prepared.selectionDigest).not.toBe(plain.selectionDigest); expect(prepared.proposal.digest).not.toBe(plain.proposal.digest);
    const output = await finishKittyExport(prepared);
    expect(output.manifest.manufacturingProfile).toBe(profile); expect(output.manifest.report.printerReady).toBe(false);
    expect(decode(output.files.get('manufacturing-profile.txt')!)).toBe(profile);
    expect(JSON.parse(decode(output.files.get('source-design.json')!)).manufacturingProfile).toBe(profile);
    expect(decode(output.files.get('geometry-sheet.pdf')!)).toContain(profile);
    expect(output.manifest.files.some(file => file.name === 'manufacturing-profile.txt')).toBe(true);
  });
  it('keeps the full 300-character reviewed profile on the one-page PDF without a clipped line', async () => {
    const profile = Array.from({length: 300}, (_, index) => String.fromCharCode(65 + index % 26)).join('');
    const output = await finishKittyExport(await prepareKittyExport({ ...selection(), manufacturingProfile: profile }, cube()));
    const pdf = decode(output.files.get('geometry-sheet.pdf')!);
    expect(pdf.match(/Manufacturing profile/g)).toHaveLength(7);
    for (let start = 0; start < profile.length; start += 48) expect(pdf).toContain(profile.slice(start, start + 48));
  });
  it('reports topology and dimensions independently of format serialization', () => {
    const c = cube(), report = inspectGeometry(c.meshes);
    expect(report.watertight).toBe(true); expect(report.connectedComponents).toBe(1); expect(report.dimensionsMm).toEqual([60, 100, 60]); expect(report.signedVolumeMm3).toBeCloseTo(360000);
    const shifted = { ...c.meshes[0]!, positions: c.meshes[0]!.positions.map((n, i) => i % 3 === 0 ? n + 90 : n) };
    expect(inspectGeometry([...c.meshes, shifted]).connectedComponents).toBe(2);
    const crossing: ExportMesh = { name: 'crossing', material: 0, positions: [-1,0,0,1,0,0,0,1,0, 0,-1,-1,0,1,1,0,1,-1], indices: [0,1,2,3,4,5], uv: new Array(12).fill(0) };
    expect(inspectGeometry([crossing]).selfIntersections.status).toBe('found');
  });
  it('produces deterministic source-exact STL, structured 3MF, GLB, PDF, and hashed paint/source files', async () => {
    const s = selection(), before = JSON.stringify(s), prepared = await prepareKittyExport(s, cube());
    const a = await finishKittyExport(prepared), b = await finishKittyExport(prepared);
    expect(JSON.stringify(s)).toBe(before); expect(a.manifest).toEqual(b.manifest); expect(Object.isFrozen(a.manifest)).toBe(true);
    expect(a.manifest.sourceChanged).toBe(false); expect(a.manifest.report.printerReady).toBe(false);
    const stl = a.files.get('kitty.stl')!, geo = new STLLoader().parse(stl.buffer.slice(stl.byteOffset, stl.byteOffset + stl.byteLength) as ArrayBuffer); geo.computeBoundingBox();
    expect(geo.boundingBox!.max.z).toBe(100); expect(geo.getAttribute('position').count).toBe(36); geo.dispose();
    const threeMf = unzipSync(a.files.get('kitty.3mf')!); expect(decode(threeMf['3D/3dmodel.model']!)).toContain('unit="millimeter"'); expect(decode(threeMf['3D/3dmodel.model']!)).toContain('type="other"'); expect(threeMf['_rels/.rels']).toBeDefined();
    const glb = glbJson(a.files.get('kitty.glb')!); expect(glb.accessors[0].max[1]).toBeCloseTo(0.1);
    expect(decode(a.files.get('geometry-sheet.pdf')!).startsWith('%PDF-1.4')).toBe(true);
    expect(unzipSync(zipExportFiles(a.files))['manifest.json']).toBeDefined();
    expect(a.files.get('kitty.stl')).toEqual(b.files.get('kitty.stl')); expect(a.files.get('kitty.3mf')).toEqual(b.files.get('kitty.3mf'));
  });
  it('requires the reviewed repair digest and rejects changed source selection', async () => {
    const prepared = await prepareKittyExport(selection(), cube());
    await expect(finishKittyExport(prepared, { approvedRepairDigest: 'forged' })).rejects.toThrow('EXPORT_REPAIR_REVIEW_CHANGED');
    prepared.selection.revision++;
    await expect(finishKittyExport(prepared)).rejects.toThrow('EXPORT_SELECTION_CHANGED');
  });
  it('rejects a rewritten repair even with a recomputed digest, and ignores a forged source report', async () => {
    const prepared = await prepareKittyExport(selection(), cube());
    prepared.report.watertight = false;
    const output = await finishKittyExport(prepared);
    expect(JSON.parse(decode(output.files.get('geometry-report.json')!)).sourceReport.watertight).toBe(true);
    prepared.proposal.actions = ['Silently remove every feature'];
    const { digest: _old, ...facts } = prepared.proposal; prepared.proposal.digest = await digestValue(facts);
    await expect(finishKittyExport(prepared, { approvedRepairDigest: prepared.proposal.digest })).rejects.toThrow('EXPORT_PROPOSAL_CHANGED');
  });
  it('rejects capture accessors before structured cloning', async () => {
    let reads = 0; const captured = { ...cube(), get crownY() { reads++; return 100; } };
    await expect(prepareKittyExport(selection(), captured)).rejects.toThrow('EXPORT_INVALID_INPUT'); expect(reads).toBe(0);
  });
  it('keeps source-exact export available when a nonplanar cap requires a different repair', async () => {
    const c = cube();
    c.meshes = [{ name: 'wavy-open-box', material: 0, positions: [-20,0,-20,20,0,-20,20,0,20,-20,0,20,-20,90,-20,20,100,-20,20,90,20,-20,100,20], uv: new Array(16).fill(0), indices: [0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7] }];
    const s = selection(); s.piece.firedBy = 'private-member-id';
    const prepared = await prepareKittyExport(s, c); expect(prepared.proposal.blockers.length).toBeGreaterThan(0);
    const output = await finishKittyExport(prepared); expect(decode(output.files.get('source-design.json')!)).not.toContain('private-member-id');
    await expect(finishKittyExport(prepared, { approvedRepairDigest: prepared.proposal.digest })).rejects.toThrow('EXPORT_REPAIR_UNSUPPORTED');
  });
  it('writes an explicitly reviewed manifold manufacturing derivative and retains the authored copy', async () => {
    const prepared = await prepareKittyExport(selection(), cube()), before = JSON.stringify(prepared.capture);
    const output = await finishKittyExport(prepared, { approvedRepairDigest: prepared.proposal.digest });
    expect(JSON.stringify(prepared.capture)).toBe(before); expect(output.manifest.report.watertight).toBe(true);
    expect(decode(unzipSync(output.files.get('kitty.3mf')!)['3D/3dmodel.model']!)).toContain('type="model"'); expect(output.files.has('source-authored.glb')).toBe(true);
  });
  it('hollows real solid geometry and proves both cuts reach the cavity with mm evidence', async () => {
    const s: ExportSelection = { ...selection(), construction: 'hollow', hollow: { wallMm: 3, coinSlotWidthMm: 28, coinSlotDepthMm: 4, baseOpeningDiameterMm: 24 } };
    const prepared = await prepareKittyExport(s, cube());
    await expect(finishKittyExport(prepared)).rejects.toThrow('EXPORT_HOLLOW_REVIEW_REQUIRED');
    const output = await finishKittyExport(prepared, { approvedRepairDigest: prepared.proposal.digest });
    expect(output.manifest.report.watertight).toBe(true); expect(output.manifest.report.connectedComponents).toBe(1);
    expect(output.manifest.openings?.coinSlot).toMatchObject({ widthMm: 28, depthMm: 4, intersectsCavity: true, centerRayClear: true });
    expect(output.manifest.openings?.baseOpening.minimumInscribedDiameterMm).toBeGreaterThan(23.98);
    expect(output.manifest.openings?.baseOpening.centerRayClear).toBe(true);
    expect(output.manifest.openings?.sharedConnectedCavity).toBe(true);
    expect(output.manifest.openings?.coinSlot.measuredCutterMm).toEqual([28, 4]);
    expect(output.manifest.openings?.coinSlot.sampledClearance).toEqual({ samples: 9, clear: true });
    expect(output.manifest.openings?.baseOpening.sampledClearance).toEqual({ samples: 17, clear: true });
    expect(output.manifest.report.wallThickness.status).toBe('sampled'); expect(output.manifest.report.wallThickness.samples).toBeGreaterThan(0);
    expect(output.manifest.report.wallThickness.minimumSampleMm).toBeLessThanOrEqual(3.01); expect(output.manifest.report.makerTolerances).toBe('unverified');
  }, 30_000);
  it('marks a bounded self-intersection scan incomplete rather than claiming success', () => {
    const geometry = new SphereGeometry(10, 12, 8), positions = Array.from(geometry.getAttribute('position').array);
    const mesh: ExportMesh = { name: 'sphere', positions, indices: Array.from(geometry.index!.array), uv: Array.from(geometry.getAttribute('uv').array), material: 0 };
    const shifted = { ...mesh, positions: positions.map((n, i) => i % 3 === 0 ? n + 5 : n) };
    expect(inspectGeometry([mesh, shifted], 0).selfIntersections.status).toBe('not-fully-checked'); geometry.dispose();
  });
});

describe('authored Kitty capture and independent browser loaders', () => {
  let server: ViteDevServer, browser: Browser, page: Page, captured: ExportCapture;
  beforeAll(async () => {
    server = await createServer({ configFile: false, root: process.cwd(), cacheDir: 'node_modules/.hearthside-export-vite', server: { host: '127.0.0.1', port: 0 }, logLevel: 'error', plugins: [{ name: 'export-test-page', configureServer(vite) {
      vite.middlewares.use('/__export_test', (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script></head><body>Export test</body></html>'); });
    } }] });
    await server.listen(); const address = server.httpServer!.address() as { port: number };
    browser = await chromium.launch({ channel: 'chrome', headless: true }); page = await browser.newPage(); await page.goto(`http://127.0.0.1:${address.port}/__export_test`);
    const raw = await page.evaluate(async s => { const importer = new Function('p', 'return import(p)'); const { captureAuthoredKitty } = await importer('/src/hearthside/exportCapture.ts'); const c = captureAuthoredKitty(s); return { ...c, materials: c.materials.map((m: { png?: Uint8Array }) => ({ ...m, ...(m.png ? { png: Array.from(m.png) } : {}) })) }; }, selection());
    captured = { ...raw, materials: raw.materials.map((m: { png?: number[] }) => ({ ...m, ...(m.png ? { png: new Uint8Array(m.png) } : {}) })) } as ExportCapture;
  }, 60_000);
  afterAll(async () => { await browser?.close(); await server?.close(); });
  it('captures the actual authored sculpture with six paint canvases and no stage/shell/financial transforms', async () => {
    expect(captured.materials.filter(m => m.png).length).toBe(6); expect(captured.meshes.some(m => m.name.startsWith('body-'))).toBe(true);
    expect(inspectGeometry(captured.meshes).dimensionsMm[1]).toBeCloseTo(100, 4);
    const prepared = await prepareKittyExport(selection(), captured);
    expect(prepared.proposal.omittedMeshes.length).toBeGreaterThan(0); expect(prepared.report.boundaryEdges).toBeGreaterThan(0);
    const output = await finishKittyExport(prepared), glb = Array.from(output.files.get('kitty.glb')!), mf = Array.from(output.files.get('kitty.3mf')!), pdf = Array.from(output.files.get('geometry-sheet.pdf')!);
    const loaded = await page.evaluate(async ({ glb, mf, pdf }) => {
      const gltfPath = '/node_modules/three/examples/jsm/loaders/GLTFLoader.js', mfPath = '/node_modules/three/examples/jsm/loaders/3MFLoader.js';
      const importer = new Function('p', 'return import(p)');
      const { GLTFLoader } = await importer(gltfPath), { ThreeMFLoader } = await importer(mfPath);
      const model = await new GLTFLoader().parseAsync(new Uint8Array(glb).buffer, ''), archive = new ThreeMFLoader().parse(new Uint8Array(mf).buffer);
      let painted = 0, vertices = 0, mfMeshes = 0, mfPainted = 0;
      model.scene.traverse((m: any) => { if (m.isMesh) { vertices += m.geometry.attributes.position.count; if (m.material.map) painted++; } });
      archive.traverse((m: any) => { if (m.isMesh) { mfMeshes++; if (m.material.map) mfPainted++; } });
      const pdfjs = await importer('/node_modules/pdfjs-dist/build/pdf.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';
      const pdfTask = pdfjs.getDocument({ data: new Uint8Array(pdf) }), document = await pdfTask.promise, pdfPage = await document.getPage(1), content = await pdfPage.getTextContent();
      const pdfText = content.items.map((item: { str?: string }) => item.str ?? '').join(' '); await pdfTask.destroy();
      return { painted, vertices, mfMeshes, mfPainted, pdfText };
    }, { glb, mf, pdf });
    expect(loaded.painted).toBeGreaterThanOrEqual(6); expect(loaded.vertices).toBeGreaterThan(1000); expect(loaded.mfMeshes).toBeGreaterThan(0); expect(loaded.mfPainted).toBeGreaterThanOrEqual(6);
    expect(loaded.pdfText).toContain('Requested authored height: 100 mm'); expect(loaded.pdfText).toContain('UNVERIFIED');
  }, 60_000);
  it('builds a repaired authored solid with explicit omissions/caps and preserved paints', async () => {
    const prepared = await prepareKittyExport(selection(), captured), output = await finishKittyExport(prepared, { approvedRepairDigest: prepared.proposal.digest });
    expect(output.manifest.report.watertight).toBe(true); expect(output.files.has('source-authored.glb')).toBe(true); expect(glbJson(output.files.get('kitty.glb')!).images.length).toBe(6);
  }, 90_000);
  it('cuts a functional hollow interior in the actual authored Kitty, retaining honest thickness evidence', async () => {
    const s: ExportSelection = { ...selection(), construction: 'hollow', hollow: { wallMm: 1.5, coinSlotWidthMm: 12, coinSlotDepthMm: 3, baseOpeningDiameterMm: 18 } };
    const prepared = await prepareKittyExport(s, captured), output = await finishKittyExport(prepared, { approvedRepairDigest: prepared.proposal.digest });
    expect(output.manifest.report.watertight).toBe(true); expect(output.manifest.openings?.cavityVolumeMm3).toBeGreaterThan(0);
    expect(output.manifest.openings?.coinSlot.centerRayClear).toBe(true); expect(output.manifest.openings?.baseOpening.centerRayClear).toBe(true);
    expect(output.manifest.openings?.sharedConnectedCavity).toBe(true); expect(output.manifest.openings?.coinSlot.sampledClearance.clear).toBe(true);
    expect(output.manifest.openings?.baseOpening.measuredCutterDiameterMm).toBeCloseTo(18, 5);
    for (const entry of output.manifest.files) expect(await sha256(output.files.get(entry.name)!)).toBe(entry.sha256);
    expect(output.manifest.report.wallThickness.samples).toBeGreaterThan(0); expect(output.manifest.report.printerReady).toBe(false);
  }, 90_000);
  it('replays actual brush paint into the embedded texture without changing geometry', async () => {
    const result = await page.evaluate(async s => {
      const importer = new Function('p', 'return import(p)'), { captureAuthoredKitty } = await importer('/src/hearthside/exportCapture.ts');
      const original = captureAuthoredKitty(s); s.piece.paint.strokes.push({ part: 'body', tool: 'brush', color: '#ff0000', size: 48, opacity: 1, mirror: false, pts: [0.4, 0.5, 0.6, 0.5] });
      const painted = captureAuthoredKitty(s);
      return { sameGeometry: JSON.stringify(original.meshes) === JSON.stringify(painted.meshes), changedPaint: String(original.materials[0].png) !== String(painted.materials[0].png) };
    }, selection());
    expect(result).toEqual({ sameGeometry: true, changedPaint: true });
  });
  it('runs the browser WASM exporter in a dedicated worker with a retained review token', async () => {
    const result = await page.evaluate(async ({ selection, capture }) => {
      const worker = new Worker('/src/hearthside/exportWorker.ts', { type: 'module' });
      try {
        return await new Promise<{ watertight: boolean; files: string[] }>((resolve, reject) => {
          worker.onerror = event => reject(Error(event.message));
          worker.onmessage = event => {
            const data = event.data;
            if (data.type === 'error') reject(Error(data.code));
            if (data.type === 'prepared') worker.postMessage({ type: 'finish', requestId: 'finish-1', token: data.token, approvedRepairDigest: data.proposal.digest });
            if (data.type === 'complete') resolve({ watertight: data.manifest.report.watertight, files: data.files.map(([name]: [string]) => name) });
          };
          worker.postMessage({ type: 'prepare', requestId: 'prepare-1', selection, capture });
        });
      } finally { worker.terminate(); }
    }, { selection: selection(), capture: cube() });
    expect(result.watertight).toBe(true); expect(result.files).toContain('kitty.3mf'); expect(result.files).toContain('manifest.json');
  }, 60_000);
});
