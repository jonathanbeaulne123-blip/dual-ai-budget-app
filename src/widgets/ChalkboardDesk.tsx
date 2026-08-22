import { useState } from "react";
import {
  BOARD_EMPTY,
  COSMETICS,
  chalkboardPrompts,
  dailyDare,
  describeCompanion,
  equipCosmetic,
  forgetHerculesMemory,
  groceryHighFive,
  renameCompanion,
  scribbleChalk,
  wipeChalk,
  wipeHerculesChat,
  writeClinkOn,
  type CommitResult,
  type Environment,
  type Household,
} from "../core/index.ts";

const SLOTS = [
  { id: "hat" as const, label: "Hats" },
  { id: "chain" as const, label: "Chains" },
  { id: "collar" as const, label: "Collars" },
  { id: "house" as const, label: "Houses" },
];

export function chalkboardGlance(household: Household): string {
  const notes = household.kitchen.chalkboard;
  if (!notes.length) return "chalk";
  return notes.slice(-2).map((note) => note.text).join(" · ");
}

export function ChalkboardBody({
  household,
  memberId,
  today,
  busy,
  environment,
  clinkOn,
  onClinkOn,
  onCommand,
  onBuyNote,
}: {
  household: Household;
  memberId: string;
  today: string;
  busy: boolean;
  environment: Environment;
  clinkOn: boolean;
  onClinkOn: (on: boolean) => void;
  onCommand: (fn: (current: Household) => CommitResult) => void;
  onBuyNote: (text: string) => void;
}) {
  const view = describeCompanion(household, today);
  const prompts = chalkboardPrompts(today);
  const highFive = groceryHighFive(household, today);
  const [draft, setDraft] = useState("");
  const [petName, setPetName] = useState(view.name);
  const memberName = household.members.find((member) => member.id === memberId)?.name ?? "You";
  const notes = household.kitchen.chalkboard;

  return (
    <div>
      {notes.length === 0 ? (
        <p className="muted">{BOARD_EMPTY} Dare: {dailyDare(today)}</p>
      ) : (
        notes.map((note) => (
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
      <label className="sr-only" htmlFor="office-chalk">Write on the chalkboard</label>
      <textarea
        id="office-chalk"
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
      <details className="wardrobe">
        <summary>Hercules’s things</summary>
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
        <div className="hercules-notes">
          <span className="muted">Kitchen ledger notes</span>
          {(household.kitchen.hercules?.memories ?? []).length === 0 ? (
            <p className="muted">Say “remember …” to Hercules. Notes stay in this snapshot — same door as the milk.</p>
          ) : (
            (household.kitchen.hercules?.memories ?? []).map((row) => (
              <div className="chalk-note" key={row.id}>
                <p>{row.label}</p>
                <div className="chalk-actions">
                  <button type="button" disabled={busy} onClick={() => onCommand((current) => forgetHerculesMemory(current, row.id))}>
                    forget
                  </button>
                </div>
              </div>
            ))
          )}
          {(household.kitchen.hercules?.chats ?? []).length > 0 && (
            <button className="chip quiet" type="button" disabled={busy} onClick={() => onCommand((current) => wipeHerculesChat(current))}>
              Wipe chat ({household.kitchen.hercules.chats.length})
            </button>
          )}
        </div>
        <label className="clink-row">
          <input
            type="checkbox"
            checked={clinkOn}
            onChange={(event) => {
              writeClinkOn(environment, event.currentTarget.checked);
              onClinkOn(event.currentTarget.checked);
            }}
          />
          Tiny clink on save (off unless you tick this)
        </label>
      </details>
    </div>
  );
}
