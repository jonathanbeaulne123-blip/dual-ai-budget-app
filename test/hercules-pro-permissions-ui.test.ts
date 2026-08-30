// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogHousehold } from "../src/core/index.ts";
import { HerculesProPermissionsCard } from "../src/HerculesPro.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Hercules Pro startup write gate", () => {
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
});
