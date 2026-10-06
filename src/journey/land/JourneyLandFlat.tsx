/**
 * `<JourneyLandFlat data theme>{overlay}</JourneyLandFlat>` (T2; Horizon Clock clay restyle): the island as SVG for the
 * flat tier, no WebGL, a failed land load or a lost context. Same data and concept coordinates as the clay land
 * (viewBox = the island extent), so the board's flat overlay (`BoardFlat`) projects the same points by x/y. Painted in
 * the theme's CLAY palette (`clayPalette.ts`): water sea, a pale shallows shoulder and a sand rim round the coast,
 * grass → hill → rock relief, soft grey roads, clay-wall hosts under their roofs, and (The Water's Way, when the land
 * carries `dressing`) the neighbourhood buildings as small clay-wall footprints and every story landmark as a honey
 * diamond — the clay pin seen from above. Only `JourneyLandData` is drawn.
 * The land is decoration: its layers are `aria-hidden`; the overlay slot is not, so real marks inside it stay
 * reachable. The landmark glyphs sit outside the hidden land, each an image named by its landmark (`aria-label` and a
 * `<title>` tooltip; no painted words), so the story's places are announced when the map is read with an overlay; on a
 * bare (decorative) map the whole SVG stays hidden. Nothing financial is drawn here.
 */
import { useId, type ReactNode } from "react";
import type { JourneyLandFlatData, LandLineKind, ThemeId } from "../contracts.ts";
import { clayDerived, clayPalette, mixHex } from "./clayPalette.ts";
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
/** A landmark diamond's half-diagonal (concept metres): a little larger than a host, so the story's verticals read. */
const LANDMARK_HALF = 13;
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

/** The clay colour each line kind is inked with in the flat twin (water routes and cables stay faint). */
function lineInk(kind: LandLineKind, minor: boolean, p: ReturnType<typeof clayPalette>, k: ReturnType<typeof clayDerived>): string {
  if (kind === "road") return minor ? k.minorRoad : k.road;
  if (kind === "ferry" || kind === "row") return mixHex(p.water, p.ink, 0.25);
  if (kind === "skate") return mixHex(p.roadPast, p.ink, 0.3);
  return mixHex(p.trunk, p.ink, 0.2);
}

