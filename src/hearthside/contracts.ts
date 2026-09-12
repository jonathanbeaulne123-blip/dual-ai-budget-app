import {decodeSharedLifeRestoreReviews,type SharedLifeRestoreReview} from './sharedLifeRestoreContracts.ts';
import {decodeWinProvenance,type LegacyWinProvenance} from './winMemoryProvenance.ts';
import {decodeFurniturePlacements,type FurniturePlacement} from './roomFurniture.ts';
import {decodeSharedEncounter,type SharedEncounter} from './encounterContracts.ts';
import {decodeArtifactPublication,type ArtifactPublication} from './workspacePublication.ts';
import {decodeRecordedRoom,type RecordedRoom} from './roomHistory.ts';
import {decodeStudioHandoff,type StudioHandoff} from "./studioHandoff.ts";
import {decodeMemoryPublicationBinding,type MemoryPublicationBinding} from './memoryPublication.ts';
/** Versioned, household-visible references. Private content lives in the Vault. */
export const HEARTHSIDE_VERSION = 1 as const;
export const HEARTHSIDE_ROOMS = ['common', 'studio', 'conservatory', 'theatre'] as const;
export type HearthsideRoom = typeof HEARTHSIDE_ROOMS[number];
export const EXPERIENCE_STATES = ['dreaming', 'preparing', 'lived', 'paused', 'archived'] as const;
export const REFERENCE_KINDS = ['chapter', 'bank', 'plan-line', 'task', 'calendar-event', 'piece', 'memory', 'occasion', 'artifact'] as const;
export type SharedReference = { kind: typeof REFERENCE_KINDS[number]; id: string; revision?: number; planVersionId?: string; designId?: string };
/** Metadata only; media and design history are loaded separately. */
export const HEARTHSIDE_METADATA_BYTES = 4 * 1024 * 1024;
export type SharedExperience = {
  version: 1; id: string; revision: number; title: string; intention: string;
  state: typeof EXPERIENCE_STATES[number]; horizon: 'tonight' | 'season' | 'someday';
  createdBy: string; references: SharedReference[];
};
export type DesignReference = { version: 1; documentId: string; pieceId: string; revision: number };
export type MediaReference = { version: 1; contentId: string; revision: number; kind: 'image' | 'audio'; alt: string };
export type Recollection = { memberId: string; text: string };
export type MemoryComposition = {
  version: 1; id: string; revision: number; title: string; date: string | null;
  experienceId: string | null; media: MediaReference[]; designs: DesignReference[];
  recollections: Recollection[]; hideAmounts: boolean;
  approvals: { memberId: string; revision: number }[]; withdrawn: boolean;
  publication?:MemoryPublicationBinding;
  legacySource?:LegacyWinProvenance;
};
export type PersonalOccasion = {
  version: 1; id: string; revision: number; title: string;
  monthDay: string; leapDay: 'february-28' | 'march-1';
  occurrences: { id: string; year: number; date: string; experienceId: string | null; memoryIds: string[] }[];
};
export type PlacedNote = {
  version: 1; id: string; revision: number; authorId: string; text: string;
  room: HearthsideRoom; experienceId: string | null; archived: boolean;
};
export type RoomPlacement = {
  id: string; revision: number; room: HearthsideRoom;
  object: { kind: 'experience' | 'note' | 'memory'; id: string } | { kind: 'piece'; id: string; designId: string };
  /** Bounded semantic coordinates, reinterpreted by each authored scene. */
  x: number; y: number;
};
export type PublicationReference = {
  version: 1; id: string; revision: number; kind: 'memory' | 'guest';
  sourceId: string; sourceRevision: number; manifestDigest: string;
  state: 'prepared' | 'accepted' | 'active' | 'withdrawn';
};
export type HearthsideDesignIndex = {version:1; designId:string; revision:number; displayPieceId:string|null; bankId:string|null; pieceIds:string[]};
export type HearthsideState = {
  version: 1; experiences: SharedExperience[]; notes: PlacedNote[];
  restoreReviews?:SharedLifeRestoreReview[];
  memories: MemoryComposition[]; occasions: PersonalOccasion[];
  encounters?:SharedEncounter[];
  handoffs?:StudioHandoff[];
  roomHistory?:RecordedRoom[];
  furniture?:FurniturePlacement[];
  artifactPublications?:ArtifactPublication[];
  placements: RoomPlacement[]; publications: PublicationReference[]; designs: HearthsideDesignIndex[];
};
export const emptyHearthside = (): HearthsideState => ({ version: 1, experiences: [], notes: [], memories: [], occasions: [], placements: [], publications: [], designs: [] });

