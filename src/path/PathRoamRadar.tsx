import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import type { PathRoamView } from "./world/pathWorld3d.ts";

/**
 * Free roam (D-286): the little radar that sits on the corner minimap while the camera is yours.
 *
 * It shows the land as circles, the two of you as a separate mark, and where the camera stands with the wedge it can
 * see. Tapping it flies the camera there, so you can always find your way back.
 *
 * It is deliberately cheap: the land and the two of you are React state and change only when the island does; the
 * camera's dot and cone move by writing one `transform` each, straight from the world's `onRoamView`, without
 * re-rendering anything.
 */

export type PathRoamRadarHandle = {
  /** The world moved the free camera (or latched it again, with `null`). */
  show: (view: PathRoamView | null) => void;
};

const BOX = 100;
const PAD = 9;
const EDGE = BOX / 2 - PAD;

type Pose = { mx: number; mz: number; turn: number; cone: string };
type Land = { radius: number; span: number; islands: { x: number; z: number; r: number }[]; us: { x: number; z: number } | null; pose: Pose };

const signature = (view: PathRoamView) =>
  `${view.radius.toFixed(0)}|${view.us ? `${view.us.x.toFixed(0)},${view.us.z.toFixed(0)}` : "-"}|${view.islands.map((i) => `${i.x.toFixed(0)},${i.z.toFixed(0)},${i.r.toFixed(0)}`).join(";")}`;

/**
 * The map is drawn to the land, not to the roam ring: the islands fill the disc and stay legible. It changes only
 * when the island does, so the camera's mark can move without anything being redrawn.
 */
function spanOf(view: PathRoamView): number {
  let far = 60;
  for (const island of view.islands) far = Math.max(far, Math.hypot(island.x, island.z) + island.r);
  if (view.us) far = Math.max(far, Math.hypot(view.us.x, view.us.z) + 8);
  return far * 1.1;
}

/** The cone the camera sees, drawn pointing straight down the map before it is turned. */
function conePath(half: number, reach: number): string {
  const lx = -reach * Math.sin(half), ly = reach * Math.cos(half);
  return `M0 0 L${lx.toFixed(2)} ${ly.toFixed(2)} Q0 ${(reach * 1.08).toFixed(2)} ${(-lx).toFixed(2)} ${ly.toFixed(2)} Z`;
}

export const PathRoamRadar = forwardRef<PathRoamRadarHandle, {
  /** Fly the free camera to this spot on the ground. */
  onGo: (x: number, z: number) => void;
}>(function PathRoamRadar({ onGo }, ref) {
  const [land, setLand] = useState<Land | null>(null);
  const sig = useRef("");
  const scale = useRef(1);
  const here = useRef<SVGGElement>(null);
  const cone = useRef<SVGPathElement>(null);
  const last = useRef<{ x: number; z: number } | null>(null);

  useImperativeHandle(ref, () => ({
    show(view) {
      if (!view) { sig.current = ""; last.current = null; setLand(null); return; }
      const next = signature(view);
      const span = spanOf(view);
      const k = EDGE / Math.max(1, span);
      scale.current = k;
      last.current = { x: view.x, z: view.z };
      // Roamed out past the land, the camera's mark rides the rim rather than leaving the map.
      let mx = view.x * k, mz = view.z * k;
      const out = Math.hypot(mx, mz);
      if (out > EDGE) { mx *= EDGE / out; mz *= EDGE / out; }
      const pose: Pose = {
        mx: BOX / 2 + mx, mz: BOX / 2 + mz, turn: (-view.heading * 180) / Math.PI,
        cone: conePath(view.cone / 2, Math.max(9, Math.min(EDGE * 1.6, view.reach * k))),
      };
      // The first view draws the map; every one after it only moves the camera's mark.
      if (next !== sig.current) {
        sig.current = next;
        setLand({ radius: view.radius, span, islands: view.islands, us: view.us, pose });
        return;
      }
      here.current?.setAttribute("transform", `translate(${pose.mx.toFixed(2)} ${pose.mz.toFixed(2)}) rotate(${pose.turn.toFixed(1)})`);
      cone.current?.setAttribute("d", pose.cone);
    },
  }), []);

  const go = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    // Activated from the keyboard (no pointer): take the camera back over the two of you.
    if (!event.detail || !box.width) {
      const home = land?.us ?? { x: 0, z: 0 };
      onGo(home.x, home.z);
      return;
    }
    const k = scale.current || 1;
    const x = ((event.clientX - box.left) / box.width * BOX - BOX / 2) / k;
    const z = ((event.clientY - box.top) / box.height * BOX - BOX / 2) / k;
    onGo(x, z);
  }, [land, onGo]);

  if (!land) return null;
  const k = EDGE / Math.max(1, land.span);
  const at = (v: number) => BOX / 2 + v * k;
  const ring = Math.min(EDGE + 3, land.radius * k);
  return (
    <button
      type="button"
      className="path-roam-radar"
      onClick={go}
      aria-label="Island map. Tap anywhere on it to fly the camera there; press Enter to fly back over the two of you."
    >
      <svg viewBox={`0 0 ${BOX} ${BOX}`} aria-hidden="true" focusable="false">
        <circle className="path-roam-radar__sea" cx={BOX / 2} cy={BOX / 2} r={EDGE + 6} />
        <circle className="path-roam-radar__ring" cx={BOX / 2} cy={BOX / 2} r={ring} />
        {land.islands.map((island, i) => (
          <circle key={i} className={`path-roam-radar__land${Math.hypot(island.x, island.z) < 1 ? " is-home" : ""}`} cx={at(island.x)} cy={at(island.z)} r={Math.max(3.4, island.r * k)} />
        ))}
        <g ref={here} className="path-roam-radar__here" transform={`translate(${land.pose.mx.toFixed(2)} ${land.pose.mz.toFixed(2)}) rotate(${land.pose.turn.toFixed(1)})`}>
          <path ref={cone} className="path-roam-radar__cone" d={land.pose.cone} />
          <circle className="path-roam-radar__eye" cx="0" cy="0" r="3.4" />
        </g>
        {land.us && (
          <g className="path-roam-radar__us" transform={`translate(${at(land.us.x).toFixed(2)} ${at(land.us.z).toFixed(2)})`}>
            <circle r="5.2" className="path-roam-radar__us-halo" />
            <circle r="2.5" className="path-roam-radar__us-dot" />
          </g>
        )}
      </svg>
      <span className="sr-only">Where the camera is, which way it faces, and where the two of you are.</span>
    </button>
  );
});
