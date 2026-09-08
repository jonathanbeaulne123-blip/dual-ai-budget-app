import { useEffect, useRef, useState } from 'react';
import { todayKey } from './core/calendar.ts';
import { formatCad } from './core/money.ts';
import { isVisibleInView } from './core/visibility.ts';
import { discardStatementDraft, emptyStatementDraft, loadStatementDraft, saveStatementDraft, saveStatementSuggestionHandoff, statementScopeKey } from './imports/statementSetup/drafts.ts';
import { mergeStatementSource, newStatementSource, parseStatementExport, scanStatementPages, statementFileHash, statementFileKind, statementHistoryInput, verifyStatementAttachment } from './imports/statementSetup/intake.ts';
import { assertStatementPdfLimits, openStatementPdf, selectedStatementPages, type StatementPdf } from './imports/statementSetup/pdf.ts';
import { statementSetupSuggestions } from './imports/statementSetup/suggestions.ts';
import type { StatementSetupDraft, StatementSetupProps, StatementSetupRow } from './imports/statementSetup/types.ts';
import './statement-setup.css';
export type { StatementSetupDraft, StatementSetupProps, StatementHistoryInput } from './imports/statementSetup/types.ts';

type Attachment = { file: File; hash: string; pdf?: StatementPdf };
export function StatementSetup({ household, memberId, authUserId, view, onReviewHistory, onUseSuggestions, acceptedCoverage, onDone }: StatementSetupProps) {
  const scope = { environment: household.environment, householdId: household.householdId, memberId, authUserId, view };
  const key = statementScopeKey(scope);
  const [draft, setDraft] = useState<StatementSetupDraft>(() => emptyStatementDraft(scope));
  const draftRef = useRef(draft); draftRef.current = draft;
  const [loaded, setLoaded] = useState(false), [scopeChosen, setScopeChosen] = useState(false);
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null), [pages, setPages] = useState('');
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [suggestionMessage, setSuggestionMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null), reattachRef = useRef<HTMLInputElement>(null), expectedHash = useRef('');
  const attachments = useRef(new Map<string, Attachment>());
  const generation = useRef(0), renderedKey = useRef(key), abortRef = useRef<AbortController | null>(null);
  if (renderedKey.current !== key) { renderedKey.current = key; generation.current += 1; abortRef.current?.abort(); }
  const activeKey = useRef(key); activeKey.current = key;
  const saves = useRef<Promise<void>>(Promise.resolve());
  const saveVersion = useRef(0);
  function update(next: StatementSetupDraft) {
    if (statementScopeKey(next.scope) !== activeKey.current) return;
    draftRef.current = next; setDraft(next); setSaved(false);
    const start = generation.current, version = ++saveVersion.current;
    saves.current = saves.current.catch(() => {}).then(() => saveStatementDraft(next)).then(() => { if (start === generation.current && version === saveVersion.current) setSaved(true); }).catch(cause => { if (start === generation.current) { setSaved(false); setError(cause instanceof Error ? cause.message : String(cause)); } });
  }
  useEffect(() => {
    const start = ++generation.current;
    setLoaded(false); setScopeChosen(false); setBusy(false); setAttachment(null); setPages(''); setSelectedSuggestions([]); setSuggestionMessage(''); setError(''); setPreviewUrl(null);
    for (const item of attachments.current.values()) void item.pdf?.close();
    attachments.current.clear();
    const empty = emptyStatementDraft(scope); draftRef.current = empty; setDraft(empty);
    void loadStatementDraft(scope).then(stored => { if (start === generation.current) { const next = stored ?? empty; draftRef.current = next; setDraft(next); setSaved(Boolean(stored)); setLoaded(true); } }).catch(cause => { if (start === generation.current) { setError(cause instanceof Error ? cause.message : String(cause)); setLoaded(true); setSaved(false); } });
    return () => { generation.current += 1; abortRef.current?.abort(); };
  }, [key]);
  useEffect(() => () => { for (const item of attachments.current.values()) void item.pdf?.close(); }, []);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const currentDraft = statementScopeKey(draft.scope) === key ? draft : null;
  const accounts = household.accounts.filter(account => account.active && (view === 'personal' ? account.scope === 'personal' && account.ownerMemberId === memberId : account.scope !== 'personal'));
  const visibleTransactions = household.transactions.filter(row => isVisibleInView(row, memberId, view));
  const suggestions = currentDraft ? statementSetupSuggestions({ household, scope, draft: currentDraft, today: todayKey(new Date(), household.timezone), acceptedCoverage }) : { suggestions: [], estimateStatus: '' };
  async function attach(file: File, reattach = false) {
    const start = generation.current;
    setBusy(true); setError('');
    let pdf: StatementPdf | undefined;
    try {
      const kind = statementFileKind(file);
      if (kind === 'pdf') assertStatementPdfLimits(file.size);
      else if (file.size > (kind === 'image' ? 10 : 20) * 1024 * 1024) throw new Error('This file is too large. Use a smaller complete statement.');
      const hash = await statementFileHash(file);
      if (reattach) await verifyStatementAttachment(file, expectedHash.current);
      if (kind === 'pdf') pdf = await openStatementPdf(file);
      if (start !== generation.current) { await pdf?.close(); return; }
      if (!reattach && currentDraft?.sources.some(source => source.hash === hash)) throw new Error('This source is already in your draft. Use Reattach / review to avoid adding it twice.');
      const item = { file, hash, pdf };
      await attachments.current.get(hash)?.pdf?.close(); attachments.current.set(hash, item); setAttachment(item); setPages('');
      if (reattach) { setPreviewUrl(URL.createObjectURL(file)); return; }
      if (kind === 'ofx' || kind === 'qfx') {
        const parsed = await parseStatementExport(file, household, scope);
        if (start === generation.current) update(mergeStatementSource(draftRef.current, parsed.source, parsed.rows));
      } else {
        const source = newStatementSource(hash, file.name, kind, pdf?.pageCount ?? 1);
        update(mergeStatementSource(draftRef.current, source, []));
      }
    } catch (cause) { await pdf?.close(); if (start === generation.current) setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { if (start === generation.current) setBusy(false); if (inputRef.current) inputRef.current.value = ''; if (reattachRef.current) reattachRef.current.value = ''; }
  }
  async function scan() {
    if (!attachment || !scopeChosen || busy) return;
    const start = generation.current, base = draftRef.current;
    const source = base.sources.find(item => item.hash === attachment.hash);
    if (!source || source.kind === 'ofx' || source.kind === 'qfx') return;
    const controller = new AbortController(); abortRef.current = controller;
    setBusy(true); setError('');
    try {
      const selected = selectedStatementPages(pages, source.pageCount);
      const result = await scanStatementPages({ file: attachment.file, source, selectedPages: selected, household, scope, pdf: attachment.pdf, signal: controller.signal,
        onPage: (next, rows) => { if (start === generation.current) update(mergeStatementSource(draftRef.current, next, rows)); } });
      if (start === generation.current) update(mergeStatementSource(draftRef.current, result.source, result.rows));
    } catch (cause) { if (start === generation.current) setError(controller.signal.aborted ? 'Reading stopped. Finished pages remain in your draft; reattach or retry to finish.' : cause instanceof Error ? cause.message : String(cause)); }
    finally { if (start === generation.current) setBusy(false); }
  }
  function patchRow(id: string, patch: Partial<StatementSetupRow>) {
    const previousPair = draftRef.current.rows.find(row => row.id === id)?.transferPairRowId;
    const pairing = Object.prototype.hasOwnProperty.call(patch, 'transferPairRowId');
    update({ ...draftRef.current, rows: draftRef.current.rows.map(row => {
      if (row.id === id) return { ...row, ...patch };
      if (pairing && row.id === patch.transferPairRowId) return { ...row, transferPairRowId: id };
      if (pairing && (row.id === previousPair || row.transferPairRowId === id || row.transferPairRowId === patch.transferPairRowId)) return { ...row, transferPairRowId: '' };
      return row;
    }), sources: draftRef.current.sources.map(source => ({ ...source, reviewed: false })) });
  }
  async function discard() {
    const start = ++generation.current; abortRef.current?.abort();
    try { await saves.current; await discardStatementDraft(scope); if (start !== generation.current) return; const next = emptyStatementDraft(scope); setDraft(next); draftRef.current = next; setSaved(false); setAttachment(null); setDiscarding(false); setError(''); setBusy(false); for (const item of attachments.current.values()) await item.pdf?.close(); attachments.current.clear(); }
    catch (cause) { if (start === generation.current) setError(cause instanceof Error ? cause.message : String(cause)); }
  }
  return <section className="statement-setup" aria-labelledby="statement-setup-title" aria-busy={busy}>
    <header className="statement-setup__heading"><span aria-hidden="true" className="statement-setup__stamp">From your statement</span><h2 id="statement-setup-title">A little less typing</h2><p>Bring a statement to the table. We’ll help you review its accounts, history and useful starting points.</p></header>
    <p className="statement-setup__local" role="status">{!loaded ? 'Opening your local draft…' : saved ? 'Draft saved on this device, for your signed-in account only.' : 'Local draft — not yet saved.'} Raw files stay temporary; reattach the original to view it after returning.</p>
    <label className="statement-setup__scope"><input type="checkbox" checked={scopeChosen} disabled={busy} onChange={event => setScopeChosen(event.target.checked)} />This statement belongs in {view === 'personal' ? 'my Personal books' : 'Shared household books'}.</label>
    <p className="statement-setup__hint">Choose Personal books before attaching a private statement. PDFs open on this device; selected PDF pages and images go to the existing document scanner only when you choose Read pages. OFX/QFX exports are read locally.</p>
    <div className="statement-setup__actions"><button type="button" disabled={!loaded || !scopeChosen || busy} className="primary" onClick={() => inputRef.current?.click()}>Choose statement</button><span>PDF · OFX · QFX · JPEG · PNG · WebP</span></div>
    <p className="statement-setup__hint">PDF: up to 20 MB and 50 pages. Photos: up to 10 MB each. Use an unlocked PDF copy.</p>
    <input ref={inputRef} hidden type="file" accept=".pdf,.ofx,.qfx,image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void attach(file); }} />
    <input ref={reattachRef} hidden type="file" accept=".pdf,.ofx,.qfx,image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) void attach(file, true); }} />
    {attachment && currentDraft?.sources.some(source => source.hash === attachment.hash && (source.kind === 'pdf' || source.kind === 'image')) && <div className="statement-setup__reader"><strong>{attachment.file.name}</strong><label>Pages to read<input value={pages} placeholder={`All ${attachment.pdf?.pageCount ?? 1} pages`} disabled={busy} onChange={event => setPages(event.target.value)} /></label><p>Use 1-3, 5 to select pages. Every omitted page stays visible for your review. Reading again replaces this source’s extracted rows and their review choices.</p><button type="button" className="primary" disabled={busy || !scopeChosen} onClick={() => void scan()}>Read pages</button>{busy && <button type="button" onClick={() => abortRef.current?.abort()}>Stop reading</button>}</div>}
    {error && <p className="statement-setup__error" role="alert">{error}</p>}
    {previewUrl && <details className="statement-setup__preview" open><summary>Original attached source</summary><object data={previewUrl} aria-label="Original statement preview"><a href={previewUrl} target="_blank" rel="noreferrer">Open attached source</a></object></details>}
    <fieldset className="statement-setup__review" disabled={busy}>{currentDraft?.sources.map(source => <article className="statement-setup__source" key={source.hash}><header><h3>{source.name}</h3><span>{source.pageCount} page{source.pageCount === 1 ? '' : 's'} · {source.kind.toUpperCase()}</span></header><button type="button" disabled={busy || !scopeChosen} onClick={() => { const found = attachments.current.get(source.hash); if (found) { setAttachment(found); setPreviewUrl(URL.createObjectURL(found.file)); } else { expectedHash.current = source.hash; reattachRef.current?.click(); } }}>Reattach / review original</button>
      {source.warnings.map((warning, index) => <p className="statement-setup__warning" key={index}>{warning}</p>)}
      <div className="statement-setup__pages">{source.pages.map(page => <div key={page.page}><strong>Page {page.page}: {page.status}</strong>{page.warnings.map((warning, index) => <p className="statement-setup__warning" key={index}>{warning}</p>)}{page.status === 'omitted' && <label>Why this page has no history to import<input value={page.omissionReason} onChange={event => update({ ...currentDraft, sources: currentDraft.sources.map(item => item.hash === source.hash ? { ...item, reviewed: false, pages: item.pages.map(p => p.page === page.page ? { ...p, omissionReason: event.target.value, reviewed: false } : p) } : item) })} /></label>}
      <label><input type="checkbox" disabled={busy || page.status === 'failed' || page.status === 'pending'} checked={page.reviewed} onChange={event => update({ ...currentDraft, sources: currentDraft.sources.map(item => item.hash === source.hash ? { ...item, reviewed: false, pages: item.pages.map(p => p.page === page.page ? { ...p, reviewed: event.target.checked } : p) } : item) })} />I checked this page against the source.</label></div>)}</div>
    </article>)}
    {currentDraft?.accounts.length ? <section className="statement-setup__checkpoints"><h3>Match accounts and balances</h3><p>Use the balance at the end of the day before this history starts, and the closing balance on the statement. Debt owed is negative; an overpayment is positive. Missing and zero are different.</p>{currentDraft.accounts.map((mapping, index) => <fieldset key={mapping.accountRef}><legend>Statement account {index + 1}</legend><label>Account<select value={mapping.accountId} onChange={event => update({ ...currentDraft, accounts: currentDraft.accounts.map(item => item.accountRef === mapping.accountRef ? { ...item, accountId: event.target.value } : item) })}><option value="">Choose an account…</option>{accounts.map(account => <option value={account.id} key={account.id}>{account.name}{account.last4 ? ` · ${account.last4}` : ''}</option>)}</select></label>{(['openingDate', 'openingBalance', 'closingDate', 'closingBalance'] as const).map(field => <label key={field}>{({ openingDate: 'Opening as of', openingBalance: 'Signed opening balance (CAD)', closingDate: 'Closing as of', closingBalance: 'Signed closing balance (CAD)' })[field]}<input type={field.endsWith('Date') ? 'date' : 'text'} inputMode={field.endsWith('Date') ? undefined : 'decimal'} value={mapping[field]} onChange={event => update({ ...currentDraft, accounts: currentDraft.accounts.map(item => item.accountRef === mapping.accountRef ? { ...item, [field]: event.target.value } : item) })} /></label>)}</fieldset>)}</section> : null}
    {currentDraft?.rows.length ? <section><h3>Review the history</h3><p>Every extracted row is shown. Check dates, amounts, transfers and categories before the balance review.</p><div className="statement-setup__rows">{currentDraft.rows.map(row => <article key={row.id} className="statement-setup__row"><header><strong>{row.note || 'Statement transaction'}</strong><span>Page {row.page} · {formatCad(row.amountCents)}</span></header><label>Date<input type="date" value={row.date} onChange={event => patchRow(row.id, { date: event.target.value as StatementSetupRow['date'] })} /></label><label>Amount (CAD)<input inputMode="decimal" value={(row.amountCents / 100).toFixed(2)} onChange={event => { const cents = Math.round(Number(event.target.value) * 100); patchRow(row.id, { amountCents: Number.isSafeInteger(cents) ? cents : 0, signedAmountCents: (row.signedAmountCents < 0 ? -1 : 1) * cents }); }} /></label><label>Type<select value={row.type} onChange={event => patchRow(row.id, { type: event.target.value as StatementSetupRow['type'], subcategoryId: '' })}>{['unknown', 'expense', 'income', 'refund', 'transfer'].map(type => <option key={type}>{type}</option>)}</select></label>
      {row.type === 'transfer' ? <label>Other account<select value={row.transferAccountId} onChange={event => patchRow(row.id, { transferAccountId: event.target.value })}><option value="">Choose…</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label> : <label>Category<select value={row.subcategoryId} onChange={event => patchRow(row.id, { subcategoryId: event.target.value })}><option value="">Choose…</option>{household.categories.filter(category => category.active && category.recordType === 'category' && category.transactionType === (row.type === 'income' ? 'income' : 'expense')).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>}
      {row.type === 'transfer' && <label>Matching row from the other statement<select value={row.transferPairRowId} onChange={event => patchRow(row.id, { transferPairRowId: event.target.value })}><option value="">No paired statement row</option>{currentDraft.rows.filter(candidate => candidate.id !== row.id && candidate.type === 'transfer' && candidate.date === row.date && candidate.amountCents === row.amountCents).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.sourceName} · page {candidate.page} · {candidate.note}</option>)}</select></label>}
      <label>Decision<select value={row.decision} onChange={event => patchRow(row.id, { decision: event.target.value as StatementSetupRow['decision'] })}><option value="post">Import this row</option><option value="retain">Keep the existing transaction</option><option value="exclude">Exclude this extracted row</option></select></label>{row.decision === 'exclude' && <label>Reason for excluding<input value={row.exclusionReason} onChange={event => patchRow(row.id, { exclusionReason: event.target.value })} /></label>}{row.decision === 'retain' && <label>Existing transaction<select value={row.retainedTransactionId} onChange={event => patchRow(row.id, { retainedTransactionId: event.target.value })}><option value="">Choose exact existing row…</option>{visibleTransactions.filter(tx => tx.amountCents === row.amountCents && tx.date === row.date).map(tx => <option key={tx.id} value={tx.id}>{tx.date} · {tx.note} · {formatCad(tx.amountCents)}</option>)}</select></label>}<details><summary>Source reference</summary><p className="statement-setup__provenance">{row.sourceName} · page {row.page}<br />{row.sourceIdentity}</p></details></article>)}</div></section> : null}
    {currentDraft?.sources.map(source => <label className="statement-setup__attestation" key={source.hash}><input type="checkbox" checked={source.reviewed} disabled={busy || source.pages.some(page => !page.reviewed)} onChange={event => update({ ...currentDraft, sources: currentDraft.sources.map(item => item.hash === source.hash ? { ...item, reviewed: event.target.checked } : item) })} />I reviewed {source.name}, its warnings and excluded rows. The mapped dates and balances cover the history I am bringing in.</label>)}
    </fieldset>{currentDraft?.sources.length ? <div className="statement-setup__actions"><button type="button" className="primary" disabled={busy} onClick={() => { try { const input = statementHistoryInput(currentDraft); void Promise.resolve(onReviewHistory(input, currentDraft.id)).catch(cause => setError(cause instanceof Error ? cause.message : String(cause))); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } }}>Review account history</button><button type="button" disabled={busy} onClick={() => setDiscarding(true)}>Discard local draft</button></div> : null}
    {discarding && <div className="statement-setup__discard" role="group" aria-label="Discard statement draft"><p>Discard these local statement notes? Accepted books will stay as they are.</p><button type="button" onClick={() => void discard()}>Discard draft</button><button type="button" onClick={() => setDiscarding(false)}>Keep draft</button></div>}
    {currentDraft && <section className="statement-setup__suggestions"><h3>Starting points, when you’re ready</h3><p>{suggestions.estimateStatus}</p>{suggestions.suggestions.map(suggestion => <label key={suggestion.id}><input type="checkbox" checked={selectedSuggestions.includes(suggestion.id)} onChange={event => setSelectedSuggestions(current => event.target.checked ? [...current, suggestion.id] : current.filter(id => id !== suggestion.id))} /><span><strong>{suggestion.kind}: {suggestion.label}{suggestion.amountCents != null ? ` · ${formatCad(suggestion.amountCents)}` : ''}</strong><small>{suggestion.reason}</small></span></label>)}<button type="button" disabled={!selectedSuggestions.length || busy} onClick={() => { const start = generation.current; const selected = suggestions.suggestions.filter(item => selectedSuggestions.includes(item.id)); void saveStatementSuggestionHandoff(scope, selected).then(() => { if (start !== generation.current) return; setSuggestionMessage('Selected starting points saved for your setup. Review recurring suggestions in Calendar before adopting.'); return onUseSuggestions?.(selected); }).catch(cause => { if (start === generation.current) setError(cause instanceof Error ? cause.message : String(cause)); }); }}>Use selected starting points</button>{suggestionMessage && <p role="status">{suggestionMessage}</p>}</section>}
    {onDone && <button type="button" className="ghost" disabled={busy} onClick={onDone}>Return to setup</button>}
  </section>;
}
