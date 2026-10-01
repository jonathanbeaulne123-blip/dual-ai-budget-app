import {AIRPORT,AIRPORT_BOXES,AIRPORT_DECKS} from "../../harbour/horizon/airport/layout.ts";
/**
 * `<JourneyLandFlat data theme>{overlay}</JourneyLandFlat>` (T2): the island as SVG for the flat tier, no WebGL, a
 * failed land load or a lost context. Same data and concept coordinates as the 3D land (viewBox 0 0 2000 1800), so
 * the board's flat overlay (T3 `BoardFlat`) projects the same route points by x/z. The land is decoration: its layers
 * are `aria-hidden`; the overlay slot is not, so real marks inside it stay reachable. Nothing financial is drawn here.
 */
import { useId, type ReactNode } from "react";
import type { JourneyLandFlatData, LandLineKind, ThemeId } from "../contracts.ts";
import { LINE_DRESSING_KEY, landDressing, landExtras } from "./dressing.ts";
import { isMinorLine } from "./extract.ts";

export type JourneyLandFlatProps = {
  data: JourneyLandFlatData;
  theme: ThemeId;
  /** The board overlay (route, spaces, piece) in the same concept coordinates. */
  children?: ReactNode;
  className?: string;
  /** District names painted on the land (decorative; the list carries the words). Default true. */
  showDistrictLabels?: boolean;
};

/** Screen-constant stroke widths (px) and dashes per line kind: the flat map is read whole, so strokes do not scale. */
const STROKE: Readonly<Record<LandLineKind, { width: number; dash?: string }>> = {
  road: { width: 1.6 }, skate: { width: 1.2 }, walk: { width: 1, dash: "2 2" }, cable: { width: 1, dash: "4 3" },
  rail: { width: 1.2, dash: "6 2" }, ferry: { width: 1, dash: "5 4" }, row: { width: 0.8, dash: "3 4" },
};
const HOST_HALF = 9;
const LABEL_SIZE = 38;

/**
 * District labels that fit, in the index's order: a label whose estimated box would overlap one already placed is
 * skipped (the words are decorative here; the land never needs every label).
 */
export function fitDistrictLabels(districts: JourneyLandFlatData["districts"], size = LABEL_SIZE) {
  const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
  return districts.filter((d) => {
    const half = (d.label.length * size * 0.55) / 2, box = { x0: d.x - half, x1: d.x + half, y0: d.y - size * 0.7, y1: d.y + size * 0.7 };
    if (boxes.some((b) => box.x0 < b.x1 && b.x0 < box.x1 && box.y0 < b.y1 && b.y0 < box.y1)) return false;
    boxes.push(box);
    return true;
  });
}

