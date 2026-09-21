import type { HouseLevel, HouseRoom, HouseRoute } from "./houseRoutes.ts";
import type { HouseCondition } from "../core/houseCondition.ts";
import "./houseShell.css";

const ROOM_LABELS: Record<HouseRoom, string> = {
  home: "Home",
  study: "Study",
  "kitchen-table": "Kitchen Table",
  together: "Together",
  making: "Making",
};

const LEVEL_LABELS: Record<HouseRoom, Record<HouseLevel, { name: string; role: string }>> = {
  home: {
    above: { name: "Queen's Loft", role: "Kitty Banks and building" },
    middle: { name: "Doorway", role: "The Queen and what is happening now" },
    below: { name: "Cellar", role: "Bills and protection" },
  },
  study: {
    above: { name: "Master Planner", role: "Tasks and next moves" },
    middle: { name: "Books", role: "Focused household work" },
    below: { name: "Calendar", role: "Dates and bills" },
  },
  "kitchen-table": {
    above: { name: "Journey", role: "Our Path, shaped by the life we live" },
    middle: { name: "Work centre", role: "Hercules and work in progress" },
    below: { name: "Plan Studio", role: "The agreement room" },
  },
  together: {
    above: { name: "Conservatory", role: "Hearthside possibilities and wishes" },
    middle: { name: "Common room", role: "Our shared life" },
    below: { name: "Studio & Theatre", role: "Making, keeping, and remembering" },
  },
  making: {
    above: { name: "The Kiln", role: "Wheel, bench, and the fired shelf" },
    middle: { name: "Hercules’s Cottage", role: "His wardrobe, his glass, his shelves" },
    below: { name: "The cabinet of wonders", role: "What he keeps" },
  },
};

export function HouseShell({ route, onNavigate, condition }: { route: HouseRoute; onNavigate: (room: HouseRoom, level: HouseLevel) => void; condition?: HouseCondition | null }) {
  const active = LEVEL_LABELS[route.room][route.level];
  return <header className="house-shell" data-house-room={route.room} data-house-level={route.level} data-house-condition={condition?.state}>
    <div className="house-shell__threshold" aria-label={`${ROOM_LABELS[route.room]} · ${active.name}`}>
      <span aria-hidden="true">⌂</span><p>Hearth</p><strong>{ROOM_LABELS[route.room]}</strong><small>{active.name}</small>
    </div>
    <nav className="house-shell__rooms" aria-label="House rooms">
      {(Object.keys(ROOM_LABELS) as HouseRoom[]).map(room => <button type="button" key={room} aria-current={route.room === room ? "page" : undefined} onClick={() => onNavigate(room, room === route.room ? route.level : "middle")}>{ROOM_LABELS[room]}</button>)}
    </nav>
    <nav className="house-shell__levels" aria-label={`${ROOM_LABELS[route.room]} levels`}>
      {(["above", "middle", "below"] as HouseLevel[]).map(level => {
        const label = LEVEL_LABELS[route.room][level];
        return <button type="button" key={level} aria-current={route.level === level ? "location" : undefined} onClick={() => onNavigate(route.room, level)}>
          <span aria-hidden="true">{level === "above" ? "↑" : level === "middle" ? "•" : "↓"}</span><strong>{label.name}</strong><small>{label.role}</small>
        </button>;
      })}
    </nav>
    {condition && <p className="house-shell__condition" role="status">{condition.words}</p>}
  </header>;
}
