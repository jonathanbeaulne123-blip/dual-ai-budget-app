import { useEditionAvailability, editionUnavailableWords } from "./editionAvailability.ts";
import { readMotionEdition, chooseMotionEdition, type MotionEdition } from './motionEdition.ts';
export { MOTION_KEY, readMotionEdition, chooseMotionEdition } from './motionEdition.ts';
export type { MotionEdition } from './motionEdition.ts';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { TARGET_NAMES } from "../../house/navigation.ts";
import { type HouseLevel, type HouseRoom } from "../../hearthside/houseRoutes.ts";
import { HARBOUR_PLACE_NAMES, type HarbourPlaceId } from "../flag.ts";
import { VILLAGE_ADDRESS } from "../village/layout.ts";
// The one list: `src/core/toolAtlas.ts`, as the sheet dispatches it.
import { SHEET_ATLAS as ATLAS, ATLAS_JOB_GROUPS, ATLAS_RECORD_VERBS, type AtlasGroup, type AtlasRecordMode, type AtlasSpace, type AtlasTool } from "./sheetAtlas.ts";
import { searchAtlas, type AtlasResult, type HouseholdWord } from "./atlasSearch.ts";
import { runWorldAction, useWorldActions, type WorldAction } from "./worldActions.ts";
import "./harbour-nav.css";

/**
 * All tools, with search (Tool Atlas brief §3.4) — the escape hatch over the
 * map. A `dialog` named "All tools and search": focus goes in and stays in;
 * Escape or "Put it back" returns it to the opener and the map where it was.
 *
 *   search · Recent · the Record chips · Bills and dates · The Fund ·
 *   Kitty Banks · Books · Plans · The Boathouse · Places · Hercules ·
 *   Settings · the edition switch
 *
 * Search finds a tool's name, its synonyms and the household's own words
 * (bills, accounts, Kitty Banks, members), ranked in that order, each result
 * showing its group. ⌘K / Ctrl+K and `/` focus the field (`useAtlasSearchKeys`,
 * `focusAtlasSearch`); on a wide screen it is focused on open.
 *
 * Nothing here posts. The Record chips hand a verb to `onPick`, which opens
 * the existing Add flow; every other row opens an existing door.
 */
export type QuickSheetProps = {
  open: boolean;
  onClose: () => void;
  /** One of `TARGET_NAMES`' ids (or another house target) → `openHouseObject(id, object?)`. */
  onOpen: (id: string, object?: string) => void;
  /**
   * Walk to a room × level of the island. When it is not given, a place row raises
   * `HARBOUR_GO_EVENT` instead and the harbour shell does the walking.
   */
  onGo?: (room: HouseRoom, level: HouseLevel, place?: HarbourPlaceId) => void;
  /**
   * A place: open the host's compact panel **and** fly the camera there.
   * `keyboard` is true when the row was activated from the keyboard, so the
   * integrator gives that person the panel (and its focus) rather than the flight alone.
   */
  onPlace?: (place: HarbourPlaceId, how: { keyboard: boolean }) => void;
  /** The place standing right now, so its row reads as current. */
  currentPlace?: { room: HouseRoom; level: HouseLevel } | null;
  /** Settings (the Status centre). `onSettings` receives the section when given. */
  onStatus: () => void;
  onSettings?: (section: string | null) => void;
  onHercules: () => void;
  /** The five Record verbs → the existing Add flow. Absent → no chip row. */
  onPick?: (mode: AtlasRecordMode) => void;
  /** Which verbs this member has (Shift only with a job). Defaults to all five. */
  recordModes?: readonly AtlasRecordMode[];
  /** World experiences behind Step in (`step-in`, `skate`, `arrange`). Absent → the rows the island offers (`nav/worldActions.ts`) run there; the rest are hidden. */
  onWorld?: (action: string) => void;
  /** Targets that are neither house doors nor places nor settings (`accounts`, `activity`, `import`, `audit`, `campfire`, `leaving`, `sitdown`). */
  onTarget?: (target: string, object?: string) => void;
  /** The last three tools this member opened, newest first (tool ids). */
  recent?: readonly string[];
  /** Told each time a tool row is opened, so the integrator can keep Recent. */
  onUsed?: (toolId: string) => void;
  /** The household's own words (bills, accounts, Kitty Banks, members). */
  householdWords?: readonly HouseholdWord[];
  /** Ours or Mine: the private folio is listed only in Mine. */
  space?: AtlasSpace;
  /** The space switch and the household switcher, rendered as given. */
  spaceSwitch?: ReactNode;
  householdSwitcher?: ReactNode;
  /** The surface currently open, if any, so its row reads as current. */
  current?: string | null;
  returnFocusTo?: HTMLElement | null;
  storage?: Pick<Storage, "getItem" | "setItem">;
  onEditionChange?: (edition: MotionEdition) => void;
  /** Injected atlas (tests, or the integrator's `toolAtlas.ts`). */
  groups?: readonly AtlasGroup[];
  /** Force the wide behaviour (search focused on open); defaults to `(min-width: 1100px)`. */
  wide?: boolean;
};

