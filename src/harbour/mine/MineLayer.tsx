import { useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactElement } from "react";
import type { ProjectedRect } from "../scene/runtime.ts";
import type { HarbourPlaceId } from "../flag.ts";
import type { PathFootpath } from "../../core/pathFootpaths.ts";
import type { MineBank, MineLayer as MineLayerModel, MineStep } from "./mineLayer.ts";
import "./mine.css";

/**
 * The Mine layer, drawn (Tool Atlas §3.5, K4, D2). The signed-in member's
 * private things on the shared harbour, only while the harbour shows Mine:
 *
 * - on the island, the private **footpaths** — the Journey map's own art
 *   (`path/PathMiniMap.tsx` `.path-minimap__footpath`: short dashed strokes,
 *   straw while open, the dressing's green once walked; `our-path-world.css`
 *   `.path-mark--footpath`: a dashed, see-through label), ported to the
 *   harbour as strokes fanning off a trail from Our home to the Glasshouse;
 * - private **steps** as small stakes at the Glasshouse (on the island, at its
 *   door; inside, in the beds);
 * - private **Kitty Banks** on the Loft's private shelf (on the island, at Our
 *   home's door; inside the Loft, on the shelf).
 *
 * A host whose door is not on screen docks its group under the Mine ribbon, so
 * every mark stays one tap away. Every mark is a real button whose accessible
 * name starts with its visible label. The layer never moves money and never
 * writes: a tap asks the App to open that thing's own tool (`onOpen`).
 * No amounts are drawn — labels, dates and states only.
 */
export type MineOpenKind = "footpath" | "step" | "bank";

export type MineLayerViewProps = {
  layer: MineLayerModel;
  place: HarbourPlaceId;
  rects: readonly ProjectedRect[];
  /** Open the thing's own tool; `id` null opens the host's whole list (all your steps, all your Kitty Banks). */
  onOpen: (kind: MineOpenKind, id: string | null) => void;
  hidden?: boolean;
};

/** The island doors each group stands at (`village/layout.ts` entries: the Loft is upstairs in Our home). */
export const MINE_COURT_ANCHORS = Object.freeze({ steps: "visit:glasshouse", banks: "visit:kitchen" });
export const MINE_STAKES_SHOWN = 5;
export const MINE_BANKS_SHOWN = 4;
export const MINE_FOOTPATHS_DRAWN = 8;

type Point = { x: number; y: number };
const centreTop = (rect: ProjectedRect): Point => ({ x: rect.x + rect.w / 2, y: rect.y });
const centre = (rect: ProjectedRect): Point => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });
const at = (point: Point): CSSProperties => ({ left: `clamp(8px, ${Math.round(point.x)}px, calc(100% - 8px))`, top: `max(56px, ${Math.round(point.y)}px)` });

