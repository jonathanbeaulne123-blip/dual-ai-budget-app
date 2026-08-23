import { useState } from "react";
import { HerculesPortrait } from "../Hercules.tsx";
import {
  COSMETICS,
  describeCompanion,
  equipCosmetic,
  forgetHerculesMemory,
  renameCompanion,
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

export function wardrobeGlance(household: Household, today: string): string {
  const view = describeCompanion(household, today);
  const worn = [view.equipped.hat, view.equipped.chain, view.equipped.collar, view.equipped.house].filter(Boolean);
  return worn.length ? worn.join(" · ") : "bare";
}

export function WardrobeBody({
  household,
  today,
  busy,
  environment,
  clinkOn,
  onClinkOn,
  onCommand,
}: {
  household: Household;
  today: string;
  busy: boolean;
  environment: Environment;
  clinkOn: boolean;
  onClinkOn: (on: boolean) => void;
  onCommand: (fn: (current: Household) => CommitResult) => void;
}) {
  const view = describeCompanion(household, today);
  const [petName, setPetName] = useState(view.name);
  return (
    <div className="wardrobe-desk">
      <div className="wardrobe-still" aria-hidden="true">
        <HerculesPortrait
          mood={view.mood}
          hat={view.equipped.hat}
          chain={view.equipped.chain}
          house={view.equipped.house}
          collar={view.equipped.collar}
          pose="loaf"
          size="stage"
        />
      </div>
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
      <p className="muted">Hats never post. Equip is a kitchen write with empty postedIds.</p>
    </div>
  );
}