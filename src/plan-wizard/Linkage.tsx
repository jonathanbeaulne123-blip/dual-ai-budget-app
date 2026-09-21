import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { formatCad } from "../core/index.ts";
import { JAR_CAPACITY_CENTS, COIN_CENTS, jarReading, type WizardAnswers, type WizardLineKey } from "./wizard.ts";
import { RANKS, linkageReading, linkageWords, type RankPose } from "./linkage.ts";

/**
 * The pop-up itself: the recipe card seen in perspective, five cut-paper ranks
 * on one slotted bar, and the pull tab at the card's foot.
 *
 * The pull is a *view*, not a write. Scrubbing it raises and lowers the same
 * card; nothing here proposes, saves or posts. With reduced motion the raise is
 * a cut: the state changes, the tween does not run.
 */

const JAR_STEPS = [
  { bottom: "100%", label: JAR_CAPACITY_CENTS },
  { bottom: "66%", label: Math.round(JAR_CAPACITY_CENTS * 0.66) },
  { bottom: "33%", label: Math.round(JAR_CAPACITY_CENTS * 0.33) },
  { bottom: "0", label: 0 },
] as const;

function Nameplate({ text }: { text: string }) {
  return <div className="kw-face kw-face--name"><span>{text}</span></div>;
}

/** The jar's fill IS the amount, flat or raised. Nothing else carries it. */
function Jar({ cents }: { cents: number }) {
  const jar = jarReading(cents);
  const rows = 22, perRow = 4, height = 170 - 15 - 2, rowHeight = (height - 10) / rows;
  return (
    <div className="kw-face kw-face--jar">
      <ul className="kw-jar-scale" aria-hidden="true">
        {JAR_STEPS.map((step) => <li key={step.bottom} style={{ bottom: step.bottom }}><span>{formatCad(step.label)}</span><i /></li>)}
      </ul>
      {jar.lidCoins > 0 && (
        <div className="kw-jar-lidcoins" aria-hidden="true">{Array.from({ length: jar.lidCoins }, (_, i) => <i key={i} className="kw-coin" style={{ transform: `rotate(${(i * 53) % 13 - 6}deg)` }} />)}</div>
      )}
      <div className="kw-jar-lid" aria-hidden="true" />
      <div className="kw-jar-body" aria-hidden="true">
        {Array.from({ length: jar.coins }, (_, i) => {
          const row = Math.floor(i / perRow), col = i % perRow;
          return <i key={i} className="kw-coin" style={{ bottom: `${4 + row * rowHeight}px`, left: `${4 + col * 26 + (row % 2 ? 5 : 0)}px`, transform: `rotate(${(i * 37) % 9 - 4}deg)` }} />;
        })}
      </div>
      {jar.over && <p className="kw-jar-over">{formatCad(jar.spilledCents)} will not fit. It sits on the lid.</p>}
    </div>
  );
}

function Leaf({ when }: { when: NonNullable<WizardAnswers["when"]> }) {
  const parts = when.date ? when.date.split("-") : null;
  const month = parts ? new Date(`${when.date}T12:00:00`).toLocaleDateString("en-CA", { month: "short" }).toUpperCase() : "—";
  const day = parts ? String(Number(parts[2])) : "";
  const weekday = parts ? new Date(`${when.date}T12:00:00`).toLocaleDateString("en-CA", { weekday: "long" }) : "";
  return (
    <div className={`kw-face kw-face--leaf${when.date ? "" : " is-uncut"}`}>
      <span className="kw-leaf-mo">{month}</span>
      <span className="kw-leaf-dy">{day}</span>
      <span className="kw-leaf-wd">{weekday}</span>
      {!when.date && <span className="kw-leaf-pencil">not fixed yet</span>}
    </div>
  );
}

function Pot({ fund, name }: { fund: string; name: string }) {
  return (
    <div className="kw-face kw-face--pot" data-fund={fund}>
      <svg viewBox="0 0 118 98" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <rect x="6" y="6" width="106" height="17" rx="5" fill="currentColor" />
        <path d="M14 23 L104 23 L93 90 Q59 99 25 90 Z" fill="currentColor" />
        <path d="M14 23 L58 23 L58 96 Q39 94 25 90 Z" fill="#ffffff" opacity=".15" />
        <text x="59" y="64" textAnchor="middle" fontFamily="var(--display)" fontSize="13" fontWeight="800" letterSpacing="0.6" className="kw-pot-word">{name.toUpperCase()}</text>
      </svg>
    </div>
  );
}

function Chairs({ both, mine, partner }: { both: boolean; mine: string; partner: string }) {
  const chair = (initial: string, on: boolean, slot: "mine" | "partner") => (
    <svg key={slot} viewBox="0 0 84 130" preserveAspectRatio="xMidYMax meet" className={on ? "" : "is-empty"} data-seat={slot} aria-hidden="true">
      <rect x="18" y="26" width="48" height="40" rx="5" className="kw-chair-back" />
      <rect x="10" y="66" width="64" height="10" rx="3" className="kw-chair-seat" />
      <path d="M16 128 V76 M68 128 V76" className="kw-chair-legs" strokeWidth="6" strokeLinecap="round" fill="none" />
      {on && <g><ellipse cx="42" cy="40" rx="15" ry="16" className="kw-chair-sitter" /><path d="M20 70 Q42 46 64 70 Z" className="kw-chair-sitter" /><text x="42" y="47" textAnchor="middle" fontFamily="var(--display)" fontSize="17" fontWeight="800" className="kw-chair-initial">{initial}</text></g>}
    </svg>
  );
  return <div className="kw-face kw-face--chairs">{chair(mine.slice(0, 1).toUpperCase() || "M", true, "mine")}{chair(partner.slice(0, 1).toUpperCase() || "P", both, "partner")}</div>;
}

