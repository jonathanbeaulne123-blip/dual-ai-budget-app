import type { Tombstone } from "./types.ts";
import { isValidDateKey } from "./calendar.ts";

export type BoardRow = { id: string; version: number; createdBy: string; createdAt: string; updatedAt: string };
export type BoardTask = BoardRow & { planReference?: { planVersionId: string; planLineId: string }; title: string; assigneeId: string | null; dueDate: string | null; completed: boolean };
export type BoardMilestone = BoardRow & { title: string; dueDate: string | null; completed: boolean };
export type BoardPhoto = BoardRow & {
  id: "BOARD-PHOTO-1" | "BOARD-PHOTO-2" | "BOARD-PHOTO-3";
  mediaId: string | null; caption: string; crop: { x: number; y: number; zoom: number };
};
export type SharedBoardState = { photos: BoardPhoto[]; tasks: BoardTask[]; milestones: BoardMilestone[] };
export const BOARD_ITEM_LIMIT = 200;
export const BOARD_TITLE_LIMIT = 240;
export const emptySharedBoards = (): SharedBoardState => ({ photos: [], tasks: [], milestones: [] });

function row(value: unknown): value is BoardRow {
  if (!value || typeof value !== "object") return false;
  const r = value as BoardRow;
  return typeof r.id === "string" && Number.isSafeInteger(r.version) && r.version > 0
    && typeof r.createdBy === "string" && typeof r.createdAt === "string" && typeof r.updatedAt === "string";
}
function item(value: unknown): value is BoardMilestone {
  const r = value as BoardMilestone;
  return row(value) && typeof r.title === "string" && r.title.trim().length > 0 && r.title.length <= BOARD_TITLE_LIMIT
    && typeof r.completed === "boolean" && (r.dueDate === null || isValidDateKey(r.dueDate));
}
function photo(value: unknown): value is BoardPhoto {
  const r = value as BoardPhoto;
  return row(value) && /^BOARD-PHOTO-[123]$/.test(r.id)
    && (r.mediaId === null || (typeof r.mediaId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(r.mediaId)))
    && typeof r.caption === "string" && r.caption.length <= BOARD_TITLE_LIMIT
    && !!r.crop && Number.isFinite(r.crop.x) && r.crop.x >= 0 && r.crop.x <= 100
    && Number.isFinite(r.crop.y) && r.crop.y >= 0 && r.crop.y <= 100
    && Number.isFinite(r.crop.zoom) && r.crop.zoom >= 1 && r.crop.zoom <= 3;
}
function unique<T extends BoardRow>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const next of items) {
    const old = map.get(next.id);
    if (!old || next.version > old.version || (next.version === old.version && JSON.stringify(next) > JSON.stringify(old))) map.set(next.id, next);
  }
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
export function shapeSharedBoards(value?: Partial<SharedBoardState> | null): SharedBoardState {
  return {
    photos: unique((Array.isArray(value?.photos) ? value.photos : []).filter(photo)).map(r => ({ id:r.id, version:r.version, createdBy:r.createdBy, createdAt:r.createdAt, updatedAt:r.updatedAt, mediaId:r.mediaId, caption:r.caption, crop:{x:r.crop.x,y:r.crop.y,zoom:r.crop.zoom} })),
    tasks: unique((Array.isArray(value?.tasks) ? value.tasks : []).filter(r => item(r) && /^BOARD-TASK-[A-Za-z0-9_-]{1,80}$/.test(r.id) && (r.assigneeId === null || typeof r.assigneeId === "string"))).map(r => ({ id:r.id, version:r.version, createdBy:r.createdBy, createdAt:r.createdAt, updatedAt:r.updatedAt, title:r.title, completed:r.completed, dueDate:r.dueDate, assigneeId:r.assigneeId, ...(r.planReference && typeof r.planReference.planVersionId === "string" && typeof r.planReference.planLineId === "string" ? { planReference: { planVersionId:r.planReference.planVersionId, planLineId:r.planReference.planLineId } } : {}) })),
    milestones: unique((Array.isArray(value?.milestones) ? value.milestones : []).filter(r => item(r) && /^BOARD-MILESTONE-[A-Za-z0-9_-]{1,80}$/.test(r.id))).map(r => ({ id:r.id, version:r.version, createdBy:r.createdBy, createdAt:r.createdAt, updatedAt:r.updatedAt, title:r.title, completed:r.completed, dueDate:r.dueDate })),
  };
}
export function mergeSharedBoards(a: SharedBoardState | undefined, b: SharedBoardState | undefined, tombstones: Tombstone[]): SharedBoardState {
  const left=shapeSharedBoards(a), right=shapeSharedBoards(b), dead=new Set(tombstones.map(t=>t.id));
  return {
    photos:unique([...left.photos,...right.photos]),
    tasks:unique([...left.tasks,...right.tasks]).filter(r=>!dead.has(r.id)),
    milestones:unique([...left.milestones,...right.milestones]).filter(r=>!dead.has(r.id)),
  };
}
