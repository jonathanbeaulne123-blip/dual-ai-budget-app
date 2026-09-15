import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import {
  BOOK_GATE_X,
  PLATE_VIEW,
  bookHeadState,
  bookmarkStance,
  concertinaCornerX,
  concertinaPanels,
  concertinaView,
  floorRulings,
  foreEdgeIsFlush,
  formatCad,
  formatDateLabel,
  formatMonthLabel,
  fundPlates,
  fundWidgetIdForPlateId,
  gateIndex,
  gateShift,
  gaugeFillWidth,
  gaugeIsOver,
  gaugeThresholdX,
  monthKeyFromDateKey,
  phoneRail,
  pocketCards,
  railFor,
  ribbonHeights,
  trackMarkHeight,
  trackPeakCents,
  trackX,
  wellColumns,
  wellWater,
  type DeskPlateModel,
  type FundWidgetId,
  type Household,
  type PlateFigure,
} from "./core/index.ts";
import { FUND_WIDGET_CARD } from "./FundDrawer.tsx";
import "./fund-standing-book.css";

/**
 * The Standing Book — the Fund board as a book. Its fore-edge is the tablist:
 * one bookmark per rail slot, the same roving-tabindex contract as FundBoard,
 * and the same `onSelect`. Open, it is a V-fold room: the gutter is a corner
 * and the corner is today — what happened stands in ink on the left wall, what
 * is coming lies in pencil on the right. The selected plate's mechanism stands
 * on the floor flap; the running head carries the Level plate's glance and
 * edge, the plinth its footing and verdict. Every number is a plate's own.
 * Nested buttons are illegal, so the room sits beside the tablist, never in it.
 * Display only: nothing here posts, settles, or moves a cent.
 */

const WELL_TOP = 12;
const WELL_DEPTH = 40;
const POCKET_TOP = 24;
const CARD_HEIGHT = 22;
const RIBBON_MID = 40;
const BAND_Y = 20;
const BAND_HEIGHT = 10;
const TRACK_BASELINE = 44;

function motionReduced(): boolean {
  return (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)
    || (typeof document !== "undefined" && document.documentElement.dataset.motion === "reduced");
}

/** The concertina: one strip folded once per point. Standing ink left of the corner, flat pencil right of it. */
function Concertina({ figure }: { figure: Extract<PlateFigure, { primitive: "spark" }> }) {
  const view = concertinaView(figure.room);
  const panels = concertinaPanels(figure.points, figure.room, figure.actualCount);
  const corner = concertinaCornerX(figure.points.length, figure.actualCount);
  const standing = panels.filter((panel) => panel.standing);
  return (
    <svg className="fund-book-svg fund-book-concertina" viewBox={`0 0 ${PLATE_VIEW.width} ${view.height}`} role="img" aria-hidden="true">
      <line className="fund-book-rail" x1={PLATE_VIEW.left} x2={PLATE_VIEW.right} y1={view.base} y2={view.base} />
      {panels.map((panel, index) => panel.standing
        ? (
          <polygon
            key={index}
            className={`fund-book-panel is-standing is-${panel.fold}`}
            points={`${panel.x0},${panel.y0} ${panel.x1},${panel.y1} ${panel.x1},${view.base} ${panel.x0},${view.base}`}
          />
        )
        : <line key={index} className="fund-book-pencil is-projected is-flat" x1={panel.x0} y1={panel.y0} x2={panel.x1} y2={panel.y1} />)}
      {standing.length ? (
        <polyline
          className="fund-book-ink"
          points={[`${standing[0]!.x0},${standing[0]!.y0}`, ...standing.map((panel) => `${panel.x1},${panel.y1}`)].join(" ")}
        />
      ) : null}
      {corner !== null ? <line className="fund-book-corner" x1={corner} x2={corner} y1={2} y2={view.height - 2} /> : null}
    </svg>
  );
}

/**
 * The tab-in-slot strip, read past a fixed gate. The strip moves; the gate does
 * not. Whatever mark stands in the gate is what the line beneath is about. The
 * cellar's idiom: arrow keys, Home and End on the group, a button per mark, and
 * two real buttons so the gesture is never the only way in.
 */
