// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemoHousehold, type Household, type CommandOutcome, type CommitResult } from "../src/core/index.ts";
import type { KitchenCommand, KitchenCommandOptions, KitchenCommandResult } from "../src/kitchenCommand.ts";
import { ChalkboardBody } from "../src/widgets/ChalkboardDesk.tsx";

let host: HTMLDivElement, root: Root, household: Household;
let commands: Array<{ fn: (current: Household) => CommitResult; options?: KitchenCommandOptions; resolve: (result: KitchenCommandResult) => void; reject: (error: Error) => void }>;
const memberId = "MEM-002";
const onCommand: KitchenCommand = (fn, options) => new Promise((resolve, reject) => { commands.push({ fn, options, resolve, reject }); });
function result(overrides: Partial<CommandOutcome> = {}): CommandOutcome {
  return { kind: "retryable-failure", ok: false, household, previous: household, postedIds: [], confirmationId: "test-receipt", identityHash: null, revision: household.revision, sharingMode: household.sharing.mode, errorClass: "persist-failed", userMessage: "Could not save", retryable: true, postedExactlyOnce: false, postedNothing: true, recoveryAvailable: false, ...overrides };
}
async function render(command: KitchenCommand = onCommand) {
  await act(async () => root.render(h(ChalkboardBody, { key: `${household.environment}:${household.householdId}:${memberId}`, household, memberId, busy: false, liveSurface: true, typingAlternative: true, onCommand: command })));
}
function button(text: string) { return [...host.querySelectorAll('button')].find(button => button.textContent === text); }
function input() { return host.querySelector('textarea')!; }
async function type(text: string) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input(), text); input().dispatchEvent(new Event('input', { bubbles: true })); }); }
function pointer(type: string, x: number) { const event = new Event(type, { bubbles: true }); Object.assign(event, { clientX: x, clientY: x, pointerId: 1, button: 0 }); host.querySelector('.chalkboard-live-board > canvas')!.dispatchEvent(event); }
async function draw(x = 20) { await act(async () => { pointer('pointerdown', x); pointer('pointermove', x + 20); pointer('pointerup', x + 20); vi.advanceTimersByTime(600); }); }
async function submitTyped() { await act(async () => { for (let i = 0; i < 3; i++) input().closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); }
async function settle(index: number, value: KitchenCommandResult) { await act(async () => commands[index]!.resolve(value)); }
async function accept(index: number) { household = commands[index]!.fn(household).household; await render(); }

beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() }) as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 320, height: 280 } as DOMRect);
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  household = seedDemoHousehold({ environment: 'development', today: '2026-09-08' }); commands = [];
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const ambiguous = [
  ['null', () => null], ['void', () => undefined],
  ['legacy queued transport', () => result({ kind: 'pending-transport', ok: true, postedExactlyOnce: true, postedNothing: false })],
  ['uncertain recovery', () => result({ kind: 'recovery-available', postedNothing: false, recoveryAvailable: true })],
  ['contradictory posted flags', () => result({ postedExactlyOnce: true })],
  ['accepted receipt before board update', () => result({ kind: 'synchronized', ok: true, postedExactlyOnce: true, postedNothing: false, retryable: false })],
] as const;

