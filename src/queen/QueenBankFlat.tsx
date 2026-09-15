import { useId, useMemo } from "react";
import { kittyBodyPoints } from "../kitty/studio/silhouette.ts";
import { KITTY_HEAD_R, KITTY_HEAD_SCALE } from "../kitty/studio/silhouette.ts";
import { BANK_SCULPT, bankMetrics, type BankForm } from "./world/queenBankSculpture.ts";
import { BANK_DRESS, bankDressPieces } from "./world/queenBankDress.ts";
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
  const dial = form === "goal" ? 1 : form === "subscription" ? 0.85 : form === "recurring" ? 0.72 : form === "appointment" ? 0.8 : form === "planned" ? 0.8 : 0.75;
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
    foot: FOOT,
    scale,
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

export type BankFinish = "plain" | "speckle" | "banded" | "crackle";

export function QueenBankFlat({ form, fill = 0, parts = 0, hollow = false, frosted = false, lidded, className, tint, finish = "plain" }: {
  form: BankForm;
  /** A planned expense: drawn as frosted glass in its tint — translucent, dashed — rather than an empty outline. */
  frosted?: boolean;
  /** The clay's tint — a CSS colour from the category group. Absent, the bare clay. */
  tint?: string;
  /** The category line's finish: a pattern laid over the clay. */
  finish?: BankFinish;
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
  const dress = BANK_DRESS[form];
  const keyY = shape.foot - (shape.foot - shape.shoulder) * 0.62;
  return (
    <svg className={className} viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true" focusable="false" data-form={form} data-dress={bankDressPieces(form).join(" ") || "bare"} data-hollow={hollow ? "true" : "false"} data-frosted={frosted ? "true" : "false"} data-finish={finish} style={tint ? { ["--bank-tint" as string]: tint } : undefined}>
      <clipPath id={`${uid}-body`}><path d={shape.body} /></clipPath>
      {finish !== "plain" && !hollow && !frosted && (
        <pattern id={`${uid}-finish`} patternUnits="userSpaceOnUse" width="12" height="12">
          {finish === "speckle" && <><circle className="queen-bank-flat__finish" cx="3" cy="4" r="1.2" /><circle className="queen-bank-flat__finish" cx="9" cy="9" r="1" /><circle className="queen-bank-flat__finish" cx="8" cy="2" r=".8" /></>}
          {finish === "banded" && <rect className="queen-bank-flat__finish" x="0" y="4" width="12" height="2.4" />}
          {finish === "crackle" && <path className="queen-bank-flat__finish-line" d="M0 2 L5 7 L3 12 M7 0 L12 6" />}
        </pattern>
      )}
      {shape.tail && <path className="queen-bank-flat__tail" d={shape.tail} fill="none" strokeWidth="5" strokeLinecap="round" />}
      {dress.back === "key" && (
        <g className="queen-bank-flat__dress queen-bank-flat__dress--key">
          <rect className="queen-bank-flat__brass" x={VIEW - shape.waist - 8} y={keyY - 2} width="14" height="4" rx="1" />
          <circle className="queen-bank-flat__brass-ring" cx={VIEW - shape.waist - 13} cy={keyY} r="5.5" fill="none" strokeWidth="2.6" />
          <rect className="queen-bank-flat__brass" x={VIEW - shape.waist - 15.5} y={keyY - 1.2} width="5" height="2.4" rx="1" />
        </g>
      )}
      {dress.foot === "flag" && (
        <g className="queen-bank-flat__dress queen-bank-flat__dress--flag">
          <rect className="queen-bank-flat__pole" x={shape.waist + 3} y={shape.foot - 62} width="2.4" height="62" rx="1" />
          <path className="queen-bank-flat__felt" d={`M${shape.waist + 5} ${shape.foot - 60}L${shape.waist + 30} ${shape.foot - 52}L${shape.waist + 5} ${shape.foot - 43}Z`} />
        </g>
      )}
      <path className={`queen-bank-flat__clay${hollow ? " is-hollow" : ""}`} d={shape.body} />
      {!hollow && level > 0.02 && <rect className="queen-bank-flat__glaze" clipPath={`url(#${uid}-body)`} x="0" y={glazeTop} width={VIEW} height={FOOT - glazeTop + 1} />}
      {finish !== "plain" && !hollow && !frosted && <path className="queen-bank-flat__finish-coat" d={shape.body} fill={`url(#${uid}-finish)`} />}
      <path className="queen-bank-flat__edge" d={shape.body} fill="none" strokeWidth="2" />
      {[-1, 1].map((side) => (shape.earUp
        ? <path key={side} className="queen-bank-flat__ear" d={`M${shape.headX + side * shape.earSpread - shape.earR * 0.8} ${shape.earY + 2}L${shape.headX + side * shape.earSpread} ${shape.earY - shape.earR * 1.6}L${shape.headX + side * shape.earSpread + shape.earR * 0.8} ${shape.earY + 2}Z`} />
        : <circle key={side} className="queen-bank-flat__ear" cx={shape.headX + side * shape.earSpread} cy={shape.earY - shape.earR * 0.4} r={shape.earR} />))}
      <ellipse className={`queen-bank-flat__clay${hollow ? " is-hollow" : ""}`} cx={shape.headX} cy={shape.headY} rx={shape.headRx} ry={shape.headRy} />
      <ellipse className="queen-bank-flat__edge" cx={shape.headX} cy={shape.headY} rx={shape.headRx} ry={shape.headRy} fill="none" strokeWidth="2" />
      {dress.hat === "cap" && (
        <g className="queen-bank-flat__dress queen-bank-flat__dress--cap" transform={`rotate(-8 ${shape.headX} ${shape.headY})`}>
          <path className="queen-bank-flat__felt" d={`M${shape.headX - shape.headRx * 1.04} ${shape.headY - shape.headRy * 0.5}A${shape.headRx * 1.04} ${shape.headRy * 0.78} 0 0 1 ${shape.headX + shape.headRx * 1.04} ${shape.headY - shape.headRy * 0.5}Z`} />
          <rect className="queen-bank-flat__ink" x={shape.headX - shape.headRx * 1.06} y={shape.headY - shape.headRy * 0.62} width={shape.headRx * 2.12} height={shape.headRy * 0.2} rx="1" />
          <path className="queen-bank-flat__ink" d={`M${shape.headX - shape.headRx * 1.06} ${shape.headY - shape.headRy * 0.6}L${shape.headX - shape.headRx * 1.7} ${shape.headY - shape.headRy * 0.42}Q${shape.headX - shape.headRx * 1.1} ${shape.headY - shape.headRy * 0.2} ${shape.headX - shape.headRx * 0.6} ${shape.headY - shape.headRy * 0.42}Z`} />
        </g>
      )}
      {dress.hat === "calendar" && (
        <g className="queen-bank-flat__dress queen-bank-flat__dress--calendar" transform={`rotate(9 ${shape.headX} ${shape.headY})`}>
          <rect className="queen-bank-flat__paper" x={shape.headX - shape.headRx * 0.78} y={shape.headY - shape.headRy * 1.92} width={shape.headRx * 1.56} height={shape.headRy * 1.5} rx="1.5" />
          <rect className="queen-bank-flat__ink" x={shape.headX - shape.headRx * 0.78} y={shape.headY - shape.headRy * 1.92} width={shape.headRx * 1.56} height={shape.headRy * 0.36} rx="1.5" />
          <circle className="queen-bank-flat__brass-ring" cx={shape.headX} cy={shape.headY - shape.headRy * 1.94} r={shape.headRx * 0.18} fill="none" strokeWidth="1.8" />
          <path className="queen-bank-flat__lid" d={`M${shape.headX + shape.headRx * 0.78} ${shape.headY - shape.headRy * 0.42}l${-shape.headRx * 0.44} 0l${shape.headRx * 0.44} ${-shape.headRy * 0.44}Z`} />
        </g>
      )}
      {dress.hat === "paper" && (
        <g className="queen-bank-flat__dress queen-bank-flat__dress--paper" transform={`rotate(-10 ${shape.headX} ${shape.headY})`}>
          <path className="queen-bank-flat__paper" d={`M${shape.headX - shape.headRx * 1.1} ${shape.headY - shape.headRy * 0.5}L${shape.headX} ${shape.headY - shape.headRy * 2.25}L${shape.headX + shape.headRx * 1.1} ${shape.headY - shape.headRy * 0.5}Z`} />
          <rect className="queen-bank-flat__paper-brim" x={shape.headX - shape.headRx * 1.2} y={shape.headY - shape.headRy * 0.62} width={shape.headRx * 2.4} height={shape.headRy * 0.24} rx="1" />
        </g>
      )}
      {dress.collar === "bell" && (
        <g className="queen-bank-flat__dress queen-bank-flat__dress--bell">
          <path className="queen-bank-flat__ink-line" d={`M${shape.headX - shape.headRx * 0.96} ${shape.headY + shape.headRy * 0.72}Q${shape.headX} ${shape.headY + shape.headRy * 1.3} ${shape.headX + shape.headRx * 0.96} ${shape.headY + shape.headRy * 0.72}`} fill="none" strokeWidth="3" strokeLinecap="round" />
          <circle className="queen-bank-flat__brass" cx={shape.headX} cy={shape.headY + shape.headRy * 1.28} r={shape.headRx * 0.22} />
          <circle className="queen-bank-flat__ink" cx={shape.headX} cy={shape.headY + shape.headRy * 1.4} r={shape.headRx * 0.06} />
        </g>
      )}
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
      {dress.foot === "envelope" && (
        <g className="queen-bank-flat__dress queen-bank-flat__dress--envelope" transform={`rotate(-9 ${shape.headX + 14} ${shape.foot - 8})`}>
          <rect className="queen-bank-flat__paper" x={shape.headX + 2} y={shape.foot - 21} width="30" height="19" rx="1.5" />
          <path className="queen-bank-flat__paper-line" d={`M${shape.headX + 2} ${shape.foot - 21}L${shape.headX + 17} ${shape.foot - 10}L${shape.headX + 32} ${shape.foot - 21}`} fill="none" strokeWidth="1.6" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  );
}
