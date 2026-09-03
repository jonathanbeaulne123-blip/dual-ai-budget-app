import { useRef, type KeyboardEvent, type MouseEvent } from "react";
import {
  fillLevel,
  formatCad,
  gaugeFillWidth,
  gaugeIsOver,
  gaugeThresholdX,
  pairScale,
  sparkHeights,
  tallyIsCountable,
  trackMarkHeight,
  trackX,
  PLATE_VIEW,
  type DeskPlateModel,
  type PlateFigure,
} from "./core/index.ts";

/**
 * One desk plate: kicker, short glance, and when open a drawing plus footing.
 * Display only. Click grows the card in the mosaic. Double-click and the handle
 * open the cabinet. Nested buttons are illegal, so the plate is an article and
 * the handle is the only inner button.
 */

const TRACK_BASELINE = 44;
const PAIR_MID = 40;
const SPARK_BASE = 36;
const FILL_HEIGHT = 10;
const GAUGE_Y = 18;

function TrackFigure({ figure }: { figure: Extract<PlateFigure, { primitive: "track" }> }) {
  const maxCents = Math.max(0, ...figure.marks.map((mark) => mark.cents));
  const ticks = [];
  for (let day = 1; day <= figure.days; day += 1) {
    if (day === 1 || day === figure.days || day % Math.max(1, Math.round(figure.days / 4)) === 0) {
      ticks.push(day);
    }
  }
  return (
    <svg className="desk-plate-svg" viewBox={`0 0 ${PLATE_VIEW.width} 52`} role="img" aria-hidden="true">
      <line className="desk-plate-rail" x1={PLATE_VIEW.left} x2={PLATE_VIEW.right} y1={TRACK_BASELINE} y2={TRACK_BASELINE} />
      {ticks.map((day) => (
        <line key={`tick-${day}`} className="desk-plate-tick" x1={trackX(day, figure.days)} x2={trackX(day, figure.days)} y1={TRACK_BASELINE} y2={TRACK_BASELINE + 3} />
      ))}
      {figure.marks.map((mark, index) => {
        const x = trackX(mark.day, figure.days);
        const height = trackMarkHeight(mark.cents, maxCents, figure.room);
        return (
          <rect
            key={`${mark.label}-${index}`}
            className="desk-plate-mark"
            x={x - 1.5}
            y={TRACK_BASELINE - height}
            width={3}
            height={height}
          />
        );
      })}
    </svg>
  );
}

function PairFigure({ figure }: { figure: Extract<PlateFigure, { primitive: "pair" }> }) {
  const scale = pairScale(figure.upCents, figure.downCents, figure.room);
  const up = Math.max(0, figure.upCents) * scale;
  const down = Math.max(0, figure.downCents) * scale;
  const cx = (PLATE_VIEW.left + PLATE_VIEW.right) / 2;
  return (
    <svg className="desk-plate-svg" viewBox={`0 0 ${PLATE_VIEW.width} 80`} role="img" aria-hidden="true">
      <line className="desk-plate-rail" x1={PLATE_VIEW.left} x2={PLATE_VIEW.right} y1={PAIR_MID} y2={PAIR_MID} />
      <rect className="desk-plate-pair-up" x={cx - 10} y={PAIR_MID - up} width={20} height={up} />
      <rect className="desk-plate-pair-down" x={cx - 10} y={PAIR_MID} width={20} height={down} />
      <text className="desk-plate-caption" x={PLATE_VIEW.left} y={12}>{figure.upLabel} {formatCad(figure.upCents)}</text>
      <text className="desk-plate-caption is-down" x={PLATE_VIEW.left} y={74}>{figure.downLabel} {formatCad(figure.downCents)}</text>
    </svg>
  );
}

