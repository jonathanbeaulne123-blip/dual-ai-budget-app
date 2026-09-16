import type { ReactNode } from "react";
import { addDays, type DateKey } from "../../core/calendar.ts";
import type { ThemeId } from "../../theme/scenes.ts";
import { MINI_PALETTES, miniLapRadius, type MiniSceneEra } from "./miniWorld3d.ts";
import type { MiniEra, MiniJourney, MiniMonth } from "./miniJourneyModel.ts";

/**
 * The simple view without WebGL (Lite, no WebGL, forced colours): the same five
 * levels drawn flat. The drawing is decorative; every label is the same real
 * button the 3D view places, positioned from `spots` (viewBox units).
 */

export type FlatSpot = { x: number; y: number };
export type FlatLayout = { svg: ReactNode; spots: Map<string, FlatSpot>; width: number; height: number };

const H = 240;

export function flatLayout(input: {
  level: number;
  theme: ThemeId;
  aspect: number;
  journey: MiniJourney;
  month: MiniMonth;
  focusDate: DateKey;
  era: MiniEra | null;
  eraIndex: number;
  sceneEras: MiniSceneEra[];
  whoOf: (id: string | null) => "a" | "b" | "both";
}): FlatLayout {
  const P = MINI_PALETTES[input.theme] ?? MINI_PALETTES.classic;
  const W = Math.round(Math.max(1.1, Math.min(3.2, input.aspect)) * H);
  const spots = new Map<string, FlatSpot>();
  const out: ReactNode[] = [];
  const { level, month } = input;
  const key = (...parts: (string | number)[]) => parts.join(":");

  if (level <= 1) {
    const focusDay = Number(input.focusDate.slice(8, 10)) || 1;
    const dim = month.days.length;
    let from: number, to: number;
    if (level === 0) {
      const n = W > 520 ? 7 : 5;
      from = Math.max(1, Math.min(dim - n + 1, focusDay - Math.floor(n / 2)));
      to = Math.min(dim, from + n - 1);
    } else {
      const week = month.weeks.find((w) => input.focusDate >= w.start && input.focusDate <= w.end) ?? month.weeks[0]!;
      from = Number(week.start.slice(8, 10));
      to = Number(week.end.slice(8, 10));
    }
    const left = 70, right = 16;
    const n = to - from + 1;
    const x = (d: number) => left + (d - from + 0.5) * (W - left - right) / Math.max(n, 5);
    const lanes = [["prepare", 158], ["protect", 176], ["build", 194]] as const;
    out.push(<rect key="bg" x={0} y={0} width={W} height={H} fill={P.ground} opacity={0.55} />);
    out.push(<rect key="water" x={0} y={92} width={W} height={34} fill={P.water} />);
    out.push(<rect key="chan" x={0} y={146} width={W} height={60} fill={P.channel} opacity={0.35} />);
    for (const [lane, y] of lanes) out.push(<line key={lane} x1={0} x2={W} y1={y} y2={y} stroke={P[lane]} strokeWidth={6} strokeLinecap="round" />);
    spots.set("lane:everyday", { x: 8, y: 124 });
    for (const [lane, y] of lanes) spots.set(`lane:${lane}`, { x: 8, y: y + 4 });
    out.push(<line key="path" x1={x(from) - 20} x2={x(to) + 20} y1={109} y2={109} stroke={P.stoneEdge} strokeDasharray="2 5" />);
    for (let d = from; d <= to; d += 1) {
      const day = month.days[d - 1];
      if (!day) continue;
      const X = x(d);
      const big = day.items.some((row) => row.kind !== "task") || day.today;
      day.items.forEach((item, i) => {
        if (item.kind === "bill") {
          const y = item.lane === "build" ? 194 : 158;
          out.push(<line key={key("b", d, i)} x1={X + i * 3} x2={X + i * 3} y1={116} y2={y} stroke={P.bill} strokeWidth={2} strokeDasharray="2 4" />);
        } else if (item.kind === "contribution") {
          lanes.forEach(([lane, y], m) => out.push(<path key={key("c", d, i, m)} d={`M${X} 116 C${X} ${y - 10} ${X + 14 + m * 8} ${y - 6} ${X + 26 + m * 12} ${y}`} fill="none" stroke={P[lane]} strokeWidth={2} opacity={item.expected ? 0.55 : 1} />));
        }
      });
      out.push(<ellipse key={key("s", d)} cx={X} cy={109} rx={big ? 15 : 9} ry={big ? 7 : 4.5} fill={day.past && !day.today ? P.stonePast : P.stone} stroke={day.today ? P.today : P.stoneEdge} strokeWidth={day.today ? 3.5 : 1.2} />);
      const inflow = day.items.find((row) => row.kind === "contribution");
      if (inflow) {
        out.push(<g key={key("q", d)} opacity={inflow.kind === "contribution" && inflow.expected ? 0.6 : 1}>
          <rect x={X - 7} y={90} width={14} height={11} rx={2} fill={P.pot} />
          <circle cx={X} cy={85} r={5.5} fill={P.porcelain} stroke={P.stoneEdge} strokeWidth={0.8} />
          <circle cx={X - 3} cy={79} r={2.2} fill={P.bloom} /><circle cx={X + 3} cy={79} r={2.2} fill={P.bloom} /><circle cx={X} cy={77.5} r={2.2} fill={P.bloom} />
        </g>);
      }
      day.items.filter((row) => row.kind === "task").forEach((task, i) => {
        const who = task.kind === "task" ? input.whoOf(task.whoId) : "both";
        const fill = who === "a" ? P.flagA : who === "b" ? P.flagB : P.flagBoth;
        out.push(<path key={key("t", d, i)} d={`M${X + 9 + i * 5} 106 V80 l12 4.5 -12 4.5`} fill={fill} stroke={P.woodDark} strokeWidth={1.2} />);
      });
      if (day.today) {
        const hx = inflow ? X - 11 : X;
        out.push(<g key="herc">
          <path d={`M${hx - 9} 107 q0 -20 9 -20 q9 0 9 20z`} fill={P.herc} />
          <path d={`M${hx - 7} 90 l2 -8 4 6z M${hx + 7} 90 l-2 -8 -4 6z`} fill={P.herc} />
          <ellipse cx={hx} cy={100} rx={4} ry={5} fill={P.hercLight} />
        </g>);
        spots.set("today", { x: X, y: 70 });
      }
      spots.set(`day:${day.date}`, { x: X, y: inflow || day.items.some((row) => row.kind === "task") ? 72 : 96 });
      out.push(<text key={key("n", d)} x={X} y={228} fontSize={11} textAnchor="middle" fill={day.today ? P.today : P.stoneEdge} fontWeight={day.today ? 700 : 500}>{(W - left) / Math.max(n, 5) < 44 ? String(d) : `${day.weekday} ${d}`}</text>);
    }
    if (level === 1) {
      const week = month.weeks.find((w) => input.focusDate >= w.start && input.focusDate <= w.end);
      if (week) spots.set(`week:${week.start}`, { x: W / 2, y: 238 });
    }
    if (to === dim) {
      const gx = Math.min(W - 10, x(dim) + 26);
      out.push(<g key="gate"><rect x={gx - 2} y={84} width={4} height={32} fill={P.wood} /><rect x={gx - 12} y={82} width={24} height={4} fill={P.wood} /></g>);
      spots.set("gate", { x: gx, y: 80 });
    }
  } else if (level === 2) {
    const cx = W / 2, cy = 122, r = 74;
    const dim = month.days.length;
    const anchor = Number(input.journey.today.slice(8, 10)) || 1;
    const angle = (d: number) => Math.PI / 2 - (d - anchor) * 2 * Math.PI / dim;
    out.push(<circle key="ground" cx={cx} cy={cy} r={r + 24} fill={P.ground} opacity={0.6} />);
    out.push(<circle key="water" cx={cx} cy={cy} r={r} fill="none" stroke={P.water} strokeWidth={18} />);
    for (const [lane, dr] of [["prepare", 14], ["protect", 19], ["build", 24]] as const) out.push(<circle key={lane} cx={cx} cy={cy} r={r + dr} fill="none" stroke={P[lane]} strokeWidth={3} />);
    for (const day of month.days) {
      const a = angle(day.day);
      const X = cx + r * Math.cos(a), Y = cy + r * Math.sin(a);
      const inflow = day.items.some((row) => row.kind === "contribution");
      const bill = day.items.some((row) => row.kind === "bill");
      out.push(<circle key={key("d", day.day)} cx={X} cy={Y} r={day.today ? 7 : inflow || bill ? 5 : 3} fill={inflow ? P.queen : bill ? P.bill : day.past ? P.stonePast : P.stone} stroke={day.today ? P.today : "none"} strokeWidth={3} />);
      if (day.today) spots.set("today", { x: X, y: Y - 8 });
    }
    const ga = angle(dim + 0.5);
    const gx = cx + r * Math.cos(ga), gy = cy + r * Math.sin(ga);
    out.push(<rect key="gate" x={gx - 5} y={gy - 12} width={10} height={24} rx={2} fill={P.wood} />);
    spots.set("gate", { x: gx, y: gy - 14 });
    spots.set("chapter", { x: cx, y: cy + 22 });
  } else if (level === 3) {
    const cx = Math.min(W * 0.36, W / 2 - 40), cy = 124;
    const era = input.era;
    const laps = era?.months ?? [];
    const scale = 104 / 13.4;
    out.push(<circle key="island" cx={cx} cy={cy} r={112} fill={P.ground} stroke={P.groundSide} strokeWidth={4} />);
    laps.forEach((lap, j) => {
      const r = miniLapRadius(j, laps.length) * scale;
      const focus = lap.key === month.key;
      out.push(<circle key={lap.key} cx={cx} cy={cy} r={r} fill="none" stroke={focus ? P.today : lap.status === "ahead" ? P.stone : lap.status === "closed" ? P.stonePast : P.water} strokeWidth={focus ? 4 : 2} strokeDasharray={lap.status === "ahead" ? "3 3" : undefined} />);
      if (focus) spots.set("chapter", { x: cx, y: cy - r - 2 });
    });
    out.push(<path key="tent" d={`M${cx - 12} ${cy + 8} L${cx} ${cy - 12} L${cx + 12} ${cy + 8}z`} fill={P.tent} />);
    const banks = era?.banks ?? [];
    const colX = Math.max(cx + 130, W - 150);
    banks.forEach((bank, i) => {
      const y = 40 + i * Math.min(25, 190 / Math.max(1, banks.length));
      out.push(<g key={bank.goalId}>
        <rect x={colX} y={y} width={16} height={18} rx={3} fill={P.glass} stroke={P.stoneEdge} />
        <rect x={colX + 2} y={y + 16 - 14 * bank.fill} width={12} height={14 * bank.fill} rx={1} fill={bank.bought ? P.today : P.gold} />
        <path d={`M${colX + 2} ${y} l3 -5 3 5 M${colX + 8} ${y} l3 -5 3 5`} fill={P.wood} />
      </g>);
      spots.set(`bank:${bank.goalId}`, { x: colX + 22, y: y + 16 });
    });
    if (banks.length) spots.set("finish", { x: colX + 8, y: 30 });
    if (month.current) spots.set("here", { x: cx, y: cy - miniLapRadius(month.lap, laps.length || 1) * scale - 4 });
  } else {
    const eras = input.sceneEras;
    const n = Math.max(1, eras.length);
    const gap = (W - 60) / n;
    const px = (i: number) => 30 + gap * (i + 0.5);
    eras.forEach((_era, i) => {
      if (i > 0) out.push(<line key={key("br", i)} x1={px(i - 1) + 22} x2={px(i) - 22} y1={128} y2={128} stroke={P.wood} strokeWidth={4} strokeDasharray="5 3" />);
    });
    eras.forEach((era, i) => {
      const current = era.state === "current";
      const future = era.state === "future" || era.state === "sketched";
      const r = current ? 30 : 22;
      out.push(<g key={era.id} opacity={future ? 0.62 : 1}>
        {current && <circle cx={px(i)} cy={128} r={r + 7} fill="none" stroke={P.glow} strokeWidth={6} />}
        <ellipse cx={px(i)} cy={128} rx={r} ry={r * 0.62} fill={P.ground} stroke={P.groundSide} strokeWidth={2} strokeDasharray={future ? "4 3" : undefined} />
        <path d={`M${px(i) - r * 0.8} 132 Q${px(i)} ${128 + r * 1.3} ${px(i) + r * 0.8} 132z`} fill={P.earth} />
        <rect x={px(i) - 6} y={116} width={12} height={10} fill={P.wall} /><path d={`M${px(i) - 8} 117 L${px(i)} 108 L${px(i) + 8} 117z`} fill={P.roof} />
        {future && <ellipse cx={px(i) + 8} cy={104} rx={16} ry={7} fill={P.cloud} opacity={0.9} />}
      </g>);
      spots.set(`era:${era.id}`, { x: px(i), y: i % 2 ? 176 : 92 });
      if (current) spots.set("here", { x: px(i), y: i % 2 ? 92 : 176 });
    });
  }
  const svg = (
    <svg className="journey-mini__flat-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
      {out}
    </svg>
  );
  return { svg, spots, width: W, height: H };
}

/** Dates the flat Day view shows around a focus (used by tests and the list). */
export function flatDayWindow(focus: DateKey, days = 5): DateKey[] {
  const half = Math.floor(days / 2);
  return Array.from({ length: days }, (_, i) => addDays(focus, i - half));
}
