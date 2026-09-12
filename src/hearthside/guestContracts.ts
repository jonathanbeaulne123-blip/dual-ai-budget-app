import {decodeRoomFurniture,type RoomFurnitureLayout} from './roomFurniture.ts';
import type { KittyPaintV1, KittyPieceV1, KittySculptV1 } from '../core/types.ts';
import { shapeKittyPaint, shapeKittySculpt } from '../core/kittyStudio.ts';

export const GUEST_LIMITS = { objects: 12, manifestBytes: 192 * 1024, requestBytes: 256 * 1024, mediaBytes: 8 * 1024 * 1024, totalMediaBytes: 24 * 1024 * 1024, grants: 40, presenceMs: 15_000, cardMs: 7 * 86400_000 } as const;
export type GuestTheme = 'classic' | 'taylor' | 'newfoundland';
export type GuestRoomKind = 'common' | 'studio' | 'conservatory' | 'theatre';
export type GuestMode = 'hosted' | 'anytime';
export type GuestPrincipal = { memberId: string; subject: string };
export type GuestIdentity = { environment: 'development'; subject: string; expires: number; checkedAt: number };
export type GuestSourceItem = { kind: 'experience' | 'note' | 'memory' | 'piece'; id: string; revision: number; designId?: string; x: number; y: number };
export type GuestPrepareInput = { publicationId: string; title: string; welcome: string; theme: GuestTheme; room: GuestRoomKind; mode: GuestMode; items: GuestSourceItem[] };
export type GuestAppearance = { sculpt: KittySculptV1; paint: KittyPaintV1 };
export type GuestMedia = { id: string; kind: 'image' | 'audio'; mime: 'image/png' | 'image/jpeg' | 'audio/webm' | 'audio/mp4' | 'audio/ogg'; sha256: string; byteLength: number; alt: string };
export type GuestObject =
  | { id: string; kind: 'experience'; x: number; y: number; title: string; text: string }
  | { id: string; kind: 'note'; x: number; y: number; text: string }
  | { id: string; kind: 'memory'; x: number; y: number; title: string; captions: { label: string; text: string }[]; media: GuestMedia[]; pieces: GuestAppearance[] }
  | { id: string; kind: 'piece'; x: number; y: number; appearance: GuestAppearance; displaySize: 'standard' };
/** This is the entire visitor-visible publication. It contains no source IDs or private capabilities. */
export type GuestArrangement = { version: 1; title: string; welcome: string; theme: GuestTheme; room: GuestRoomKind; mode: GuestMode; objects: GuestObject[]; furniture?:RoomFurnitureLayout };
/** Private server-to-server proof. Never a visitor/preview/Street response. */
export type GuestMemoryBinding = {id:string;revision:number;publicationId:string|null};
export type GuestSourceProof = { version: 1; selection: GuestPrepareInput; memoryBindings:GuestMemoryBinding[]; digest: string };
export type GuestSourceCapture = { version: 1; arrangement: GuestArrangement; proof: GuestSourceProof; media: { id: string; mime: GuestMedia['mime']; sha256: string; bytes: ArrayBuffer }[] };
export type GuestAcceptance = { version: 1; publicationId: string; digest: string; kind: 'guest'; environment: 'development'; householdId: string; receiptId: string; acceptedAt: number };
export type GuestReview = { version: 1; id: string; ownerMemberId: string; digest: string; arrangement: GuestArrangement; state: 'prepared' | 'accepted' | 'active' | 'revoked'; approvals: { memberId: string; approved: boolean }[] };
export type GuestInvitationReview = { version: 1; id: string; publicationId: string; digest: string; recipientLabel: string; expiresAt: number; state: 'prepared' | 'active' | 'revoked'; approvals: { memberId: string; approved: boolean }[] };
export type GuestStreetCard = { id: string; publicationId: string; title: string; theme: GuestTheme; room: GuestRoomKind; mode: GuestMode; expiresAt: number };
export type GuestPresence = { id: string; label: string; host: boolean };
export type GuestToy = 'chime' | 'firefly' | 'ball';
export type GuestToyEvent = { id: string; toy: GuestToy; x: number; y: number; happenedAt: number };
export type GuestVisit = { version: 1; id: string; arrangement: GuestArrangement; presence: GuestPresence[]; toys: GuestToyEvent[]; serverTime: number };

