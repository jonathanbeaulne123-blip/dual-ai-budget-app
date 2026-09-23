import { useEffect, useMemo, useRef, useState } from 'react';
import type { Household } from '../../core/types.ts';
import { decodeHearthside } from '../../hearthside/contracts.ts';
import { eligibleVillageDisplays, VILLAGE_ROOMS, villageRoomConfig, type VillageArrangement, type VillageDisplay, type VillageRoom, type VillageRoomConfig } from './villageArrangement.ts';
import './villageDecorator.css';

export type VillageDecoratorCommit = { kind: 'village-arrangement.save'; expectedRevision: number; value: Omit<VillageArrangement, 'previous'> } | { kind: 'village-arrangement.revert-latest'; expectedRevision: number };
export type VillageDecoratorProps = {
  household: Household;
  memberId: string;
  room: VillageRoom;
  arrangement?: VillageArrangement;
  onCommit: (operation: VillageDecoratorCommit) => Promise<void>;
  onPreview: (config: VillageRoomConfig | null) => void;
  onClose?: () => void;
};

function sameDisplay(left: VillageDisplay, right: VillageDisplay): boolean {
  return left.kind === right.kind && left.id === right.id && left.revision === right.revision && (left.kind === 'piece' ? right.kind === 'piece' && left.designId === right.designId : true);
}

function roomLabel(room: VillageRoom): string { return room.slice(0, 1).toUpperCase() + room.slice(1); }
function displayKey(display: VillageDisplay): string { return display.kind === 'piece' ? `${display.kind}:${display.designId}:${display.id}` : `${display.kind}:${display.id}`; }
function displayLabel(display: VillageDisplay, household: Household, state: ReturnType<typeof decodeHearthside>): string {
  if (display.kind === 'memory') return state.memories.find(memory => memory.id === display.id && memory.revision === display.revision)?.title ?? 'A shared memory';
  const design = state.designs.find(row => row.designId === display.designId && row.revision === display.revision);
  const title = design?.bankId ? household.goals.find(goal => goal.id === design.bankId && goal.shared)?.name ?? 'Our shared design' : 'Our Studio piece';
  const piece = design ? design.pieceIds.indexOf(display.id) + 1 : 0;
  return piece > 0 ? `${title} · piece ${piece}` : title;
}
function isArrangementConflict(error: unknown): boolean { return error instanceof Error && /VILLAGE_ARRANGEMENT_CHANGED|shared arrangement changed|books changed while/i.test(error.message); }

