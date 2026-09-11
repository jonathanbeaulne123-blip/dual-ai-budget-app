import type { QuickSampleInput } from "./core/quickSampleData.ts";
import type { CommitResult, Household } from "./core/types.ts";

/** Keep the accounting command's repeated cloning off the interaction thread. */
export function prepareQuickSample(household: Household, input: QuickSampleInput): Promise<CommitResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./quickSample.worker.ts", import.meta.url), { type: "module" });
    const finish = () => { clearTimeout(timer); worker.terminate(); };
    const timer = setTimeout(() => { finish(); reject(new Error("Sample preparation took too long. Your books were not changed. Try again.")); }, 15000);
    worker.onmessage = (event: MessageEvent<{ result?: CommitResult; error?: string }>) => {
      finish();
      if (event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error || "Sample data could not be prepared."));
    };
    worker.onerror = () => { finish(); reject(new Error("Sample data could not be prepared. Reload Hearth and try again; your books were not changed.")); };
    try { worker.postMessage({ household, input }); }
    catch (error) { finish(); reject(error); }
  });
}