function TrackGate({ figure }: { figure: Extract<PlateFigure, { primitive: "track" }> }) {
  const [cursor, setCursor] = useState(0);
  const marks = figure.marks;
  const at = gateIndex(cursor, marks.length);
  const inGate = marks[at] ?? null;
  const peak = trackPeakCents(marks.map((mark) => mark.cents));
  const shift = inGate ? gateShift(inGate.day, figure.days) : 0;
  const ticks: number[] = [];
  for (let day = 1; day <= figure.days; day += 1) {
    if (day === 1 || day === figure.days || day % Math.max(1, Math.round(figure.days / 4)) === 0) ticks.push(day);
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      setCursor((current) => gateIndex(current + (event.key === "ArrowLeft" ? -1 : 1), marks.length));
    }
    if (event.key === "Home") { event.preventDefault(); setCursor(0); }
    if (event.key === "End") { event.preventDefault(); setCursor(gateIndex(marks.length - 1, marks.length)); }
  };
  return (
    <div className="fund-book-gate-room">
      <div
        className="fund-book-gate-view"
        tabIndex={0}
        role="group"
        aria-label="The strip, mark by mark. Use the arrow keys; the mark in the gate is the one described below."
        onKeyDown={onKeyDown}
      >
        <div className="fund-book-gate" aria-hidden="true" />
        <svg className="fund-book-svg fund-book-strip-svg" viewBox={`0 0 ${PLATE_VIEW.width} 52`} role="img" aria-hidden="true">
          <g className="fund-book-strip" style={{ transform: `translateX(${shift}px)` }}>
            <line className="fund-book-rail" x1={PLATE_VIEW.left} x2={PLATE_VIEW.right} y1={TRACK_BASELINE} y2={TRACK_BASELINE} />
            {ticks.map((day) => (
              <line key={`tick-${day}`} className="fund-book-tick" x1={trackX(day, figure.days)} x2={trackX(day, figure.days)} y1={TRACK_BASELINE} y2={TRACK_BASELINE + 3} />
            ))}
            {marks.map((mark, index) => {
              const x = trackX(mark.day, figure.days);
              const height = trackMarkHeight(mark.cents, peak, figure.room);
              return (
                <rect
                  key={`${mark.label}-${index}`}
                  className={`fund-book-ghost is-standing${index === at ? " is-in-gate" : ""}`}
                  x={x - 4}
                  y={TRACK_BASELINE - height}
                  width={8}
                  height={height}
                />
              );
            })}
          </g>
        </svg>
      </div>
      <div className="fund-book-gate-marks">
        <button type="button" className="fund-book-gate-step" disabled={at <= 0} onClick={() => setCursor(gateIndex(at - 1, marks.length))}>Sooner</button>
        <div className="fund-book-gate-list" role="group" aria-label="Marks on the strip">
          {marks.map((mark, index) => (
            <button
              type="button"
              key={`${mark.label}-${index}`}
              className={`fund-book-gate-mark${index === at ? " is-in-gate" : ""}`}
              aria-current={index === at ? "true" : undefined}
              onClick={() => setCursor(index)}
            >
              {mark.label}
            </button>
          ))}
        </div>
        <button type="button" className="fund-book-gate-step" disabled={at >= marks.length - 1} onClick={() => setCursor(gateIndex(at + 1, marks.length))}>Later</button>
      </div>
      <p className="fund-book-gate-line" aria-live="polite">
        {inGate
          ? `${inGate.label} stands in the gate: day ${inGate.day}, ${formatCad(inGate.cents)}. Dated and fixed, so ghost paper; not counted as gone until it goes.`
          : "Nothing stands in the gate."}
      </p>
    </div>
  );
}

