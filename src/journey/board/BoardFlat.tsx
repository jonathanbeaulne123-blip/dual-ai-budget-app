/**
 * `<BoardFlat route board selection theme/>` (T3): the board on the SVG twin (flat tier, no WebGL, a failed land load,
 * a lost context). It goes INSIDE `<JourneyLandFlat>`'s overlay slot and draws the SAME `RouteSpace` projected to x/z
 * (concept metres, viewBox 0 0 2000 1800) with the SAME ids as the 3D marks (`boardMarks`): every mark is a
 * `[data-id]` element carrying `data-kind`, `data-x`, `data-y` (its anchor in concept metres) so the UI can place its
 * real buttons over it. The drawing itself is decorative (`aria-hidden`): the UI's buttons and the list carry names,
 * amounts and actions. Nothing here opens or changes anything; `onPick` only reports a pointer pick.
 *
 * Same visual language as the 3D board: worn solid past, bright open month with today raised, upcoming months as
 * stakes and string (a thin line with stake ticks, no fill); later months pass OVER earlier ones.
 */
import type { JourneyBoard, RouteSpace, Stop, ThemeId } from "../contracts.ts";
import { boardDressing } from "./dressing.ts";
import { boardMarks, type BoardMark } from "./marks.ts";
import { findAlternative, type PreviewSelection } from "./preview.ts";

export type BoardFlatProps = {
  route: RouteSpace;
  board: JourneyBoard;
  selection?: string | null;
  theme: ThemeId;
  preview?: PreviewSelection | null;
  /** Pointer convenience only (the UI's buttons are the accessible path). */
  onPick?: (id: string) => void;
};

/** Concept metres per design unit on the flat twin (read whole, ≈ 1000 px wide). */
export const FLAT_UNIT = 1.2;

