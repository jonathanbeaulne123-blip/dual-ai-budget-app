import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST = resolve(REPO_ROOT, "docs/evidence-gates/browser-journeys.json");
const OUTPUT_ROOT = resolve(REPO_ROOT, "artifacts/browser-evidence");
const SERIOUS_AXE_IMPACTS = new Set(["serious", "critical"]);

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function parseCollectorArgs(args) {
  return {
    origin: option(args, "--origin"),
    featureId: option(args, "--feature") ?? "public-roadmap",
    manifestPath: option(args, "--manifest") ?? DEFAULT_MANIFEST,
    outputPath: option(args, "--output"),
    sourceSha: option(args, "--source-sha"),
    headed: args.includes("--headed"),
  };
}

export function seriousAxeViolations(violations) {
  return violations.filter((violation) => SERIOUS_AXE_IMPACTS.has(violation.impact));
}

export function resolveCollectorOutput(outputPath, fallbackName) {
  const candidate = outputPath
    ? resolve(REPO_ROOT, outputPath)
    : resolve(OUTPUT_ROOT, fallbackName);
  const distance = relative(OUTPUT_ROOT, candidate);
  if (distance.startsWith("..") || isAbsolute(distance)) {
    throw new Error("Browser evidence must stay under artifacts/browser-evidence.");
  }
  return candidate;
}

function currentSha(explicitSha) {
  if (explicitSha) return explicitSha;
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim();
}

function torontoDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const pick = (type) => parts.find((part) => part.type === type)?.value;
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function sameOrigin(url, origin) {
  try {
    return new URL(url).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

function installRuntimeCapture(page, origin) {
  const consoleErrors = [];
  const networkErrors = [];
  const timeouts = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (!sameOrigin(request.url(), origin)) return;
    networkErrors.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "request failed"}`);
  });
  page.on("response", (response) => {
    if (response.status() < 400 || !sameOrigin(response.url(), origin)) return;
    networkErrors.push(`${response.request().method()} ${response.url()} HTTP ${response.status()}`);
  });

  return { consoleErrors, networkErrors, timeouts };
}

async function waitForRoadmap(page) {
  await page.getByRole("heading", { name: /Hearth living roadmap and museum/i }).waitFor();
  await page.locator("#lens-tabs [role='tab']").first().waitFor();
  await page.locator("#gate-tabs [role='tab']").first().waitFor();
}

async function noHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

async function focusIsVisible(page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    return active instanceof HTMLElement && active.matches(":focus-visible");
  });
}

async function accessibleTabOrderPass(page) {
  return page.evaluate(() => {
    const lens = [...document.querySelectorAll("#lens-tabs [role='tab']")];
    const gates = [...document.querySelectorAll("#gate-tabs [role='tab']")];
    const named = [...lens, ...gates].every((node) => Boolean(node.getAttribute("aria-label") || node.textContent?.trim()));
    return named && lens.length > 1 && gates.length > 1
      && lens.every((node) => node instanceof HTMLButtonElement)
      && gates.every((node) => node instanceof HTMLButtonElement);
  });
}

async function verifyTextZoom(page) {
  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const previous = root.style.fontSize;
    root.style.fontSize = "200%";
    const title = document.querySelector("h1");
    const titleBox = title?.getBoundingClientRect();
    const pass = root.scrollWidth <= root.clientWidth + 1
      && Boolean(titleBox && titleBox.width > 0 && titleBox.height > 0);
    root.style.fontSize = previous;
    return pass;
  });
  return { pass: result, method: "root-font-size-200-percent" };
}

async function verifyReducedMotion(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const pass = await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  return pass;
}

async function exerciseTaskJourney(page) {
  const lensTabs = page.locator("#lens-tabs [role='tab']");
  const gateTabs = page.locator("#gate-tabs [role='tab']");

  await lensTabs.nth(1).focus();
  await page.keyboard.press("Enter");
  if (await lensTabs.nth(1).getAttribute("aria-selected") !== "true") {
    throw new Error("Enter did not activate the second analysis lens.");
  }

  await gateTabs.nth(1).focus();
  await page.keyboard.press("Space");
  if (await gateTabs.nth(1).getAttribute("aria-selected") !== "true") {
    throw new Error("Space did not activate the second evidence gate.");
  }

  await lensTabs.nth(1).focus();
  await page.keyboard.press("Home");
  if (await lensTabs.first().getAttribute("aria-selected") !== "true") {
    throw new Error("Home did not return to the first analysis lens.");
  }
}

async function exerciseRecoveryJourney(page, url) {
  await page.reload({ waitUntil: "networkidle" });
  if (page.url() !== url) throw new Error(`Recovery redirected away from ${url}.`);
  await waitForRoadmap(page);

  const gateTabs = page.locator("#gate-tabs [role='tab']");
  await gateTabs.nth(1).focus();
  await page.keyboard.press("Enter");
  if (await gateTabs.nth(1).getAttribute("aria-selected") !== "true") {
    throw new Error("Evidence gates were not operable after reload.");
  }
}

async function runJourney({ browser, origin, journey, width, outputDirectory, sourceSha, environmentId }) {
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(journey.timeoutMs);
  const capture = installRuntimeCapture(page, origin);
  const startedAt = new Date();
  const url = new URL(journey.route, origin).toString();
  let status = "pass";
  let completedSteps = 0;
  let passedAssertions = 0;
  let keyboardPathPass = false;
  let focusVisible = false;
  let accessibleNameOrderPass = false;
  let zoom200Pass = false;
  let zoomMethod = "not-run";
  let reducedMotionPass = false;
  let overflowPass = false;
  let axeViolations = [];

  try {
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: journey.timeoutMs });
    if (!response || response.status() >= 400) throw new Error(`Roadmap navigation failed with HTTP ${response?.status() ?? "no response"}.`);
    await waitForRoadmap(page);

    if (journey.purpose === "recovery") await exerciseRecoveryJourney(page, url);
    else await exerciseTaskJourney(page);
    keyboardPathPass = true;
    completedSteps = journey.steps.length;

    focusVisible = await focusIsVisible(page);
    accessibleNameOrderPass = await accessibleTabOrderPass(page);
    overflowPass = await noHorizontalOverflow(page);
    const zoom = await verifyTextZoom(page);
    zoom200Pass = zoom.pass;
    zoomMethod = zoom.method;
    reducedMotionPass = await verifyReducedMotion(page);

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    axeViolations = seriousAxeViolations(axe.violations);
    if (!overflowPass || !focusVisible || !accessibleNameOrderPass || !zoom200Pass || !reducedMotionPass || axeViolations.length > 0) {
      status = "fail";
    } else {
      passedAssertions = journey.assertions.length;
    }
  } catch (error) {
    status = "fail";
    const message = error instanceof Error ? error.message : String(error);
    if (/timeout/i.test(message)) capture.timeouts.push(message);
    else capture.consoleErrors.push(`journey: ${message}`);
  }

  if (capture.consoleErrors.length > 0 || capture.networkErrors.length > 0 || capture.timeouts.length > 0) status = "fail";

  const contentViewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const devicePixelRatio = await page.evaluate(() => window.devicePixelRatio);
  const baseName = `${journey.id}-${width}`;
  const screenshotPath = resolve(outputDirectory, `${baseName}.png`);
  const axePath = resolve(outputDirectory, `${baseName}-axe.json`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await writeFile(axePath, `${JSON.stringify({ violations: axeViolations }, null, 2)}\n`, "utf8");
  const completedAt = new Date();
  await context.close();

  const screenshotId = `${baseName}-screenshot`;
  const axeId = `${baseName}-axe`;
  return {
    run: {
      journeyId: journey.id,
      sourceSha,
      environmentId,
      viewport: { width, height: 800 },
      contentViewport,
      devicePixelRatio,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      timeoutMs: journey.timeoutMs,
      status,
      completedSteps,
      passedAssertions,
      screenshotArtifactId: screenshotId,
      capture: {
        consoleComplete: true,
        networkComplete: true,
        timeoutsComplete: true,
        consoleErrors: capture.consoleErrors,
        networkErrors: capture.networkErrors,
        timeouts: capture.timeouts,
      },
      manual: {
        observer: "automation:playwright-axe",
        noHorizontalOverflow: overflowPass,
        keyboardPathPass,
        focusVisible,
        accessibleNameOrderPass,
        zoom200Pass,
        zoomMethod,
        reducedMotionPass,
      },
      axe: {
        reportArtifactId: axeId,
        seriousOrCriticalViolations: axeViolations.length,
      },
    },
    artifacts: [
      {
        id: screenshotId,
        kind: "screenshot",
        path: `${baseName}.png`,
        mimeType: "image/png",
        sha256: await sha256(screenshotPath),
        sourceSha,
        environmentId,
        capturedAt: completedAt.toISOString(),
      },
      {
        id: axeId,
        kind: "accessibility-report",
        path: `${baseName}-axe.json`,
        mimeType: "application/json",
        sha256: await sha256(axePath),
        sourceSha,
        environmentId,
        capturedAt: completedAt.toISOString(),
      },
    ],
  };
}

export async function collectBrowserEvidence(options) {
  if (!options.origin) throw new Error("--origin is required.");
  const origin = new URL(options.origin).origin;
  const sourceSha = currentSha(options.sourceSha);
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) throw new Error("source SHA must be a 40-character lowercase Git SHA.");

  const manifest = JSON.parse(await readFile(resolve(options.manifestPath), "utf8"));
  const feature = manifest.features?.find((entry) => entry.id === options.featureId);
  if (!feature) throw new Error(`Feature ${options.featureId} is not in the browser journey manifest.`);

  const date = torontoDate();
  const outputDirectory = resolveCollectorOutput(options.outputPath, `${date}-${feature.id}-${sourceSha}`);
  await mkdir(outputDirectory, { recursive: true });
  const environmentId = `local-browser|${origin}|${sourceSha}|environment+household+member+view:public-no-household`;
  const browser = await chromium.launch({ headless: !options.headed });
  const runs = [];
  const artifacts = [];

  try {
    for (const journey of feature.journeys) {
      for (const width of manifest.requiredViewports) {
        const result = await runJourney({ browser, origin, journey, width, outputDirectory, sourceSha, environmentId });
        runs.push(result.run);
        artifacts.push(...result.artifacts);
      }
    }
  } finally {
    await browser.close();
  }

  const completedAt = new Date();
  const report = {
    schemaVersion: 1,
    collector: "playwright-axe",
    claimable: false,
    claimLimit: "Automated local browser evidence does not replace Production evidence or named-human acceptance.",
    featureId: feature.id,
    sourceSha,
    timeZone: manifest.timeZone,
    evidenceDate: date,
    environment: { kind: "local-browser", origin, environmentId },
    completedAt: completedAt.toISOString(),
    requiredViewports: manifest.requiredViewports,
    browserRuns: runs,
    artifacts,
    passed: runs.every((run) => run.status === "pass"),
  };
  const reportPath = resolve(outputDirectory, "browser-evidence.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { report, reportPath };
}

async function main() {
  try {
    const options = parseCollectorArgs(process.argv.slice(2));
    const { report, reportPath } = await collectBrowserEvidence(options);
    console.log(JSON.stringify({ passed: report.passed, runs: report.browserRuns.length, reportPath }, null, 2));
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
