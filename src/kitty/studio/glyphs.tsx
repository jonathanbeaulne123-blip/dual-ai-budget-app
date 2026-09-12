/** Small original SVG glyphs for every Wheel option. Ink is currentColor; fills use the theme clay token. */
import type { KittyBody, KittyEars, KittyEyes, KittyHead, KittyMouth, KittyNose, KittyStampKind, KittyTail, KittyWhiskers } from "../../core/types.ts";
import { STAMP_ART } from "./stampArt.ts";

const CLAY = "var(--studio-clay)";
const S = { width: 34, height: 34, viewBox: "0 0 40 40", "aria-hidden": true as const, focusable: "false" as const };
const ink = { fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const clay = { fill: CLAY, stroke: "currentColor", strokeWidth: 2.2, strokeLinejoin: "round" as const };

export function BodyGlyph({ value }: { value: KittyBody }) {
  const d: Record<KittyBody, string> = {
    round: "M14 8h12c7 8 8 20 3 26H11C6 28 7 16 14 8Z",
    pear: "M15 8h10c3 9 10 15 9 24 0 3-6 4-14 4S6 35 6 32c-1-9 6-15 9-24Z",
    loaf: "M10 14h20c6 4 7 14 3 20H7C3 28 4 18 10 14Z",
    tall: "M15 4h10c4 12 4 20 3 32H12C11 24 11 16 15 4Z",
    bean: "M13 8c8-2 14 4 13 12-1 6 4 8 3 14-4 4-14 4-19 1C5 30 8 22 9 16c0-4 0-7 4-8Z",
  };
  return <svg {...S}><path d={d[value]} {...clay} /></svg>;
}
export function HeadGlyph({ value }: { value: KittyHead }) {
  return (
    <svg {...S}>
      {value === "round" && <ellipse cx="20" cy="22" rx="13" ry="12" {...clay} />}
      {value === "wedge" && <path d="M6 16q14-12 28 0q-2 16-14 18Q8 32 6 16Z" {...clay} />}
      {value === "chubby" && <ellipse cx="20" cy="22" rx="16" ry="12.5" {...clay} />}
      {value === "heart" && <path d="M20 34C8 26 4 18 8 12c3-4 9-4 12 1 3-5 9-5 12-1 4 6 0 14-12 22Z" {...clay} />}
    </svg>
  );
}
export function EarsGlyph({ value }: { value: KittyEars }) {
  return (
    <svg {...S}>
      <ellipse cx="20" cy="26" rx="12" ry="9" {...clay} />
      {value === "pointed" && <path d="M9 22 11 8l9 10M31 22 29 8l-9 10" {...clay} />}
      {value === "round" && <><circle cx="11" cy="14" r="5.5" {...clay} /><circle cx="29" cy="14" r="5.5" {...clay} /></>}
      {value === "folded" && <path d="M9 20q3-6 10-3M31 20q-3-6-10-3" {...clay} />}
      {value === "tufted" && <path d="M9 22 11 8l9 10M31 22 29 8l-9 10M11 8q-1-4 2-6M29 8q1-4-2-6" {...clay} />}
      {value === "none" && <path d="M8 10l24 20" {...ink} strokeDasharray="3 3" />}
    </svg>
  );
}
export function EyesGlyph({ value }: { value: KittyEyes }) {
  return (
    <svg {...S}>
      {value === "open" && <><circle cx="13" cy="20" r="4" fill="currentColor" /><circle cx="27" cy="20" r="4" fill="currentColor" /></>}
      {value === "happy" && <path d="M8 22q5-8 10 0M22 22q5-8 10 0" {...ink} strokeWidth={3} />}
      {value === "wide" && <><circle cx="13" cy="20" r="6.5" fill="currentColor" /><circle cx="27" cy="20" r="6.5" fill="currentColor" /><circle cx="15" cy="18" r="2" fill={CLAY} /><circle cx="29" cy="18" r="2" fill={CLAY} /></>}
      {value === "sleepy" && <path d="M8 19q5 6 10 0M22 19q5 6 10 0" {...ink} strokeWidth={3} />}
      {value === "sparkle" && <><circle cx="13" cy="20" r="5" fill="currentColor" /><circle cx="27" cy="20" r="5" fill="currentColor" /><circle cx="15" cy="17.5" r="1.8" fill={CLAY} /><circle cx="29" cy="17.5" r="1.8" fill={CLAY} /><path d="M11 14l1.4 2.6L15 18l-2.6 1.4" fill={CLAY} /></>}
      {value === "wink" && <><circle cx="13" cy="20" r="4.5" fill="currentColor" /><path d="M22 22q5-8 10 0" {...ink} strokeWidth={3} /></>}
      {value === "closed" && <path d="M8 20h10M22 20h10" {...ink} strokeWidth={3} />}
    </svg>
  );
}
export function MouthGlyph({ value }: { value: KittyMouth }) {
  return (
    <svg {...S}>
      {value === "smile" && <path d="M10 18q10 12 20 0" {...ink} strokeWidth={3} />}
      {value === "w" && <path d="M9 18q5.5 8 11 0q5.5 8 11 0" {...ink} strokeWidth={3} />}
      {value === "tongue" && <><path d="M9 16q5.5 8 11 0q5.5 8 11 0" {...ink} strokeWidth={3} /><ellipse cx="20" cy="24" rx="4" ry="3.5" fill="currentColor" opacity="0.7" /></>}
      {value === "grin" && <path d="M8 16q12 16 24 0Z" {...clay} />}
      {value === "serene" && <path d="M14 20h12" {...ink} strokeWidth={3} />}
      {value === "oh" && <ellipse cx="20" cy="20" rx="5" ry="6.5" {...clay} />}
    </svg>
  );
}
export function WhiskersGlyph({ value }: { value: KittyWhiskers }) {
  return (
    <svg {...S}>
      <circle cx="20" cy="20" r="3" fill="currentColor" />
      {value === "short" && <path d="M15 16 9 14M15 20 8 20M15 24 9 26M25 16l6-2M25 20h7M25 24l6 2" {...ink} />}
      {value === "long" && <path d="M15 16 2 12M15 20 1 20M15 24 2 28M25 16l13-4M25 20h14M25 24l13 4" {...ink} />}
      {value === "curly" && <path d="M15 17q-6-4-8 2M15 23q-6 4-8-2M25 17q6-4 8 2M25 23q6 4 8-2" {...ink} />}
      {value === "none" && <path d="M8 10l24 20" {...ink} strokeDasharray="3 3" />}
    </svg>
  );
}
export function TailGlyph({ value }: { value: KittyTail }) {
  return (
    <svg {...S}>
      <ellipse cx="14" cy="28" rx="10" ry="7" {...clay} />
      {value === "curl" && <path d="M22 26c8 0 12-6 8-12" {...ink} strokeWidth={4} />}
      {value === "up" && <path d="M22 24c4-4 6-10 4-18" {...ink} strokeWidth={4} />}
      {value === "wrap" && <path d="M6 33c8 4 20 4 28-2" {...ink} strokeWidth={4} />}
      {value === "none" && <path d="M8 10l24 20" {...ink} strokeDasharray="3 3" />}
    </svg>
  );
}
export function NoseGlyph({ value }: { value: KittyNose }) {
  return (
    <svg {...S}>
      {value === "button" && <ellipse cx="20" cy="20" rx="6" ry="4.5" fill="currentColor" />}
      {value === "heart" && <path d="M20 26c-6-4-8-8-6-11 2-2 5-1 6 1 1-2 4-3 6-1 2 3 0 7-6 11Z" fill="currentColor" />}
      {value === "tiny" && <ellipse cx="20" cy="20" rx="3" ry="2.2" fill="currentColor" />}
    </svg>
  );
}
export function StampGlyph({ value, text }: { value: KittyStampKind; text?: string }) {
  const r = 13;
  return (
    <svg {...S}>
      {value === "initial" && (
        <text x={20} y={20} textAnchor="middle" dominantBaseline="middle" fontFamily="Georgia, serif" fontWeight={700} fontSize={r * 1.5} fill="currentColor">{(text ?? "Ab").slice(0, 2)}</text>
      )}
      <g transform={`translate(20 20) scale(${r})`}>
        {value !== "initial" && (
          STAMP_ART[value].map((art, index) => (
            <path
              key={index}
              d={art.d}
              fill={art.stroke ? "none" : art.role === "trim" ? CLAY : "currentColor"}
              stroke={art.stroke ? "currentColor" : undefined}
              strokeWidth={art.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={art.role === "white" ? 0.5 : undefined}
            />
          ))
        )}
      </g>
    </svg>
  );
}
export function ToolGlyph({ value }: { value: "brush" | "marker" | "sponge" | "eraser" | "dip" }) {
  return (
    <svg {...S}>
      {value === "brush" && <><path d="M8 32l14-14" {...ink} strokeWidth={4} /><path d="M22 18l8-8 2 2-8 8" {...clay} /><path d="M8 32q-3 1-2-3q2-3 5-1Z" fill="currentColor" /></>}
      {value === "marker" && <><path d="M9 31l13-13 5 5-13 13H9Z" {...clay} /><path d="M22 18l6-6 5 5-6 6" fill="currentColor" /></>}
      {value === "sponge" && <><rect x="7" y="13" width="26" height="15" rx="6" {...clay} /><circle cx="14" cy="19" r="2" fill="currentColor" opacity="0.5" /><circle cx="22" cy="23" r="1.6" fill="currentColor" opacity="0.5" /><circle cx="27" cy="17" r="1.4" fill="currentColor" opacity="0.5" /></>}
      {value === "eraser" && <><path d="M10 28l12-12 8 8-12 12H14Z" {...clay} /><path d="M18 34l-8-6" {...ink} /></>}
      {value === "dip" && <><path d="M8 20q12 8 24 0v10q-12 8-24 0Z" {...clay} /><path d="M20 4v12" {...ink} strokeWidth={3} /><circle cx="20" cy="16" r="3" fill="currentColor" /></>}
    </svg>
  );
}
