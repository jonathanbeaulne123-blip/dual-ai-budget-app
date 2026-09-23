import type { HarbourPlaceId } from "../flag.ts";
import type { HarbourReading } from "../data/reading.ts";
import { engravedCents, type CourtFlatProps, type CourtFlatStatus } from "./CourtFlat.tsx";
import { DoorSign } from "./DoorSign.tsx";
import "./village-flat.css";

type VillageFlatProps = Omit<CourtFlatProps, "reading"> & {
  reading: HarbourReading | null;
  onStair?: () => void;
};

type Destination = { place: HarbourPlaceId; label: string; detail: string; fallback: string };

const BUILDINGS: readonly Destination[] = [
  { place: "kitchen", label: "Home", detail: "Kitchen and rooms above and below", fallback: "plan-studio" },
  { place: "bank", label: "Fund Bank", detail: "Household books and the Queen", fallback: "queen" },
  { place: "library", label: "Library", detail: "The standing books", fallback: "books" },
  { place: "glasshouse", label: "Glasshouse", detail: "Plans and growing things", fallback: "plan-studio" },
  { place: "kiln", label: "Pottery Studio", detail: "The warm kiln", fallback: "pottery" },
  { place: "cottage", label: "Hercules Cottage", detail: "A quiet room for the cat", fallback: "hercules" },
  { place: "boathouse", label: "Boathouse", detail: "Together by the water", fallback: "together" },
];

const HOME_ROOMS: readonly Destination[] = [
  { place: "kitchen", label: "Kitchen", detail: "Ground floor", fallback: "plan-studio" },
  { place: "tower", label: "Home Loft", detail: "Kitty Banks upstairs", fallback: "loft-banks" },
  { place: "cellar", label: "Cellar", detail: "Bills below", fallback: "cellar-bills" },
  { place: "atlas", label: "Atlas nook", detail: "Maps by the bay window", fallback: "journey" },
];

const WATERFRONT: Destination = { place: "campfire", label: "Waterfront Campfire", detail: "The month-end footpath", fallback: "plan-studio" };

const statusWords = (status: CourtFlatStatus) => status === "loading" ? "The village is being laid" : status === "fallback" ? "Reading edition · the village could not be drawn" : "Reading edition";

function VillageDoor({ destination, onEnter, onOpen }: { destination: Destination; onEnter?: (place: HarbourPlaceId) => void; onOpen?: (target: string, object?: string) => void }) {
  const enter = () => onEnter ? onEnter(destination.place) : onOpen?.(destination.fallback);
  return <button type="button" className="village-flat__door" data-village-destination={destination.place} onClick={enter} aria-label={`${destination.label}. ${destination.detail}. Enter ${destination.label}.`}>
    <strong>{destination.label}</strong><span>{destination.detail}</span>
  </button>;
}

/** A compact, fully keyboard-readable map used when the Court cannot draw in WebGL. */
export function VillageFlat({ reading, status = "loading", theme = "classic", onOpen, onEnter, overlay = false }: VillageFlatProps) {
  return <section className={`court-flat place-flat village-flat court-flat--${theme}${overlay ? " court-flat--overlay" : ""}`} data-court-flat={status} data-place-flat="court" aria-label="Little Harbour village, reading edition" aria-busy={status === "loading" || undefined}>
    <div className="court-flat__sheet">
      <p className="court-flat__status" role="status">{statusWords(status)}</p>
      <DoorSign place="court" reading={reading} />
      <header className="village-flat__intro"><h1>Little Harbour</h1><p>The village square is the way into each room. Every door below works with a keyboard.</p></header>
      <nav className="village-flat__district" aria-label="Village buildings">
        <h2>Village buildings</h2><div className="village-flat__doors">{BUILDINGS.map((destination) => <VillageDoor key={destination.place} destination={destination} onEnter={onEnter} onOpen={onOpen} />)}</div>
      </nav>
      <nav className="village-flat__district" aria-label="Home rooms">
        <h2>Home rooms</h2><div className="village-flat__doors village-flat__doors--rooms">{HOME_ROOMS.map((destination) => <VillageDoor key={destination.place} destination={destination} onEnter={onEnter} onOpen={onOpen} />)}</div>
      </nav>
      <nav className="village-flat__waterfront" aria-label="Waterfront"><h2>Waterfront</h2><VillageDoor destination={WATERFRONT} onEnter={onEnter} onOpen={onOpen} /></nav>
    </div>
  </section>;
}

/** The bank remains a truthful books entry point when WebGL is unavailable. */
export function BankFlat({ reading, status = "loading", theme = "classic", onOpen, onStair, overlay = false }: VillageFlatProps) {
  return <section className={`court-flat place-flat village-flat village-flat--bank court-flat--${theme}${overlay ? " court-flat--overlay" : ""}`} data-court-flat={status} data-place-flat="bank" aria-label="The Fund Bank, reading edition" aria-busy={status === "loading" || undefined}>
    <div className="court-flat__sheet">
      <p className="court-flat__status" role="status">{statusWords(status)}</p>
      <DoorSign place="bank" reading={reading} />
      <header className="village-flat__intro"><h1>The Fund Bank</h1><p>A warm place to understand the household books.</p></header>
      <dl className="village-flat__fund" aria-label="Fund reading">
        <div><dt>Everyday</dt><dd>{engravedCents(reading?.everyday)}</dd></div>
        <div><dt>Build</dt><dd>{engravedCents(reading?.build.cents)}</dd></div>
        <div><dt>Prepare</dt><dd>{engravedCents(reading?.prepare.cents)}</dd></div>
        <div><dt>Protect</dt><dd>{engravedCents(reading?.protect.cents)}</dd></div>
      </dl>
      <div className="place-flat__doors"><button type="button" onClick={() => onOpen?.("queen")}>Meet the Queen</button><button type="button" onClick={() => onOpen?.("books")}>Open the books</button>{onStair && <button type="button" onClick={onStair}>Village square</button>}</div>
    </div>
  </section>;
}
