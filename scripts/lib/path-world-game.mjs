/**
 * Game mode (D-285) helpers for the Our Path evidence scripts. The page now leads with the simple view and the
 * open world is built only when someone opens it; it then covers the page, which is inert behind it.
 *   openWorld(page, { live })  opens the world (if it is not open) and waits for it (the live canvas, or the flat map);
 *   onPage(page, fn)           minimizes, runs fn on the page (outline, journey panel, Replay), then opens the world again;
 *   drawer(page)               opens the world's settings drawer (lantern, quality, layers).
 */
export async function openWorld(page, { live = true, timeout = 120_000 } = {}) {
  const open = await page.evaluate(() => Boolean(document.querySelector('.path-world')?.dataset.game));
  if (!open) {
    await page.waitForSelector('[data-slot="journey-mini"] > .path-world__full', { timeout });
    await page.evaluate(() => document.querySelector('[data-slot="journey-mini"] > .path-world__full').click());
  }
  await page.waitForFunction((wantLive) => document.querySelector('.path-world')?.dataset.game === 'open'
    && (wantLive ? document.querySelector('.path-world__host[data-live="true"]') : document.querySelector('.path-world__stage .path-world__flat svg')), live, { timeout });
  // The iris and the HUD settle.
  await new Promise((r) => setTimeout(r, 900));
}
export async function minimize(page) {
  for (let i = 0; i < 3; i++) {
    const open = await page.evaluate(() => Boolean(document.querySelector('.path-world')?.dataset.game));
    if (!open) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => !document.querySelector('.path-world')?.dataset.game, null, { timeout: 20_000 });
}
export async function onPage(page, fn, { live = true } = {}) {
  await minimize(page);
  const result = await fn();
  await openWorld(page, { live });
  return result;
}
export async function drawer(page) {
  if (await page.locator('.path-world__drawer').count()) return;
  await page.locator('.path-hud__gear').click();
  await page.waitForSelector('.path-world__drawer');
}
