import { useMemo, useState } from "react";
import {
  COSMETICS,
  chalkboardPrompts,
  dailyDare,
  describeCompanion,
  equipCosmetic,
  postingStreakDays,
  renameCompanion,
  scribbleChalk,
  wipeChalk,
  type CommitResult,
  type CompanionMood,
  type Household,
  type VisitSpark,
} from "./core/index.ts";

export function DailyHearth({
  household,
  memberId,
  today,
  spark,
  visit,
  busy,
  onCommand,
}: {
  household: Household;
  memberId: string;
  today: string;
  spark: boolean;
  visit: VisitSpark;
  busy: boolean;
  onCommand: (fn: (current: Household) => CommitResult) => void;
}) {
  const view = useMemo(() => describeCompanion(household, today), [household, today]);
  const posting = postingStreakDays(household, today);
  const prompts = chalkboardPrompts(today);
  const [draft, setDraft] = useState("");
  const [petName, setPetName] = useState(view.name);
  const memberName = household.members.find((member) => member.id === memberId)?.name ?? "You";

  return (
    <section className="daily-hearth">
      <article className={`companion-card mood-${view.mood} ${spark ? "spark" : ""}`}>
        <EmberPortrait mood={view.mood} hat={view.equipped.hat} chain={view.equipped.chain} house={view.equipped.house} />
        <div className="companion-copy">
          <p className="kicker">Kitchen companion</p>
          <h2>{view.name}</h2>
          <p>{view.line}</p>
          <p className="muted">{view.reason}</p>
          <div className="chips">
            {visit.days > 0 && <span className="chip quiet">{visit.days === 1 ? "First look today" : `${visit.days} mornings in a row`}</span>}
            {posting > 0 && <span className="chip quiet">{posting === 1 ? "Posted today" : `${posting} posting days`}</span>}
          </div>
        </div>
      </article>

      <div className="wardrobe">
        {(["hat", "chain", "house"] as const).map((slot) => (
          <div key={slot} className="wardrobe-slot">
            <span className="muted">{slot === "hat" ? "Hats" : slot === "chain" ? "Chains" : "Houses"}</span>
            <div className="chips">
              <button
                className={`chip ${view.equipped[slot] == null ? "selected" : ""}`}
                disabled={busy}
                onClick={() => onCommand((current) => equipCosmetic(current, { slot, itemId: null, today }))}
              >
                None
              </button>
              {COSMETICS.filter((item) => item.slot === slot).map((item) => {
                const unlocked = view.unlocked.some((row) => row.id === item.id);
                return (
                  <button
                    key={item.id}
                    className={`chip ${view.equipped[slot] === item.id ? "selected" : ""} ${unlocked ? "" : "locked"}`}
                    disabled={busy}
                    title={unlocked ? item.name : item.hint}
                    onClick={() => onCommand((current) => equipCosmetic(current, { slot, itemId: item.id, today }))}
                  >
                    {item.name}{unlocked ? "" : " · locked"}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <label>Rename {view.name}</label>
        <div className="rename-row">
          <input value={petName} onChange={(event) => setPetName(event.target.value)} maxLength={24} />
          <button className="chip" disabled={busy || petName.trim() === view.name} onClick={() => onCommand((current) => renameCompanion(current, petName))}>
            Save
          </button>
        </div>
      </div>

      <article className="chalkboard">
        <header>
          <h2>Chalkboard</h2>
          <span>Silly, one-off, not money</span>
        </header>
        {household.kitchen.chalkboard.length === 0 ? (
          <p className="chalk-empty">Blank slate. Dare: {dailyDare(today)}</p>
        ) : (
          household.kitchen.chalkboard.map((note) => (
            <div className="chalk-note" key={note.id}>
              <p>{note.text}</p>
              <button type="button" disabled={busy} onClick={() => onCommand((current) => wipeChalk(current, note.id))} aria-label="Wipe this note">
                wipe
              </button>
            </div>
          ))
        )}
        <div className="chips chalk-prompts">
          {prompts.map((prompt) => (
            <button key={prompt} className="chip quiet" type="button" onClick={() => setDraft(prompt)}>{prompt}</button>
          ))}
        </div>
        <label className="sr-only" htmlFor="chalk-input">Write on the chalkboard</label>
        <textarea
          id="chalk-input"
          className="chalk-input"
          rows={2}
          maxLength={80}
          placeholder={`${memberName} can scribble anything…`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          className="primary chalk-save"
          disabled={busy || !draft.trim()}
          onClick={() => {
            const text = draft;
            setDraft("");
            onCommand((current) => scribbleChalk(current, { text, author: memberId }));
          }}
        >
          Scribble
        </button>
      </article>
    </section>
  );
}

function EmberPortrait({
  mood,
  hat,
  chain,
  house,
}: {
  mood: CompanionMood;
  hat: string | null;
  chain: string | null;
  house: string | null;
}) {
  const glow = mood === "glowing" ? "#c9a227" : mood === "hiding" ? "#6b6258" : mood === "restless" ? "#c45c26" : "#2c6a4e";
  return (
    <div className={`ember-stage house-${house || "none"}`} aria-hidden="true">
      {house && <span className="ember-house">{house === "townhouse" ? "⌂⌂" : "⌂"}</span>}
      <svg viewBox="0 0 120 140" className="ember-svg">
        <defs>
          <radialGradient id="emberBody" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#f4d7a8" />
            <stop offset="70%" stopColor={glow} />
            <stop offset="100%" stopColor="#1b1712" />
          </radialGradient>
        </defs>
        <ellipse cx="60" cy="118" rx="28" ry="8" fill="rgba(27,23,18,0.18)" />
        <path d="M60 18 C86 38 96 72 60 118 C24 72 34 38 60 18 Z" fill="url(#emberBody)" />
        <circle cx="48" cy="64" r={mood === "hiding" ? 2 : 5} fill="#1b1712" />
        <circle cx="72" cy="64" r={mood === "hiding" ? 2 : 5} fill="#1b1712" />
        {mood === "glowing" && <path d="M50 82 Q60 92 70 82" fill="none" stroke="#1b1712" strokeWidth="3" />}
        {mood === "restless" && <path d="M50 86 Q60 78 70 86" fill="none" stroke="#1b1712" strokeWidth="3" />}
        {mood === "content" && <path d="M50 84 L70 84" stroke="#1b1712" strokeWidth="3" />}
        {hat === "toque" && <path d="M38 44 Q60 8 82 44 Q60 32 38 44 Z" fill="#f3eee4" stroke="#1b1712" strokeWidth="2" />}
        {hat === "visor" && <g><rect x="34" y="40" width="52" height="10" rx="4" fill="#1b1712" /><rect x="70" y="42" width="28" height="6" rx="3" fill="#c45c26" /></g>}
        {hat === "chef" && <g><ellipse cx="60" cy="28" rx="22" ry="14" fill="#fffaf2" stroke="#1b1712" strokeWidth="2" /><rect x="50" y="38" width="20" height="10" fill="#fffaf2" stroke="#1b1712" /></g>}
        {chain === "copper" && <ellipse cx="60" cy="96" rx="16" ry="8" fill="none" stroke="#c45c26" strokeWidth="3" />}
        {chain === "gold" && <ellipse cx="60" cy="96" rx="16" ry="8" fill="none" stroke="#c9a227" strokeWidth="4" />}
      </svg>
      <span className="ember-mood">{mood}</span>
    </div>
  );
}
