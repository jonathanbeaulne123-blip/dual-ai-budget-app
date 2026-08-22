import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  chatHercules,
  describeCompanion,
  groceryHighFive,
  herculesBriefing,
  herculesIdle,
  herculesMutters,
  herculesNeedsCheck,
  kitchenSeason,
  talkHercules,
  type CompanionMood,
  type HearthTab,
  type HerculesChatTurn,
  type HerculesPose,
  type HerculesTalk,
  type Household,
} from "./core/index.ts";

const CAT = 96;
const NAV = 76;

function dressedLook(household: Household, today: string, visorPop: boolean) {
  const view = describeCompanion(household, today);
  const season = kitchenSeason(today);
  return {
    view,
    hat: visorPop ? "visor" : view.equipped.hat || (season === "ruff" ? "ruff" : null),
    house: view.equipped.house || (season === "patio" ? "patio" : null),
    chain: view.equipped.chain,
    collar: view.equipped.collar,
  };
}

function safePerch(adding: boolean, mood: CompanionMood, w: number, h: number): { x: number; y: number } {
  const pad = 6;
  const maxX = Math.max(pad, w - CAT - pad);
  const maxY = Math.max(pad, h - CAT - NAV - pad);
  const minY = adding ? pad : 52;
  if (adding) return { x: pad, y: pad };
  if (mood === "hiding") return { x: Math.random() > 0.5 ? pad : maxX, y: maxY };
  let x = pad + Math.random() * Math.max(8, maxX - pad);
  let y = minY + Math.random() * Math.max(8, maxY - minY);
  const fab = w / 2;
  if (y > h - NAV - 130 && Math.abs(x + CAT / 2 - fab) < 56) x = pad;
  return { x, y };
}

export function HerculesPortrait({
  mood,
  hat,
  chain,
  house,
  collar,
  pose = "loaf",
  size = "live",
}: {
  mood: CompanionMood;
  hat: string | null;
  chain: string | null;
  house: string | null;
  collar: string | null;
  pose?: HerculesPose;
  size?: "stage" | "live";
}) {
  const uid = useId().replace(/:/g, "");
  const fur = `fur-${uid}`;
  const ruff = `ruff-${uid}`;

  return (
    <div className={`hercules-stage size-${size} mood-${mood} pose-${pose}`} aria-hidden="true">
      <svg viewBox="0 0 160 170" className={`hercules-svg tail-${mood}`}>
        <defs>
          <linearGradient id={fur} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c4a574" />
            <stop offset="45%" stopColor="#8b5a2b" />
            <stop offset="100%" stopColor="#3c2412" />
          </linearGradient>
          <linearGradient id={ruff} x1="0" y1="0" x2="0" y2="1">
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
        <ellipse className="hercules-shadow" cx="78" cy="158" rx="36" ry="8" fill="rgba(27,23,18,0.18)" />
        <g className="hercules-body">
          <path className="hercules-tail" d="M118 108 C148 92 156 128 132 148 C150 130 142 96 118 108 Z" fill={`url(#${fur})`} />
          <ellipse cx="80" cy="118" rx="42" ry="32" fill={`url(#${fur})`} />
          <ellipse cx="80" cy="112" rx="28" ry="22" fill={`url(#${ruff})`} />
          {hat === "ruff" && <ellipse cx="80" cy="104" rx="38" ry="18" fill={`url(#${ruff})`} opacity="0.95" />}
          <path d="M48 52 L38 18 L62 44 Z" fill={`url(#${fur})`} />
          <path d="M112 52 L122 18 L98 44 Z" fill={`url(#${fur})`} />
          <path className="hercules-tuft" d="M42 22 L38 8 L52 20" stroke="#3c2412" strokeWidth="3" fill="none" />
          <path className="hercules-tuft" d="M118 22 L122 8 L108 20" stroke="#3c2412" strokeWidth="3" fill="none" />
          <ellipse cx="80" cy="72" rx="34" ry="30" fill={`url(#${fur})`} />
          <path d="M80 78 L72 92 L88 92 Z" fill="#5c3a22" />
          <circle cx="66" cy="68" r={mood === "hiding" || pose === "sleep" ? 3 : 6} fill="#1b1712" />
          <circle cx="94" cy="68" r={mood === "hiding" || pose === "sleep" ? 3 : 6} fill="#1b1712" />
          {mood !== "hiding" && pose !== "sleep" && <circle cx="64" cy="66" r="1.6" fill="#f3eee4" />}
          {mood !== "hiding" && pose !== "sleep" && <circle cx="92" cy="66" r="1.6" fill="#f3eee4" />}
          {hat === "specs" && mood !== "hiding" && pose !== "sleep" && (
            <g className="hercules-specs">
              <circle cx="66" cy="68" r="9" fill="#9fd4c8" fillOpacity="0.35" stroke="#1b1712" strokeWidth="2" />
              <circle cx="94" cy="68" r="9" fill="#9fd4c8" fillOpacity="0.35" stroke="#1b1712" strokeWidth="2" />
              <path d="M75 68 H85" stroke="#1b1712" strokeWidth="2" />
              <path d="M57 68 H48" stroke="#1b1712" strokeWidth="2" />
              <path d="M103 68 H112" stroke="#1b1712" strokeWidth="2" />
            </g>
          )}
          {(mood === "glowing" || pose === "loaf") && pose !== "sleep" && (
            <path d="M68 98 Q80 110 92 98" fill="none" stroke="#1b1712" strokeWidth="3" />
          )}
          {(mood === "restless" || pose === "pace") && (
            <path d="M68 102 Q80 92 92 102" fill="none" stroke="#1b1712" strokeWidth="3" />
          )}
          {pose === "sleep" && <path d="M70 96 L90 96" stroke="#1b1712" strokeWidth="2" />}
          {mood === "content" && pose !== "sleep" && pose !== "pace" && (
            <path d="M70 100 L90 100" stroke="#1b1712" strokeWidth="3" />
          )}
          <path d="M58 88 L48 90" stroke="#1b1712" strokeWidth="1.5" />
          <path d="M102 88 L112 90" stroke="#1b1712" strokeWidth="1.5" />
          <g className="hercules-paw">
            <ellipse cx="52" cy="142" rx="10" ry="7" fill={`url(#${fur})`} />
            <ellipse cx="108" cy="142" rx="10" ry="7" fill={`url(#${fur})`} />
          </g>
        </g>
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
        {collar === "ink" && (
          <g className="hercules-ink">
            <circle cx="118" cy="124" r="11" fill="#2c6a4e" stroke="#1b1712" strokeWidth="2" />
            <path d="M113 124 L117 128 L124 118" fill="none" stroke="#f3eee4" strokeWidth="2" />
          </g>
        )}
      </svg>
      {pose === "sleep" && <span className="hercules-zzz">z</span>}
    </div>
  );
}