export function JourneyLandFlat({ data, theme, children, className, showDistrictLabels = true }: JourneyLandFlatProps) {
  const d = landDressing(theme), x = landExtras(d);
  const [x0, y0, w, h] = data.viewBox;
  const maskPrefix=useId().replace(/:/g,'');
  const underMasks=new Map(data.lines.flatMap((line,index)=>{
    const bridges=(data.bridges??[]).filter(bridge=>bridge.underIds?.includes(line.id));
    return bridges.length?[[line.id,{id:`${maskPrefix}-under-${index}`,bridges}] as const]:[];
  }));
  const band = { low: d.grass, mid: d.forest, high: d.rock } as const;
  const hasOverlay = children !== undefined && children !== null && children !== false;
  return (
    <svg
      className={["journey-land-flat", `journey-land-flat--${theme}`, className].filter(Boolean).join(" ")}
      viewBox={`${x0} ${y0} ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      focusable="false"
      data-theme={theme}
      aria-hidden={hasOverlay ? undefined : true}
    >
      <defs>
        {[...underMasks].map(([lineId,mask])=>(
          <mask key={lineId} id={mask.id} maskUnits="userSpaceOnUse" x={x0-w} y={y0-h} width={w*3} height={h*3} data-land-under-mask={lineId}>
            <rect x={x0-w} y={y0-h} width={w*3} height={h*3} fill="white" />
            {mask.bridges.map(br=><path key={br.id} d={br.d} fill="none" stroke="black" strokeWidth={br.width+2} strokeLinecap="butt" strokeLinejoin="round" data-under-bridge={br.id}/>)}
          </mask>
        ))}
      </defs>
      <g className="journey-land-flat__land" aria-hidden="true">
        <rect x={x0 - w} y={y0 - h} width={w * 3} height={h * 3} fill={d.sea} />
        {/* The shallows rim, then the land with a sand ring (T7: the same shore as the 3D land). */}
        <path d={data.coast} fill={d.shallows} stroke={d.shallows} strokeWidth={48} strokeLinejoin="round" />
        <path d={data.coast} fill={d.grass} stroke={d.sand} strokeWidth={12} strokeLinejoin="round" />
        {data.landforms.map((l) => (
          <path key={l.id} d={l.d} fill={band[l.band]} fillOpacity={l.band === "low" ? 0.5 : 0.8} data-land-band={l.band} />
        ))}
        {data.water.map((wb) => (
          <path key={wb.id} d={wb.d} fill={wb.kind === "dry" ? d.sand : wb.kind === "lake" || wb.kind === "lagoon" ? d.lake : d.river} data-land-water={wb.id} />
        ))}
        {data.reserves.map((r) => (
          <path key={r.id} d={r.d} fill="none" stroke={d.reserve} strokeWidth={1} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" data-land-reserve={r.id} />
        ))}
        {(data.bridges ?? []).map((br) => (
          <g key={br.id} data-land-bridge={br.id}>
            {/* The rail edge (a darker, slightly wider stroke), then the deck at its true width (concept metres). */}
            <path d={br.d} fill="none" stroke={x.deckRail} strokeWidth={br.width + 2} strokeLinecap="butt" strokeLinejoin="round" />
            <path d={br.d} fill="none" stroke={x.deck} strokeWidth={br.width} strokeLinecap="butt" strokeLinejoin="round" />
          </g>
        ))}
        {data.lines.map((l) => {
          const minor = l.kind === "road" && isMinorLine(l.id), s = STROKE[l.kind];
          // Water routes and cableways are faint: at the flat map's whole-island scale they would outline the island.
          const faint = l.kind === "ferry" || l.kind === "row" || l.kind === "cable";
          return (
            <path
              key={l.id} d={l.d} mask={underMasks.has(l.id)?`url(#${underMasks.get(l.id)!.id})`:undefined} fill="none" stroke={d[LINE_DRESSING_KEY[l.kind]]} strokeOpacity={faint ? 0.4 : undefined}
              strokeWidth={minor ? 0.8 : s.width} strokeDasharray={s.dash} strokeLinecap="round" strokeLinejoin="round"
              vectorEffect="non-scaling-stroke" data-land-line={l.id} data-land-kind={l.kind}
            />
          );
        })}
        <g data-land-airport={AIRPORT.id}>
          {[...AIRPORT_DECKS,{id:'strip',a:AIRPORT.runway.a,b:AIRPORT.runway.b,width:30}].map(route=><path key={route.id} d={`M ${route.a[0]} ${route.a[2]} L ${route.b[0]} ${route.b[2]}`} stroke={d.road} strokeWidth={route.width} fill="none"/>)}
          {AIRPORT_BOXES.filter(b=>b.roof).map(b=><rect key={b.id} x={b.x-b.w/2} y={b.z-b.d/2} width={b.w} height={b.d} fill={d.hostRoof}/>)}
        </g>
        {data.hosts.map((host) => (
          <rect
            key={host.id} x={host.x - HOST_HALF} y={host.y - HOST_HALF} width={HOST_HALF * 2} height={HOST_HALF * 2} rx={2}
            fill={d.hostWall} stroke={d.hostRoof} strokeWidth={1.5} vectorEffect="non-scaling-stroke"
            data-land-host={host.id} data-x={host.x} data-y={host.y}
          />
        ))}
        {showDistrictLabels && fitDistrictLabels(data.districts).map((district) => (
          <text
            key={district.id} x={district.x} y={district.y} textAnchor="middle" dominantBaseline="middle" fontSize={LABEL_SIZE}
            fill={d.districtLabel} stroke={d.sky} strokeWidth={8} paintOrder="stroke" strokeLinejoin="round"
            data-land-district={district.id}
          >
            {district.label}
          </text>
        ))}
      </g>
      {hasOverlay ? <g className="journey-land-flat__overlay">{children}</g> : null}
    </svg>
  );
}

export default JourneyLandFlat;
