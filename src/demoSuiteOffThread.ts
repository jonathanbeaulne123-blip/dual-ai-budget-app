import { generateDemoSuite, verifyDemoSuite, type DemoRunReport, type DemoSuiteManifest, type DemoSuiteOptions } from "./core/demoSuite.ts";
import type { Household } from "./core/types.ts";

/**
 * The Demo Suite is thousands of commands, each cloning the whole household; the Our Story habitat
 * (twenty-five months) takes minutes. Run it in a worker so the page stays responsive, and fall back
 * to the same functions inline where workers do not exist (tests, very old browsers).
 */
function inWorker<T>(message: unknown): Promise<T> | null {
  if (typeof Worker !== "function") return null;
  return new Promise<T>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./demoSuite.worker.ts", import.meta.url), { type: "module", name: "hearth-demo-suite" });
    } catch (error) {
      reject(error);
      return;
    }
    worker.onmessage = (event: MessageEvent<{ result?: T; error?: string }>) => {
      worker.terminate();
      if (event.data.error !== undefined || event.data.result === undefined) reject(new Error(event.data.error || "The synthetic household could not be prepared."));
      else resolve(event.data.result);
    };
    worker.onerror = (event) => {
      worker.terminate();
      event.preventDefault?.();
      reject(new Error("The synthetic household could not be prepared in the background. Reload Hearth and try again; nothing was changed."));
    };
    try { worker.postMessage(message); }
    catch (error) { worker.terminate(); reject(error); }
  });
}

export function generateDemoSuiteOffThread(options: DemoSuiteOptions): Promise<{ household: Household; manifest: DemoSuiteManifest }> {
  return inWorker<{ household: Household; manifest: DemoSuiteManifest }>({ kind: "generate", options }) ?? generateDemoSuite(options);
}

export function verifyDemoSuiteOffThread(household: Household, manifest?: DemoSuiteManifest): Promise<DemoRunReport> {
  return inWorker<DemoRunReport>({ kind: "verify", household, manifest }) ?? verifyDemoSuite(household, manifest);
}
