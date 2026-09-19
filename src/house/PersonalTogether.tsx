import { useEffect, useMemo, useState } from "react";
import type { DateKey } from "../core/calendar.ts";
import type { Household } from "../core/types.ts";
import type { KitchenCommand } from "../kitchenCommand.ts";
import type { HouseRoute } from "../hearthside/houseRoutes.ts";
import {
  decodePersonalLife, type PersonalLifeDocument, type PersonalLifeExperience, type PersonalLifeMemory, type PersonalLifeNote, type PersonalLifeReference, type PersonalLifeWish,
} from "../hearthside/personalLifeContracts.ts";
import {
  commitPersonalLife, personalLifeShareReviewDigest, preparePersonalLifeShareReview, type PersonalLifeIntent, type PersonalLifeOperation, type PersonalLifeShareReview,
} from "../hearthside/personalLifeCommands.ts";
import "./personal-together.css";

type DraftKind = "wish" | "experience" | "note" | "memory";
type ShareDraft = { review: PersonalLifeShareReview; digest: string } | null;
type PersonalHousehold = Household & { personalLife?: PersonalLifeDocument };

const newId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const plain = (value: unknown) => JSON.stringify(value);
const parse = <T,>(value: string | null, fallback: T): T => { try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } };
const draftKey = (household: Household, memberId: string, object: string) => `hearth:personal-life:${household.environment}:${household.householdId}:${memberId}:personal:${object}`;

const blankWish = (memberId: string): PersonalLifeWish => ({ version: 1, id: newId("WISH"), revision: 1, title: "", intention: "", horizon: "someday", createdBy: memberId, archived: false, references: [] });
const blankExperience = (memberId: string): PersonalLifeExperience => ({ version: 1, id: newId("EXPERIENCE"), revision: 1, title: "", intention: "", state: "dreaming", horizon: "someday", createdBy: memberId, wishId: null, livedOn: null, references: [] });
const blankNote = (memberId: string): PersonalLifeNote => ({ version: 1, id: newId("NOTE"), revision: 1, authorId: memberId, text: "", room: "conservatory", experienceId: null, archived: false });
const blankMemory = (memberId: string): PersonalLifeMemory => ({ version: 1, id: newId("MEMORY"), revision: 1, title: "", date: null, experienceId: null, createdBy: memberId, recollection: "", designs: [], hideAmounts: true, keptRevision: null, withdrawn: false });

function useStoredDraft<T>(key: string, initial: T): [T, (next: T) => void] {
  const [value, setValue] = useState(() => parse<T>(typeof localStorage === "undefined" ? null : localStorage.getItem(key), initial));
  useEffect(() => { setValue(parse<T>(typeof localStorage === "undefined" ? null : localStorage.getItem(key), initial)); }, [key]);
  const save = (next: T) => { setValue(next); try { localStorage.setItem(key, plain(next)); } catch { /* A draft may remain in this open folio only. */ } };
  return [value, save];
}

function outcomeWords(result: Awaited<ReturnType<KitchenCommand>>): string {
  if (!result) return "No acknowledgement is available yet. Your original intent is kept here for retry.";
  if (!result.ok) return result.userMessage ?? "This change was not accepted. Your original intent is kept here for review or retry.";
  if (result.kind === "synchronized") return "Synchronized.";
  if (result.kind === "accepted-local") return "Saved locally. Synchronization has not been confirmed.";
  if (result.kind === "pending-transport") return "Accepted locally and waiting for transport.";
  return result.userMessage ?? "Accepted, but synchronization has not been confirmed.";
}

