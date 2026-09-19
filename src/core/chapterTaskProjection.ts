import type { Household } from './types.ts';
import type { Ritual } from './chapters.ts';

// Pure read projection: cosmetic readers must not import Task commands and
// their sync/design validators while the sculpture catalogue is initializing.
export function projectRitualTasks(household: Pick<Household, 'tasks'>, ritual: Ritual): Ritual {
  if (!ritual.taskAdoption) return ritual;
  const heldOn = (household.tasks ?? []).filter(task => task.chapterSource?.kind === 'ritual-occurrence' && task.chapterSource.sourceId === ritual.id && (task.completedAt !== null && !task.deleted || task.chapterSource.legacy?.originalState === 'held')).map(task => task.chapterSource!.onDate!);
  return { ...ritual, heldOn: [...new Set(heldOn)].sort() };
}
