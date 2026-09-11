import { useEffect, useMemo, useRef, useState } from "react";
import { HERCULES_CAPABILITIES } from "./core/herculesCapabilities.ts";
import { companionFor, commitCompanion } from "./core/herculesCompanion.ts";
import { discoveryScope, discoverySelection, discoveryState, explainDiscovery, type DiscoveryInput, type DiscoveryCandidate, type DiscoveryDestination, type DiscoveryAnswer } from "./core/herculesDiscovery.ts";
import type { CompanionSuggestionState } from "./core/herculesCompanionContracts.ts";
import type { KitchenCommand } from "./kitchenCommand.ts";

export function HerculesDiscovery({ input, onCommand, onNavigate, onContinueChat, initialIssueId, blocked = false }: {
  initialIssueId?: string; input: DiscoveryInput; onCommand?: KitchenCommand; onNavigate: (destination: DiscoveryDestination) => void; onContinueChat?: () => void; blocked?: boolean;
}) {
  const scope = discoveryScope(input), current = useRef(input); current.current = input;
  const liveScope = useRef(scope); liveScope.current = scope;
  const lastShown = useRef(new Map<string, number>());
  const [clock, setClock] = useState(Date.now());
  const [selected, setSelected] = useState<string | null>(null), [payday, setPayday] = useState("");
  const [answer, setAnswer] = useState<{ issueId: string; value: DiscoveryAnswer } | null>(null);
  const [status, setStatus] = useState(""), [pending, setPending] = useState(false);
  const [retry, setRetry] = useState<{ state: CompanionSuggestionState; expectedState: CompanionSuggestionState | null; id: string } | null>(null);
  const answerRef = useRef<HTMLElement>(null);
  const [answerFocus, setAnswerFocus] = useState(0);
  useEffect(() => { if (answerFocus) { answerRef.current?.focus({ preventScroll: true }); answerRef.current?.scrollIntoView?.({ block: "nearest" }); } }, [answerFocus]);
  const latch = useRef(false), epoch = useRef(0);
  const lastScope = useRef(scope); if (lastScope.current !== scope) { lastScope.current = scope; epoch.current += 1; }
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  useEffect(() => { liveScope.current = scope; setSelected(null); setAnswer(null); setPayday(""); setRetry(null); setStatus(""); setPending(false); latch.current = false; lastShown.current = new Map(); return () => { liveScope.current = "closed"; epoch.current += 1; }; }, [scope]);
  useEffect(() => { setAnswer(previous => { if (!previous) return null; const value = explainDiscovery({ ...input, payday }, previous.issueId); return value ? { issueId: previous.issueId, value } : null; }); }, [input.household, input.fund, input.today, input.tab]);
  const selection = useMemo(() => discoverySelection({ ...input, now: clock, lastShown: lastShown.current }), [input.household, input.memberId, input.view, input.tab, input.today, input.accountId, input.fund, clock]);
  useEffect(() => { for (const row of selection.now) lastShown.current.set(row.issueId, Date.now()); }, [selection]);
  // Saved state and navigation use current props, not the stale card captured at click time.
  function fresh(id: string) { return discoverySelection(current.current).all.find(row => row.issueId === id); }
  function explain(id: string) {
    const value = explainDiscovery({ ...current.current, payday }, id);
    if (!value) { setAnswer(null); setStatus("That item has changed or is complete. Here are the current choices."); return; }
    setSelected(id); setAnswer({ issueId: id, value }); setAnswerFocus(current => current + 1); setStatus("");
  }
  useEffect(()=>{if(initialIssueId)explain(initialIssueId);},[scope,initialIssueId]);
  function navigate(id: string, entry?: "expense" | "income" | "transfer", factSource?: string) {
    if (blocked || !fresh(id)) { setAnswer(null); setStatus("That item is no longer available. Review the current choices."); return; }
    const value = explainDiscovery({ ...current.current, payday }, id);
    const destination = entry ? { kind: "entry" as const, mode: entry } : factSource !== undefined ? (() => { const match = value?.facts.find(fact => JSON.stringify(fact.source) === factSource); return match ? { kind: "source" as const, source: match.source } : undefined; })() : value?.destination;
    if (destination) onNavigate(destination);
  }
  async function save(state: CompanionSuggestionState, id: string = crypto.randomUUID(), expectedState?: CompanionSuggestionState | null) {
    if (!onCommand || latch.current) return;
    const existing = companionFor(current.current.household, current.current.memberId).suggestions;
    const predecessor = expectedState === undefined ? existing.find(row => row.issueId === state.issueId && row.view === state.view) ?? null : expectedState;
    const retained = existing.filter(row => !(row.status === "snoozed" && row.issueId.startsWith(`${row.capabilityId}:`) && Date.parse(row.until!) <= Date.now()));
    if (retained.length >= 100 && !retained.some(row => row.issueId === state.issueId && row.view === state.view)) {
      setStatus("Your saved suggestion choices are full. Existing choices are safe. Try again after a 24-hour pause expires; you can still use every activity."); return;
    }
    latch.current = true; setPending(true); setRetry(null); setStatus("Saving your choice…");
    const owner = scope, requestEpoch = epoch.current, profile = companionFor(current.current.household, current.current.memberId);
    let definitive = false, recovered = false;
    try {
      const result = await onCommand(household => commitCompanion(household, { version: 1, id, scope: profile.scope, operation: { kind: "suggestion.set", state, expectedRevision: state.revision, expectedState: predecessor } }), { confirmationId: id, recoverConfirmation: retry?.id === id, onRecoveredConfirmation: () => { recovered = true; }, onDefinitiveRejected: () => { definitive = true; } });
      if (liveScope.current !== owner || epoch.current !== requestEpoch) return;
      if (recovered) setStatus("Earlier choice confirmed. Your latest suggestion settings are kept.");
      else if (result?.ok && result.kind === "synchronized") setStatus(state.status === "disabled" ? "Suggestions for this activity are off for you." : state.status === "resume" ? "Kept in Continue with me." : state.until === "1970-01-01T00:00:00.000Z" ? "Choice updated for you." : "Set aside for 24 hours.");
      else { setStatus(definitive ? "Not saved. Review the current choices and try again when connected." : "Save not confirmed. Reconnect and retry; this choice is not marked saved."); if (!definitive) setRetry({ state, expectedState: predecessor, id }); }
    } catch { if (liveScope.current === owner && epoch.current === requestEpoch) { setStatus("Save not confirmed. Reconnect and retry."); setRetry({ state, expectedState: predecessor, id }); } }
    finally { if (liveScope.current === owner && epoch.current === requestEpoch) { latch.current = false; setPending(false); } }
  }
  function choose(row: DiscoveryCandidate, operation: "snooze" | "disable" | "enable" | "resume" | "clear") { void save(discoveryState(current.current, row, operation)); }
  const selectedRow = selection.all.find(row => row.issueId === selected);
  const visibleAnswer = answer && selection.all.some(row => row.issueId === answer.issueId) ? answer : null;
  const card = (row: DiscoveryCandidate, continuation = false) => <article key={row.issueId} className="hercules-discovery-card">
    <h4>{row.title}</h4><p>{row.why}</p><small>{row.source}</small>
    <button type="button" onClick={() => explain(row.issueId)}>{continuation ? "Continue this" : row.action}</button>
    <div className="hercules-discovery-choices">
      <button type="button" disabled={pending || !onCommand} onClick={() => choose(row, continuation ? "clear" : "snooze")}>{continuation ? "Remove bookmark" : "Not now"}</button>
      {!continuation && <button type="button" disabled={pending || !onCommand} onClick={() => choose(row, "disable")}>Don’t suggest this</button>}
    </div>
  </article>;
  return <section className="hercules-discovery" aria-label="How can I help?">
    <header><h2>How can I help?</h2><p>A little guidance, a proper explanation, or an outfit with unnecessary confidence.</p></header>
    <section aria-label="For you now"><h3>For you now</h3><p className="hercules-discovery-caption">From what is visible in this ledger.</p>
      {selection.now.length ? selection.now.map(row => card(row)) : <p>Nothing needs a nudge. Explore an activity below or ask me anything.</p>}
    </section>
    <details className="hercules-capability-catalogue"><summary>Things we can do</summary>
      {HERCULES_CAPABILITIES.map(definition => {
        const options = selection.all.filter(row => row.capabilityId === definition.id);
        if (!options.length) return null;
        const row = options.find(row => row.issueId === selected) ?? options[0]!;
        return <div className="hercules-capability" key={definition.id}><h4>{definition.outcome}</h4><p>{definition.example}</p>
          {options.length > 1 && <select aria-label={`Choose: ${definition.outcome}`} value={row.issueId} onChange={event => { setSelected(event.target.value); setAnswer(null); }}>{options.map(option => <option key={option.issueId} value={option.issueId}>{option.title}</option>)}</select>}
          <button type="button" onClick={() => explain(row.issueId)}>{row.action}</button>
        </div>;
      })}
    </details>
    {visibleAnswer && selectedRow && <section ref={answerRef} tabIndex={-1} className="hercules-discovery-answer" aria-label="Hercules explains">
      <h3>{selectedRow.title}</h3><p>{visibleAnswer.value.text}</p>
      {selectedRow.capabilityId === "bills-before-payday" && <form onSubmit={event => { event.preventDefault(); explain(selectedRow.issueId); }}><label>Next payday<input type="date" aria-label="Next payday" value={payday} min={input.today} onChange={event => { setPayday(event.target.value); setAnswer(current => current ? { ...current, value: { text: "Choose Show bills through payday to refresh this date.", facts: [] } } : null); }} /></label><button type="submit" disabled={!payday}>Show bills through payday</button></form>}
      {visibleAnswer.value.facts.map((fact) => <button type="button" key={fact.id} disabled={blocked} onClick={() => navigate(selectedRow.issueId, undefined, JSON.stringify(fact.source))}>{fact.label}: {fact.value}</button>)}
      {selectedRow.capabilityId === "guide-entry" && <div className="hercules-entry-choices">{(["expense", "income", "transfer"] as const).map(mode => <button type="button" key={mode} disabled={blocked} onClick={() => navigate(selectedRow.issueId, mode)}>Start {mode}</button>)}</div>}
      {visibleAnswer.value.destination && <button type="button" disabled={blocked} onClick={() => navigate(selectedRow.issueId)}>{visibleAnswer.value.action}</button>}
      {!["guide-entry", "dress-hercules", "explain-page"].includes(selectedRow.capabilityId) && <button type="button" disabled={pending || !onCommand} onClick={() => choose(selectedRow, "resume")}>Keep for later</button>}
    </section>}
    <section aria-label="Continue with me"><h3>Continue with me</h3>
      {selection.resume.length ? selection.resume.map(row => card(row, true)) : <p>Keep an activity for later and I’ll bring you back to its current state.</p>}
      {onContinueChat && <button type="button" onClick={onContinueChat}>Continue our conversation</button>}
    </section>
    {selection.disabled.size > 0 && <details><summary>Suggestion settings</summary><p>Activities you turned off stay available in Things we can do.</p>{[...selection.disabled].map(id => {
      const definition = HERCULES_CAPABILITIES.find(row => row.id === id)!;
      const row = selection.all.find(row => row.capabilityId === id) ?? { capabilityId: id } as DiscoveryCandidate;
      return <button key={id} type="button" disabled={pending || !onCommand} onClick={() => choose(row, "enable")}>Suggest again: {definition.outcome}</button>;
    })}</details>}
    <p role="status" className="companion-save-status">{status}</p>
    {retry && <button type="button" disabled={pending} onClick={() => void save(retry.state, retry.id, retry.expectedState)}>Retry suggestion save</button>}
  </section>;
}
