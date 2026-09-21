import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { HOUSE_PLACES, ROOM_NAMES, TARGET_NAMES, houseTargetRoute } from "../../house/navigation.ts";
import { HOUSE_LEVELS, HOUSE_ROOMS, type HouseLevel, type HouseRoom } from "../../hearthside/houseRoutes.ts";
import { HARBOUR_PLACE_NAMES, HARBOUR_ROOMS, type HarbourPlaceId } from "../flag.ts";
import type { CompassDistrict } from "./Compass.tsx";
import "./harbour-nav.css";

/**
 * The quick sheet — the reading edition's front page (W5 #2). Everything the
 * app can do, flat, one tap each:
 *
 * - **Every tool** — all of `TARGET_NAMES`, grouped by the district that owns
 *   its room. A tool whose surface belongs to no room of its own (Hercules,
 *   the dressing room) is marked, because it opens wherever you are standing.
 * - **Every place** — all fifteen room × level slots of the island, each named
 *   by the place that stands there (the Tower, the Glasshouse, the Campfire…)
 *   and by the house's own name for the slot. Every landmark on the lawn is one
 *   of these slots, so nothing on the island is more than one tap away.
 * - The space switch and the household switcher as slotted nodes, Status and
 *   Hercules, and the "Illustrated / Reading edition" toggle.
 *
 * **Keyboard.** Space (on the stage) opens; Escape closes and returns focus to
 * the opener; Tab and Shift-Tab rove and wrap inside the sheet; the arrow keys
 * rove too, Home and End jump to the ends, and Enter goes — so the sheet is
 * usable with one thumb, one finger or no hands at all.
 *
 * Nothing here is illustrated, so it works exactly the same when the world is
 * in the reading edition or could not be drawn at all: a broken bridge never
 * gates a money task.
 */
export const MOTION_KEY = "hearth:motion";
export type MotionEdition = "illustrated" | "flat";

export type QuickSheetProps = {
  open: boolean;
  onClose: () => void;
  /** One of `TARGET_NAMES`' ids → `openHouseObject(id)`. */
  onOpen: (id: string) => void;
  /**
   * Walk to a room × level of the island. When it is not given, the row raises
   * `HARBOUR_GO_EVENT` instead and the harbour shell — mounted for every
   * household route — does the walking, so the App needs no second navigator.
   */
  onGo?: (room: HouseRoom, level: HouseLevel) => void;
  /** The place standing right now, so its row reads as current. */
  currentPlace?: { room: HouseRoom; level: HouseLevel } | null;
  onStatus: () => void;
  onHercules: () => void;
  /** The space switch (`changeHouseView`) and the household `<details>` switcher, rendered as given. */
  spaceSwitch?: ReactNode;
  householdSwitcher?: ReactNode;
  /** The surface currently open, if any, so its row reads as current. */
  current?: string | null;
  /** Where focus returns on close; defaults to the element focused when the sheet opened. */
  returnFocusTo?: HTMLElement | null;
  /** Injected storage (tests); defaults to `window.localStorage`. */
  storage?: Pick<Storage, "getItem" | "setItem">;
  onEditionChange?: (edition: MotionEdition) => void;
};

export type QuickSheetGroup = { district: CompassDistrict; title: string; tools: { id: string; name: string }[] };
/** One room × level slot of the island: which place stands there, and what the house calls the slot. */
export type QuickSheetPlace = { key: string; room: HouseRoom; level: HouseLevel; place: HarbourPlaceId | null; name: string; words: string; aria: string };

/**
 * The event a place row raises when the sheet was given no `onGo`. The App
 * owns the router; the harbour shell is mounted for every household route and
 * listens for this, so the sheet can walk you to a place without the App
 * having to hand it a second navigator. It carries a route, never a write.
 */
export const HARBOUR_GO_EVENT = "hearth:harbour-go";

const LEVEL_ORDER: readonly HouseLevel[] = HOUSE_LEVELS;
const titleCase = (words: string) => `${words[0]!.toUpperCase()}${words.slice(1)}`;

/**
 * Pure: every room × level slot of the house, in reading order, named by the
 * place that stands there. A slot the harbour does not own keeps the house's
 * own name for it, so the list is total whatever the island has built so far.
 */
