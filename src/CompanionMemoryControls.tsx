import { useEffect, useRef, useState } from "react";
import type { Household, LedgerView } from "./core/types.ts";
import type { KitchenCommand } from "./kitchenCommand.ts";
import { companionFor, commitCompanion } from "./core/herculesCompanion.ts";
import type { CompanionOperation, CompanionPreferenceKey } from "./core/herculesCompanionContracts.ts";

const fields: { key: CompanionPreferenceKey; label: string; options: string[] }[] = [
  { key: "answerLength", label: "Answer length", options: ["concise", "detailed"] },
  { key: "explanationStyle", label: "Explanations", options: ["plain", "step-by-step", "examples"] },
  { key: "humour", label: "Humour", options: ["gentle", "playful", "off"] },
  { key: "favouriteColours", label: "Favourite colour", options: ["cream", "white", "black", "brown", "red", "orange", "yellow", "green", "blue", "purple", "pink", "silver", "brass", "rose-gold"] },
];

export function CompanionMemoryControls({ household, memberId, view, onCommand }: {
  household: Household; memberId: string; view: LedgerView; onCommand?: KitchenCommand;
}) {
  const profile = companionFor(household, memberId);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [retry, setRetry] = useState<{ operation: CompanionOperation; id: string } | null>(null);
  const scopeKey = `${household.environment}/${household.householdId}/${memberId}/${view}`;
  const currentScope = useRef(scopeKey), epoch = useRef(0), latch = useRef(false);
  if (currentScope.current !== scopeKey) { currentScope.current = scopeKey; epoch.current += 1; }
  useEffect(() => { currentScope.current = scopeKey; setPending(false); latch.current = false; setRetry(null); setStatus(""); return () => { currentScope.current = "closed"; epoch.current += 1; }; }, [scopeKey]);
  async function save(operation: CompanionOperation, id: string = crypto.randomUUID()) {
    if (!onCommand || latch.current) return;
    const owner = scopeKey, generation = epoch.current, recovering = retry?.id === id;
    latch.current = true;
    setPending(true); setStatus("Saving…"); setRetry(null);
    let definitive = false, recovered = false;
    try {
      const outcome = await onCommand(current => commitCompanion(current, { version: 1, id, scope: profile.scope, operation }), { confirmationId: id, recoverConfirmation: recovering, onRecoveredConfirmation: () => { recovered = true; }, onDefinitiveRejected: () => { definitive = true; } });
      if (currentScope.current !== owner || epoch.current !== generation) return;
      if (recovered) setStatus("Earlier save confirmed. Your latest preferences and conversation are kept.");
      else if (outcome?.kind === "synchronized" && outcome.ok) setStatus(operation.kind === "preference.forget" ? "Forgotten." : operation.kind === "conversation.clear" ? "Conversation cleared. Your preferences are unchanged." : "Saved for you.");
      else if (definitive) { setStatus("Not saved. Your preferences may have changed or saving is unavailable. Review the current choices and try again."); }
      else { setStatus("Save not confirmed. Reconnect and retry; no preference is marked saved yet."); setRetry({ operation, id }); }
    } catch { if (currentScope.current === owner && epoch.current === generation) { setStatus("Save not confirmed. Retry after reconnecting."); setRetry({ operation, id }); } }
    finally { if (currentScope.current === owner && epoch.current === generation) { latch.current = false; setPending(false); } }
  }
  return <details className="companion-memory">
    <summary>What Hercules remembers</summary>
    <div className="companion-memory-inner">
      <p className="companion-memory-intro">A few little things that make this feel like us.</p>
      <p>Private to you in this household. Shared-view and Personal-view conversations stay separate.</p>
      <label className="companion-memory-toggle"><input type="checkbox" checked={profile.remembering.enabled} disabled={pending || !onCommand}
        onChange={event => void save({ kind: "remembering.set", enabled: event.target.checked, expectedRevision: profile.remembering.revision })} />
        Remember helpful preferences from conversation</label>
      <p className="muted">Only explicit preferences such as “keep answers short” or “my favourite colour is pink.” Turning this off stops new automatic preferences; you can still edit or forget these.</p>
      {fields.map(field => {
        const row = profile.preferences.find(item => item.key === field.key);
        return <div className="companion-memory-field" key={field.key}>
          <label><span>{field.label}</span><select aria-label={field.label} value={Array.isArray(row?.value) ? row.value[0] ?? "" : row?.value ?? ""} disabled={pending || !onCommand}
            onChange={event => { if (!event.target.value) { if (row?.value != null) void save({ kind: "preference.forget", key: field.key, expectedRevision: row.revision }); return; } void save({ kind: "preference.set", key: field.key, value: field.key === "favouriteColours" ? [event.target.value] : event.target.value, expectedRevision: row?.revision ?? 0, origin: { kind: "manual" } }); }}>
            <option value="">Hercules chooses</option>{field.options.map(option => <option key={option} value={option}>{option.replaceAll("-", " ")}</option>)}
          </select></label>
          {row?.value != null && <button type="button" disabled={pending || !onCommand} onClick={() => void save({ kind: "preference.forget", key: field.key, expectedRevision: row.revision })}>Forget<span className="sr-only"> {field.label.toLowerCase()}</span></button>}
        </div>;
      })}
      {profile.preferences.filter(row => row.value != null && !fields.some(field => field.key === row.key)).map(row => <div key={row.key}><span>{row.key}: {String(row.value)}</span><button type="button" disabled={pending || !onCommand} onClick={() => void save({ kind: "preference.forget", key: row.key, expectedRevision: row.revision })}>Forget</button></div>)}
      <p className="muted">Recent conversations: up to 30 days and 300 messages per view. Old messages are excluded from context and removed on your next private save. Clearing starts a fresh conversation.</p>
      <button type="button" disabled={pending || !onCommand} onClick={() => void save({ kind: "conversation.clear", view, expectedGeneration: profile.conversations.find(row => row.view === view)!.generation })}>Clear my {view === "personal" ? "Personal" : "Shared"}-view conversation</button>
      {!onCommand && <p>Connect to your household to save preferences.</p>}
      <p role="status">{status}</p>
      {retry && <button type="button" disabled={pending} onClick={() => void save(retry.operation, retry.id)}>Retry private save</button>}
    </div>
  </details>;
}
