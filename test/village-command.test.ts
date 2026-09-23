import { describe, expect, it } from 'vitest';
import { catalogHousehold } from '../src/core/index.ts';
import type { KitchenCommand } from '../src/kitchenCommand.ts';
import { commitVillageArrangement } from '../src/hearthside/villageCommand.ts';
import { VILLAGE_ROOMS, defaultVillageRoomConfig } from '../src/harbour/village/villageArrangement.ts';

describe('village save acknowledgement', () => {
  const operation = { kind: 'village-arrangement.save' as const, expectedRevision: 0, value: { version: 1 as const, revision: 1, rooms: VILLAGE_ROOMS.map(defaultVillageRoomConfig) } };
  it('retains an actual CAS rejection through a boundary that catches callback errors', async () => {
    const h = catalogHousehold();
    const accepting: KitchenCommand = async fn => { h.hearthside = fn(h).household.hearthside; return { ok: true } as never; };
    await commitVillageArrangement(accepting, 'MEM-001', operation);
    const swallowing: KitchenCommand = async fn => { try { fn(h); } catch { return null; } return null; };
    await expect(commitVillageArrangement(swallowing, 'MEM-001', operation)).rejects.toThrow('VILLAGE_ARRANGEMENT_CHANGED');
    expect(h.hearthside?.villageArrangement?.revision).toBe(1);
  });
  it('never acknowledges an absent or rejected persistence result', async () => {
    await expect(commitVillageArrangement(async () => null, 'MEM-001', operation)).rejects.toThrow('was not saved');
    await expect(commitVillageArrangement(async () => ({ ok: false }) as never, 'MEM-001', operation)).rejects.toThrow('was not saved');
  });
  it.each([
    { ok: false, errorClass: 'conflict-detected' },
    { ok: true, kind: 'conflict-needs-attention' },
  ])('requires a deliberate reload after a remote conflict: %j', async outcome => {
    const h = catalogHousehold();
    const remoteConflict: KitchenCommand = async fn => { fn(h); return outcome as never; };
    await expect(commitVillageArrangement(remoteConflict, 'MEM-001', operation)).rejects.toThrow('VILLAGE_ARRANGEMENT_CHANGED');
  });
  it('preserves a failed boundary result message', async () => {
    const rejected: KitchenCommand = async () => ({ ok: false, userMessage: 'Sharing is unavailable.' }) as never;
    await expect(commitVillageArrangement(rejected, 'MEM-001', operation)).rejects.toThrow('Sharing is unavailable.');
  });
});