export function quickSheetPlaces(): QuickSheetPlace[] {
  const rows: QuickSheetPlace[] = [];
  for (const room of HOUSE_ROOMS) {
    for (const level of LEVEL_ORDER) {
      const place = HARBOUR_ROOMS[room]?.[level] ?? null;
      const slot = HOUSE_PLACES[room][level];
      const name = place ? titleCase(HARBOUR_PLACE_NAMES[place]) : slot.title;
      rows.push({
        key: `${room}:${level}`,
        room,
        level,
        place,
        name,
        words: `${ROOM_NAMES[room]} · ${slot.title}`,
        // The island has renamed some of the house's slots — the Campfire
        // stands where the house said "the cabinet of wonders" — so the row
        // read aloud says the room, the level **and** the house's own name
        // for it, and nobody has to guess which place they are walking to.
        aria: `${name}. ${ROOM_NAMES[room]}, ${level}${slot.title === name ? "" : ` — the house calls this place ${slot.title}`}. Walk there.`,
      });
    }
  }
  return rows;
}

/**
 * Pure: the tools whose surface has no room of its own — they open wherever
 * you are standing. Found by asking the router twice from two different
 * rooms: a tool with a room of its own answers the same both times.
 */
export function quickSheetRoomless(): string[] {
  const here = { room: "home", level: "middle", householdId: "probe" } as const;
  const there = { room: "together", level: "below", householdId: "probe" } as const;
  return Object.keys(TARGET_NAMES).filter((id) => {
    const a = houseTargetRoute(here, id), b = houseTargetRoute(there, id);
    return a.room !== b.room || a.level !== b.level;
  });
}

const DISTRICT_TITLES: Record<CompassDistrict, string> = { home: "Home — the Court", study: "Study", kitchen: "Kitchen", making: "Making", together: "Together — the Boathouse" };
const DISTRICT_ORDER: readonly CompassDistrict[] = ["home", "study", "kitchen", "making", "together"];
const MAKING_TOOLS: ReadonlySet<string> = new Set(["pottery", "hercules", "wardrobe"]);

/** Pure: every `TARGET_NAMES` tool exactly once, grouped by the district that owns its room. */
export function quickSheetGroups(): QuickSheetGroup[] {
  const groups: Record<CompassDistrict, { id: string; name: string }[]> = { home: [], study: [], kitchen: [], making: [], together: [] };
  const probe = { room: "home", level: "middle", householdId: "probe" } as const;
  for (const [id, name] of Object.entries(TARGET_NAMES)) {
    if (MAKING_TOOLS.has(id)) { groups.making.push({ id, name }); continue; }
    const room = houseTargetRoute(probe, id).room;
    const district: CompassDistrict = room === "study" ? "study" : room === "kitchen-table" ? "kitchen" : room === "together" ? "together" : room === "making" ? "making" : "home";
    groups[district].push({ id, name });
  }
  return DISTRICT_ORDER.map((district) => ({ district, title: DISTRICT_TITLES[district], tools: groups[district] })).filter((group) => group.tools.length > 0);
}