export function guestAssert(value: unknown, code = 'GUEST_INVALID_INPUT'): asserts value { if (!value) throw Error(code); }
export function guestRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  guestAssert(value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
  guestAssert(Reflect.ownKeys(value).every(key => typeof key === 'string' && keys.includes(key) && 'value' in Object.getOwnPropertyDescriptor(value, key)!)); return value as Record<string, unknown>;
}
export function guestArray<T>(value: unknown, decode: (value: unknown) => T, max = 40): T[] {
  guestAssert(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && value.length <= max && Reflect.ownKeys(value).every(key => typeof key === 'string' && (key === 'length' || /^(0|[1-9]\d*)$/.test(key))));
  const out: T[] = []; for (let i = 0; i < value.length; i++) { const descriptor = Object.getOwnPropertyDescriptor(value, String(i)); guestAssert(descriptor && 'value' in descriptor); out.push(decode(descriptor.value)); } return out;
}
export function guestText(value: unknown, max = 240, empty = false): string { guestAssert(typeof value === 'string' && value.length <= max && (empty || value.trim()) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)); return value; }
export function guestId(value: unknown): string { guestAssert(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value)); return value; }
export function guestOpaque(value: unknown): string { guestAssert(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)); return value; }
export function guestSubject(value: unknown): string { guestAssert(typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value), 'GUEST_UNAUTHENTICATED'); return value; }
export function guestNumber(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number { guestAssert(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max); return value; }
export function guestInteger(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number { const n = guestNumber(value, min, max); guestAssert(Number.isSafeInteger(n)); return n; }
export function guestChoice<T extends string>(value: unknown, choices: readonly T[]): T { guestAssert(typeof value === 'string' && choices.includes(value as T)); return value as T; }
export function guestDigestValue(value: unknown): string { guestAssert(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)); return value; }
export async function guestDigest(value: unknown): Promise<string> { const bytes = value instanceof ArrayBuffer ? value : new TextEncoder().encode(JSON.stringify(value)); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join(''); }
export function guestPrincipals(value: unknown): GuestPrincipal[] { const rows = guestArray(value, raw => { const r = guestRecord(raw, ['memberId', 'subject']); return { memberId: guestId(r.memberId), subject: guestSubject(r.subject) }; }, 16).sort((a,b) => a.memberId.localeCompare(b.memberId)); guestAssert(rows.length >= 2 && new Set(rows.map(r=>r.memberId)).size === rows.length && new Set(rows.map(r=>r.subject)).size === rows.length, 'GUEST_ROSTER_CHANGED'); return rows; }
export function guestPrincipalEqual(a: GuestPrincipal, b: GuestPrincipal): boolean { return a.memberId === b.memberId && a.subject === b.subject; }
export function decodeGuestPrepare(raw: unknown): GuestPrepareInput {
  const r = guestRecord(raw, ['publicationId','title','welcome','theme','room','mode','items']);
  const items = guestArray(r.items, raw => { const row = guestRecord(raw, ['kind','id','revision','designId','x','y']); const kind = guestChoice(row.kind, ['experience','note','memory','piece']); guestAssert(kind === 'piece' || !Object.hasOwn(row,'designId')); return { kind, id: guestId(row.id), revision: guestInteger(row.revision,kind==='piece'?0:1), ...(kind === 'piece' ? { designId: guestId(row.designId) } : {}), x: guestNumber(row.x,.1,.9), y: guestNumber(row.y,.1,.9) }; }, GUEST_LIMITS.objects);
  guestAssert(new Set(items.map(i=>`${i.kind}/${i.designId ?? ''}/${i.id}`)).size === items.length);
  return { publicationId: guestOpaque(r.publicationId), title: guestText(r.title,100), welcome: guestText(r.welcome,800,true), theme: guestChoice(r.theme,['classic','taylor','newfoundland']), room: guestChoice(r.room,['common','studio','conservatory','theatre']), mode: guestChoice(r.mode,['hosted','anytime']), items };
}
/** Closed nested cosmetic fields: source piece/stamp identities are remapped by the source projection. */
export function decodeGuestAppearance(raw: unknown): GuestAppearance {
  const r = guestRecord(raw,['sculpt','paint']), sculpt = guestRecord(r.sculpt,['body','profile','head','ears','eyes','mouth','whiskers','tail','nose','features']);
  guestArray(sculpt.profile, v=>guestNumber(v,.55,1.15),4); if (sculpt.features !== undefined) { const f = guestRecord(sculpt.features,['head','ears','eyes','nose','mouth','whiskers','tail']); Object.values(f).forEach(v=>guestNumber(v,.5,1.8)); }
  const paint = guestRecord(r.paint,['base','parts','strokes','stamps']); guestRecord(paint.parts,['body','head','earL','earR','tail','paws']);
  guestArray(paint.strokes, raw=>{const s=guestRecord(raw,['part','tool','color','size','opacity','mirror','pts']);guestArray(s.pts,v=>guestNumber(v,0,1),6000);return s;},400);
  guestArray(paint.stamps, raw=>guestRecord(raw,['id','anchor','kind','color','trim','part','u','v','size','rotation','text']),64);
  return {sculpt:shapeKittySculpt(sculpt),paint:shapeKittyPaint(paint)};
}
export function guestDisplayPiece(appearance: GuestAppearance): KittyPieceV1 { return { id:'guest-display',createdAt:'2000-01-01T00:00:00.000Z',firedAt:null,...decodeGuestAppearance(appearance) }; }
export function decodeGuestMedia(raw: unknown): GuestMedia { const r=guestRecord(raw,['id','kind','mime','sha256','byteLength','alt']);const kind=guestChoice(r.kind,['image','audio']),mime=guestChoice(r.mime,['image/png','image/jpeg','audio/webm','audio/mp4','audio/ogg']);guestAssert(mime.startsWith(kind+'/'));return {id:guestId(r.id),kind,mime,sha256:guestDigestValue(r.sha256),byteLength:guestInteger(r.byteLength,1,GUEST_LIMITS.mediaBytes),alt:guestText(r.alt,400,true)}; }
export function decodeGuestArrangement(raw: unknown): GuestArrangement {
  const r=guestRecord(raw,['version','title','welcome','theme','room','mode','objects','furniture']);guestAssert(r.version===1);
  const objects=guestArray(r.objects,raw=>{const r=guestRecord(raw,['id','kind','x','y','text','title','captions','media','appearance','displaySize','pieces']),base={id:guestId(r.id),x:guestNumber(r.x,.1,.9),y:guestNumber(r.y,.1,.9)};
    if(r.kind==='experience'){guestRecord(raw,['id','kind','x','y','title','text']);return {...base,kind:'experience' as const,title:guestText(r.title),text:guestText(r.text,4000,true)};}
    if(r.kind==='note'){guestRecord(raw,['id','kind','x','y','text']);return {...base,kind:'note' as const,text:guestText(r.text,4000,true)};}
    if(r.kind==='piece'){guestRecord(raw,['id','kind','x','y','appearance','displaySize']);guestAssert(r.displaySize==='standard');return {...base,kind:'piece' as const,appearance:decodeGuestAppearance(r.appearance),displaySize:'standard' as const};}
    guestRecord(raw,['id','kind','x','y','title','captions','media','pieces']);guestAssert(r.kind==='memory');return {...base,kind:'memory' as const,title:guestText(r.title),captions:guestArray(r.captions,v=>{const c=guestRecord(v,['label','text']);return {label:guestText(c.label,80),text:guestText(c.text,6000,true)};},16),media:guestArray(r.media,decodeGuestMedia,8),pieces:guestArray(r.pieces,decodeGuestAppearance,8)};
  },GUEST_LIMITS.objects);
  guestAssert(new Set(objects.map(o=>o.id)).size===objects.length);
  const furniture=r.furniture===undefined?undefined:decodeRoomFurniture(r.furniture);guestAssert(!furniture||furniture.room===r.room);
  const out:GuestArrangement={...(furniture?{furniture}:{}),version:1,title:guestText(r.title,100),welcome:guestText(r.welcome,800,true),theme:guestChoice(r.theme,['classic','taylor','newfoundland']),room:guestChoice(r.room,['common','studio','conservatory','theatre']),mode:guestChoice(r.mode,['hosted','anytime']),objects};
  guestAssert(new TextEncoder().encode(JSON.stringify(out)).length<=GUEST_LIMITS.manifestBytes,'GUEST_SELECTION_TOO_LARGE');return out;
}

export function decodeGuestSourceProof(raw:unknown):GuestSourceProof {const r=guestRecord(raw,['version','selection','memoryBindings','digest']);guestAssert(r.version===1);const selection=decodeGuestPrepare(r.selection),memoryBindings=guestArray(r.memoryBindings,v=>{const b=guestRecord(v,['id','revision','publicationId']);return {id:guestId(b.id),revision:guestInteger(b.revision,1),publicationId:b.publicationId===null?null:guestId(b.publicationId)};},GUEST_LIMITS.objects);const selected=selection.items.filter(i=>i.kind==='memory');guestAssert(selected.length===memoryBindings.length&&selected.every((m,i)=>m.id===memoryBindings[i]?.id&&m.revision===memoryBindings[i]?.revision));return {version:1,selection,memoryBindings,digest:guestDigestValue(r.digest)};}
