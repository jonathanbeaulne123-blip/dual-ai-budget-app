/** The reviewed desk, independent of its advancing accepted revision. */
export interface WriteScope {
  generation: number;
  environment: string;
  householdId: string | null;
  memberId: string | null;
  view: string | null;
}

export function sameWriteScope(reviewed: WriteScope, current: WriteScope): boolean {
  return reviewed.householdId !== null && reviewed.memberId !== null
    && reviewed.generation === current.generation
    && reviewed.environment === current.environment
    && reviewed.householdId === current.householdId
    && reviewed.memberId === current.memberId
    && reviewed.view === current.view;
}

/** Check both a stale rendered callback and a scope switch while it is queued. */
export function enqueueScopedWrite<T>(
  enqueue: (work: () => Promise<T | null>) => Promise<T | null>,
  reviewed: WriteScope,
  readCurrent: () => WriteScope,
  work: () => Promise<T | null>,
  refuse: () => void,
): Promise<T | null> {
  if (!sameWriteScope(reviewed, readCurrent())) { refuse(); return Promise.resolve(null); }
  return enqueue(() => {
    if (!sameWriteScope(reviewed, readCurrent())) { refuse(); return Promise.resolve(null); }
    return work();
  });
}