function RankFace({ pose, answers, names }: { pose: RankPose; answers: WizardAnswers; names: { mine: string; partner: string } }) {
  switch (pose.rank.key) {
    case "what": return <Nameplate text={answers.what?.text ?? ""} />;
    case "much": return <Jar cents={answers.much?.cents ?? 0} />;
    case "when": return <Leaf when={answers.when ?? { text: "", date: null }} />;
    case "pot": return <Pot fund={answers.pot?.fund ?? "everyday"} name={answers.pot?.text ?? ""} />;
    default: return <Chairs both={answers.who?.choice === "both"} mine={names.mine} partner={names.partner} />;
  }
}

export type LinkageProps = {
  answers: WizardAnswers;
  fitted: readonly WizardLineKey[];
  /** 0 flat … 1 fully raised. */
  pull: number;
  onPull: (next: number) => void;
  /** The tab cannot be pulled while the card is still being written. */
  locked: boolean;
  reduceMotion: boolean;
  names: { mine: string; partner: string };
};

export function Linkage({ answers, fitted, pull, onPull, locked, reduceMotion, names }: LinkageProps) {
  const reading = useMemo(() => linkageReading(pull, fitted), [pull, fitted]);
  const stage = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = stage.current;
    if (!node || typeof ResizeObserver !== "function") return;
    const fit = () => setScale(Math.max(0.42, Math.min(1.06, (node.clientWidth - 8) / 570, (node.clientHeight - 8) / 350)));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
    <div className="kw-proscenium" data-reduce={reduceMotion ? "true" : undefined}>
      <div className="kw-stage" ref={stage}>
        <div className="kw-scaler" style={{ "--kw-scale": scale.toFixed(3) } as CSSProperties}>
          <div className="kw-mech" style={{ "--kw-tilt": `${reading.tilt}deg` } as CSSProperties}>
            <div className="kw-floor">
              <span className="kw-crease" style={{ opacity: reading.creaseOpacity }} aria-hidden="true" />
              <span className="kw-floorhead">Hearth &middot; recipe card</span>
              <div className="kw-floorrules" aria-hidden="true">
                {RANKS.map((rank) => <div key={rank.key} className="kw-frule" style={{ top: `${rank.hinge}px` }}><b>{rank.index + 1}</b><span>{rank.label}</span></div>)}
              </div>
            </div>
            <div className="kw-shadows" aria-hidden="true">
              {reading.poses.map((pose) => <div key={pose.rank.key} className="kw-rankshadow" style={{ width: `${pose.rank.w}px`, height: `${pose.rank.h}px`, transform: pose.shadowTransform, opacity: pose.shadowOpacity }} />)}
            </div>
            <div className="kw-rods" aria-hidden="true">
              {reading.poses.map((pose) => <div key={pose.rank.key} className="kw-rod" style={{ width: `${pose.rodWidth}px`, transform: pose.rodTransform }} />)}
            </div>
            <div className="kw-bar" aria-hidden="true" style={{ transform: `translate3d(0, ${reading.barY - 6}px, 0)` }}>
              {reading.poses.map((pose) => <i key={pose.rank.key} style={{ left: `${215 + pose.rank.x - 26}px`, width: "52px" }} />)}
            </div>
            <div className="kw-ranks">
              {reading.poses.map((pose) => (
                <div key={pose.rank.key} className="kw-rank" data-rank={pose.rank.key} style={{ width: `${pose.rank.w}px`, height: `${pose.rank.h}px`, transform: pose.rankTransform }}>
                  <RankFace pose={pose} answers={answers} names={names} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="kw-apron">
        <div className="kw-slot">
          <p className="kw-slot-caption"><span>The pull</span><em data-testid="kw-pullstate">{locked ? `Linkage has ${reading.fitted} of 5 ranks — finish the card to pull it` : linkageWords(reading)}</em></p>
          <input className="kw-pull" type="range" min={0} max={1000} step={1} value={Math.round(pull * 1000)} disabled={locked}
            aria-label="Pull the tab to raise the card" aria-valuetext={linkageWords(reading)}
            onChange={(event) => onPull(Number(event.target.value) / 1000)} />
          <p className="kw-pullmarks"><span>flat</span><span>fully raised</span></p>
        </div>
      </div>
    </div>
    <p className="kw-readout" role="status">
      {reading.fitted === 0
        ? "One bar, no rods yet. Each answer pins one more rank, one step further back."
        : `One bar, ${reading.fitted} rod${reading.fitted === 1 ? "" : "s"}, one parameter. Bar travel ${reading.travel.toFixed(1)}u of 57u. ${linkageWords(reading)}`}
      {answers.much ? ` Every coin is ${formatCad(COIN_CENTS)}; the jar holds ${formatCad(JAR_CAPACITY_CENTS)}.` : ""}
    </p>
    </>
  );
}
