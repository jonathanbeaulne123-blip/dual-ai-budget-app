// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { seedDemoHousehold } from '../src/core/seed.ts';

const loadTerrainAsset = vi.hoisted(() => vi.fn(async () => { throw new Error('terrain unavailable'); }));
vi.mock('../src/harbour/mountain/terrainAsset.ts', () => ({ loadTerrainAsset }));

it('opens the household Desk with WebGL disabled even when terrain is unavailable', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const household = seedDemoHousehold({ today: '2026-09-25' });
  const memberId = household.members[0]!.id;
  const { default: HarbourEntry } = await import('../src/harbour/HarbourEntry.tsx');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(HarbourEntry, {
    household, memberId, scope: 'household', today: '2026-09-25',
    route: { room: 'home', level: 'middle', householdId: household.householdId, scope: 'household' },
    ready: true, freshness: 'Current shared books',
    onNavigate: () => {}, onOpen: () => {}, onClose: () => {},
  })));
  expect(host.querySelector('[data-desk]')).not.toBeNull();
  // The flat bar is the island's three things (Tool Atlas brief §6): no Quick travel, no Village map, one flip.
  expect(host.querySelector('[aria-label="Quick travel"]')).toBeNull();
  expect(host.querySelector('[data-glass-flip="desk"]')).not.toBeNull();
  expect(host.querySelector('[data-desk-flip]')).toBeNull();
  expect(loadTerrainAsset).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  host.remove();
  getContext.mockRestore();
  vi.unstubAllGlobals();
});

it('falls back to the Desk when the illustrated terrain cannot load', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as WebGLRenderingContext);
  const household = seedDemoHousehold({ today: '2026-09-25' });
  const { default: HarbourEntry } = await import('../src/harbour/HarbourEntry.tsx');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(HarbourEntry, {
    household, memberId: household.members[0]!.id, scope: 'household', today: '2026-09-25',
    route: { room: 'home', level: 'middle', householdId: household.householdId, scope: 'household' },
    ready: true, freshness: 'Current shared books',
    onNavigate: () => {}, onOpen: () => {}, onClose: () => {},
  })));
  await vi.waitFor(() => expect(host.querySelector('[data-desk-status="fallback"]')).not.toBeNull());
  expect(loadTerrainAsset).toHaveBeenCalled();
  await act(async () => root.unmount());
  host.remove();
  getContext.mockRestore();
  vi.unstubAllGlobals();
});
