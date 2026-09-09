// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HerculesSetup, type HerculesSetupProps } from '../src/HerculesSetup.tsx';
import { activeSetup, readySetup, A, B } from './fixtures/onboarding-v2.ts';
import { catalogHousehold, todayKey, type CommandOutcome, type Household } from '../src/core/index.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root, props: HerculesSetupProps, open = false;
const button = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('.hercules-setup button')]
  .find(node => node.textContent === name || node.querySelector("strong")?.textContent === name)!;
async function render() {
  await act(async () => root.render(createElement(HerculesSetup, {
    ...props, open, onClose: () => { open = false; void render(); }, onHelp: vi.fn(), onPlay: vi.fn(),
  })));
}
beforeEach(() => {
  vi.stubEnv('VITE_LEDGER_SYNC_V2', '1');
  localStorage.clear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  open = false;
  props = { household: activeSetup(), memberId: A, authUserId: 'synthetic-a', today: todayKey(), busy: false,
    onCommand: vi.fn(async () => null), onSave: vi.fn(), onOptional: vi.fn() };
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllEnvs(); });

describe('Hercules contained setup with Development v2 enabled', () => {
  it('stays hidden without offering, opens deliberately, and returns focus on Close', async () => {
    props.household = catalogHousehold('development');
    const opener = document.createElement('button'); opener.textContent = 'Open Hercules'; document.body.append(opener);
    await render(); expect(props.onCommand).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLElement>('.hercules-setup-backdrop')!.hidden).toBe(true);
    opener.focus(); open = true; await render();
    expect(props.onCommand).toHaveBeenCalledTimes(1);
    expect(document.activeElement?.id).toBe('hercules-setup-title');
    await act(async () => button('Close').click());
    expect(document.querySelector<HTMLElement>('.hercules-setup-backdrop')!.hidden).toBe(true);
    expect(document.activeElement).toBe(opener); opener.remove();
  });

  it('keeps drafts while pausing and delegates embedded keyboard containment to the whole dialog', async () => {
    open = true; await render();
    await act(async () => button('Starting books').click());
    const input = document.querySelector<HTMLInputElement>('.hercules-setup input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'My draft account');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => button('Close').click()); open = true; await render();
    expect(document.querySelector<HTMLInputElement>('.hercules-setup input')!.value).toBe('My draft account');
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(open).toBe(true); expect(button('Back to journey')).toBeUndefined();
    button('Close').focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    await act(async () => button('Close').dispatchEvent(tab));
    expect(tab.defaultPrevented).toBe(false); // Child chat must not pull focus away from the outer toolbar.
    await act(async () => button('People and agreement').click());
    button('Close').focus();
    const peopleTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    await act(async () => button('Close').dispatchEvent(peopleTab));
    expect(peopleTab.defaultPrevented).toBe(false);
  });

  it('retries failed initial acceptance explicitly at the same revision', async () => {
    props.household = catalogHousehold('development'); open = true; await render();
    expect(props.onCommand).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('waiting for acceptance');
    await act(async () => button('Retry setup').click());
    expect(props.onCommand).toHaveBeenCalledTimes(2);
  });

  it('lets two members independently approve the current Ready facts inside Hercules', async () => {
    let household: Household = readySetup(true);
    props.household = household;
    props.onCommand = async fn => {
      const result = fn(household); household = result.household; props = { ...props, household };
      await render(); return { ok: true, household } as CommandOutcome;
    };
    open = true; await render(); await act(async () => button('Ready together').click());
    const readyButton = () => document.querySelector<HTMLButtonElement>('.onboarding-ready .primary')!;
    await act(async () => readyButton().click());
    expect(household.onboardingApprovals?.filter(row => row.scope === 'ready').map(row => row.memberId)).toEqual([A]);
    expect(document.querySelector('.onboarding-ready')?.textContent).toContain('Jonathan');
    props = { ...props, memberId: B, authUserId: 'synthetic-b' }; await render();
    await act(async () => readyButton().click());
    expect(household.householdOnboarding?.state).toBe('complete');
  });
});