/** Wells sunk into the page, filled to level. A goal is a vessel, not a tower; the back wall is ruled so the eye reads the water against ink. */
function Wells({ figure }: { figure: Extract<PlateFigure, { primitive: "fill" }> }) {
  const columns = wellColumns(figure.wells.length);
  const rulings = floorRulings(4);
  const clipId = useId();
  return (
    <svg className="fund-book-svg fund-book-wells" viewBox={`0 0 ${PLATE_VIEW.width} ${WELL_TOP + WELL_DEPTH + 14}`} role="img" aria-hidden="true">
      {figure.wells.map((well, index) => {
        const column = columns[index]!;
        const water = wellWater(well.savedCents, well.targetCents, WELL_DEPTH);
        const clip = `${clipId}-${index}`;
        return (
          <g key={well.name} clipPath={`url(#${clip})`}>
            <clipPath id={clip}><rect x={column.x} y={0} width={column.width} height={WELL_TOP + WELL_DEPTH + 14} /></clipPath>
            <rect className="fund-book-well" x={column.x} y={WELL_TOP} width={column.width} height={WELL_DEPTH} />
            {rulings.map((_, ruling) => (
              <line key={ruling} className="fund-book-well-rule" x1={column.x} x2={column.x + column.width} y1={WELL_TOP + ruling * (WELL_DEPTH / 4)} y2={WELL_TOP + ruling * (WELL_DEPTH / 4)} />
            ))}
            <rect className="fund-book-water" x={column.x} y={WELL_TOP + WELL_DEPTH - water} width={column.width} height={water} />
            <text className="fund-book-caption" x={column.x} y={9}>{well.name}</text>
            <text className="fund-book-caption is-figure" x={column.x} y={WELL_TOP + WELL_DEPTH + 11}>{formatCad(well.savedCents)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** A pocket with cards standing in it. Thickness is the count; the pocket never encodes an amount. */
function Pocket({ figure }: { figure: Extract<PlateFigure, { primitive: "tally" }> }) {
  const cards = pocketCards(figure.count);
  return (
    <svg className="fund-book-svg fund-book-pocket-svg" viewBox={`0 0 ${PLATE_VIEW.width} 48`} role="img" aria-hidden="true">
      {cards.map((card, index) => (
        <rect key={index} className="fund-book-card is-standing" x={card.x} y={card.y} width={14} height={CARD_HEIGHT} />
      ))}
      <rect className="fund-book-pocket" x={PLATE_VIEW.left} y={POCKET_TOP} width={PLATE_VIEW.right - PLATE_VIEW.left} height={20} />
      <text className="fund-book-caption" x={PLATE_VIEW.left + 6} y={POCKET_TOP + 14}>
        {cards.length ? `${cards.length} in the pocket` : "An empty pocket"}
      </text>
    </svg>
  );
}

/** Two ribbons entering from the page edges and meeting at the corner. Height is the amount on one scale. */
function Ribbons({ figure }: { figure: Extract<PlateFigure, { primitive: "pair" }> }) {
  const heights = ribbonHeights(figure.upCents, figure.downCents, figure.room);
  return (
    <svg className="fund-book-svg fund-book-ribbons" viewBox={`0 0 ${PLATE_VIEW.width} 80`} role="img" aria-hidden="true">
      <line className="fund-book-rail" x1={PLATE_VIEW.left} x2={PLATE_VIEW.right} y1={RIBBON_MID} y2={RIBBON_MID} />
      <rect className="fund-book-ribbon is-up" x={PLATE_VIEW.left} y={RIBBON_MID - heights.up} width={BOOK_GATE_X - PLATE_VIEW.left} height={heights.up} />
      <rect className="fund-book-ribbon is-down" x={BOOK_GATE_X} y={RIBBON_MID} width={PLATE_VIEW.right - BOOK_GATE_X} height={heights.down} />
      <line className="fund-book-corner" x1={BOOK_GATE_X} x2={BOOK_GATE_X} y1={2} y2={78} />
      <text className="fund-book-caption" x={PLATE_VIEW.left} y={10}>{figure.upLabel} {formatCad(figure.upCents)}</text>
      <text className="fund-book-caption is-down" x={PLATE_VIEW.left} y={76}>{figure.downLabel} {formatCad(figure.downCents)}</text>
    </svg>
  );
}

/** A ruled band on the floor with the threshold printed on it. */
function FloorBand({ figure }: { figure: Extract<PlateFigure, { primitive: "gauge" }> }) {
  const fill = gaugeFillWidth(figure.pct);
  const thresholdX = gaugeThresholdX(figure.threshold);
  const over = gaugeIsOver(figure.pct, figure.threshold);
  const rulings = floorRulings(4);
  return (
    <svg className="fund-book-svg fund-book-band" viewBox={`0 0 ${PLATE_VIEW.width} 40`} role="img" aria-hidden="true">
      <rect className="fund-book-band-ground" x={PLATE_VIEW.left} y={BAND_Y} width={PLATE_VIEW.right - PLATE_VIEW.left} height={BAND_HEIGHT} />
      <rect className={`fund-book-band-fill${over ? " is-over" : ""}`} x={PLATE_VIEW.left} y={BAND_Y} width={fill} height={BAND_HEIGHT} />
      {rulings.map((x) => <line key={x} className="fund-book-tick" x1={x} x2={x} y1={BAND_Y + BAND_HEIGHT} y2={BAND_Y + BAND_HEIGHT + 3} />)}
      <line className="fund-book-threshold" x1={thresholdX} x2={thresholdX} y1={BAND_Y - 5} y2={BAND_Y + BAND_HEIGHT + 5} />
      <text className="fund-book-caption" x={PLATE_VIEW.left} y={12}>
        {figure.label} · {Math.round(figure.pct * 100)}% · mark {Math.round(figure.threshold * 100)}%{over ? " · over" : ""}
      </text>
    </svg>
  );
}

/** The six primitives as paper mechanisms. Exhaustive: a seventh primitive is a type error here before it is a drawing anywhere. */
export function BookFigureView({ figure }: { figure: PlateFigure }) {
  switch (figure.primitive) {
    case "spark":
      return <Concertina figure={figure} />;
    case "track":
      return <TrackGate figure={figure} />;
    case "fill":
      return <Wells figure={figure} />;
    case "tally":
      return <Pocket figure={figure} />;
    case "pair":
      return <Ribbons figure={figure} />;
    case "gauge":
      return <FloorBand figure={figure} />;
    default: {
      const never: never = figure;
      return never;
    }
  }
}

/** The running head across a wall top: the Level's glance and its edge state. Which halves print depends on the wall. */
function RunningHead({ level, month, showLevel, showState }: { level: DeskPlateModel | null; month: string; showLevel: boolean; showState: boolean }) {
  return (
    <div className="fund-book-head">
      {showLevel ? (
        <>
          <span className="fund-book-head-month">The Fund · {month}</span>
          <span className="fund-book-head-level">{level ? level.glance : "—"}</span>
        </>
      ) : null}
      {showState ? (
        <span className="fund-book-head-state" data-edge={level?.edge ?? "quiet"}>{level ? bookHeadState(level.edge) : "No Fund yet"}</span>
      ) : null}
    </div>
  );
}

export function FundStandingBook({ household, memberId, today, presentation, selected, onSelect, plates, onOpenCabinet, panelId = "fund-stage-panel" }: {
  household: Household; memberId: string; today: string; presentation: "phone" | "desk";
  selected: FundWidgetId; onSelect: (id: FundWidgetId) => void;
  panelId?: string;
  plates?: DeskPlateModel[]; onOpenCabinet?: (plate: DeskPlateModel) => void;
}) {
  const activeMember = household.members.some(member => member.id === memberId && member.active);
  const models = useMemo(() => activeMember ? plates ?? fundPlates({ household, memberId, today }) : [], [activeMember, plates, household, memberId, today]);
  const byId = new Map(models.map(plate => [fundWidgetIdForPlateId(plate.id), plate]));
  const rail = railFor(household, memberId, presentation);
  const slots = presentation === "phone" ? phoneRail(rail) : rail;
  const level = models.find((plate) => plate.id === "fund-level") ?? null;
  const shown = byId.get(selected) ?? null;
  const phone = presentation === "phone";
  // Reduced motion: the book is already open and nothing travels. Otherwise the
  // first paint is the shut book on the hearth and the next frame opens it.
  const [open, setOpen] = useState(() => motionReduced());
  const [face, setFace] = useState<"left" | "right">("left");
  useEffect(() => {
    if (open) return;
    if (typeof requestAnimationFrame === "function") {
      const frame = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(frame);
    }
    const timer = setTimeout(() => setOpen(true), 0);
    return () => clearTimeout(timer);
    // The ceremony runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!activeMember) return null;
  const navigate = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const tabs = [...(event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])];
    const index = tabs.indexOf(event.currentTarget);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
      : (index + (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1) + tabs.length) % tabs.length;
    event.preventDefault(); tabs[next]?.focus();
  };
  const month = formatMonthLabel(monthKeyFromDateKey(today));
  const flush = foreEdgeIsFlush(slots.flatMap((id) => { const plate = byId.get(id); return plate ? [plate.edge] : []; }));
  const leftHidden = phone && face !== "left" ? true : undefined;
  const rightHidden = phone && face !== "right" ? true : undefined;
  return <div className={`fund-book is-${presentation}`}
    data-fund-book-open={open ? "true" : "false"}
    data-fund-book-edge={flush ? "flush" : "proud"}
    data-fund-book-state={level?.edge ?? "quiet"}
    data-fund-book-face={face}>
    <div className="fund-book-cover" aria-hidden="true">
      <span className="fund-book-plate"><b>The Fund</b><small>{month}</small></span>
      <span className="fund-book-dogear" />
    </div>
    <div className="fund-book-room">
      <div className="fund-book-fold">
      <span className="fund-book-spine" aria-hidden="true" />
      <div className="fund-book-leaf is-left" hidden={leftHidden}>
        <RunningHead level={level} month={month} showLevel showState={phone} />
        <span className="fund-book-today" aria-hidden="true">today · {formatDateLabel(today)}</span>
        <div className="fund-book-wall is-ink">
          <p className="fund-book-kicker">Left wall · what happened</p>
          <h3 className="fund-book-chapter">{shown?.kicker ?? FUND_WIDGET_CARD[selected].name}</h3>
          {shown ? <p className="fund-book-figure">{shown.glance}</p> : null}
          <p className="fund-book-verdict">{shown?.verdict ?? FUND_WIDGET_CARD[selected].line}</p>
        </div>
      </div>
      <div className="fund-book-leaf is-right" hidden={rightHidden}>
        <RunningHead level={level} month={month} showLevel={phone} showState />
        <span className="fund-book-today" aria-hidden="true">today · {formatDateLabel(today)}</span>
        <div className="fund-book-wall is-pencil">
          <p className="fund-book-kicker">Right wall · what is coming</p>
          <p className="fund-book-pencil-note">{shown?.footing ?? "Nothing is pencilled here yet."}</p>
          {shown?.empty ? <p className="fund-book-pencil-note">{shown.empty}</p> : null}
          {onOpenCabinet && shown ? (
            <button type="button" className="fund-book-handle" onClick={() => onOpenCabinet(shown)} aria-label={`Open the ${shown.cabinetName} cabinet`}>Cabinet</button>
          ) : null}
        </div>
      </div>
      <div className="fund-book-floor">
        <div className="fund-book-stand" data-plate-primitive={shown?.figure.primitive}>
          {shown && !shown.empty
            ? <BookFigureView figure={shown.figure} />
            : <p className="fund-book-floor-note">{shown?.empty ?? "The floor is bare on this chapter."}</p>}
        </div>
        <div className="fund-book-plinth">
          <span className="fund-book-plinth-footing">{level ? level.footing : "No Fund on the hearth yet."}</span>
          <span className="fund-book-plinth-verdict">{level ? level.verdict : ""}</span>
        </div>
      </div>
      </div>
    </div>
    <div className="fund-book-edge" role="tablist" aria-label="Fund board">
      {slots.map(id => {
        const plate = byId.get(id);
        const stance = bookmarkStance(plate?.edge ?? "clear");
        return <button type="button" key={id}
          className={`fund-book-mark edge-${plate?.edge ?? "quiet"}${stance.dogEar ? " is-dogeared" : ""}`}
          data-fund-widget={id}
          data-reach={stance.reach}
          data-plate-id={plate?.id}
          role="tab"
          id={presentation === "desk" ? `fund-rail-tab-${plate?.id ?? id}` : `${panelId}-tab-${id}`}
          aria-controls={panelId}
          aria-selected={selected === id}
          aria-current={selected === id ? "true" : undefined}
          aria-label={plate ? `${plate.kicker}. ${plate.glance}. ${plate.verdict}` : undefined}
          tabIndex={selected === id ? 0 : -1}
          onKeyDown={navigate} onClick={() => { onSelect(id); if (!open) setOpen(true); }}>
          <span className="fund-book-mark-name">{FUND_WIDGET_CARD[id].name}</span>
          {plate ? <strong className="fund-book-mark-glance">{plate.glance}</strong> : null}
        </button>;
      })}
    </div>
    {phone ? (
      <div className="fund-book-cross" role="group" aria-label="Cross the corner">
        <button type="button" className="fund-book-cross-button" aria-pressed={face === "left"} onClick={() => setFace("left")}>What happened</button>
        <button type="button" className="fund-book-cross-button" aria-pressed={face === "right"} onClick={() => setFace("right")}>What is coming</button>
      </div>
    ) : null}
    <button type="button" className="fund-book-clasp" aria-pressed={!open} onClick={() => setOpen((current) => !current)}>
      {open ? "Shut the book" : "Open the book"}
    </button>
  </div>;
}