function readStorage(storage: Pick<Storage, "getItem"> | undefined): MotionEdition {
  try { return (storage ?? window.localStorage).getItem(MOTION_KEY) === "flat" ? "flat" : "illustrated"; } catch { return "illustrated"; }
}
function writeStorage(storage: Pick<Storage, "setItem"> | undefined, edition: MotionEdition): void {
  try { (storage ?? window.localStorage).setItem(MOTION_KEY, edition === "flat" ? "flat" : ""); } catch { /* Preferences are a convenience; the sheet still works without storage. */ }
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
const TARGET: CSSProperties = { minHeight: 44 };

export function QuickSheet(props: QuickSheetProps) {
  const { open, onClose, onOpen, current = null } = props;
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [edition, setEdition] = useState<MotionEdition>(() => readStorage(props.storage));
  const groups = quickSheetGroups();
  const places = quickSheetPlaces();
  const roomless = new Set(quickSheetRoomless());
  const here = props.currentPlace ?? null;

  // Capture the opener and move focus in; return it on close.
  useEffect(() => {
    if (!open) return;
    openerRef.current = props.returnFocusTo ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const first = sheetRef.current?.querySelector<HTMLElement>("[data-quick-sheet-first]") ?? null;
    (first ?? sheetRef.current)?.focus();
    return () => { openerRef.current?.focus(); };
  }, [open, props.returnFocusTo]);

  useEffect(() => { if (open) setEdition(readStorage(props.storage)); }, [open, props.storage]);

  if (!open) return null;

  const ARROWS: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); onClose(); return; }
    if (!sheetRef.current) return;
    const arrow = ARROWS[event.key];
    const ends = event.key === "Home" ? 0 : event.key === "End" ? 1 : null;
    if (event.key !== "Tab" && arrow === undefined && ends === null) return;
    const items = [...sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((node) => !node.hidden);
    if (items.length === 0) return;
    const first = items[0]!, last = items[items.length - 1]!;
    const active = document.activeElement;
    if (ends !== null) { event.preventDefault(); (ends === 0 ? first : last).focus(); return; }
    if (arrow !== undefined) {
      // The sheet is one long list however it is laid out: down and right step
      // forward, up and left step back, and both ends wrap.
      event.preventDefault();
      const at = items.findIndex((node) => node === active);
      const next = at < 0 ? (arrow > 0 ? first : last) : items[(at + arrow + items.length) % items.length]!;
      next.focus();
      return;
    }
    if (event.shiftKey && (active === first || active === sheetRef.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  }

  /** Walk to a place: the App's own navigator when it gave one, else the shell's event. */
  function go(row: QuickSheetPlace) {
    if (props.onGo) { props.onGo(row.room, row.level); return; }
    try { window.dispatchEvent(new CustomEvent(HARBOUR_GO_EVENT, { detail: { room: row.room, level: row.level } })); }
    catch { /* jsdom without CustomEvent still closes the sheet. */ }
  }

  function toggleEdition() {
    const next: MotionEdition = edition === "flat" ? "illustrated" : "flat";
    setEdition(next);
    writeStorage(props.storage, next);
    props.onEditionChange?.(next);
    try { window.dispatchEvent(new CustomEvent("hearth:motion", { detail: next })); } catch { /* jsdom without CustomEvent is still fine. */ }
  }

  return (
    <div className="quick-sheet" data-quick-sheet="open">
      <button type="button" className="quick-sheet__scrim" tabIndex={-1} aria-label="Close all tools" onClick={onClose} />
      <div
        ref={sheetRef}
        className="quick-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="quick-sheet__head">
          <h2 id={titleId}>All tools</h2>
          <button type="button" className="quick-sheet__close" style={{ minHeight: 44, minWidth: 44 }} aria-label="Close all tools" onClick={onClose} data-quick-sheet-first="">×</button>
        </header>
        {(props.spaceSwitch || props.householdSwitcher) && (
          <div className="quick-sheet__space">
            {props.spaceSwitch}
            {props.householdSwitcher}
          </div>
        )}
        {groups.map((group) => (
          <section key={group.district} className="quick-sheet__group" data-quick-sheet-group={group.district} aria-labelledby={`${titleId}-${group.district}`}>
            <h3 id={`${titleId}-${group.district}`}>{group.title}</h3>
            <ul className="quick-sheet__tools">
              {group.tools.map((tool) => (
                <li key={tool.id}>
                  <button
                    type="button"
                    className="quick-sheet__tool"
                    style={TARGET}
                    data-quick-sheet-tool={tool.id}
                    data-quick-sheet-roomless={roomless.has(tool.id) ? "" : undefined}
                    aria-current={current === tool.id ? "true" : undefined}
                    onClick={() => onOpen(tool.id)}
                  >
                    {tool.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section className="quick-sheet__group quick-sheet__group--places" data-quick-sheet-places="" aria-labelledby={`${titleId}-places`}>
          <h3 id={`${titleId}-places`}>Every place on the island</h3>
          <ul className="quick-sheet__tools">
            {places.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  className="quick-sheet__place"
                  style={TARGET}
                  data-quick-sheet-place={row.key}
                  data-quick-sheet-place-id={row.place ?? undefined}
                  aria-label={row.aria}
                  aria-current={here && here.room === row.room && here.level === row.level ? "true" : undefined}
                  onClick={() => { go(row); onClose(); }}
                >
                  <span>{row.name}</span>
                  <small>{row.words}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <div className="quick-sheet__footer">
          <button type="button" className="quick-sheet__status" style={TARGET} data-quick-sheet-status="" onClick={props.onStatus}>Status</button>
          <button type="button" className="quick-sheet__hercules" style={TARGET} data-quick-sheet-hercules="" onClick={props.onHercules}>Hercules</button>
          <button
            type="button"
            role="switch"
            className="quick-sheet__edition"
            style={TARGET}
            aria-checked={edition === "flat"}
            data-quick-sheet-edition={edition}
            onClick={toggleEdition}
          >
            <span>{edition === "flat" ? "Reading edition" : "Illustrated"}</span>
            <small>{edition === "flat" ? "Every place as readable HTML" : "Tap for the reading edition"}</small>
          </button>
        </div>
      </div>
    </div>
  );
}
