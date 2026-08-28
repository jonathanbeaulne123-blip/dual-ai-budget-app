// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KitchenNotice } from "../src/KitchenNotice.tsx";
import { humanizeKitchenNotice } from "../src/kitchenNotice.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("humanizeKitchenNotice", () => {
  it("tells a member how to link Google to this kitchen", () => {
    const copy = humanizeKitchenNotice("This Google account is not linked to that Hearth member.");
    expect(copy.id).toBe("google-member-mismatch");
    expect(copy.primary).toMatch(/not linked to the person on this kitchen/i);
    expect(copy.steps).toMatch(/Google household bridge/i);
    expect(copy.steps).toMatch(/Link next to your name/i);
    expect(copy.action).toEqual({ kind: "more", label: "Open More" });
  });

  it("keeps the PGlite receipt fail-closed and names reload", () => {
    const copy = humanizeKitchenNotice("PGlite has no acceptance receipt for this snapshot revision. Nothing was discarded.");
    expect(copy.id).toBe("pglite-receipt");
    expect(copy.primary).toMatch(/step behind/i);
    expect(copy.primary).toMatch(/nothing was discarded/i);
    expect(copy.steps).toMatch(/Reload Hearth/i);
    expect(copy.action).toEqual({ kind: "reload", label: "Reload" });
  });

  it("maps sign-in-before-bank and field errors to 1–2 steps", () => {
    expect(humanizeKitchenNotice("Continue with Google before connecting a bank.").steps).toMatch(/Continue with Google/i);
    expect(humanizeKitchenNotice("Enter an amount.").steps).toMatch(/Fix that/i);
  });
});

describe("KitchenNotice", () => {
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
  });

  it("stays compact, names the fix, and dismisses like the sync chip", () => {
    const onGoMore = vi.fn();
    const onDismiss = vi.fn();
    act(() => root.render(createElement(KitchenNotice, {
      message: "This Google account is not linked to that Hearth member.",
      onGoMore,
      onDismiss,
    })));
    const banner = container.querySelector(".kitchen-notice") as HTMLElement;
    expect(banner.getAttribute("data-notice-id")).toBe("google-member-mismatch");
    expect(banner.className).toMatch(/kitchen-notice--warning/);
    expect(banner.textContent).toMatch(/Google household bridge/i);
    expect(container.querySelector(".kitchen-notice__close")?.getAttribute("aria-label")).toBe("Dismiss");

    act(() => (container.querySelector(".kitchen-notice__action") as HTMLButtonElement).click());
    expect(onGoMore).toHaveBeenCalledTimes(1);

    act(() => (container.querySelector(".kitchen-notice__close") as HTMLButtonElement).click());
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".kitchen-notice")).toBeNull();
  });

  it("reloads for a missing PGlite receipt without ingesting", () => {
    const onReload = vi.fn();
    act(() => root.render(createElement(KitchenNotice, {
      message: "PGlite has no acceptance receipt for this snapshot revision. Nothing was discarded.",
      onReload,
    })));
    expect(container.querySelector("[data-notice-id='pglite-receipt']")).not.toBeNull();
    act(() => (container.querySelector(".kitchen-notice__action") as HTMLButtonElement).click());
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