function dayWords(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
function stepWords(step: MineStep): string {
  const when = step.when ? (step.late ? `, was for ${dayWords(step.when)}` : `, for ${dayWords(step.when)}`) : ", no date";
  return `${when}${step.money ? ", a money step: done when your books confirm it" : ""}, only you see this`;
}
function footpathWords(path: PathFootpath): string {
  if (path.money) return path.lit ? "lit: confirmed in your books" : "lights when your books confirm it";
  return path.state === "done" ? "walked" : "still yours to walk";
}

function StakeIcon() {
  return <svg className="mine-stake__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
    <path d="M12 21V6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 6l6 2.5-6 2.5z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M8.5 21h7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}
function BankIcon() {
  return <svg className="mine-bank__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
    <path d="M6 9l1.5-4 3 3h3l3-3L18 9c1.3 1.4 2 3.2 2 5 0 3.9-3.6 7-8 7s-8-3.1-8-7c0-1.8.7-3.6 2-5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M10 12.5h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}

function StepsGroup({ steps, onOpen, style, placed }: { steps: MineStep[]; onOpen: MineLayerViewProps["onOpen"]; style?: CSSProperties; placed: string }) {
  if (!steps.length) return null;
  const shown = steps.slice(0, MINE_STAKES_SHOWN);
  return <div className="mine-group mine-group--steps" data-mine-group="steps" data-mine-placed={placed} role="group" aria-label="Your steps at the Glasshouse, only you see these" style={style}>
    <ul className="mine-stakes">
      {shown.map((step) => <li key={step.id}>
        <button type="button" className="mine-stake" data-mine-step={step.id} data-late={step.late || undefined} data-money={step.money || undefined} onClick={() => onOpen("step", step.id)}>
          <StakeIcon /><span className="mine-stake__flag">{step.label}</span><span className="mine-sr">{stepWords(step)}</span>
        </button>
      </li>)}
    </ul>
    {steps.length > shown.length && <button type="button" className="mine-more" onClick={() => onOpen("step", null)}>All your steps</button>}
  </div>;
}

function BanksGroup({ banks, onOpen, style, placed }: { banks: MineBank[]; onOpen: MineLayerViewProps["onOpen"]; style?: CSSProperties; placed: string }) {
  if (!banks.length) return null;
  const shown = banks.slice(0, MINE_BANKS_SHOWN);
  return <div className="mine-group mine-group--banks" data-mine-group="banks" data-mine-placed={placed} role="group" aria-label="Your private shelf in the Loft: your own Kitty Banks, only you see these" style={style}>
    <ul className="mine-shelf">
      {shown.map((bank) => <li key={bank.id}>
        <button type="button" className="mine-bank" data-mine-bank={bank.id} onClick={() => onOpen("bank", bank.id)}>
          <BankIcon /><span className="mine-bank__name">{bank.label}</span><span className="mine-sr">{`, your Kitty Bank${bank.date ? `, for ${dayWords(bank.date)}` : ""}, only you see this`}</span>
        </button>
      </li>)}
    </ul>
    <span className="mine-shelf__plank" aria-hidden="true" />
    {banks.length > shown.length && <button type="button" className="mine-more" onClick={() => onOpen("bank", null)}>All your Kitty Banks</button>}
  </div>;
}

function FootpathsGroup({ footpaths, onOpen, style, placed }: { footpaths: PathFootpath[]; onOpen: MineLayerViewProps["onOpen"]; style?: CSSProperties; placed: string }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  if (!footpaths.length) return null;
  const onKey = (event: ReactKeyboardEvent<HTMLDivElement>) => { if (event.key === "Escape" && open) { setOpen(false); toggle.current?.focus(); } };
  return <div className="mine-group mine-group--footpaths" data-mine-group="footpaths" data-mine-placed={placed} style={style} onKeyDown={onKey}>
    <button ref={toggle} type="button" className="mine-trailhead" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((value) => !value)}>
      Your footpaths<span className="mine-sr">, only you see these</span>
    </button>
    <ul id={listId} className="mine-footpaths" hidden={!open}>
      {footpaths.map((path) => <li key={path.id}>
        <button type="button" className="mine-footpath" data-mine-footpath={path.id} data-state={path.state} data-lit={path.lit || undefined} onClick={() => onOpen("footpath", path.id)}>
          <span className="mine-footpath__label">{path.label}</span><span className="mine-footpath__sub">{footpathWords(path)}</span>
        </button>
      </li>)}
    </ul>
  </div>;
}

/** The trail itself: a dashed line from Our home to the Glasshouse, with each footpath a short stroke off it. Decorative. */
function Trail({ from, to, footpaths }: { from: Point; to: Point; footpaths: PathFootpath[] }) {
  const drawn = footpaths.slice(0, MINE_FOOTPATHS_DRAWN);
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length, ny = dx / length;
  return <svg className="mine-trail" aria-hidden="true" focusable="false">
    <line className="mine-trail__way" x1={from.x.toFixed(1)} y1={from.y.toFixed(1)} x2={to.x.toFixed(1)} y2={to.y.toFixed(1)} />
    {drawn.map((path, i) => {
      const t = (i + 1) / (drawn.length + 1), side = i % 2 ? -1 : 1;
      const x0 = from.x + dx * t, y0 = from.y + dy * t;
      return <line key={path.id} className={`mine-trail__footpath${path.state === "done" ? " is-done" : ""}${path.lit ? " is-lit" : ""}`} x1={x0.toFixed(1)} y1={y0.toFixed(1)} x2={(x0 + nx * side * 22).toFixed(1)} y2={(y0 + ny * side * 22).toFixed(1)} />;
    })}
  </svg>;
}

export function MineLayer({ layer, place, rects, onOpen, hidden = false }: MineLayerViewProps) {
  if (hidden) return null;
  const find = (id: string) => rects.find((rect) => rect.id === id && rect.visible);
  const docked: ("footpaths" | "steps" | "banks")[] = [];
  let ground: ReactElement[] = [];

  if (place === "court") {
    const glasshouse = find(MINE_COURT_ANCHORS.steps), home = find(MINE_COURT_ANCHORS.banks);
    if (glasshouse) ground.push(<StepsGroup key="steps" steps={layer.steps} onOpen={onOpen} placed="glasshouse-door" style={at(centreTop(glasshouse))} />);
    else docked.push("steps");
    if (home) ground.push(<BanksGroup key="banks" banks={layer.banks} onOpen={onOpen} placed="home-door" style={at(centreTop(home))} />);
    else docked.push("banks");
    if (glasshouse && home && layer.footpaths.length) {
      const a = centre(home), b = centre(glasshouse);
      ground.push(<Trail key="trail" from={a} to={b} footpaths={layer.footpaths} />);
      ground.push(<FootpathsGroup key="footpaths" footpaths={layer.footpaths} onOpen={onOpen} placed="trail" style={at({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 24 })} />);
    } else docked.push("footpaths");
  } else if (place === "glasshouse") {
    ground = [<StepsGroup key="steps" steps={layer.steps} onOpen={onOpen} placed="beds" />];
  } else if (place === "tower") {
    ground = [<BanksGroup key="banks" banks={layer.banks} onOpen={onOpen} placed="shelf" />];
  }

  return <div className="mine-layer" data-mine-layer={place} data-mine-empty={layer.empty || undefined}>
    {ground}
    {(docked.length > 0 || (place === "court" && layer.empty)) && <div className="mine-dock" data-mine-dock="">
      {place === "court" && layer.empty && <p className="mine-dock__empty">Nothing of yours is on the island yet.</p>}
      {docked.includes("steps") && <StepsGroup steps={layer.steps} onOpen={onOpen} placed="dock" />}
      {docked.includes("banks") && <BanksGroup banks={layer.banks} onOpen={onOpen} placed="dock" />}
      {docked.includes("footpaths") && <FootpathsGroup footpaths={layer.footpaths} onOpen={onOpen} placed="dock" />}
    </div>}
  </div>;
}
