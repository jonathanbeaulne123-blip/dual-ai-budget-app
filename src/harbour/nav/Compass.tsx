// WRITER D REPLACES this file (BUILD_PLAN #20). Placeholder so the App seam at
// `src/App.tsx` (the `<nav className="nav">` swap) compiles: it renders the
// house navigation the App renders today, from the props the real Compass takes.
import { FabSpeedDial } from "../../FabSpeedDial.tsx";
import type { FabAction, FabAddMode } from "../../core/fabActions.ts";
import type { HouseRoute } from "../../hearthside/houseRoutes.ts";

export type CompassFab = {
  closed?: boolean;
  actions: readonly FabAction[];
  closedLabel: string;
  onOpenChange: (open: boolean) => void;
  onPick: (mode: FabAddMode) => void;
  onGo: (tab: Extract<FabAction, { kind: "go" }>["tab"]) => void;
};

export type CompassProps = {
  route: HouseRoute;
  onHome: () => void;
  onStudy: () => void;
  onKitchen: () => void;
  /** Opens the pottery studio; its secondary opens Hercules's room. */
  onMaking: () => void;
  onTogether: () => void;
  fab: CompassFab;
  onStatus: () => void;
  onHercules: () => void;
  onQuickSheet?: () => void;
  fabOpen?: boolean;
};

export function Compass({ route, onHome, onStudy, onKitchen, onMaking, onTogether, fab, onStatus, onHercules, fabOpen = false }: CompassProps) {
  const rooms: Array<{ id: HouseRoute["room"] | "making"; label: string; go: () => void }> = [
    { id: "home", label: "Home", go: onHome },
    { id: "study", label: "Study", go: onStudy },
    { id: "kitchen-table", label: "Kitchen", go: onKitchen },
    { id: "making", label: "Making", go: onMaking },
    { id: "together", label: "Together", go: onTogether },
  ];
  return <nav className={`nav harbour-compass${fabOpen ? " is-fab-open" : ""}`} data-ledger-nav="shared" data-house-navigation aria-label="Compass">
    <button type="button" className="house-companion-door" onClick={onHercules}>Hercules</button>
    {rooms.map(room => <button key={room.id} type="button" className={`house-nav-phone house-nav-phone--${room.id}`} aria-current={room.id !== "making" && route.room === room.id && !route.surface ? "page" : undefined} onClick={room.go}>{room.label}</button>)}
    <FabSpeedDial closed={fab.closed} actions={fab.actions} closedLabel={fab.closedLabel} onOpenChange={fab.onOpenChange} onPick={fab.onPick} onGo={fab.onGo} />
    <button type="button" onClick={onStatus}>Status</button>
  </nav>;
}
