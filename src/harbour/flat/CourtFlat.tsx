import type { DateKey } from "../../core/calendar.ts";
import type { HouseCondition } from "../../core/houseCondition.ts";
import type { FundPulseFreshness } from "../../core/fundPulse.ts";
import type { QueenGlaze } from "../../core/queenPresentation.ts";
import { formatCad } from "../../core/money.ts";
import "../harbour.css";

/**
 * The Court's reading, as BUILD_PLAN §5 shapes it. Writer B's
 * `data/reading.ts` exports the canonical `HarbourReading`; this structural
 * twin keeps the flat edition and the scene independent of that file until
 * step 7 wires them together.
 */
export interface HarbourReadingLike {
  /** `fundSnapshot.now`; null reads "—", never "$0". */
  everyday: number | null;
  prepare: { cents: number | null; target: number; coveredThrough: DateKey | null; shortOn?: { date: DateKey; label: string; shortCents: number } };
  protect: { cents: number | null; target: number };
  build: { cents: number | null; target: number; goals: number };
  next: { label: string; date: DateKey; cents: number; daysAhead: number; target: "cellar-bills" | "loft-banks" } | null;
  noticed: { fact: string; next: string; target: string; source: "pulse" | "hercules" } | null;
  /** "Since you were here" — at most three lines. */
  slip: string[];
  condition: HouseCondition;
  glaze: QueenGlaze;
  banks: number;
  jars: number;
  mode: 1 | 2;
  freshness: FundPulseFreshness;
}

export type CourtFlatStatus = "loading" | "fallback" | "flat";

export type CourtFlatProps = {
  reading: HarbourReadingLike | null;
  /** loading: the Suspense/scene fallback; fallback: WebGL failed; flat: the reading edition by choice. */
  status?: CourtFlatStatus;
  theme?: "classic" | "taylor" | "newfoundland";
  partnerName?: string | null;
  onOpen?: (target: string, object?: string) => void;
};

/** Stone never says "$0" for an unknown; it says nothing. */
export function engravedCents(cents: number | null | undefined): string {
  return cents === null || cents === undefined || !Number.isFinite(cents) ? "—" : formatCad(cents);
}

const SKY = { classic: "#d9c9a8", taylor: "#f2e3ea", newfoundland: "#dfe9ec" } as const;
const STONE = { classic: "#cbb48f", taylor: "#ead8d2", newfoundland: "#7d8d93" } as const;
const JOINT = { classic: "#8f7d60", taylor: "#d9b8c4", newfoundland: "#c9b48c" } as const;
const MOSS = { classic: "#6d7f4f", taylor: "#9fae86", newfoundland: "#5f7f6a" } as const;
const TIMBER = { classic: "#6b4a32", taylor: "#8a6a72", newfoundland: "#45686d" } as const;

/**
 * The reading edition of the Court (BUILD_PLAN #29): the same four numbers,
 * the next date, her notice and the slip, as HTML inside one SVG court. It is
 * the Suspense fallback, the `flat` tier, and the WebGL fallback. Every door
 * a piece opens in the scene is a real button here.
 */
