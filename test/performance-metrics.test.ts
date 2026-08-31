import { afterEach, describe, expect, it, vi } from "vitest";
import { measureHearth, measureHearthSync } from "../src/performanceMetrics.ts";

describe("privacy-safe Hearth performance measures", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records only the supplied static metric name and clears private start markers", async () => {
    const marks: string[] = [];
    const measures: string[] = [];
    const cleared: string[] = [];
    vi.spyOn(performance, "mark").mockImplementation((name) => {
      marks.push(String(name));
      return {} as PerformanceMark;
    });
    vi.spyOn(performance, "measure").mockImplementation((name) => {
      measures.push(String(name));
      return {} as PerformanceMeasure;
    });
    vi.spyOn(performance, "clearMarks").mockImplementation((name) => {
      if (name) cleared.push(String(name));
    });
    vi.spyOn(performance, "getEntriesByName").mockReturnValue([]);

    expect(measureHearthSync("hearth:command:compile", () => 7)).toBe(7);
    await expect(measureHearth("hearth:books:ingest", async () => "ok")).resolves.toBe("ok");

    expect(measures).toEqual(["hearth:command:compile", "hearth:books:ingest"]);
    expect(marks.every((name) => /^hearth:(command:compile|books:ingest):start:\d+$/.test(name))).toBe(true);
    expect(cleared).toEqual(marks);
    expect([...marks, ...measures].join(" ")).not.toMatch(/household|transaction|revision|MEM-|HH-/i);
  });
});
