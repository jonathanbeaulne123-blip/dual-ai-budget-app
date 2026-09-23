// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { catalogHousehold } from '../src/core/index.ts';
import { financialAuditHash } from '../src/core/commandIdentity.ts';
import { commitHearthside, type HearthsideOperation } from '../src/hearthside/commands.ts';
import { emptyHearthside, type MemoryComposition } from '../src/hearthside/contracts.ts';
import { VillageDecorator } from '../src/harbour/village/VillageDecorator.tsx';
import { decodeVillageArrangement, defaultVillageRoomConfig, VILLAGE_ROOMS, type VillageArrangement, type VillageRoomConfig } from '../src/harbour/village/villageArrangement.ts';

function rooms(change: Partial<VillageRoomConfig> = {}, room = 'kitchen'): VillageRoomConfig[] {
  return VILLAGE_ROOMS.map(id => ({ ...defaultVillageRoomConfig(id), ...(id === room ? change : {}) }));
}
function candidate(revision: number, change: Partial<VillageRoomConfig> = {}, room = 'kitchen') { return { version: 1 as const, revision, rooms: rooms(change, room) }; }
function run(h: ReturnType<typeof catalogHousehold>, operation: HearthsideOperation, memberId = 'MEM-001') { return commitHearthside(h, { version: 1, id: crypto.randomUUID(), scope: { environment: h.environment, householdId: h.householdId, memberId }, operation }); }
function saved(h: ReturnType<typeof catalogHousehold>, revision: number, change: Partial<VillageRoomConfig> = {}, room = 'kitchen') { const current = h.hearthside?.villageArrangement; const value = current ? { version: 1 as const, revision, rooms: current.rooms.map(config => config.room === room ? { ...config, ...change } : config) } : candidate(revision, change, room); return run(h, { kind: 'village-arrangement.save', expectedRevision: revision - 1, value }).household; }

