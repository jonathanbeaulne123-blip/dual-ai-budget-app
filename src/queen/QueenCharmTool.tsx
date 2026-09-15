import { useId, type CSSProperties, type KeyboardEvent } from "react";
import { QUEEN_CHARM_LIMITS, type QueenCharmEarning, type QueenCharmKind, type QueenCharmV1 } from "../core/queenCharms.ts";
import { STUDIO_PALETTE } from "../kitty/studio/palette.ts";
import { QueenCharmIcon } from "./QueenCharmGlyph.tsx";
import { queenCharmDu, queenCharmNudge, type QueenForm } from "./world/queenCharmSurface.ts";

/**
 * The bin and the bench: real DOM controls for pressing charms onto her,
 * moving them, turning them, sizing them, recolouring them and taking them
 * off — all without a pointer. Pressing a charm from the bin seats it at once
 * on a free spot and selects it; a pointer can then press it somewhere else
 * on her, and the arrow keys can walk it. Nothing here says no: a seat a
 * charm cannot take is simply not where it ends up.
 */
export type QueenCharmToolProps = {
  earnings: readonly QueenCharmEarning[];
  charms: readonly QueenCharmV1[];
  selectedId: string | null;
  members: readonly { id: string; name: string }[];
  busy: boolean;
  keptLine: string;
  /** Her form, so a walked charm settles off a ring. */
  form?: QueenForm;
  onAdd: (kind: QueenCharmKind) => void;
  onSelect: (id: string | null) => void;
  onChange: (charm: QueenCharmV1) => void;
  onRemove: (id: string) => void;
  /** Changes are held on this device until Done (or until she is put down). */
  dirty?: boolean;
  onDone?: () => void;
};

const NUDGE = 0.06;
const SPIN_STEP = 30;
const SCALE_STEP = 0.2;

/** Where a charm sits, in words a screen reader can place. Left is the room's left, as the doors are. */
export function queenCharmSeatWords(charm: Pick<QueenCharmV1, "part" | "u" | "v">): string {
  const du = queenCharmDu(charm.part, charm.u);
  const side = du < -0.02 ? "left" : du > 0.02 ? "right" : "front";
  if (charm.part === "head") return Math.abs(du) < 0.14 && charm.v < 0.3 ? "her chin" : `her ${side === "front" ? "left" : side} cheek`;
  if (charm.v > 0.66) return side === "front" ? "her chest" : `her ${side} shoulder`;
  if (charm.v < 0.3) return `the hem, ${side}`;
  return side === "front" ? "her belly" : `her ${side} flank`;
}

