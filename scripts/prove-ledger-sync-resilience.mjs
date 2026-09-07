import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const url = process.env.HEARTH_LEDGER_APP_URL ?? "http://localhost:5194";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
const watchdog = setTimeout(() => void browser.close(), 180000);
const household = `HH-OFFLINE-${crypto.randomUUID()}`,
  contexts = [],
  pages = [];
try {
  for (let n = 1; n <= 6; n++) {
    const context = await browser.newContext();
    contexts.push(context);
    const page = await context.newPage();
    pages.push(page);
    await page.goto(`${url}/test/browser/ledger-client.html`);
    await page.waitForFunction(() => typeof window.initialize === "function");
    await page.evaluate(
      ([id, member]) => window.initialize(id, member),
      [household, `MEM-00${n}`],
    );
    await page.waitForFunction(() => window.syncStatus === "ready");
    console.log(`Member ${n} connected`);
  }
  const offline = pages[0],
    context = contexts[0];
  const creationId = `HH-CREATION-${crypto.randomUUID()}`;
  await offline.evaluate((id) => window.stageCreation(id), creationId);
  await context.setOffline(true);
  const queued = [];
  for (let n = 0; n < 100; n++)
    queued.push(await offline.evaluate((n) => window.queue(`offline-${n}`), n));
  console.log("100 intents durably queued offline");
  for (let n = 1; n < 6; n++)
    await pages[n].evaluate((n) => window.queue(`remote-${n}`, true), n);
  console.log("Five other members posted");
  // Reload with the ledger endpoint partitioned but static code available.
  await context.route("**/ledger-sync/**", (route) => route.abort());
  await context.setOffline(false);
  await offline.reload();
  await offline.waitForFunction(() => typeof window.initialize === "function");
  await offline.evaluate((id) => window.initialize(id, "MEM-001"), household);
  await offline.waitForFunction(() => window.replica !== undefined);
  const saved = await offline.evaluate(() => window.pending());
  if (
    (await offline.evaluate(
      (id) => window.stageCreation(id),
      `HH-CREATION-${crypto.randomUUID()}`,
    )) !== creationId
  )
    throw new Error("Create retry changed household identity");
  if (
    JSON.stringify(saved.map((command) => command.id)) !==
    JSON.stringify(queued)
  )
    throw new Error("Reload changed the durable command order or identity");
  console.log("Reload preserved all command IDs and order");
  await context.unroute("**/ledger-sync/**");
  await offline.evaluate(() => window.retry());
  await offline.waitForFunction(
    () =>
      window.replica.transactions.length === 105 &&
      window.syncStatus === "ready",
    null,
    { timeout: 90000 },
  );
  const results = await Promise.all(
    pages.map((page) =>
      page.evaluate(() => ({
        count: window.replica.transactions.length,
        notes: window.replica.transactions.map((row) => row.note).sort(),
      })),
    ),
  );
  for (let n = 1; n < 6; n++) {
    await pages[n].waitForFunction(
      () => window.replica.transactions.length === 105,
      null,
      { timeout: 30000 },
    );
    results[n] = await pages[n].evaluate(() => ({
      count: window.replica.transactions.length,
      notes: window.replica.transactions.map((row) => row.note).sort(),
    }));
  }
  if (
    results.some(
      (result) =>
        JSON.stringify(result.notes) !== JSON.stringify(results[0].notes),
    )
  )
    throw new Error("Replicas diverged");
  if ((await offline.evaluate(() => window.pending())).length)
    throw new Error("Acknowledged commands remain pending");
  await offline.evaluate((id) => window.finishCreation(id), creationId);
  await offline.evaluate(() => window.poisonCache());
  await offline.reload();
  await offline.waitForFunction(() => typeof window.initialize === "function");
  await offline.evaluate((id) => window.initialize(id, "MEM-001"), household);
  await offline.waitForFunction(
    () =>
      window.syncStatus === "ready" &&
      window.replica.transactions.length === 105 &&
      window.replica.name !== "DAMAGED CACHE",
    null,
    { timeout: 30000 },
  );
  const evidence = {
    damagedCacheRepairedAtSameSequence: true,
    stableCreationIdentityAcrossReload: true,
    scope:
      "real browser IndexedDB and v2 client, local SQLite Worker; six members",
    household,
    offlineIntents: 100,
    remoteMembers: 5,
    finalTransactions: 105,
    stableIdsAndOrderAfterReload: true,
    converged: true,
    wallClockOffline15Minutes: false,
  };
  await mkdir("artifacts/ledger-sync", { recursive: true });
  await writeFile(
    "artifacts/ledger-sync/resilience-proof.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence));
} catch (error) {
  console.log(
    await Promise.all(
      pages.map((page) =>
        page
          .evaluate(() => ({
            status: window.syncStatus,
            message: window.syncMessage,
            count: window.replica?.transactions.length,
          }))
          .catch(() => null),
      ),
    ),
  );
  throw error;
} finally {
  clearTimeout(watchdog);
  await browser.close();
}
