/** Free roam in game mode (D-286) on the real Our Path page, fictional books only.
    `node scripts/capture-journey-free-roam.mjs` — writes PNGs and report.json to docs/evidence/journey-free-roam/.
    OUT=<dir>, THEMES=classic,..., WIDTHS=390,..., STEPS=latched,taken,... to narrow a run. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { startOurPathWorldProof } from './serve-our-path-world-proof.mjs';

const out = process.env.OUT || 'docs/evidence/journey-free-roam';
mkdirSync(out, { recursive: true });
const executablePath = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  executablePath,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const THEMES = (process.env.THEMES || 'classic,taylor,newfoundland').split(',');
const WIDTHS = (process.env.WIDTHS || '320,390,720,1100').split(',').map(Number);
const ALL = ['latched', 'taken', 'hint', 'roam-near', 'roam-far', 'roam-keys', 'radar', 'reduced', 'relatched'];
const STEPS = (process.env.STEPS || ALL.join(',')).split(',');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const benign = (text) => /Failed to load resource.*404|GPU stall|GL_CLOSE_PATH|swiftshader|WebGL.*(performance|warning)|Automatic fallback to software WebGL/i.test(text);
const proof = await startOurPathWorldProof({ port: 5197 });
const report = existsSync(`${out}/report.json`) ? JSON.parse(readFileSync(`${out}/report.json`, 'utf8')) : {};

async function open(width, query) {
  const height = width < 720 ? (width < 360 ? 640 : 844) : 800;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: width < 720 });
  const page = await context.newPage();
  const errors = { page: [], console: [] };
  page.on('pageerror', (e) => errors.page.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !benign(m.text())) errors.console.push(m.text().slice(0, 200)); });
  await page.goto(`${proof.url}?${query}`);
  await page.waitForFunction(() => window.__ready && document.querySelector('.path-world'), null, { timeout: 240_000 });
  await wait(600);
  return { page, errors, close: () => context.close() };
}

async function checks(page, errors) {
  const dom = await page.evaluate(() => {
    const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
    const hud = [...document.querySelectorAll('.path-hud button')].filter(visible);
    const host = document.querySelector('.path-world__host');
    const roamer = document.querySelector('.path-hud__roamer');
    const radar = document.querySelector('.path-roam-radar');
    const cone = document.querySelector('.path-roam-radar__cone');
    const here = document.querySelector('.path-roam-radar__here');
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      game: document.querySelector('.path-world')?.getAttribute('data-game') ?? null,
      live: host?.getAttribute('data-live') ?? null,
      roaming: host?.getAttribute('data-roaming') ?? null,
      roamPressed: roamer?.getAttribute('aria-pressed') ?? null,
      roamChip: document.querySelector('.path-hud__roam')?.textContent?.trim() ?? null,
      hint: document.querySelector('.path-hud__hint')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 140) ?? null,
      hostLabel: host?.getAttribute('aria-label')?.slice(0, 120) ?? null,
      hostRole: host?.getAttribute('role') ?? null,
      says: document.querySelector('.path-hud .sr-only[role="status"]')?.textContent ?? null,
      radar: radar ? { cone: Boolean(cone), us: Boolean(document.querySelector('.path-roam-radar__us')), here: here?.getAttribute('transform') ?? null, land: document.querySelectorAll('.path-roam-radar__land').length } : null,
      caption: document.querySelector('.path-hud__caption')?.textContent ?? null,
      focus: document.activeElement ? `${document.activeElement.tagName.toLowerCase()}.${String(document.activeElement.className).split(' ')[0]} "${(document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || '').trim().slice(0, 40)}"` : null,
      // The HUD's own controls, which this change owns. The compact simple view's zoom chips are D-284's and are
      // deliberately 30px inside the corner map; they are listed separately rather than hidden.
      smallTargets: [...hud.filter((b) => !b.closest('.path-hud__mini')), ...(radar ? [radar] : [])].filter((b) => { const r = b.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 40)),
      miniChipTargets: hud.filter((b) => b.closest('.path-hud__mini')).filter((b) => { const r = b.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).length,
      hudOverlaps: (() => {
        const boxes = [...document.querySelectorAll('.path-hud__corner--start, .path-hud__gear, .path-hud__minicol, .path-hud__caption, .path-world__rail, .path-hud .path-world__now, .path-hud__roam')].filter(visible).map((el) => ({ n: String(el.className).split(' ')[0], r: el.getBoundingClientRect() }));
        const list = [];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i].r, b = boxes[j].r; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) list.push(`${boxes[i].n}×${boxes[j].n}`); }
        return list;
      })(),
      offscreen: hud.filter((b) => !b.closest('.path-hud__mini')).filter((b) => { const r = b.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1; }).map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 30)),
      amounts: /\$\s?\d/.test(document.querySelector('.path-hud')?.textContent ?? ''),
    };
  });
  return { pageErrors: errors.page.slice(0, 3), consoleErrors: errors.console.slice(0, 3), ...dom };
}

async function shot(page, errors, file) {
  await page.screenshot({ path: `${out}/${file}` });
  report[file] = await checks(page, errors);
  const row = report[file];
  if (row.pageErrors.length || row.consoleErrors.length || row.overflow || row.smallTargets.length) console.warn('  !', file, JSON.stringify({ p: row.pageErrors, c: row.consoleErrors, o: row.overflow, s: row.smallTargets }));
  console.log(file, JSON.stringify({ roaming: row.roaming, pressed: row.roamPressed, chip: row.roamChip, says: row.says, radar: row.radar && row.radar.here }));
}

/** Open the world from the simple view's corner and wait for the live island. */
async function openWorld(page) {
  await page.waitForSelector('[data-slot="journey-mini"] .path-world__full, .path-world__open', { timeout: 120_000 });
  await page.evaluate(() => (document.querySelector('[data-slot="journey-mini"] > .path-world__full') ?? document.querySelector('.path-world__open')).click());
  await page.waitForFunction(() => document.querySelector('.path-world')?.dataset.game === 'open', null, { timeout: 60_000 });
  await page.waitForFunction(() => document.querySelector('.path-world__host[data-live="true"]'), null, { timeout: 180_000 });
  // The entering iris, the opening trip to this week and the HUD all settle. Software WebGL makes the trip slow.
  await page.waitForFunction(() => document.querySelector('.path-world')?.dataset.level === '3', null, { timeout: 120_000, polling: 300 })
    .catch(() => console.warn('  camera still travelling on open'));
  await wait(1800);
}
/**
 * Drag on the island. Software WebGL draws about two frames a second here, so every gesture is kept to a few
 * moves; a drag changes the camera on the pointer event itself, not on a frame, so it still lands exactly.
 * `button: 'right'` looks around (and drops the camera toward the horizon) instead of gliding.
 */
