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

function diagnosticUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "[invalid-url]";
  }
}

export function redactDiagnosticText(value) {
  return String(value)
    .replace(/https?:\/\/[^\s"'<>]+/gi, (match) => diagnosticUrl(match))
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-jwt]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\b(?:sk|key|token|secret)[-_][A-Za-z0-9_-]{12,}\b/gi, "[redacted-secret]");
}

function installRuntimeCapture(page) {
  const consoleErrors = [];
  const networkErrors = [];
  const timeouts = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(redactDiagnosticText(message.text()));
  });
  page.on("pageerror", (error) => consoleErrors.push(redactDiagnosticText(error.message)));
  page.on("requestfailed", (request) => {
    networkErrors.push(`${request.method()} ${diagnosticUrl(request.url())} ${redactDiagnosticText(request.failure()?.errorText ?? "request failed")}`);
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    networkErrors.push(`${response.request().method()} ${diagnosticUrl(response.url())} HTTP ${response.status()}`);
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

async function captureKeyboardFocusOrder(page) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.body.setAttribute("tabindex", "-1");
    document.body.focus();
  });

  const order = [];
  for (let index = 0; index < 40; index += 1) {
    await page.keyboard.press("Tab");
    const entry = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return null;
      const group = active.closest("#lens-tabs") ? "lens"
        : active.closest("#gate-tabs") ? "gate"
          : "other";
      return {
        tag: active.tagName.toLowerCase(),
        id: active.id || null,
        role: active.getAttribute("role"),
        group,
        name: (active.getAttribute("aria-label") || active.textContent || "").trim(),
        controls: active.getAttribute("aria-controls"),
        focusVisible: active.matches(":focus-visible"),
      };
    });
    if (!entry) continue;
    const focused = page.locator(":focus");
    entry.ariaSnapshot = await focused.ariaSnapshot().catch(() => "");
    entry.controlsValid = await page.evaluate((controls) => {
      if (!controls) return false;
      const panel = document.getElementById(controls);
      return panel?.getAttribute("role") === "tabpanel"
        && panel.getAttribute("aria-labelledby") === document.activeElement?.id;
    }, entry.controls);
    order.push(entry);
    if (order.filter((item) => item.group === "lens").length >= 1
      && order.filter((item) => item.group === "gate").length >= 1) break;
  }
  await page.evaluate(() => document.body.removeAttribute("tabindex"));

  const lensIndex = order.findIndex((entry) => entry.group === "lens");
  const gateIndex = order.findIndex((entry) => entry.group === "gate");
  const tabs = order.filter((entry) => entry.group === "lens" || entry.group === "gate");
  const pass = lensIndex >= 0
    && gateIndex > lensIndex
    && tabs.every((entry) => entry.tag === "button"
      && entry.role === "tab"
      && entry.name.length > 0
      && entry.ariaSnapshot.includes(entry.name)
      && entry.controlsValid
      && entry.focusVisible);
  return { pass, order };
}

