import { describe, expect, it, vi } from "vitest";
import { AppearanceStore, appearanceCacheKey } from "../src/theme/appearanceStore.ts";
import { parseAppearance, resolveThemeScene, sceneTokens, TAYLOR_SCENES, NEWFOUNDLAND_SCENES, type Appearance, type AppearanceScope, type SceneRoute } from "../src/theme/scenes.ts";
import type { AppearanceAccount } from "../src/theme/appearanceAccount.ts";

const classic: Appearance = { theme: "classic", atmosphere: true };
const taylor: Appearance = { theme: "taylor", atmosphere: true };
const nf: Appearance = { theme: "newfoundland", atmosphere: true };
const jonathan: AppearanceScope = { environment: "development", userId: "test-jonathan" };
const bianca: AppearanceScope = { environment: "development", userId: "test-bianca" };
const tick = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(account?: Partial<AppearanceAccount>, online: () => boolean = () => true) {
  const cache = new Map<string, string>();
  const api = { read: vi.fn(async () => classic), write: vi.fn(async (_scope: AppearanceScope, appearance: Partial<Appearance>) => parseAppearance(appearance)), ...account };
  return { cache, api, store: new AppearanceStore(api, { getItem: key => cache.get(key) ?? null, setItem: (key, value) => { cache.set(key, value); } }, online) };
}
describe("complete world assignments", () => {
  it("covers twelve distinct eras and twelve destinations without inventing navigation", () => {
    const routes: SceneRoute[] = ["home", "calendar", "plan", "ledger", "more"];
    for (const theme of ["taylor", "newfoundland"] as const) {
      const scenes = ["household", "personal"].flatMap(scope => [...routes, scope === "household" ? "till" : "shift" as SceneRoute].map(route => resolveThemeScene(theme, route as SceneRoute, scope as "household" | "personal").id));
      expect(new Set(scenes).size).toBe(12);
    }
    expect(resolveThemeScene("taylor", "home", "household").id).toBe("lover");
    expect(resolveThemeScene("taylor", "home", "personal").id).toBe("showgirl");
    expect(Object.keys(TAYLOR_SCENES)).toHaveLength(12);
    expect(Object.keys(NEWFOUNDLAND_SCENES)).toHaveLength(12);
  });
  it("keeps technically reached Shared Shift in its worker-specific era", () => {
    expect(resolveThemeScene("taylor", "shift", "household")).toEqual(resolveThemeScene("taylor", "shift", "personal"));
  });
  it("allowlists cosmetic metadata and discards arbitrary fields", () => {
    expect(parseAppearance({ theme: "evil", atmosphere: "yes", userId: "other", role: "admin" })).toEqual(classic);
    expect(parseAppearance(null)).toEqual(classic);
    expect(parseAppearance({ ...taylor, atmosphere: false, role: "admin" })).toEqual({ theme: "taylor", atmosphere: false });
  });
});
describe("account appearance lifecycle", () => {
  it("queues only the changed field while the initial account preference is still loading", async () => {
    const read = deferred<Appearance>();
    const write = vi.fn(async (_scope: AppearanceScope, patch: Partial<Appearance>) => ({ ...taylor, ...patch }));
    const { store } = harness({ read: () => read.promise, write });
    store.connect(jonathan); store.setAtmosphere(false); await tick();
    expect(write.mock.calls[0]?.[1]).toEqual({ atmosphere: false });
    expect(store.getSnapshot().saved).toEqual({ theme: "taylor", atmosphere: false });
    read.resolve(classic); await tick();
    expect(store.getSnapshot().saved.theme).toBe("taylor");
  });
  it("rejects an old PUT response after account switching even when transport ignores abort", async () => {
    const first = deferred<Appearance>();
    const { store } = harness({ write: () => first.promise, read: async scope => scope.userId === bianca.userId ? nf : classic });
    store.connect(jonathan); await tick(); store.apply("taylor");
    store.connect(bianca); await tick(); first.resolve(taylor); await tick();
    expect(store.getSnapshot().saved).toEqual(nf);
  });
  it("previews and cancels without saving or invoking the account writer", async () => {
    const { store, api } = harness(); store.connect(jonathan); await tick();
    store.preview("taylor"); expect(store.getSnapshot().preview).toBe("taylor");
    store.cancelPreview(); expect(store.getSnapshot().saved).toEqual(classic);
    expect(api.write).not.toHaveBeenCalled();
  });
  it("isolates account and environment caches", async () => {
    const { store, cache } = harness({}, () => false);
    store.connect(jonathan); store.apply("taylor");
    store.connect(bianca); expect(store.getSnapshot().saved).toEqual(classic);
    store.apply("newfoundland");
    store.connect({ ...jonathan, environment: "production" }); expect(store.getSnapshot().saved).toEqual(classic);
    store.connect(jonathan); expect(store.getSnapshot().saved).toEqual(taylor);
    expect(cache.get(appearanceCacheKey(bianca))).toContain("newfoundland");
  });
  it("ignores a late response from another account even if transport ignores abort", async () => {
    const read = deferred<Appearance>();
    const { store } = harness({ read: vi.fn().mockImplementationOnce(() => read.promise).mockResolvedValue(nf) });
    store.connect(jonathan); store.connect(bianca); await tick();
    read.resolve(taylor); await tick(); expect(store.getSnapshot().saved).toEqual(nf);
  });
  it("does not overwrite a newer local selection with an older account read", async () => {
    const read = deferred<Appearance>(); const write = deferred<Appearance>();
    const { store } = harness({ read: () => read.promise, write: () => write.promise });
    store.connect(jonathan); store.apply("taylor"); read.resolve(classic); await tick();
    expect(store.getSnapshot().saved).toEqual(taylor);
    write.resolve(taylor); await tick(); expect(store.getSnapshot().status).toBe("saved");
  });
  it("serializes rapid selections and saves the newest one after an older success", async () => {
    const first = deferred<Appearance>();
    const write = vi.fn().mockImplementationOnce(() => first.promise).mockImplementation(async (_scope, appearance) => parseAppearance(appearance));
    const { store } = harness({ write }); store.connect(jonathan); await tick();
    store.apply("taylor"); store.apply("newfoundland"); expect(write).toHaveBeenCalledTimes(1);
    first.resolve(taylor); await tick(); expect(write).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().saved).toEqual(nf); expect(store.getSnapshot().status).toBe("saved");
  });
  it("saves the newest queued selection even if the superseded write fails", async () => {
    const first = deferred<Appearance>();
    const write = vi.fn().mockImplementationOnce(() => first.promise).mockImplementation(async (_scope, appearance) => parseAppearance(appearance));
    const { store } = harness({ write }); store.connect(jonathan); await tick();
    store.apply("taylor"); store.apply("newfoundland"); first.reject(new Error("transient")); await tick();
    expect(write).toHaveBeenCalledTimes(2); expect(store.getSnapshot().status).toBe("saved");
  });
  it("retains failed writes for a same-account retry without looping", async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(taylor);
    const { store, cache } = harness({ write }); store.connect(jonathan); await tick();
    store.apply("taylor"); await tick(); expect(store.getSnapshot().status).toBe("error");
    expect(JSON.parse(cache.get(appearanceCacheKey(jonathan))!).pending).toBe(true);
    expect(write).toHaveBeenCalledTimes(1); await store.refresh();
    expect(write).toHaveBeenCalledTimes(2); expect(store.getSnapshot().status).toBe("saved");
  });
  it("keeps offline selection and sends only when reconnected", async () => {
    let online = false; const { store, api } = harness({}, () => online);
    store.connect(jonathan); store.apply("newfoundland"); await tick();
    expect(api.write).not.toHaveBeenCalled(); expect(store.getSnapshot().status).toBe("pending");
    online = true; await store.refresh(); expect(api.write).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().saved).toEqual(nf);
  });
  it("restores a saved account preference to a fresh device", async () => {
    const { store } = harness({ read: async () => taylor }); store.connect(jonathan); await tick();
    expect(store.getSnapshot().saved).toEqual(taylor); expect(store.getSnapshot().status).toBe("saved");
  });
  it("keeps guest use local and continues when storage is unavailable", async () => {
    const api = { read: vi.fn(), write: vi.fn() };
    const store = new AppearanceStore(api, { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); } });
    store.connect({ environment: "development", userId: null }); store.apply("taylor"); store.setAtmosphere(false); await tick();
    expect(store.getSnapshot().saved).toEqual({ theme: "taylor", atmosphere: false });
    expect(api.read).not.toHaveBeenCalled(); expect(api.write).not.toHaveBeenCalled();
  });
});

function contrast(a: string, b: string): number {
  const luminance = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i]!, 0);
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high! + .05) / (low! + .05);
}
it("keeps authored text and primary-action pairs readable in every scene", () => {
  const scenes = [resolveThemeScene("classic", "home", "household"), ...Object.values(TAYLOR_SCENES), ...Object.values(NEWFOUNDLAND_SCENES)];
  for (const scene of scenes) {
    for (const bg of [scene.palette.paper, scene.palette.card]) {
      expect(contrast(scene.palette.ink, bg), `${scene.id} ink`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(scene.palette.muted, bg), `${scene.id} muted`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(scene.palette.accent, sceneTokens(scene)["--theme-on-accent"]!), `${scene.id} action`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(scene.palette.second, sceneTokens(scene)["--theme-on-second"]!), `${scene.id} secondary action`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(sceneTokens(scene)["--gold"]!, sceneTokens(scene)["--theme-on-gold"]!), `${scene.id} gold action`).toBeGreaterThanOrEqual(4.5);
  }
});