async function dragTheIsland(page, dx, dy, { steps = 3, button = 'left' } = {}) {
  const box = await page.locator('.path-world__host').boundingBox();
  const x = box.x + box.width * 0.5, y = box.y + box.height * 0.45;
  await page.mouse.move(x, y);
  await page.mouse.down({ button });
  for (let i = 1; i <= steps; i++) await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps);
  await page.mouse.up({ button });
}
const roamView = (page) => page.evaluate(() => window.__pathWorld()?.roamView() ?? null);
/** Hold a roam key for a while, the way a hand does. */
async function hold(page, key, ms) { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); }
const roamTo = (page, x, z) => page.evaluate(([px, pz]) => window.__pathWorld()?.roamTo(px, pz), [x, z]);
/** Software WebGL runs at a couple of frames a second: wait for the camera to actually arrive, not for a clock. */
async function arrived(page, x, z, within = 18) {
  await page.waitForFunction(([px, pz, near]) => {
    const view = window.__pathWorld()?.roamView();
    return Boolean(view) && Math.hypot(view.tx - px, view.tz - pz) <= near;
  }, [x, z, within], { timeout: 90_000, polling: 250 }).catch(() => console.warn('  camera still travelling'));
  await wait(700);
}

try {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      const quality = width < 720 ? 'lite' : 'full';
      for (const motion of width === 390 ? ['full', 'reduced'] : ['full']) {
        if (motion === 'reduced' && !STEPS.includes('reduced')) continue;
        const query = `theme=${theme}&story=well&eras=demo&lantern=1&quality=${quality}&motion=${motion}&ambient=off&chrome=1`;
        const { page, errors, close } = await open(width, query);
        const name = (step) => `${theme}-${width}-${step}.png`;
        try {
          await openWorld(page);
          if (motion === 'reduced') {
            // Reduced motion: the camera moves exactly while a key is held and stops dead when it is let go.
            await page.locator('.path-hud__roamer').click();
            await wait(600);
            await page.keyboard.down('w');
            await wait(2200);
            await page.keyboard.up('w');
            const stopped = await roamView(page);
            await wait(1600);
            const still = await roamView(page);
            report[`${theme}-${width}-reduced.json`] = stopped && still
              ? { driftAfterRelease: +Math.hypot(still.tx - stopped.tx, still.tz - stopped.tz).toFixed(3) }
              : null;
            await shot(page, errors, name('8-reduced-roaming'));
            continue;
          }
          if (STEPS.includes('latched')) await shot(page, errors, name('1-latched'));
          // The unlatch moment: a drag on the island takes the camera.
          await dragTheIsland(page, -150, 60, { steps: 2 });
          // The quiet line is on screen for a few seconds. Software WebGL can eat that before a screenshot lands:
          // if it has already settled, take the camera again from the control and shoot that instead.
          let takenBy = 'drag';
          if (!(await page.locator('.path-hud__roam[data-taken]').count())) {
            takenBy = 'control';
            await page.evaluate(() => { document.querySelector('.path-hud__roam-back')?.click(); });
            await page.waitForFunction(() => !document.querySelector('.path-hud__roam'), null, { timeout: 30_000 });
            await page.evaluate(() => document.querySelector('.path-hud__roamer').click());
            await page.waitForSelector('.path-hud__roam[data-taken]', { timeout: 15_000 });
          }
          if (STEPS.includes('taken')) { await shot(page, errors, name('2-taken')); report[name('2-taken')].takenBy = takenBy; }
          if (STEPS.includes('hint')) await shot(page, errors, name('3-hint'));
          await page.evaluate(() => document.querySelector('.path-hud__hint button')?.click());
          await wait(300);
          // Roaming across the island itself: look around and drop toward the horizon, then glide.
          if (STEPS.includes('roam-near')) {
            await page.evaluate(() => window.__pathWorld()?.zoom(1.5));
            await dragTheIsland(page, 40, 70, { steps: 4, button: 'right' });
            await dragTheIsland(page, 120, -70, { steps: 4 });
            await wait(1400);
            await shot(page, errors, name('4-roam-island'));
          }
          // And out over the future era islands, which the roam ring reaches (the latched camera stops short).
          if (STEPS.includes('roam-far')) {
            const view = await roamView(page);
            const others = (view?.islands ?? []).filter((i) => Math.hypot(i.x, i.z) > 1).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
            const near = others[0];
            if (near) {
              // Stand off the island rather than on top of it, and keep the horizon in frame.
              const back = 1;
              const now = await roamView(page);
              await page.evaluate((f) => window.__pathWorld()?.zoom(f), Math.max(0.4, Math.min(4, 62 / Math.max(1, now.r))));
              await roamTo(page, near.x * back, near.z * back);
              await arrived(page, near.x * back, near.z * back, 24);
              // Look out along the journey: the camera drops a little and the islands line up ahead.
              await dragTheIsland(page, 0, 24, { steps: 2, button: 'right' });
              await wait(1200);
              await shot(page, errors, name('5-roam-future-islands'));
            } else console.warn('  no future islands in this fixture');
          }
          if (STEPS.includes('radar')) {
            report[`${theme}-${width}-radar.json`] = await page.evaluate(() => window.__pathWorld()?.roamView() ?? null);
            await page.locator('.path-roam-radar').screenshot({ path: `${out}/${theme}-${width}-6-radar-cone.png` });
            report[`${theme}-${width}-6-radar-cone.png`] = await checks(page, errors);
            console.log(`${theme}-${width}-6-radar-cone.png`, JSON.stringify(report[`${theme}-${width}-6-radar-cone.png`].radar));
          }
          if (STEPS.includes('roam-keys')) {
            // Keyboard roaming: Tab to the island (the canvas wrapper takes focus and shows its ring), then W and E.
            await page.evaluate(() => document.querySelector('.path-world__host').focus());
            const before = await roamView(page);
            // Software WebGL draws about two frames a second and each frame advances at most 50ms of camera time,
            // so a key must be held far longer here than on a real device to cover the same ground.
            await page.keyboard.down('Shift');
            await hold(page, 'w', 9000);
            await hold(page, 'e', 5000);
            await page.keyboard.up('Shift');
            await wait(1500);
            const after = await roamView(page);
            report[`${theme}-${width}-keyboard.json`] = before && after
              ? { movedBy: +Math.hypot(after.tx - before.tx, after.tz - before.tz).toFixed(2), turnedBy: +(after.heading - before.heading).toFixed(3), focusRing: await page.evaluate(() => document.activeElement?.className ?? null) }
              : null;
            await shot(page, errors, name('7-keyboard-roaming'));
          }
          if (STEPS.includes('relatched')) {
            await page.evaluate(() => [...document.querySelectorAll('.path-hud__roam-back')].at(-1)?.click());
            await page.waitForFunction(() => !document.querySelector('.path-hud__roam'), null, { timeout: 20_000 });
            await wait(2200);
            await shot(page, errors, name('9-relatched'));
          }
        } finally { await close(); }
      }
    }
  }
} finally {
  writeFileSync(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  await proof.close();
}