const pathOf = (points: readonly (readonly [number, number, number])[]) =>
  points.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[2].toFixed(1)}`).join(" ");

function markXY(m: BoardMark): [number, number] {
  return [m.base[0] + m.offset[0] * FLAT_UNIT, m.base[2] + m.offset[1] * FLAT_UNIT];
}

function stopGlyph(stop: Stop, fill: string, ink: string) {
  switch (stop.kind) {
    case "commitment": return <rect x={-5} y={-12} width={10} height={9} rx={1} fill={fill} stroke={ink} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
    case "income": return <path d={stop.status === "confirmed" ? "M0 -16 L11 -12 L0 -8 Z" : "M0 -9 L11 -5 L0 -1 Z"} fill={fill} stroke={ink} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
    case "review": return <path d="M-8 0 V-7 H-4 V-3 H-1 M8 0 V-7 H4 V-3 H1" fill="none" stroke={ink} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />;
    case "plan": return <path d="M0 2 V-18 M-4 -12 H4" fill="none" stroke={ink} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />;
    case "milestone": return <path d={stop.status === "granted" ? "M-8 0 V-8 L0 -15 L8 -8 V0 Z" : "M-8 0 V-8 M8 0 V-8 M-8 -8 H8"} fill={stop.status === "granted" ? fill : "none"} stroke={ink} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />;
    case "memory": return <path d="M0 2 V-16 H11 L8 -12 L11 -8 H0" fill={fill} stroke={ink} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
  }
}

const PIECE_GLYPH: Record<string, string> = {
  lantern: "M-4 3 V-6 H4 V3 Z M-5 -6 L0 -11 L5 -6",
  cat: "M-6 4 V-5 L-4 -10 L-1 -6 H1 L4 -10 L6 -5 V4 Z",
  boat: "M-8 1 H8 L5 5 H-5 Z M0 1 V-11 L7 -1 Z",
  kettle: "M-7 4 Q-8 -4 0 -5 Q8 -4 7 4 Z M7 -1 L11 -5 M-4 -5 Q0 -12 4 -5",
};

export function BoardFlat({ route, board, selection = null, theme, preview = null, onPick }: BoardFlatProps) {
  const d = boardDressing(theme);
  const marks = boardMarks(board, route);
  const stopById = new Map(board.stops.map((s) => [s.id, s]));
  const clustered = new Set(board.clusters.flatMap((c) => c.stopIds));
  const stateOf = new Map(route.months.map((m) => [m.chapterId, m.state]));
  const stretches = [...route.stretches].sort((a, b) => (a.chapterId < b.chapterId ? -1 : 1));
  const selected = selection ? marks.find((m) => m.id === selection) : undefined;
  const previewFound = findAlternative(board, preview);
  const previewMark = previewFound ? marks.find((m) => m.id === previewFound.crossroads.id) : undefined;
  const lastDay = new Set(route.stretches.map((s) => s.days.at(-1)?.date));
  const onClick = onPick ? (e: { target: EventTarget | null }) => {
    const el = (e.target as Element | null)?.closest?.("[data-id]");
    const id = el?.getAttribute("data-id");
    if (id) onPick(id);
  } : undefined;

  const dataOf = (m: BoardMark) => {
    const [x, y] = markXY(m);
    return { "data-id": m.id, "data-kind": m.kind, "data-x": x.toFixed(1), "data-y": y.toFixed(1) };
  };

  return (
    <g className={`journey-board-flat journey-board-flat--${theme}`} data-board-flat="" onClick={onClick}>
      <g className="journey-board-flat__route" aria-hidden="true">
        {stretches.map((s) => {
          const state = stateOf.get(s.chapterId) ?? "open", path = pathOf(s.points);
          return state === "upcoming" ? (
            <g key={s.chapterId} data-stretch={s.chapterId} data-state={state}>
              <path d={path} fill="none" stroke={d.ribbonEdge} strokeWidth={1.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path d={path} fill="none" stroke={d.stakes} strokeWidth={7} strokeDasharray="1.6 11" vectorEffect="non-scaling-stroke" />
            </g>
          ) : (
            <g key={s.chapterId} data-stretch={s.chapterId} data-state={state}>
              <path d={path} fill="none" stroke={d.ribbonEdge} strokeWidth={state === "open" ? 11 : 10} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <path d={path} fill="none" stroke={state === "open" ? d.spaceOpen : d.spacePast} strokeWidth={state === "open" ? 7 : 6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
      </g>
      <g className="journey-board-flat__marks" aria-hidden="true">
        {marks.filter((m) => m.kind === "day").map((m) => {
          const [x, y] = markXY(m), today = m.date === board.today, st = stateOf.get(m.chapterId ?? "") ?? "open";
          if (lastDay.has(m.date ?? "")) return <g key={m.id} {...dataOf(m)} />;
          if (st === "upcoming") return <rect key={m.id} {...dataOf(m)} x={x - 1} y={y - 5} width={2} height={5} fill={d.stakes} />;
          const past = st === "past";
          return <circle key={m.id} {...dataOf(m)} cx={x} cy={y} r={today ? 6.5 : 3.6} fill={today ? d.spaceOpen : m.date! > board.today ? d.spaceUpcoming : past ? d.spacePast : d.spaceOpen} stroke={d.ribbonEdge} strokeWidth={today ? 1.6 : 0.8} vectorEffect="non-scaling-stroke" />;
        })}
        {marks.filter((m) => m.kind === "month").map((m) => {
          const [x, y] = markXY(m), st = stateOf.get(m.id) ?? "open";
          return st === "upcoming" ? (
            <g key={m.id} {...dataOf(m)}>
              <circle cx={x} cy={y} r={16} fill="none" stroke={d.stakes} strokeWidth={1.6} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            </g>
          ) : (
            <g key={m.id} {...dataOf(m)}>
              <circle cx={x} cy={y} r={st === "open" ? 19 : 16} fill={st === "open" ? d.spaceOpen : d.spacePast} stroke={d.ribbonEdge} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
              <circle cx={x} cy={y} r={st === "open" ? 12 : 10} fill={d.spaceInset} />
            </g>
          );
        })}
        {marks.filter((m) => m.kind === "cluster").map((m) => {
          const [x, y] = markXY(m);
          return (
            <g key={m.id} {...dataOf(m)} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              <rect x={-7} y={-9} width={14} height={9} rx={1.5} fill={d.clusterBase} stroke={d.ribbonEdge} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <rect x={-5.5} y={-12} width={11} height={4} rx={1} fill={d.paper} stroke={d.ribbonEdge} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
        {marks.filter((m) => m.kind === "stop").map((m) => {
          const [x, y] = markXY(m), stop = stopById.get(m.id)!;
          if (clustered.has(m.id)) return <g key={m.id} {...dataOf(m)} data-cluster="" />;
          const attention = (stop.kind === "commitment" && (stop.status === "overdue" || stop.status === "needs-review")) || (stop.kind === "review" && stop.reviewKind === "chapter-close" && (stop.status === "close-due" || stop.status === "waiting-on-you"));
          return (
            <g key={m.id} {...dataOf(m)} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              {stopGlyph(stop, attention ? d.attention : d.paper, d.ribbonEdge)}
              {attention ? <path d="M0 -24 L3 -20 L0 -16 L-3 -20 Z" fill={d.attention} /> : null}
            </g>
          );
        })}
        {marks.filter((m) => m.kind === "crossroads").map((m) => {
          const [x, y] = markXY(m);
          return (
            <g key={m.id} {...dataOf(m)} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              <path d="M0 2 V-16 M0 -13 L9 -17 M0 -8 L-9 -12" fill="none" stroke={d.ribbonEdge} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
        {marks.filter((m) => m.kind === "piece").map((m) => {
          const [x, y] = markXY(m), look = d.piece[board.piece.lookId] ?? d.piece.lantern;
          return (
            <g key={m.id} {...dataOf(m)} transform={`translate(${x.toFixed(1)} ${(y - 6).toFixed(1)})`}>
              <circle r={13} fill={look.accent} stroke={look.body} strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <path d={PIECE_GLYPH[board.piece.lookId] ?? PIECE_GLYPH.lantern!} fill={look.body} stroke={look.body} strokeWidth={1} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
        {selected ? (() => {
          const [x, y] = markXY(selected);
          return <circle className="journey-board-flat__selection" cx={x} cy={y} r={selected.kind === "month" ? 24 : 15} fill="none" stroke={d.selectionRing} strokeWidth={2.4} vectorEffect="non-scaling-stroke" />;
        })() : null}
        {previewMark && previewFound ? (() => {
          const [x, y] = markXY(previewMark);
          return (
            <g className="journey-board-flat__preview" data-preview={previewFound.alternative.id}>
              <circle cx={x} cy={y} r={24} fill="none" stroke={d.provisional} strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
              {!previewFound.alternative.isCurrent && previewFound.alternative.preview.kind !== "home"
                ? <path d={`M${x} ${y} q 40 -10 70 -60`} fill="none" stroke={d.provisional} strokeWidth={2.4} strokeDasharray="7 5" vectorEffect="non-scaling-stroke" />
                : null}
            </g>
          );
        })() : null}
      </g>
    </g>
  );
}

export default BoardFlat;