describe.each(['typed', 'drawing'] as const)('%s note receipt latch', mode => {
  const submit = async () => { if (mode === 'typed') { await type('Original note'); await submitTyped(); } else await draw(); };
  it.each(ambiguous)('keeps %s locked until observed acceptance', async (_name, makeResult) => {
    await render(); await submit(); expect(commands).toHaveLength(1);
    await settle(0, makeResult());
    if (mode === 'typed') { await type('Newer note'); await submitTyped(); expect(button('Save note')!.disabled).toBe(true); }
    else await draw(100);
    await act(async () => vi.advanceTimersByTime(30000));
    expect(commands).toHaveLength(1); expect(button(mode === 'typed' ? 'Retry note' : 'Retry drawing')).toBeUndefined();
    await accept(0);
    if (mode === 'typed') { expect(input().value).toBe('Newer note'); expect(button('Save note')!.disabled).toBe(false); }
    else { await act(async () => vi.advanceTimersByTime(600)); expect(commands).toHaveLength(2); await accept(1); expect(household.kitchen.chalkboard.filter(note => note.author === memberId && note.ink).map(note => note.ink!.strokes.length)).toEqual([1, 1]); }
  });
  it('keeps a rejected Promise ambiguous', async () => {
    await render(); await submit(); await act(async () => commands[0]!.reject(new Error('Response lost')));
    if (mode === 'typed') await submitTyped(); else await draw(100);
    expect(commands).toHaveLength(1); expect(button(mode === 'typed' ? 'Retry note' : 'Retry drawing')).toBeUndefined();
  });
  it('retries definite no-write once and preserves newer work until each acceptance', async () => {
    await render(); await submit(); const canvas = host.querySelector('.chalkboard-live-board > canvas');
    if (mode === 'typed') await type('Newer note'); else await draw(100);
    // A successfully rolled-back recovery is still definite no-write.
    await settle(0, result({ recoveryAvailable: true }));
    const retry = button(mode === 'typed' ? 'Retry note' : 'Retry drawing')!;
    expect(retry).toBeDefined();
    await act(async () => { retry.click(); retry.click(); retry.click(); }); expect(commands).toHaveLength(2);
    expect(button(mode === 'typed' ? 'Retry note' : 'Retry drawing')).toBeUndefined();
    if (mode === 'typed') { expect(input().value).toBe('Newer note'); await submitTyped(); expect(commands).toHaveLength(2); }
    await accept(1);
    // Late callbacks belonging to the old attempt cannot release the next latch.
    await act(async () => commands[0]!.options?.onDefinitiveRejected?.());
    if (mode === 'typed') { expect(input().value).toBe('Newer note'); await submitTyped(); }
    else { expect(host.querySelector('.chalkboard-live-board > canvas')).toBe(canvas); await act(async () => vi.advanceTimersByTime(600)); }
    expect(commands).toHaveLength(3); await accept(2);
    const saved = household.kitchen.chalkboard.filter(note => note.author === memberId && (mode === 'typed' ? ['Original note', 'Newer note'].includes(note.text) : note.ink));
    expect(saved).toHaveLength(2);
    if (mode === 'typed') expect(input().value).toBe('');
    else expect(saved.flatMap(note => note.ink!.strokes.map(stroke => stroke.points[0]!.x)).sort()).toEqual([20 / 320, 100 / 320]);
  });
  it.each(['result', 'boundary callback'] as const)('requires edits after permanent rejection via %s', async via => {
    await render(); await submit();
    if (via === 'result') await settle(0, result({ kind: 'conflict-needs-attention', retryable: false }));
    else { await act(async () => commands[0]!.options?.onDefinitiveRejected?.()); await settle(0, null); }
    expect(button(mode === 'typed' ? 'Retry note' : 'Retry drawing')).toBeUndefined();
    if (mode === 'typed') { await submitTyped(); expect(commands).toHaveLength(1); await type('Reviewed change'); await submitTyped(); }
    else { expect(button('Save reviewed drawing')!.disabled).toBe(true); await draw(100); expect(commands).toHaveLength(1); await act(async () => button('Save reviewed drawing')!.click()); }
    expect(commands).toHaveLength(2); await accept(1);
  });
  it('retries a transient pre-dispatch refusal without altering the draft', async () => {
    await render(); await submit();
    await act(async () => commands[0]!.options?.onDefinitiveRejected?.({ retryable: true }));
    await settle(0, null);
    const retry = button(mode === 'typed' ? 'Retry note' : 'Retry drawing')!;
    expect(retry).toBeDefined(); await act(async () => { retry.click(); retry.click(); });
    expect(commands).toHaveLength(2); await accept(1);
    if (mode === 'typed') expect(input().value).toBe('');
    else expect(household.kitchen.chalkboard.filter(note => note.author === memberId && note.ink)).toHaveLength(1);
  });
  it('ignores a retired A-B-A outcome while a new submission waits', async () => {
    await render(); await submit(); const original = household;
    household = { ...household, householdId: 'HH-OTHER' }; await render(); household = original; await render(); await submit();
    await settle(0, result()); await act(async () => commands[0]!.options?.onDefinitiveRejected?.());
    if (mode === 'typed') await submitTyped(); else await draw(100);
    expect(commands).toHaveLength(2); expect(button(mode === 'typed' ? 'Retry note' : 'Retry drawing')).toBeUndefined();
  });
});