export function PersonalTogether({ household, memberId, identity, today, route, busy, onCommand, onNavigate, onOpenPlan, onOpenTask, onOpenCalendar }: {
  household: Household;
  memberId: string;
  identity: string;
  today: DateKey;
  route: HouseRoute;
  busy: boolean;
  onCommand: KitchenCommand;
  onNavigate: (route: HouseRoute) => void;
  onOpenPlan: () => void;
  onOpenTask?: (id: string) => void;
  onOpenCalendar?: () => void;
}) {
  const document = useMemo(() => { try { return decodePersonalLife((household as PersonalHousehold).personalLife, memberId); } catch { return null; } }, [household, memberId]);
  const scope = draftKey(household, memberId, `folio:${identity}`);
  const [kind, setKind] = useState<DraftKind>("wish");
  const [wish, setWish] = useStoredDraft(`${scope}:wish`, blankWish(memberId));
  const [experience, setExperience] = useStoredDraft(`${scope}:experience`, blankExperience(memberId));
  const [note, setNote] = useStoredDraft(`${scope}:note`, blankNote(memberId));
  const [memory, setMemory] = useStoredDraft(`${scope}:memory`, blankMemory(memberId));
  const [pending, setPending] = useStoredDraft<PersonalLifeIntent | null>(`${scope}:intent`, null);
  const [status, setStatus] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [share, setShare] = useState<ShareDraft>(null);
  const locked = busy || working || !document || document.ownerMemberId !== memberId;
  const references = useMemo<PersonalLifeReference[]>(() => [
    ...(household.tasks ?? []).filter(task => !task.deleted && task.visibility === "personal" && task.createdBy === memberId).map(task => ({ audience: "personal" as const, kind: "task" as const, id: task.id })),
    ...(household.nativeEvents ?? []).filter(event => !event.deleted && event.visibility === "personal" && event.createdBy === memberId).map(event => ({ audience: "personal" as const, kind: "calendar-event" as const, id: event.id })),
    ...(household.planVersions ?? []).filter(plan => plan.scope === "personal" && plan.ownerMemberId === memberId && plan.state !== "superseded").flatMap(plan => plan.lines.map(line => ({ audience: "personal" as const, kind: "plan-line" as const, id: line.id, planVersionId: plan.id }))),
  ], [household, memberId]);
  const referenceLabel = (reference: PersonalLifeReference) => reference.kind === "task" ? household.tasks?.find(row => row.id === reference.id)?.title ?? "Personal task"
    : reference.kind === "calendar-event" ? household.nativeEvents?.find(row => row.id === reference.id)?.title ?? "Personal calendar event"
      : household.planVersions?.find(row => row.id === reference.planVersionId)?.lines.find(line => line.id === reference.id)?.labelSnapshot ?? "Personal plan line";
  const toggleReference = (reference: PersonalLifeReference) => {
    const same = (row: PersonalLifeReference) => row.kind === reference.kind && row.id === reference.id && row.planVersionId === reference.planVersionId;
    const next = (rows: PersonalLifeReference[]) => rows.some(same) ? rows.filter(row => !same(row)) : [...rows, reference];
    if (kind === "wish") setWish({ ...wish, references: next(wish.references) });
    if (kind === "experience") setExperience({ ...experience, references: next(experience.references) });
  };
  const buildIntent = (operation: PersonalLifeOperation): PersonalLifeIntent => ({ version: 1, id: newId("PERSONAL-LIFE"), scope: { environment: household.environment, householdId: household.householdId, memberId }, operation });
  const submit = async (intent: PersonalLifeIntent) => {
    if (!document || document.ownerMemberId !== memberId || intent.scope.memberId !== memberId || intent.scope.householdId !== household.householdId) { setStatus("This private folio is not available to this member."); return; }
    setWorking(true); setPending(intent); setStatus(null);
    try {
      const result = await onCommand(current => commitPersonalLife(current as PersonalHousehold, intent));
      setStatus(outcomeWords(result));
      if (result?.kind === "synchronized") setPending(null);
    } catch { setStatus("No acknowledgement is available yet. Your original intent is kept here for retry."); }
    finally { setWorking(false); }
  };
  const save = () => {
    if (kind === "wish") void submit(buildIntent({ kind: "wish.save", expectedRevision: wish.revision === 1 && !document?.wishes.some(row => row.id === wish.id) ? 0 : wish.revision - 1, value: wish }));
    if (kind === "experience") void submit(buildIntent({ kind: "experience.save", expectedRevision: experience.revision === 1 && !document?.experiences.some(row => row.id === experience.id) ? 0 : experience.revision - 1, value: experience }));
    if (kind === "note") void submit(buildIntent({ kind: "note.save", expectedRevision: note.revision === 1 && !document?.notes.some(row => row.id === note.id) ? 0 : note.revision - 1, value: note }));
    if (kind === "memory") void submit(buildIntent({ kind: "memory.save", expectedRevision: memory.revision === 1 && !document?.memories.some(row => row.id === memory.id) ? 0 : memory.revision - 1, value: memory }));
  };
  const draft = kind === "wish" ? wish : kind === "experience" ? experience : kind === "note" ? note : memory;
  const beginShare = (sourceKind: "wish" | "experience" | "memory", sourceId: string) => {
    if (!document) return;
    try { const review = preparePersonalLifeShareReview(document, { id: newId("SHARE-REVIEW"), sourceKind, sourceId, sharedId: newId(sourceKind === "memory" ? "SHARED-MEMORY" : "SHARED-EXPERIENCE") }); setShare({ review, digest: personalLifeShareReviewDigest(review) }); }
    catch { setStatus("This item cannot be prepared for sharing from the current private folio."); }
  };
  const potterUnavailable = route.room === "together" && route.level === "below";

  return <section className="personal-together" data-personal-life-owner={document?.ownerMemberId ?? "unavailable"} aria-labelledby="personal-together-title">
    <header className="personal-together__masthead"><div><p className="kicker">Personal conservatory</p><h2 id="personal-together-title">A folio for what is yours</h2><p>Private wishes, lived experience, notes and memories stay in your Personal scope until you deliberately review a copy for Our Home.</p></div><div><button type="button" onClick={onOpenPlan}>Open Personal Plan</button>{onOpenCalendar && <button type="button" onClick={onOpenCalendar}>Open calendar</button>}</div></header>
    {potterUnavailable && <aside className="personal-together__unavailable" role="status"><strong>Private pottery is not connected yet.</strong><span>This room needs an owner-bound private document before a piece can be opened here.</span></aside>}
    {!document && <p className="personal-together__notice" role="status">Your Personal folio could not be read for this member. Nothing can be changed here.</p>}
    {document && <><section className="personal-together__stage">
      <nav aria-label="Choose a private page">{(["wish", "experience", "note", "memory"] as DraftKind[]).map(page => <button key={page} type="button" aria-pressed={kind === page} onClick={() => setKind(page)}>{page}</button>)}</nav>
      <div className="personal-together__editor">
        {kind !== "note" && <label>Title<input value={"title" in draft ? draft.title : ""} onChange={event => kind === "wish" ? setWish({ ...wish, title: event.target.value }) : kind === "experience" ? setExperience({ ...experience, title: event.target.value }) : setMemory({ ...memory, title: event.target.value })} /></label>}
        {kind === "wish" && <><label>Intention<textarea value={wish.intention} onChange={event => setWish({ ...wish, intention: event.target.value })} /></label><label>Horizon<select value={wish.horizon} onChange={event => setWish({ ...wish, horizon: event.target.value as PersonalLifeWish["horizon"] })}><option value="tonight">Tonight</option><option value="season">This season</option><option value="someday">Someday</option></select></label></>}
        {kind === "experience" && <><label>Intention<textarea value={experience.intention} onChange={event => setExperience({ ...experience, intention: event.target.value })} /></label><label>State<select value={experience.state} onChange={event => setExperience({ ...experience, state: event.target.value as PersonalLifeExperience["state"] })}>{["dreaming", "preparing", "lived", "paused", "archived"].map(state => <option key={state}>{state}</option>)}</select></label><label>Horizon<select value={experience.horizon} onChange={event => setExperience({ ...experience, horizon: event.target.value as PersonalLifeExperience["horizon"] })}><option value="tonight">Tonight</option><option value="season">This season</option><option value="someday">Someday</option></select></label></>}
        {kind === "note" && <label>Private note<textarea value={note.text} onChange={event => setNote({ ...note, text: event.target.value })} /></label>}
        {kind === "memory" && <><label>When<input type="date" value={memory.date ?? ""} onChange={event => setMemory({ ...memory, date: event.target.value || null })} /></label><label>Recollection<textarea value={memory.recollection} onChange={event => setMemory({ ...memory, recollection: event.target.value })} /></label></>}
        {(kind === "wish" || kind === "experience") && references.length > 0 && <fieldset><legend>Personal references</legend>{references.map(reference => { const chosen = (kind === "wish" ? wish.references : experience.references).some(row => row.kind === reference.kind && row.id === reference.id && row.planVersionId === reference.planVersionId); return <label key={`${reference.kind}:${reference.id}`}><input type="checkbox" checked={chosen} onChange={() => toggleReference(reference)} />{referenceLabel(reference)}</label>; })}</fieldset>}
        <button type="button" className="primary" disabled={locked} onClick={save}>{working ? "Saving private folio…" : "Save private page"}</button>
      </div>
    </section>
    <section className="personal-together__archive" aria-label="Your saved pages">
      {document.wishes.filter(row => !row.archived).map(row => <article key={row.id}><p className="kicker">Wish · {row.horizon}</p><h3>{row.title}</h3><p>{row.intention}</p><button type="button" onClick={() => { setWish({ ...row, revision: row.revision + 1 }); setKind("wish"); }}>Edit private page</button><button type="button" onClick={() => beginShare("wish", row.id)}>Review Share with Our Home</button></article>)}
      {document.experiences.map(row => <article key={row.id}><p className="kicker">Experience · {row.state}</p><h3>{row.title}</h3><p>{row.intention}</p><button type="button" onClick={() => { setExperience({ ...row, revision: row.revision + 1 }); setKind("experience"); }}>Edit private page</button>{row.state !== "lived" && <button type="button" disabled={locked} onClick={() => void submit(buildIntent({ kind: "experience.mark-lived", id: row.id, expectedRevision: row.revision, livedOn: today }))}>Mark lived on {today}</button>}<button type="button" onClick={() => beginShare("experience", row.id)}>Review Share with Our Home</button></article>)}
      {document.notes.filter(row => !row.archived).map(row => <article key={row.id}><p className="kicker">Private note · {row.room}</p><p>{row.text}</p><button type="button" onClick={() => { setNote({ ...row, revision: row.revision + 1 }); setKind("note"); }}>Edit private page</button></article>)}
      {document.memories.filter(row => !row.withdrawn).map(row => <article key={row.id}><p className="kicker">Memory {row.date ? `· ${row.date}` : ""}</p><h3>{row.title}</h3><p>{row.recollection}</p><button type="button" onClick={() => { setMemory({ ...row, revision: row.revision + 1 }); setKind("memory"); }}>Edit private page</button>{row.keptRevision === row.revision ? <span>Kept in this private folio</span> : <button type="button" disabled={locked} onClick={() => void submit(buildIntent({ kind: "memory.keep", id: row.id, expectedRevision: row.revision }))}>Deliberately keep</button>}<button type="button" disabled={locked} onClick={() => void submit(buildIntent({ kind: "memory.withdraw", id: row.id, expectedRevision: row.revision }))}>Withdraw</button><button type="button" onClick={() => beginShare("memory", row.id)}>Review Share with Our Home</button></article>)}
    </section>
    {share && <aside className="personal-together__share" aria-label="Reviewed Share with Our Home copy"><p className="kicker">Review before sharing</p><h3>{share.review.copy.value.title}</h3>{"intention" in share.review.copy.value && <p>{share.review.copy.value.intention}</p>}<p>This is the exact reviewed copy. Sharing does not publish the rest of your Personal folio.</p><button type="button" className="primary" disabled={locked} onClick={() => void submit(buildIntent({ kind: "share.copy", review: share.review, expectedDigest: share.digest }))}>Share this reviewed copy</button><button type="button" onClick={() => setShare(null)}>Keep private</button></aside>}
    {pending && <aside className="personal-together__pending" role="status"><strong>Original intent retained</strong><span>{status ?? "Awaiting acknowledgement."}</span>{!working && <button type="button" disabled={locked} onClick={() => void submit(pending)}>Retry original intent</button>}</aside>}
    {status && <p className="personal-together__notice" role="status">{status}</p>}
    {onOpenTask && document.experiences.flatMap(row => row.references.filter(reference => reference.kind === "task" && reference.audience === "personal").map(reference => <button key={`task:${row.id}:${reference.id}`} className="personal-together__task-link" type="button" onClick={() => onOpenTask(reference.id)}>Open linked personal task</button>))}
    <button type="button" className="personal-together__return" onClick={() => onNavigate({ ...route, room: "home", level: "middle", scope: "personal" })}>Return to my house</button>
    </>}
  </section>;
}
