/** Cancels stale account discovery when this phone exits or changes Google identity. */
export function createAccountFlowGate() {
  let generation = 0;
  return {
    begin() {
      generation += 1;
      const current = generation;
      return { isCurrent: () => generation === current };
    },
    cancel() {
      generation += 1;
    },
  };
}
