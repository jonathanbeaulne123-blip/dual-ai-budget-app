import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Environment, LedgerView } from "../core/types.ts";
import { loadSupabaseSession, SUPABASE_SESSION_CHANGED_EVENT } from "../auth/supabaseSession.ts";
import { appearanceAccount } from "./appearanceAccount.ts";
import { AppearanceStore, INITIAL_APPEARANCE } from "./appearanceStore.ts";
import { resolveThemeScene, sceneTokens, type SceneRoute, type ThemeScene } from "./scenes.ts";

type SceneBinding = { route: SceneRoute; view: LedgerView; quiet: boolean };
type ThemeContextValue = {
  store: AppearanceStore; scene: ThemeScene; paused: boolean;
  bind: (binding: SceneBinding) => void;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);
const defaultScene = resolveThemeScene("classic", "entry", "household");
const subscribeNothing = () => () => {};
const initialSnapshot = () => INITIAL_APPEARANCE;
export function useAppearance() {
  const context = useContext(ThemeContext);
  const snapshot = useSyncExternalStore(context?.store.subscribe ?? subscribeNothing, context?.store.getSnapshot ?? initialSnapshot, initialSnapshot);
  return { ...snapshot, store: context?.store, scene: context?.scene ?? defaultScene, paused: context?.paused ?? true };
}
export function ThemeProvider({ children, store: supplied }: { children: ReactNode; store?: AppearanceStore }) {
  const [store] = useState(() => {
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* SSR/private mode */ }
    return supplied ?? new AppearanceStore(appearanceAccount, storage);
  });
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, initialSnapshot);
  const [binding, bind] = useState<SceneBinding>({ route: "entry", view: "household", quiet: false });
  const [reduced, setReduced] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [editing, setEditing] = useState(false);
  const theme = snapshot.preview ?? snapshot.saved.theme;
  const scene = useMemo(() => resolveThemeScene(theme, binding.route, binding.view), [theme, binding.route, binding.view]);
  const paused = !snapshot.saved.atmosphere || reduced || hidden || editing || binding.quiet;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(media.matches);
    const visibility = () => { setHidden(document.hidden); if (!document.hidden) void store.refresh(); };
    const focus = (event: FocusEvent) => setEditing(event.target instanceof HTMLElement && Boolean(event.target.closest("input, textarea, select, [contenteditable=true]")));
    const blur = () => setEditing(false);
    motion(); visibility();
    media.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("focusin", focus); document.addEventListener("focusout", blur);
    window.addEventListener("focus", store.refresh); window.addEventListener("online", store.refresh);
    return () => {
      media.removeEventListener("change", motion); document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("focusin", focus); document.removeEventListener("focusout", blur);
      window.removeEventListener("focus", store.refresh); window.removeEventListener("online", store.refresh);
      store.disconnect();
    };
  }, [store]);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme; root.dataset.scene = scene.id; root.dataset.material = scene.material;
    root.dataset.sceneLighting = scene.dark ? "dark" : "light";
    root.dataset.atmosphere = paused ? "paused" : "playing";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", scene.palette.paper);
    root.style.colorScheme = scene.dark ? "dark" : "light";
    for (const [key, value] of Object.entries(sceneTokens(scene))) root.style.setProperty(key, value);
  }, [scene, theme, paused]);
  useEffect(() => () => {
    const root = document.documentElement;
    for (const key of Object.keys(sceneTokens(defaultScene))) root.style.removeProperty(key);
    for (const key of ["theme", "scene", "material", "sceneLighting", "atmosphere"]) delete root.dataset[key];
    root.style.removeProperty("color-scheme");
  }, []);
  return <ThemeContext.Provider value={useMemo(() => ({ store, scene, paused, bind }), [store, scene, paused])}>{children}</ThemeContext.Provider>;
}

/** Scene-only binding for synthetic specimens: deliberately cannot read Auth. */
export function useSceneBinding(route: SceneRoute, view: LedgerView, quiet: boolean): void {
  const bind = useContext(ThemeContext)?.bind;
  useLayoutEffect(() => { bind?.({ route, view, quiet }); }, [bind, route, view, quiet]);
}

/** A hook so even App's early entry/error returns receive the current account and environment. */
export function useAppearanceBinding(environment: Environment, route: SceneRoute, view: LedgerView, quiet: boolean): void {
  const context = useContext(ThemeContext);
  const store = context?.store;
  const bind = context?.bind;
  useLayoutEffect(() => { bind?.({ route, view, quiet }); }, [bind, route, view, quiet]);
  useEffect(() => {
    if (!store) return;
    let lastSession: string | null | undefined;
    const sync = () => {
      const session = loadSupabaseSession(environment);
      const sessionId = session?.sessionId ?? null;
      if (lastSession !== undefined && lastSession !== sessionId) store.disconnect();
      lastSession = sessionId;
      store.connect({ environment, userId: session?.userId ?? null });
    };
    sync();
    window.addEventListener(SUPABASE_SESSION_CHANGED_EVENT, sync);
    // Auth can change in another tab without the same-document event.
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(SUPABASE_SESSION_CHANGED_EVENT, sync); window.removeEventListener("storage", sync); };
  }, [store, environment]);
}

/** Decorative visibility writes only a DOM attribute; no financial component rerenders. */
export function useAtmosphereVisibility() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      element.dataset.atmosphereVisible = String(entry?.isIntersecting ?? false);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return ref;
}
