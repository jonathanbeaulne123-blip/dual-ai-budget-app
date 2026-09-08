import { afterAll, beforeAll, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { catalogHousehold, postEntry, saveBoardTask, saveBoardMilestone } from '../src/core/index.ts';

let mf: Miniflare;
let browser: Browser;
let base: string;
type LocalScope = { environment: 'development' | 'production'; householdId: string; memberId: string; subject: string };
const scopeFor = (householdId: string, memberId = 'MEM-001'): LocalScope => ({ environment: 'development', householdId, memberId, subject: `local:${memberId}` });
const task = (id: string, expectedVersion = 0) => ({ id: `BOARD-TASK-${id}`, title: `Task ${id}`, assigneeId: null, dueDate: null, completed: false, expectedVersion });
const milestone = (id: string, expectedVersion = 0) => ({ id: `BOARD-MILESTONE-${id}`, title: `Milestone ${id}`, dueDate: '2026-09-30', completed: false, expectedVersion });
const headers = (memberId = 'MEM-001') => ({ Authorization: `Bearer local:${memberId}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const client = await build({ entryPoints: ['test/browser/shared-boards-continuity.ts'], bundle: true, write: false, platform: 'browser', external: ['node:*'], format: 'esm', target: 'es2022' });
  const worker = await build({ stdin: { resolveDir: process.cwd(), contents: `
    import worker from './test/browser/ledger-worker.ts';
    export { LedgerRoom } from './test/browser/ledger-worker.ts';
    export default { fetch(request, env) {
      const path = new URL(request.url).pathname;
      if (path === '/board-proof') return new Response('<script type="module" src="/board-proof.js"></script>', {headers:{'Content-Type':'text/html'}});
      if (path === '/board-proof.js') return new Response(env.TEST_CLIENT, {headers:{'Content-Type':'text/javascript'}});
      return worker.fetch(request, env);
    }};` }, bundle: true, write: false, platform: 'browser', external: ['cloudflare:*', 'node:*'], format: 'esm', target: 'es2022' });
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: worker.outputFiles[0]!.text, compatibilityDate: '2026-08-27', compatibilityFlags: ['nodejs_compat'],
    durableObjects: { LEDGER_ROOMS: { className: 'LedgerRoom', useSQLite: true } }, r2Buckets: ['LEDGER_ARCHIVE'],
    bindings: { LEDGER_SYNC_LOCAL_AUTH: 'true', LEDGER_SYNC_ENABLED: 'true', SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_PUBLISHABLE_KEY: 'synthetic', TEST_CLIENT: client.outputFiles[0]!.text },
  }));
  base = (await mf.ready).origin;
  if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local proof must stay on loopback');
  browser = await chromium.launch({ headless: true });
}, 60_000);
afterAll(async () => { await browser?.close(); await mf?.dispose(); });

async function fixture(withRows = false, faultPrefix = false) {
  let h = catalogHousehold();
  // Nonempty Personal books make isolation assertions meaningful.
  for (const memberId of ['MEM-001', 'MEM-002']) h = postEntry(h, { date: '2026-09-07', type: 'expense', amount: memberId === 'MEM-001' ? '3.00' : '4.00', accountId: 'ACC-VISA', subcategoryId: 'SUB-FOOD-GROCERIES', createdBy: memberId, visibility: 'personal', note: `private-${memberId}`, confirmDuplicate: true }).household;
  if (withRows) {
    h = saveBoardTask(h, { ...task('race'), memberId: 'MEM-001' }).household;
    h = saveBoardMilestone(h, { ...milestone('race'), memberId: 'MEM-001' }).household;
  }
  h = { ...h, householdId: `HH-${faultPrefix ? 'FAULT' : 'BOARD'}-${crypto.randomUUID()}`, revision: 0, baseRevision: 0 };
  for (const memberId of ['MEM-001', 'MEM-002']) {
    const response = await fetch(`${base}/ledger-sync/v2/development/${h.householdId}/import`, { method: 'POST', headers: headers(memberId), body: JSON.stringify(h) });
    expect(response.status, await response.text()).toBe(200);
  }
  return h.householdId;
}
async function start(page: Page, scope: LocalScope, online = true) {
  await page.goto(`${base}/board-proof`);
  await page.waitForFunction(() => (window as any).boardProof);
  if (online) await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }));
  await page.evaluate(scope => (window as any).boardProof.start(scope), scope);
  await page.waitForFunction(() => (window as any).replica);
  if (online) await page.waitForFunction(() => (window as any).status === 'ready');
}
async function connect(scope: LocalScope) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await start(page, scope);
  return { context, page };
}
async function submit(page: Page, kind: string, input: object, wait = false): Promise<string> {
  return page.evaluate(({ kind, input, wait }) => (window as any).boardProof.submit(kind, input, wait), { kind, input, wait });
}
async function reloadOffline(context: BrowserContext, page: Page, scope: LocalScope) {
  await page.route('**/ledger-sync/**', route => route.abort());
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }));
  await context.setOffline(false); // Load the test shell while all ledger requests remain blocked.
  await start(page, scope, false);
}
async function reconnect(page: Page) {
  await page.unroute('**/ledger-sync/**');
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); window.dispatchEvent(new Event('online')); (window as any).boardProof.retry(); });
}
async function stored(page: Page) { return page.evaluate(() => (window as any).boardProof.stored()); }
async function snapshot(id: string, memberId = 'MEM-001') {
  const response = await fetch(`${base}/ledger-sync/v2/development/${id}/snapshot`, { headers: headers(memberId) });
  expect(response.status).toBe(200);
  return response.json() as Promise<any>;
}
function money(replica: any) {
  const { lastCommittedAt: _commitMetadata, ...personal } = replica.personal;
  // Existing splitForSync repeats global tombstones in Personal. Board deletion
  // markers are expected metadata; all financial tombstones must remain equal.
  personal.tombstones = personal.tombstones.filter((row: any) => !/^BOARD-(TASK|MILESTONE)-/.test(row.id));
  return { transactions: replica.shared.transactions, shifts: replica.shared.shifts, claims: replica.shared.claims, goals: replica.shared.goals, contributions: replica.shared.goalContributions, purchases: replica.shared.goalPurchases, personal };
}

it('persists offline task and milestone UUIDs across page reload, then converges both members without changing Personal or Shared money', async () => {
  const id = await fixture(), a = await connect(scopeFor(id)), b = await connect(scopeFor(id, 'MEM-002'));
  try {
    const beforeA = await snapshot(id), beforeB = await snapshot(id, 'MEM-002');
    await a.context.setOffline(true); await b.context.setOffline(true);
    const ca = await submit(a.page, 'saveBoardTask', task('offline'));
    const cb = await submit(b.page, 'saveBoardMilestone', milestone('offline'));
    await reloadOffline(a.context, a.page, scopeFor(id));
    await reloadOffline(b.context, b.page, scopeFor(id, 'MEM-002'));
    expect((await stored(a.page)).pending.map((c: any) => c.id)).toEqual([ca]);
    expect((await stored(b.page)).pending.map((c: any) => c.id)).toEqual([cb]);
    expect((await snapshot(id)).sequence).toBe(0);
    await reconnect(a.page); await reconnect(b.page);
    for (const page of [a.page, b.page]) await page.waitForFunction(() => (window as any).replica?.revision === 2);
    await expect.poll(async () => (await stored(a.page)).pending.length).toBe(0);
    await expect.poll(async () => (await stored(b.page)).pending.length).toBe(0);
    const afterA = await snapshot(id), afterB = await snapshot(id, 'MEM-002');
    expect(afterA.shared.kitchen.boards.tasks).toHaveLength(1);
    expect(afterA.shared.kitchen.boards.milestones).toHaveLength(1);
    expect(afterA.shared.kitchen.boards).toEqual(afterB.shared.kitchen.boards);
    expect(afterA.personal.kitchen).toBeUndefined(); expect(afterB.personal.kitchen).toBeUndefined();
    expect(money(afterA)).toEqual(money(beforeA)); expect(money(afterB)).toEqual(money(beforeB));
    expect(JSON.stringify(afterB)).not.toContain('private-MEM-001');
    for (const [commandId, memberId] of [[ca, 'MEM-001'], [cb, 'MEM-002']]) {
      const result = await fetch(`${base}/ledger-sync/v2/development/${id}/receipt?id=${commandId}`, { headers: headers(memberId) });
      expect((await result.json() as any).receipt.postedIds).toEqual([]);
    }
  } finally { await a.context.close(); await b.context.close(); }
}, 30_000);

it.each([true, false])('reconnect refuses stale task AND milestone %s: removals and edits cannot overwrite the accepted winner', async removalWins => {
  const id = await fixture(true), a = await connect(scopeFor(id)), b = await connect(scopeFor(id, 'MEM-002'));
  try {
    const beforeA = await snapshot(id), beforeB = await snapshot(id, 'MEM-002');
    await a.context.setOffline(true);
    const ids: string[] = [];
    for (const [save, remove, input] of [['saveBoardTask', 'removeBoardTask', task('race', 1)], ['saveBoardMilestone', 'removeBoardMilestone', milestone('race', 1)]] as const) {
      ids.push(await submit(a.page, removalWins ? save : remove, { ...input, title: 'Retained offline text' }));
      await submit(b.page, removalWins ? remove : save, { ...input, title: 'Accepted remote text' }, true);
    }
    await reloadOffline(a.context, a.page, scopeFor(id));
    expect((await stored(a.page)).pending.map((c: any) => c.id)).toEqual(ids);
    await reconnect(a.page);
    await expect.poll(async () => (await stored(a.page)).rejected.length).toBe(2);
    const rejected = (await stored(a.page)).rejected;
    expect(rejected.map((r: any) => r.command.id).sort()).toEqual([...ids].sort());
    expect(rejected.every((r: any) => r.rejection.includes('BUSINESS_PRECONDITION_CHANGED'))).toBe(true);
    expect((await stored(a.page)).pending).toEqual([]);
    await start(a.page, scopeFor(id));
    expect((await stored(a.page)).rejected).toEqual(rejected);
    const afterA = await snapshot(id), afterB = await snapshot(id, 'MEM-002');
    expect(afterA.sequence).toBe(2);
    for (const [key, prefix] of [['tasks', 'BOARD-TASK'], ['milestones', 'BOARD-MILESTONE']]) {
      const rows = afterA.shared.kitchen.boards[key!];
      if (removalWins) { expect(rows).toEqual([]); expect(afterA.shared.tombstones.some((t: any) => t.id === `${prefix}-race`)).toBe(true); }
      else expect(rows[0]).toMatchObject({ title: 'Accepted remote text', version: 2 });
    }
    expect(money(afterA)).toEqual(money(beforeA)); expect(money(afterB)).toEqual(money(beforeB));
  } finally { await a.context.close(); await b.context.close(); }
}, 30_000);

it('retiring a client keeps its queued boards isolated by environment, household, member AND identity until the original scope returns', async () => {
  const id = await fixture(), original = scopeFor(id), a = await connect(original);
  try {
    await a.context.setOffline(true);
    const commandId = await submit(a.page, 'saveBoardTask', task('retired'));
    await a.page.evaluate(() => (window as any).boardProof.retire());
    for (const other of [{ ...original, environment: 'production' as const }, { ...original, householdId: `${id}-other` }, { ...original, memberId: 'MEM-002' }, { ...original, subject: 'different-google-identity' }]) {
      const state = await a.page.evaluate(scope => (window as any).boardProof.stored(scope), other);
      expect(state.pending).toEqual([]); expect(state.rejected).toEqual([]); expect(state.replica).toBeUndefined();
    }
    await a.context.setOffline(false);
    await start(a.page, scopeFor(id, 'MEM-002'));
    expect((await stored(a.page)).pending).toEqual([]);
    expect((await snapshot(id)).sequence).toBe(0);
    const retained = await a.page.evaluate(scope => (window as any).boardProof.stored(scope), original);
    expect(retained.pending.map((c: any) => c.id)).toEqual([commandId]);
    await start(a.page, original);
    await a.page.waitForFunction(() => (window as any).replica?.revision === 1);
    await expect.poll(async () => (await stored(a.page)).pending.length).toBe(0);
    expect((await snapshot(id)).shared.kitchen.boards.tasks).toHaveLength(1);
  } finally { await a.context.close(); }
}, 30_000);

it('recovers the same board receipt after durable archive succeeds but the acknowledgement is lost', async () => {
  const id = await fixture(false, true), a = await connect(scopeFor(id));
  const fault = async (stage: string) => {
    expect((await fetch(`${base}/test/fault/${id}`, { method: 'POST', body: stage })).status).toBe(200);
  };
  try {
    await fault('after-tip');
    const commandId = await submit(a.page, 'saveBoardMilestone', milestone('ack'));
    await expect.poll(async () => (await (await fetch(`${base}/test/archive/${id}`)).json() as any).tip?.sequence).toBe(1);
    expect((await stored(a.page)).pending.map((c: any) => c.id)).toEqual([commandId]);
    await a.page.evaluate(() => (window as any).boardProof.retire());
    await fault('');
    await start(a.page, scopeFor(id));
    await expect.poll(async () => (await stored(a.page)).pending.length).toBe(0);
    const accepted = await snapshot(id);
    expect(accepted.sequence).toBe(1); expect(accepted.shared.kitchen.boards.milestones).toHaveLength(1);
    const receipt = await (await fetch(`${base}/ledger-sync/v2/development/${id}/receipt?id=${commandId}`, { headers: headers() })).json() as any;
    expect(receipt.receipt).toMatchObject({ id: commandId, sequence: 1, postedIds: [] });
    await start(a.page, scopeFor(id));
    expect((await snapshot(id)).sequence).toBe(1);
  } finally { await fault(''); await a.context.close(); }
}, 30_000);
