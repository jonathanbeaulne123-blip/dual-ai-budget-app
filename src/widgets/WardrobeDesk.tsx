import { CompanionMemoryControls } from "../CompanionMemoryControls.tsx";
import type { KitchenCommand } from "../kitchenCommand.ts";
import { useId, useState } from "react";
import { useAppearance } from "../theme/ThemeProvider.tsx";
import { HerculesPortrait } from "../Hercules.tsx";
import {
  COSMETICS,
  describeCompanion,
  equipCosmetic,
  renameCompanion,
  writeClinkOn,
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
  onCommand, memberId, ledgerView,
}: {
  household: Household;
  today: string;
  busy: boolean;
  environment: Environment;
  clinkOn: boolean;
  onClinkOn: (on: boolean) => void;
  onCommand: KitchenCommand;
  memberId: string;
  ledgerView: "personal" | "household";
}) {
  const view = describeCompanion(household, today);
  const [petName, setPetName] = useState(view.name);
  const nameId = useId();
  const appearance = useAppearance();
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
      {appearance.scene.theme !== "classic" && <p className="muted">The theme adds accessories to empty slots. Choose None to take them off.</p>}
      {SLOTS.map((slot) => (
        <div key={slot.id} className="wardrobe-slot">
          <span className="muted">{slot.label}</span>
          <div className="chips">
            <button
              className={`chip ${view.equipped[slot.id] == null ? "selected" : ""}`}
              disabled={busy}
              onClick={() => {
                if (slot.id !== "house") appearance.store?.setAccessoryHidden(slot.id === "hat" ? "hat" : "neck", true);
                onCommand((current) => equipCosmetic(current, { slot: slot.id, itemId: null, today }));
              }}
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
      {appearance.scene.theme !== "classic" && (appearance.saved.hideThemeHat || appearance.saved.hideThemeNeck) && (
        <button type="button" className="ghost" onClick={() => {
          appearance.store?.setAccessoryHidden("hat", false);
          appearance.store?.setAccessoryHidden("neck", false);
        }}>Use theme accessories again</button>
      )}
      <label htmlFor={nameId}>Rename {view.name}</label>
      <div className="rename-row">
        <input id={nameId} value={petName} onChange={(event) => setPetName(event.target.value)} maxLength={24} />
        <button className="chip" disabled={busy || petName.trim() === view.name} onClick={() => onCommand((current) => renameCompanion(current, petName))}>
          Save
        </button>
      </div>
      <CompanionMemoryControls household={household} memberId={memberId} view={ledgerView} onCommand={onCommand} />
      {((household.kitchen.hercules?.chats?.length ?? 0) + (household.kitchen.hercules?.memories?.length ?? 0)) > 0 && <details className="companion-archive"><summary>Previously shared chat archive</summary><p>These old messages were shared with the household. They are read-only and never enter the new private conversation.</p>{household.kitchen.hercules?.chats.map(row => <p className="hercules-turn" key={row.id}>{row.role === "user" ? household.members.find(member => member.id === row.createdBy)?.name ?? "Household member" : "Hercules"}: {row.text}</p>)}{household.kitchen.hercules?.memories.map(row => <p key={row.id}>{row.label}</p>)}</details>}
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
      <p className="muted">A change of clothes, a little more ceremony. The books carry on.</p>
    </div>
  );
}
