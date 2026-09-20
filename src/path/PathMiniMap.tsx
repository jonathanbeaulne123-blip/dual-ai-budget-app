import { useMemo } from "react";
import type { DateKey } from "../core/calendar.ts";
import { charterIsSigned } from "../core/charter.ts";
import { monthKeyFromDateKey } from "../core/calendar.ts";
import { currentPathEra } from "../core/pathEras.ts";
import { pathLand } from "../core/pathLand.ts";
import { pathMonthCharacter, pathMonths } from "../core/pathSignals.ts";
import { effectivePathRecipes } from "../core/pathWorld.ts";
import type { Household } from "../core/types.ts";
import { useAppearance } from "../theme/ThemeProvider.tsx";
import type { ThemeId } from "../theme/scenes.ts";
import type { JourneySceneInterpretation } from "../house/supportedInterpretation.ts";
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
export function PathMiniMap({ household, today, size, shown: shownProp, className, theme: themeOverride, footpaths, bridges, interpretation, liveDerivedScene = true }: {
  household: Household;
  today: DateKey;
  /** Rendered width in px; omit to fill the container. */
  size?: number;
  /** The month index the walkers stand on (Replay); defaults to now. */
  shown?: number;
  className?: string;
  /** Proof pages only; the app follows the signed-in person's appearance. */
  theme?: ThemeId;
  /**
   * Our Path only: the signed-in member's own private footpaths (month index, walked or not).
   * The caller derives them for its owner; Home's window passes none, so none are drawn there.
   */
  footpaths?: { month: number; done: boolean }[];
  /** Our Path only: bridges beside their month, one segment per built stage (0 = none). */
  bridges?: { month: number; stage: 0 | 1 | 2 | 3 }[];
  /** Frozen, dated scene input. Financial links and commands continue to use `household`. */
  interpretation?: JourneySceneInterpretation;
  /** False while a cached interpretation is shown: uncached landmarks are suppressed rather than mixed in. */
  liveDerivedScene?: boolean;
}) {
  const appearance = useAppearance();
  const theme = themeOverride ?? appearance.scene.theme;
  // The Journey of Life (D-268): like the island, the map grows from the current era's months when there is one.
  const projectedEra = useMemo(() => { try { return currentPathEra(household, today); } catch { return null; } }, [household, today]);
  const era = liveDerivedScene ? projectedEra : null;
  const eraFrom = era?.months[0] ?? null;
  const projectedMonths = useMemo(() => pathMonths(household, today, eraFrom ? { from: eraFrom, through: monthKeyFromDateKey(today) } : undefined), [household, today, eraFrom]);
  const projectedRecipes = useMemo(() => effectivePathRecipes(household), [household]);
  const months = interpretation?.months ?? projectedMonths;
  const recipes = interpretation?.recipes ?? projectedRecipes;
  const last = months.length - 1;
  const shown = Math.max(0, Math.min(shownProp ?? last, last));
  const island = useMemo(() => growIsland(months, recipes, shown), [months, recipes, shown]);
  const projectedLand = useMemo(() => pathLand(household, today), [household, today]);
  const projectedSitdownClosed = useMemo(() => pathSitdownClosedMonths(household), [household]);
  const land: ReturnType<typeof pathLand> = liveDerivedScene ? projectedLand : {};
  const sitdownClosed = liveDerivedScene ? projectedSitdownClosed : new Set<string>();
  const charter = liveDerivedScene ? household.charter ?? null : null;
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
      data-era={era?.spec.name}
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
      {(() => {
        // My private footpaths: short dashed strokes inland from their month.
        const seen = new Map<number, number>();
        return (footpaths ?? []).filter((row) => row.month >= 0 && row.month <= shown).map((row, i) => {
          const j = seen.get(row.month) ?? 0; seen.set(row.month, j + 1);
          const p = island.spot(row.month), dir = Math.atan2(-p.z, -p.x) + (j % 2 ? 1 : -1) * (0.5 + Math.floor(j / 2) * 0.45);
          const x0 = p.x * k + Math.cos(dir) * 3.4, y0 = p.z * k + Math.sin(dir) * 3.4;
          return <line key={`foot-${i}`} className={`path-minimap__footpath${row.done ? " is-done" : ""}`} x1={x0.toFixed(2)} y1={y0.toFixed(2)} x2={(x0 + Math.cos(dir) * 5).toFixed(2)} y2={(y0 + Math.sin(dir) * 5).toFixed(2)} />;
        });
      })()}
      {(() => {
        // Bridges: a small bar with one segment per built stage.
        const seen = new Map<number, number>();
        return (bridges ?? []).filter((row) => row.month >= 0 && row.month <= shown).map((row, i) => {
          const j = seen.get(row.month) ?? 0; seen.set(row.month, j + 1);
          const p = island.spot(row.month), a = p.a - 0.9 - j * 0.6;
          const cx = p.x * k + Math.cos(a) * 5.2, cy = p.z * k + Math.sin(a) * 5.2;
          return (
            <g key={`bridge-${i}`} className="path-minimap__bridge" data-stage={row.stage} transform={`translate(${cx.toFixed(2)} ${cy.toFixed(2)})`}>
              {[0, 1, 2].map((s) => <rect key={s} x={-2.4 + s * 1.65} y={-0.55} width={1.4} height={1.1} rx={0.25} className={s < row.stage ? "is-built" : "is-open"} />)}
            </g>
          );
        });
      })()}
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
      {era && <text className="path-minimap__era" x={0} y={-52} textAnchor="middle">{era.spec.name}</text>}
    </svg>
  );
}
