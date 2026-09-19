import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import {
  BOOK_GATE_X,
  PLATE_VIEW,
  accountRegister,
  accountRowAmount,
  accountRowEdge,
  accountRowFigure,
  accountRowVerdict,
  accountRows,
  binderDividers,
  bookHeadState,
  booksPresentationFloor,
  bookmarkStance,
  categoryRowAmount,
  categoryRowEdge,
  categoryRowFigure,
  categoryRowHasShape,
  categoryRowVerdict,
  categoryShape,
  compileHousehold,
  concertinaCornerX,
  concertinaPanels,
  concertinaView,
  figureFlags,
  flagHue,
  floorRulings,
  foreEdgeIsFlush,
  formatCad,
  FUND_WIDGETS,
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
  openPage,
  phoneRail,
  pocketCards,
  railFor,
  registerStrip,
  ribbonHeights,
  sectionIsPaged,
  trackMarkHeight,
  trackPeakCents,
  trackX,
  wellColumns,
  wellWater,
  widgetAllowedFor,
  type AccountRow,
  type CategoryShape,
  type CompiledBooks,
  type DeskPlateModel,
  type FundWidgetId,
  type Household,
  type OpenPages,
  type PageFlag,
  type PlateFigure,
  type RegisterRow,
} from "./core/index.ts";
import { FUND_WIDGET_CARD } from "./FundDrawer.tsx";
import "./fund-standing-book.css";

/**
 * The Standing Book — the Fund board as a binder. Its fore-edge is the
 * tablist: one divider per section this member may open — the rail's slots
 * first, in rail order, with FundBoard's ids, `aria-controls` and `onSelect`,
 * then the rest of the library, which open on the book itself and never ask
 * the host to move — each a sheet bound behind the page block with only its
 * tab showing, in its own band down the edge so every label reads at once.
 * Open, it is a V-fold room: the gutter is
 * a corner and the corner is today — what happened stands in ink on the left
 * wall, what is coming lies in pencil on the right. The selected section's
 * mechanism stands on the floor flap; the running head carries the Level
 * plate's glance and edge, the plinth its footing and verdict.
 *
 * A second level of navigation lives on the open section's top edge: where a
 * section's plate is a list (the accounts, next out, waiting, the shape), one
 * thin page flag per item stands proud of the page, its own tablist named for
 * the section and a sibling of the fore-edge, never nested in it. Picking a
 * flag turns the spread to that item's own page: an account's books view (the
 * register laid as ledger lines, counted rows in ink on the left, uncounted in
 * pencil on the right, with a control that raises the running line as a
 * concertina), an obligation with the gate strip beneath it, a card in the
 * pocket, a category against its own band. A section that is one reading
 * draws no strip. Which page is open is component state and is never
 * persisted. Every figure is a plate's, `accountRows`', `accountRegister`'s or
 * `categoryShape`'s own, through `formatCad`. Nested buttons are illegal, so
 * the room sits beside both tablists, never in either. Display only: nothing
 * here posts, settles, or moves a cent.
 */

const WELL_TOP = 12;
const WELL_DEPTH = 40;
const POCKET_TOP = 24;
const CARD_HEIGHT = 22;
const RIBBON_MID = 40;
const BAND_Y = 20;
const BAND_HEIGHT = 10;
const TRACK_BASELINE = 44;
const REGISTER_ROOM = 28;

/** One account's lines: the counted rows as the Books page prints them, and the uncounted rows beside them. */
type AccountLines = { ink: RegisterRow[]; pencil: RegisterRow[] };

/** Read the register twice as the journal offers it: the counted register (the Books page's own reading) and the rows it leaves out. No sum, no second running. */
function accountLines(books: CompiledBooks | null, accountId: string): AccountLines {
  if (!books) return { ink: [], pencil: [] };
  return {
    ink: accountRegister(books, accountId),
    pencil: accountRegister(books, accountId, { recognizedOnly: false }).filter((row) => !row.recognized),
  };
}

