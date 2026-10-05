/**
 * `<BoardFlat board land level chapterId selection theme/>` (Horizon Clock, L3): the map on the SVG twin — the flat
 * tier, no WebGL, a failed land load or a lost context. It goes INSIDE `<JourneyLandFlat>`'s overlay slot and draws in
 * the SAME concept metres (the UI frames it with `flatViewBoxFor(level, …)`, which replaces the land's viewBox):
 *
 * - Month: the bezel road as a ring round the island with its 31 day slots (same date → same slot as the 3D clock,
 *   `layoutClock`), a mark per stop with its coin stack drawn as a bar (rings from `ringsFor` only; solid = recorded,
 *   outlined + dashed = not recorded; a capped stack shows a break; unknown amount → no bar), the honey needs-you ring,
 *   the bus at today, Hercules on The Green.
 * - Year: twelve minis (the coast outline, small) round the island, each with its Year-ruler stack (recorded and not
 *   recorded side by side), the needs-you ring, kept / future / empty treatments.
 * - Week: the paper trail along the real Year Walk (`layoutWeek`), the seven tiles (today biggest, stones small), the
 *   to-check pile as one tile.
 *
 * Every mark is a `[data-id]` element with `data-kind`, `data-x`, `data-y` (its anchor, concept metres) so the UI places
 * its real 44 px buttons over it — the same ids as the 3D anchors. The drawing is decorative (`aria-hidden`); the
 * UI's buttons and the list carry every word and amount. Nothing here opens or changes anything; `onPick` reports ids.
 *
 * DEPRECATED BRANCH: given `route` (the v1 route board's props), this renders the old route overlay unchanged
 * (`RouteBoardFlat`), so the v1 UI keeps compiling until L4's rewrite lands. The integrator deletes that branch.
 */
import type { ReactNode } from "react";
import {
  JOURNEY_DIORAMA, JOURNEY_MAP_MARKS, type ChapterId, type DioramaFrame, type JourneyBoard, type JourneyLandData, type JourneyLevel,
  type Point2, type ThemeId,
} from "../contracts.ts";
import { layoutClock, type CoinStack } from "./clock.ts";
import { frameFromCoast, polar } from "./geo.ts";
import { boardPalette, colourOf } from "./palette.ts";
import { RouteBoardFlat, type RouteBoardFlatProps } from "./routeFlat.tsx";
import { layoutWeek, type WeekLayout } from "./week.ts";
import { layoutYear, YEAR_RING_DU, YEAR_MINI_SCALE, type YearStackColumn } from "./year.ts";
import { RING_HEIGHT_DU, stackFor } from "./clock.ts";

export type MapBoardFlatProps = {
  board: JourneyBoard;
  land: JourneyLandData;
  level: JourneyLevel;
  /** The chapter the Month clock shows (default the board's current chapter). */
  chapterId?: ChapterId;
  selection?: string | null;
  theme: ThemeId;
  /** The land's frame when the UI has one (`land.frame` from L2); otherwise derived from the coast. */
  frame?: DioramaFrame;
  /** "phone" (< 720 px) or "wide": the Week trail's framing follows it. */
  orientation?: "wide" | "phone";
  /** Pointer convenience only (the UI's buttons are the accessible path). Same payload as the scene's `onPick`. */
  onPick?: (ids: string[]) => void;
  route?: undefined;
};
export type BoardFlatProps = MapBoardFlatProps | (RouteBoardFlatProps & { level?: undefined });

/** Concept metres per design unit on the flat twin (kept for the deprecated route branch). */
export { FLAT_UNIT } from "./routeFlat.tsx";

/** The viewBox (concept metres) that frames a level: the bezel at Month, the ring at Year, the trail at Week. */
export function flatViewBoxFor(level: JourneyLevel, land: JourneyLandData, frame: DioramaFrame = frameFromCoast(land.coastline), week?: WeekLayout | null): [number, number, number, number] {
  const [cx, cy] = frame.centre;
  if (level === "year") {
    const r = (YEAR_RING_DU + 2.2) / frame.scale;
    return [cx - r, cy - r, 2 * r, 2 * r];
  }
  if (level === "week" && week && week.tiles.length) {
    const pts = [...week.tiles.map((t) => t.at), ...(week.pile ? [week.pile.at] : [])];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const pad = 160;
    return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad];
  }
  const r = (JOURNEY_DIORAMA.bezel.outer + 0.6) / frame.scale;
  return [cx - r, cy - r, 2 * r, 2 * r];
}

const fx = (n: number) => n.toFixed(1);
const dataOf = (id: string, kind: string, p: Point2) => ({ "data-id": id, "data-kind": kind, "data-x": fx(p[0]), "data-y": fx(p[1]) });

