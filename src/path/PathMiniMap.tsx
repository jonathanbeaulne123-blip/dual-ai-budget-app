import { useMemo } from "react";
import type { DateKey } from "../core/calendar.ts";
import { charterIsSigned } from "../core/charter.ts";
import { pathLand } from "../core/pathLand.ts";
import { pathMonthCharacter, pathMonths } from "../core/pathSignals.ts";
import { effectivePathRecipes } from "../core/pathWorld.ts";
import type { Household } from "../core/types.ts";
import { useAppearance } from "../theme/ThemeProvider.tsx";
import type { ThemeId } from "../theme/scenes.ts";
import { growIsland } from "./grow.ts";
import { charterSpot, pathSitdownClosedMonths } from "./together.ts";
import "./path-minimap.css";

/**
 * The island in miniature: a flat SVG of the household's shared months. One
 * dot per month in its character colour, a kerb for set land, a dot per
 * stamped week, the Charter's square, coves as notches in the shore, and the
 * two walkers on the shown month. Pure decoration (`aria-hidden`); the words
 * live beside it. Our Path's no-WebGL map and Home's window both draw this.
 */
export function PathMiniMap({ household, today, size, shown: shownProp, className, theme: themeOverride }: {
  household: Household;
  today: DateKey;
  /** Rendered width in px; omit to fill the container. */
  size?: number;
  /** The month index the walkers stand on (Replay); defaults to now. */
  shown?: number;
  className?: string;
  /** Proof pages only; the app follows the signed-in person's appearance. */
  theme?: ThemeId;
}) {
  const appearance = useAppearance();
  const theme = themeOverride ?? appearance.scene.theme;
  const months = useMemo(() => pathMonths(household, today), [household, today]);
  const recipes = useMemo(() => effectivePathRecipes(household), [household]);
  const last = months.length - 1;
  const shown = Math.max(0, Math.min(shownProp ?? last, last));
  const island = useMemo(() => growIsland(months, recipes, shown), [months, recipes, shown]);
  const land = useMemo(() => pathLand(household, today), [household, today]);
  const sitdownClosed = useMemo(() => pathSitdownClosedMonths(household), [household]);
  const charter = household.charter ?? null;
  const charterShown = Boolean(charter && months[shown] && charter.foundedOn.slice(0, 7) <= months[shown]!.key);

  const spotMax = Math.max(20, Math.hypot(island.spot(Math.max(0, last)).x, island.spot(Math.max(0, last)).z));
  const shore = Array.from({ length: 48 }, (_, i) => i / 48 * Math.PI * 2).map((a) => ({ a, r: island.radiusAt(a) }));
  const shoreMax = Math.max(1, ...shore.map((p) => p.r));
  const k = Math.min(54 / spotMax, 57 / shoreMax);
  const at = (x: number) => (x * k).toFixed(2);
  const thread = months.slice(0, shown + 1).map((_, m) => { const p = island.spot(m); return `${m ? "L" : "M"}${at(p.x)} ${at(p.z)}`; }).join(" ");

  return (
    <svg
      viewBox="-60 -60 120 120"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      className={`path-minimap path-minimap--${theme}${className ? ` ${className}` : ""}`}
      data-months={months.length}
    >
      <path className="path-minimap__shore" d={`${shore.map((p, i) => `${i ? "L" : "M"}${at(Math.cos(p.a) * p.r)} ${at(Math.sin(p.a) * p.r)}`).join(" ")} Z`} />
      {island.coves.map((cove, i) => {
        // A cove is a notch in the shore: a small inward chevron at its bearing.
        const r = island.radiusAt(cove.a) * k, inward = 3.2;
        const ox = Math.cos(cove.a), oz = Math.sin(cove.a), sx = -oz * 1.8, sz = ox * 1.8;
        const tip = { x: ox * (r - inward), z: oz * (r - inward) };
        return <path key={`cove-${i}`} className="path-world__cove" d={`M${(ox * r + sx).toFixed(2)} ${(oz * r + sz).toFixed(2)} L${tip.x.toFixed(2)} ${tip.z.toFixed(2)} L${(ox * r - sx).toFixed(2)} ${(oz * r - sz).toFixed(2)}`} />;
      })}
      {thread && shown > 0 && <path className="path-minimap__thread" d={thread} />}
      {months.slice(0, shown + 1).map((month, m) => {
        // Set land (closed Sitdown or closed books) gets a kerb; each stamped week a small dot.
        const row = land[month.key], set = Boolean(row?.closed) || sitdownClosed.has(month.key);
        const stamps = Math.min(5, row?.stampedWeeks.length ?? 0);
        if (!set && !stamps) return null;
        const p = island.spot(m), r = (m === shown ? 3.4 : 2.4) + 1.3;
        return (
          <g key={`land-${month.key}`} transform={`translate(${at(p.x)} ${at(p.z)})`}>
            {set && <circle r={r} className={`path-world__kerb${row?.closed ? " path-world__kerb--closed" : ""}`} />}
            {Array.from({ length: stamps }, (_, i) => {
              const a = -Math.PI / 2 + (i - (stamps - 1) / 2) * 0.55;
              return <circle key={i} className="path-world__stamp" r={0.55} cx={(Math.cos(a) * (r + 1.3)).toFixed(2)} cy={(Math.sin(a) * (r + 1.3)).toFixed(2)} />;
            })}
          </g>
        );
      })}
      {months.slice(0, shown + 1).map((month, m) => {
        const p = island.spot(m);
        return <circle key={month.key} cx={p.x * k} cy={p.z * k} r={m === shown ? 3.4 : 2.4} className={`path-world__dot path-world__dot--${pathMonthCharacter(month)}`} />;
      })}
      {charter && charterShown && (() => {
        // The Charter's stone square. Decision forks are left off the flat map.
        const p = charterSpot(island);
        return <rect className="path-world__charter" data-signed={charterIsSigned(charter)} x={(p.x * k - 2.2).toFixed(2)} y={(p.z * k - 2.2).toFixed(2)} width={4.4} height={4.4} rx={0.6} />;
      })()}
      {months.length > 0 && (() => {
        // Us: the two of you, side by side on the shown month.
        const p = island.spot(shown);
        return (
          <g className="path-world__us" transform={`translate(${at(p.x)} ${at(p.z)})`}>
            <line x1={-2.2} y1={-4.6} x2={2.2} y2={-4.6} />
            <circle cx={-2.2} cy={-4.6} r={1.3} className="path-world__us-one" />
            <circle cx={2.2} cy={-4.6} r={1.3} className="path-world__us-two" />
          </g>
        );
      })()}
    </svg>
  );
}
