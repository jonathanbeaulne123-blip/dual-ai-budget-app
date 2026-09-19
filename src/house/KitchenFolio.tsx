import { useEffect, useMemo, useState } from "react";
import type { Household } from "../core/types.ts";
import { commitHearthside, type HearthsideIntent } from "../hearthside/commands.ts";
import type { SharedExperience } from "../hearthside/contracts.ts";
import type { HouseRoute } from "../hearthside/houseRoutes.ts";
import { decodePersonalLife, type PersonalLifeExperience } from "../hearthside/personalLifeContracts.ts";
import { commitPersonalLife, type PersonalLifeIntent } from "../hearthside/personalLifeCommands.ts";
import type { KitchenCommand } from "../kitchenCommand.ts";
import { useAppearance } from "../theme/ThemeProvider.tsx";
import "./kitchen-folio.css";

type KitchenView = "personal" | "household";

type KitchenDraft = {
  version: 1;
  topicId: string;
  intentionNotes: string;
  evidenceReferences: string;
  alternatives: string;
  proposedText: string;
  reviewedText: string | null;
  noteText: string;
  updatedAt: string;
};

type Topic = {
  id: string;
  title: string;
  intention: string;
  kind: KitchenView;
  experience: PersonalLifeExperience | SharedExperience;
};

type PendingIntent = { kind: "personal-note"; intent: PersonalLifeIntent } | { kind: "shared-intention"; intent: HearthsideIntent };

export type KitchenFolioProps = {
  household: Household;
  memberId: string;
  view: KitchenView;
  identity: string;
  route: HouseRoute;
  today: string;
  onCommand: KitchenCommand;
  onNavigate: (route: HouseRoute) => void;
  onOpenPlan: () => void;
  onOpenCalendar: () => void;
  onOpenHercules: () => void;
};

const blankDraft = (): KitchenDraft => ({ version: 1, topicId: "", intentionNotes: "", evidenceReferences: "", alternatives: "", proposedText: "", reviewedText: null, noteText: "", updatedAt: "" });

const safeRead = <T,>(key: string, fallback: T): T => {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
};

const saveLocal = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* local recovery remains unavailable until browser storage returns. */ }
};

const experienceIdFromRoute = (value: string | undefined) => value?.startsWith("experience/") ? value.slice("experience/".length) : value;
const clean = (value: string) => value.trim();
const identifier = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

function acknowledgement(result: unknown): string {
  if (result === undefined || result === null) return "No save acknowledgement yet. This original intent remains in this device’s recovery drawer.";
  if (typeof result === "object" && result && "ok" in result && (result as { ok?: unknown }).ok === false) return "The command was not accepted. The original intent is still kept here for review or retry.";
  if (typeof result === "object" && result && "kind" in result) {
    const kind = String((result as { kind: unknown }).kind);
    if (kind === "synchronized") return "Saved and synchronized.";
    if (kind === "offline") return "Saved locally; it has not synchronized yet.";
  }
  return "The command was accepted by this app. Keep this folio open until its sync status is clear.";
}

