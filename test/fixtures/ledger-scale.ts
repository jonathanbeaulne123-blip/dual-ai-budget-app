import { seedDemoHousehold, type Household } from '../../src/core/index.ts';

/** Bounded fixture construction: clone rows, never run 5,000 posting commands. */
export function ledgerScaleFixture(minimum = 5000): Household {
  if (!Number.isInteger(minimum) || minimum < 0 || minimum > 20000) throw new Error('INVALID_FIXTURE_SIZE');
  const base = seedDemoHousehold({ today: '2026-08-21' });
  const original = base.transactions;
  if (!original.length) throw new Error('EMPTY_SEED');
  const copies = Math.max(1, Math.ceil(minimum / original.length));
  const ids = new Set(original.map(row => row.id));
  const transactions = Array.from({ length: copies }, (_, copy) => original.map(row => {
    if (copy === 0) return row;
    const cloned = structuredClone(row);
    // Additional load rows are ordinary unallocated entries. Cloning a funded
    // row without its immutable Fund event would create an invalid fixture.
    delete cloned.funding;
    // References within transaction rows follow the same copied batch. Related
    // non-transaction entities remain the seed's original, explicit shape.
    const remap = (value: unknown): unknown => typeof value === 'string' && ids.has(value)
      ? `${value}-scale-${copy}` : Array.isArray(value) ? value.map(remap)
        : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v]) => [k,remap(v)])) : value;
    return remap(cloned) as typeof row;
  })).flat();
  return { ...base, name: 'Ledger scale proof', transactions, booksAcceptedHash: null };
}
