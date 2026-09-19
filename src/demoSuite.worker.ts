import { generateDemoSuite, verifyDemoSuite, type DemoSuiteManifest, type DemoSuiteOptions } from "./core/demoSuite.ts";
import type { Household } from "./core/types.ts";

/** Demo Suite generation and verification off the interaction thread (D-268: the story is minutes of commands). */
type Request =
  | { kind: "generate"; options: DemoSuiteOptions }
  | { kind: "verify"; household: Household; manifest?: DemoSuiteManifest };

self.onmessage = async (event: MessageEvent<Request>) => {
  try {
    const request = event.data;
    const result = request.kind === "generate"
      ? await generateDemoSuite(request.options)
      : await verifyDemoSuite(request.household, request.manifest);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
