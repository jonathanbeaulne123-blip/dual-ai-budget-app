import { sha256String } from '../core/synchronousHash.ts';
import {
  HEARTHSIDE_ROOMS,
  EXPERIENCE_STATES,
  civilDate,
  choice,
  decodeDesignReference,
  identifier,
  list,
  object,
  revisionValue,
  textValue,
  type DesignReference,
  type HearthsideRoom,
  type SharedExperience,
} from './contracts.ts';

export const PERSONAL_LIFE_VERSION = 1 as const;
export const PERSONAL_LIFE_BYTES = 2 * 1024 * 1024;
export type PersonalLifeAudience = 'personal' | 'household';
export type PersonalLifeReference = {
  audience: PersonalLifeAudience;
  kind: 'chapter' | 'bank' | 'plan-line' | 'task' | 'calendar-event';
  id: string;
  planVersionId?: string;
};
export type PersonalLifeWish = {
  version: 1;
  id: string;
  revision: number;
  title: string;
  intention: string;
  horizon: SharedExperience['horizon'];
  createdBy: string;
  archived: boolean;
  references: PersonalLifeReference[];
};
export type PersonalLifeExperience = {
  version: 1;
  id: string;
  revision: number;
  title: string;
  intention: string;
  state: SharedExperience['state'];
  horizon: SharedExperience['horizon'];
  createdBy: string;
  wishId: string | null;
  livedOn: string | null;
  references: PersonalLifeReference[];
};
export type PersonalLifeNote = {
  version: 1;
  id: string;
  revision: number;
  authorId: string;
  text: string;
  room: HearthsideRoom;
  experienceId: string | null;
  archived: boolean;
};
export type PersonalLifeMemory = {
  version: 1;
  id: string;
  revision: number;
  title: string;
  date: string | null;
  experienceId: string | null;
  createdBy: string;
  recollection: string;
  designs: DesignReference[];
  hideAmounts: boolean;
  keptRevision: number | null;
  withdrawn: boolean;
};
export type PersonalLifePlacement = {
  id: string;
  revision: number;
  room: HearthsideRoom;
  object:
    | { kind: 'experience' | 'note' | 'memory'; id: string }
    | { kind: 'piece'; id: string; designId: string };
  x: number;
  y: number;
};
export type PersonalLifeDesignIndex = {
  version: 1;
  designId: string;
  revision: number;
  pieceIds: string[];
};
export type PersonalLifeShareReceipt = {
  version: 1;
  id: string;
  sourceKind: 'wish' | 'experience' | 'memory';
  sourceId: string;
  sourceRevision: number;
  sourceDigest: string;
  sharedId: string;
  sharedRevision: number;
  copiedAt: string;
};
export type PersonalLifeDocument = {
  version: 1;
  ownerMemberId: string;
  wishes: PersonalLifeWish[];
  experiences: PersonalLifeExperience[];
  notes: PersonalLifeNote[];
  memories: PersonalLifeMemory[];
  placements: PersonalLifePlacement[];
  /** Indexed only by the authenticated design authority. Personal-life commands cannot mint these rows. */
  designs: PersonalLifeDesignIndex[];
  /** Private provenance. This collection must never enter SharedEnvelope. */
  shareReceipts: PersonalLifeShareReceipt[];
};

const unique = <T>(rows: T[], key: (row: T) => string): T[] => {
  if (new Set(rows.map(key)).size !== rows.length) throw Error('PERSONAL_LIFE_DUPLICATE_ID');
  return rows;
};
const nullableId = (value: unknown): string | null => value === null ? null : identifier(value);
const version = (value: unknown): 1 => {
  if (value !== PERSONAL_LIFE_VERSION) throw Error('PERSONAL_LIFE_UPDATE_REQUIRED');
  return PERSONAL_LIFE_VERSION;
};
const digestValue = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw Error('PERSONAL_LIFE_INVALID_DIGEST');
  return value;
};

export const emptyPersonalLife = (ownerMemberId: string): PersonalLifeDocument => ({
  version: PERSONAL_LIFE_VERSION,
  ownerMemberId: identifier(ownerMemberId),
  wishes: [],
  experiences: [],
  notes: [],
  memories: [],
  placements: [],
  designs: [],
  shareReceipts: [],
});

