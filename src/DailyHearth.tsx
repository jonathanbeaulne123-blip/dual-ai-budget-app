import { useMemo, useState } from "react";
import { HerculesPortrait } from "./Hercules.tsx";
import {
  COSMETICS,
  chalkboardPrompts,
  cookOffScore,
  dailyDare,
  describeCompanion,
  equipCosmetic,
  formatCad,
  groceryHighFive,
  kitchenSeason,
  postingStreakDays,
  renameCompanion,
  scribbleChalk,
  shiftForecastDisplay,
  sitDownPostcard,
  wipeChalk,
  writeClinkOn,
  type CommitResult,
  type Environment,
  type Household,
  type VisitSpark,
} from "./core/index.ts";

const SLOTS = [
  { id: "hat" as const, label: "Hats" },
  { id: "chain" as const, label: "Chains" },
  { id: "collar" as const, label: "Collars" },
  { id: "house" as const, label: "Houses" },
];

export function DailyHearth({
  household,
  memberId,
  today,
  spark,
  visit,
  busy,
  environment,
  clinkOn,
  onClinkOn,
  onCommand,
  onBuyNote,
  onOpenRecap,
}: {
  household: Household;
  memberId: string;
  today: string;
  spark: boolean;
  visit: VisitSpark;
  busy: boolean;
  environment: Environment;
  clinkOn: boolean;
  onClinkOn: (on: boolean) => void;
  onCommand: (fn: (current: Household) => CommitResult) => void;
  onBuyNote: (text: string) => void;
  onOpenRecap: () => void;
}) {
  const view = useMemo(() => describeCompanion(household, today), [household, today]);
  const posting = postingStreakDays(household, today);
  const prompts = chalkboardPrompts(today);
  const highFive = useMemo(() => groceryHighFive(household, today), [household, today]);
  const season = kitchenSeason(today);
  const cook = useMemo(() => cookOffScore(household, today), [household, today]);
  const postcard = useMemo(() => sitDownPostcard(household), [household]);
  const forecast = useMemo(() => shiftForecastDisplay(household), [household]);
  const hat = view.equipped.hat || (season === "ruff" ? "ruff" : null);
  const house = view.equipped.house || (season === "patio" ? "patio" : null);
  const [draft, setDraft] = useState("");
  const [petName, setPetName] = useState(view.name);
  const memberName = household.members.find((member) => member.id === memberId)?.name ?? "You";

  return (
    <section className="daily-hearth">
      <article className={`companion-card mood-${view.mood} ${spark || highFive.yes ? "spark" : ""}`}>
        <HerculesPortrait
          mood={view.mood}
          hat={hat}
          chain={view.equipped.chain}
          house={house}
          collar={view.equipped.collar}
        />
        <div className="companion-copy">
          <p className="kicker">The Hercules Update · Maine Coon · {season === "none" ? "shoulder season" : season}</p>
          <h2>{view.name}</h2>
          <p>{view.line}</p>
          <p className="muted">{view.reason}</p>
          <div className="chips">
            {visit.days > 0 && <span className="chip quiet">{visit.days === 1 ? "First look today" : `${visit.days} mornings in a row`}</span>}
            {posting > 0 && <span className="chip quiet">{posting === 1 ? "Posted today" : `${posting} posting days`}</span>}
            {highFive.yes && <span className="chip selected">{highFive.names.join(" + ")} grocery high-five</span>}
            <button className="chip quiet" type="button" onClick={onOpenRecap}>Screenshot recap</button>
          </div>
        </div>
      </article>

      <article className={`cook-off winner-${cook.winner}`}>
        <header>
          <h2>Weekly cook-off</h2>
          <span>Household totals. Nobody is named.</span>
        </header>
        <div className="row">
          <span>Groceries</span>
          <strong>{formatCad(cook.groceryCents)}</strong>
        </div>
        <div className="row">
          <span>Coffee & lunches</span>
          <strong>{formatCad(cook.coffeeCents)}</strong>
        </div>
        <p className="muted">{cook.sentence}</p>
      </article>

      {forecast.unlocked ? (
        <article className="forecast-card">
          <header>
            <h2>Shift pulse</h2>
            <span>Display only</span>
          </header>
          <p>{forecast.sentence}</p>
          <div className="row"><span>Avg tips / week</span><strong>{formatCad(forecast.avgTipsCents)}</strong></div>
          <div className="row"><span>Avg wages / week</span><strong>{formatCad(forecast.avgWagesCents)}</strong></div>
          <div className="row"><span>Range</span><span>{formatCad(forecast.lowCents)}–{formatCad(forecast.highCents)}</span></div>
        </article>
      ) : (
        <p className="muted forecast-lock">{forecast.sentence}</p>
      )}

      {postcard.ready && (
        <article className="postcard">
          <header>
            <h2>Sit-down postcard</h2>
            <span>{postcard.targetMonth}</span>
          </header>
          <p className="postcard-line">{postcard.text}</p>
          <p className="muted">{postcard.sentence}</p>
          <button
            className="chip"
            type="button"
            disabled={busy}
            onClick={() => onCommand((current) => scribbleChalk(current, { text: postcard.text, author: memberId }))}
          >
            Pin to chalkboard
          </button>
        </article>
      )}

      <div className="wardrobe">
        {SLOTS.map((slot) => (
          <div key={slot.id} className="wardrobe-slot">
            <span className="muted">{slot.label}</span>
            <div className="chips">
              <button
                className={`chip ${view.equipped[slot.id] == null ? "selected" : ""}`}
                disabled={busy}
                onClick={() => onCommand((current) => equipCosmetic(current, { slot: slot.id, itemId: null, today }))}
              >
                None
              </button>
              {COSMETICS.filter((item) => item.slot === slot.id).map((item) => {
                const unlocked = view.unlocked.some((row) => row.id === item.id);
                return (
                  <button
                    key={item.id}
                    className={`chip ${view.equipped[slot.id] === item.id ? "selected" : ""} ${unlocked ? "" : "locked"}`}
                    disabled={busy}
                    title={unlocked ? item.name : item.hint}
                    onClick={() => onCommand((current) => equipCosmetic(current, { slot: slot.id, itemId: item.id, today }))}
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
        <label className="clink-row">
          <input
            type="checkbox"
            checked={clinkOn}
            onChange={(event) => {
              writeClinkOn(environment, event.target.checked);
              onClinkOn(event.target.checked);
            }}
          />
          Tiny clink on save (off unless you tick this)
        </label>
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
              <div className="chalk-actions">
                <button type="button" disabled={busy} onClick={() => onBuyNote(note.text)}>bought</button>
                <button type="button" disabled={busy} onClick={() => onCommand((current) => wipeChalk(current, note.id))} aria-label="Wipe this note">
                  wipe
                </button>
              </div>
            </div>
          ))
        )}
        <div className="chips chalk-prompts">
          {prompts.map((prompt) => (
            <button key={prompt} className="chip quiet" type="button" onClick={() => setDraft(prompt)}>{prompt}</button>
          ))}
          {highFive.yes && (
            <button className="chip quiet" type="button" onClick={() => onCommand((current) => scribbleChalk(current, { text: "nice.", author: memberId }))}>
              nice.
            </button>
          )}
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