export function CourtFlat({ reading, status = "loading", theme = "classic", partnerName = null, onOpen }: CourtFlatProps) {
  const open = (target: string, object?: string) => () => onOpen?.(target, object);
  const label = status === "loading" ? "The Court is being laid" : status === "fallback" ? "Reading edition · the Court could not be drawn" : "Reading edition";
  const next = reading?.next ?? null;
  const notice = reading?.noticed ?? null;
  const slip = reading?.slip.slice(0, 3) ?? [];
  const busy = status === "loading" && !reading;
  return <section className={`court-flat court-flat--${theme}`} data-court-flat={status} aria-label="The Queen's Court, reading edition" aria-busy={busy || undefined}>
    <svg className="court-flat__scene" viewBox="0 0 800 520" aria-hidden="true" focusable="false">
      <rect width="800" height="520" fill={SKY[theme]} />
      <ellipse cx="400" cy="560" rx="560" ry="230" fill={MOSS[theme]} opacity=".55" />
      <ellipse cx="400" cy="400" rx="330" ry="120" fill={STONE[theme]} stroke={JOINT[theme]} strokeWidth="3" />
      {[-2, -1, 0, 1].map(row => <line key={row} x1={150 + row * 12} y1={400 + row * 28} x2={650 - row * 12} y2={400 + row * 28} stroke={JOINT[theme]} strokeWidth="2" opacity=".55" />)}
      {[-3, -2, -1, 0, 1, 2, 3].map(col => <line key={col} x1={400 + col * 60} y1="285" x2={400 + col * 92} y2="515" stroke={JOINT[theme]} strokeWidth="2" opacity=".4" />)}
      <g transform="translate(400 300)">
        <path d="M-36 40h72l-8 62h-56z" fill="#b8694a" stroke="#6f3a26" strokeWidth="3" />
        <ellipse cx="0" cy="40" rx="40" ry="10" fill="#8a4a33" />
        <path d="M0 40c-22-40-40-70-26-108 10 22 20 34 26 44 6-10 16-22 26-44 14 38-4 68-26 108z" fill={MOSS[theme]} stroke="#3f4d2e" strokeWidth="2" />
        <circle cx="0" cy="-42" r="18" fill="#efe3d2" stroke="#6a5a4a" strokeWidth="2" />
      </g>
      <g fill={TIMBER[theme]} stroke="#3a2a1e" strokeWidth="2">
        <rect x="140" y="345" width="64" height="26" rx="3" /><rect x="596" y="345" width="64" height="26" rx="3" /><rect x="368" y="452" width="64" height="26" rx="3" />
      </g>
      <g transform="translate(150 280)"><rect x="12" y="20" width="20" height="44" fill="#8b8f95" /><path d="M8 20h28l-4-10H12z" fill="#6b6f75" /></g>
      <g transform="translate(610 265)"><path d="M22 0l-14 30 8 30h12l8-30z" fill="#8b8f95" /><circle cx="22" cy="-8" r="8" fill="#8b8f95" /></g>
      <g transform="translate(370 405)"><path d="M6 46l26-46 26 46z" fill="#8b8f95" /><circle cx="32" cy="12" r="9" fill="#6b6f75" /></g>
      <g transform="translate(110 400)"><circle cx="0" cy="0" r="30" fill={STONE[theme]} stroke={JOINT[theme]} strokeWidth="3" /><line x1="0" y1="0" x2={next ? Math.sin(sundialAngle(next.daysAhead)) * 24 : 0} y2={next ? -Math.cos(sundialAngle(next.daysAhead)) * 24 : -24} stroke="#3a2a1e" strokeWidth="3" /></g>
      <g transform="translate(690 340)"><rect x="8" y="30" width="8" height="70" fill={TIMBER[theme]} /><rect x="-10" y="10" width="44" height="26" rx="6" fill="#4d5b66" />{notice && <path d="M34 10v-18h14v8h-14" fill="#c9503c" />}</g>
    </svg>
    <p className="court-flat__status" role="status">{label}</p>
    <div className="court-flat__stone court-flat__stone--everyday">
      <button type="button" className="court-flat__plate" onClick={open("queen")} aria-label={`The Queen. Everyday ${engravedCents(reading?.everyday)}`}>
        <small>Everyday</small><strong>{engravedCents(reading?.everyday)}</strong>
      </button>
    </div>
    <ul className="court-flat__plinths" aria-label="Her court">
      <li><button type="button" className="court-flat__plate" onClick={open("loft-banks")} aria-label={`The Rook, Build ${engravedCents(reading?.build.cents)}. Open the Loft.`}><small>Build · the Rook</small><strong>{engravedCents(reading?.build.cents)}</strong></button></li>
      <li><button type="button" className="court-flat__plate" onClick={open("cellar-bills")} aria-label={`The Bishop, Prepare ${engravedCents(reading?.prepare.cents)}. Open the Cellar.`}><small>Prepare · the Bishop</small><strong>{engravedCents(reading?.prepare.cents)}</strong></button></li>
      <li><button type="button" className="court-flat__plate" onClick={open("loft-banks", "bank/plan:protect")} aria-label={`The Knight, Protect ${engravedCents(reading?.protect.cents)}. Open the cistern.`}><small>Protect · the Knight</small><strong>{engravedCents(reading?.protect.cents)}</strong></button></li>
    </ul>
    <div className="court-flat__gate">
      <button type="button" className="court-flat__sundial" onClick={open(next?.target ?? "cellar-bills")} aria-label={next ? `Sundial. Next: ${next.label} on ${next.date}, ${engravedCents(next.cents)}` : "Sundial. No dated commitment"}>
        <small>Sundial</small><strong>{next ? next.label : "No dated commitment"}</strong><span>{next ? `${next.date} · ${engravedCents(next.cents)}` : "Add a date when you are ready"}</span>
      </button>
      <button type="button" className="court-flat__mailbox" onClick={open(notice?.target ?? "more")} data-flag={notice ? "up" : "down"} aria-label={notice ? `Mailbox, flag up. ${notice.fact} ${notice.next}` : "Mailbox. Nothing new."}>
        <small>Mailbox</small><strong>{notice ? notice.fact : "Nothing new"}</strong>{notice && <span>{notice.next}</span>}
      </button>
      {slip.length > 0 && <ul className="court-flat__slip" aria-label="Since you were here">{slip.map((line, i) => <li key={i}>{line}</li>)}</ul>}
      {partnerName && <p className="court-flat__partner">{partnerName} was here.</p>}
    </div>
  </section>;
}

/** Noon is 0; a commitment 31 or more days ahead sits on the rim. Pure; writer D's `court/sundial.ts` owns the scene's copy. */
export function sundialAngle(daysAhead: number): number {
  const clamped = Math.max(0, Math.min(31, daysAhead));
  return (clamped / 31) * (Math.PI * 0.92);
}
