import { addQuickSampleData, type QuickSampleInput } from "./core/quickSampleData.ts";
import type { Household } from "./core/types.ts";

self.onmessage = (event: MessageEvent<{ household: Household; input: QuickSampleInput }>) => {
  try { self.postMessage({ result: addQuickSampleData(event.data.household, event.data.input) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
};
