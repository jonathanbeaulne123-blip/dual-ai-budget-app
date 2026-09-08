import { expect, it } from 'vitest';
import { reconcileHouseholdSnapshots } from '../src/api.ts';
import { catalogHousehold, saveBoardTask, saveBoardMilestone, removeBoardTask, setBoardPhoto, splitForSync, postEntry } from '../src/core/index.ts';
import { canAbsorbDisjointSharedMoney } from '../src/core/conflict.ts';
import { capturedIntent, clearCapturedIntent } from '../src/ledgerSync/capture.ts';
import { commandFromCapture, type Scope } from '../src/ledgerSync/protocol.ts';
import { prepareCommand } from '../src/ledgerSync/authority.ts';

const task = { memberId: 'MEM-001', id: 'BOARD-TASK-local', title: 'Keep the local task', assigneeId: null, dueDate: null, completed: false, expectedVersion: 0 };
const milestone = { memberId: 'MEM-002', id: 'BOARD-MILESTONE-remote', title: 'Keep the remote milestone', dueDate: '2026-09-30', completed: false, expectedVersion: 0 };
const divergent = <T extends { revision: number; baseRevision?: number }>(h: T): T => ({ ...h, revision: 1, baseRevision: 0 });

it('public legacy reconciliation preserves independent boards in either order without merging other kitchen state or changing money', async () => {
  const base = postEntry(catalogHousehold(), { date: '2026-09-07', type: 'expense', amount: '3.00', accountId: 'ACC-VISA', subcategoryId: 'SUB-FOOD-GROCERIES', createdBy: 'MEM-001', visibility: 'personal', note: 'Private money remains local', confirmDuplicate: true }).household;
  const local = divergent(saveBoardTask(base, task).household);
  const remote = divergent(saveBoardMilestone(base, milestone).household);
  // Distinct accepted clocks make both merge directions deterministic.
  local.lastCommittedAt = '2026-09-08T12:00:00.000Z';
  remote.lastCommittedAt = '2026-09-08T12:00:01.000Z';
  local.kitchen.companion.name = 'Local companion';
  remote.kitchen.companion.name = 'Remote companion';
  local.kitchen.chalkboard = [{ id: 'CHALK-local', text: 'Local-only chalk', author: 'MEM-001', createdAt: '2026-09-08T12:00:00Z', updatedAt: '2026-09-08T12:00:00Z' }];
  const originals = JSON.stringify([local, remote]);
  for (const [a, b] of [[local, remote], [remote, local]] as const) {
    expect(canAbsorbDisjointSharedMoney(a, b)).toBe(true);
    const merged = await reconcileHouseholdSnapshots(a, b, 'MEM-001');
    expect(merged.kitchen.boards?.tasks.map(row => row.id)).toEqual([task.id]);
    expect(merged.kitchen.boards?.milestones.map(row => row.id)).toEqual([milestone.id]);
    const { boards: _boards, ...otherKitchen } = merged.kitchen;
    const { boards: _remoteBoards, ...remoteKitchen } = splitForSync(b, 'MEM-001').shared.kitchen;
    expect(otherKitchen).toEqual(remoteKitchen);
    expect(merged.transactions).toEqual(base.transactions);
    expect(merged.goalContributions).toEqual(base.goalContributions);
    // Personal payload stays local; the assembled envelope carries the latest
    // accepted household clock, even when that clock came from a shared edit.
    expect(splitForSync(merged, 'MEM-001').personal).toEqual({
      ...splitForSync(a, 'MEM-001').personal,
      lastCommittedAt: '2026-09-08T12:00:01.000Z',
    });
    expect(merged.sharing?.mode).toBe('pending-transport');
    expect(merged.revision).toBe(2); expect(merged.baseRevision).toBe(1);
  }
  expect(JSON.stringify([local, remote])).toBe(originals);
});

it.each([true, false])('public recovery respects removal tombstones when both snapshots carry them: %s', async sameTombstones => {
  const existing = saveBoardTask(catalogHousehold(), task).household;
  const removed = divergent(removeBoardTask(existing, { memberId: 'MEM-001', id: task.id, expectedVersion: 1 }).household);
  const stale = divergent(structuredClone(existing));
  if (sameTombstones) stale.tombstones = structuredClone(removed.tombstones);
  for (const [a, b] of [[stale, removed], [removed, stale]] as const) {
    expect(canAbsorbDisjointSharedMoney(a, b)).toBe(sameTombstones);
    const merged = await reconcileHouseholdSnapshots(a, b, 'MEM-001');
    expect(merged.kitchen.boards?.tasks).toEqual([]);
    expect(merged.tombstones.some(row => row.id === task.id)).toBe(true);
  }
});

it('public divergent recovery keeps a newer local edit and a cleared photo slot instead of older remote content', async () => {
  const initial = saveBoardTask(catalogHousehold(), task).household;
  const photo = { memberId: 'MEM-001', slot: 1 as const, mediaId: 'BM-00000000-0000-4000-8000-000000000001', caption: 'Before', crop: { x: 50, y: 50, zoom: 1 }, expectedVersion: 0 };
  const remote = divergent(setBoardPhoto(initial, photo).household);
  const edited = saveBoardTask(remote, { ...task, expectedVersion: 1, title: 'Newer local task' }).household;
  const local = divergent(setBoardPhoto(edited, { ...photo, expectedVersion: 1, mediaId: null }).household);
  const merged = await reconcileHouseholdSnapshots(local, remote, 'MEM-001');
  expect(merged.kitchen.boards?.tasks[0]).toMatchObject({ version: 2, title: 'Newer local task' });
  expect(merged.kitchen.boards?.photos[0]).toMatchObject({ version: 2, mediaId: null });
});

it('clean-replica adoption does not merge unaccepted local board content into a newer canonical snapshot', async () => {
  const base = catalogHousehold();
  const local = { ...saveBoardTask(base, task).household, revision: 0, baseRevision: 0 };
  const remote = divergent(saveBoardMilestone(base, milestone).household);
  const adopted = await reconcileHouseholdSnapshots(local, remote, 'MEM-001');
  expect(adopted.kitchen.boards).toEqual(remote.kitchen.boards);
  expect(adopted.kitchen.boards?.tasks).toEqual([]);
  expect(adopted.sharing?.mode).toBe('synchronized');
});

it('v2 authority executes only the captured command, never merging unrelated unaccepted local board content', async () => {
  const base = catalogHousehold(), parts = splitForSync(base, 'MEM-001');
  const local = saveBoardTask(base, task).household;
  clearCapturedIntent(local); // This unrelated local row is not a submitted command.
  const candidate = saveBoardMilestone(local, { ...milestone, memberId: 'MEM-001' }).household;
  const scope: Scope = { environment: base.environment, householdId: base.householdId, memberId: 'MEM-001', subject: 'synthetic', role: 'owner', aclEpoch: 1, expires: Date.now() + 60_000 };
  const command = await commandFromCapture(capturedIntent(candidate)!, scope, crypto.randomUUID());
  const accepted = await prepareCommand({ sequence: base.revision, shared: parts.shared, personal: new Map([['MEM-001', parts.personal]]) }, command, scope, () => {});
  expect(accepted.shared.kitchen.boards?.tasks).toEqual([]);
  expect(accepted.shared.kitchen.boards?.milestones.map(row => row.id)).toEqual([milestone.id]);
  expect(accepted.receipt.postedIds).toEqual([]);
});