/** A coin stack as a bar, base at (0, 0) growing up (−y). Height from the stack's rings only. */
function StackBar({ stack, x, widthM, perDu, theme }: { stack: { fill: "solid" | "see-through"; heightDu: number; capped: boolean; incoming: boolean }; x: number; widthM: number; perDu: number; theme: ThemeId }) {
  const h = stack.heightDu * perDu;
  const fill = colourOf(theme, stack.incoming ? "mint" : "coin"), edge = colourOf(theme, stack.incoming ? "mintEdge" : "coinEdge");
  const solid = stack.fill === "solid";
  return (
    <g data-stack={stack.fill} data-capped={stack.capped ? "" : undefined}>
      <rect x={x - widthM / 2} y={-h} width={widthM} height={h} rx={widthM * 0.2} fill={solid ? fill : "none"} fillOpacity={solid ? 1 : 0}
        stroke={solid ? edge : colourOf(theme, "ink")} strokeWidth={solid ? 1 : 1.4} strokeDasharray={solid ? undefined : "3 2"} vectorEffect="non-scaling-stroke" />
      {stack.capped ? <path d={`M${x - widthM * 0.7} ${-h * 0.82 + 3} L${x + widthM * 0.7} ${-h * 0.82 - 3}`} stroke={colourOf(theme, "ink")} strokeWidth={2} vectorEffect="non-scaling-stroke" /> : null}
    </g>
  );
}
const asBar = (s: CoinStack) => ({ fill: s.fill, heightDu: s.heightDu, capped: s.rings.capped, incoming: s.direction === "in" });
const yearBar = (c: YearStackColumn) => ({ fill: c.fill, heightDu: Math.max(0.012, c.rings.drawnRings * RING_HEIGHT_DU.year), capped: c.rings.capped, incoming: false });