/** An account with no line in the journal shows an honest empty, never a zero figure. */
function accountPosted(lines: AccountLines | undefined): boolean {
  return Boolean(lines && (lines.ink.length > 0 || lines.pencil.length > 0));
}

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
 * two real buttons so the gesture is never the only way in. Where the section
 * carries page flags the flag and the gate are one cursor, handed in; where it
 * does not the gate keeps its own.
 */
function TrackGate({ figure, cursor: given, onCursor }: { figure: Extract<PlateFigure, { primitive: "track" }>; cursor?: number; onCursor?: (index: number) => void }) {
  const [own, setOwn] = useState(0);
  const marks = figure.marks;
  const at = gateIndex(given ?? own, marks.length);
  const setCursor = (next: number) => {
    const index = gateIndex(next, marks.length);
    if (onCursor) onCursor(index);
    else setOwn(index);
  };
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
      setCursor(at + (event.key === "ArrowLeft" ? -1 : 1));
    }
    if (event.key === "Home") { event.preventDefault(); setCursor(0); }
    if (event.key === "End") { event.preventDefault(); setCursor(marks.length - 1); }
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
        <button type="button" className="fund-book-gate-step" disabled={at <= 0} onClick={() => setCursor(at - 1)}>Sooner</button>
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
        <button type="button" className="fund-book-gate-step" disabled={at >= marks.length - 1} onClick={() => setCursor(at + 1)}>Later</button>
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