/** One physical village destination and its compatible house address. */
export type QuickSheetPlace = { key: string; room: HouseRoom; level: HouseLevel; place: HarbourPlaceId | null; name: string; words: string; aria: string };

/**
 * The event a place row raises when the sheet was given neither `onPlace` nor
 * `onGo`. The harbour shell listens for it. It carries a route, never a write.
 */
export const HARBOUR_GO_EVENT = "hearth:harbour-go";

const titleCase = (words: string) => `${words[0]!.toUpperCase()}${words.slice(1)}`;
const PLACE_WORDS: Record<HarbourPlaceId, string> = {
  court: "The square · the middle of the village", bank: "The Fund bank · the Queen and the vault",
  kitchen: "Our home · the Kitchen", tower: "Our home · the Loft, upstairs",
  cellar: "Our home · the Cellar, downstairs", atlas: "Our home · the Atlas, up the Kitchen stair",
  library: "The Library · the Standing Book", glasshouse: "The Glasshouse · steps, week by week",
  kiln: "The Kiln · shape, paint and fire", cottage: "Hercules's Cottage · his looks and keepsakes",
  boathouse: "The Boathouse · wishes, memories and letters", campfire: "The Campfire · by the water",
};

/** Pure: every physical village destination, once, in reading order. */
export function quickSheetPlaces(): QuickSheetPlace[] {
  return (Object.entries(VILLAGE_ADDRESS) as [HarbourPlaceId, typeof VILLAGE_ADDRESS[HarbourPlaceId]][]).map(([place, address]) => {
    const name = place === "court" ? "The square" : titleCase(HARBOUR_PLACE_NAMES[place]);
    return { key: place, room: address.room, level: address.level, place, name, words: PLACE_WORDS[place], aria: `${name}. ${PLACE_WORDS[place]}.` };
  });
}

/**
 * Focus the search field: now, if the sheet is open, or as soon as it opens.
 * The integrator calls it after opening the sheet from ⌘K. Returns whether a
 * field was there to focus.
 */
let searchField: HTMLInputElement | null = null;
let pendingSearchFocus = false;
export function focusAtlasSearch(): boolean {
  if (searchField?.isConnected) { searchField.focus(); pendingSearchFocus = false; return true; }
  pendingSearchFocus = true;
  return false;
}