export function VillageDecorator({ household, memberId, room, arrangement, onCommit, onPreview, onClose }: VillageDecoratorProps) {
  const externalRevision = arrangement?.revision ?? 0;
  const external = useMemo(() => villageRoomConfig(arrangement, room), [arrangement, room]);
  const [draft, setDraft] = useState<VillageRoomConfig>(external);
  const [baseRevision, setBaseRevision] = useState(externalRevision);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState('');
  const preview = useRef(onPreview);
  const state = useMemo(() => decodeHearthside(household.hearthside), [household.hearthside]);
  const displays = useMemo(() => eligibleVillageDisplays(household, state), [household, state]);

  useEffect(() => { preview.current = onPreview; }, [onPreview]);
  useEffect(() => () => { preview.current(null); }, [room]);
  useEffect(() => {
    if (!dirty) {
      setDraft(external);
      setBaseRevision(externalRevision);
    }
  }, [dirty, external, externalRevision]);

  const update = (next: VillageRoomConfig) => {
    setDraft(next);
    setDirty(true);
    setMessage('Previewing this room locally. Save when you are ready to share it.');
    preview.current(next);
  };
  const reset = () => {
    setDraft(external);
    setBaseRevision(externalRevision);
    setDirty(false);
    setConflict(false);
    setMessage('Preview cleared.');
    preview.current(null);
  };
  const candidate = (): Omit<VillageArrangement, 'previous'> => ({
    version: 1,
    revision: baseRevision + 1,
    rooms: VILLAGE_ROOMS.map(candidateRoom => candidateRoom === room ? draft : villageRoomConfig(arrangement, candidateRoom)),
  });
  const save = async () => {
    setBusy(true);
    setMessage('Saving shared arrangement…');
    try {
      await onCommit({ kind: 'village-arrangement.save', expectedRevision: baseRevision, value: candidate() });
      setDirty(false);
      setConflict(false);
      setMessage('Shared arrangement saved.');
      preview.current(null);
    } catch (error) {
      const changed = isArrangementConflict(error);
      setConflict(changed);
      setMessage(changed ? 'This shared arrangement changed. Load the latest room before deliberately retrying.' : 'This shared arrangement was not saved. Your preview is still here; try again when the connection is ready.');
    } finally {
      setBusy(false);
    }
  };
  const revert = async () => {
    setBusy(true);
    setMessage('Reverting the latest shared arrangement…');
    try {
      await onCommit({ kind: 'village-arrangement.revert-latest', expectedRevision: baseRevision });
      setDirty(false);
      setConflict(false);
      setMessage('Latest shared arrangement reverted.');
      preview.current(null);
    } catch (error) {
      const changed = isArrangementConflict(error);
      setConflict(changed);
      setMessage(changed ? 'This shared arrangement changed. Load the latest room before deliberately retrying.' : 'The latest shared arrangement was not reverted. Your preview is still here; try again when the connection is ready.');
    } finally {
      setBusy(false);
    }
  };
  const close = () => { reset(); onClose?.(); };
  const available = displays.filter(display => !draft.displays.some(selected => sameDisplay(selected, display)));

  return <aside className="village-decorator" aria-label={`Arrange the shared ${roomLabel(room)} room`}>
    <h3>Arrange the shared {roomLabel(room)}</h3>
    <p>Preview together, then choose Save to share this room with the household.</p>
    <p className="village-decorator-member">Editing as {household.members.find(member => member.id === memberId)?.name || 'a household member'}.</p>
    <label htmlFor="village-layout">Layout<select id="village-layout" value={draft.layout} disabled={busy} onChange={event => update({ ...draft, layout: event.target.value as VillageRoomConfig['layout'] })}><option value="gather">Gathered</option><option value="open">Open</option></select></label>
    <label htmlFor="village-plants">Plants<select id="village-plants" value={draft.plant} disabled={busy} onChange={event => update({ ...draft, plant: event.target.value as VillageRoomConfig['plant'] })}><option value="fern">Ferns</option><option value="flowers">Flowers</option></select></label>
    <label htmlFor="village-light">Light<select id="village-light" value={draft.light} disabled={busy} onChange={event => update({ ...draft, light: event.target.value as VillageRoomConfig['light'] })}><option value="warm">Warm</option><option value="daylight">Daylight</option></select></label>
    <fieldset><legend>Shared artwork and memories</legend>{available.length === 0 && draft.displays.length === 0 ? <p>No mutually shared artwork or memories are available yet.</p> : <>
      {draft.displays.map(display => <label className="village-decorator-display" key={displayKey(display)}><input type="checkbox" checked disabled={busy} onChange={() => update({ ...draft, displays: draft.displays.filter(selected => !sameDisplay(selected, display)) })}/>{displayLabel(display, household, state)}</label>)}
      {available.map(display => <label className="village-decorator-display" key={displayKey(display)}><input type="checkbox" checked={false} disabled={busy || draft.displays.length >= 8} onChange={() => update({ ...draft, displays: [...draft.displays, display] })}/>{displayLabel(display, household, state)}</label>)}
    </>}</fieldset>
    <div className="village-decorator-actions"><button type="button" disabled={busy || !dirty || conflict} onClick={() => void save()}>{busy ? 'Saving…' : 'Save shared arrangement'}</button><button type="button" disabled={busy || !dirty} onClick={reset}>Cancel preview</button>{arrangement?.previous && <button type="button" disabled={busy || dirty || conflict} onClick={() => void revert()}>Revert latest</button>}{conflict && <button type="button" disabled={busy} onClick={reset}>Load latest room</button>}{onClose && <button type="button" disabled={busy} onClick={close}>Close</button>}</div>
    <p role="status" aria-live="polite">{message}</p>
  </aside>;
}
