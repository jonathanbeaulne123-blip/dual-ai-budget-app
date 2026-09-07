import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const url = process.env.HEARTH_LEDGER_APP_URL ?? "http://localhost:5194";
const count = Number(process.env.HEARTH_LEDGER_SAMPLES ?? 1);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
async function calibrate(page) {
  const readings = [];
  for (let i = 0; i < 20; i++) {
    const before = performance.timeOrigin + performance.now(),
      remote = await page.evaluate(
        () => performance.timeOrigin + performance.now(),
      ),
      after = performance.timeOrigin + performance.now();
    readings.push({
      offset: remote - (before + after) / 2,
      uncertainty: (after - before) / 2,
    });
  }
  return readings.sort((a, b) => a.uncertainty - b.uncertainty)[0];
}
const contexts = [],
  pages = [],
  failures = [],
  samples = [];
const household = `HH-BROWSER-${crypto.randomUUID()}`;
await mkdir("artifacts/ledger-sync", { recursive: true });
try {
  for (const member of ["MEM-001", "MEM-002"]) {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 1000 },
    });
    contexts.push(context);
    const page = await context.newPage();
    pages.push(page);
    page.on("pageerror", (e) => failures.push(e.message));
    page.on("request", (r) => {
      if (
        /rest\/v1\/(household_snapshots|continuity_command_events)|publish_continuity_snapshot/.test(
          r.url(),
        )
      )
        failures.push(`Legacy transport: ${r.url()}`);
    });
    await page.goto(
      `${url}/test/browser/ledger-sync-app.html?household=${household}&member=${member}`,
    );
    await page.getByText("Live", { exact: true }).waitFor({ timeout: 90000 });
    const notNow = page.getByRole("button", { name: "Not now", exact: true });
    if (await notNow.count()) await notNow.click();
  }
  const [sender, receiver] = pages;
  let total = 0;
  const calibration = {
    before: await Promise.all(pages.map(calibrate)),
    after: null,
  };
  await sender.evaluate(() => {
    window.__ledgerClicks = [];
    document.addEventListener(
      "click",
      (e) => {
        if (e.target.closest("[data-add-confirm]"))
          window.__ledgerClicks.push(
            performance.timeOrigin + performance.now(),
          );
      },
      true,
    );
  });
  for (let i = 0; i < count; i++) {
    const cents = 101 + i;
    total += cents;
    await sender
      .getByRole("button", { name: "Add money", exact: true })
      .click();
    await sender
      .getByRole("menuitem", { name: "Add expense", exact: true })
      .click();
    for (const digit of String(cents))
      await sender.getByRole("button", { name: digit, exact: true }).click();
    await sender
      .getByRole("button", { name: "Groceries", exact: true })
      .click();
    await sender.getByRole("button", { name: "Enter", exact: true }).click();
    await sender.getByRole("button", { name: "Continue", exact: true }).click();
    await sender
      .locator('[data-add-account-tiles] button[aria-label$=" Visa"]')
      .click();
    await sender.locator("#add-note").fill(`sync sample ${i}`);
    await sender.getByRole("button", { name: "Continue", exact: true }).click();
    const label = new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(total / 100);
    await receiver.evaluate((expected) => {
      window.__ledgerPaint = null;
      const observer = new MutationObserver(() => {
        const node = document.querySelector('button[aria-label^="Money out."]');
        if (node?.textContent.includes(expected)) {
          observer.disconnect();
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              window.__ledgerPaint = {
                at: performance.timeOrigin + performance.now(),
                text: node.textContent,
              };
            }),
          );
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["aria-label"],
      });
    }, label);
    await sender.locator("[data-add-confirm]").click();
    await receiver.waitForFunction(
      () => window.__ledgerPaint !== null,
      {},
      { timeout: 30000 },
    );
    const painted = await receiver.evaluate(() => window.__ledgerPaint),
      clicked = await sender.evaluate(() => window.__ledgerClicks.at(-1));
    samples.push({
      index: i,
      ms:
        painted.at -
        clicked -
        (calibration.before[1].offset - calibration.before[0].offset),
      rawMs: painted.at - clicked,
      clicked,
      paintedAt: painted.at,
      totalCents: total,
    });
    await sender
      .locator("[data-add-confirm]")
      .waitFor({ state: "hidden", timeout: 30000 });
    if ((i + 1) % 10 === 0 || count === 1)
      console.log(
        JSON.stringify({ samples: i + 1, lastMs: samples.at(-1).ms }),
      );
  }
  calibration.after = await Promise.all(pages.map(calibrate));
  if (
    calibration.after.some(
      (reading, i) =>
        Math.abs(reading.offset - calibration.before[i].offset) > 2,
    )
  )
    failures.push("Clock calibration drift exceeds 2 ms");
  const sorted = samples.map((s) => s.ms).sort((a, b) => a - b),
    result = {
      scope:
        "local Chromium contexts, real App + SQLite Worker + IndexedDB/PGlite",
      build: process.env.HEARTH_LEDGER_BUILD_LABEL ?? "vite-development",
      household,
      count,
      calibration,
      samples,
      p50: sorted[Math.ceil(count * 0.5) - 1],
      p95: sorted[Math.ceil(count * 0.95) - 1],
      max: sorted.at(-1),
      failures,
    };
  await writeFile(
    "artifacts/ledger-sync/browser-proof.json",
    JSON.stringify(result, null, 2),
  );
  await receiver.screenshot({ path: "artifacts/ledger-sync/receiver.png" });
  console.log(JSON.stringify({ ...result, samples: undefined }));
  if (failures.length) throw new Error(failures.join("\n"));
} catch (error) {
  for (let i = 0; i < pages.length; i++) {
    console.log(
      "PAGE",
      i,
      (await pages[i].locator("body").innerText()).slice(-4500),
    );
    await pages[i].screenshot({
      path: `artifacts/ledger-sync/failure-${i}.png`,
    });
  }
  throw error;
} finally {
  await browser.close();
}
