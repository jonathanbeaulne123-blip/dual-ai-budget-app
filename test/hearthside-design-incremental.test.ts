import { describe, expect, it } from 'vitest';
import {
  acceptKittyDesignOperation, checkpointKittyDesign, createKittyDesignDocument,
  decodeKittyDesignDocument, projectKittyDesign, restoreKittyDesignCheckpoint,
  snapshotKittyDesignRevision, canonicalDesignJSON, KITTY_DESIGN_LIMITS, type KittyDesignDocument, type KittyDesignOperation,
} from '../src/hearthside/design.ts';

const scope = { environment: 'development' as const, householdId: 'HH-incremental', ownerMemberId: null };
const time = '2026-09-12T12:00:00.000Z';
const common = { version: 1 as const, designId: 'DESIGN-incremental', pieceId: 'PIECE-incremental' };
type Payload = KittyDesignOperation extends infer O ? O extends KittyDesignOperation ? Omit<O, keyof typeof common | 'id' | 'gestureId'> : never : never;
const operation = (id: string, payload: Payload): KittyDesignOperation => ({ ...common, id, gestureId: `G-${id}`, ...payload }) as KittyDesignOperation;
function harness() {
  let document = createKittyDesignDocument(common.designId, scope);
  const send = (id: string, payload: Payload, actorId = 'MEM-001') => {
    const result = acceptKittyDesignOperation(document, operation(id, payload), { environment: scope.environment, householdId: scope.householdId, actorId, order: document.revision + 1, acceptedAt: time });
    document = result.document; return result;
  };
  send('create', { kind: 'create-piece', base: 'cream' });
  return { send, document: () => document, view: () => projectKittyDesign(document) };
}
const stroke = (part: 'body' | 'tail', color: string) => ({ part, tool: 'brush' as const, color, size: 12, opacity: 1, mirror: false, pts: [0.2, 0.3, 0.4, 0.5] });