export function KitchenFolio({ household, memberId, view, identity, route, today, onCommand, onNavigate, onOpenPlan, onOpenCalendar, onOpenHercules }: KitchenFolioProps) {
  const appearance = useAppearance();
  const theme = appearance.preview ?? appearance.saved.theme;
  const object = route.object ?? "composer";
  const draftKey = `hearth:kitchen-folio:${household.environment}:${household.householdId}:${memberId}:${view}:${object}`;
  const pendingKey = `${draftKey}:pending`;
  const [draft, setDraft] = useState<KitchenDraft>(() => safeRead(draftKey, blankDraft()));
  const [pending, setPending] = useState<PendingIntent | null>(() => safeRead<PendingIntent | null>(pendingKey, null));
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => { setDraft(safeRead(draftKey, blankDraft())); setPending(safeRead<PendingIntent | null>(pendingKey, null)); setMessage(""); }, [draftKey]);
  useEffect(() => { saveLocal(draftKey, draft); }, [draft, draftKey]);
  useEffect(() => { if (pending) saveLocal(pendingKey, pending); else try { localStorage.removeItem(pendingKey); } catch {} }, [pending, pendingKey]);

  const topics = useMemo<Topic[]>(() => {
    if (view === "household") {
      const rows = household.hearthside?.experiences ?? [];
      return rows.filter(row => row.state !== "archived").map(row => ({ id: row.id, title: row.title, intention: row.intention, kind: "household" as const, experience: row }));
    }
    try {
      return decodePersonalLife(household.personalLife, memberId).experiences
        .filter(row => row.state !== "archived")
        .map(row => ({ id: row.id, title: row.title, intention: row.intention, kind: "personal" as const, experience: row }));
    } catch { return []; }
  }, [household.hearthside?.experiences, household.personalLife, memberId, view]);
  const carriedId = experienceIdFromRoute(route.object);
  const selectedId = topics.some(topic => topic.id === draft.topicId) ? draft.topicId : topics.some(topic => topic.id === carriedId) ? carriedId! : "";
  const selected = topics.find(topic => topic.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected || draft.proposedText || draft.topicId === selected.id) return;
    setDraft(current => ({ ...current, topicId: selected.id, proposedText: selected.intention, updatedAt: new Date().toISOString() }));
  }, [draft.proposedText, draft.topicId, selected]);

  const revise = (change: Partial<KitchenDraft>) => setDraft(current => ({ ...current, ...change, updatedAt: new Date().toISOString() }));
  const currentPersonalExperienceId = selected?.kind === "personal" ? selected.id : null;

  const dispatch = async (next: PendingIntent) => {
    setWorking(true); setPending(next); setMessage("Sending the reviewed intent…");
    try {
      const result = await onCommand(current => next.kind === "personal-note" ? commitPersonalLife(current, next.intent) : commitHearthside(current, next.intent), {
        confirmationId: next.intent.id,
        recoverConfirmation: pending?.intent.id === next.intent.id,
        onRecoveredConfirmation: () => { setPending(null); setMessage("The prior command was recovered. Check its receipt before making another change."); },
        onDefinitiveRejected: () => setMessage("This command was definitively rejected. Its original local copy remains available for revision."),
      });
      const status = acknowledgement(result);
      setMessage(status);
      if (typeof result === "object" && result && "kind" in result && String((result as { kind: unknown }).kind) === "synchronized") setPending(null);
    } catch (error) {
      setMessage(`${error instanceof Error ? error.message : "Could not send this"}. The original intent is retained locally.`);
    } finally { setWorking(false); }
  };

  const savePrivateNote = () => {
    const text = clean(draft.noteText);
    if (!text) { setMessage("Write the private folio note before saving it."); return; }
    const intent: PersonalLifeIntent = {
      version: 1, id: identifier("kitchen-note"),
      scope: { environment: household.environment, householdId: household.householdId, memberId },
      operation: { kind: "note.save", expectedRevision: 0, value: { version: 1, id: identifier("note"), revision: 1, authorId: memberId, text, room: "common", experienceId: currentPersonalExperienceId, archived: false } },
    };
    void dispatch({ kind: "personal-note", intent });
  };

  const saveSharedIntention = () => {
    if (!selected || selected.kind !== "household") { setMessage("Choose one current shared experience first."); return; }
    const proposed = clean(draft.proposedText);
    if (!proposed) { setMessage("Write the proposed shared intention before reviewing it."); return; }
    if (draft.reviewedText !== proposed) { setMessage("Review this exact proposed text before asking to update Our Home."); return; }
    const current = household.hearthside?.experiences.find(row => row.id === selected.id);
    if (!current || current.revision !== selected.experience.revision) { setMessage("This shared experience changed. Your draft remains local; select the current version and review again."); return; }
    const intent: HearthsideIntent = {
      version: 1, id: identifier("kitchen-shared-intention"),
      scope: { environment: household.environment, householdId: household.householdId, memberId },
      operation: { kind: "experience.save", expectedRevision: current.revision, value: { ...current, revision: current.revision + 1, intention: proposed } },
    };
    void dispatch({ kind: "shared-intention", intent });
  };

  const openPlan = () => {
    const experience = selected?.id ?? carriedId;
    onNavigate({ ...route, scope: view, surface: "plan-studio", ...(experience ? { object: `experience/${experience}` } : {}) });
    onOpenPlan();
  };

  return <section className={`kitchen-folio kitchen-folio--${theme}`} data-identity={identity} aria-label="Kitchen folio">
    <header className="kitchen-folio__masthead">
      <p className="kitchen-folio__eyebrow">Kitchen table · private preparation</p>
      <h1>Make room for one intention.</h1>
      <p>This folio lives on this device until you deliberately save a private note or review a change to an existing shared intention.</p>
    </header>

    <div className="kitchen-folio__spread">
      <section className="kitchen-folio__page" aria-labelledby="kitchen-topic-title">
        <h2 id="kitchen-topic-title">The intention at the table</h2>
        <label>Choose an existing {view === "household" ? "Our Home" : "Personal"} experience
          <select value={selectedId} onChange={event => revise({ topicId: event.target.value, reviewedText: null })}>
            <option value="">A blank local composer</option>
            {topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
          </select>
        </label>
        {selected ? <div className="kitchen-folio__canonical"><p className="kitchen-folio__tag">Canonical {selected.kind === "household" ? "shared" : "personal"} experience</p><strong>{selected.title}</strong><p>{selected.intention || "No saved intention text yet."}</p></div> : <p className="kitchen-folio__quiet">This remains a local preparation page. It will not make an experience or publish a prompt.</p>}
        <label>What matters about this?<textarea value={draft.intentionNotes} onChange={event => revise({ intentionNotes: event.target.value, reviewedText: null })} placeholder="A funded weekend, a free evening, or the small shape of the next step." /></label>
        <label>Evidence references you can check<textarea value={draft.evidenceReferences} onChange={event => revise({ evidenceReferences: event.target.value })} placeholder="Names, dates, plan or task references — held here as private working notes." /></label>
        <label>Alternatives worth keeping<textarea value={draft.alternatives} onChange={event => revise({ alternatives: event.target.value })} placeholder="A quieter version, another date, or a different way in." /></label>
      </section>

      <section className="kitchen-folio__page kitchen-folio__page--proposal" aria-labelledby="kitchen-proposal-title">
        <h2 id="kitchen-proposal-title">Proposed words</h2>
        <label>Text to review before any shared update<textarea value={draft.proposedText} onChange={event => revise({ proposedText: event.target.value, reviewedText: null })} placeholder="Write only the intention you would want the other person to read." /></label>
        <button type="button" className="kitchen-folio__secondary" onClick={() => { const proposed = clean(draft.proposedText); setMessage(proposed ? "Review the exact words below, then choose the deliberate action." : "There are no proposed words to review yet."); revise({ reviewedText: proposed || null }); }}>Review these exact words</button>
        {draft.reviewedText ? <aside className="kitchen-folio__review" aria-live="polite"><p>Reviewed proposed text</p><blockquote>{draft.reviewedText}</blockquote></aside> : null}
        {view === "household" ? <button type="button" disabled={working || !selected || draft.reviewedText !== clean(draft.proposedText)} onClick={saveSharedIntention}>Update this shared intention after review</button> : <p className="kitchen-folio__quiet">Personal experiences stay private here. Use the permanent private composer below to keep a note.</p>}
        <div className="kitchen-folio__routes"><button type="button" className="kitchen-folio__secondary" onClick={openPlan}>Continue in Plan Studio</button><button type="button" className="kitchen-folio__secondary" onClick={onOpenCalendar}>Open the Calendar</button><button type="button" className="kitchen-folio__hercules" onClick={onOpenHercules}>Ask the available Hercules about this</button></div>
      </section>
    </div>

    <section className="kitchen-folio__composer" aria-labelledby="kitchen-composer-title">
      <p className="kitchen-folio__eyebrow">Permanent private composer</p>
      <h2 id="kitchen-composer-title">A note for my own folio</h2>
      <p>It remains personal. It is never copied to Our Home by this page.</p>
      <textarea value={draft.noteText} onChange={event => revise({ noteText: event.target.value })} placeholder="Keep the thought, the invitation, or what a free evening could hold." />
      <button type="button" disabled={working || !clean(draft.noteText)} onClick={savePrivateNote}>Save to my private folio</button>
    </section>
    <footer className="kitchen-folio__recovery" aria-live="polite"><strong>Local recovery</strong><span>{pending ? "An original command is retained on this device until an acknowledgement is clear." : "This device has no retained command awaiting acknowledgement."}</span>{message ? <p>{message}</p> : <p>Today: {today}. No draft is silently shared or sent to Hercules.</p>}</footer>
  </section>;
}
