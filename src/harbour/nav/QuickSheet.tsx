import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { TARGET_NAMES, houseTargetRoute } from "../../house/navigation.ts";
import type { CompassDistrict } from "./Compass.tsx";
import "./harbour-nav.css";

/**
 * The quick sheet — the reading edition's front page. A flat list of every tool
 * (the 16 `TARGET_NAMES`) grouped by district, one tap each; the space switch and
 * the household switcher as slotted nodes; Status and Hercules; and the
 * "Illustrated / Reading edition" toggle. Focus is trapped while open, Escape
 * closes and returns focus to the opener. Space on the stage opens it — the shell
 * wires that.
 */
export const MOTION_KEY = "hearth:motion";
export type MotionEdition = "illustrated" | "flat";

export type QuickSheetProps = {
  open: boolean;
  onClose: () => void;
  /** One of `TARGET_NAMES`' ids → `openHouseObject(id)`. */
  onOpen: (id: string) => void;
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

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab" || !sheetRef.current) return;
    const items = [...sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((node) => !node.hidden);
    if (items.length === 0) return;
    const first = items[0]!, last = items[items.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === sheetRef.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
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
