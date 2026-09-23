import { formatCad } from "../../core/money.ts";
import type { HarbourPlaceId } from "../flag.ts";
import type { HarbourReading } from "../data/reading.ts";
import { DoorSign } from "./DoorSign.tsx";
import "../harbour.css";

export type CourtFlatStatus = "loading" | "fallback" | "flat";

export type CourtFlatProps = {
  /** Null while the App has no reading yet (the Suspense fallback): every stone reads "—". */
  reading: HarbourReading | null;
  /** loading: the frame before the scene draws; fallback: WebGL failed; flat: the reading edition by choice. */
  status?: CourtFlatStatus;
  theme?: "classic" | "taylor" | "newfoundland";
  partnerName?: string | null;
  onOpen?: (target: string, object?: string) => void;
  /**
   * Enter, then Open (BUILD_PLAN_SLICE2 §0): the Rook and the Bishop are ways
   * into the Tower and the Cellar, not doors onto HTML. Without this the
   * buttons fall back to the surfaces, so the App's Suspense frame still works.
   */
  onEnter?: (place: HarbourPlaceId) => void;
  /** Laid over a stage that is still being built, rather than standing on its own. */
  overlay?: boolean;
};

/** Stone never says "$0" for an unknown; it says nothing. (The scene's `engravedWords` is the same rule.) */
export function engravedCents(cents: number | null | undefined): string {
  return cents === null || cents === undefined || !Number.isFinite(cents) ? "—" : formatCad(cents);
}

/** Noon is 0; a commitment 31 or more days ahead sits on the rim (π/2). The same rule as `court/sundial.ts`, kept pure here so the flat edition never loads three.js. */
export function sundialAngle(daysAhead: number): number {
  if (!Number.isFinite(daysAhead)) return Math.PI / 2;
  const clamped = Math.max(0, Math.min(31, daysAhead));
  return (clamped / 31) * (Math.PI / 2);
}

const SKY = { classic: "#e8dcc4", taylor: "#f2e3ea", newfoundland: "#dfe9ec" } as const;
const LAWN = { classic: "#7d9a58", taylor: "#9fbf86", newfoundland: "#6a8d5a" } as const;
const STONE = { classic: "#cbb48f", taylor: "#ead8d2", newfoundland: "#7d8d93" } as const;
const STONE_ALT = { classic: "#b9a27c", taylor: "#dfc7c3", newfoundland: "#6f7f86" } as const;
const JOINT = { classic: "#8f7d60", taylor: "#d9b8c4", newfoundland: "#c9b48c" } as const;
const PLINTH = { classic: "#a8916c", taylor: "#77629b", newfoundland: "#6d4b36" } as const;
const TIMBER = { classic: "#6b4a32", taylor: "#b08a92", newfoundland: "#6d4b36" } as const;
const METAL = { classic: "#caa252", taylor: "#d9b26a", newfoundland: "#d9b45b" } as const;
const PLATE = { classic: "#d9c8a6", taylor: "#f7ebe8", newfoundland: "#d3dcde" } as const;
const INK = { classic: "#332d24", taylor: "#47373e", newfoundland: "#243e45" } as const;
const SEA = { classic: "#7fb2b8", taylor: "#a9c9dd", newfoundland: "#4f98aa" } as const;

/**
 * The reading edition of the Court (BUILD_PLAN #29): the same four numbers,
 * the next date, her notice and the slip, as HTML over one SVG court. It is
 * the Suspense fallback, the `flat` tier, and the WebGL fallback. Every door a
 * piece opens in the scene is a real button here; nothing here posts money.
 */