describe('incremental creative state keeps its lossless journal authoritative', () => {
  it('matches fresh serialized replay through 1,000 mixed operations, interleaved undo and topology recovery', () => {
    const h = harness(), fields = new Map<string, number>(), checkpoints: KittyDesignDocument[] = [];
    h.send('stamp', { kind: 'add-stamp', expectedEditEpoch: 0, stamp: { id: 'stamp-heart', anchor: 'belly', kind: 'heart', color: '#aa0000', size: 0.2, rotation: 0 } });
    const shape = (id: string, field: 'profile.0' | 'profile.1' | 'tail', value: string | number, actor = 'MEM-001') => {
      h.send(id, { kind: 'change-shape-field', field, value, expectedEditEpoch: 0, expectedFieldRevision: fields.get(field) ?? 0 }, actor); fields.set(field, h.document().revision);
    };
    for (let i = 0; i < 100; i++) {
      shape(`width-${i}`, 'profile.0', i % 2 ? 1.1 : 0.9);
      shape(`shoulders-${i}`, 'profile.1', i % 2 ? 0.9 : 1.1, 'MEM-002');
      const painted = h.send(`alice-${i}`, { kind: 'append-stroke', expectedEditEpoch: 0, surfaceRevision: 0, stroke: stroke('body', '#aa0000') });
      h.send(`bob-${i}`, { kind: 'append-stroke', expectedEditEpoch: 0, surfaceRevision: 0, stroke: stroke('tail', '#0000bb') }, 'MEM-002');
      h.send(`dip-${i}`, { kind: 'change-dip', part: 'head', color: i % 2 ? '#ffbbbb' : '#bbffff', expectedEditEpoch: 0, expectedFieldRevision: fields.get('dip') ?? 0 }); fields.set('dip', h.document().revision);
      const undone = h.send(`undo-${i}`, { kind: 'undo-gesture', targetGestureId: `G-alice-${i}`, expectedEditEpoch: 0, expectedGestureRevision: painted.receipt.revision });
      shape(`hide-tail-${i}`, 'tail', 'none');
      if (i === 49) {
        const view = h.view().pieces[0]!;
        expect(view.recoverablePaint).toHaveLength(50);
        expect(view.recoverablePaint.every(p => p.actorId === 'MEM-002' && p.surface.revision === 0 && p.surface.sculpt.tail === 'curl')).toBe(true);
      }
      h.send(`redo-${i}`, { kind: 'redo-gesture', targetGestureId: `G-alice-${i}`, expectedEditEpoch: 0, expectedGestureRevision: undone.receipt.revision });
      h.send(`stamp-color-${i}`, { kind: 'update-stamp', stampId: 'stamp-heart', field: 'color', value: i % 2 ? '#aa0000' : '#0000bb', expectedEditEpoch: 0, expectedFieldRevision: fields.get('stamp') ?? 0 }, 'MEM-002'); fields.set('stamp', h.document().revision);
      shape(`return-tail-${i}`, 'tail', 'curl');
      if (i % 25 === 24) checkpoints.push(h.document());
    }
    expect(h.document().operations).toHaveLength(1002);
    const view = h.view().pieces[0]!;
    expect(view.piece.sculpt.profile.slice(0, 2)).toEqual([1.1, 0.9]);
    expect(view.strokes.map(s => s.actorId)).toEqual(Array.from({ length: 200 }, (_, i) => i % 2 ? 'MEM-002' : 'MEM-001'));
    expect(view.recoverablePaint).toEqual([]);
    for (const saved of checkpoints) {
      // JSON restart constructs independently validated state without any cache
      // identity or materialized field state from the incremental writer.
      const restored = restoreKittyDesignCheckpoint(checkpointKittyDesign(saved));
      expect(projectKittyDesign(restored)).toEqual(projectKittyDesign(saved));
      expect(checkpointKittyDesign(restored)).toBe(checkpointKittyDesign(saved));
    }
    const beforeFire = h.document(), fired = h.send('fire', { kind: 'fire', expectedRevision: beforeFire.revision });
    h.send('reopen', { kind: 'reopen', expectedRevision: fired.receipt.revision });
    const epoch = h.document().revision;
    h.send('later-dip', { kind: 'change-dip', part: 'base', color: 'rose', expectedEditEpoch: epoch, expectedFieldRevision: 0 });
    expect(snapshotKittyDesignRevision(h.document(), common.pieceId, fired.receipt.revision).piece.paint.base).toBe('cream');
    expect(projectKittyDesign(beforeFire).pieces[0]!.piece.firedAt).toBeNull();
    expect(h.view()).toEqual(projectKittyDesign(restoreKittyDesignCheckpoint(checkpointKittyDesign(h.document()))));
  }, 20_000);

  it('keeps old branches, cached renders and original duplicate receipts independent', () => {
    const h = harness();
    const painted = h.send('paint', { kind: 'append-stroke', expectedEditEpoch: 0, surfaceRevision: 0, stroke: stroke('body', '#aa0000') });
    const old = h.document(), oldView = projectKittyDesign(old);
    h.send('undo', { kind: 'undo-gesture', expectedEditEpoch: 0, targetGestureId: 'G-paint', expectedGestureRevision: painted.receipt.revision });
    oldView.pieces[0]!.piece.paint.strokes[0]!.pts[0] = 0.99;
    const branch = acceptKittyDesignOperation(old, operation('branch', { kind: 'change-dip', part: 'base', color: '#99aa99', expectedEditEpoch: 0, expectedFieldRevision: 0 }), { environment: scope.environment, householdId: scope.householdId, actorId: 'MEM-002', order: old.revision + 1, acceptedAt: time }).document;
    expect(projectKittyDesign(branch).pieces[0]!.piece.paint.strokes).toHaveLength(1);
    expect(h.view().pieces[0]!.piece.paint.strokes).toHaveLength(0);
    expect(projectKittyDesign(old).pieces[0]!.piece.paint.strokes[0]!.pts[0]).toBe(0.2);
    const retry = acceptKittyDesignOperation(h.document(), painted.document.operations.at(-1)!.operation, { environment: scope.environment, householdId: scope.householdId, actorId: 'MEM-001', order: 99, acceptedAt: time });
    expect(retry.receipt).toEqual(painted.receipt); expect(retry.duplicate).toBe(true);
    retry.receipt.finishActiveStrokes.push('tail');
    expect(h.send('paint', { kind: 'append-stroke', expectedEditEpoch: 0, surfaceRevision: 0, stroke: stroke('body', '#aa0000') }).receipt.finishActiveStrokes).toEqual([]);
  });

  it('never treats a previously read mutable or merely shallow-frozen input as trusted', () => {
    const h = harness(); h.send('paint', { kind: 'append-stroke', expectedEditEpoch: 0, surfaceRevision: 0, stroke: stroke('body', '#aa0000') });
    const document = h.document();
    expect(Object.isFrozen(document)).toBe(true); expect(Object.isFrozen(document.scope)).toBe(true);
    expect(Object.isFrozen(document.operations.at(-1)!.operation)).toBe(true);
    const copy = structuredClone(document); projectKittyDesign(copy);
    copy.operations[1]!.operation.designId = 'DESIGN-forged';
    expect(() => projectKittyDesign(copy)).toThrow('another household');
    expect(() => checkpointKittyDesign(copy)).toThrow('another household');
    expect(() => acceptKittyDesignOperation(copy, operation('new', { kind: 'change-dip', part: 'base', color: 'rose', expectedEditEpoch: 0, expectedFieldRevision: 0 }), { environment: scope.environment, householdId: scope.householdId, actorId: 'MEM-001', order: 3, acceptedAt: time })).toThrow('another household');
    const shallow = Object.freeze(structuredClone(document)); decodeKittyDesignDocument(shallow);
    shallow.operations[1]!.actorId = 'MEM-002'; shallow.operations[1]!.operation.gestureId = 'G-create';
    expect(() => projectKittyDesign(shallow)).toThrow('another action');
    const accessor = structuredClone(document); let invoked = false;
    Object.defineProperty(accessor.operations[1]!, 'actorId', { get() { invoked = true; return 'MEM-001'; } });
    expect(() => checkpointKittyDesign(accessor)).toThrow('plain values'); expect(invoked).toBe(false);
    expect(projectKittyDesign(document).pieces[0]!.piece.paint.strokes).toHaveLength(1);
  });

  it('accepts a thousand shape changes within the local response budget without replay growth', () => {
    const h = harness(), durations: number[] = []; let previous = 0;
    for (let i = 0; i < 1000; i++) {
      const start = performance.now();
      h.send(`shape-${i}`, { kind: 'change-shape-field', field: 'profile.0', value: i % 2 ? 1.1 : 0.9, expectedEditEpoch: 0, expectedFieldRevision: previous });
      durations.push(performance.now() - start); previous = h.document().revision;
    }
    const tail = durations.slice(500).sort((a, b) => a - b), p95 = tail[Math.ceil(tail.length * 0.95) - 1]!;
    const started = performance.now(), restored = restoreKittyDesignCheckpoint(checkpointKittyDesign(h.document())), restoreMs = performance.now() - started;
    expect(p95).toBeLessThan(100);
    expect(restoreMs).toBeLessThan(1500);
    expect(projectKittyDesign(restored)).toEqual(h.view());
    console.info(JSON.stringify({ fixture: '1000 accepted shape operations', acceptanceP95Ms: Number(p95.toFixed(2)), restoreMs: Number(restoreMs.toFixed(2)) }));
  }, 20_000);

  it('enforces the exact UTF-8 checkpoint budget before acceptance, including revision digit changes', () => {
    const h = harness(); let fieldRevision = 0;
    for (let i = 0; i < 8; i++) {
      h.send(`dip-${i}`, { kind: 'change-dip', part: 'base', color: 'rose', expectedEditEpoch: 0, expectedFieldRevision: fieldRevision }); fieldRevision = h.document().revision;
    }
    const before = h.document(), payload: Payload = { kind: 'add-stamp', expectedEditEpoch: 0, stamp: { id: 'heart', anchor: 'belly', kind: 'initial', color: '#aa0000', text: '💛', size: 0.2, rotation: 0 } };
    const entry = { operation: operation('emoji', payload), actorId: 'MEM-001', order: 10, acceptedAt: time };
    const serialized = canonicalDesignJSON({ version: 1, kind: 'kitty-design-checkpoint', document: { ...before, revision: 10, operations: [...before.operations, entry] } });
    const exactBytes = new TextEncoder().encode(serialized).length, original = KITTY_DESIGN_LIMITS.checkpointBytes;
    // Lower the same production guard for a boundary test without allocating a
    // 32-MiB fixture. Restore it before the next non-concurrent test.
    try {
      Object.assign(KITTY_DESIGN_LIMITS, { checkpointBytes: exactBytes - 1 });
      expect(() => h.send('emoji', payload)).toThrow('archival segments'); expect(h.document()).toBe(before);
      Object.assign(KITTY_DESIGN_LIMITS, { checkpointBytes: exactBytes });
      h.send('emoji', payload);
      expect(new TextEncoder().encode(checkpointKittyDesign(h.document())).length).toBe(exactBytes);
      expect(projectKittyDesign(h.document()).pieces[0]!.piece.paint.stamps).toHaveLength(1);
    } finally { Object.assign(KITTY_DESIGN_LIMITS, { checkpointBytes: original }); }
  });
});
