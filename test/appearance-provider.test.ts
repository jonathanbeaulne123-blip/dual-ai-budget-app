// @vitest-environment jsdom
import { act, createElement as h, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ThemeProvider, useSceneBinding } from "../src/theme/ThemeProvider.tsx";
import { AppearanceStore } from "../src/theme/appearanceStore.ts";
import { parseAppearance } from "../src/theme/scenes.ts";
import { AppearancePicker } from "../src/theme/AppearancePicker.tsx";
import { HerculesDress } from "../src/HerculesDress.tsx";

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ""; });
it("preserves the same draft node, value and focus through preview, apply, pause and cancel under StrictMode", async () => {
  const api = { read: vi.fn(async () => parseAppearance(null)), write: vi.fn(async () => parseAppearance(null)) };
  const store = new AppearanceStore(api, null);
  let changeDraft!: (value: string) => void;
  function Draft() {
    useSceneBinding("home", "personal", false);
    const [note, setNote] = useState(""); changeDraft = setNote;
    return h("input", { "aria-label": "Draft", value: note, onChange: (event: { target: { value: string } }) => setNote(event.target.value) });
  }
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(h(StrictMode, null, h(ThemeProvider, { store, children: [h(Draft, { key: "draft" }), h(AppearancePicker, { key: "picker" })] }))));
  const input = host.querySelector("input")!;
  await act(async () => { changeDraft("Keep this unfinished note"); input.focus(); });
  await act(async () => store.preview("taylor"));
  expect(document.documentElement.dataset.scene).toBe("showgirl");
  await act(async () => { store.apply("taylor"); store.setAtmosphere(false); store.preview("newfoundland"); });
  expect(document.documentElement.dataset.scene).toBe("quidi-vidi");
  await act(async () => store.cancelPreview());
  expect(document.documentElement.dataset.scene).toBe("showgirl");
  expect(document.documentElement.dataset.atmosphere).toBe("paused");
  expect(host.querySelector("input")).toBe(input);
  expect(input.value).toBe("Keep this unfinished note");
  expect(document.activeElement).toBe(input);
  expect(api.read).not.toHaveBeenCalled(); expect(api.write).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  expect(document.documentElement.dataset.theme).toBeUndefined();
});

it("keeps keyboard focus on Use theme after applying and ignores an unchanged second apply", async () => {
  const store = new AppearanceStore({ read: async () => parseAppearance(null), write: async () => parseAppearance(null) }, null);
  const apply = vi.spyOn(store, "apply");
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(h(ThemeProvider, { store, children: h(AppearancePicker) })));
  await act(async () => store.preview("taylor"));
  const button = host.querySelector<HTMLButtonElement>(".appearance-actions .primary")!;
  await act(async () => { button.focus(); button.click(); });
  expect(document.activeElement).toBe(button);
  expect(store.getSnapshot().saved.theme).toBe("taylor");
  expect(button.getAttribute("aria-disabled")).toBe("true");
  await act(async () => button.click());
  expect(apply).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});

it("honours explicit None independently for automatic hat and neck accessories", async () => {
  const store = new AppearanceStore({ read: async () => parseAppearance(null), write: async () => parseAppearance(null) }, null);
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(h(ThemeProvider, { store, children: h("svg", null, h(HerculesDress, { hat: null, chain: null, collar: null, house: null })) })));
  await act(async () => store.preview("newfoundland"));
  expect(host.querySelector(".herc-theme-sou-wester")).not.toBeNull();
  expect(host.querySelector(".herc-theme-neckerchief")).not.toBeNull();
  await act(async () => store.setAccessoryHidden("hat", true));
  expect(host.querySelector(".herc-theme-sou-wester")).toBeNull();
  expect(host.querySelector(".herc-theme-neckerchief")).not.toBeNull();
  await act(async () => { store.setAccessoryHidden("neck", true); store.preview("taylor"); });
  expect(host.querySelector(".herc-theme-beads")).toBeNull();
  await act(async () => store.setAccessoryHidden("neck", false));
  expect(host.querySelector(".herc-theme-beads")).not.toBeNull();
  await act(async () => root.unmount());
});
