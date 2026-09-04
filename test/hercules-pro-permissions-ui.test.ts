// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogHousehold } from "../src/core/index.ts";
import { HerculesProPermissionsCard } from "../src/HerculesPro.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Hercules Pro startup write gate", () => {
  const componentSource = readFileSync(resolve(process.cwd(), "src/HerculesPro.tsx"), "utf8");
  const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("does not load or enable permission mutations before books are ready", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    act(() => root.render(createElement(HerculesProPermissionsCard, {
      environment: "development",
      household: catalogHousehold(),
      session: { memberId: "MEM-002", view: "household" },
      disabled: true,
    })));

    expect([...container.querySelectorAll("input[type='checkbox']")]).toHaveLength(2);
    expect([...container.querySelectorAll<HTMLInputElement>("input[type='checkbox']")].every((input) => input.disabled)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("routes user permission changes through App cloud authority instead of a component PUT shortcut", () => {
    expect(componentSource).not.toContain('method: input.next ? "PUT" : "GET"');
    expect(componentSource).toContain("await onChangeRequested(next)");
    const start = appSource.indexOf("<HerculesProPermissionsCard");
    const end = appSource.indexOf("<section className=\"card\">", start);
    const flow = appSource.slice(start, end);
    expect(flow).toContain("await enqueueWrite(async () =>");
    expect(flow).toContain("setHerculesProPermissions(current");
    expect(flow).toContain("assertMemberPersonalUpdate(current, result)");
    expect(flow).toContain("return commitHousehold(result.household, result.undo, result.personalMemberId, { forceFlush: true })");
    expect(flow).not.toContain("persistKnownMetadataHousehold");
  });
});
