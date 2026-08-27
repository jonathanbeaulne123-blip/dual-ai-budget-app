import { conceptProgressKey, progressStorageKey } from "./identity.ts";
import type { OnboardingProgressIdentity, OnboardingProgressRecord } from "./types.ts";

export type ProgressStore = {
  load(identity: OnboardingProgressIdentity): Promise<OnboardingProgressRecord | null>;
  save(record: OnboardingProgressRecord): Promise<void>;
  clear(identity: OnboardingProgressIdentity): Promise<void>;
};

export type SyncStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function emptyRecord(identity: OnboardingProgressIdentity, nowIso: string): OnboardingProgressRecord {
  return {
    identity,
    status: "in-progress",
    lastSafeSceneId: null,
    completedSceneIds: [],
    completedChapterIds: [],
    updatedAtIso: nowIso,
  };
}

export function createMemoryProgressStore(): ProgressStore {
  const shell = new Map<string, OnboardingProgressRecord>();
  const concept = new Map<string, { completedChapterIds: string[]; completedSceneIds: string[] }>();

  return {
    async load(identity) {
      const key = progressStorageKey(identity);
      const local = shell.get(key);
      if (!local) return null;
      const shared = concept.get(conceptProgressKey(identity));
      if (!shared) return local;
      return {
        ...local,
        completedChapterIds: [...new Set([...local.completedChapterIds, ...shared.completedChapterIds])],
        completedSceneIds: [...new Set([...local.completedSceneIds, ...shared.completedSceneIds])],
      };
    },
    async save(record) {
      shell.set(progressStorageKey(record.identity), record);
      concept.set(conceptProgressKey(record.identity), {
        completedChapterIds: [...record.completedChapterIds],
        completedSceneIds: [...record.completedSceneIds],
      });
    },
    async clear(identity) {
      shell.delete(progressStorageKey(identity));
      // Keep concept shared across shells unless both cleared by caller.
    },
  };
}

export function createLocalProgressStore(storage: SyncStorage): ProgressStore {
  return {
    async load(identity) {
      try {
        const raw = storage.getItem(progressStorageKey(identity));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as OnboardingProgressRecord;
        if (!parsed?.identity?.memberKey) return null;
        return parsed;
      } catch {
        return null;
      }
    },
    async save(record) {
      storage.setItem(progressStorageKey(record.identity), JSON.stringify(record));
      storage.setItem(
        conceptProgressKey(record.identity),
        JSON.stringify({
          completedChapterIds: record.completedChapterIds,
          completedSceneIds: record.completedSceneIds,
        }),
      );
    },
    async clear(identity) {
      storage.removeItem(progressStorageKey(identity));
    },
  };
}

export function markSceneComplete(
  record: OnboardingProgressRecord,
  input: {
    sceneId: string;
    chapterId: string;
    chapterComplete: boolean;
    safeCheckpoint: boolean;
    nowIso: string;
    status?: OnboardingProgressRecord["status"];
  },
): OnboardingProgressRecord {
  const completedSceneIds = record.completedSceneIds.includes(input.sceneId)
    ? record.completedSceneIds
    : [...record.completedSceneIds, input.sceneId];
  const completedChapterIds =
    input.chapterComplete && !record.completedChapterIds.includes(input.chapterId)
      ? [...record.completedChapterIds, input.chapterId]
      : record.completedChapterIds;

  return {
    ...record,
    status: input.status ?? record.status,
    completedSceneIds,
    completedChapterIds,
    lastSafeSceneId: input.safeCheckpoint ? input.sceneId : record.lastSafeSceneId,
    updatedAtIso: input.nowIso,
  };
}

export function markSkipped(
  identity: OnboardingProgressIdentity,
  nowIso: string,
  previous?: OnboardingProgressRecord | null,
): OnboardingProgressRecord {
  return {
    ...(previous ?? emptyRecord(identity, nowIso)),
    identity,
    status: "skipped",
    updatedAtIso: nowIso,
  };
}

export function markCompleted(
  identity: OnboardingProgressIdentity,
  nowIso: string,
  previous?: OnboardingProgressRecord | null,
): OnboardingProgressRecord {
  return {
    ...(previous ?? emptyRecord(identity, nowIso)),
    identity,
    status: "completed",
    updatedAtIso: nowIso,
  };
}

export function resumeSceneId(
  record: OnboardingProgressRecord | null,
  firstSceneId: string,
): string {
  if (!record || record.status === "skipped" || record.status === "completed") {
    return firstSceneId;
  }
  return record.lastSafeSceneId ?? firstSceneId;
}

export function isEligibleForAutoStart(record: OnboardingProgressRecord | null): {
  eligible: boolean;
  reason: string;
} {
  if (!record) return { eligible: true, reason: "no-progress" };
  if (record.status === "completed") return { eligible: false, reason: "completed" };
  if (record.status === "skipped") return { eligible: false, reason: "skipped" };
  return { eligible: true, reason: "in-progress" };
}

export function createEmptyProgress(
  identity: OnboardingProgressIdentity,
  nowIso: string,
): OnboardingProgressRecord {
  return emptyRecord(identity, nowIso);
}