async function verifyTextZoom(page) {
  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const previous = root.style.fontSize;
    const keyNodes = [document.querySelector("h1"), document.querySelector("#lens-tabs [role='tab']"), document.querySelector("#gate-tabs [role='tab']")]
      .filter((node) => node instanceof HTMLElement);
    const before = {
      rootFontPx: Number.parseFloat(getComputedStyle(root).fontSize),
      keyFontPx: keyNodes.map((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
    };
    root.style.fontSize = "200%";
    const boxes = keyNodes.map((node) => {
      const box = node.getBoundingClientRect();
      const renderedAndHorizontallyReachable = box.width > 0
        && box.height > 0
        && box.right > 0
        && box.left < window.innerWidth;
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
        renderedAndHorizontallyReachable,
      };
    });
    const after = {
      rootFontPx: Number.parseFloat(getComputedStyle(root).fontSize),
      keyFontPx: keyNodes.map((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
    };
    const pass = after.rootFontPx >= before.rootFontPx * 1.95
      && after.keyFontPx.every((size, index) => size >= before.keyFontPx[index] * 1.1)
      && root.scrollWidth <= root.clientWidth + 1
      && boxes.every((box) => box.renderedAndHorizontallyReachable);
    root.style.fontSize = previous;
    return {
      pass,
      before,
      after,
      keyBounds: boxes,
      keyBoundsPass: boxes.every((box) => box.renderedAndHorizontallyReachable),
    };
  });
  return { ...result, method: "root-font-size-200-percent-with-key-content-bounds" };
}

async function motionSnapshot(page) {
  return page.evaluate(() => {
    const seconds = (value) => value.split(",").map((part) => {
      const item = part.trim();
      if (item.endsWith("ms")) return Number.parseFloat(item) / 1000;
      if (item.endsWith("s")) return Number.parseFloat(item);
      return 0;
    });
    let maxSeconds = 0;
    let activeElements = 0;
    for (const element of document.querySelectorAll("*")) {
      const style = getComputedStyle(element);
      const durations = [...seconds(style.animationDuration), ...seconds(style.transitionDuration)];
      const elementMax = Math.max(0, ...durations);
      if (elementMax > 0) activeElements += 1;
      maxSeconds = Math.max(maxSeconds, elementMax);
    }
    return { maxSeconds, activeElements };
  });
}

async function verifyReducedMotion(page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const normal = await motionSnapshot(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await motionSnapshot(page);
  const mediaMatches = await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  return {
    pass: reducedMotionBehaviorPass(normal, reduced, mediaMatches),
    mediaMatches,
    normal,
    reduced,
  };
}

export function reducedMotionBehaviorPass(normal, reduced, mediaMatches) {
  if (!mediaMatches) return false;
  const negligibleSeconds = 0.001;
  if (normal.activeElements === 0 || normal.maxSeconds <= negligibleSeconds) {
    return reduced.maxSeconds <= negligibleSeconds;
  }
  return reduced.maxSeconds <= normal.maxSeconds
    && reduced.activeElements <= normal.activeElements
    && (reduced.maxSeconds < normal.maxSeconds || reduced.activeElements < normal.activeElements);
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
  const capture = installRuntimeCapture(page);
  const startedAt = new Date();
  const url = new URL(journey.route, origin).toString();
  let status = "pass";
  let completedSteps = 0;
  let passedAssertions = 0;
  let keyboardPathPass = false;
  let focusVisible = false;
  let focusOrderPass = false;
  let focusOrder = [];
  let zoom200Pass = false;
  let zoomMethod = "not-run";
  let zoomEvidence = null;
  let reducedMotionPass = false;
  let reducedMotionEvidence = null;
  let overflowPass = false;
  let axeViolations = [];
  let allAxeViolations = [];

  try {
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: journey.timeoutMs });
    if (!response || response.status() >= 400) throw new Error(`Roadmap navigation failed with HTTP ${response?.status() ?? "no response"}.`);
    await waitForRoadmap(page);

    if (journey.purpose === "recovery") await exerciseRecoveryJourney(page, url);
    else await exerciseTaskJourney(page);
    keyboardPathPass = true;
    completedSteps = journey.steps.length;

    focusVisible = await focusIsVisible(page);
    const focusEvidence = await captureKeyboardFocusOrder(page);
    focusOrderPass = focusEvidence.pass;
    focusOrder = focusEvidence.order;
    overflowPass = await noHorizontalOverflow(page);
    const zoom = await verifyTextZoom(page);
    zoom200Pass = zoom.pass;
    zoomMethod = zoom.method;
    zoomEvidence = zoom;
    const reducedMotion = await verifyReducedMotion(page);
    reducedMotionPass = reducedMotion.pass;
    reducedMotionEvidence = reducedMotion;

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    allAxeViolations = axe.violations;
    axeViolations = seriousAxeViolations(allAxeViolations);
    if (!overflowPass || !focusVisible || !focusOrderPass || !zoom200Pass || !reducedMotionPass || axeViolations.length > 0) {
      status = "fail";
    } else {
      passedAssertions = journey.assertions.length;
    }
  } catch (error) {
    status = "fail";
    const message = error instanceof Error ? error.message : String(error);
    if (/timeout/i.test(message)) capture.timeouts.push(redactDiagnosticText(message));
    else capture.consoleErrors.push(`journey: ${redactDiagnosticText(message)}`);
  }

  if (capture.consoleErrors.length > 0 || capture.networkErrors.length > 0 || capture.timeouts.length > 0) status = "fail";

  let contentViewport = null;
  let devicePixelRatio = null;
  try {
    contentViewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    devicePixelRatio = await page.evaluate(() => window.devicePixelRatio);
  } catch (error) {
    status = "fail";
    capture.consoleErrors.push(`post-journey: ${redactDiagnosticText(error instanceof Error ? error.message : String(error))}`);
  }
  const baseName = `${journey.id}-${width}`;
  const screenshotPath = resolve(outputDirectory, `${baseName}.png`);
  const axePath = resolve(outputDirectory, `${baseName}-axe.json`);
  let screenshotCaptured = false;
  try {
    await page.screenshot({ path: screenshotPath, fullPage: false });
    screenshotCaptured = true;
  } catch (error) {
    status = "fail";
    capture.consoleErrors.push(`screenshot: ${redactDiagnosticText(error instanceof Error ? error.message : String(error))}`);
  }
  await writeFile(axePath, `${JSON.stringify({ violations: allAxeViolations, seriousOrCritical: axeViolations }, null, 2)}\n`, "utf8");
  const completedAt = new Date();
  await context.close().catch((error) => {
    status = "fail";
    capture.consoleErrors.push(`context-close: ${redactDiagnosticText(error instanceof Error ? error.message : String(error))}`);
  });

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
      screenshotArtifactId: screenshotCaptured ? screenshotId : null,
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
        keyboardFocusOrderPass: focusOrderPass,
        focusOrder,
        zoom200Pass,
        zoomMethod,
        zoomEvidence,
        reducedMotionPass,
        reducedMotionEvidence,
      },
      axe: {
        reportArtifactId: axeId,
        totalViolations: allAxeViolations.length,
        seriousOrCriticalViolations: axeViolations.length,
      },
    },
    artifacts: [
      ...(screenshotCaptured ? [{
        id: screenshotId,
        kind: "screenshot",
        path: `${baseName}.png`,
        mimeType: "image/png",
        sha256: await sha256(screenshotPath),
        sourceSha,
        environmentId,
        capturedAt: completedAt.toISOString(),
      }] : []),
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
  validatePublicFeature(feature, origin);

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

export function validatePublicFeature(feature, origin) {
  if (feature.dataClass !== "public-no-household") {
    throw new Error(`Feature ${feature.id} is not approved for this public-only collector.`);
  }
  if (!Array.isArray(feature.journeys) || feature.journeys.length === 0) {
    throw new Error(`Feature ${feature.id} must define at least one public journey.`);
  }
  for (const journey of feature.journeys) {
    const journeyUrl = new URL(journey.route, origin);
    if (journeyUrl.origin !== origin) throw new Error(`Journey ${journey.id} must stay on the collector origin.`);
  }
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
