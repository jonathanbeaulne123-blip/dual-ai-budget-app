import { isValidDateKey, type DateKey } from './calendar.ts';
import { canonical } from '../ledgerSync/patch.ts';
import { sha256String } from './synchronousHash.ts';
import { chapterConsentFail, exactChapterRecord } from './chapterConsent.ts';

/** The source names a single operational Task. Earlier authorship stays unknown
 * when the legacy Move or dated Ritual record did not record it. */
export type ChapterTaskSource = {
  version: 1;
  kind: 'chapter-move' | 'ritual-occurrence';
  chapterId: string;
  sourceId: string;
  onDate: DateKey | null;
  materialVersion: number;
  requiresMoneyEvidence: boolean;
  legacy: {
    createdBy: string | null;
    completedAt: string | null;
    completedBy: string | null;
    evidenceRef: string | null;
    originalState: string;
  } | null;
};
export function chapterTaskId(kind: ChapterTaskSource['kind'], sourceId: string, onDate: DateKey | null = null): string {
  return `TASK-${sha256String(canonical(['chapter-task-v1', kind, sourceId, onDate]))}`;
}
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 160;
const iso = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
export function shapeChapterTaskSource(raw: unknown): ChapterTaskSource | undefined {
  if (raw === undefined) return undefined;
  exactChapterRecord(raw, ['version', 'kind', 'chapterId', 'sourceId', 'onDate', 'materialVersion', 'requiresMoneyEvidence', 'legacy']);
  if (raw.version !== 1 || !['chapter-move', 'ritual-occurrence'].includes(String(raw.kind)) || !id(raw.chapterId) || !id(raw.sourceId) || !Number.isSafeInteger(raw.materialVersion) || Number(raw.materialVersion) < 1 || typeof raw.requiresMoneyEvidence !== 'boolean' || (raw.kind === 'chapter-move' ? raw.onDate !== null : typeof raw.onDate !== 'string' || !isValidDateKey(raw.onDate))) chapterConsentFail('This Chapter task reference needs recovery.');
  if (raw.legacy !== null) {
    exactChapterRecord(raw.legacy, ['createdBy', 'completedAt', 'completedBy', 'evidenceRef', 'originalState']);
    const old = raw.legacy;
    if (old.createdBy !== null && !id(old.createdBy) || old.completedAt !== null && !iso(old.completedAt) || old.completedBy !== null && !id(old.completedBy) || old.evidenceRef !== null && !id(old.evidenceRef) || typeof old.originalState !== 'string' || old.originalState.length > 30 || old.completedAt === null && old.completedBy !== null) chapterConsentFail('This earlier task history needs recovery.');
  }
  return structuredClone(raw) as ChapterTaskSource;
}