export function JourneyLandFlat({ data, theme, children, className, showDistrictLabels = true }: JourneyLandFlatProps) {
  const p = clayPalette(theme), k = clayDerived(p);
  const [x0, y0, w, h] = data.viewBox;
  const maskPrefix=useId().replace(/:/g,'');
  const underMasks=new Map(data.lines.flatMap((line,index)=>{
    const bridges=(data.bridges??[]).filter(bridge=>bridge.underIds?.includes(line.id));
    return bridges.length?[[line.id,{id:`${maskPrefix}-under-${index}`,bridges}] as const]:[];
  }));
  const band = { low: p.grass2, mid: p.hill, high: p.rock } as const;
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
        <rect x={x0 - w} y={y0 - h} width={w * 3} height={h * 3} fill={p.water} />
        {/* The clay's sea shoulder (30 m of pale shallows), its rounded sand rim, then the grass. */}
        <path d={data.coast} fill={p.shallow} stroke={p.shallow} strokeWidth={60} strokeLinejoin="round" data-land-shoulder="" />
        <path d={data.coast} fill={p.sand} stroke={p.sand} strokeWidth={14} strokeLinejoin="round" />
        <path d={data.coast} fill={p.grass} stroke={mixHex(p.grass, p.sand, 0.5)} strokeWidth={30} strokeOpacity={0.6} strokeLinejoin="round" data-land-coast="" />
        {data.landforms.map((l) => (
          <path key={l.id} d={l.d} fill={band[l.band]} fillOpacity={l.band === "low" ? 0.45 : 0.75} data-land-band={l.band} />
        ))}
        {data.water.map((wb) => (
          <path key={wb.id} d={wb.d} fill={wb.kind === "dry" ? p.sand : p.water} stroke={wb.kind === "dry" ? undefined : p.shallow} strokeWidth={wb.kind === "dry" ? undefined : 3} data-land-water={wb.id} />
        ))}
        {data.reserves.map((r) => (
          <path key={r.id} d={r.d} fill="none" stroke={mixHex(p.trunk, p.ink, 0.2)} strokeOpacity={0.7} strokeWidth={1} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" data-land-reserve={r.id} />
        ))}
        {(data.bridges ?? []).map((br) => (
          <g key={br.id} data-land-bridge={br.id}>
            {/* The plank's edge (a darker, slightly wider stroke), then the deck at its true width (concept metres). */}
            <path d={br.d} fill="none" stroke={k.deckEdge} strokeWidth={br.width + 2} strokeLinecap="butt" strokeLinejoin="round" />
            <path d={br.d} fill="none" stroke={k.deck} strokeWidth={br.width} strokeLinecap="butt" strokeLinejoin="round" />
          </g>
        ))}
        {data.lines.map((l) => {
          const minor = l.kind === "road" && isMinorLine(l.id), s = STROKE[l.kind];
          // Water routes and cableways are faint: at the flat map's whole-island scale they would outline the island.
          const faint = l.kind === "ferry" || l.kind === "row" || l.kind === "cable";
          return (
            <path
              key={l.id} d={l.d} mask={underMasks.has(l.id)?`url(#${underMasks.get(l.id)!.id})`:undefined} fill="none" stroke={lineInk(l.kind, minor, p, k)} strokeOpacity={faint ? 0.4 : undefined}
              strokeWidth={minor ? 0.9 : l.kind === "road" ? s.width * 1.4 : s.width} strokeDasharray={s.dash} strokeLinecap="round" strokeLinejoin="round"
              vectorEffect="non-scaling-stroke" data-land-line={l.id} data-land-kind={l.kind}
            />
          );
        })}
        {data.hosts.map((host) => (
          <rect
            key={host.id} x={host.x - HOST_HALF} y={host.y - HOST_HALF} width={HOST_HALF * 2} height={HOST_HALF * 2} rx={4}
            fill={p.wall} stroke={host.id === "home" ? p.homeRoof : p.roof1} strokeWidth={2} vectorEffect="non-scaling-stroke"
            data-land-host={host.id} data-x={host.x} data-y={host.y}
          />
        ))}
        {data.dressing?.buildings.map((b) => (
          <path key={b.id} d={b.d} fill={p.wall} stroke={mixHex(p.roof1, p.ink, 0.25)} strokeWidth={1} strokeLinejoin="round" vectorEffect="non-scaling-stroke" data-land-building={b.id} />
        ))}
        {showDistrictLabels && fitDistrictLabels(data.districts).map((district) => (
          <text
            key={district.id} x={district.x} y={district.y} textAnchor="middle" dominantBaseline="middle" fontSize={LABEL_SIZE}
            fill={p.ink} stroke={p.sand} strokeWidth={8} paintOrder="stroke" strokeLinejoin="round"
            data-land-district={district.id}
          >
            {district.label}
          </text>
        ))}
      </g>
      {data.dressing?.landmarks.length ? (
        <g className="journey-land-flat__landmarks">
          {data.dressing.landmarks.map((l) => (
            <g key={l.id} role="img" aria-label={l.label} data-land-landmark={l.id} data-x={l.x} data-y={l.y}>
              <title>{l.label}</title>
              <path
                d={`M${l.x} ${l.y - LANDMARK_HALF}L${l.x + LANDMARK_HALF} ${l.y}L${l.x} ${l.y + LANDMARK_HALF}L${l.x - LANDMARK_HALF} ${l.y}Z`}
                fill={p.honey} stroke={p.ink} strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </g>
      ) : null}
      {hasOverlay ? <g className="journey-land-flat__overlay">{children}</g> : null}
    </svg>
  );
}

export default JourneyLandFlat;
