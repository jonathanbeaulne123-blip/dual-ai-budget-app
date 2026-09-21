import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { WorldBankInput, WorldPick, WorldQueenInput, WorldRect, QueenWorld as World, WorldStats } from "./world/queenWorld.ts";
import type { QueenSceneryKind } from "./world/queenScenery.ts";

/**
 * The WebGL host for the Home world. Decorative: `aria-hidden`, no controls of
 * its own. It finds the DOM elements that stand for her and her banks and
 * places the sculptures behind them, so the buttons the keyboard and the
 * screen reader use are the same ones the eye lands on.
 *
 * Detect and degrade silently: forced colours, a failed context, a lost
 * context or an explicit `world="flat"` leave the flat figure in place and
 * this component renders nothing.
 */
export type QueenWorldMode = "auto" | "flat" | "3d";

/** How many still frames the layout settle keeps measuring before it sleeps. */
const SETTLE_TAIL_FRAMES = 12;

export function QueenWorld({ root, queen, banks, expanded, breathing, scenery = null, sceneryPaper, ambient = false, mode = "auto", onLive, onModel }: {
  /** The Home root; sculptures are placed where its `.queen-mount` and `[data-world-bank]` elements sit. */
  root: RefObject<HTMLElement | null>;
  queen: WorldQueenInput;
  banks: WorldBankInput[];
  expanded: boolean;
  /** She breathes only at rest, only when motion is welcome. */
  breathing: boolean;
  /** The place she is in: the shared-home scene's own world, or null for the bare field. */
  scenery?: QueenSceneryKind | null;
  /** The page's own paper, so the world's sky fades into it and the canvas has no visible edge. */
  sceneryPaper?: string;
  /** Whether that world moves on its own. Off under reduced motion or a paused atmosphere. */
  ambient?: boolean;
  mode?: QueenWorldMode;
  onLive?: (live: boolean, stats?: () => WorldStats, pick?: WorldPick) => void;
  /** Whether Jonathan's sculpted Queen is the one standing in the world, or her drawn figure. */
  onModel?: (state: "model" | "drawn") => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const [live, setLive] = useState(false);
  const latest = useRef({ queen, banks, expanded, breathing, scenery, sceneryPaper, ambient, onModel });
  latest.current = { queen, banks, expanded, breathing, scenery, sceneryPaper, ambient, onModel };

  const wanted = mode !== "flat" && (mode === "3d" || (typeof matchMedia !== "function" || !matchMedia("(forced-colors: active)").matches));
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
    || (typeof document !== "undefined" && document.documentElement.dataset.motion === "reduced");

  useEffect(() => {
    const element = host.current;
    if (!element || !wanted) { setLive(false); return; }
    let dead = false;
    let created: World | null = null;
    import("./world/queenWorld.ts")
      .then(({ createQueenWorld }) => {
        if (dead) return;
        try {
          created = createQueenWorld(element, { reducedMotion: reduced, onModel: (state) => { if (!dead) latest.current.onModel?.(state); }, onLost: () => { created?.dispose(); world.current = null; if (!dead) setLive(false); } });
        } catch {
          if (!dead) setLive(false);
          return;
        }
        world.current = created;
        created.setQueen(latest.current.queen);
        created.setBanks(latest.current.banks);
        created.setScenery(latest.current.scenery, latest.current.sceneryPaper);
        created.setAmbient(latest.current.ambient);
        setLive(true);
      })
      .catch(() => { if (!dead) setLive(false); });
    return () => {
      dead = true;
      created?.dispose();
      world.current = null;
    };
  }, [wanted, reduced]);

  useEffect(() => { onLive?.(live, live ? () => world.current?.stats() ?? { frames: 0, lastFrameMs: 0, maxFrameMs: 0, sculptures: 0, breathing: false, scenery: "none", ambient: false, sceneryGeometries: 0, charms: 0, charmDrawCalls: 0, charmGeometries: 0, keyLight: 0, keyHeight: 0, keyColor: "", rings: 0, tipped: false, model: "drawn" } : undefined, live ? (x, y) => world.current?.pick(x, y) ?? null : undefined); }, [live, onLive]);
  useEffect(() => { world.current?.setQueen(queen); }, [queen, live]);
  useEffect(() => { world.current?.setBanks(banks); }, [banks, live]);
  useEffect(() => { world.current?.setBreathing(breathing); }, [breathing, live]);
  useEffect(() => { world.current?.setScenery(scenery, sceneryPaper); }, [scenery, sceneryPaper, live]);
  useEffect(() => { world.current?.setAmbient(ambient); }, [ambient, live]);

  // Layout: follow the DOM. Measured on resize, on expand/collapse (through the CSS transition) and whenever a bank element appears.
  useLayoutEffect(() => {
    const rootElement = root.current, element = host.current;
    if (!live || !rootElement || !element || !world.current) return;
    const rect = (el: Element): WorldRect => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const measure = (): boolean => {
      const current = world.current;
      const mount = rootElement.querySelector(".queen-mount");
      if (!current || !mount) return false;
      const bankRects: Record<string, WorldRect> = {};
      for (const el of rootElement.querySelectorAll<HTMLElement>("[data-world-bank]")) {
        if (el.closest("[inert]")) continue;
        const r = rect(el);
        if (r.w > 8 && r.h > 8) bankRects[el.dataset.worldBank!] = r;
      }
      return current.layout({ host: rect(element), queen: rect(mount), banks: bankRects });
    };
    measure();
    // The expand is a 0.5s CSS transition; keep the sculptures on their
    // controls through it, on her own lease, and stop a few still frames after
    // she comes to rest — never while she is off the screen or the tab is hidden.
    let frame = 0, still = SETTLE_TAIL_FRAMES, onScreen = true;
    const step = () => {
      frame = 0;
      const current = world.current;
      if (!current || !onScreen || document.hidden) return;
      still = measure() ? 0 : still + 1;
      if (still < SETTLE_TAIL_FRAMES) frame = current.requestFrame(step);
    };
    const settle = () => {
      const current = world.current;
      if (!current || !onScreen || document.hidden) return;
      still = 0;
      if (!frame) frame = current.requestFrame(step);
    };
    const stop = () => { if (frame) world.current?.cancelFrame(frame); frame = 0; still = SETTLE_TAIL_FRAMES; };
    const observer = new ResizeObserver(settle);
    observer.observe(element);
    observer.observe(rootElement);
    for (const el of rootElement.querySelectorAll("[data-world-bank], .queen-mount")) observer.observe(el);
    const intersection = typeof IntersectionObserver === "function"
      ? new IntersectionObserver(([entry]) => { onScreen = entry?.isIntersecting ?? true; if (onScreen) settle(); else stop(); })
      : null;
    intersection?.observe(element);
    const onHidden = () => { if (document.hidden) stop(); else settle(); };
    document.addEventListener("visibilitychange", onHidden);
    rootElement.addEventListener("transitionend", settle);
    window.addEventListener("scroll", settle, { passive: true });
    window.addEventListener("resize", settle);
    settle();
    return () => {
      stop();
      observer.disconnect();
      intersection?.disconnect();
      document.removeEventListener("visibilitychange", onHidden);
      rootElement.removeEventListener("transitionend", settle);
      window.removeEventListener("scroll", settle);
      window.removeEventListener("resize", settle);
    };
  }, [live, expanded, root, banks.length]);

  if (!wanted) return null;
  return <div ref={host} className={`queen-world${live ? " is-live" : ""}`} aria-hidden="true" data-live={live ? "true" : "false"} />;
}
