import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appPath = fileURLToPath(new URL("../src/App.tsx", import.meta.url));
const chooserPath = fileURLToPath(new URL("../src/ConflictResolution.tsx", import.meta.url));
const commandSurfacePath = fileURLToPath(new URL("../src/commandSurface.tsx", import.meta.url));
const syncFreshnessPath = fileURLToPath(new URL("../src/syncFreshness.ts", import.meta.url));

describe("automatic continuity reconciliation", () => {
  it("has no phone-versus-cloud chooser in the app shell", () => {
    expect(existsSync(chooserPath)).toBe(false);
    expect(readFileSync(appPath, "utf8")).not.toMatch(/ConflictResolution|showConflictSheet|resolveConflictSide/);
    expect(readFileSync(appPath, "utf8")).toMatch(/shouldSeedPending[\s\S]*liveHousehold: shouldSeedPending/);
    expect(readFileSync(commandSurfacePath, "utf8")).not.toMatch(/Two versions need review|Review conflict/);
    expect(readFileSync(syncFreshnessPath, "utf8")).not.toMatch(/Review conflict/);
  });
});