/** A pocket with cards standing in it. Thickness is the count; the pocket never encodes an amount. The open page's card, where there is one, is drawn a little out of the pocket. */
function Pocket({ figure, drawn }: { figure: Extract<PlateFigure, { primitive: "tally" }>; drawn?: number }) {
  const cards = pocketCards(figure.count);
  return (
    <svg className="fund-book-svg fund-book-pocket-svg" viewBox={`0 0 ${PLATE_VIEW.width} 48`} role="img" aria-hidden="true">
      {cards.map((card, index) => (
        <rect key={index} className={`fund-book-card is-standing${index === drawn ? " is-drawn" : ""}`} x={card.x} y={index === drawn ? card.y - 6 : card.y} width={14} height={CARD_HEIGHT} />
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

function lineCount(count: number): string {
  return `${count} ${count === 1 ? "line" : "lines"}`;
}

/**
 * The caption says what is folded on the page, never the whole register: the
 * strip windows to its newest points, so when fewer stand than the journal
 * counts the sentence says so. Ink points on the page are `actualCount`;
 * pencil panels on the page are the rest of the strip.
 */
export function popupCaption(strip: { points: number[]; actualCount: number }, lines: AccountLines): string {
  const inkShown = strip.actualCount;
  const pencilShown = Math.max(0, strip.points.length - strip.actualCount);
  if (inkShown < 2) return "One line is not a walk yet.";
  const ink = inkShown < lines.ink.length
    ? `the last ${inkShown} of ${lineCount(lines.ink.length)} the journal counts`
    : `all ${lineCount(inkShown)} the journal counts`;
  if (!pencilShown) return `Folded here in ink: ${ink}. Nothing lies in pencil.`;
  const pencil = pencilShown < lines.pencil.length
    ? `${pencilShown} of the ${lineCount(lines.pencil.length)} it does not`
    : `the ${lineCount(pencilShown)} it does not`;
  return `Folded here in ink: ${ink}. Flat in pencil: ${pencil}.`;
}

/** A ledger line's amount cell: the journal's own debit or credit, blank where the journal wrote none. */
function amountCell(cents: number): string {
  return cents ? formatCad(cents) : "";
}

/** The register laid as ledger lines. Ink rows carry the running figure the Books page prints; pencil rows are the journal's uncounted lines and carry none. */
function LedgerLines({ rows, tone, name }: { rows: RegisterRow[]; tone: "ink" | "pencil"; name: string }) {
  if (!rows.length) return null;
  return (
    <div className={`fund-book-lines is-${tone}`} tabIndex={0} role="region" aria-label={tone === "ink" ? `${name}, counted lines` : `${name}, lines not counted`}>
      <table className="fund-book-ledger">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Memo</th>
            <th scope="col" className="num">Debit</th>
            <th scope="col" className="num">Credit</th>
            <th scope="col" className="num">{tone === "ink" ? "Balance" : "Counted"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.entryId}-${index}`} className={`fund-book-line is-${tone}`} data-ledger-row={tone}>
              <td>{formatDateLabel(row.date)}</td>
              <td className="fund-book-line-memo">{row.memo}</td>
              <td className="num">{amountCell(row.debitCents)}</td>
              <td className="num">{amountCell(row.creditCents)}</td>
              <td className="num">{tone === "ink" ? formatCad(row.runningCents) : "excluded"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The pop-up: the register's running line raised as a concertina on the
 * floor, folded where the counted rows stop, with the ruled band beneath it
 * for a card. A real button raises and lays it; Escape lays it while the
 * control has focus and goes no further, so the ledge's own Escape is not
 * spent. Under reduced motion it is already raised and nothing travels.
 */
function RegisterPopup({ row, lines, raised, onRaise }: { row: AccountRow; lines: AccountLines; raised: boolean; onRaise: (raised: boolean) => void }) {
  const popupId = useId();
  const strip = registerStrip(lines.ink.map((line) => line.runningCents), lines.pencil.length);
  const figure = accountRowFigure(row);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !raised) return;
    event.preventDefault();
    event.stopPropagation();
    onRaise(false);
  };
  return (
    <div className="fund-book-popup" data-fund-book-popup={raised ? "raised" : "flat"} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="fund-book-raise"
        aria-expanded={raised}
        aria-controls={popupId}
        onClick={() => onRaise(!raised)}
      >
        {raised ? "Lay the lines flat" : "Raise the lines"}
      </button>
      <div id={popupId} className="fund-book-popup-stand" hidden={!raised}>
        {strip.points.length >= 2
          ? <Concertina figure={{ primitive: "spark", points: strip.points, actualCount: strip.actualCount, room: REGISTER_ROOM }} />
          : <p className="fund-book-floor-note">One line is not a walk yet.</p>}
        {figure.primitive === "gauge" ? <FloorBand figure={figure} /> : null}
        <p className="fund-book-popup-line">{popupCaption(strip, lines)}</p>
      </div>
    </div>
  );
}

/**
 * A shelf holds a strip that may scroll sideways. Where it does, the shelf
 * fades the edge that has more behind it, so a reader can tell; the fade is a
 * mask, alpha only, so it paints under any dressing.
 */
function useShelf(count: number) {
  const strip = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState<"none" | "start" | "end" | "both">("none");
  const measure = () => {
    const node = strip.current;
    if (!node) return;
    const past = node.scrollWidth - node.clientWidth;
    const start = node.scrollLeft > 2;
    const end = past - node.scrollLeft > 2;
    setMore(start && end ? "both" : start ? "start" : end ? "end" : "none");
  };
  useEffect(() => {
    measure();
    const node = strip.current;
    if (!node || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [count]);
  return { strip, more, measure };
}

/** Arrow keys, Home and End rove within whichever tablist the pressed tab is in; the other strip is never touched. FundBoard's own idiom. */
function navigate(event: KeyboardEvent<HTMLButtonElement>) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const tabs = [...(event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])];
  const index = tabs.indexOf(event.currentTarget);
  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
    : (index + (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1) + tabs.length) % tabs.length;
  event.preventDefault(); tabs[next]?.focus();
}

/**
 * The page flags along the open section's top edge: one thin coloured flag per
 * item, its own tablist named for the section, controlling the page. The flag
 * is thin but the button is not — the hit area grows, the paper does not. Its
 * colour is its place in the theme's sequence; its state is the item's own
 * rule where it carries one, and no state where it does not.
 */
function PageFlags({ flags, page, sectionId, sectionName, pageId, bookId, onPick }: {
  flags: PageFlag[]; page: number; sectionId: FundWidgetId; sectionName: string; pageId: string; bookId: string; onPick: (index: number) => void;
}) {
  const shelf = useShelf(flags.length);
  if (!flags.length) return null;
  return (
    <div className="fund-book-head-shelf fund-book-flags-shelf" data-head-more={shelf.more}>
      <div className="fund-book-head-edge fund-book-flags" role="tablist" aria-label={`Pages in ${sectionName}`} ref={shelf.strip} onScroll={shelf.measure}>
        {flags.map((flag, index) => (
          <button
            type="button"
            key={flag.id}
            role="tab"
            id={`${bookId}-flag-${index}`}
            aria-controls={pageId}
            aria-selected={index === page}
            tabIndex={index === page ? 0 : -1}
            className={`fund-book-sticky${flag.edge ? ` edge-${flag.edge}` : ""}${flag.pin ? " is-fund-card" : ""}`}
            data-flag-id={flag.id}
            data-account-id={sectionId === "accounts" ? flag.id : undefined}
            data-sticky-state={flag.edge}
            data-hue={flagHue(index)}
            data-fund-card={flag.pin ? "true" : undefined}
            aria-label={flag.label}
            onKeyDown={navigate}
            onClick={() => onPick(index)}
          >
            <span className="fund-book-sticky-name">{flag.name}</span>
            {flag.detail ? <span className="fund-book-sticky-detail">{flag.detail}</span> : null}
            {flag.pin ? <span className="fund-book-sticky-fund">{flag.pin}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
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

/** One page of a paged section other than the accounts: what the walls, the floor and the plinth say about the item. Every string is the item's own or the plate's. */
type ItemPage = {
  kicker: string;
  chapter: string;
  figure: string | null;
  verdict: string;
  /** What lies in pencil on the right wall. */
  coming: string;
  floor: ReactNode;
  footing: string;
  /** Dated paper, not yet happened: the figure prints in pencil. */
  tone: "ink" | "pencil";
};

function pageOfN(index: number, count: number): string {
  return `page ${index + 1} of ${count}`;
}

/** The flags a section offers, from the data its plate already reads. */
function flagsFor(section: FundWidgetId, plate: DeskPlateModel | null, rows: AccountRow[], lines: ReadonlyMap<string, AccountLines>, shape: CategoryShape[]): PageFlag[] {
  if (!sectionIsPaged(section)) return [];
  if (section === "accounts") {
    return rows.map((row) => {
      const edge = accountRowEdge(row);
      const amount = accountPosted(lines.get(row.accountId)) ? accountRowAmount(row) : "No postings yet";
      return {
        id: row.accountId,
        name: row.name,
        detail: row.detailLabel,
        edge,
        label: `${row.accessibilityName}. ${amount}.${row.isFundCard ? " The Fund's card." : ""}${edge === "attention" ? " Needs a look." : ""}`,
        pin: row.isFundCard ? "The Fund's card" : undefined,
      };
    });
  }
  if (section === "shape") {
    return shape.map((row) => {
      const edge = categoryRowEdge(row);
      return { id: row.subcategoryId, name: row.label, edge, label: `${row.label}. ${categoryRowVerdict(row)}${edge === "attention" ? " Needs a look." : ""}` };
    });
  }
  return plate && !plate.empty ? figureFlags(plate.figure) : [];
}

export function FundStandingBook({ household, memberId, today, presentation, selected, onSelect, plates, onOpenCabinet, panelId = "fund-stage-panel" }: {
  household: Household; memberId: string; today: string; presentation: "phone" | "desk";
  selected: FundWidgetId; onSelect: (id: FundWidgetId) => void;
  panelId?: string;
  plates?: DeskPlateModel[]; onOpenCabinet?: (plate: DeskPlateModel) => void;
}) {
  const bookId = useId();
  const pageId = `${bookId}-page`;
  const activeMember = household.members.some(member => member.id === memberId && member.active);
  const models = useMemo(() => activeMember ? plates ?? fundPlates({ household, memberId, today }) : [], [activeMember, plates, household, memberId, today]);
  const byId = new Map(models.map(plate => [fundWidgetIdForPlateId(plate.id), plate]));
  const rail = railFor(household, memberId, presentation);
  const slots = presentation === "phone" ? phoneRail(rail) : rail;
  // The binder has a divider for every section this member may open: the rail's slots lead, in rail order,
  // and the rest of the library follows. Presentation only — nothing here writes to the rail.
  const dividers = useMemo(() => binderDividers(slots, FUND_WIDGETS.filter((id) => widgetAllowedFor(id, household, memberId))), [slots, household, memberId]);
  const level = models.find((plate) => plate.id === "fund-level") ?? null;
  const phone = presentation === "phone";
  const monthKey = monthKeyFromDateKey(today);
  // A divider off the rail opens its section on the book itself: the host is never asked to move where its
  // tab state cannot follow. The pick counts only while the host's own selection stands where it was, so a
  // rail divider, or the host moving on, lets the library section go. Never persisted.
  const [picked, setPicked] = useState<{ section: FundWidgetId; host: FundWidgetId } | null>(null);
  const section: FundWidgetId = picked && picked.host === selected && !slots.includes(picked.section) ? picked.section : selected;
  const shown = byId.get(section) ?? null;
  // The accounts section's pages: the accounts plate's own rows, shared only, by name. Read only while that section is open.
  const rows = useMemo(() => activeMember && section === "accounts" ? accountRows(household, memberId, today) : [], [activeMember, section, household, memberId, today]);
  // The books view reads the same floor the Books page compiles, so the lines agree with the household table.
  const books = useMemo<CompiledBooks | null>(() => {
    if (!activeMember || !rows.length) return null;
    try { return compileHousehold(booksPresentationFloor(household, memberId, "household")); } catch { return null; }
  }, [activeMember, rows.length, household, memberId]);
  const linesById = useMemo(() => new Map(rows.map((row) => [row.accountId, accountLines(books, row.accountId)])), [rows, books]);
  // The shape section's pages: every category row the plate reads, in the plate's own order.
  const shape = useMemo(() => activeMember && section === "shape" ? categoryShape(household, monthKey, today) : [], [activeMember, section, household, monthKey, today]);
  const flags = useMemo(() => flagsFor(section, shown, rows, linesById, shape), [section, shown, rows, linesById, shape]);
  // Component state only: the page left open in each section. Never persisted — a flag is a place in the
  // book, not a setting. A section reopens on the page it was left on, clamped onto the flags it has now,
  // and a section never visited opens on its first; the page is derived in the same render, so a change of
  // section never leaves a flag from another section selected.
  const [remembered, setRemembered] = useState<OpenPages>({});
  const page = openPage(remembered, section, flags.length);
  const setPage = (index: number) => setRemembered((current) => ({ ...current, [section]: index }));
  const focusedRow = section === "accounts" ? rows[page] ?? null : null;
  // Reduced motion: the pop-up is already raised and nothing travels. Otherwise the lines lie flat until raised.
  const [raised, setRaised] = useState(() => motionReduced());
  // Reduced motion: the book is already open and nothing travels. Otherwise the
  // first paint is the shut book on the hearth and the next frame opens it.
  const [open, setOpen] = useState(() => motionReduced());
  const [face, setFace] = useState<"left" | "right">("left");
  // The fore-edge on a phone is one row that scrolls; the shelf fades the edge with more behind it.
  const edgeShelf = useShelf(slots.length);
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
  const pickFlag = (index: number) => {
    setPage(index);
    if (!open) setOpen(true);
  };
  const focusedLines = focusedRow ? linesById.get(focusedRow.accountId) ?? { ink: [], pencil: [] } : null;
  const focusedPosted = accountPosted(focusedLines ?? undefined);
  const month = formatMonthLabel(monthKey);
  const flush = foreEdgeIsFlush(dividers.flatMap((id) => { const plate = byId.get(id); return plate ? [plate.edge] : []; }));
  const leftHidden = phone && face !== "left" ? true : undefined;
  const rightHidden = phone && face !== "right" ? true : undefined;
  const sectionName = FUND_WIDGET_CARD[section].name;
  // The fore-edge's ids are FundBoard's, presentation for presentation; a library divider follows the same pattern.
  const dividerId = (id: FundWidgetId) => presentation === "desk" ? `fund-rail-tab-${byId.get(id)?.id ?? id}` : `${panelId}-tab-${id}`;
  const cabinet = onOpenCabinet && shown
    ? <button type="button" className="fund-book-handle" onClick={() => onOpenCabinet(shown)} aria-label={`Open the ${shown.cabinetName} cabinet`}>Cabinet</button>
    : null;

  // The item page for a paged section other than the accounts. Every figure is the plate's own list, formatted; nothing is summed.
  let item: ItemPage | null = null;
  if (shown && flags.length && section !== "accounts") {
    const flag = flags[page]!;
    if (shown.figure.primitive === "track") {
      const mark = shown.figure.marks[page];
      if (mark) {
        item = {
          kicker: "Left wall · what is dated",
          chapter: mark.label,
          figure: formatCad(mark.cents),
          verdict: `${mark.label} is dated for day ${mark.day}. Ghost paper: not counted as gone until it goes.`,
          coming: shown.footing,
          floor: <TrackGate figure={shown.figure} cursor={page} onCursor={setPage} />,
          footing: `${sectionName} · ${pageOfN(page, flags.length)}`,
          tone: "pencil",
        };
      }
    } else if (shown.figure.primitive === "tally") {
      item = {
        kicker: "Left wall · raised, not confirmed",
        chapter: flag.name,
        figure: null,
        verdict: page === 0 ? shown.verdict : `One of ${flags.length} raised, waiting on a confirm.`,
        coming: shown.footing,
        floor: <Pocket figure={shown.figure} drawn={page} />,
        footing: `${sectionName} · ${pageOfN(page, flags.length)}`,
        tone: "pencil",
      };
    } else if (section === "shape") {
      const row = shape[page];
      if (row) {
        const figure = categoryRowFigure(row);
        item = {
          kicker: "Left wall · this month against its own shape",
          chapter: row.label,
          figure: categoryRowAmount(row),
          verdict: categoryRowVerdict(row),
          coming: categoryRowHasShape(row)
            ? `Its own trailing three months ran from ${formatCad(row.bandLowCents)} to ${formatCad(row.bandHighCents)}.`
            : "Fewer than three real months behind it: a band would be a guess, so none is drawn.",
          floor: figure.primitive === "spark" && figure.points.length >= 2
            ? <Concertina figure={figure} />
            : <p className="fund-book-floor-note">Not enough history yet to draw a shape for {row.label}.</p>,
          footing: `${sectionName} · ${pageOfN(page, flags.length)}`,
          tone: "ink",
        };
      }
    }
  }
  const spread = focusedRow && focusedLines ? "account" : item ? "page" : "chapter";
  const openFlag = flags[page] ?? null;

  // DOM order is the reading order on both compositions and so the Tab order: the fore-edge, then the open
  // section's flags, then the page. The grid places each where the binder wants it.
  return <div className={`fund-book is-${presentation}`}
    data-fund-book-open={open ? "true" : "false"}
    data-fund-book-edge={flush ? "flush" : "proud"}
    data-fund-book-state={level?.edge ?? "quiet"}
    data-fund-book-face={face}
    data-fund-book-spread={spread}
    data-fund-book-section={section}
    data-fund-book-flags={flags.length ? "true" : "false"}
    data-fund-book-page={openFlag?.id}
    data-fund-book-account={focusedRow?.accountId}>
    <div className="fund-book-head-shelf fund-book-edge-shelf" data-head-more={edgeShelf.more}>
    <div className="fund-book-edge fund-book-head-edge" role="tablist" aria-label="Fund board" ref={edgeShelf.strip} onScroll={edgeShelf.measure}>
      {dividers.map((id, slot) => {
        const plate = byId.get(id);
        const stance = bookmarkStance(plate?.edge ?? "clear");
        const onRail = slots.includes(id);
        return <button type="button" key={id}
          className={`fund-book-mark edge-${plate?.edge ?? "quiet"}${stance.dogEar ? " is-dogeared" : ""}`}
          style={{ "--fund-book-slot": slot } as CSSProperties}
          data-fund-widget={id}
          data-reach={stance.reach}
          data-plate-id={plate?.id}
          data-hue={flagHue(slot)}
          data-divider={onRail ? "rail" : "library"}
          role="tab"
          id={dividerId(id)}
          aria-controls={onRail ? panelId : pageId}
          aria-selected={section === id}
          aria-current={section === id ? "true" : undefined}
          aria-label={plate ? `${plate.kicker}. ${plate.glance}. ${plate.verdict}` : undefined}
          tabIndex={section === id ? 0 : -1}
          onKeyDown={navigate} onClick={() => { if (onRail) { setPicked(null); onSelect(id); } else { setPicked({ section: id, host: selected }); } if (!open) setOpen(true); }}>
          <span className="fund-book-mark-name">{FUND_WIDGET_CARD[id].name}</span>
          {plate ? <strong className="fund-book-mark-glance">{plate.glance}</strong> : null}
        </button>;
      })}
    </div>
    </div>
    <PageFlags flags={flags} page={page} sectionId={section} sectionName={sectionName} pageId={pageId} bookId={bookId} onPick={pickFlag} />
    <div className="fund-book-cover" aria-hidden="true">
      <span className="fund-book-plate"><b>The Fund</b><small>{month}</small></span>
      <span className="fund-book-dogear" />
    </div>
    <div className="fund-book-room" id={pageId} role="tabpanel" aria-labelledby={flags.length ? `${bookId}-flag-${page}` : dividerId(section)}>
      <div className="fund-book-fold">
      <span className="fund-book-spine" aria-hidden="true" />
      <div className="fund-book-leaf is-left" hidden={leftHidden}>
        <RunningHead level={level} month={month} showLevel showState={phone} />
        <span className="fund-book-today" aria-hidden="true">today · {formatDateLabel(today)}</span>
        {focusedRow && focusedLines ? (
          <div className="fund-book-wall is-ink is-account">
            <p className="fund-book-kicker">Left wall · what the journal counts</p>
            <h3 className="fund-book-chapter">{focusedRow.name}{focusedRow.detailLabel ? ` · ${focusedRow.detailLabel}` : ""}</h3>
            <p className="fund-book-figure">{focusedPosted ? accountRowAmount(focusedRow) : "No postings yet"}</p>
            <p className="fund-book-verdict">{focusedPosted ? accountRowVerdict(focusedRow) : `${focusedRow.name} has no line in the journal yet.`}</p>
            {focusedLines.ink.length
              ? <LedgerLines rows={focusedLines.ink} tone="ink" name={focusedRow.accessibilityName} />
              : <p className="fund-book-pencil-note">No postings yet.</p>}
          </div>
        ) : item ? (
          <div className={`fund-book-wall is-ink is-page is-${item.tone}-page`}>
            <p className="fund-book-kicker">{item.kicker}</p>
            <h3 className="fund-book-chapter">{item.chapter}</h3>
            {item.figure ? <p className="fund-book-figure" data-tone={item.tone}>{item.figure}</p> : null}
            <p className="fund-book-verdict">{item.verdict}</p>
          </div>
        ) : (
          <div className="fund-book-wall is-ink">
            <p className="fund-book-kicker">Left wall · what happened</p>
            <h3 className="fund-book-chapter">{shown?.kicker ?? sectionName}</h3>
            {shown ? <p className="fund-book-figure">{shown.glance}</p> : null}
            <p className="fund-book-verdict">{shown?.verdict ?? FUND_WIDGET_CARD[section].line}</p>
            {sectionIsPaged(section) && !flags.length ? <p className="fund-book-pencil-note">{shown?.empty ?? "Nothing on this section's list yet, so it has no pages."}</p> : null}
          </div>
        )}
      </div>
      <div className="fund-book-leaf is-right" hidden={rightHidden}>
        <RunningHead level={level} month={month} showLevel={phone} showState />
        <span className="fund-book-today" aria-hidden="true">today · {formatDateLabel(today)}</span>
        {focusedRow && focusedLines ? (
          <div className="fund-book-wall is-pencil is-account">
            <p className="fund-book-kicker">Right wall · what the journal leaves out</p>
            {focusedLines.pencil.length
              ? <LedgerLines rows={focusedLines.pencil} tone="pencil" name={focusedRow.accessibilityName} />
              : <p className="fund-book-pencil-note">{focusedPosted ? "Every line on this account is counted. Nothing lies in pencil." : "Nothing lies in pencil either."}</p>}
            {cabinet}
          </div>
        ) : item ? (
          <div className="fund-book-wall is-pencil is-page">
            <p className="fund-book-kicker">Right wall · what is coming</p>
            <p className="fund-book-pencil-note">{item.coming}</p>
            {cabinet}
          </div>
        ) : (
          <div className="fund-book-wall is-pencil">
            <p className="fund-book-kicker">Right wall · what is coming</p>
            <p className="fund-book-pencil-note">{shown?.footing ?? "Nothing is pencilled here yet."}</p>
            {shown?.empty ? <p className="fund-book-pencil-note">{shown.empty}</p> : null}
            {cabinet}
          </div>
        )}
      </div>
      <div className="fund-book-floor">
        {focusedRow && focusedLines ? (
          <div className="fund-book-stand is-account" data-plate-primitive={focusedPosted ? "spark" : undefined}>
            {focusedPosted
              ? <RegisterPopup row={focusedRow} lines={focusedLines} raised={raised} onRaise={setRaised} />
              : <p className="fund-book-floor-note">No postings yet. Nothing to raise.</p>}
          </div>
        ) : item ? (
          <div className="fund-book-stand is-page" data-plate-primitive={shown?.figure.primitive}>
            {item.floor}
          </div>
        ) : (
          <div className="fund-book-stand" data-plate-primitive={shown?.figure.primitive}>
            {shown && !shown.empty
              ? <BookFigureView figure={shown.figure} />
              : <p className="fund-book-floor-note">{shown?.empty ?? "The floor is bare on this section."}</p>}
          </div>
        )}
        {focusedRow ? (
          <div className="fund-book-plinth is-account">
            <span className="fund-book-plinth-footing">{focusedRow.accessibilityName}{focusedRow.isFundCard ? " · the Fund's card" : ""}</span>
            <span className="fund-book-plinth-verdict">{focusedPosted ? accountRowVerdict(focusedRow) : "No postings yet."}</span>
          </div>
        ) : item ? (
          <div className="fund-book-plinth is-page">
            <span className="fund-book-plinth-footing">{item.footing}</span>
            <span className="fund-book-plinth-verdict">{item.verdict}</span>
          </div>
        ) : (
          <div className="fund-book-plinth">
            <span className="fund-book-plinth-footing">{level ? level.footing : "No Fund on the hearth yet."}</span>
            <span className="fund-book-plinth-verdict">{level ? level.verdict : ""}</span>
          </div>
        )}
      </div>
      </div>
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
