import { useEffect, useRef, useState } from "react";

const dialogStack: HTMLElement[] = [];
const modalListeners = new Set<() => void>();
function notifyModals() { for (const listener of modalListeners) listener(); }
export function useModalActive() {
  const [active,setActive]=useState(()=>dialogStack.length > 0);
  useEffect(()=>{const update=()=>setActive(dialogStack.length > 0);modalListeners.add(update);update();return()=>{modalListeners.delete(update);};},[]);
  return active;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.tabIndex < 0 || el.closest("[hidden]")) return false;
    if (el.closest("[inert]")) return false;
    // Prefer the platform's own answer. Fall back to "focusable" rather than a
    // layout measurement, so the trap still holds where layout is not computed.
    const check = (el as HTMLElement & { checkVisibility?: () => boolean }).checkVisibility;
    return typeof check === "function" ? check.call(el) : true;
  });
}

/**
 * Modal behaviour for a hand-rolled sheet: move focus in on open, keep Tab
 * inside it, close on Escape, and put focus back where it came from.
 *
 * While the sheet is open its siblings are marked `inert`, so the office
 * behind it leaves the accessibility tree instead of staying tabbable. This is
 * presentation only — it never touches a command, a snapshot, or the journal.
 */
export function useDialog(open: boolean, onClose?: () => void, returnFocusFallback?: () => HTMLElement | null) {
  const ref = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const fallbackRef=useRef(returnFocusFallback);fallbackRef.current=returnFocusFallback;

  useEffect(() => {
    const node = ref.current;
    if (!open || !node) return;

    const returnTo = document.activeElement as HTMLElement | null;
    dialogStack.push(node);
    notifyModals();

    const siblings: { el: HTMLElement; had: boolean }[] = [];
    const parent = node.parentElement;
    if (parent) {
      for (const child of Array.from(parent.children)) {
        if (child === node || !(child instanceof HTMLElement)) continue;
        siblings.push({ el: child, had: child.hasAttribute("inert") });
        child.setAttribute("inert", "");
      }
    }

    const first = focusable(node);
    const target = node.querySelector<HTMLElement>("[data-autofocus]") || first[0] || node;
    if (target === node) node.setAttribute("tabindex", "-1");
    target.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (dialogStack.at(-1) !== node) return;
      const el = ref.current;
      if (!el) return;
      if (event.key === "Escape") {
        // An inline review gets the first Escape; its parent sheet stays open.
        if ((event.target as Element | null)?.closest?.("[data-dialog-escape-boundary]")) return;
        event.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable(el);
      if (!items.length) return;
      const head = items[0];
      const tail = items[items.length - 1];
      if (!head || !tail) return;
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === head || !el.contains(active))) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && active === tail) {
        event.preventDefault();
        head.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const index=dialogStack.lastIndexOf(node);if(index>=0)dialogStack.splice(index,1);
      notifyModals();
      for (const { el, had } of siblings) {
        if (!had) el.removeAttribute("inert");
      }
      if (returnTo && returnTo !== document.body && returnTo !== document.documentElement && document.contains(returnTo)) returnTo.focus();
      else fallbackRef.current?.()?.focus();
    };
  }, [open]);

  return ref;
}