export function decodePersonalLifeReference(value: unknown): PersonalLifeReference {
  const row = object(value, ['audience', 'kind', 'id', 'planVersionId']);
  const kind = choice(row.kind, ['chapter', 'bank', 'plan-line', 'task', 'calendar-event'] as const);
  if (kind !== 'plan-line' && row.planVersionId !== undefined) throw Error('PERSONAL_LIFE_INVALID_REFERENCE');
  if (kind === 'chapter' && row.audience !== 'household') throw Error('PERSONAL_LIFE_PRIVATE_CHAPTER');
  return {
    audience: choice(row.audience, ['personal', 'household'] as const),
    kind,
    id: identifier(row.id),
    ...(kind === 'plan-line' ? { planVersionId: identifier(row.planVersionId) } : {}),
  };
}

export function decodePersonalLifeExperience(value: unknown): PersonalLifeExperience {
  const row = object(value, ['version', 'id', 'revision', 'title', 'intention', 'state', 'horizon', 'createdBy', 'wishId', 'livedOn', 'references']);
  return {
    version: version(row.version),
    id: identifier(row.id),
    revision: revisionValue(row.revision, 1),
    title: textValue(row.title),
    intention: textValue(row.intention, 4000, true),
    state: choice(row.state, EXPERIENCE_STATES),
    horizon: choice(row.horizon, ['tonight', 'season', 'someday'] as const),
    createdBy: identifier(row.createdBy),
    wishId: nullableId(row.wishId),
    livedOn: row.livedOn === null ? null : civilDate(row.livedOn),
    references: unique(list(row.references, decodePersonalLifeReference, 100), ref => `${ref.audience}:${ref.kind}:${ref.planVersionId ?? ''}:${ref.id}`),
  };
}

export function decodePersonalLifeWish(value: unknown): PersonalLifeWish {
  const row=object(value,['version','id','revision','title','intention','horizon','createdBy','archived','references']);
  if(typeof row.archived!=='boolean')throw Error('PERSONAL_LIFE_INVALID_BOOLEAN');
  return {version:version(row.version),id:identifier(row.id),revision:revisionValue(row.revision,1),title:textValue(row.title),intention:textValue(row.intention,4000,true),
    horizon:choice(row.horizon,['tonight','season','someday'] as const),createdBy:identifier(row.createdBy),archived:row.archived,
    references:unique(list(row.references,decodePersonalLifeReference,100),ref=>`${ref.audience}:${ref.kind}:${ref.planVersionId??''}:${ref.id}`)};
}

export function decodePersonalLifeNote(value: unknown): PersonalLifeNote {
  const row = object(value, ['version', 'id', 'revision', 'authorId', 'text', 'room', 'experienceId', 'archived']);
  if (typeof row.archived !== 'boolean') throw Error('PERSONAL_LIFE_INVALID_BOOLEAN');
  return {
    version: version(row.version), id: identifier(row.id), revision: revisionValue(row.revision, 1),
    authorId: identifier(row.authorId), text: textValue(row.text, 4000), room: choice(row.room, HEARTHSIDE_ROOMS),
    experienceId: nullableId(row.experienceId), archived: row.archived,
  };
}

export function decodePersonalLifeMemory(value: unknown): PersonalLifeMemory {
  const row = object(value, ['version', 'id', 'revision', 'title', 'date', 'experienceId', 'createdBy', 'recollection', 'designs', 'hideAmounts', 'keptRevision', 'withdrawn']);
  if (typeof row.hideAmounts !== 'boolean' || typeof row.withdrawn !== 'boolean') throw Error('PERSONAL_LIFE_INVALID_BOOLEAN');
  const revision = revisionValue(row.revision, 1);
  const keptRevision = row.keptRevision === null ? null : revisionValue(row.keptRevision, 1);
  if (keptRevision !== null && keptRevision !== revision || row.withdrawn && keptRevision !== null) throw Error('PERSONAL_LIFE_INVALID_KEEP');
  return {
    version: version(row.version), id: identifier(row.id), revision,
    title: textValue(row.title), date: row.date === null ? null : civilDate(row.date), experienceId: nullableId(row.experienceId),
    createdBy: identifier(row.createdBy), recollection: textValue(row.recollection, 6000, true),
    designs: unique(list(row.designs, decodeDesignReference, 20), ref => `${ref.documentId}:${ref.pieceId}:${ref.revision}`),
    hideAmounts: row.hideAmounts, keptRevision, withdrawn: row.withdrawn,
  };
}