function FillFigure({ figure }: { figure: Extract<PlateFigure, { primitive: "fill" }> }) {
  const wells = figure.wells;
  const width = wells.length ? (PLATE_VIEW.right - PLATE_VIEW.left) / wells.length - 6 : 0;
  return (
    <svg className="desk-plate-svg" viewBox={`0 0 ${PLATE_VIEW.width} 48`} role="img" aria-hidden="true">
      {wells.map((well, index) => {
        const x = PLATE_VIEW.left + index * (width + 6);
        const level = fillLevel(well.savedCents, well.targetCents);
        return (
          <g key={well.name}>
            <rect className="desk-plate-well" x={x} y={16} width={width} height={FILL_HEIGHT} />
            <rect
              className="desk-plate-fill"
              x={x}
              y={16}
              width={width * level}
              height={FILL_HEIGHT}
            />
            <text className="desk-plate-caption" x={x} y={12}>{well.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

function SparkFigure({ figure }: { figure: Extract<PlateFigure, { primitive: "spark" }> }) {
  const heights = sparkHeights(figure.points, figure.room);
  const count = Math.max(1, figure.points.length);
  const gap = (PLATE_VIEW.right - PLATE_VIEW.left) / count;
  return (
    <svg className="desk-plate-svg" viewBox={`0 0 ${PLATE_VIEW.width} 44`} role="img" aria-hidden="true">
      <line className="desk-plate-rail" x1={PLATE_VIEW.left} x2={PLATE_VIEW.right} y1={SPARK_BASE} y2={SPARK_BASE} />
      {heights.map((height, index) => {
        const x = PLATE_VIEW.left + index * gap + gap / 2;
        const signed = figure.points[index] ?? 0;
        const y = signed >= 0 ? SPARK_BASE - height : SPARK_BASE;
        return (
          <rect
            key={index}
            className={`desk-plate-spark${signed < 0 ? " is-down" : ""}${
              index >= (figure.actualCount ?? figure.points.length) ? " is-projected" : ""
            }`}
            x={x - 2}
            y={y}
            width={4}
            height={Math.max(0, height)}
          />
        );
      })}
    </svg>
  );
}

function TallyFigure({ figure }: { figure: Extract<PlateFigure, { primitive: "tally" }> }) {
  if (!tallyIsCountable(figure.count)) return null;
  const marks = Array.from({ length: figure.count }, (_, index) => index);
  return (
    <svg className="desk-plate-svg" viewBox={`0 0 ${PLATE_VIEW.width} 28`} role="img" aria-hidden="true">
      {marks.map((index) => {
        const x = PLATE_VIEW.left + index * 6;
        return <line key={index} className="desk-plate-tally" x1={x} x2={x} y1={8} y2={22} />;
      })}
    </svg>
  );
}

function GaugeFigure({ figure }: { figure: Extract<PlateFigure, { primitive: "gauge" }> }) {
  const fill = gaugeFillWidth(figure.pct);
  const thresholdX = gaugeThresholdX(figure.threshold);
  const over = gaugeIsOver(figure.pct, figure.threshold);
  return (
    <svg className="desk-plate-svg" viewBox={`0 0 ${PLATE_VIEW.width} 36`} role="img" aria-hidden="true">
      <rect className="desk-plate-well" x={PLATE_VIEW.left} y={GAUGE_Y} width={PLATE_VIEW.right - PLATE_VIEW.left} height={8} />
      <rect className={over ? "desk-plate-fill is-over" : "desk-plate-fill"} x={PLATE_VIEW.left} y={GAUGE_Y} width={fill} height={8} />
      <line className="desk-plate-threshold" x1={thresholdX} x2={thresholdX} y1={GAUGE_Y - 4} y2={GAUGE_Y + 12} />
      <text className="desk-plate-caption" x={PLATE_VIEW.left} y={12}>
        {Math.round(figure.pct * 100)}% · mark {Math.round(figure.threshold * 100)}%{over ? " · over" : ""}
      </text>
    </svg>
  );
}

export function PlateFigureView({ figure }: { figure: PlateFigure }) {
  switch (figure.primitive) {
    case "track":
      return <TrackFigure figure={figure} />;
    case "pair":
      return <PairFigure figure={figure} />;
    case "fill":
      return <FillFigure figure={figure} />;
    case "spark":
      return <SparkFigure figure={figure} />;
    case "tally":
      return <TallyFigure figure={figure} />;
    case "gauge":
      return <GaugeFigure figure={figure} />;
    default: {
      const never: never = figure;
      return never;
    }
  }
}

export function DeskPlate({
  plate,
  active = false,
  open = false,
  onSelect,
  onOpenCabinet,
}: {
  plate: DeskPlateModel;
  active?: boolean;
  open?: boolean;
  onSelect: () => void;
  onOpenCabinet: () => void;
}) {
  const rootRef = useRef<HTMLElement>(null);

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  }

  function handleCabinet(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onOpenCabinet();
  }

  return (
    <article
      ref={rootRef}
      className={`desk-plate edge-${plate.edge}${open ? " is-open" : ""}${active ? " is-active" : ""}${plate.copperVerdict ? " is-copper" : ""}`}
      tabIndex={0}
      data-plate-id={plate.id}
      data-plate-primitive={plate.figure.primitive}
      aria-label={`${plate.kicker}. ${plate.glance}. ${plate.verdict}`}
      aria-expanded={open}
      onClick={onSelect}
      onDoubleClick={onOpenCabinet}
      onKeyDown={handleKey}
    >
      <p className="desk-plate-kicker">{plate.kicker}</p>
      <p className={`desk-plate-verdict${plate.copperVerdict ? " is-copper" : ""}`}>{plate.glance}</p>
      {open ? (
        <>
          <p className="desk-plate-detail">{plate.verdict}</p>
          {plate.empty ? null : (
            <div className="desk-plate-figure">
              <PlateFigureView figure={plate.figure} />
            </div>
          )}
          <div className="desk-plate-footing">
            <p className="desk-plate-foot">{plate.footing}</p>
            <button
              type="button"
              className="desk-plate-handle"
              onClick={handleCabinet}
              aria-label={`Open the ${plate.cabinetName} cabinet`}
            >
              Cabinet
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
}