export function QueenCharmTool({ earnings, charms, selectedId, members, busy, keptLine, form, onAdd, onSelect, onChange, onRemove, dirty = false, onDone }: QueenCharmToolProps) {
  const ids = useId();
  const full = charms.length >= QUEEN_CHARM_LIMITS.count;
  const selected = charms.find((charm) => charm.id === selectedId) ?? null;
  const name = (id: string | undefined) => (id ? members.find((row) => row.id === id)?.name ?? "one of you" : null);
  const onMoveKeys = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!selected) return;
    const step: Record<string, [number, number]> = { ArrowLeft: [-NUDGE, 0], ArrowRight: [NUDGE, 0], ArrowUp: [0, NUDGE], ArrowDown: [0, -NUDGE] };
    const delta = step[event.key];
    if (!delta) return;
    event.preventDefault();
    onChange({ ...selected, ...queenCharmNudge(selected, delta[0], delta[1], form) });
  };
  return (
    <section className="queen-charms-tool" aria-labelledby={`${ids}-title`}>
      <p id={`${ids}-title`} className="queen-eyebrow">Her charms</p>
      <p className="queen-panel__muted">{keptLine} Small things pressed on where you choose; she keeps her vine, crown, face, hands, seams and hem for what they say.</p>
      <div className="queen-charm-bin" role="group" aria-label={`The bin${full ? " — she is wearing all she can" : ""}`}>
        {earnings.map((row) => (
          <button key={row.kind} type="button" className={`queen-charm-pick${row.earned ? "" : " is-unearned"}`}
            aria-disabled={!row.earned || full || busy ? "true" : undefined}
            aria-label={`${row.label}${row.earnedBy ? ` — ${row.earned ? "earned by" : "not yet: earned by"} ${row.earnedBy}` : ""}${row.earned && full ? "; no room left" : ""}`}
            onClick={() => { if (row.earned && !full && !busy) onAdd(row.kind); }}>
            <QueenCharmIcon kind={row.kind} color={row.earned ? "#d9cfbd" : "#eeeae3"} />
            <span className="queen-charm-pick__label">{row.short}</span>
          </button>
        ))}
      </div>
      {charms.length > 0 ? (
        <ul className="queen-charm-list" aria-label="On her">
          {charms.map((charm) => {
            const entry = earnings.find((row) => row.kind === charm.kind);
            const by = name(charm.by);
            const isSelected = charm.id === selectedId;
            return (
              <li key={charm.id} className={`queen-charm-row${isSelected ? " is-selected" : ""}`}>
                <button type="button" className="queen-charm-row__pick" aria-pressed={isSelected}
                  aria-label={`${entry?.label ?? charm.kind} on ${queenCharmSeatWords(charm)}${by ? `, pressed on by ${by}` : ""}${isSelected ? "; selected, press her to move it" : ""}`}
                  onClick={() => onSelect(isSelected ? null : charm.id)}>
                  <QueenCharmIcon kind={charm.kind} color={charm.color} size={22} />
                  <span>{entry?.label ?? charm.kind} <small>on {queenCharmSeatWords(charm)}{by ? ` · ${by}` : ""}</small></span>
                </button>
                {isSelected && (
                  <div className="queen-charm-bench" role="group" aria-label={`${entry?.label ?? charm.kind}: move, turn, size, colour`}>
                    <button type="button" className="queen-pick" aria-label="Move with the arrow keys, or press her where it should go" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown" onKeyDown={onMoveKeys}>Move</button>
                    <button type="button" className="queen-pick" aria-label={`Turn, now ${charm.spin} degrees`} onClick={() => onChange({ ...charm, spin: ((charm.spin + SPIN_STEP + 180) % 360) - 180 })}>Turn</button>
                    <button type="button" className="queen-pick" aria-label="Smaller" aria-disabled={charm.scale <= QUEEN_CHARM_LIMITS.scale[0] ? "true" : undefined} onClick={() => onChange({ ...charm, scale: Math.max(QUEEN_CHARM_LIMITS.scale[0], Math.round((charm.scale - SCALE_STEP) * 100) / 100) })}>−</button>
                    <button type="button" className="queen-pick" aria-label="Bigger" aria-disabled={charm.scale >= QUEEN_CHARM_LIMITS.scale[1] ? "true" : undefined} onClick={() => onChange({ ...charm, scale: Math.min(QUEEN_CHARM_LIMITS.scale[1], Math.round((charm.scale + SCALE_STEP) * 100) / 100) })}>+</button>
                    <button type="button" className="queen-pick" aria-label={`Lean, now ${charm.tilt} degrees`} onClick={() => onChange({ ...charm, tilt: charm.tilt >= QUEEN_CHARM_LIMITS.tilt ? -QUEEN_CHARM_LIMITS.tilt : charm.tilt + 10 })}>Lean</button>
                    <span className="queen-charm-bench__colours" role="group" aria-label="Colour">
                      {STUDIO_PALETTE.map((glaze) => (
                        <button key={glaze.id} type="button" className="queen-swatch queen-swatch--small" style={{ "--swatch": glaze.hex } as CSSProperties} aria-pressed={charm.color === glaze.hex} aria-label={glaze.name} onClick={() => onChange({ ...charm, color: glaze.hex })} />
                      ))}
                    </span>
                    <button type="button" className="queen-pick queen-pick--off" onClick={() => onRemove(charm.id)}>Take off</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {onDone && (dirty || selected) && (
        <div className="queen-held">
          {dirty && <span className="queen-held__mark" role="status">Not saved yet</span>}
          <button type="button" className="queen-go queen-go--primary queen-held__done" disabled={busy} onClick={onDone}>Done</button>
        </div>
      )}
      {charms.length > 0 ? null : <p className="queen-panel__muted queen-charm-empty">Nothing on her yet. Press a charm from the bin and it sits where there is room; press her to move it.</p>}
    </section>
  );
}
