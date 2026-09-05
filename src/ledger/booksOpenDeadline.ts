export const BROWSER_BOOKS_OPEN_TIMEOUT_MS = 12_000;
export const BROWSER_BOOKS_OPERATION_TIMEOUT_MS = 12_000;

export class BrowserBooksOpenTimeoutError extends Error {
  readonly code = "BROWSER_BOOKS_OPEN_TIMEOUT";

  constructor() {
    super("The local books did not finish opening. Close other Hearth tabs, then retry validation. Nothing was cleared or overwritten.");
    this.name = "BrowserBooksOpenTimeoutError";
  }
}

export class BrowserBooksOperationTimeoutError extends Error {
  readonly code = "BROWSER_BOOKS_OPERATION_TIMEOUT";

  constructor() {
    super("The local books transaction took too long. Hearth retired that connection without clearing the accepted books.");
    this.name = "BrowserBooksOperationTimeoutError";
  }
}

type DeadlineOptions = {
  timeoutMs?: number;
  onTimeout?: () => void;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
};

/**
 * Bound browser database startup without pretending the underlying storage was
 * corrupted. The caller owns the opening lifecycle. engine.ts deliberately
 * keeps one raw worker opening in flight after this caller deadline so a retry
 * cannot multiply cross-tab lock requests.
 */
export function withBrowserBooksOpenDeadline<T>(
  opening: Promise<T>,
  options: DeadlineOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? BROWSER_BOOKS_OPEN_TIMEOUT_MS;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimer(() => {
      try {
        options.onTimeout?.();
      } catch {
        // A failed worker retirement must not recreate the infinite wait this
        // deadline exists to prevent.
      }
      reject(new BrowserBooksOpenTimeoutError());
    }, timeoutMs);
  });

  return Promise.race([opening, timeout]).finally(() => {
    if (timer !== undefined) clearTimer(timer);
  });
}

/**
 * Bound a worker-backed PGlite query/transaction. Retiring the client releases
 * its cross-tab lock, which lets the elected worker roll back an unfinished
 * transaction before a fresh client retries against the same durable IDB.
 */
export function withBrowserBooksOperationDeadline<T>(
  operation: Promise<T>,
  options: DeadlineOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? BROWSER_BOOKS_OPERATION_TIMEOUT_MS;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimer(() => {
      try {
        options.onTimeout?.();
      } catch {
        // The deadline must still reject if the stale client is already gone.
      }
      reject(new BrowserBooksOperationTimeoutError());
    }, timeoutMs);
  });
  return Promise.race([operation, timeout]).finally(() => {
    if (timer !== undefined) clearTimer(timer);
  });
}
