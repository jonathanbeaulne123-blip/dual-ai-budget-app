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
/**
 * How many still frames the layout follow keeps measuring before it sleeps.
 * Long enough that a transition which pauses mid-flight is still followed,
 * short enough that a settled room costs nothing.
 */
const FOLLOW_TAIL_FRAMES = 12;

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
  //
  // Measuring costs a forced layout, so it is never done on a clock of its own.
  // Something that can move a seat — a resize, a scroll, a scrub, the end of a
  // transition — wakes a short follow on the room's own renderer lease, and the
  // follow sleeps again a few still frames after the room comes to rest. Off
  // the screen or behind a hidden tab it does not run at all.
  useLayoutEffect(() => {
    const rootElement = root.current, element = host.current;
    if (!live || !rootElement || !element || !world.current) return;
    const rect = (el: Element): RoomRect => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const measure = (): boolean => {
      const current = world.current;
      if (!current) return false;
      const seats: RoomLayout["seats"] = {};
      for (const el of rootElement.querySelectorAll<HTMLElement>("[data-room-vessel]")) {
        // A control may be larger than what it draws (a small jar keeps a pressable button): the drawn seat inside it, when marked, is what the sculpture fills.
        const r = rect(el.querySelector("[data-room-seat]") ?? el);
        if (r.w > 4 && r.h > 4) seats[el.dataset.roomVessel!] = r;
      }
      const shelves = [...rootElement.querySelectorAll<HTMLElement>("[data-room-shelf]")].map(rect).filter((r) => r.w > 4 && r.h > 4);
      const stageEl = rootElement.querySelector<HTMLElement>("[data-room-stage]");
      const stage = stageEl ? { ...rect(stageEl), floor: Number(stageEl.dataset.roomFloor ?? 0) } : null;
      return current.layout({ host: rect(element), seats, ...(shelves.length ? { shelves } : {}), ...(stage && stage.w > 4 && stage.h > 4 ? { stage } : {}) });
    };
    measure();

    let frame = 0, still = FOLLOW_TAIL_FRAMES, onScreen = true;
    const step = () => {
      frame = 0;
      const current = world.current;
      if (!current || !onScreen || document.hidden) return;
      still = measure() ? 0 : still + 1;
      if (still < FOLLOW_TAIL_FRAMES) frame = current.requestFrame(step);
    };
    /** Something may have moved a seat: follow until the room is still again. */
    const follow = () => {
      const current = world.current;
      if (!current || !onScreen || document.hidden) return;
      still = 0;
      if (!frame) frame = current.requestFrame(step);
    };
    const stop = () => { if (frame) world.current?.cancelFrame(frame); frame = 0; still = FOLLOW_TAIL_FRAMES; };

    const observer = new ResizeObserver(follow);
    observer.observe(element);
    observer.observe(rootElement);
    // A seat of its own can change size without the room changing size.
    for (const el of rootElement.querySelectorAll("[data-room-vessel],[data-room-shelf],[data-room-stage]")) observer.observe(el);
    // The ribbon scrubs and the ledge reorders; both move seats without resizing anything.
    const intersection = typeof IntersectionObserver === "function"
      ? new IntersectionObserver(([entry]) => { onScreen = entry?.isIntersecting ?? true; if (onScreen) follow(); else stop(); })
      : null;
    intersection?.observe(element);
    const onHidden = () => { if (document.hidden) stop(); else follow(); };
    document.addEventListener("visibilitychange", onHidden);
    rootElement.addEventListener("scroll", follow, { capture: true, passive: true });
    rootElement.addEventListener("transitionend", follow);
    rootElement.addEventListener("animationend", follow);
    rootElement.addEventListener("pointerdown", follow);
    rootElement.addEventListener("pointermove", follow, { passive: true });
    window.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("resize", follow);
    follow();
    return () => {
      stop();
      observer.disconnect();
      intersection?.disconnect();
      document.removeEventListener("visibilitychange", onHidden);
      rootElement.removeEventListener("scroll", follow, { capture: true } as EventListenerOptions);
      rootElement.removeEventListener("transitionend", follow);
      rootElement.removeEventListener("animationend", follow);
      rootElement.removeEventListener("pointerdown", follow);
      rootElement.removeEventListener("pointermove", follow);
      window.removeEventListener("scroll", follow);
      window.removeEventListener("resize", follow);
    };
  }, [live, root, vessels.length]);

  if (!wanted) return null;
  return <div ref={host} className={`queen-room-world${live ? " is-live" : ""}`} aria-hidden="true" data-live={live ? "true" : "false"} />;
}