export function decodePersonalLifePlacement(value: unknown): PersonalLifePlacement {
  const row = object(value, ['id', 'revision', 'room', 'object', 'x', 'y']);
  const target = object(row.object, ['kind', 'id', 'designId']);
  if (target.kind !== 'piece' && target.designId !== undefined) throw Error('PERSONAL_LIFE_INVALID_PLACEMENT');
  for (const coordinate of [row.x, row.y]) if (typeof coordinate !== 'number' || !Number.isFinite(coordinate) || coordinate < 0.08 || coordinate > 0.92) throw Error('PERSONAL_LIFE_PLACEMENT_OUTSIDE_ROOM');
  return {
    id: identifier(row.id), revision: revisionValue(row.revision, 1), room: choice(row.room, HEARTHSIDE_ROOMS),
    object: target.kind === 'piece'
      ? { kind: 'piece', id: identifier(target.id), designId: identifier(target.designId) }
      : { kind: choice(target.kind, ['experience', 'note', 'memory'] as const), id: identifier(target.id) },
    x: Math.round((row.x as number) * 1000) / 1000,
    y: Math.round((row.y as number) * 1000) / 1000,
  };
}

export function decodePersonalLifeDesignIndex(value: unknown): PersonalLifeDesignIndex {
  const row = object(value, ['version', 'designId', 'revision', 'pieceIds']);
  return { version: version(row.version), designId: identifier(row.designId), revision: revisionValue(row.revision), pieceIds: unique(list(row.pieceIds, identifier, 200), id => id) };
}

export function decodePersonalLifeShareReceipt(value: unknown): PersonalLifeShareReceipt {
  const row = object(value, ['version', 'id', 'sourceKind', 'sourceId', 'sourceRevision', 'sourceDigest', 'sharedId', 'sharedRevision', 'copiedAt']);
  const copiedAt = textValue(row.copiedAt, 40);
  if (!Number.isFinite(Date.parse(copiedAt))) throw Error('PERSONAL_LIFE_INVALID_TIME');
  return {
    version: version(row.version), id: identifier(row.id), sourceKind: choice(row.sourceKind, ['wish', 'experience', 'memory'] as const),
    sourceId: identifier(row.sourceId), sourceRevision: revisionValue(row.sourceRevision, 1), sourceDigest: digestValue(row.sourceDigest),
    sharedId: identifier(row.sharedId), sharedRevision: revisionValue(row.sharedRevision, 1), copiedAt,
  };
}

export function decodePersonalLife(value: unknown, ownerMemberId: string): PersonalLifeDocument {
  if (value === undefined) return emptyPersonalLife(ownerMemberId);
  const row = object(value, ['version', 'ownerMemberId', 'wishes', 'experiences', 'notes', 'memories', 'placements', 'designs', 'shareReceipts']);
  const owner = identifier(ownerMemberId);
  if (identifier(row.ownerMemberId) !== owner) throw Error('PERSONAL_LIFE_OWNER_MISMATCH');
  const decoded: PersonalLifeDocument = {
    version: version(row.version), ownerMemberId: owner,
    wishes: unique(list(row.wishes, decodePersonalLifeWish, 1000), item => item.id),
    experiences: unique(list(row.experiences, decodePersonalLifeExperience, 1000), item => item.id),
    notes: unique(list(row.notes, decodePersonalLifeNote, 4000), item => item.id),
    memories: unique(list(row.memories, decodePersonalLifeMemory, 4000), item => item.id),
    placements: unique(list(row.placements, decodePersonalLifePlacement, 160), item => item.id),
    designs: unique(list(row.designs, decodePersonalLifeDesignIndex, 1000), item => item.designId),
    shareReceipts: unique(list(row.shareReceipts, decodePersonalLifeShareReceipt, 4000), item => item.id),
  };
  if ([...decoded.wishes, ...decoded.experiences, ...decoded.notes, ...decoded.memories].some(item => ('createdBy' in item ? item.createdBy : item.authorId) !== owner)) throw Error('PERSONAL_LIFE_OWNER_MISMATCH');
  if(decoded.experiences.some(item=>item.wishId!==null&&!decoded.wishes.some(wish=>wish.id===item.wishId)))throw Error('PERSONAL_LIFE_WISH_MISSING');
  if (new TextEncoder().encode(JSON.stringify(decoded)).length > PERSONAL_LIFE_BYTES) throw Error('PERSONAL_LIFE_LIMIT');
  return decoded;
}

export const personalLifeDigest = (value: unknown): string => sha256String(JSON.stringify(value));
