export type ShiftScanTicket = {
  signal: AbortSignal;
  isCurrent: () => boolean;
};

export type ShiftScanScope = {
  begin: () => ShiftScanTicket;
  cancel: () => void;
};

export function createShiftScanScope(): ShiftScanScope {
  let generation = 0;
  let controller: AbortController | null = null;

  return {
    begin() {
      controller?.abort();
      controller = new AbortController();
      const active = ++generation;
      const signal = controller.signal;
      return {
        signal,
        isCurrent: () => active === generation && !signal.aborted,
      };
    },
    cancel() {
      generation += 1;
      controller?.abort();
      controller = null;
    },
  };
}
