import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import sharp from "sharp";

export const FIVE_DIMENSIONS = Object.freeze([
  "truth",
  "taskCompletion",
  "recovery",
  "responsiveAccessibility",
  "productionEvidence",
]);

export const REQUIRED_VIEWPORTS = Object.freeze([320, 390, 430, 720, 1100]);

const SHA_40 = /^[0-9a-f]{40}$/;
const SHA_256 = /^[0-9a-f]{64}$/;
const DATE_ID = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$/;
const DIMENSION_KINDS = Object.freeze({
  truth: new Set(["test-report", "truth-attestation"]),
  taskCompletion: new Set(["browser-report"]),
  recovery: new Set(["recovery-report"]),
  responsiveAccessibility: new Set(["accessibility-report"]),
  productionEvidence: new Set(["deployment-receipt", "live-smoke"]),
});
const ARTIFACT_KINDS = new Set([...Object.values(DIMENSION_KINDS).flatMap((kinds) => [...kinds]), "screenshot", "redaction-report", "human-attestation"]);

function issue(code, message, dimensions = []) {
  return { code, message, dimensions };
}

function isoMs(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function unique(values) {
  return [...new Set(values)];
}

function canonicalEnvironmentId(environment) {
  if (!environment || typeof environment !== "object") return "";
  return [environment.kind, environment.origin, environment.deploymentId, environment.buildId, environment.privacyScope].join("|");
}

function artifactPath(root, path) {
  if (typeof path !== "string" || path.length === 0 || isAbsolute(path)) return null;
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(resolvedRoot, path);
  const withinRoot = relative(resolvedRoot, resolvedPath);
  if (withinRoot.startsWith("..") || isAbsolute(withinRoot)) return null;
  return resolvedPath;
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function createClaimDigest(evidence) {
  const claim = {
    schemaVersion: evidence?.schemaVersion,
    template: evidence?.template,
    fixture: evidence?.fixture,
    runId: evidence?.runId,
    evidenceDate: evidence?.evidenceDate,
    featureId: evidence?.featureId,
    sourceSha: evidence?.sourceSha,
    startedAt: evidence?.startedAt,
    completedAt: evidence?.completedAt,
    timeZone: evidence?.timeZone,
    environment: evidence?.environment,
    dimensions: evidence?.dimensions,
    truthGuardrails: evidence?.truthGuardrails,
    artifacts: (evidence?.artifacts ?? []).filter((artifact) => artifact.kind !== "human-attestation").sort((a, b) => a.id.localeCompare(b.id)),
    browserRuns: evidence?.browserRuns,
    production: evidence?.production,
    redaction: evidence?.redaction,
  };
  return createHash("sha256").update(JSON.stringify(stableValue(claim))).digest("hex");
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngDimensions(path) {
  const bytes = readFileSync(path);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 45 || !bytes.subarray(0, 8).equals(signature)) return null;
  let offset = 8;
  let header = null;
  const imageData = [];
  let ended = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const crcOffset = dataStart + length;
    if (crcOffset + 4 > bytes.length) return null;
    const type = bytes.toString("ascii", typeStart, dataStart);
    const data = bytes.subarray(dataStart, crcOffset);
    if (crc32(bytes.subarray(typeStart, crcOffset)) !== bytes.readUInt32BE(crcOffset)) return null;
    if (type === "IHDR") {
      if (header || length !== 13) return null;
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      imageData.push(data);
    } else if (type === "IEND") {
      ended = length === 0;
      offset = crcOffset + 4;
      break;
    }
    offset = crcOffset + 4;
  }
  if (!header || header.width <= 0 || header.height <= 0 || header.compression !== 0 || header.filter !== 0
    || header.interlace !== 0 || imageData.length === 0 || !ended || offset !== bytes.length) return null;
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[header.colorType];
  if (!channels || ![1, 2, 4, 8, 16].includes(header.bitDepth)) return null;
  try {
    const decoded = inflateSync(Buffer.concat(imageData));
    const rowBytes = Math.ceil((header.width * channels * header.bitDepth) / 8);
    if (decoded.length !== header.height * (rowBytes + 1)) return null;
  } catch {
    return null;
  }
  return { width: header.width, height: header.height };
}

function jpegDimensions(path) {
  const bytes = readFileSync(path);
  if (bytes.length < 16 || bytes[0] !== 0xff || bytes[1] !== 0xd8
    || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return null;
  let offset = 2;
  while (offset < bytes.length - 2) {
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 7) return null;
      return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  return null;
}

async function screenshotDimensions(path, mimeType) {
  const structural = mimeType === "image/png" && path.endsWith(".png")
    ? pngDimensions(path)
    : mimeType === "image/jpeg" && /\.jpe?g$/i.test(path)
      ? jpegDimensions(path)
      : null;
  if (!structural) return null;
  try {
    const { data, info } = await sharp(path, { failOn: "error", limitInputPixels: 40_000_000 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (!info.width || !info.height || data.length !== info.width * info.height * info.channels
      || info.width !== structural.width || info.height !== structural.height) return null;
    return { width: info.width, height: info.height };
  } catch {
    return null;
  }
}

function torontoDate(value) {
  const parsed = isoMs(value);
  if (parsed === null) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(parsed));
  const read = (type) => parts.find((part) => part.type === type)?.value;
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function validOutputPath(path, evidence) {
  if (!path || evidence?.fixture === true) return evidence?.fixture === true;
  const normalized = resolve(path).replaceAll("\\", "/");
  const suffix = `/artifacts/five-of-five/${evidence.evidenceDate}/${evidence.featureId}/${evidence.sourceSha}-${evidence.environment?.kind}.json`;
  return normalized.endsWith(suffix);
}

export function validateJourneyManifest(manifest) {
  const issues = [];
  if (manifest?.schemaVersion !== 1) issues.push(issue("MANIFEST_INVALID", "schemaVersion must be 1."));
  if (manifest?.timeZone !== "America/Toronto") issues.push(issue("MANIFEST_INVALID", "timeZone must be America/Toronto."));
  if (manifest?.maxEvidenceAgeHours !== 24) issues.push(issue("MANIFEST_INVALID", "maxEvidenceAgeHours must be 24."));
  if (JSON.stringify(manifest?.requiredViewports) !== JSON.stringify(REQUIRED_VIEWPORTS)) {
    issues.push(issue("MANIFEST_INVALID", `requiredViewports must be ${REQUIRED_VIEWPORTS.join(", ")}.`));
  }
  const dimensions = manifest?.dimensions?.map((entry) => entry.id);
  if (JSON.stringify(dimensions) !== JSON.stringify(FIVE_DIMENSIONS)
    || manifest?.dimensions?.some((entry) => entry.weight !== 1)) {
    issues.push(issue("MANIFEST_INVALID", "The five dimensions must be fixed, ordered, and equally weighted."));
  }
  if (!Array.isArray(manifest?.guardrails) || manifest.guardrails.length === 0) {
    issues.push(issue("MANIFEST_INVALID", "At least one immutable Hearth guardrail is required."));
  }
  if (!Array.isArray(manifest?.features) || manifest.features.length === 0) {
    issues.push(issue("MANIFEST_INVALID", "At least one browser feature journey is required."));
  }
  const featureIds = new Set();
  for (const feature of manifest?.features ?? []) {
    if (featureIds.has(feature?.id)) issues.push(issue("MANIFEST_INVALID", `Feature id ${feature?.id} is duplicated.`));
    featureIds.add(feature?.id);
    if (!feature?.id || !Array.isArray(feature.journeys) || feature.journeys.length < 2) {
      issues.push(issue("MANIFEST_INVALID", `Feature ${feature?.id ?? "<missing>"} needs task and recovery journeys.`));
      continue;
    }
    const purposes = new Set(feature.journeys.map((journey) => journey.purpose));
    if (!purposes.has("task") || !purposes.has("recovery")) {
      issues.push(issue("MANIFEST_INVALID", `Feature ${feature.id} needs both task and recovery purposes.`));
    }
    const journeyIds = new Set();
    for (const journey of feature.journeys) {
      if (journeyIds.has(journey?.id)) issues.push(issue("MANIFEST_INVALID", `Journey id ${journey?.id} is duplicated.`));
      journeyIds.add(journey?.id);
      if (!journey.id || typeof journey.route !== "string" || !Number.isInteger(journey.timeoutMs) || journey.timeoutMs <= 0) {
        issues.push(issue("MANIFEST_INVALID", `Feature ${feature.id} has an invalid journey.`));
      }
      if (!Array.isArray(journey.steps) || journey.steps.length === 0 || !Array.isArray(journey.assertions) || journey.assertions.length === 0) {
        issues.push(issue("MANIFEST_INVALID", `Journey ${journey.id ?? "<missing>"} needs steps and assertions.`));
      }
    }
  }
  return issues;
}

export async function evaluateFeatureEvidence({
  manifest,
  evidence,
  evidenceRoot,
  expectedSha,
  expectedEnvironmentId,
  worktreeClean,
  evidencePath,
  now = new Date(),
  allowFixture = false,
}) {
  const issues = [...validateJourneyManifest(manifest)];
  const feature = manifest?.features?.find((entry) => entry.id === evidence?.featureId);
  if (!feature) issues.push(issue("FEATURE_UNKNOWN", "Evidence featureId is not in the journey manifest."));
  if (evidence?.schemaVersion !== 1) issues.push(issue("EVIDENCE_SCHEMA_INVALID", "Evidence schemaVersion must be 1."));
  if (evidence?.template === true) issues.push(issue("TEMPLATE_NOT_EVIDENCE", "The template can never be evaluated as evidence."));
  if (evidence?.fixture === true && !allowFixture) issues.push(issue("FIXTURE_NOT_CLAIMABLE", "Synthetic fixtures cannot make a real feature claim."));
  if (!worktreeClean) issues.push(issue("DIRTY_WORKTREE", "Commit first; evidence from a dirty worktree is not current."));
  if (!SHA_40.test(expectedSha ?? "") || evidence?.sourceSha !== expectedSha) {
    issues.push(issue("SHA_MISMATCH", "Evidence must match the evaluator-derived 40-character HEAD SHA.", FIVE_DIMENSIONS));
  }

  const environmentId = canonicalEnvironmentId(evidence?.environment);
  if (!expectedEnvironmentId || environmentId !== expectedEnvironmentId) {
    issues.push(issue("ENVIRONMENT_MISMATCH", "Environment kind, origin, deployment, and privacy scope must match.", FIVE_DIMENSIONS));
  }
  if (!evidence?.environment?.buildId || (evidence?.environment?.kind === "production" && !/^https:\/\//.test(evidence.environment.origin ?? ""))) {
    issues.push(issue("ENVIRONMENT_IDENTITY_INCOMPLETE", "Environment identity needs a build id and Production HTTPS origin.", FIVE_DIMENSIONS));
  }
  if (!/^environment\+household\+member\+view:(?:sha256:[0-9a-f]{64}|public-no-household|synthetic-redacted)$/.test(evidence?.environment?.privacyScope ?? "")) {
    issues.push(issue("PRIVACY_SCOPE_MISSING", "Use an opaque scope SHA-256 or the documented public/synthetic sentinel.", ["truth"]));
  }
  if (!DATE_ID.test(evidence?.runId ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(evidence?.evidenceDate ?? "")
    || !evidence.runId.startsWith(`${evidence.evidenceDate}-`) || evidence?.timeZone !== "America/Toronto"
    || torontoDate(evidence?.completedAt) !== evidence?.evidenceDate || !validOutputPath(evidencePath, evidence)) {
    issues.push(issue("DATED_OUTPUT_INVALID", "runId must begin with an ISO date and use America/Toronto."));
  }
  if (!evidence?.redaction?.complete || (evidence?.redaction?.findings?.length ?? 0) > 0) {
    issues.push(issue("REDACTION_INCOMPLETE", "Evidence must attest complete redaction with zero findings.", FIVE_DIMENSIONS));
  }

  const startedAt = isoMs(evidence?.startedAt);
  const completedAt = isoMs(evidence?.completedAt);
  const nowMs = now.getTime();
  if (startedAt === null || completedAt === null || startedAt > completedAt || completedAt > nowMs + 60_000) {
    issues.push(issue("EVIDENCE_TIME_INVALID", "Run timestamps are invalid or future-dated.", FIVE_DIMENSIONS));
  }
  const maxAgeMs = (manifest?.maxEvidenceAgeHours ?? 24) * 60 * 60 * 1000;
  if (completedAt !== null && nowMs - completedAt > maxAgeMs) {
    issues.push(issue("EVIDENCE_STALE", "Evidence is older than the 24-hour gate window.", FIVE_DIMENSIONS));
  }

  const artifacts = new Map();
  const invalidArtifactIds = new Set();
  for (const artifact of evidence?.artifacts ?? []) {
    if (!artifact?.id || artifacts.has(artifact.id)) {
      issues.push(issue("ARTIFACT_INVALID", "Artifact ids must be present and unique."));
      continue;
    }
    artifacts.set(artifact.id, artifact);
    if (!ARTIFACT_KINDS.has(artifact.kind)) {
      invalidArtifactIds.add(artifact.id);
      issues.push(issue("ARTIFACT_KIND_MISMATCH", `Artifact ${artifact.id} has unsupported kind ${artifact.kind}.`));
    }
    if (artifact.sourceSha !== expectedSha) {
      invalidArtifactIds.add(artifact.id);
      issues.push(issue("SHA_MISMATCH", `Artifact ${artifact.id} has a different SHA.`));
    }
    if (artifact.environmentId !== expectedEnvironmentId) {
      invalidArtifactIds.add(artifact.id);
      issues.push(issue("ENVIRONMENT_MISMATCH", `Artifact ${artifact.id} has a different environment.`));
    }
    const capturedAt = isoMs(artifact.capturedAt);
    const expiresAt = isoMs(artifact.expiresAt);
    const afterRun = completedAt !== null && capturedAt !== null && capturedAt > completedAt;
    if (capturedAt === null || expiresAt === null || capturedAt > nowMs + 60_000 || expiresAt < nowMs
      || (startedAt !== null && capturedAt < startedAt) || (afterRun && artifact.kind !== "human-attestation")) {
      invalidArtifactIds.add(artifact.id);
      issues.push(issue("EVIDENCE_STALE", `Artifact ${artifact.id} is stale, future-dated, or outside this run.`));
    }
    const path = artifactPath(evidenceRoot, artifact.path);
    if (!path || !existsSync(path)) {
      invalidArtifactIds.add(artifact.id);
      issues.push(issue("ARTIFACT_MISSING", `Artifact ${artifact.id} is missing or outside the evidence directory.`));
    } else if (!SHA_256.test(artifact.sha256 ?? "") || hashFile(path) !== artifact.sha256) {
      invalidArtifactIds.add(artifact.id);
      issues.push(issue("ARTIFACT_HASH_MISMATCH", `Artifact ${artifact.id} failed SHA-256 verification.`));
    }
  }

  const dimensionPass = Object.fromEntries(FIVE_DIMENSIONS.map((dimension) => [dimension, true]));
  const dimensionEvidenceIds = new Set();
  const evidenceOwner = new Map();
  for (const dimension of FIVE_DIMENSIONS) {
    const record = evidence?.dimensions?.[dimension];
    if (record?.status !== "pass" || !Array.isArray(record.evidenceIds) || record.evidenceIds.length === 0) {
      dimensionPass[dimension] = false;
      issues.push(issue("DIMENSION_INCOMPLETE", `${dimension} needs pass status and evidence links.`, [dimension]));
      continue;
    }
    for (const id of record.evidenceIds) {
      dimensionEvidenceIds.add(id);
      if (!artifacts.has(id) || invalidArtifactIds.has(id)) {
        dimensionPass[dimension] = false;
        issues.push(issue("EVIDENCE_LINK_BROKEN", `${dimension} references missing or invalid artifact ${id}.`, [dimension]));
      } else if (!DIMENSION_KINDS[dimension].has(artifacts.get(id).kind)) {
        dimensionPass[dimension] = false;
        issues.push(issue("ARTIFACT_KIND_MISMATCH", `${dimension} cannot use ${artifacts.get(id).kind}.`, [dimension]));
      }
      if (evidenceOwner.has(id) && evidenceOwner.get(id) !== dimension) {
        dimensionPass[dimension] = false;
        dimensionPass[evidenceOwner.get(id)] = false;
        issues.push(issue("EVIDENCE_REUSED", `Artifact ${id} cannot stand in for multiple dimensions.`, [dimension, evidenceOwner.get(id)]));
      } else {
        evidenceOwner.set(id, dimension);
      }
    }
  }

  const requiredGuardrails = new Set((manifest?.guardrails ?? []).map((entry) => entry.id));
  const provenGuardrails = new Set();
  for (const guardrail of evidence?.truthGuardrails ?? []) {
    if (guardrail?.status === "pass" && artifacts.has(guardrail.artifactId) && !invalidArtifactIds.has(guardrail.artifactId)
      && DIMENSION_KINDS.truth.has(artifacts.get(guardrail.artifactId).kind)) provenGuardrails.add(guardrail.id);
  }
  for (const id of requiredGuardrails) {
    if (!provenGuardrails.has(id)) {
      dimensionPass.truth = false;
      issues.push(issue("GUARDRAIL_UNPROVEN", `Immutable guardrail ${id} lacks current evidence.`, ["truth"]));
    }
  }

  const runs = evidence?.browserRuns ?? [];
  const expectedRunKeys = new Set();
  for (const journey of feature?.journeys ?? []) {
    for (const width of REQUIRED_VIEWPORTS) expectedRunKeys.add(`${journey.id}:${width}`);
  }
  const observedRunKeys = new Set();
  const screenshotIds = new Set();
  const screenshotPaths = new Set();
  const screenshotHashes = new Set();
  for (const run of runs) {
    const key = `${run?.journeyId}:${run?.viewport?.width}`;
    if (observedRunKeys.has(key)) issues.push(issue("JOURNEY_DUPLICATE", `Browser run ${key} is duplicated.`, ["taskCompletion", "recovery", "responsiveAccessibility"]));
    observedRunKeys.add(key);
    const journey = feature?.journeys?.find((entry) => entry.id === run?.journeyId);
    const linkedDimensions = journey?.purpose === "recovery"
      ? ["recovery", "responsiveAccessibility"]
      : ["taskCompletion", "responsiveAccessibility"];
    if (run?.sourceSha !== expectedSha) issues.push(issue("SHA_MISMATCH", `Browser run ${key} has a different SHA.`, linkedDimensions));
    if (run?.environmentId !== expectedEnvironmentId) issues.push(issue("ENVIRONMENT_MISMATCH", `Browser run ${key} has a different environment.`, linkedDimensions));
    if (!REQUIRED_VIEWPORTS.includes(run?.viewport?.width) || !Number.isInteger(run?.viewport?.height) || run.viewport.height < 480
      || !Number.isFinite(run?.devicePixelRatio) || run.devicePixelRatio < 0.5 || run.devicePixelRatio > 4
      || !Number.isInteger(run?.contentViewport?.width) || !Number.isInteger(run?.contentViewport?.height)
      || run.contentViewport.width <= 0 || run.contentViewport.height <= 0
      || run.contentViewport.width > run.viewport.width || run.contentViewport.height > run.viewport.height
      || run.viewport.width - run.contentViewport.width > 32 || run.viewport.height - run.contentViewport.height > 100) {
      issues.push(issue("VIEWPORT_INVALID", `Browser run ${key} has an invalid viewport.`, linkedDimensions));
    }
    if (run?.status !== "pass" || !journey || run?.completedSteps !== journey.steps.length || run?.passedAssertions !== journey.assertions.length) {
      issues.push(issue("JOURNEY_INCOMPLETE", `Browser run ${key} did not complete its manifest.`, linkedDimensions));
    }
    const runStartedAt = isoMs(run?.startedAt);
    const runCompletedAt = isoMs(run?.completedAt);
    const measuredDuration = runStartedAt === null || runCompletedAt === null ? null : runCompletedAt - runStartedAt;
    if (!journey || run?.timeoutMs !== journey.timeoutMs || runStartedAt === null || runCompletedAt === null
      || measuredDuration !== run?.durationMs || measuredDuration < 0 || measuredDuration > journey.timeoutMs
      || (startedAt !== null && runStartedAt < startedAt) || (completedAt !== null && runCompletedAt > completedAt)
      || runCompletedAt > nowMs + 60_000) {
      issues.push(issue("JOURNEY_TIMEOUT", `Browser run ${key} lacks valid bounded timing or exceeded its deadline.`, linkedDimensions));
    }
    const capture = run?.capture;
    if (!capture?.consoleComplete || !capture?.networkComplete || !capture?.timeoutsComplete
      || !Array.isArray(capture?.consoleErrors) || !Array.isArray(capture?.networkErrors) || !Array.isArray(capture?.timeouts)) {
      issues.push(issue("CAPTURE_INCOMPLETE", `Browser run ${key} did not capture every runtime channel.`, linkedDimensions));
    }
    if ((capture?.consoleErrors?.length ?? 0) > 0) issues.push(issue("CONSOLE_ERROR", `Browser run ${key} captured a console error.`, linkedDimensions));
    if ((capture?.networkErrors?.length ?? 0) > 0) issues.push(issue("NETWORK_ERROR", `Browser run ${key} captured a failed or HTTP error request.`, linkedDimensions));
    if ((capture?.timeouts?.length ?? 0) > 0) issues.push(issue("JOURNEY_TIMEOUT", `Browser run ${key} captured a timeout.`, linkedDimensions));
    const manual = run?.manual;
    if (!manual?.observer || !manual?.noHorizontalOverflow || !manual?.keyboardPathPass || !manual?.focusVisible
      || !manual?.accessibleNameOrderPass || !manual?.zoom200Pass || !manual?.reducedMotionPass) {
      issues.push(issue("RESPONSIVE_A11Y_FAIL", `Browser run ${key} lacks complete hands-on responsive/accessibility proof.`, ["responsiveAccessibility"]));
    }
    const screenshot = artifacts.get(run?.screenshotArtifactId);
    const screenshotPath = screenshot ? artifactPath(evidenceRoot, screenshot.path) : null;
    const dimensions = screenshotPath && existsSync(screenshotPath) ? await screenshotDimensions(screenshotPath, screenshot?.mimeType) : null;
    if (!screenshot || invalidArtifactIds.has(run?.screenshotArtifactId) || screenshot.kind !== "screenshot"
      || !dimensions
      || dimensions.width !== Math.round(run.contentViewport.width * run.devicePixelRatio)
      || dimensions.height !== Math.round(run.contentViewport.height * run.devicePixelRatio)) {
      issues.push(issue("SCREENSHOT_MISSING", `Browser run ${key} lacks a verified screenshot.`, linkedDimensions));
    } else if (screenshotIds.has(run.screenshotArtifactId) || screenshotPaths.has(screenshot.path) || screenshotHashes.has(screenshot.sha256)) {
      issues.push(issue("SCREENSHOT_REUSED", `Browser run ${key} reuses another viewport screenshot id, path, or hash.`, linkedDimensions));
    } else {
      screenshotIds.add(run.screenshotArtifactId);
      screenshotPaths.add(screenshot.path);
      screenshotHashes.add(screenshot.sha256);
    }
  }
  for (const key of expectedRunKeys) {
    if (!observedRunKeys.has(key)) {
      const width = Number(key.split(":").at(-1));
      issues.push(issue("VIEWPORT_MISSING", `Missing hands-on browser run ${key}.`, ["taskCompletion", "recovery", "responsiveAccessibility"]));
      if (width === 430) issues.push(issue("VIEWPORT_430_MISSING", "The required 430 px proof is missing.", ["responsiveAccessibility"]));
    }
  }

  const production = evidence?.production;
  if (evidence?.environment?.kind !== "production" || !production?.deploymentId || production.deploymentId !== evidence.environment.deploymentId
    || production?.deployedSha !== expectedSha || production?.origin !== evidence.environment.origin
    || !artifacts.has(production?.deploymentArtifactId) || invalidArtifactIds.has(production?.deploymentArtifactId)
    || artifacts.get(production?.deploymentArtifactId)?.kind !== "deployment-receipt"
    || !artifacts.has(production?.liveSmokeArtifactId) || invalidArtifactIds.has(production?.liveSmokeArtifactId)
    || artifacts.get(production?.liveSmokeArtifactId)?.kind !== "live-smoke"
    || production?.deploymentArtifactId === production?.liveSmokeArtifactId
    || artifacts.get(production?.deploymentArtifactId)?.path === artifacts.get(production?.liveSmokeArtifactId)?.path
    || artifacts.get(production?.deploymentArtifactId)?.sha256 === artifacts.get(production?.liveSmokeArtifactId)?.sha256) {
    dimensionPass.productionEvidence = false;
    issues.push(issue("PRODUCTION_EVIDENCE_INVALID", "Production needs exact-SHA deployment and live-origin smoke artifacts.", ["productionEvidence"]));
  }

  for (const current of issues) {
    for (const dimension of current.dimensions ?? []) dimensionPass[dimension] = false;
  }
  const redactionArtifact = artifacts.get(evidence?.redaction?.artifactId);
  if (!redactionArtifact || invalidArtifactIds.has(evidence.redaction.artifactId) || redactionArtifact.kind !== "redaction-report") {
    issues.push(issue("REDACTION_INCOMPLETE", "Redaction needs a distinct verified redaction-report artifact.", FIVE_DIMENSIONS));
  }
  const acceptanceArtifact = artifacts.get(evidence?.humanAcceptance?.attestationArtifactId);
  if (!acceptanceArtifact || invalidArtifactIds.has(evidence.humanAcceptance.attestationArtifactId)
    || acceptanceArtifact.kind !== "human-attestation") {
    issues.push(issue("HUMAN_ATTESTATION_INVALID", "Human acceptance needs a verified human-attestation artifact."));
  }
  const allEvidenceIds = unique([...artifacts.keys()]);
  const acceptance = evidence?.humanAcceptance;
  const acceptanceTime = isoMs(acceptance?.acceptedAt);
  const latestArtifactTime = Math.max(0, ...[...artifacts.values()].map((artifact) => isoMs(artifact.capturedAt) ?? 0));
  const latestBrowserTime = Math.max(0, ...runs.map((run) => isoMs(run?.completedAt) ?? 0));
  const latestEvidenceTime = Math.max(completedAt ?? 0, latestArtifactTime, latestBrowserTime);
  const reviewed = new Set(acceptance?.reviewedEvidenceIds ?? []);
  let attestation = null;
  const attestationPath = acceptanceArtifact ? artifactPath(evidenceRoot, acceptanceArtifact.path) : null;
  try {
    attestation = attestationPath ? JSON.parse(readFileSync(attestationPath, "utf8")) : null;
  } catch {
    attestation = null;
  }
  const reviewedIds = [...reviewed].sort();
  const attestedIds = Array.isArray(attestation?.reviewedEvidenceIds) ? [...attestation.reviewedEvidenceIds].sort() : [];
  const attestationMatches = attestation?.schemaVersion === 1
    && attestation?.type === "hearth-human-acceptance"
    && attestation?.claimDigest === createClaimDigest(evidence)
    && attestation?.sourceSha === expectedSha
    && attestation?.environmentId === expectedEnvironmentId
    && attestation?.acceptedBy === acceptance?.acceptedBy
    && attestation?.acceptedAt === acceptance?.acceptedAt
    && JSON.stringify(attestedIds) === JSON.stringify(reviewedIds);
  if (!attestationMatches) issues.push(issue("HUMAN_ATTESTATION_INVALID", "Human attestation does not bind the current immutable claim."));
  const humanAccepted = acceptance?.accepted === true
    && acceptance?.role === "human"
    && typeof acceptance?.acceptedBy === "string"
    && acceptance.acceptedBy.trim().length > 0
    && !/(codex|claude|gemini|openai|artificial intelligence|\bai\b|fixture|synthetic)/i.test(acceptance.acceptedBy)
    && acceptanceTime !== null
    && acceptanceTime >= latestEvidenceTime
    && acceptanceTime <= nowMs + 60_000
    && isoMs(acceptanceArtifact?.capturedAt) === acceptanceTime
    && attestationMatches
    && allEvidenceIds.every((id) => reviewed.has(id));
  if (!humanAccepted) issues.push(issue("HUMAN_ACCEPTANCE_MISSING", "A human must review every current evidence artifact after capture."));

  const earnedDimensions = FIVE_DIMENSIONS.filter((dimension) => dimensionPass[dimension]).length;
  const fixturePassed = evidence?.fixture === true && allowFixture && issues.every((entry) => entry.code === "HUMAN_ACCEPTANCE_MISSING") === false
    ? false
    : evidence?.fixture === true && allowFixture && issues.length === 0;
  const canDisplayFiveOfFive = evidence?.fixture !== true
    && evidence?.template !== true
    && issues.length === 0
    && earnedDimensions === 5
    && humanAccepted;
  const displayLabel = canDisplayFiveOfFive ? "5/5" : null;

  return {
    ok: evidence?.fixture === true ? fixturePassed : canDisplayFiveOfFive,
    fixturePassed,
    canDisplayFiveOfFive,
    displayLabel,
    earnedDimensions,
    dimensionPass,
    issues,
  };
}

function loadJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function git(command) {
  return execFileSync("git", command, { encoding: "utf8" }).trim();
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] !== "evaluate") {
    console.error("Usage: node scripts/verify-feature-evidence.mjs evaluate --manifest <file> --evidence <file> --environment-kind <kind> --origin <url> --deployment-id <id> --build-id <id> --privacy-scope <fingerprint>");
    process.exitCode = 2;
    return;
  }
  const manifestPath = option(args, "--manifest");
  const evidencePath = option(args, "--evidence");
  const expectedEnvironment = {
    kind: option(args, "--environment-kind"),
    origin: option(args, "--origin"),
    deploymentId: option(args, "--deployment-id"),
    buildId: option(args, "--build-id"),
    privacyScope: option(args, "--privacy-scope"),
  };
  const environmentId = canonicalEnvironmentId(expectedEnvironment);
  if (!manifestPath || !evidencePath || Object.values(expectedEnvironment).some((value) => !value)) {
    console.error("Manifest, evidence, and all five exact environment identity flags are required.");
    process.exitCode = 2;
    return;
  }
  const result = await evaluateFeatureEvidence({
    manifest: loadJson(manifestPath),
    evidence: loadJson(evidencePath),
    evidenceRoot: resolve(evidencePath, ".."),
    evidencePath: resolve(evidencePath),
    expectedSha: git(["rev-parse", "HEAD"]),
    expectedEnvironmentId: environmentId,
    worktreeClean: git(["status", "--porcelain", "--untracked-files=all"]) === "",
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.canDisplayFiveOfFive) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main();
}
