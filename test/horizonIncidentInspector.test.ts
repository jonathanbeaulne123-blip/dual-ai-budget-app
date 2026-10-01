// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import HorizonInspector from '../src/diagnostics/HorizonInspector.tsx';
import { captureSourceMatches } from '../src/diagnostics/captureIdentity.ts';
import { captureDiagnosticIncident, diagnosticState, isInspectorToggle, recordDiagnostic, registerDiagnosticProvider, sampleDiagnostics, setDiagnosticsRecording } from '../src/diagnostics/inspectorCore.ts';

function key(target: Element, changes: Record<string, unknown> = {}) {
  return { key: '=', shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, repeat: false, isComposing: false, defaultPrevented: false, target, ...changes };
}
afterEach(() => { setDiagnosticsRecording(false); document.body.replaceChildren(); });
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Horizon Inspector control', () => {
  it('accepts only the exact Hearth tab capture handle', () => {
    const expected = 'this-tab', origin = 'https://hearth.example';
    expect(captureSourceMatches('browser', { handle: expected, origin }, expected, origin)).toBe(true);
    expect(captureSourceMatches('browser', { handle: 'another-tab', origin }, expected, origin)).toBe(false);
    expect(captureSourceMatches('window', { handle: expected, origin }, expected, origin)).toBe(false);
    expect(captureSourceMatches('browser', null, expected, origin)).toBe(false);
  });
  it('accepts only one unmodified equals press outside text and chat', () => {
    const stage = document.createElement('div'); document.body.append(stage); stage.focus();
    expect(isInspectorToggle(key(stage))).toBe(true);
    for (const changes of [{ key: '+' }, { key: 'F3' }, { repeat: true }, { shiftKey: true }, { metaKey: true }, { ctrlKey: true }, { altKey: true }, { isComposing: true }]) expect(isInspectorToggle(key(stage, changes))).toBe(false);
    for (const tag of ['input', 'textarea']) { const field = document.createElement(tag); stage.append(field); expect(isInspectorToggle(key(field))).toBe(false); }
    const chat = document.createElement('div'); chat.setAttribute('contenteditable', 'true'); stage.append(chat); expect(isInspectorToggle(key(chat))).toBe(false);
    const textbox = document.createElement('div'); textbox.setAttribute('role', 'textbox'); stage.append(textbox); expect(isInspectorToggle(key(textbox))).toBe(false);
  });

  it('preserves a bounded pre-capture history and keeps player and camera separate', () => {
    setDiagnosticsRecording(true);
    const remove = registerDiagnosticProvider({ read: () => ({ scene: 'horizon', view: 'walk', activity: 'board', worldRevision: 'geo-1', renderedRevision: 'geo-1', player: { x: 1, y: 2, z: 3 }, camera: { x: 5, y: 8, z: 9, target: [1, 2, 3], mode: 'floating', owner: 'board', transitioning: false }, location: 'Crown', movement: { controller: 'board' }, interaction: { target: 'ramp', inputOwner: 'board' }, context: {}, rendering: {}, frame: 42, frameMs: 16, frameTimes: [16], drawCalls: 12, triangles: 300, idle: false, paused: false }) });
    sampleDiagnostics(); recordDiagnostic('movement', 'deploy', 'rejected', 'not airborne'); recordDiagnostic('movement', 'deploy', 'rejected', 'not airborne');
    const incident = captureDiagnosticIncident('test build');
    expect(incident.snapshot.player).toEqual({ x: 1, y: 2, z: 3 });
    expect(incident.snapshot.camera).toMatchObject({ x: 5, y: 8, z: 9 });
    expect(incident.events.find(e => e.action === 'deploy')?.count).toBe(2);
    expect(incident.samples.length).toBeGreaterThan(0);
    expect(incident.image).toBeNull();
    expect(incident.imageStatus).toContain('not atomic');
    expect(diagnosticState().events.length).toBeGreaterThan(0);
    remove();
  });

  it('takes the equals press before map zoom, but leaves plus zoom alone', async () => {
    const host = document.createElement('div'), stage = document.createElement('div'); stage.tabIndex = 0; host.append(stage); document.body.append(host);
    const app = document.createElement('div'); document.body.append(app); const root = createRoot(app); let zoom = 0;
    stage.addEventListener('keydown', event => { if (event.key === '=' || event.key === '+') zoom++; });
    await act(async () => root.render(createElement(HorizonInspector)));
    stage.focus();
    await act(async () => stage.dispatchEvent(new KeyboardEvent('keydown', { key: '=', bubbles: true })));
    expect(document.querySelector('.horizon-inspector')).not.toBeNull(); expect(zoom).toBe(0);
    await act(async () => stage.dispatchEvent(new KeyboardEvent('keydown', { key: '=', bubbles: true, repeat: true })));
    expect(document.querySelector('.horizon-inspector')).not.toBeNull();
    await act(async () => stage.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true })));
    expect(zoom).toBe(1);
    await act(async () => stage.dispatchEvent(new KeyboardEvent('keydown', { key: '=', bubbles: true })));
    expect(document.querySelector('.horizon-inspector')).toBeNull();
    await act(async () => root.unmount());
  });

  it('bounds repeated captures and strips obvious identifiers from event metadata', () => {
    setDiagnosticsRecording(true);
    for (let index = 0; index < 240; index++) recordDiagnostic('interaction', `target-${index}`, 'received');
    recordDiagnostic('error', 'request https://example.test/private', 'failed', 'person@example.test');
    const first = captureDiagnosticIncident('test'), second = captureDiagnosticIncident('test');
    expect(first.id).not.toBe(second.id);
    expect(first.events.length).toBeLessThanOrEqual(180);
    expect(JSON.stringify(first.events)).not.toContain('example.test');
    expect(JSON.stringify(first.events)).not.toContain('person@example.test');
    setDiagnosticsRecording(false);
    expect(diagnosticState().events).toEqual([]);
  });

  it('keeps the frozen report when browser image capture is unavailable', async () => {
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    await act(async () => root.render(createElement(HorizonInspector)));
    await act(async () => window.dispatchEvent(new Event('hearth:open-inspector')));
    const click = async (name: string) => { const button = [...host.querySelectorAll('button')].find(item => item.textContent?.includes(name)); expect(button).toBeDefined(); await act(async () => button!.click()); };
    await click('Capture incident');
    const id = host.querySelector('.horizon-inspector__freeze-label')?.textContent;
    await click('Choose display image');
    expect(host.querySelector('.horizon-inspector__freeze')).toBeNull();
    expect(host.textContent).toContain('the scene is live');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 80)); });
    expect(host.textContent).toContain('Image unavailable');
    expect(host.querySelector('.horizon-inspector__freeze-label')?.textContent).toBe(id);
    await act(async () => root.unmount());
  });
});
