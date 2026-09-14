import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { WorldBankInput, WorldPick, WorldQueenInput, WorldRect, QueenWorld as World, WorldStats } from "./world/queenWorld.ts";

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

export function QueenWorld({ root, queen, banks, expanded, breathing, mode = "auto", onLive }: {
  /** The Home root; sculptures are placed where its `.queen-mount` and `[data-world-bank]` elements sit. */
  root: RefObject<HTMLElement | null>;
  queen: WorldQueenInput;
  banks: WorldBankInput[];
  expanded: boolean;
  /** She breathes only at rest, only when motion is welcome. */
  breathing: boolean;
  mode?: QueenWorldMode;
  onLive?: (live: boolean, stats?: () => WorldStats, pick?: WorldPick) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const [live, setLive] = useState(false);
  const latest = useRef({ queen, banks, expanded, breathing });
  latest.current = { queen, banks, expanded, breathing };

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
          created = createQueenWorld(element, { reducedMotion: reduced, onLost: () => { created?.dispose(); world.current = null; if (!dead) setLive(false); } });
        } catch {
          if (!dead) setLive(false);
          return;
        }
        world.current = created;
        created.setQueen(latest.current.queen);
        created.setBanks(latest.current.banks);
        setLive(true);
      })
      .catch(() => { if (!dead) setLive(false); });
    return () => {
      dead = true;
      created?.dispose();
      world.current = null;
    };
  }, [wanted, reduced]);

  useEffect(() => { onLive?.(live, live ? () => world.current?.stats() ?? { frames: 0, lastFrameMs: 0, maxFrameMs: 0, sculptures: 0, breathing: false, charms: 0, charmDrawCalls: 0, charmGeometries: 0 } : undefined, live ? (x, y) => world.current?.pick(x, y) ?? null : undefined); }, [live, onLive]);
  useEffect(() => { world.current?.setQueen(queen); }, [queen, live]);
  useEffect(() => { world.current?.setBanks(banks); }, [banks, live]);
  useEffect(() => { world.current?.setBreathing(breathing); }, [breathing, live]);

  // Layout: follow the DOM. Measured on resize, on expand/collapse (through the CSS transition) and whenever a bank element appears.
  useLayoutEffect(() => {
    const rootElement = root.current, element = host.current;
    if (!live || !rootElement || !element || !world.current) return;
    const rect = (el: Element): WorldRect => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const measure = () => {
      const current = world.current;
      const mount = rootElement.querySelector(".queen-mount");
      if (!current || !mount) return;
      const bankRects: Record<string, WorldRect> = {};
      for (const el of rootElement.querySelectorAll<HTMLElement>("[data-world-bank]")) {
        if (el.closest("[inert]")) continue;
        const r = rect(el);
        if (r.w > 8 && r.h > 8) bankRects[el.dataset.worldBank!] = r;
      }
      current.layout({ host: rect(element), queen: rect(mount), banks: bankRects });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(rootElement);
    for (const el of rootElement.querySelectorAll("[data-world-bank], .queen-mount")) observer.observe(el);
    // The expand is a 0.5s CSS transition; keep the sculptures on their controls through it.
    let frames = 0;
    const settle = () => { measure(); if (frames < 40) { frames += 1; raf = requestAnimationFrame(settle); } };
    let raf = requestAnimationFrame(settle);
    const onEnd = () => measure();
    rootElement.addEventListener("transitionend", onEnd);
    return () => { observer.disconnect(); cancelAnimationFrame(raf); rootElement.removeEventListener("transitionend", onEnd); };
  }, [live, expanded, root, banks.length]);

  if (!wanted) return null;
  return <div ref={host} className={`queen-world${live ? " is-live" : ""}`} aria-hidden="true" data-live={live ? "true" : "false"} />;
}