/** Pure: should this keydown open the sheet's search? ⌘K / Ctrl+K anywhere; `/` when not typing. */
export function atlasSearchKey(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing" | "defaultPrevented" | "target">): boolean {
  if (event.isComposing || event.defaultPrevented || event.altKey) return false;
  if ((event.metaKey || event.ctrlKey) && (event.key === "k" || event.key === "K")) return true;
  if (event.key !== "/" || event.metaKey || event.ctrlKey) return false;
  const target = event.target as HTMLElement | null;
  if (target && typeof target.closest === "function" && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"]')) return false;
  return true;
}

/** ⌘K / Ctrl+K and `/`: open All tools and put the cursor in its search. */
export function useAtlasSearchKeys(enabled: boolean, openSheet: () => void): void {
  const open = useRef(openSheet); open.current = openSheet;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (!atlasSearchKey(event)) return;
      event.preventDefault();
      open.current();
      focusAtlasSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
const ARROWS: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };
const SIDE_ARROWS: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 };
const isWide = () => { try { return typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1100px)").matches; } catch { return false; } };
const keyboardClick = (event: ReactMouseEvent) => event.detail === 0;

export function QuickSheet(props: QuickSheetProps) {
  const availability = useEditionAvailability();
  const { open, onClose, current = null } = props;
  const groups = props.groups ?? ATLAS;
  const space = props.space ?? "ours";
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const resultsId = useId();
  const [query, setQuery] = useState("");
  const [edition, setEdition] = useState<MotionEdition>(() => readMotionEdition(props.storage));
  const here = props.currentPlace ?? null;

  /** Can the sheet dispatch this target here? A world row needs `onWorld`, or a world that offers it. */
  const offered = useWorldActions();
  const canDispatch = (target: string) => !target.startsWith("world:") || Boolean(props.onWorld) || offered.has(target.slice(6) as WorldAction);
  const visible = (tool: AtlasTool) => tool.spaces.includes(space) && canDispatch(tool.target);
  const byId = useMemo(() => new Map(groups.flatMap((g) => g.tools).map((tool) => [tool.id, tool] as const)), [groups]);
  const modes = props.recordModes ?? ATLAS_RECORD_VERBS.map((verb) => verb.mode);
  const results = useMemo<AtlasResult[]>(
    () => searchAtlas(query, groups, { space, householdWords: props.householdWords, recordModes: props.onPick ? modes : [], canDispatch }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, groups, space, props.householdWords, props.onPick, modes.join(","), Boolean(props.onWorld), offered],
  );

  // Capture the opener and move focus in; return it on close.
  useEffect(() => {
    if (!open) return;
    openerRef.current = props.returnFocusTo ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    searchField = inputRef.current;
    const wide = props.wide ?? isWide();
    if (pendingSearchFocus || wide) { inputRef.current?.focus(); pendingSearchFocus = false; }
    else sheetRef.current?.focus();
    return () => {
      if (searchField === inputRef.current) searchField = null;
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, [open, props.returnFocusTo, props.wide]);

  useEffect(() => { if (open) setEdition(readMotionEdition(props.storage)); else setQuery(""); }, [open, props.storage]);

  if (!open) return null;

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); onClose(); return; }
    if (!sheetRef.current) return;
    const active = document.activeElement;
    // `/` from anywhere in the sheet goes to the search field.
    if (event.key === "/" && active !== inputRef.current) { event.preventDefault(); inputRef.current?.focus(); return; }
    // In the search field the caret keeps ←/→/Home/End; ↑/↓ still step out into the list.
    const inField = active === inputRef.current;
    const arrow = inField ? ARROWS[event.key] : ARROWS[event.key] ?? SIDE_ARROWS[event.key];
    const ends = inField ? null : event.key === "Home" ? 0 : event.key === "End" ? 1 : null;
    if (event.key !== "Tab" && arrow === undefined && ends === null) return;
    const items = [...sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((node) => !node.closest("[hidden]"));
    if (items.length === 0) return;
    const first = items[0]!, last = items[items.length - 1]!;
    if (ends !== null) { event.preventDefault(); (ends === 0 ? first : last).focus(); return; }
    if (arrow !== undefined) {
      // One long list however it is laid out: down steps forward, up steps back, both wrap.
      event.preventDefault();
      const at = items.findIndex((node) => node === active);
      const next = at < 0 ? (arrow > 0 ? first : last) : items[(at + arrow + items.length) % items.length]!;
      next.focus();
      return;
    }
    if (event.shiftKey && (active === first || active === sheetRef.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  }

  /** Walk to a place: the panel-and-flight when the integrator gave one, else the App's navigator, else the shell's event. */
  function go(place: HarbourPlaceId, keyboard: boolean) {
    if (props.onPlace) { props.onPlace(place, { keyboard }); return; }
    const address = VILLAGE_ADDRESS[place];
    if (props.onGo) { props.onGo(address.room, address.level, place); return; }
    try { window.dispatchEvent(new CustomEvent(HARBOUR_GO_EVENT, { detail: { room: address.room, level: address.level, place } })); }
    catch { /* jsdom without CustomEvent still closes the sheet. */ }
  }

  /** The one dispatcher: every row, result and chip comes through here. */
  function dispatch(target: string, object: string | undefined, keyboard: boolean) {
    if (target.startsWith("place:")) { go(target.slice(6) as HarbourPlaceId, keyboard); onClose(); return; }
    if (target === "settings" || target.startsWith("settings:")) {
      const section = target.includes(":") ? target.slice(target.indexOf(":") + 1) : null;
      if (props.onSettings) props.onSettings(section); else props.onStatus();
      return;
    }
    if (target.startsWith("world:")) { onClose(); if (props.onWorld) props.onWorld(target.slice(6)); else runWorldAction(target.slice(6)); return; }
    if (target === "edition") { toggleEdition(); return; }
    if (target === "hercules") { props.onHercules(); return; }
    if (Object.hasOwn(TARGET_NAMES, target)) { props.onOpen(target, object); return; }
    if (props.onTarget) props.onTarget(target, object); else props.onOpen(target, object);
  }

  function openTool(tool: AtlasTool, event: ReactMouseEvent) {
    props.onUsed?.(tool.id);
    dispatch(tool.target, tool.object, keyboardClick(event));
  }
  function pick(mode: AtlasRecordMode) { props.onPick?.(mode); onClose(); }

  function toggleEdition() {
    if (availability.reason) return;
    const next: MotionEdition = edition === "flat" ? "illustrated" : "flat";
    setEdition(next);
    chooseMotionEdition(next, props.storage);
    props.onEditionChange?.(next);
  }

  const toolButton = (tool: AtlasTool, extra?: string) => (
    <button
      type="button"
      className={`quick-sheet__tool${extra ? ` ${extra}` : ""}`}
      data-quick-sheet-tool={tool.id}
      data-atlas-target={tool.target}
      aria-current={current && current === tool.target ? "true" : undefined}
      onClick={(event) => openTool(tool, event)}
    >
      <span className="quick-sheet__tool-name">{tool.label}</span>
      {tool.subtitle && <small>{tool.subtitle}</small>}
    </button>
  );

  const recent = (props.recent ?? []).map((id) => byId.get(id)).filter((tool): tool is AtlasTool => Boolean(tool && visible(tool))).slice(0, 3);
  const verbs = ATLAS_RECORD_VERBS.filter((verb) => modes.includes(verb.mode));
  const jobGroups = ATLAS_JOB_GROUPS.map((id) => groups.find((g) => g.id === id)).filter((g): g is AtlasGroup => Boolean(g));
  const places = groups.find((g) => g.id === "places");
  const hercules = groups.find((g) => g.id === "hercules");
  const settings = groups.find((g) => g.id === "settings");
  const searching = query.trim().length > 0;
  const flat = availability.flat || edition === "flat";
  const reason = editionUnavailableWords(availability.reason);
  const reasonId = `${titleId}-edition-reason`;

  const section = (group: AtlasGroup, className = "") => {
    const tools = group.tools.filter(visible);
    if (tools.length === 0) return null;
    return (
      <section key={group.id} className={`quick-sheet__group ${className}`} data-quick-sheet-group={group.id} aria-labelledby={`${titleId}-${group.id}`}>
        <h3 id={`${titleId}-${group.id}`}>{group.heading}</h3>
        <p className="quick-sheet__subtitle">{group.subtitle}</p>
        <ul className="quick-sheet__tools">
          {tools.map((tool) => <li key={tool.id}>{group.id === "places" && tool.target.startsWith("place:")
            ? <button
              type="button"
              className="quick-sheet__tool quick-sheet__place"
              data-quick-sheet-tool={tool.id}
              data-quick-sheet-place={tool.target.slice(6)}
              aria-current={(() => { const place = tool.target.slice(6) as HarbourPlaceId; const address = VILLAGE_ADDRESS[place]; return place !== "bank" && here && address && here.room === address.room && here.level === address.level ? "true" : undefined; })()}
              onClick={(event) => openTool(tool, event)}
            ><span className="quick-sheet__tool-name">{tool.label}</span>{tool.subtitle && <small>{tool.subtitle}</small>}</button>
            : toolButton(tool)}</li>)}
        </ul>
      </section>
    );
  };

  return (
    <div className="quick-sheet" data-quick-sheet="open">
      <button type="button" className="quick-sheet__scrim" tabIndex={-1} aria-hidden="true" onClick={onClose} />
      <div
        ref={sheetRef}
        className="quick-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-label="All tools and search"
        data-camera-deadzone="0"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="quick-sheet__head">
          <h2 id={titleId}>All tools</h2>
          <button type="button" className="quick-sheet__close" data-quick-sheet-close="" onClick={onClose}>Put it back</button>
        </header>
        <div className="quick-sheet__search" role="search">
          <label htmlFor={`${titleId}-search`} className="quick-sheet__search-label">Search tools, places and your own words</label>
          <input
            ref={(node) => { inputRef.current = node; if (node && open) searchField = node; }}
            id={`${titleId}-search`}
            type="search"
            className="quick-sheet__search-input"
            data-atlas-search=""
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="Hydro, Books, Visa…"
            aria-controls={searching ? resultsId : undefined}
            aria-keyshortcuts="Control+K Meta+K /"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && results[0]) {
                event.preventDefault();
                sheetRef.current?.querySelector<HTMLButtonElement>("[data-atlas-result]")?.click();
              }
            }}
          />
        </div>
        {searching ? (
          <section className="quick-sheet__results" id={resultsId} aria-label="Results">
            <p className="quick-sheet__count" role="status">{results.length === 0 ? `Nothing found for “${query.trim()}”` : `${results.length} ${results.length === 1 ? "result" : "results"}`}</p>
            <ul className="quick-sheet__tools quick-sheet__tools--results">
              {results.map((result) => (
                <li key={result.key}>
                  <button
                    type="button"
                    className="quick-sheet__tool quick-sheet__result"
                    data-atlas-result={result.key}
                    data-atlas-match={result.match}
                    aria-label={result.kind === "record" ? `${result.aria}. Record` : undefined}
                    onClick={(event) => {
                      if (result.kind === "record") pick(result.mode);
                      else if (result.kind === "tool") openTool(result.tool, event);
                      else dispatch(result.word.target, result.word.object, keyboardClick(event));
                    }}
                  >
                    <span className="quick-sheet__tool-name">{result.label}</span>
                    <small>{result.kind === "word" && result.word.where ? `${result.groupHeading} — ${result.word.where}` : result.groupHeading}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <>
            {recent.length > 0 && (
              <section className="quick-sheet__group quick-sheet__group--recent" data-quick-sheet-group="recent" aria-labelledby={`${titleId}-recent`}>
                <h3 id={`${titleId}-recent`}>Recent</h3>
                <ul className="quick-sheet__tools quick-sheet__tools--row">{recent.map((tool) => <li key={tool.id}>{toolButton(tool)}</li>)}</ul>
              </section>
            )}
            {props.onPick && verbs.length > 0 && (
              <section className="quick-sheet__group quick-sheet__group--record" data-quick-sheet-group="record" aria-labelledby={`${titleId}-record`}>
                <h3 id={`${titleId}-record`}>Record</h3>
                <p className="quick-sheet__subtitle">a purchase, a shift, income, a bill paid, or money moved</p>
                <ul className="quick-sheet__chips">
                  {verbs.map((verb) => (
                    <li key={verb.mode}>
                      <button type="button" className="quick-sheet__chip" data-quick-sheet-record={verb.mode} aria-label={verb.aria} onClick={() => pick(verb.mode)}>{verb.label}</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {jobGroups.map((group) => section(group))}
            {places && section(places, "quick-sheet__group--places")}
            <div className="quick-sheet__footer">
              {hercules && section(hercules, "quick-sheet__group--hercules")}
              {settings && section(settings, "quick-sheet__group--settings")}
              {(props.spaceSwitch || props.householdSwitcher) && (
                <div className="quick-sheet__space">
                  {props.spaceSwitch}
                  {props.householdSwitcher}
                </div>
              )}
              <button
                type="button"
                role="switch"
                className="quick-sheet__edition"
                aria-checked={flat}
                aria-disabled={reason ? true : undefined}
                aria-describedby={reason ? reasonId : undefined}
                data-quick-sheet-edition={edition}
                onClick={toggleEdition}
              >
                <span>Simple view</span>
                <small>{flat ? "On · the Desk, every place as a readable page" : "Off · the illustrated island"}</small>
              </button>
              {reason && <p className="quick-sheet__reason" id={reasonId}>{reason}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