export function CourtFlat({ reading, status = "loading", theme = "classic", partnerName = null, onOpen, onEnter, overlay = false }: CourtFlatProps) {
  const open = (target: string, object?: string) => () => onOpen?.(target, object);
  const enter = (place: "tower" | "cellar", target: string, object?: string) => () => (onEnter ? onEnter(place) : onOpen?.(target, object));
  const label = status === "loading" ? "The Court is being laid" : status === "fallback" ? "Reading edition · the Court could not be drawn" : "Reading edition";
  const next = reading?.next ?? null;
  const notice = reading?.noticed ?? null;
  const slip = reading?.slip.slice(0, 3) ?? [];
  const busy = status === "loading";
  const angle = next ? sundialAngle(next.daysAhead) : Math.PI / 2;
  const shadow = { x: Math.sin(angle) * 26, y: -Math.cos(angle) * 26 };
  return <section className={`court-flat court-flat--${theme}${overlay ? " court-flat--overlay" : ""}`} data-court-flat={status} data-place-flat="court" aria-label="The Queen's Court, reading edition" aria-busy={busy || undefined}>
    <svg className="court-flat__scene" viewBox="0 0 800 520" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      <rect width="800" height="520" fill={SKY[theme]} />
      <ellipse cx="400" cy="620" rx="720" ry="300" fill={SEA[theme]} opacity=".55" />
      <ellipse cx="400" cy="470" rx="470" ry="150" fill={LAWN[theme]} />
      <ellipse cx="400" cy="420" rx="330" ry="112" fill={STONE[theme]} stroke={JOINT[theme]} strokeWidth="3" />
      {[0, 1, 2, 3, 4, 5, 6, 7].flatMap(row => [0, 1, 2, 3, 4, 5, 6, 7].map(col => {
        const cx = 400 + (col - 3.5) * (34 + row * 5), cy = 340 + row * 21 + row * row * 0.9;
        return <rect key={`${row}-${col}`} x={cx - (15 + row * 2.4)} y={cy - 8} width={30 + row * 4.8} height="17" rx="2" fill={(row + col) % 2 ? STONE_ALT[theme] : STONE[theme]} stroke={JOINT[theme]} strokeWidth="1.2" opacity=".92" />;
      }))}
      {/* The Queen in her pot, centre; her flagstone at her feet. */}
      <g transform="translate(400 330)">
        <path d="M-40 34h80l-9 60h-62z" fill="#b8694a" stroke="#6f3a26" strokeWidth="3" />
        <ellipse cx="0" cy="34" rx="44" ry="10" fill="#8a4a33" />
        <path d="M0 34c-30-44-52-78-32-124 12 26 24 40 32 52 8-12 20-26 32-52 20 46-2 80-32 124z" fill={LAWN[theme]} stroke="#3f4d2e" strokeWidth="2" />
        <circle cx="0" cy="-50" r="20" fill="#efe3d2" stroke="#6a5a4a" strokeWidth="2" />
        <path d="M-14 -66l6 -14 8 12M14 -66l-6 -14 -8 12" fill="#efe3d2" stroke="#6a5a4a" strokeWidth="2" />
      </g>
      <rect x="352" y="424" width="96" height="30" rx="3" fill={PLATE[theme]} stroke={JOINT[theme]} strokeWidth="2" />
      {/* Plinths: knight far left, rook far right, bishop near the gate. */}
      <g fill={PLINTH[theme]} stroke={INK[theme]} strokeOpacity=".5" strokeWidth="2">
        <rect x="118" y="318" width="70" height="30" rx="3" /><rect x="612" y="318" width="70" height="30" rx="3" /><rect x="364" y="464" width="72" height="26" rx="3" />
      </g>
      <g fill="#a9adb3" stroke="#5c6066" strokeWidth="2">
        <path d="M133 318v-46l14-18 14 18v46z" /><rect x="133" y="266" width="28" height="8" />
        <path d="M629 318l-8-40 14-16 8-30 10 30 14 16-8 40z" /><circle cx="647" cy="222" r="9" />
        <path d="M376 464l14-46 10 4 10-4 14 46z" /><circle cx="400" cy="410" r="11" />
      </g>
      {/* Sundial (right, near) and mailbox (left, near) with the slip. */}
      <g transform="translate(560 452)"><ellipse cx="0" cy="0" rx="36" ry="15" fill={PLATE[theme]} stroke={JOINT[theme]} strokeWidth="3" /><line x1="0" y1="0" x2={shadow.x} y2={shadow.y * 0.45} stroke={INK[theme]} strokeWidth="3" strokeLinecap="round" /><path d="M0 0l0 -26 8 6z" fill={METAL[theme]} /></g>
      <g transform="translate(232 428)"><rect x="-4" y="20" width="8" height="52" fill={TIMBER[theme]} /><rect x="-20" y="-4" width="40" height="26" rx="6" fill={INK[theme]} opacity=".75" />{notice && <path d="M20 -2v-18h12v8h-12" fill="#c9503c" />}<rect x="26" y="4" width="30" height="22" fill="#fff8e6" stroke={JOINT[theme]} strokeWidth="1.5" transform="rotate(-6 26 4)" /></g>
      {/* Hercules, asleep on the warm stone. */}
      <g transform="translate(470 392)"><ellipse cx="0" cy="0" rx="22" ry="11" fill="#f4efe6" stroke="#8b7f74" strokeWidth="1.5" /><circle cx="18" cy="-6" r="8" fill="#f4efe6" stroke="#8b7f74" strokeWidth="1.5" /><path d="M14 -13l2 -6 4 5M22 -13l-2 -6 -4 5" fill="#e8a9a0" /></g>
      {/* The gate. */}
      <g transform="translate(400 500)"><rect x="-58" y="-40" width="8" height="40" fill={TIMBER[theme]} /><rect x="50" y="-40" width="8" height="40" fill={TIMBER[theme]} /><path d="M-54 -40a54 54 0 0 1 108 0" fill="none" stroke={METAL[theme]} strokeWidth="4" /></g>
    </svg>
    <div className="court-flat__sheet">
      <p className="court-flat__status" role="status">{label}</p>
      <DoorSign place="court" reading={reading} />
      <div className="court-flat__stone court-flat__stone--everyday">
        <button type="button" className="court-flat__plate" onClick={open("queen")} aria-label={`The Queen. Everyday ${engravedCents(reading?.everyday)}. Meet the Queen.`}>
          <small>Everyday · at her feet</small><strong>{engravedCents(reading?.everyday)}</strong>
        </button>
      </div>
      <ul className="court-flat__plinths" aria-label="Her court">
        <li><button type="button" className="court-flat__plate" onClick={enter("tower", "loft-banks")} aria-label={`The Rook, Build ${engravedCents(reading?.build.cents)}. Climb the Tower.`}><small>Build · the Rook</small><strong>{engravedCents(reading?.build.cents)}</strong><span>{reading ? `${reading.build.goals} ${reading.build.goals === 1 ? "goal" : "goals"} · ${reading.banks} ${reading.banks === 1 ? "bank" : "banks"}` : "The Loft"}</span></button></li>
        <li><button type="button" className="court-flat__plate" onClick={enter("cellar", "cellar-bills")} aria-label={`The Bishop, Prepare ${engravedCents(reading?.prepare.cents)}. Go down to the Cellar.`}><small>Prepare · the Bishop</small><strong>{engravedCents(reading?.prepare.cents)}</strong><span>{reading?.prepare.coveredThrough ? `Covered through ${reading.prepare.coveredThrough}` : reading ? `${reading.jars} ${reading.jars === 1 ? "jar" : "jars"}` : "The Cellar"}</span></button></li>
        <li><button type="button" className="court-flat__plate" onClick={open("loft-banks", "bank/plan:protect")} aria-label={`The Knight, Protect ${engravedCents(reading?.protect.cents)}. Open the cistern.`}><small>Protect · the Knight</small><strong>{engravedCents(reading?.protect.cents)}</strong><span>{reading && reading.protect.target > 0 ? `of ${engravedCents(reading.protect.target)}` : "The cistern"}</span></button></li>
      </ul>
      <div className="court-flat__gate">
        <button type="button" className="court-flat__sundial" onClick={open(next?.target ?? "cellar-bills")} aria-label={next ? `Sundial. Next: ${next.label} on ${next.date}, ${engravedCents(next.cents)}, ${next.daysAhead} ${next.daysAhead === 1 ? "day" : "days"} ahead.` : "Sundial. No dated commitment."}>
          <small>Sundial · next dated commitment</small><strong>{next ? next.label : "No dated commitment"}</strong><span>{next ? `${next.date} · ${engravedCents(next.cents)}` : "Add a date when you are ready"}</span>
        </button>
        <button type="button" className="court-flat__mailbox" onClick={open(notice?.target ?? "more")} data-flag={notice ? "up" : "down"} aria-label={notice ? `Mailbox, flag up. ${notice.fact} ${notice.next}` : "Mailbox. Nothing new."}>
          <small>Mailbox{notice ? " · flag up" : ""}</small><strong>{notice ? notice.fact : "Nothing new"}</strong>{notice && <span>{notice.next}</span>}
        </button>
        {slip.length > 0 && <ul className="court-flat__slip" aria-label="Since you were here">{slip.map((line, i) => <li key={i}>{line}</li>)}</ul>}
        {partnerName && <p className="court-flat__partner">{partnerName}{reading?.freshness === "current" ? " is here." : " was here."}</p>}
        {reading?.condition && reading.condition.state !== "checking" && <p className="court-flat__condition" data-condition={reading.condition.state}>{reading.condition.words}</p>}
      </div>
    </div>
  </section>;
}
