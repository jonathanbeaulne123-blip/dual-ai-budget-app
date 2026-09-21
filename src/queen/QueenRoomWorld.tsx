import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { QueenRoom, RoomLayout, RoomRect, RoomStats, RoomVessel, QueenRoomWorld as World } from "./world/queenRoomWorld.ts";

/**
 * The WebGL host for a room. Decorative: `aria-hidden`, no controls of its
 * own. It finds the elements carrying `data-room-vessel` and stands a sculpture
 * behind each one, so the button the keyboard and the screen reader use is the
 * one the eye lands on.
 *
 * Detect and degrade silently: forced colours, a failed context, a lost context
 * or `world="flat"` leave the drawn room in place and this renders nothing.
 */
export function QueenRoomWorld({ room, root, vessels, ambient = false, mode = "auto", onLive }: {
  room: QueenRoom;
  /** The room's own element; the seats are found inside it. */
  root: RefObject<HTMLElement | null>;
  vessels: RoomVessel[];
  ambient?: boolean;
  mode?: "auto" | "flat" | "3d";
  onLive?: (live: boolean, stats?: () => RoomStats) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const [live, setLive] = useState(false);
  const latest = useRef({ vessels, ambient });
  latest.current = { vessels, ambient };

  const wanted = mode !== "flat" && (mode === "3d" || (typeof matchMedia !== "function" || !matchMedia("(forced-colors: active)").matches));
  const reduced = (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)
    || (typeof document !== "undefined" && document.documentElement.dataset.motion === "reduced");

  useEffect(() => {
    const element = host.current;
    if (!element || !wanted) { setLive(false); return; }
    let dead = false;
    let created: World | null = null;
    import("./world/queenRoomWorld.ts")
      .then(({ createQueenRoomWorld }) => {
        if (dead) return;
        try {
          created = createQueenRoomWorld(element, { room, reducedMotion: reduced, onLost: () => { created?.dispose(); world.current = null; if (!dead) setLive(false); } });
        } catch {
          if (!dead) setLive(false);
          return;
        }
        world.current = created;
        created.setVessels(latest.current.vessels);
        created.setAmbient(latest.current.ambient);
        setLive(true);
      })
      .catch(() => { if (!dead) setLive(false); });
    return () => { dead = true; created?.dispose(); world.current = null; };
  }, [wanted, reduced, room]);

  useEffect(() => { onLive?.(live, live ? () => world.current?.stats() ?? { frames: 0, lastFrameMs: 0, maxFrameMs: 0, vessels: 0, ambient: false, geometries: 0 } : undefined); }, [live, onLive]);
  useEffect(() => { world.current?.setVessels(vessels); }, [vessels, live]);
  useEffect(() => { world.current?.setAmbient(ambient); }, [ambient, live]);

  // Follow the DOM: the sculptures sit exactly where their controls sit, through every scrub and every resize.
  useLayoutEffect(() => {
    const rootElement = root.current, element = host.current;
    if (!live || !rootElement || !element || !world.current) return;
    const rect = (el: Element): RoomRect => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const measure = () => {
      const current = world.current;
      if (!current) return;
      const seats: RoomLayout["seats"] = {};
      for (const el of rootElement.querySelectorAll<HTMLElement>("[data-room-vessel]")) {
        // A control may be larger than what it draws (a small jar keeps a pressable button): the drawn seat inside it, when marked, is what the sculpture fills.
        const r = rect(el.querySelector("[data-room-seat]") ?? el);
        if (r.w > 4 && r.h > 4) seats[el.dataset.roomVessel!] = r;
      }
      const shelves = [...rootElement.querySelectorAll<HTMLElement>("[data-room-shelf]")].map(rect).filter((r) => r.w > 4 && r.h > 4);
      const stageEl = rootElement.querySelector<HTMLElement>("[data-room-stage]");
      const stage = stageEl ? { ...rect(stageEl), floor: Number(stageEl.dataset.roomFloor ?? 0) } : null;
      current.layout({ host: rect(element), seats, ...(shelves.length ? { shelves } : {}), ...(stage && stage.w > 4 && stage.h > 4 ? { stage } : {}) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(rootElement);

    // The ribbon scrubs and the ledge reorders; both move seats without resizing
    // anything, so this has to keep measuring per frame while the room is in
    // front of someone. What it must NOT do is keep measuring when nobody can
    // see it: `measure` walks the room with querySelectorAll and forces a layout
    // flush through getBoundingClientRect, and this loop used the native
    // requestAnimationFrame directly, so neither the world frame scheduler nor
    // the renderer lease's suspend could stop it. A hidden tab or a scrolled-away
    // room burned a 60Hz reflow loop on the main thread for as long as it stayed
    // mounted. Gated the way every other surface in the app already is; the
    // measurement cadence while on screen is unchanged, so nothing moves
    // differently.
    let raf = 0;
    let following = false;
    let onScreen = true;
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; following = false; };
    const follow = () => { measure(); raf = requestAnimationFrame(follow); };
    const start = () => { if (following) return; following = true; raf = requestAnimationFrame(follow); };
    // Re-measure on the way back in: the room may have moved while unwatched.
    const sync = () => { if (document.hidden || !onScreen) stop(); else { measure(); start(); } };
    const seen = new IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      sync();
    });
    seen.observe(element);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      stop();
      observer.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [live, root, vessels.length]);

  if (!wanted) return null;
  return <div ref={host} className={`queen-room-world${live ? " is-live" : ""}`} aria-hidden="true" data-live={live ? "true" : "false"} />;
}
