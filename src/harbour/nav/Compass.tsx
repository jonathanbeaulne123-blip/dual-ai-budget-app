import { useRef, type CSSProperties, type TouchEvent as ReactTouchEvent } from "react";
import { FabSpeedDial } from "../../FabSpeedDial.tsx";
import type { FabAction, FabAddMode } from "../../core/fabActions.ts";
import type { HouseRoute } from "../../hearthside/houseRoutes.ts";
import "./harbour-nav.css";

/**
 * The compass — the bottom nav of Little Harbour: Home · Study · Kitchen · Making
 * · Together, with the same `FabSpeedDial` as the classic nav in the centre so
 * the four money verbs are byte-identical. Phone: a 3 | + | 2 grid with the +
 * exactly centred (styles.css:690-700); desktop ≥ 720: a fixed pill bottom-right
 * (houseWorld.css:64). Swipe up, or the "All tools" handle, opens the quick sheet.
 */
export type CompassDistrict = "home" | "study" | "kitchen" | "making" | "together";

export type CompassFab = {
  actions: readonly FabAction[];
  closedLabel: string;
  onOpenChange: (open: boolean) => void;
  onPick: (mode: FabAddMode) => void;
  onGo: (tab: Extract<FabAction, { kind: "go" }>["tab"]) => void;
  /** Mirrors App's `adding`: the dial stays shut while an entry sheet is open. */
  closed?: boolean;
};

export type CompassProps = {
  route: Pick<HouseRoute, "room" | "level"> & Partial<Pick<HouseRoute, "surface">>;
  onHome: () => void;
  onStudy: () => void;
  onKitchen: () => void;
  onMaking: () => void;
  onTogether: () => void;
  fab: CompassFab;
  onStatus: () => void;
  onHercules: () => void;
  onQuickSheet: () => void;
  /** App's `fabOpen`, for the `is-fab-open` class the scrim styles key on. */
  fabOpen?: boolean;
  hidden?: boolean;
};

/** Making-district surfaces: the Kiln (pottery), the wardrobe, and Hercules's cottage. */
const MAKING_SURFACES: ReadonlySet<string> = new Set(["pottery", "wardrobe", "hercules"]);

/** Pure: which district owns the current route. */
export function compassDistrict(route: CompassProps["route"]): CompassDistrict {
  if (route.surface && MAKING_SURFACES.has(route.surface)) return "making";
  // The Campfire is keyed at `making/below` for want of a free room×level slot,
  // but it stands on the shore in front of the Boathouse and it is where the
  // month closes: the compass files it under Together, where it belongs.
  if (route.room === "making" && route.level === "below") return "together";
  switch (route.room) {
    case "home": return "home";
    case "study": return "study";
    case "kitchen-table": return "kitchen";
    case "together": return "together";
    case "making": return "making";
    default: return "home";
  }
}

export const COMPASS_DISTRICTS: readonly { id: CompassDistrict; label: string; aria: string }[] = [
  { id: "home", label: "Home", aria: "Home — the Queen's Court" },
  { id: "study", label: "Study", aria: "Study — the Library and Glasshouse" },
  { id: "kitchen", label: "Kitchen", aria: "Kitchen — make a plan" },
  { id: "making", label: "Making", aria: "Making — the Kiln and Hercules's cottage" },
  { id: "together", label: "Together", aria: "Together — the Boathouse" },
];

const TARGET: CSSProperties = { minHeight: 44, minWidth: 44 };
const SWIPE_UP_PX = 40;

export function Compass(props: CompassProps) {
  const { route, fab, onQuickSheet, fabOpen = false, hidden = false } = props;
  const current = compassDistrict(route);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const go: Record<CompassDistrict, () => void> = { home: props.onHome, study: props.onStudy, kitchen: props.onKitchen, making: props.onMaking, together: props.onTogether };

  function onTouchStart(event: ReactTouchEvent) {
    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  function onTouchEnd(event: ReactTouchEvent) {
    const start = touchStart.current; touchStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
    if (dy <= -SWIPE_UP_PX && Math.abs(dx) < Math.abs(dy)) onQuickSheet();
  }

  const button = (district: CompassDistrict, label: string, aria: string) => (
    <button
      key={district}
      type="button"
      className={`compass__district compass__district--${district}${current === district ? " active" : ""}`}
      style={TARGET}
      data-compass-district={district}
      aria-label={aria}
      aria-current={current === district ? "page" : undefined}
      onClick={go[district]}
    >
      {label}
    </button>
  );

  return (
    <nav
      className={`nav compass${fabOpen ? " is-fab-open" : ""}`}
      data-ledger-nav="shared"
      data-compass={current}
      aria-label="Compass"
      hidden={hidden || undefined}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        type="button"
        className="compass__handle"
        style={TARGET}
        aria-label="All tools"
        title="All tools (swipe up or press Space)"
        onClick={onQuickSheet}
      >
        <span aria-hidden="true" className="compass__handle-bar" />
        <span className="compass__handle-text">All tools</span>
      </button>
      {COMPASS_DISTRICTS.slice(0, 3).map(({ id, label, aria }) => button(id, label, aria))}
      <FabSpeedDial
        closed={fab.closed}
        actions={fab.actions}
        closedLabel={fab.closedLabel}
        onOpenChange={fab.onOpenChange}
        onPick={fab.onPick}
        onGo={fab.onGo}
      />
      {COMPASS_DISTRICTS.slice(3).map(({ id, label, aria }) => button(id, label, aria))}
    </nav>
  );
}
