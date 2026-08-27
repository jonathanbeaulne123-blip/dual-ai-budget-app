import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Interaction lock for onboarding: only the highlighted target and Skip
 * remain operable. Restores focus on cleanup. Does not touch commands.
 */
export function useOnboardingInteractionLock(input: {
  active: boolean;
  targetId: string | null;
  skipSelector?: string;
  rootSelector?: string;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!input.active) return;

    previousFocus.current = document.activeElement as HTMLElement | null;
    const root = document.querySelector(input.rootSelector ?? ".app");
    if (!(root instanceof HTMLElement)) return;

    const skipSel = input.skipSelector ?? '[data-onboarding-id="onboarding.skip"]';
    const targetSel = input.targetId ? `[data-onboarding-id="${CSS.escape(input.targetId)}"]` : null;

    const allowed = new Set<Element>();
    const skip = root.querySelector(skipSel);
    if (skip) allowed.add(skip);
    if (targetSel) {
      const target = root.querySelector(targetSel);
      if (target) allowed.add(target);
    }

    const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    const muted: { el: HTMLElement; tabindex: string | null; disabled: boolean | null }[] = [];

    for (const el of focusables) {
      if (allowed.has(el) || [...allowed].some((a) => a.contains(el))) continue;
      muted.push({
        el,
        tabindex: el.getAttribute("tabindex"),
        disabled: el.hasAttribute("disabled") ? true : null,
      });
      el.setAttribute("tabindex", "-1");
      if ("disabled" in el) {
        try {
          (el as HTMLButtonElement).disabled = true;
        } catch {
          /* ignore non-disableable */
        }
      }
      el.setAttribute("data-onboarding-locked", "1");
    }

    const onPointer = (event: Event) => {
      const node = event.target;
      if (!(node instanceof Element)) return;
      if ([...allowed].some((a) => a === node || a.contains(node))) return;
      // Allow interactions inside the onboarding shell chrome.
      if (node.closest("[data-onboarding-shell]")) return;
      event.preventDefault();
      event.stopPropagation();
    };

    root.addEventListener("click", onPointer, true);
    root.addEventListener("pointerdown", onPointer, true);

    const targetEl = targetSel ? root.querySelector<HTMLElement>(targetSel) : null;
    (targetEl ?? (skip as HTMLElement | null))?.focus?.();

    return () => {
      root.removeEventListener("click", onPointer, true);
      root.removeEventListener("pointerdown", onPointer, true);
      for (const row of muted) {
        if (row.tabindex == null) row.el.removeAttribute("tabindex");
        else row.el.setAttribute("tabindex", row.tabindex);
        if (row.disabled === null && "disabled" in row.el) {
          try {
            (row.el as HTMLButtonElement).disabled = false;
          } catch {
            /* ignore */
          }
        }
        row.el.removeAttribute("data-onboarding-locked");
      }
      previousFocus.current?.focus?.();
    };
  }, [input.active, input.targetId, input.skipSelector, input.rootSelector]);
}