export function HerculesPresence({
  household,
  today,
  tab,
  adding,
  visorPop,
  spark,
  onOpenAdd,
  onGo,
}: {
  household: Household;
  today: string;
  tab: HearthTab;
  adding: boolean;
  visorPop?: boolean;
  spark?: boolean;
  onOpenAdd: (note?: string) => void;
  onGo: (tab: HearthTab) => void;
}) {
  const look = useMemo(() => dressedLook(household, today, Boolean(visorPop)), [household, today, visorPop]);
  const five = useMemo(() => groceryHighFive(household, today), [household, today]);
  const attention = useMemo(() => herculesNeedsCheck(household, today), [household, today]);
  const mutters = useMemo(() => herculesMutters(household, today), [household, today]);
  const [pos, setPos] = useState({ x: 12, y: 120 });
  const [flip, setFlip] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [motion, setMotion] = useState<HerculesPose>("loaf");
  const [talk, setTalk] = useState<HerculesTalk | null>(null);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [topic, setTopic] = useState("idle");
  const [purr, setPurr] = useState(false);
  const [turns, setTurns] = useState<HerculesChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const idleAt = useRef(0);
  const mutterAt = useRef(0);
  const chatGen = useRef(0);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const { innerWidth: w, innerHeight: h } = window;
    const next = safePerch(adding, look.view.mood, w, h);
    setFlip(next.x < pos.x);
    setPos(next);
    setMotion(adding ? "sleep" : five.yes || spark ? "jump" : "walk");
    const land = window.setTimeout(() => setMotion(five.yes || spark ? "celebrate" : look.view.mood === "hiding" ? "hide" : look.view.mood === "restless" ? "pace" : "loaf"), 900);
    return () => window.clearTimeout(land);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hop on room change, not every pos tick
  }, [tab, adding, look.view.mood, five.yes, spark]);

  useEffect(() => {
    if (visorPop) {
      setMotion("jump");
      const id = window.setTimeout(() => setMotion("celebrate"), 700);
      return () => window.clearTimeout(id);
    }
  }, [visorPop]);

  useEffect(() => {
    if (open || pinned || adding || drag.current) return;
    const id = window.setInterval(() => {
      idleAt.current += 1;
      const phase = idleAt.current % 6;
      if (look.view.mood === "restless") {
        setMotion("pace");
        const { innerWidth: w, innerHeight: h } = window;
        const next = safePerch(false, look.view.mood, w, h);
        setFlip(next.x < pos.x);
        setPos(next);
        return;
      }
      if (look.view.mood === "hiding") {
        setMotion("hide");
        return;
      }
      if (phase === 0 || phase === 3) {
        setMotion("walk");
        const { innerWidth: w, innerHeight: h } = window;
        const next = safePerch(false, look.view.mood, w, h);
        setFlip(next.x < pos.x);
        setPos(next);
        window.setTimeout(() => setMotion(look.view.mood === "glowing" ? "loaf" : "stretch"), 950);
      } else if (phase === 1) setMotion("wash");
      else if (phase === 2) setMotion("stretch");
      else if (phase >= 4 && look.view.mood === "glowing") setMotion("sleep");
      else setMotion("loaf");
    }, 9000);
    return () => window.clearInterval(id);
  }, [open, pinned, adding, look.view.mood, pos.x]);

  useEffect(() => {
    if (adding || open || !mutters) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      if (now - mutterAt.current < 45000) return;
      mutterAt.current = now;
      const idle = herculesIdle(household, tab, today);
      setTalk(idle);
      setTopic(idle.topic);
      setMotion(idle.pose);
      window.setTimeout(() => setTalk((current) => (current === idle ? null : current)), 5000);
    }, 16000);
    return () => window.clearInterval(id);
  }, [adding, open, mutters, household, tab, today]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [turns, busy]);

  function closeChat() {
    chatGen.current += 1;
    setOpen(false);
    setTalk(null);
    setTurns([]);
    setBusy(false);
    setQuestion("");
  }

  function applyTalk(next: HerculesTalk, userText?: string) {
    setTalk(next);
    setTopic(next.topic);
    setMotion(next.pose === "sleep" ? "loaf" : next.pose);
    setQuestion("");
    setOpen(true);
    setTurns((prev) => {
      if (!userText && !prev.some((turn) => turn.role === "user")) {
        return [{ role: "hercules", text: next.spoken }];
      }
      const add: HerculesChatTurn[] = [];
      if (userText) add.push({ role: "user", text: userText });
      add.push({ role: "hercules", text: next.spoken });
      return [...prev, ...add].slice(-12);
    });
  }

  function goShortcut(raw: string): boolean {
    const text = raw.trim();
    if (/^milk$|^post milk$/i.test(text)) {
      closeChat();
      onOpenAdd("Milk");
      return true;
    }
    if (/^calendar$|^which bill/i.test(text)) {
      closeChat();
      onGo("calendar");
      return true;
    }
    if (/^health$|^what broke/i.test(text)) {
      closeChat();
      onGo("more");
      return true;
    }
    if (/^sit-down/i.test(text)) {
      closeChat();
      onGo("plan");
      return true;
    }
    return false;
  }

  function speak(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    if (goShortcut(text)) return;
    applyTalk(talkHercules(household, text, today, adding ? "add" : tab, topic), text);
  }

  async function sendChat(raw: string) {
    const message = raw.trim();
    if (!message || busy) return;
    if (goShortcut(message)) return;
    const page = adding ? "add" : tab;
    const grounded = talkHercules(household, message, today, page, topic);
    const briefing = herculesBriefing(household, page, today);
    const gen = chatGen.current + 1;
    chatGen.current = gen;
    const history = turns;
    setTurns((prev) => [...prev, { role: "user" as const, text: message }].slice(-12));
    setQuestion("");
    setBusy(true);
    setOpen(true);
    setTalk(grounded);
    setTopic(grounded.topic);
    setMotion("pounce");
    const result = await chatHercules({ message, briefing, grounded, history });
    if (chatGen.current !== gen) return;
    setTalk({ ...grounded, spoken: result.text });
    setTurns((prev) => [...prev, { role: "hercules" as const, text: result.text }].slice(-12));
    setMotion(grounded.pose === "sleep" ? "loaf" : grounded.pose);
    setBusy(false);
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: pos.x, y: pos.y, px: event.clientX, py: event.clientY, moved: false };
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.px;
    const dy = event.clientY - start.py;
    if (Math.abs(dx) + Math.abs(dy) > 8) start.moved = true;
    if (!start.moved) return;
    setPinned(true);
    setMotion("walk");
    setFlip(dx < 0);
    const w = window.innerWidth;
    const h = window.innerHeight;
    setPos({
      x: Math.min(w - CAT - 4, Math.max(4, start.x + dx)),
      y: Math.min(h - CAT - NAV, Math.max(4, start.y + dy)),
    });
  }

  function onPointerUp() {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    if (!start.moved) {
      setPurr(true);
      if (open && turns.some((turn) => turn.role === "user")) {
        setMotion("loaf");
        return;
      }
      applyTalk(talkHercules(household, open ? "scratch" : "", today, adding ? "add" : tab, topic));
    } else {
      setMotion(look.view.mood === "restless" ? "pace" : "loaf");
    }
  }

  const pose = visorPop ? "jump" : motion;
  const bubbleLeft = pos.x > window.innerWidth / 2;
  const size = adding ? 72 : CAT;

  return (
    <div className="hercules-world" aria-live="polite">
      {(open || talk) && !adding && talk && (
        <div
          className={`hercules-bubble ${bubbleLeft ? "left" : "right"} ${open ? "chat" : ""}`}
          style={{
            left: bubbleLeft ? undefined : pos.x + size - 8,
            right: bubbleLeft ? window.innerWidth - pos.x - 8 : undefined,
            top: Math.max(8, pos.y - 8),
            transform: bubbleLeft ? "translate(-100%, -90%)" : "translate(0, -90%)",
          }}
        >
          {open && turns.length > 0 ? (
            <div className="hercules-chat-log" ref={logRef}>
              {turns.slice(-6).map((turn, index) => (
                <p key={`${turn.role}-${index}-${turn.text.slice(0, 12)}`} className={`hercules-turn ${turn.role === "user" ? "you" : "cat"}`}>
                  {turn.text}
                </p>
              ))}
              {busy && <p className="hercules-typing">mrrp…</p>}
            </div>
          ) : (
            <p className="hercules-spoken">{talk.spoken}</p>
          )}
          {!busy && talk.lesson && <p className="hercules-lesson">{talk.lesson}</p>}
          {!busy && talk.fact && (
            <p className="hercules-fact"><span>{talk.fact.label}</span> {talk.fact.value}</p>
          )}
          {open && (
            <>
              {!busy && (
                <div className="hercules-replies">
                  {talk.replies.map((item) => (
                    <button key={item} type="button" onClick={() => speak(item)}>{item}</button>
                  ))}
                </div>
              )}
              <form
                className="hercules-chat-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendChat(question);
                }}
              >
                <input
                  aria-label={`Ask ${look.view.name}`}
                  value={question}
                  placeholder={busy ? "mrrp…" : "ask Hercules…"}
                  disabled={busy}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") closeChat();
                  }}
                />
                <button type="submit" disabled={busy || !question.trim()}>send</button>
              </form>
            </>
          )}
          <button className="hercules-dismiss" type="button" onClick={closeChat}>
            ok
          </button>
        </div>
      )}
      <button
        type="button"
        className={[
          "hercules-live",
          `mood-${look.view.mood}`,
          `pose-${pose}`,
          flip ? "flip" : "",
          purr ? "purr" : "",
          five.yes ? "high-five" : "",
          attention ? "needs-you" : "",
          adding ? "loafing" : "",
          pinned ? "pinned" : "",
        ].join(" ")}
        style={{ left: pos.x, top: pos.y, width: size, height: size }}
        aria-label={attention ? `${look.view.name} wants a check-in` : `Talk to ${look.view.name}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; }}
        onAnimationEnd={() => setPurr(false)}
        onContextMenu={(event) => {
          event.preventDefault();
          setPinned((value) => !value);
        }}
      >
        <HerculesPortrait
          mood={look.view.mood}
          hat={look.hat}
          chain={look.chain}
          house={look.house}
          collar={look.collar}
          pose={pose}
        />
      </button>
    </div>
  );
}

/** @deprecated presence is the product; kept so Home wardrobe can still show a still */
export function HerculesDock(props: Parameters<typeof HerculesPresence>[0]) {
  return <HerculesPresence {...props} />;
}
