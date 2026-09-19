import { useEffect, useMemo, useRef, useState } from "react";
import type { DateKey } from "../core/calendar.ts";
import { pathMonthCharacter, pathMonths } from "../core/pathSignals.ts";
import { PATH_BASE_RECIPES } from "../core/pathWorld.ts";
import type { Household } from "../core/types.ts";
import { decodePersonalLife } from "../hearthside/personalLifeContracts.ts";
import { projectKittyNest } from "../core/kittyNest.ts";
import { kittyBankBackingStep } from "../core/kittyBanks.ts";
import { queenBankPiece, queenBankFired } from "../queen/world/queenAuthoring.ts";
import { useAppearance } from "../theme/ThemeProvider.tsx";
import { growIsland, type GrownIsland } from "../path/grow.ts";
import type { PathWorld, PathWorldInput } from "../path/world/pathWorld3d.ts";
import "./personal-journey.css";

const CHARACTER_WORDS = {
  steady: "Steady", bloom: "Blooming", milestone: "Milestone", uphill: "Uphill", storm: "Storm", paused: "Paused",
} as const;

function monthLabel(key: string): string {
  const date = new Date(`${key}-15T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? key : date.toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Decorative fallback; the dated controls beside it carry the accessible landmarks. */
function PersonalJourneyFlat({ island, active }: { island: GrownIsland; active: number }) {
  const shore = Array.from({ length: 40 }, (_, i) => i / 40 * Math.PI * 2);
  const max = Math.max(1, ...shore.map((a) => island.radiusAt(a)), ...Array.from({ length: island.cur + 1 }, (_, i) => { const p = island.spot(i); return Math.hypot(p.x, p.z); }));
  const scale = 52 / max;
  const path = shore.map((a, i) => `${i ? "L" : "M"}${(Math.cos(a) * island.radiusAt(a) * scale).toFixed(2)} ${(Math.sin(a) * island.radiusAt(a) * scale).toFixed(2)}`).join(" ");
  const thread = Array.from({ length: island.cur + 1 }, (_, i) => island.spot(i)).map((p, i) => `${i ? "L" : "M"}${(p.x * scale).toFixed(2)} ${(p.z * scale).toFixed(2)}`).join(" ");
  return <svg className="personal-journey__flat" viewBox="-60 -60 120 120" aria-hidden="true" focusable="false">
    <path className="personal-journey__shore" d={`${path} Z`} />
    {thread && <path className="personal-journey__thread" d={thread} />}
    {Array.from({ length: island.cur + 1 }, (_, index) => { const p = island.spot(index); return <circle key={index} className={index === active ? "is-active" : ""} cx={(p.x * scale).toFixed(2)} cy={(p.z * scale).toFixed(2)} r={index === active ? 3.8 : 2.2} />; })}
  </svg>;
}

export type PersonalJourneyObject = 'wish' | 'experience' | 'memory' | 'bank';
export function PersonalJourney({ household, memberId, today, onOpenPlan, onOpenTask: _onOpenTask, onReturn, onOpenObject }: {
  household: Household;
  memberId: string;
  today: DateKey;
  onOpenPlan: () => void;
  onOpenTask?: (id: string) => void;
  onReturn?: () => void;
  onOpenObject?: (kind: PersonalJourneyObject, id: string) => void;
}) {
  const appearance = useAppearance();
  const life = useMemo(() => decodePersonalLife(household.personalLife, memberId), [household.personalLife, memberId]);
  const kept = life.memories.filter(memory => !memory.withdrawn && memory.keptRevision === memory.revision);
  const banks = useMemo(() => projectKittyNest(household, memberId, 'personal', today).categories.flatMap(category => category.children).filter(bank => bank.tier === 'goal' && bank.state === 'open'), [household, memberId, today]);
  const months = useMemo(() => pathMonths(household, today, undefined, { view: "personal", memberId }), [household, today, memberId]);
  const characters = useMemo(() => months.map(pathMonthCharacter), [months]);
  const island = useMemo(() => growIsland(months, [...PATH_BASE_RECIPES], Math.max(0, months.length - 1)), [months]);
  const scene = useMemo<PathWorldInput>(() => ({
    island, theme: appearance.scene.theme, characters, campfires: [], moves: [],
    goals: banks.map(bank => { const piece = queenBankPiece(bank); return {id:`bank/${bank.id}`, step:bank.goal ? kittyBankBackingStep(household, bank.goal, today) : 0, piece, fired:queenBankFired(piece)}; }),
    lamps: [], memories: kept.flatMap(memory => { const month = months.findIndex(row => row.key === memory.date?.slice(0,7)); return month < 0 ? [] : [{id:`memory/${memory.id}`,month}]; }), weather: [], unknown: [], name: null,
    layers: { weather: false, story: true, rhythm: false }, presentMembers: 1,
  }), [appearance.scene.theme, island, characters, banks, household, today, life, months]);
  const openObject = useRef(onOpenObject); openObject.current = onOpenObject;
  const [selected, setSelected] = useState(() => Math.max(0, months.length - 1));
  const [renderer, setRenderer] = useState<"flat" | "world">("flat");
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<PathWorld | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => { setSelected(Math.max(0, months.length - 1)); }, [months.length]);
  useEffect(() => {
    const element = host.current;
    if (!element || typeof window === "undefined") return;
    let disposed = false;
    let observer: ResizeObserver | null = null;
    let created: PathWorld | null = null;
    void import("../path/world/pathWorld3d.ts").then(({ createPathWorld }) => {
      if (disposed) return;
      try {
        created = createPathWorld(element, {
          reducedMotion: Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches),
          onLost: () => { if (!disposed) setRenderer("flat"); },
          onView: (view) => { if (view.month !== null) setSelected(view.month); },
          onPick: (key) => { const [kind, ...id] = key.split('/'); if (kind === 'bank' || kind === 'memory') openObject.current?.(kind, id.join('/')); },
        });
        if (disposed) { created.dispose(); return; }
        world.current = created;
        created.resize(element.clientWidth, element.clientHeight);
        created.setScene(scene, months[selectedRef.current]?.key, false);
        if (typeof ResizeObserver !== "undefined") { observer = new ResizeObserver(() => created?.resize(element.clientWidth, element.clientHeight)); observer.observe(element); }
        setRenderer("world");
      } catch { if (!disposed) setRenderer("flat"); }
    }).catch(() => { if (!disposed) setRenderer("flat"); });
    return () => { disposed = true; observer?.disconnect(); created?.dispose(); if (world.current === created) world.current = null; };
    // The renderer owns GPU resources; later read-model changes use setScene below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { world.current?.setScene(scene, months[selected]?.key, false); }, [scene, months, selected]);
  const chooseMonth = (index: number) => {
    const next = Math.max(0, Math.min(months.length - 1, index));
    setSelected(next);
    world.current?.focusMonth(next, 2);
  };
  const current = months[selected];
  const reasons = current ? Object.values(current.why).filter((value): value is string => Boolean(value)).slice(0, 3) : [];

  return <section className={`personal-journey personal-journey--${appearance.scene.theme}`} aria-labelledby="personal-journey-title">
    <header className="personal-journey__head">
      <div><p className="kicker">Personal Journey</p><h2 id="personal-journey-title">Your own island</h2><p>Your Personal books shape the land. Your deliberately kept memories mark their dates.</p></div>
      {onReturn && <button type="button" className="ghost" onClick={onReturn}>Return home</button>}
    </header>
    <div className="personal-journey__scene" data-renderer={renderer}>
      <div ref={host} className="personal-journey__canvas" aria-hidden="true" />
      {renderer === "flat" && <PersonalJourneyFlat island={island} active={selected} />}
    </div>
    <div className="personal-journey__body">
      <div className="personal-journey__landmarks" aria-label="Dated personal landmarks">
        {months.map((month, index) => <button key={month.geographyId ?? month.key} type="button" className={index === selected ? "is-selected" : ""} onClick={() => chooseMonth(index)}>
          <span>{monthLabel(month.key)}</span><strong>{CHARACTER_WORDS[characters[index]!]}</strong>
        </button>)}
      </div>
      <article className="personal-journey__reading" aria-live="polite">
        <p className="kicker">{current ? monthLabel(current.key) : "This month"}</p>
        <h3>{current ? CHARACTER_WORDS[characters[selected]!] : "Waiting for a first mark"}</h3>
        {reasons.length ? <ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p>No Personal evidence has shaped this month yet.</p>}
        <button type="button" className="primary" onClick={onOpenPlan}>Open Personal Plan</button>
      </article>
    </div>
    <section className="personal-journey__objects" aria-label="Your intentions and kept memories">
      <h3>Things you are carrying</h3>
      <p>These open the same objects in your private house. Undated wishes stay undated.</p>
      <div>{life.wishes.filter(wish=>!wish.archived).map(wish=><button key={`wish/${wish.id}`} onClick={()=>onOpenObject?.('wish',wish.id)}><small>Wish · {wish.horizon}</small><strong>{wish.title}</strong></button>)}
      {life.experiences.filter(experience=>experience.state!=='archived').map(experience=><button key={`experience/${experience.id}`} onClick={()=>onOpenObject?.('experience',experience.id)}><small>{experience.state==='lived'?`Lived · ${experience.livedOn}`:'Preparing'}</small><strong>{experience.title}</strong></button>)}
      {kept.map(memory=><button key={`memory/${memory.id}`} onClick={()=>onOpenObject?.('memory',memory.id)}><small>Kept memory · {memory.date??'No date recorded'}</small><strong>{memory.title}</strong></button>)}
      {banks.map(bank=><button key={`bank/${bank.id}`} onClick={()=>onOpenObject?.('bank',bank.id)}><small>Your ceramic bank</small><strong>{bank.name}</strong></button>)}</div>
      {!life.wishes.some(wish=>!wish.archived)&&!life.experiences.some(experience=>experience.state!=='archived')&&!kept.length&&!banks.length&&<p>There is room for a first wish.</p>}
    </section>
  </section>;
}
