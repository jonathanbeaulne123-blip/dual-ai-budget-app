import { parseOfx } from '../../core/importInbox/ofx.ts';
import { visionDocumentRows } from '../../core/importInbox/vision.ts';
import { prepareImportRows } from '../../core/importInbox/triage.ts';
import { suggestCategory, shouldPrefillCategory } from '../../core/autoCode.ts';
import { isVisibleInView } from '../../core/visibility.ts';
import { isValidDateKey } from '../../core/calendar.ts';
import type { Household } from '../../core/types.ts';
import { scanFinancialDocument } from '../documentScanner.ts';
import type { StatementDraftScope, StatementHistoryInput, StatementSetupDraft, StatementSetupRow, StatementSource } from './types.ts';
import type { StatementPdf } from './pdf.ts';

/** Preserve incomplete typing in the UI; only positive, exact cents become normalized evidence. */
export function statementAmountCents(text: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(text.trim())) return null;
  const cents = Math.round(Number(text) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export async function statementFileHash(file: Blob): Promise<string> {
  if (!crypto.subtle) throw new Error('A secure browser is required to fingerprint statement files.');
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function verifyStatementAttachment(file: File, expectedHash: string): Promise<void> {
  if (await statementFileHash(file) !== expectedHash) throw new Error('That is a different file. Reattach the original statement, or add this as a new source.');
}
export function statementFileKind(file: File): StatementSource['kind'] {
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') return 'pdf';
  if (/\.ofx$/i.test(file.name)) return 'ofx';
  if (/\.qfx$/i.test(file.name)) return 'qfx';
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'image';
  throw new Error('Use PDF, OFX, QFX, JPEG, PNG, or WebP. CSV, Excel and HEIC files are not supported here.');
}
export function prepareStatementRows(household: Household, scope: StatementDraftScope, rows: Parameters<typeof prepareImportRows>[0]['rows'], page: number): StatementSetupRow[] {
  const eligibleAccounts = household.accounts.filter(account => account.active && (scope.view === 'personal'
    ? account.scope === 'personal' && account.ownerMemberId === scope.memberId : account.scope !== 'personal'));
  const eligible = { ...household, accounts: eligibleAccounts, transactions: household.transactions.filter(row => isVisibleInView(row, scope.memberId, scope.view)) };
  const prepared = prepareImportRows({ household: eligible, memberId: scope.memberId, view: scope.view, rows });
  return prepared.map(row => {
    const categoryType = row.type === 'refund' ? 'expense' : row.type;
    const words = ` ${`${row.note} ${row.place}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
    const named = household.categories.filter(category => category.active && category.recordType === 'category' && category.transactionType === categoryType
      && words.includes(` ${category.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `));
    const guess = row.type === 'expense' ? suggestCategory(eligible, row.note, row.place) : null;
    const subcategoryId = named.length === 1 ? named[0]!.id : shouldPrefillCategory(guess) ? guess!.subcategoryId : '';
    return { ...row, type: ['income','expense','refund','transfer'].includes(row.type) ? row.type as 'income'|'expense'|'refund'|'transfer' : 'unknown', sourceIdentity: row.provenanceId, page, subcategoryId, transferPairRowId: '', decision: 'post', exclusionReason: '', retainedTransactionId: '' };
  });
}
export function newStatementSource(hash: string, name: string, kind: StatementSource['kind'], pageCount: number): StatementSource {
  return { hash, name, kind, pageCount, pages: Array.from({ length: pageCount }, (_, i) => ({ page: i + 1, status: 'pending', warnings: [], reviewed: false, omissionReason: '' })), checkpoints: [], periodStart: null, periodEnd: null, reviewed: false, warnings: [] };
}
export async function parseStatementExport(file: File, household: Household, scope: StatementDraftScope): Promise<{ source: StatementSource; rows: StatementSetupRow[] }> {
  const kind = statementFileKind(file);
  if (kind !== 'ofx' && kind !== 'qfx') throw new Error('Choose an OFX or QFX bank export.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a bank export of 20 MB or less.');
  const hash = await statementFileHash(file), bytes = await file.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(bytes);
  if (/CHARSET\s*:\s*(?:1252|WINDOWS-1252)/i.test(text.slice(0,1200))) text = new TextDecoder('windows-1252').decode(bytes);
  const parsed = parseOfx(text, file.name);
  const source = newStatementSource(hash, file.name, kind, 1);
  source.warnings = parsed.warnings;
  source.pages[0] = { page: 1, status: 'scanned', reviewed: false, omissionReason: '', warnings: [...parsed.warnings] };
  const refs = new Map<string, string>();
  for (const account of parsed.accounts) {
    const ref = `account:${await statementFileHash(new Blob([account.accountRef]))}:source:${hash}`;
    refs.set(account.accountRef, ref);
    const start = account.periodStart ?? null, end = account.periodEnd ?? account.ledgerBalanceDate;
    const openingDate = start ? previousStatementDate(start) : null;
    source.checkpoints.push({ accountRef: ref, accountLast4: account.accountLast4, kind: 'opening', date: openingDate, signedBalanceCents: account.openingBalanceCents, page: 1, sourceHash: hash, periodStart: start, periodEnd: end },
      { accountRef: ref, accountLast4: account.accountLast4, kind: 'closing', date: account.ledgerBalanceDate, signedBalanceCents: account.ledgerBalanceCents, page: 1, sourceHash: hash, periodStart: start, periodEnd: end });
    source.periodStart = source.periodStart && start ? (source.periodStart < start ? source.periodStart : start) : start;
    source.periodEnd = source.periodEnd && end ? (source.periodEnd > end ? source.periodEnd : end) : end;
  }
  const rows = parsed.rows.map(row => ({ ...row, sourceHash: hash, accountRef: refs.get(row.accountRef)!,
    provenanceId: row.fitId ? `${kind}:${refs.get(row.accountRef)!.split(':source:')[0]}:${row.fitId}` : `${kind}:${hash}:${row.id}` }));
  return { source, rows: prepareStatementRows(household, scope, rows, 1) };
}
export function previousStatementDate(date: string): string {
  const day = new Date(`${date}T00:00:00.000Z`); day.setUTCDate(day.getUTCDate() - 1); return day.toISOString().slice(0, 10);
}
export type StatementScanAdapter = typeof scanFinancialDocument;
/** Selected pages are sequential. A failed page is retained visibly, never represented as a complete source. */
export async function scanStatementPages(input: {
  file: File; source: StatementSource; selectedPages: number[]; household: Household; scope: StatementDraftScope;
  pdf?: StatementPdf; signal?: AbortSignal; scan?: StatementScanAdapter;
  onPage?: (source: StatementSource, rows: StatementSetupRow[]) => Promise<void> | void;
}): Promise<{ source: StatementSource; rows: StatementSetupRow[] }> {
  const source = structuredClone(input.source), rows: StatementSetupRow[] = [];
  if (!input.selectedPages.length || input.selectedPages.some(page => !Number.isInteger(page) || page < 1 || page > source.pageCount)) throw new Error('Choose at least one valid statement page.');
  const selected = new Set(input.selectedPages);
  source.pages = source.pages.map(page => ({ ...page, status: selected.has(page.page) ? 'pending' : 'omitted', reviewed: false }));
  source.reviewed = false; source.checkpoints = [];
  for (const page of source.pages) {
    input.signal?.throwIfAborted();
    if (page.status === 'omitted') continue;
    try {
      const file = input.pdf ? await input.pdf.renderPage(page.page, input.signal) : input.file;
      const scanned = await (input.scan ?? scanFinancialDocument)(file, fetch, { documentHint: 'bank-statement', signal: input.signal });
      input.signal?.throwIfAborted();
      if (!['bank-statement', 'credit-card-statement'].includes(scanned.result.documentKind)) throw new Error('This page was not identified as a bank or card statement. Check the source or use ordinary document import.');
      const normalized = scanned.result.rows.length ? visionDocumentRows({ result: scanned.result, sourceName: source.name, sourceHash: source.hash }) : { rows: [], warnings: [] };
      const metadata = scanned.result.statement;
      page.warnings = [...scanned.result.warnings, ...normalized.warnings];
      if (!metadata?.complete || metadata.omittedRows > 0) page.warnings.push(`Extraction needs checking: ${metadata?.omittedRows ?? 0} known omitted rows; completeness is not established.`);
      const ref = `statement:${source.hash}:${scanned.result.accountLast4 || 'unknown'}`;
      const pageRows = normalized.rows.map((row, index) => ({ ...row, id: `${row.id}:page:${page.page}`, accountRef: ref, sourceHash: source.hash,
        provenanceId: `statement:${source.hash}:page:${page.page}:row:${index + 1}` }));
      rows.push(...prepareStatementRows(input.household, input.scope, pageRows, page.page));
      if (metadata) {
        if (metadata.periodStart && isValidDateKey(metadata.periodStart)) source.periodStart = metadata.periodStart;
        if (metadata.periodEnd && isValidDateKey(metadata.periodEnd)) source.periodEnd = metadata.periodEnd;
        for (const kind of ['opening', 'closing'] as const) {
          const date = kind === 'opening' ? metadata.openingDate : metadata.closingDate;
          const amount = kind === 'opening' ? metadata.openingBalanceCents : metadata.closingBalanceCents;
          source.checkpoints.push({ accountRef: ref, accountLast4: scanned.result.accountLast4, kind,
            date: date && isValidDateKey(date) ? date : null, signedBalanceCents: typeof amount === 'number' && Number.isSafeInteger(amount) ? amount : null, page: page.page, sourceHash: source.hash, periodStart: metadata.periodStart, periodEnd: metadata.periodEnd });
        }
      }
      page.status = 'scanned';
    } catch (error) {
      input.signal?.throwIfAborted();
      page.status = 'failed'; page.warnings = [error instanceof Error ? error.message : 'The page could not be read.'];
    }
    await input.onPage?.(structuredClone(source), structuredClone(rows));
  }
  return { source, rows };
}
export function mergeStatementSource(draft: StatementSetupDraft, source: StatementSource, rows: StatementSetupRow[]): StatementSetupDraft {
  const sources = [...draft.sources.filter(item => item.hash !== source.hash), source];
  const accountRefs = [...new Set([...source.checkpoints.map(item => item.accountRef), ...rows.map(item => item.accountRef)])];
  const accounts = draft.accounts.map(account => ({ ...account }));
  for (const ref of accountRefs) {
    const existing = accounts.find(account => account.accountRef === ref);
    const opening = source.checkpoints.find(item => item.accountRef === ref && item.kind === 'opening' && item.date != null && item.signedBalanceCents != null);
    const closing = [...source.checkpoints].reverse().find(item => item.accountRef === ref && item.kind === 'closing' && item.date != null && item.signedBalanceCents != null);
    if (existing) {
      if (!existing.openingDate && opening?.date) existing.openingDate = opening.date;
      if (!existing.openingBalance && opening?.signedBalanceCents != null) existing.openingBalance = (opening.signedBalanceCents/100).toFixed(2);
      if (!existing.closingDate && closing?.date) existing.closingDate = closing.date;
      if (!existing.closingBalance && closing?.signedBalanceCents != null) existing.closingBalance = (closing.signedBalanceCents/100).toFixed(2);
      continue;
    }
    accounts.push({ accountRef: ref, accountId: rows.find(row => row.accountRef === ref)?.accountId ?? '', openingDate: opening?.date ?? '', openingBalance: opening?.signedBalanceCents != null ? (opening.signedBalanceCents / 100).toFixed(2) : '', closingDate: closing?.date ?? '', closingBalance: closing?.signedBalanceCents != null ? (closing.signedBalanceCents / 100).toFixed(2) : '' });
  }
  return { ...draft, sources, rows: [...draft.rows.filter(row => row.sourceHash !== source.hash), ...rows], accounts, updatedAt: new Date().toISOString() };
}
export function statementHistoryInput(draft: StatementSetupDraft): StatementHistoryInput {
  if (!draft.sources.length || draft.sources.some(source => !source.reviewed || source.pages.some(page => !page.reviewed || page.status === 'pending' || page.status === 'failed' || (page.status === 'omitted' && !page.omissionReason.trim())))) throw new Error('Review every source page, resolve failed pages, and explain pages excluded from the statement.');
  const cents = (text: string): number => {
    if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(text.trim())) throw new Error('Enter each opening and closing balance, including an explicit zero.');
    const value = Math.round(Number(text) * 100); if (!Number.isSafeInteger(value)) throw new Error('The balance is too large.'); return value;
  };
  const mappedAccounts = draft.accounts.map(account => {
    if (!account.accountId || !isValidDateKey(account.openingDate) || !isValidDateKey(account.closingDate)) throw new Error('Choose an account and both checkpoint dates for each statement.');
    const sources = draft.sources.filter(source => source.checkpoints.some(point => point.accountRef === account.accountRef) || draft.rows.some(row => row.sourceHash === source.hash && row.accountRef === account.accountRef));
    return { accountId: account.accountId, openingDate: account.openingDate, openingBalanceCents: cents(account.openingBalance), closingDate: account.closingDate, closingBalanceCents: cents(account.closingBalance), coverage: sources.flatMap(source => source.checkpoints.filter(point => point.accountRef === account.accountRef).flatMap(point => point.periodStart && point.periodEnd ? [{ start: point.periodStart, end: point.periodEnd }] : [])) };
  });
  const accounts: StatementHistoryInput['accounts'] = [];
  for (const accountId of new Set(mappedAccounts.map(account => account.accountId))) {
    const entries = mappedAccounts.filter(account => account.accountId === accountId);
    const first = [...entries].sort((a,b) => a.openingDate.localeCompare(b.openingDate))[0]!;
    const last = [...entries].sort((a,b) => b.closingDate.localeCompare(a.closingDate))[0]!;
    const checkpoints = entries.flatMap(account => [{ date: account.openingDate, balanceCents: account.openingBalanceCents }, { date: account.closingDate, balanceCents: account.closingBalanceCents }]);
    accounts.push({ accountId, openingDate: first.openingDate, openingBalanceCents: first.openingBalanceCents, closingDate: last.closingDate, closingBalanceCents: last.closingBalanceCents, checkpoints, coverage: entries.flatMap(account => account.coverage) });
  }
  if (draft.rows.some(row => row.decision === 'exclude' && !row.exclusionReason.trim())) throw new Error('Explain each row excluded from the history.');
  const rows: StatementHistoryInput['rows'] = draft.rows.filter(row => row.decision !== 'exclude').map(row => {
    const accountId = draft.accounts.find(account => account.accountRef === row.accountRef)?.accountId ?? row.accountId;
    if (!accountId || row.type === 'unknown' || row.currency !== 'CAD') throw new Error('Review each transaction type, account and CAD currency before continuing.');
    if (row.type !== 'transfer' && !row.subcategoryId) throw new Error('Choose a category for every transaction; Hearth does not guess a default.');
    if (row.type === 'transfer' && (!row.transferAccountId || row.transferAccountId === accountId)) throw new Error('Choose the other account for every transfer.');
    if (row.decision === 'retain' && !row.retainedTransactionId) throw new Error('Choose the existing transaction to retain.');
    return { sourceIdentity: row.sourceIdentity, sourceHash: row.sourceHash, date: row.date,
      accountId: row.type === 'transfer' && row.signedAmountCents > 0 ? row.transferAccountId : accountId,
      type: row.type, amountCents: row.amountCents, subcategoryId: row.subcategoryId || undefined,
      toAccountId: row.type === 'transfer' ? (row.signedAmountCents > 0 ? accountId : row.transferAccountId) : undefined,
      note: row.note, decision: row.decision as 'post' | 'retain', retainedTransactionId: row.retainedTransactionId || undefined, transferGroupIdentity: row.type === 'transfer' ? row.sourceIdentity : undefined };
  });
  const paired = new Set<string>();
  const finalRows: StatementHistoryInput['rows'] = [];
  for (const row of rows) {
    if (paired.has(row.sourceIdentity)) continue;
    const original = draft.rows.find(item => item.sourceIdentity === row.sourceIdentity)!;
    if (original.transferPairRowId) {
      const partnerDraft = draft.rows.find(item => item.id === original.transferPairRowId);
      const partner = partnerDraft && rows.find(item => item.sourceIdentity === partnerDraft.sourceIdentity);
      if (!partner || row.type !== 'transfer' || partner.type !== 'transfer' || row.decision !== 'post' || partner.decision !== 'post'
        || row.accountId !== partner.accountId || row.toAccountId !== partner.toAccountId || row.date !== partner.date || row.amountCents !== partner.amountCents
        || original.signedAmountCents * partnerDraft!.signedAmountCents >= 0
        || (partnerDraft!.transferPairRowId && partnerDraft!.transferPairRowId !== original.id)
        || paired.has(partner.sourceIdentity)) throw new Error('Paired statement rows must be the two opposite legs of the same reviewed transfer.');
      const sourceAccount = draft.accounts.find(account => account.accountRef === original.accountRef)?.accountId ?? original.accountId;
      const partnerAccount = draft.accounts.find(account => account.accountRef === partnerDraft!.accountRef)?.accountId ?? partnerDraft!.accountId;
      if (sourceAccount === partnerAccount) throw new Error('Transfer legs must come from different accounts.');
      paired.add(partner.sourceIdentity);
      finalRows.push({ ...row, transferSources: [{ accountId: sourceAccount, sourceIdentity: row.sourceIdentity, sourceHash: row.sourceHash }, { accountId: partnerAccount, sourceIdentity: partner.sourceIdentity, sourceHash: partner.sourceHash }] });
    } else finalRows.push(row);
    paired.add(row.sourceIdentity);
  }
  return { createdBy: draft.scope.memberId, visibility: draft.scope.view === 'personal' ? 'personal' : 'household', accounts, rows: finalRows };
}
