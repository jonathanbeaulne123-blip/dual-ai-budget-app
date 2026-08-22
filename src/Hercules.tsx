import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  HERCULES_CHIPS,
  askHercules,
  describeCompanion,
  groceryHighFive,
  herculesPageBrief,
  kitchenSeason,
  markRecapSeen,
  weekRecap,
  type CompanionMood,
  type Environment,
  type HearthTab,
  type Household,
} from "./core/index.ts";

export function HerculesPortrait({
  mood,
  hat,
  chain,
  house,
  collar,
  size = "stage",
}: {
  mood: CompanionMood;
  hat: string | null;
  chain: string | null;
  house: string | null;
  collar: string | null;
  size?: "stage" | "dock";
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  function onMove(event: PointerEvent<HTMLDivElement>) {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return;
    const px = (event.clientX - box.left) / box.width - 0.5;
    const py = (event.clientY - box.top) / box.height - 0.5;
    setTilt({ x: -(py * 10), y: px * 14 });
  }

  return (
    <div
      ref={stage}
      className={`hercules-stage house-${house || "none"} size-${size} mood-${mood}`}
      aria-hidden="true"
      onPointerMove={onMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
    >
      {house && (
        <span className="hercules-house">
          {house === "townhouse" ? "⌂⌂" : house === "patio" ? "☀" : "⌂"}
        </span>
      )}
      <div className="hercules-rig" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}>
        <svg viewBox="0 0 160 170" className={`hercules-svg tail-${mood}`}>
          <defs>
            <linearGradient id="fur" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c4a574" />
              <stop offset="45%" stopColor="#8b5a2b" />
              <stop offset="100%" stopColor="#3c2412" />
            </linearGradient>
            <linearGradient id="ruffGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0e0c4" />
              <stop offset="100%" stopColor="#c4a574" />
            </linearGradient>
          </defs>
          {house === "patio" && (
            <g>
              <ellipse cx="80" cy="22" rx="28" ry="8" fill="#c45c26" opacity="0.85" />
              <path d="M80 22 L80 48" stroke="#1b1712" strokeWidth="2" />
            </g>
          )}
          <ellipse cx="78" cy="158" rx="36" ry="8" fill="rgba(27,23,18,0.16)" />
          <path className="hercules-tail" d="M118 108 C148 92 156 128 132 148 C150 130 142 96 118 108 Z" fill="url(#fur)" />
          <ellipse cx="80" cy="118" rx="42" ry="32" fill="url(#fur)" />
          <ellipse cx="80" cy="112" rx="28" ry="22" fill="url(#ruffGrad)" />
          {hat === "ruff" && <ellipse cx="80" cy="104" rx="38" ry="18" fill="url(#ruffGrad)" opacity="0.95" />}
          <path d="M48 52 L38 18 L62 44 Z" fill="url(#fur)" />
          <path d="M112 52 L122 18 L98 44 Z" fill="url(#fur)" />
          <path d="M42 22 L38 8 L52 20" stroke="#3c2412" strokeWidth="3" fill="none" />
          <path d="M118 22 L122 8 L108 20" stroke="#3c2412" strokeWidth="3" fill="none" />
          <ellipse cx="80" cy="72" rx="34" ry="30" fill="url(#fur)" />
          <path d="M80 78 L72 92 L88 92 Z" fill="#5c3a22" />
          <circle cx="66" cy="68" r={mood === "hiding" ? 3 : 6} fill="#1b1712" />
          <circle cx="94" cy="68" r={mood === "hiding" ? 3 : 6} fill="#1b1712" />
          {mood !== "hiding" && <circle cx="64" cy="66" r="1.6" fill="#f3eee4" />}
          {mood !== "hiding" && <circle cx="92" cy="66" r="1.6" fill="#f3eee4" />}
          {mood === "glowing" && <path d="M68 98 Q80 110 92 98" fill="none" stroke="#1b1712" strokeWidth="3" />}
          {mood === "restless" && <path d="M68 102 Q80 92 92 102" fill="none" stroke="#1b1712" strokeWidth="3" />}
          {mood === "content" && <path d="M70 100 L90 100" stroke="#1b1712" strokeWidth="3" />}
          {mood === "hiding" && <path d="M70 96 L90 96" stroke="#1b1712" strokeWidth="2" />}
          <path d="M58 88 L48 90" stroke="#1b1712" strokeWidth="1.5" />
          <path d="M102 88 L112 90" stroke="#1b1712" strokeWidth="1.5" />
          {hat === "toque" && <path d="M52 48 Q80 8 108 48 Q80 34 52 48 Z" fill="#f3eee4" stroke="#1b1712" strokeWidth="2" />}
          {hat === "visor" && (
            <g>
              <rect x="48" y="44" width="64" height="12" rx="4" fill="#1b1712" />
              <rect x="92" y="46" width="32" height="8" rx="3" fill="#c45c26" />
            </g>
          )}
          {hat === "chef" && (
            <g>
              <ellipse cx="80" cy="32" rx="26" ry="16" fill="#fffaf2" stroke="#1b1712" strokeWidth="2" />
              <rect x="68" y="42" width="24" height="12" fill="#fffaf2" stroke="#1b1712" />
            </g>
          )}
          {hat === "ruff" && <path d="M44 58 Q80 78 116 58" fill="none" stroke="#f0e0c4" strokeWidth="10" strokeLinecap="round" />}
          {chain === "copper" && <ellipse cx="80" cy="128" rx="18" ry="8" fill="none" stroke="#c45c26" strokeWidth="3" />}
          {chain === "gold" && <ellipse cx="80" cy="128" rx="18" ry="8" fill="none" stroke="#c9a227" strokeWidth="4" />}
          {collar === "bell" && (
            <g>
              <path d="M58 118 H102" stroke="#c9a227" strokeWidth="4" />
              <circle cx="80" cy="128" r="7" fill="#c9a227" stroke="#1b1712" />
            </g>
          )}
          {collar === "yarn" && <path d="M56 116 Q80 132 104 116" fill="none" stroke="#c45c26" strokeWidth="5" strokeLinecap="round" />}
          {collar === "fish" && <ellipse cx="118" cy="102" rx="12" ry="6" fill="#2c6a4e" />}
        </svg>
      </div>
      {size === "stage" && <span className="hercules-mood">{mood}</span>}
    </div>
  );
}

function dressedLook(
  household: Household,
  today: string,
  visorPop: boolean,
) {
  const view = describeCompanion(household, today);
  const season = kitchenSeason(today);
  return {
    view,
    hat: visorPop ? "visor" : view.equipped.hat || (season === "ruff" ? "ruff" : null),
    house: view.equipped.house || (season === "patio" ? "patio" : null),
    chain: view.equipped.chain,
    collar: view.equipped.collar,
    season,
  };
}

export function HerculesDock({
  household,
  today,
  tab,
  adding,
  visorPop,
  onOpenAdd,
}: {
  household: Household;
  today: string;
  tab: HearthTab;
  adding: boolean;
  visorPop?: boolean;
  onOpenAdd: (note?: string) => void;
}) {
  const look = useMemo(() => dressedLook(household, today, Boolean(visorPop)), [household, today, visorPop]);
  const brief = useMemo(
    () => herculesPageBrief(household, adding ? "add" : tab, today),
    [household, adding, tab, today],
  );
  const highFive = useMemo(() => groceryHighFive(household, today), [household, today]);
  const [open, setOpen] = useState(false);
  const [purr, setPurr] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("hercules-open", open);
    return () => document.documentElement.classList.remove("hercules-open");
  }, [open]);

  if (adding) return null;

  return (
    <>
      <button
        type="button"
        className={`hercules-dock mood-${look.view.mood} ${purr || visorPop ? "purr" : ""} ${highFive.yes ? "high-five" : ""} ${visorPop ? "visor-pop" : ""}`}
        aria-label={`Talk to ${look.view.name}`}
        onClick={() => {
          setPurr(true);
          setOpen(true);
        }}
        onAnimationEnd={() => setPurr(false)}
      >
        <HerculesPortrait
          mood={look.view.mood}
          hat={look.hat}
          chain={look.chain}
          house={look.house}
          collar={look.collar}
          size="dock"
        />
      </button>
      {open && (
        <HerculesChat
          household={household}
          today={today}
          tab={tab}
          brief={brief}
          hat={look.hat}
          chain={look.chain}
          house={look.house}
          collar={look.collar}
          onClose={() => setOpen(false)}
          onOpenAdd={(note) => {
            setOpen(false);
            onOpenAdd(note);
          }}
        />
      )}
    </>
  );
}