function NeedsRing({ at, r, theme }: { at: Point2; r: number; theme: ThemeId }) {
  return (
    <g data-needs-you="">
      <circle cx={at[0]} cy={at[1]} r={r + 2} fill="none" stroke={colourOf(theme, "ink")} strokeWidth={4} vectorEffect="non-scaling-stroke" />
      <circle cx={at[0]} cy={at[1]} r={r} fill="none" stroke={colourOf(theme, "honey")} strokeWidth={3} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

export function BoardFlat(props: BoardFlatProps) {
  if (props.route !== undefined) return <RouteBoardFlat {...(props as RouteBoardFlatProps)} />;
  return <MapBoardFlat {...(props as MapBoardFlatProps)} />;
}

function MapBoardFlat({ board, land, level, chapterId, selection = null, theme, frame: given, orientation = "wide", onPick }: MapBoardFlatProps) {
  const frame = given ?? frameFromCoast(land.coastline);
  const pal = boardPalette(theme);
  const perDu = 1 / frame.scale;
  const fromDu = (p: Point2): Point2 => [frame.centre[0] + p[0] * perDu, frame.centre[1] + p[1] * perDu];
  const onClick = onPick ? (e: { target: EventTarget | null }) => {
    const el = (e.target as Element | null)?.closest?.("[data-id]");
    const ids = el?.getAttribute("data-ids") ?? el?.getAttribute("data-id");
    if (ids) onPick(ids.split(" "));
  } : undefined;
  let body: ReactNode;
  if (level === "month") {
    const clock = layoutClock(board, chapterId ?? board.currentChapterId);
    const roadR = JOURNEY_DIORAMA.bezel.road * perDu;
    const byId = new Map(board.stops.map((s) => [s.id, s] as const));
    const herc = land.districts.find((d) => d.id === "green")?.heart ?? null;
    body = (
      <>
        <g className="journey-map-flat__bezel" aria-hidden="true">
          <circle cx={frame.centre[0]} cy={frame.centre[1]} r={roadR} fill="none" stroke={pal.sand} strokeWidth={14} vectorEffect="non-scaling-stroke" />
          <circle cx={frame.centre[0]} cy={frame.centre[1]} r={roadR} fill="none" stroke={pal.road} strokeWidth={8} vectorEffect="non-scaling-stroke" />
        </g>
        {clock.slots.map((s) => {
          const at = fromDu(s.at);
          const ids = s.stopIds;
          const colour = !s.date ? pal.roadPast : s.relation === "past" ? pal.roadPast : s.relation === "today" ? pal.honey : pal.roadFuture;
          return (
            <g key={s.slot} className="journey-map-flat__slot" {...(s.date ? dataOf(s.date, "day", at) : {})} data-slot={s.slot} data-ids={ids.length ? ids.join(" ") : undefined}>
              <circle cx={at[0]} cy={at[1]} r={ids.length ? 22 : 9} fill={colour} stroke={pal.ink} strokeOpacity={0.4} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              {s.needsYou ? <NeedsRing at={at} r={27} theme={theme} /> : null}
              {s.items.map((item) => {
                const stop = byId.get(item.stopId);
                if (!stop) return null;
                const stack = stackFor(stop, "month");
                // Toys stand outward from the clock (radial in the slot's frame), stacks drawn up the page.
                const p = fromDu([s.at[0] + Math.sin(s.angle) * item.radial + Math.cos(s.angle) * item.along, s.at[1] - Math.cos(s.angle) * item.radial + Math.sin(s.angle) * item.along]);
                return (
                  <g key={item.stopId} {...dataOf(item.stopId, "stop", p)} data-ids={ids.join(" ")} data-prop={item.prop} transform={`translate(${fx(p[0])} ${fx(p[1])})`}>
                    {stack ? <StackBar stack={asBar(stack)} x={0} widthM={14} perDu={perDu} theme={theme} /> : null}
                    <circle cx={0} cy={-(stack ? stack.heightDu * perDu : 0) - 7} r={7} fill={item.pale ? "#ffffff" : pal.ink} fillOpacity={item.pale ? 0.85 : 1} stroke={pal.ink} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                  </g>
                );
              })}
              {ids.slice(s.items.length).map((id) => <g key={id} {...dataOf(id, "stop", at)} data-ids={ids.join(" ")} />)}
            </g>
          );
        })}
        {clock.numerals.map((n) => { const p = fromDu(n.at); return <g key={n.day} {...dataOf(`numeral:${n.day}`, "numeral", p)} aria-hidden="true" />; })}
        <g {...dataOf("numeral:1", "numeral", fromDu(clock.gate.at))} aria-hidden="true">
          <path d={`M${fx(fromDu(clock.gate.at)[0] - 40)} ${fx(fromDu(clock.gate.at)[1])} a40 40 0 0 1 80 0`} fill="none" stroke={pal.gate} strokeWidth={4} vectorEffect="non-scaling-stroke" />
        </g>
        {clock.bus ? (() => { const p = fromDu(clock.bus.at); return (
          <g {...dataOf(JOURNEY_MAP_MARKS.piece, "piece", p)} data-ids={board.today}>
            <rect x={p[0] - 22} y={p[1] - 12} width={44} height={24} rx={8} fill={pal.bus} stroke={pal.ink} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
            <path d={`M${fx(p[0] + 6)} ${fx(p[1] - 12)} l5 -9 l5 9 M${fx(p[0] + 14)} ${fx(p[1] - 12)} l5 -9 l5 9`} fill={pal.busEar} vectorEffect="non-scaling-stroke" />
          </g>); })() : null}
        {herc ? <g {...dataOf(JOURNEY_MAP_MARKS.hercules, "hercules", herc)} data-ids={JOURNEY_MAP_MARKS.hercules}>
          <circle cx={herc[0]} cy={herc[1]} r={18} fill={colourOf(theme, "furWhite")} stroke={colourOf(theme, "tan")} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </g> : null}
      </>
    );
  } else if (level === "year") {
    const year = layoutYear(board);
    const coast = land.coastline;
    const k = YEAR_MINI_SCALE;
    const miniPath = coast.map((p, i) => `${i ? "L" : "M"}${fx((p[0] - frame.centre[0]) * k)} ${fx((p[1] - frame.centre[1]) * k)}`).join(" ") + " Z";
    body = (
      <>
        {year.minis.map((m) => {
          const at = fromDu(m.at);
          const r = 1.58 * perDu;
          const empty = m.treatment === "empty", future = m.treatment === "future";
          return (
            <g key={m.chapterId} {...dataOf(m.chapterId, "mini", [at[0], at[1] + r])} data-ids={m.chapterId} data-treatment={m.treatment} data-kept={m.kept ? "" : undefined}>
              <circle cx={at[0]} cy={at[1]} r={r} fill={empty ? pal.roadPast : pal.plinth} stroke={pal.ink} strokeOpacity={0.3} strokeDasharray={empty ? "4 3" : undefined} vectorEffect="non-scaling-stroke" />
              <circle cx={at[0]} cy={at[1]} r={1.15 * perDu} fill={pal.water} />
              <path d={miniPath} transform={`translate(${fx(at[0])} ${fx(at[1])})`} fill={pal.grass} fillOpacity={empty ? 0.45 : future ? 0.7 : 1} />
              {m.toCheck > 0 ? <NeedsRing at={at} r={1.68 * perDu} theme={theme} /> : null}
              <g transform={`translate(${fx(at[0] + 0.55 * perDu)} ${fx(at[1] + 0.4 * perDu)})`}>
                {m.stack.map((c, i) => <StackBar key={c.fill} stack={yearBar(c)} x={(m.stack.length > 1 ? (i ? 0.23 : -0.23) : 0) * perDu} widthM={0.3 * perDu} perDu={perDu} theme={theme} />)}
              </g>
              {m.kept ? <path d={`M${fx(at[0] - 0.9 * perDu)} ${fx(at[1] - 0.6 * perDu)} v-60 l40 14 l-40 14`} fill={pal.gate} stroke={pal.ink} strokeWidth={1} vectorEffect="non-scaling-stroke" /> : null}
            </g>
          );
        })}
      </>
    );
  } else {
    const week = layoutWeek(board, land, frame, { orientation });
    const line = (pts: readonly Point2[]) => pts.map((p, i) => `${i ? "L" : "M"}${fx(p[0])} ${fx(p[1])}`).join(" ");
    body = (
      <>
        <g className="journey-map-flat__trail" aria-hidden="true">
          <path d={line(week.pastTrail)} fill="none" stroke={pal.roadPast} strokeWidth={10} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={line(week.trail)} fill="none" stroke={pal.ink} strokeOpacity={0.42} strokeWidth={12} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={line(week.trail)} fill="none" stroke={pal.lane} strokeWidth={9} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {week.spur.length === 2 ? <path d={line(week.spur)} fill="none" stroke={pal.lane} strokeWidth={4} vectorEffect="non-scaling-stroke" /> : null}
        </g>
        {week.tiles.map((t) => {
          const half = (t.edgeDu * perDu) / 2;
          const ids = t.stopIds.length ? t.stopIds : [t.date];
          const byId = new Map(board.stops.map((s) => [s.id, s] as const));
          return (
            <g key={t.date} {...dataOf(t.date, "tile", t.at)} data-ids={ids.join(" ")} data-size={t.size} data-next={t.next ? "" : undefined}>
              <rect x={t.at[0] - half} y={t.at[1] - half} width={half * 2} height={half * 2} rx={half * 0.2} fill={pal[t.colour]} stroke={t.size === "today" ? pal.tbase : t.next ? pal.honey : pal.ink} strokeOpacity={t.size === "today" || t.next ? 1 : 0.3} strokeWidth={t.size === "today" || t.next ? 3 : 1} vectorEffect="non-scaling-stroke" />
              {t.needsYou ? <NeedsRing at={t.at} r={half * 1.25} theme={theme} /> : null}
              {t.toyIds.map((id, i) => {
                const stop = byId.get(id);
                const stack = stop ? stackFor(stop, "week") : null;
                return stack ? <g key={id} transform={`translate(${fx(t.at[0] + (t.toyIds.length > 1 ? (i ? 0.2 : -0.2) : 0) * perDu)} ${fx(t.at[1])})`}><StackBar stack={asBar(stack)} x={0} widthM={0.1 * perDu} perDu={perDu} theme={theme} /></g> : null;
              })}
              {t.stopIds.map((id) => <g key={id} {...dataOf(id, "stop", t.at)} data-ids={ids.join(" ")} />)}
            </g>
          );
        })}
        {week.pile ? (() => { const p = week.pile; const half = (p.edgeDu * perDu) / 2; return (
          <g {...dataOf(JOURNEY_MAP_MARKS.pile, "pile", p.at)} data-ids={p.stopIds.join(" ")} data-count={p.count}>
            <rect x={p.at[0] - half} y={p.at[1] - half} width={half * 2} height={half * 2} rx={half * 0.2} fill={pal.tcheck} stroke={pal.ink} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
            <NeedsRing at={p.at} r={half * 1.25} theme={theme} />
            {p.stopIds.map((id) => <g key={id} {...dataOf(id, "stop", p.at)} data-ids={p.stopIds.join(" ")} />)}
          </g>); })() : null}
        {week.tiles[0] ? <g {...dataOf(JOURNEY_MAP_MARKS.piece, "piece", week.tiles.find((t) => t.size === "today")?.at ?? week.tiles[0].at)} data-ids={board.today} /> : null}
      </>
    );
  }
  const sel = selection;
  return (
    <g className={`journey-map-flat journey-map-flat--${level} journey-map-flat--${theme}`} data-board-flat="" data-level={level} data-selection={sel ?? undefined} onClick={onClick}>
      <g aria-hidden="true">{body}</g>
    </g>
  );
}

export default BoardFlat;
/** The flat diorama frame helper (re-exported so the UI frames the twin exactly as the scene does). */
export { frameFromCoast, polar };
