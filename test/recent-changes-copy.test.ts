import { describe, expect, it } from "vitest";
import {
  recentChangesEmptyCopy,
  recentChangesHeaderPill,
  recentChangesOlderLabel,
} from "../src/recentChangesCopy.ts";

describe("Recent changes copy (D-119 tighten)", () => {
  it("uses last-sync empty copy in Development and LIFO copy in Production", () => {
    expect(recentChangesEmptyCopy("development")).toMatch(/last cloud-acknowledged copy/);
    expect(recentChangesEmptyCopy("development")).not.toMatch(/Only the latest change undoes/);
    expect(recentChangesEmptyCopy("production")).toBe(
      "Only the latest change on this phone can be undone, so the books stay in order.",
    );
  });

  it("labels the pill with since-last-sync only when Development has an anchor", () => {
    expect(recentChangesHeaderPill({
      environment: "development",
      historyCount: 0,
      hasSyncAnchor: true,
    })).toBe("None");
    expect(recentChangesHeaderPill({
      environment: "development",
      historyCount: 3,
      hasSyncAnchor: true,
    })).toBe("3 since last sync");
    expect(recentChangesHeaderPill({
      environment: "development",
      historyCount: 3,
      hasSyncAnchor: false,
    })).toBe("3 on this phone");
    expect(recentChangesHeaderPill({
      environment: "production",
      historyCount: 2,
      hasSyncAnchor: true,
    })).toBe("2 on this phone");
  });

  it("marks older Development rows synced and Production rows later", () => {
    expect(recentChangesOlderLabel("development")).toBe("synced");
    expect(recentChangesOlderLabel("production")).toBe("later");
  });
});
