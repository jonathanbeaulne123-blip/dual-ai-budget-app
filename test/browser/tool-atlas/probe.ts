/**
 * In-page measurement helpers for the Tool Atlas acceptance specs, installed as
 * `window.__atlas` by `installProbe(page)`. Plain JavaScript in a string so it
 * runs unchanged in the page.
 *
 * - `hitBox(el)`: the element's real hit box through its centre, measured with
 *   `elementFromPoint` (so a `::before` hit extension counts, and a covering
 *   element or a clipping ancestor does not).
 * - `visibleText(el)`: the words a sighted person sees on the control
 *   (screen-reader-only spans and decorative glyphs removed).
 * - `backdrops()`: every rendered element whose computed `backdrop-filter` is set.
 */
import type { Page } from "@playwright/test";

export const PROBE = String.raw`(() => {
  const GLYPHS = /[·›‹☰↗⌁×+⌖→←✕…▾▸]/g;
  const inside = (el, node) => !!node && (node === el || el.contains(node));
  const box = (el) => el.getBoundingClientRect();
  const describe = (el) => {
    if (!el) return 'nothing';
    const name = (el.getAttribute && (el.getAttribute('aria-label') || '')) || (el.textContent || '');
    return el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '') + ' "' + name.replace(/\s+/g, ' ').trim().slice(0, 40) + '"';
  };
  const shown = (el) => {
    const r = box(el);
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  const srOnly = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (e.hidden) return true;
      const s = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      if ((s.clipPath || '').includes('inset(50%)')) return true;
      if (s.clip && s.clip.startsWith('rect(0')) return true;
      if (r.width <= 1 && r.height <= 1 && s.overflow === 'hidden') return true;
    }
    return false;
  };
  const visibleText = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let out = '';
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement;
      if (!p || !shown(p) || srOnly(p)) continue;
      out += ' ' + n.textContent;
    }
    return out.replace(GLYPHS, ' ').replace(/\s+/g, ' ').trim();
  };
  const run = (el, x0, y0, dx, dy) => {
    let n = 0;
    for (let i = 1; i <= 240; i++) {
      const x = x0 + dx * i, y = y0 + dy * i;
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) break;
      if (!inside(el, document.elementFromPoint(x, y))) break;
      n = i;
    }
    return n;
  };
  const hitBox = (el) => {
    const r = box(el);
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const top = document.elementFromPoint(cx, cy);
    if (!inside(el, top)) return { w: 0, h: 0, covered: true, by: describe(top) + (top && top.closest && top.closest('.command-banner, .kitchen-notice') ? ' [app notice]' : '') };
    return { w: 1 + run(el, cx, cy, -1, 0) + run(el, cx, cy, 1, 0), h: 1 + run(el, cx, cy, 0, -1) + run(el, cx, cy, 0, 1), covered: false, by: null };
  };
  const backdrops = () => [...document.querySelectorAll('body *')].filter((el) => {
    const s = getComputedStyle(el);
    const v = s.backdropFilter || s.webkitBackdropFilter || 'none';
    return v !== 'none' && shown(el);
  }).map(describe);
  const CONTROL = 'button, a[href], input, select, textarea, [role="button"], [role="grid"], [role="radio"], [tabindex="0"]';
  const controls = (root) => [...(root && root.matches && root.matches(CONTROL) ? [root] : []), ...(root || document).querySelectorAll(CONTROL)]
    .filter((el) => shown(el) && !el.closest('[inert]') && !srOnly(el));
  window.__atlas = { describe, shown, srOnly, visibleText, hitBox, backdrops, controls, inside };
})();`;

export async function installProbe(page: Page): Promise<void> {
  await page.evaluate(PROBE);
}
