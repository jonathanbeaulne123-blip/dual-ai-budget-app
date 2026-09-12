import { useState } from "react";
import { freshDemoSeed } from "./core/demoRandom.ts";
import { previewQuickSampleScenario, quickSampleAccounts, type QuickSampleInput } from "./core/quickSampleData.ts";
import type { Household } from "./core/types.ts";
import { Whisper } from "./theme/Whisper.tsx";

export function QuickSamplePanel({ household, memberId, visibility, today, busy, onReview }: {
  household: Household; memberId: string; visibility: QuickSampleInput["visibility"]; today: string; busy: boolean;
  onReview: (input: QuickSampleInput, preview: ReturnType<typeof previewQuickSampleScenario>) => void;
}) {
  const [months, setMonths] = useState(3);
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState("");
  const accounts = quickSampleAccounts(household, memberId, visibility);
  const selected = accounts.some(a => a.id === accountId) ? accountId : accounts[0]?.id ?? "";
  return <div className="paper-panel sample-data-panel" data-testid="quick-sample-panel">
    <p className="kicker">Explore the everyday widgets</p>
    <h3>Quick sample data</h3>
    <Whisper mode="line">A fictional story of pay, bills and outings, added to this {visibility === "personal" ? "Personal" : "Shared"} ledger.</Whisper>
    <div className="sample-data-fields">
      <label>History + future<select aria-label="Sample history" value={months} disabled={busy} onChange={e => { setMonths(Number(e.target.value)); setError(""); }}>
        {[3, 4, 5, 6].map(n => <option key={n} value={n}>{n} months each</option>)}
      </select></label>
      <label>Add to account<select aria-label="Sample account" value={selected} disabled={busy} onChange={e => { setAccountId(e.target.value); setError(""); }}>
        {!accounts.length && <option value="">Add a cash account first</option>}
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select></label>
    </div>
    <Whisper mode="line">Existing entries stay. Fictional entries change this account’s balance after Confirm.</Whisper>
    <Whisper mode="aside" id="sample.details">Future expenses stay planned until posted. If you already added history, this adds only the missing future plans. One small set per person and ledger view.</Whisper>
    <button className="primary" disabled={busy || !selected} onClick={() => {
      try {
        const input: QuickSampleInput = { storyVersion: 1, today, months, seed: freshDemoSeed(), memberId, accountId: selected, visibility };
        onReview(input, previewQuickSampleScenario(household, input)); setError("");
      } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    }}>Quick sample data</button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