export function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
      Reflect.ownKeys(value).some(key => typeof key !== 'string' || !keys.includes(key) || !('value' in Object.getOwnPropertyDescriptor(value, key)!))) throw Error('HEARTHSIDE_INVALID_OBJECT');
  return value as Record<string, unknown>;
}
export function textValue(value: unknown, max = 240, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw Error('HEARTHSIDE_INVALID_TEXT');
  return value;
}
export function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) throw Error('HEARTHSIDE_INVALID_ID');
  return value;
}
export function revisionValue(value: unknown, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw Error('HEARTHSIDE_INVALID_REVISION');
  return value as number;
}
export function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (!choices.includes(value as T)) throw Error('HEARTHSIDE_INVALID_CHOICE');
  return value as T;
}
export function list<T>(value: unknown, decode: (value: unknown) => T, max = 1000): T[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max || Reflect.ownKeys(value).some(key => typeof key !== 'string' || key !== 'length' && !/^(0|[1-9]\d*)$/.test(key))) throw Error('HEARTHSIDE_INVALID_LIST');
  const result: T[] = [];
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !('value' in descriptor)) throw Error('HEARTHSIDE_INVALID_LIST');
    result.push(decode(descriptor.value));
  }
  return result;
}
export function bool(value: unknown): boolean { if (typeof value !== 'boolean') throw Error('HEARTHSIDE_INVALID_BOOLEAN'); return value; }
function version(value: unknown) { if (value !== 1) throw Error('HEARTHSIDE_UPDATE_REQUIRED'); return 1 as const; }
const nullableId = (value: unknown) => value === null ? null : identifier(value);
export function civilDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T12:00:00Z')) || new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) !== value) throw Error('HEARTHSIDE_INVALID_DATE');
  return value;
}
function unique<T>(rows: T[], key: (row: T) => string): T[] {
  if (new Set(rows.map(key)).size !== rows.length) throw Error('HEARTHSIDE_DUPLICATE_ID'); return rows;
}
export function decodeReference(value: unknown): SharedReference {
  const r = object(value, ['kind', 'id', 'revision', 'planVersionId', 'designId']);
  const kind = choice(r.kind, REFERENCE_KINDS);
  if (kind !== 'piece' && r.designId !== undefined) throw Error('HEARTHSIDE_INVALID_REFERENCE');
  if (kind !== 'plan-line' && r.planVersionId !== undefined) throw Error('HEARTHSIDE_INVALID_REFERENCE');
  return { kind, id: identifier(r.id), ...(kind === 'piece' ? {designId: identifier(r.designId)} : {}), ...(kind === 'plan-line' ? {planVersionId: identifier(r.planVersionId)} : {}), ...(r.revision !== undefined ? { revision: revisionValue(r.revision, kind === 'piece' ? 0 : 1) } : {}) };
}
export function decodeExperience(value: unknown): SharedExperience {
  const r = object(value, ['version', 'id', 'revision', 'title', 'intention', 'state', 'horizon', 'createdBy', 'references']);
  return { version: version(r.version), id: identifier(r.id), revision: revisionValue(r.revision, 1), title: textValue(r.title), intention: textValue(r.intention, 4000, true), state: choice(r.state, EXPERIENCE_STATES), horizon: choice(r.horizon, ['tonight', 'season', 'someday']), createdBy: identifier(r.createdBy), references: unique(list(r.references, decodeReference, 100), r => `${r.kind}:${r.planVersionId ?? r.designId ?? ''}:${r.id}`) };
}
export function decodeMediaReference(value: unknown): MediaReference {
  const r = object(value, ['version', 'contentId', 'revision', 'kind', 'alt']);
  return { version: version(r.version), contentId: identifier(r.contentId), revision: revisionValue(r.revision, 1), kind: choice(r.kind, ['image', 'audio']), alt: textValue(r.alt, 1000, true) };
}
export function decodeDesignReference(value: unknown): DesignReference {
  const r = object(value, ['version', 'documentId', 'pieceId', 'revision']);
  return { version: version(r.version), documentId: identifier(r.documentId), pieceId: identifier(r.pieceId), revision: revisionValue(r.revision) };
}
export function decodeMemory(value: unknown): MemoryComposition {
  const r = object(value, ['version', 'id', 'revision', 'title', 'date', 'experienceId', 'media', 'designs', 'recollections', 'hideAmounts', 'approvals', 'withdrawn', 'publication', 'legacySource']);
  return {
    version: version(r.version), id: identifier(r.id), revision: revisionValue(r.revision, 1), title: textValue(r.title), date: r.date === null ? null : civilDate(r.date), experienceId: nullableId(r.experienceId),
    media: list(r.media, decodeMediaReference, 50), designs: list(r.designs, decodeDesignReference, 20),
    recollections: unique(list(r.recollections, value => { const row = object(value, ['memberId', 'text']); return { memberId: identifier(row.memberId), text: textValue(row.text, 6000, true) }; }, 20), row => row.memberId),
    hideAmounts: bool(r.hideAmounts), withdrawn: bool(r.withdrawn),
    ...(r.publication===undefined?{}:{publication:decodeMemoryPublicationBinding(r.publication)}),
    ...(r.legacySource===undefined?{}:{legacySource:decodeWinProvenance(r.legacySource)}),
    approvals: unique(list(r.approvals, value => { const row = object(value, ['memberId', 'revision']); return { memberId: identifier(row.memberId), revision: revisionValue(row.revision, 1) }; }, 20), row => row.memberId),
  };
}
export function decodeOccasion(value: unknown): PersonalOccasion {
  const r = object(value, ['version', 'id', 'revision', 'title', 'monthDay', 'leapDay', 'occurrences']);
  const monthDay = textValue(r.monthDay, 5); civilDate(`2000-${monthDay}`);
  return { version: version(r.version), id: identifier(r.id), revision: revisionValue(r.revision, 1), title: textValue(r.title), monthDay, leapDay: choice(r.leapDay, ['february-28', 'march-1']), occurrences: unique(list(r.occurrences, value => {
    const row = object(value, ['id', 'year', 'date', 'experienceId', 'memoryIds']); const year = revisionValue(row.year, 1900); if (year > 9999) throw Error('HEARTHSIDE_INVALID_YEAR');
    return { id: identifier(row.id), year, date: civilDate(row.date), experienceId: nullableId(row.experienceId), memoryIds: unique(list(row.memoryIds, identifier, 100), id => id) };
  }, 300), row => String(row.year)) };
}
export function decodeNote(value: unknown): PlacedNote {
  const r = object(value, ['version', 'id', 'revision', 'authorId', 'text', 'room', 'experienceId', 'archived']);
  return { version: version(r.version), id: identifier(r.id), revision: revisionValue(r.revision, 1), authorId: identifier(r.authorId), text: textValue(r.text, 4000), room: choice(r.room, HEARTHSIDE_ROOMS), experienceId: nullableId(r.experienceId), archived: bool(r.archived) };
}
export function decodePlacement(value: unknown): RoomPlacement {
  const r = object(value, ['id', 'revision', 'room', 'object', 'x', 'y']); const target = object(r.object, ['kind', 'id', 'designId']);
  if(target.kind!=='piece'&&Object.hasOwn(target,'designId'))throw Error('HEARTHSIDE_INVALID_OBJECT');
  for (const n of [r.x, r.y]) if (typeof n !== 'number' || !Number.isFinite(n) || n < 0.08 || n > 0.92) throw Error('HEARTHSIDE_PLACEMENT_OUTSIDE_ROOM');
  return { id: identifier(r.id), revision: revisionValue(r.revision, 1), room: choice(r.room, HEARTHSIDE_ROOMS), object: target.kind === 'piece' ? {kind:'piece',id:identifier(target.id),designId:identifier(target.designId)} : {kind:choice(target.kind,['experience','note','memory']),id:identifier(target.id)}, x: Math.round((r.x as number) * 1000) / 1000, y: Math.round((r.y as number) * 1000) / 1000 };
}
export function decodePublication(value: unknown): PublicationReference {
  const r = object(value, ['version', 'id', 'revision', 'kind', 'sourceId', 'sourceRevision', 'manifestDigest', 'state']);
  if (typeof r.manifestDigest !== 'string' || !/^[a-f0-9]{64}$/.test(r.manifestDigest)) throw Error('HEARTHSIDE_INVALID_DIGEST');
  return { version: version(r.version), id: identifier(r.id), revision: revisionValue(r.revision, 1), kind: choice(r.kind, ['memory', 'guest']), sourceId: identifier(r.sourceId), sourceRevision: revisionValue(r.sourceRevision, 1), manifestDigest: r.manifestDigest, state: choice(r.state, ['prepared', 'accepted', 'active', 'withdrawn']) };
}
export function decodeDesignIndex(value:unknown):HearthsideDesignIndex {
  const r=object(value,['version','designId','revision','displayPieceId','bankId','pieceIds']);
  const pieceIds=unique(list(r.pieceIds,identifier,200),id=>id);
  const displayPieceId=nullableId(r.displayPieceId);
  if(displayPieceId!==null&&!pieceIds.includes(displayPieceId))throw Error('HEARTHSIDE_INVALID_DISPLAY');
  return {version:version(r.version),designId:identifier(r.designId),revision:revisionValue(r.revision),displayPieceId,bankId:nullableId(r.bankId),pieceIds};
}
export function decodeHearthside(value: unknown): HearthsideState {
  if (value === undefined) return emptyHearthside();
  const r = object(value, ['version', 'experiences', 'notes', 'memories', 'occasions', 'placements', 'publications', 'designs','handoffs','roomHistory','artifactPublications','encounters','furniture','restoreReviews']);
  const decoded = { ...(r.restoreReviews!==undefined?{restoreReviews:decodeSharedLifeRestoreReviews(r.restoreReviews)}:{}),...(r.furniture!==undefined?{furniture:decodeFurniturePlacements(r.furniture)}:{}),...(r.encounters!==undefined?{encounters:unique(list(r.encounters,decodeSharedEncounter,400),r=>r.id)}:{}),...(r.artifactPublications!==undefined?{artifactPublications:unique(list(r.artifactPublications,decodeArtifactPublication,4000),r=>r.id)}:{}),...(r.roomHistory!==undefined?{roomHistory:unique(list(r.roomHistory,decodeRecordedRoom,120),r=>r.id)}:{}),...(r.handoffs!==undefined?{handoffs:unique(list(r.handoffs,decodeStudioHandoff,2000),r=>r.id)}:{}),version: version(r.version), experiences: unique(list(r.experiences, decodeExperience), r => r.id), notes: unique(list(r.notes, decodeNote, 4000), r => r.id), memories: unique(list(r.memories, decodeMemory, 4000), r => r.id), occasions: unique(list(r.occasions, decodeOccasion, 300), r => r.id), placements: unique(list(r.placements, decodePlacement, 160), r => r.id), publications: unique(list(r.publications, decodePublication, 4000), r => r.id), designs:unique(list(r.designs ?? [],decodeDesignIndex,1000),r=>r.designId) };
  if (new TextEncoder().encode(JSON.stringify(decoded)).length > HEARTHSIDE_METADATA_BYTES) throw Error('HEARTHSIDE_METADATA_LIMIT: Shared story storage is full. Your new draft has not been saved.');
  return decoded;
}

export function memoryKeptByEveryone(memory: MemoryComposition, activeMemberIds: string[]): boolean {
  return !memory.withdrawn && activeMemberIds.length >= 2 && activeMemberIds.every(id => memory.approvals.some(a => a.memberId === id && a.revision === memory.revision));
}
export function occasionDate(occasion: PersonalOccasion, year: number): string {
  revisionValue(year, 1900); if (year > 9999) throw Error('HEARTHSIDE_INVALID_YEAR');
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return `${year}-${occasion.monthDay === '02-29' && !leap ? occasion.leapDay === 'february-28' ? '02-28' : '03-01' : occasion.monthDay}`;
}

export type HearthsideContentSnapshot={version:1;environment:'development'|'production';householdId:string;sequence:number;memberIds:string[];state:HearthsideState};
export function decodeHearthsideContent(value:unknown):HearthsideContentSnapshot{
  const r=object(value,['version','environment','householdId','sequence','memberIds','state']);
  return {version:version(r.version),environment:choice(r.environment,['development','production']),householdId:identifier(r.householdId),sequence:revisionValue(r.sequence),memberIds:unique(list(r.memberIds,identifier,20),id=>id),state:decodeHearthside(r.state)};
}