describe('shared village arrangements', () => {
  it('strictly decodes complete room metadata and round-trips persisted previous snapshots', () => {
    const initial = candidate(1, { layout: 'open' }, 'library');
    const savedValue: VillageArrangement = { ...initial, previous: { revision: 0, rooms: rooms() } };
    expect(decodeVillageArrangement(JSON.parse(JSON.stringify(savedValue)))).toEqual(savedValue);
    expect(() => decodeVillageArrangement({ ...initial, rooms: initial.rooms.slice(1) })).toThrow('VILLAGE_ARRANGEMENT_INVALID');
    expect(() => decodeVillageArrangement({ ...initial, previous: { revision: 1, rooms: rooms() } })).toThrow('VILLAGE_ARRANGEMENT_INVALID');
  });

  it('preserves every other room behind one global CAS revision and never changes money', async () => {
    const start = catalogHousehold();
    const beforeMoney = await financialAuditHash(start);
    const first = saved(start, 1, { layout: 'open', plant: 'flowers' }, 'library');
    const second = saved(first, 2, { light: 'daylight' }, 'kitchen');
    expect(second.hearthside!.villageArrangement!.rooms.find(room => room.room === 'library')).toMatchObject({ layout: 'open', plant: 'flowers', light: 'warm' });
    expect(second.hearthside!.villageArrangement!.rooms.find(room => room.room === 'kitchen')).toMatchObject({ layout: 'gather', light: 'daylight' });
    expect(() => run(first, { kind: 'village-arrangement.save', expectedRevision: 0, value: candidate(1) })).toThrow('VILLAGE_ARRANGEMENT_CHANGED');
    expect(await financialAuditHash(second)).toBe(beforeMoney);
    const inactive = structuredClone(start); inactive.members[0]!.active = false;
    expect(() => run(inactive, { kind: 'village-arrangement.save', expectedRevision: 0, value: candidate(1) })).toThrow('HEARTHSIDE_SCOPE_MISMATCH');
  });

  it('requires exact shared display revisions and revalidates them before a latest revert', () => {
    const h = catalogHousehold();
    const kept: MemoryComposition = { version: 1, id: 'MEM-KEPT', revision: 1, title: 'A shared evening', date: null, experienceId: null, media: [], designs: [], recollections: [], hideAmounts: true, approvals: [{ memberId: 'MEM-001', revision: 1 }, { memberId: 'MEM-002', revision: 1 }], withdrawn: false };
    h.hearthside = { ...emptyHearthside(), designs: [{ version: 1, designId: 'DESIGN-ONE', revision: 2, displayPieceId: 'PIECE-ONE', bankId: null, pieceIds: ['PIECE-ONE'] }], memories: [kept] };
    expect(() => saved(h, 1, { displays: [{ kind: 'piece', designId: 'DESIGN-ONE', id: 'PIECE-ONE', revision: 1 }] })).toThrow('VILLAGE_ARRANGEMENT_INVALID');
    const withPiece = saved(h, 1, { displays: [{ kind: 'piece', designId: 'DESIGN-ONE', id: 'PIECE-ONE', revision: 2 }, { kind: 'memory', id: 'MEM-KEPT', revision: 1 }] });
    const plain = saved(withPiece, 2, { displays: [] });
    plain.hearthside!.memories[0]!.withdrawn = true;
    expect(() => run(plain, { kind: 'village-arrangement.revert-latest', expectedRevision: 2 })).toThrow('VILLAGE_DISPLAY_UNAVAILABLE');
    const restored = saved(withPiece, 2, { layout: 'open' });
    const reverted = run(restored, { kind: 'village-arrangement.revert-latest', expectedRevision: 2 }).household.hearthside!.villageArrangement!;
    expect(reverted.revision).toBe(3);
    expect(reverted.rooms.find(room => room.room === 'kitchen')!.displays.some(display => display.kind === 'piece' && display.revision === 2)).toBe(true);
    expect(reverted.previous).toMatchObject({ revision: 2 });
  });

  it('previews locally, cancels, waits for save acknowledgement, and exposes a deliberate conflict reload', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
    const household = catalogHousehold();
    household.hearthside = { ...emptyHearthside(), designs: [{ version: 1, designId: 'DESIGN-UI', revision: 1, displayPieceId: 'PIECE-UI', bankId: null, pieceIds: ['PIECE-UI'] }], memories: [{ version: 1, id: 'MEM-UI', revision: 1, title: 'A shared evening', date: null, experienceId: null, media: [], designs: [], recollections: [], hideAmounts: true, approvals: [{ memberId: 'MEM-001', revision: 1 }, { memberId: 'MEM-002', revision: 1 }], withdrawn: false }] };
    const previews: Array<VillageRoomConfig | null> = [];
    let resolveSave: (() => void) | undefined;
    const commits: unknown[] = [];
    const commit = (operation: unknown) => { commits.push(operation); return new Promise<void>(resolve => { resolveSave = resolve; }); };
    let root: Root | undefined;
    try {
      await act(async () => { root = createRoot(document.getElementById('root')!); root.render(createElement(VillageDecorator, { household, memberId: 'MEM-001', room: 'kitchen', onCommit: commit as never, onPreview: (value: VillageRoomConfig | null) => previews.push(value) })); });
      expect(document.body.textContent).toContain(household.members.find(member => member.id === 'MEM-001')!.name);
      expect(document.body.textContent).toContain('Our Studio piece · piece 1');
      expect(document.body.textContent).toContain('A shared evening');
      const select = document.getElementById('village-layout') as HTMLSelectElement;
      await act(async () => { select.value = 'open'; select.dispatchEvent(new Event('change', { bubbles: true })); });
      expect(previews.at(-1)).toMatchObject({ room: 'kitchen', layout: 'open' });
      const remote = candidate(1, { light: 'daylight' });
      await act(async () => { root!.render(createElement(VillageDecorator, { household, memberId: 'MEM-001', room: 'kitchen', arrangement: remote, onCommit: commit as never, onPreview: (value: VillageRoomConfig | null) => previews.push(value) })); });
      expect((document.getElementById('village-layout') as HTMLSelectElement).value).toBe('open');
      await act(async () => { (Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Cancel preview') as HTMLButtonElement).click(); });
      expect(previews.at(-1)).toBeNull();
      const latest = document.getElementById('village-layout') as HTMLSelectElement;
      await act(async () => { latest.value = 'open'; latest.dispatchEvent(new Event('change', { bubbles: true })); });
      await act(async () => { (Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Save shared arrangement') as HTMLButtonElement).click(); });
      expect(document.body.textContent).toContain('Saving shared arrangement');
      expect(commits).toHaveLength(1);
      await act(async () => { resolveSave?.(); });
      expect(previews.at(-1)).toBeNull();
      const reject = async () => { throw Error('connection is unavailable'); };
      await act(async () => { root!.render(createElement(VillageDecorator, { household, memberId: 'MEM-001', room: 'kitchen', arrangement: remote, onCommit: reject as never, onPreview: (value: VillageRoomConfig | null) => previews.push(value) })); });
      const second = document.getElementById('village-layout') as HTMLSelectElement;
      await act(async () => { second.value = 'gather'; second.dispatchEvent(new Event('change', { bubbles: true })); });
      await act(async () => { (Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Save shared arrangement') as HTMLButtonElement).click(); });
      expect(document.body.textContent).toContain('was not saved');
      expect((Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Save shared arrangement') as HTMLButtonElement).disabled).toBe(false);
      const conflict = async () => { throw Error('VILLAGE_ARRANGEMENT_CHANGED'); };
      await act(async () => { root!.render(createElement(VillageDecorator, { household, memberId: 'MEM-001', room: 'kitchen', arrangement: remote, onCommit: conflict as never, onPreview: (value: VillageRoomConfig | null) => previews.push(value) })); });
      await act(async () => { (Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Save shared arrangement') as HTMLButtonElement).click(); });
      expect(document.body.textContent).toContain('Load latest room');
      expect((Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Save shared arrangement') as HTMLButtonElement).disabled).toBe(true);
      await act(async () => { root!.render(createElement(VillageDecorator, { household, memberId: 'MEM-001', room: 'loft', arrangement: remote, onCommit: conflict as never, onPreview: (value: VillageRoomConfig | null) => previews.push(value) })); });
      expect(previews.at(-1)).toBeNull();
    } finally {
      await act(async () => root?.unmount());
      document.body.innerHTML = '';
      delete (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT;
    }
  });
});
