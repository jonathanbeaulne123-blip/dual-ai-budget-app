import { useId, useMemo } from "react";
import { kittyBodyPoints } from "../kitty/studio/silhouette.ts";
import { KITTY_HEAD_R, KITTY_HEAD_SCALE } from "../kitty/studio/silhouette.ts";
import { BANK_SCULPT, bankMetrics, type BankForm } from "./world/queenBankSculpture.ts";
import type { KittySculptV1 } from "../core/types.ts";

/**
 * The drawn twin of a kitty bank (2026-09-14).
 *
 * `queenBankSculpture` spins the studio's silhouette on a lathe; this traces the
 * same points into a path, exactly as `QueenSceneryFlat` traces the worlds. A
 * room with no WebGL, forced colours or a lost context therefore keeps the cat
 * — not a pot — and keeps both rules with it: an open slot accepts, a lid
 * refuses. Nothing here reads money; the fill arrives as a band.
 */
const VIEW = 100;
const FOOT = 96;

function draw(form: BankForm) {
  const sculpt = BANK_SCULPT[form] as KittySculptV1;
  const metrics = bankMetrics(form);
  const scale = 92 * metrics.unit;
  const cx = VIEW / 2;
  const up = (y: number) => FOOT - y * scale;
  const across = (r: number) => cx + r * scale;
  const points = kittyBodyPoints(sculpt);
  const right = points.map(([r, y]) => `L${across(r).toFixed(2)} ${up(y).toFixed(2)}`);
  const left = [...points].reverse().map(([r, y]) => `L${across(-r).toFixed(2)} ${up(y).toFixed(2)}`);
  const body = `M${cx} ${FOOT}${right.join("")}${left.join("")}Z`;
  const dial = form === "goal" ? 1 : 0.75;
  const head = KITTY_HEAD_SCALE[sculpt.head];
  return {
    body,
    headX: cx,
    headY: up(metrics.headY),
    headRx: KITTY_HEAD_R * head[0] * dial * scale,
    headRy: KITTY_HEAD_R * head[1] * dial * scale,
    earY: up(metrics.headTop),
    earSpread: 0.34 * head[0] * dial * scale,
    earR: (sculpt.ears === "round" ? 0.2 : 0.21) * dial * scale,
    earUp: sculpt.ears !== "round",
    crown: up(metrics.headTop),
    crownW: 0.3 * dial * scale,
    shoulder: up(metrics.bodyTop),
    waist: across(metrics.radius),
    tail: sculpt.tail === "wrap"
      ? `M${across(-metrics.radius * 0.35)} ${up(0.1)}Q${across(-metrics.radius * 1.35)} ${up(0.06)} ${across(-metrics.radius * 0.95)} ${up(0.5)}`
      : null,
    top: up(metrics.height),
  };
}

const CACHE = new Map<BankForm, ReturnType<typeof draw>>();
const shapeOf = (form: BankForm) => {
  const known = CACHE.get(form);
  if (known) return known;
  const built = draw(form);
  CACHE.set(form, built);
  return built;
};

export function QueenBankFlat({ form, fill = 0, parts = 0, hollow = false, lidded, className }: {
  form: BankForm;
  /** 0–1, already banded. How high the glaze stands inside her. */
  fill?: number;
  /** Necks on the shoulder: how many parts are inside. Never a figure. */
  parts?: number;
  /** Nothing posted: an outline, claiming nothing. */
  hollow?: boolean;
  /** Lidded refuses; open-mouthed accepts. Defaults to the form's own rule. */
  lidded?: boolean;
  className?: string;
}) {
  const shape = useMemo(() => shapeOf(form), [form]);
  const uid = useId().replace(/[:]/g, "");
  const sealed = lidded ?? form !== "goal";
  const level = Math.max(0, Math.min(1, fill));
  const glazeTop = FOOT - (FOOT - shape.shoulder) * level;
  const necks = Math.min(3, Math.max(0, parts));
  return (
    <svg className={className} viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true" focusable="false" data-form={form} data-hollow={hollow ? "true" : "false"}>
      <clipPath id={`${uid}-body`}><path d={shape.body} /></clipPath>
      {shape.tail && <path className="queen-bank-flat__tail" d={shape.tail} fill="none" strokeWidth="5" strokeLinecap="round" />}
      <path className={`queen-bank-flat__clay${hollow ? " is-hollow" : ""}`} d={shape.body} />
      {!hollow && level > 0.02 && <rect className="queen-bank-flat__glaze" clipPath={`url(#${uid}-body)`} x="0" y={glazeTop} width={VIEW} height={FOOT - glazeTop + 1} />}
      <path className="queen-bank-flat__edge" d={shape.body} fill="none" strokeWidth="2" />
      {[-1, 1].map((side) => (shape.earUp
        ? <path key={side} className="queen-bank-flat__ear" d={`M${shape.headX + side * shape.earSpread - shape.earR * 0.8} ${shape.earY + 2}L${shape.headX + side * shape.earSpread} ${shape.earY - shape.earR * 1.6}L${shape.headX + side * shape.earSpread + shape.earR * 0.8} ${shape.earY + 2}Z`} />
        : <circle key={side} className="queen-bank-flat__ear" cx={shape.headX + side * shape.earSpread} cy={shape.earY - shape.earR * 0.4} r={shape.earR} />))}
      <ellipse className={`queen-bank-flat__clay${hollow ? " is-hollow" : ""}`} cx={shape.headX} cy={shape.headY} rx={shape.headRx} ry={shape.headRy} />
      <ellipse className="queen-bank-flat__edge" cx={shape.headX} cy={shape.headY} rx={shape.headRx} ry={shape.headRy} fill="none" strokeWidth="2" />
      {!hollow && [-1, 1].map((side) => (
        <ellipse key={side} className="queen-bank-flat__eye" cx={shape.headX + side * shape.headRx * 0.36} cy={shape.headY - shape.headRy * 0.12} rx={shape.headRx * 0.11} ry={shape.headRx * 0.14} />
      ))}
      {sealed
        ? <>
            <rect className="queen-bank-flat__lid" x={shape.headX - shape.crownW} y={shape.crown - 5} width={shape.crownW * 2} height="6" rx="3" />
            <circle className="queen-bank-flat__lid" cx={shape.headX} cy={shape.crown - 8} r="3" />
          </>
        : <>
            <rect className="queen-bank-flat__rim" x={shape.headX - shape.crownW} y={shape.crown - 4} width={shape.crownW * 2} height="4.5" rx="2" />
            <rect className="queen-bank-flat__slot" x={shape.headX - shape.crownW * 0.8} y={shape.crown - 3.2} width={shape.crownW * 1.6} height="2" rx="1" />
          </>}
      {Array.from({ length: necks }).map((_, i) => (
        <rect key={i} className="queen-bank-flat__neck" x={shape.headX + (i - (necks - 1) / 2) * 9 - 3} y={shape.shoulder - 8} width="6" height="11" rx="3" />
      ))}
    </svg>
  );
}
