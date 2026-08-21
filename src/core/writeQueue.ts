/** One household write at a time so undo cannot race a cloud push. */
export function createWriteQueue() {
  let tail: Promise<void> = Promise.resolve();

  return function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = tail.then(work, work);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