function HerculesChat({
  household,
  today,
  tab,
  brief,
  hat,
  chain,
  house,
  collar,
  onClose,
  onOpenAdd,
}: {
  household: Household;
  today: string;
  tab: HearthTab;
  brief: string;
  hat: string | null;
  chain: string | null;
  house: string | null;
  collar: string | null;
  onClose: () => void;
  onOpenAdd: (note?: string) => void;
}) {
  const view = describeCompanion(household, today);
  const [question, setQuestion] = useState("");
  const [log, setLog] = useState<{ you: string; sentence: string; rows: { label: string; value: string }[] }[]>(() => [
    { you: "", sentence: brief, rows: [] },
  ]);

  function ask(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const answer = askHercules(household, text, today);
    setLog((current) => [...current, { you: text, sentence: answer.sentence, rows: answer.rows }].slice(-10));
    setQuestion("");
  }

  return (
    <div className="hercules-sheet" role="dialog" aria-label={`${view.name} chat`}>
      <div className="hercules-sheet-card">
        <header>
          <div className="hercules-sheet-who">
            <HerculesPortrait
              mood={view.mood}
              hat={hat}
              chain={chain}
              house={house}
              collar={collar}
              size="dock"
            />
            <div>
              <p className="kicker">Maine Coon · data scientist</p>
              <h2>{view.name}</h2>
              <p className="muted">{view.reason}</p>
            </div>
          </div>
          <button className="chip" type="button" onClick={onClose}>Close</button>
        </header>
        <p className="muted">He follows every page. He never posts money. Tab: {tab}.</p>
        <div className="chips">
          {HERCULES_CHIPS.map((item) => (
            <button key={item} className="chip" type="button" onClick={() => ask(item)}>{item}</button>
          ))}
          <button className="chip selected" type="button" onClick={() => onOpenAdd("Milk")}>Post milk</button>
        </div>
        <div className="ask-log hercules-log">
          {log.map((item, index) => (
            <div key={`${item.you}-${index}`}>
              {item.you ? <div className="ask-bubble you">{item.you}</div> : null}
              <div className="ask-bubble">
                <p style={{ margin: 0 }}>{item.sentence}</p>
                {item.rows.map((row) => (
                  <div className="row" key={row.label}><span>{row.label}</span><span>{row.value}</span></div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <label htmlFor="hercules-ask">Ask {view.name}</label>
        <input
          id="hercules-ask"
          value={question}
          placeholder="Groceries, bills, tips, or are we alright?"
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              ask(question);
            }
          }}
        />
        <button className="primary" type="button" disabled={!question.trim()} onClick={() => ask(question)}>Ask</button>
      </div>
    </div>
  );
}

export function SundayRecapSheet({
  household,
  today,
  environment,
  onClose,
}: {
  household: Household;
  today: string;
  environment: Environment;
  onClose: () => void;
}) {
  const recap = useMemo(() => weekRecap(household, today), [household, today]);
  const view = useMemo(() => describeCompanion(household, today), [household, today]);
  const look = useMemo(() => dressedLook(household, today, false), [household, today]);
  const [seconds, setSeconds] = useState(20);
  const [paused, setPaused] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (paused) return;
    if (seconds <= 0) {
      markRecapSeen(environment, today);
      closeRef.current();
      return;
    }
    const id = window.setTimeout(() => setSeconds((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [seconds, paused, environment, today]);

  return (
    <div className="hercules-sheet recap-sheet" role="dialog" aria-label="Sunday envelope">
      <div className="hercules-sheet-card recap-card" onPointerDown={() => setPaused(true)}>
        <header>
          <div className="hercules-sheet-who">
            <HerculesPortrait
              mood={view.mood}
              hat={look.hat}
              chain={look.chain}
              house={look.house}
              collar={look.collar}
              size="dock"
            />
            <div>
              <p className="kicker">Sunday envelope · {seconds}s</p>
              <h2>Screenshot this</h2>
            </div>
          </div>
          <button
            className="chip"
            type="button"
            onClick={() => {
              markRecapSeen(environment, today);
              onClose();
            }}
          >
            Done
          </button>
        </header>
        <p>{recap.sentence}</p>
        {recap.rows.map((row) => (
          <div className="row" key={row.label}><span>{row.label}</span><strong>{row.value}</strong></div>
        ))}
        <p className="muted">Tap the card to pause the timer. This is not money.</p>
        <div className="recap-bar" aria-hidden="true"><span style={{ width: `${(seconds / 20) * 100}%` }} /></div>
      </div>
    </div>
  );
}
