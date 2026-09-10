import type { Household, CommitResult, LedgerView } from './types.ts';
import { ValidationError } from './types.ts';
import { addDays, isValidDateKey, isValidIanaTimeZone } from './calendar.ts';
import { canonical } from '../ledgerSync/patch.ts';
import { captureCommand } from '../ledgerSync/capture.ts';
export type NativeEvent = {
    version: 1;
    id: string;
    revision: number;
    createdBy: string;
    visibility: LedgerView;
    title: string;
    start: string;
    end: string;
    allDay: boolean;
    timezone: string;
    fold: 'earlier' | 'later';
    repeat: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    until: string | null;
    location: string;
    notes: string;
    exceptions: Record<string, {
        cancelled: boolean;
        start?: string;
        end?: string;
    }>;
    deleted: boolean;
    createdAt: string;
    updatedAt: string;
};
function fail(message: string): never { throw new ValidationError(message); }
function civilAt(instant: Date, zone: string) { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant); const v = (type: string) => parts.find(p => p.type === type)!.value; return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`; }
/** Civil time is explicit; never use the device's timezone or silently normalize a DST gap. */
export function nativeEventInstant(local: string, zone: string, fold: 'earlier' | 'later' = 'earlier'): string {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || !isValidDateKey(local.slice(0, 10)) || !isValidIanaTimeZone(zone))
        return fail('Choose a valid date, time and timezone.');
    const naive = Date.parse(local + 'Z');
    if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0, 16) !== local)
        return fail('Choose a valid clock time.');
    const offsets = new Set<number>();
    for (const shift of [-36, -12, 0, 12, 36]) {
        const sample = naive + shift * 3600000;
        offsets.add(Date.parse(civilAt(new Date(sample), zone) + 'Z') - sample);
    }
    const candidates = [...offsets].map(offset => naive - offset).filter(n => civilAt(new Date(n), zone) === local).sort((a, b) => a - b);
    if (!candidates.length)
        return fail('That time does not exist because the clocks change. Choose another time.');
    return new Date(fold === 'later' ? candidates.at(-1)! : candidates[0]!).toISOString();
}
export function nativeEventIsOccurrence(row: NativeEvent, date: string): boolean {
    const first = row.start.slice(0, 10);
    if (!isValidDateKey(date) || date < first || (row.until && date > row.until))
        return false;
    const distance = Math.round((Date.parse(date) - Date.parse(first)) / 86400000);
    return date === first || row.repeat === 'daily' || (row.repeat === 'weekly' && distance % 7 === 0) || (row.repeat === 'monthly' && date.slice(8) === first.slice(8)) || (row.repeat === 'yearly' && date.slice(5) === first.slice(5));
}
export function validateNativeEvent(raw: NativeEvent): NativeEvent {
    if (!raw || typeof raw !== 'object' || Object.keys(raw).some(k => !['version', 'id', 'revision', 'createdBy', 'visibility', 'title', 'start', 'end', 'allDay', 'timezone', 'fold', 'repeat', 'until', 'location', 'notes', 'exceptions', 'deleted', 'createdAt', 'updatedAt'].includes(k)))
        return fail('Unsupported calendar event fields.');
    const row = structuredClone(raw);
    if (row.version !== 1 || !/^EVENT-[a-zA-Z0-9-]{1,80}$/.test(row.id) || !Number.isSafeInteger(row.revision) || row.revision < 1 || !['household', 'personal'].includes(row.visibility) || !row.createdBy)
        return fail('This event needs a valid owner and revision.');
    if (typeof row.title !== 'string' || !row.title.trim() || row.title.length > 160 || typeof row.notes !== 'string' || row.notes.length > 2000 || typeof row.location !== 'string' || row.location.length > 240)
        return fail('Check the event title, location and notes.');
    if (!['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(row.repeat) || !['earlier', 'later'].includes(row.fold) || !isValidIanaTimeZone(row.timezone) || typeof row.allDay !== 'boolean' || typeof row.deleted !== 'boolean')
        return fail('Choose the event timing and repeat options.');
    if (row.allDay) {
        if (!isValidDateKey(row.start) || !isValidDateKey(row.end) || row.end < row.start)
            return fail('Choose valid event dates.');
    }
    else if (nativeEventInstant(row.end, row.timezone, row.fold) <= nativeEventInstant(row.start, row.timezone, row.fold))
        return fail('The event must end after it starts.');
    if (row.until !== null && (!isValidDateKey(row.until) || row.until < row.start.slice(0, 10)))
        return fail('The repeat end must follow the first event.');
    if (!row.exceptions || typeof row.exceptions !== 'object' || Array.isArray(row.exceptions) || Object.keys(row.exceptions).length > 366)
        return fail('Check the repeating event exceptions.');
    for (const [date, exception] of Object.entries(row.exceptions)) {
        if (!nativeEventIsOccurrence(row, date) || !exception || typeof exception !== 'object' || Object.keys(exception).some(k => !['cancelled', 'start', 'end'].includes(k)) || typeof exception.cancelled !== 'boolean')
            return fail('Choose a valid occurrence.');
        if (exception.start || exception.end) {
            if (!exception.start || !exception.end)
                return fail('Moving an occurrence needs both dates.');
            validateNativeEvent({ ...row, start: exception.start, end: exception.end, repeat: 'none', until: null, exceptions: {} });
        }
    }
    row.title = row.title.trim();
    return row;
}
export function shapeNativeEvents(value: NativeEvent[] | undefined): NativeEvent[] { if (value === undefined)
    return []; if (!Array.isArray(value) || value.length > 2000)
    return fail('Too many calendar events.'); const rows = value.map(validateNativeEvent); if (new Set(rows.map(r => r.id)).size !== rows.length)
    return fail('An event identity appears twice.'); return rows; }
/** V2 authority owns revisions; conflicting equal revisions never silently merge. */
export function mergeNativeEvents(a: NativeEvent[] | undefined, b: NativeEvent[] | undefined) { const byId = new Map<string, NativeEvent>(); for (const row of [...shapeNativeEvents(a), ...shapeNativeEvents(b)]) {
    const old = byId.get(row.id);
    if (old && old.revision === row.revision && canonical(old) !== canonical(row))
        return fail('This event changed in two places. Review its current version.');
    if (!old || row.revision > old.revision)
        byId.set(row.id, row);
} return [...byId.values()]; }
export type NativeEventInput = {
    memberId: string;
    id: string;
    expectedRevision: number;
    event: Omit<NativeEvent, 'version' | 'id' | 'revision' | 'createdBy' | 'createdAt' | 'updatedAt'>;
};
export const saveNativeEvent = captureCommand('saveNativeEvent', (h: Household, input: NativeEventInput): CommitResult => {
    if (!h.members.some(m => m.id === input.memberId && m.active))
        return fail('Sign in as an active member to change events.');
    const old = h.nativeEvents?.find(r => r.id === input.id);
    if ((old?.revision ?? 0) !== input.expectedRevision || old?.deleted)
        return fail('This event changed. Review its latest version.');
    if (old?.visibility === 'personal' && old.createdBy !== input.memberId)
        return fail('This is another person’s private event.');
    if (old && (old.visibility !== input.event.visibility))
        return fail('Keep an existing event in its original calendar.');
    const now = new Date().toISOString(), row = validateNativeEvent({ ...input.event, version: 1, id: input.id, revision: input.expectedRevision + 1, createdBy: old?.createdBy ?? input.memberId, createdAt: old?.createdAt ?? now, updatedAt: now });
    const next = { ...h, nativeEvents: [...(h.nativeEvents ?? []).filter(r => r.id !== row.id), row] };
    return { household: next, postedIds: [row.id], warnings: [], undo: { id: crypto.randomUUID(), label: row.deleted ? 'Remove calendar event' : 'Save calendar event', snapshot: h, postedIds: [row.id], commandKind: 'native-calendar-event' } };
});
export function nativeEventOccurrences(row: NativeEvent, from: string, to: string): {
    date: string;
    start: string;
    end: string;
    originalDate: string;
    warning?: string;
}[] {
    if (row.deleted)
        return [];
    const result: {
        date: string;
        start: string;
        end: string;
        originalDate: string;
        warning?: string;
    }[] = [], first = row.start.slice(0, 10), days = Math.round((Date.parse(row.end.slice(0, 10)) - Date.parse(first)) / 86400000);
    // Iterate bounded requested civil dates; monthly/yearly recurrence skips nonexistent dates.
    const lookback = addDays(from, -Math.max(0, days));
    const start = lookback > first ? lookback : first;
    let date = start;
    for (let i = 0; date <= to && i < 732; i++, date = addDays(date, 1)) {
        if (row.until && date > row.until)
            break;
        if (!nativeEventIsOccurrence(row, date))
            continue;
        const exception = row.exceptions[date];
        if (exception?.cancelled)
            continue;
        const eventStart = exception?.start ?? date + row.start.slice(10), eventEnd = exception?.end ?? addDays(date, days) + row.end.slice(10);
        // Keep an affected occurrence visible with a warning so it can be moved explicitly.
        let warning: string | undefined;
        if (!row.allDay) {
            try {
                nativeEventInstant(eventStart, row.timezone, row.fold);
                nativeEventInstant(eventEnd, row.timezone, row.fold);
            }
            catch {
                warning = 'Time needs review because the clocks change';
            }
        }
        if (eventStart.slice(0, 10) <= to && eventEnd.slice(0, 10) >= from)
            result.push({ date: eventStart.slice(0, 10), start: eventStart, end: eventEnd, originalDate: date, ...(warning ? { warning } : {}) });
    }
    for (const [originalDate, exception] of Object.entries(row.exceptions))
        if (nativeEventIsOccurrence(row, originalDate) && !exception.cancelled && exception.start && exception.end && exception.start.slice(0, 10) <= to && exception.end.slice(0, 10) >= from && !result.some(r => r.originalDate === originalDate))
            result.push({ date: exception.start.slice(0, 10), start: exception.start, end: exception.end, originalDate });
    return result;
}
