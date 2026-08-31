import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createClaimDigest,
  evaluateFeatureEvidence,
  REQUIRED_VIEWPORTS,
  validateJourneyManifest,
} from "../scripts/verify-feature-evidence.mjs";

const sourceSha = "a".repeat(40);
const otherSha = "b".repeat(40);
const environment = {
  kind: "production",
  origin: "https://hearth.example.test",
  deploymentId: "deployment-main-aaa",
  buildId: "workflow-123",
  privacyScope: "environment+household+member+view:public-no-household",
};
const environmentId = Object.values(environment).join("|");
const now = new Date("2026-08-30T12:30:00.000Z");
const manifest = JSON.parse(readFileSync(new URL("../docs/evidence-gates/browser-journeys.json", import.meta.url), "utf8"));

type Fixture = ReturnType<typeof greenFixture>;

let evidenceRoot = "";
let evidencePath = "";
let temporaryRoot = "";

function artifact(id: string, kind: string, capturedAt = "2026-08-30T12:10:00.000Z", body = `synthetic ${id}`) {
  const path = `${id}.${kind === "human-attestation" ? "json" : "txt"}`;
  writeFileSync(join(evidenceRoot, path), body);
  return {
    id,
    kind,
    path,
    sha256: createHash("sha256").update(body).digest("hex"),
    sourceSha,
    environmentId,
    capturedAt,
    expiresAt: "2026-08-31T12:10:00.000Z",
  };
}

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function screenshotArtifact(id: string, width: number, height: number) {
  const path = `${id}.png`;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 0;
  const pixels = Buffer.alloc(height * (width + 1));
  createHash("sha256").update(id).digest().copy(pixels, 1, 0, Math.min(32, width));
  const body = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(join(evidenceRoot, path), body);
  return {
    id,
    kind: "screenshot",
    mimeType: "image/png",
    path,
    sha256: createHash("sha256").update(body).digest("hex"),
    sourceSha,
    environmentId,
    capturedAt: "2026-08-30T12:10:00.000Z",
    expiresAt: "2026-08-31T12:10:00.000Z",
  };
}

function greenFixture(fixture = true) {
  const artifacts = [
    artifact("truth-report", "test-report"),
    artifact("task-report", "browser-report"),
    artifact("recovery-report", "recovery-report"),
    artifact("responsive-report", "accessibility-report"),
    artifact("deployment-receipt", "deployment-receipt"),
    artifact("live-smoke", "live-smoke"),
    artifact("redaction-report", "redaction-report"),
  ];
  const browserRuns = manifest.features[0].journeys.flatMap((journey: { id: string; steps: unknown[]; assertions: unknown[] }) =>
    REQUIRED_VIEWPORTS.map((width) => {
      const screenshotArtifactId = `screenshot-${journey.id}-${width}`;
      const height = width < 720 ? 844 : 900;
      artifacts.push(screenshotArtifact(screenshotArtifactId, width, height));
      return {
        journeyId: journey.id,
        sourceSha,
        environmentId,
        viewport: { width, height },
        contentViewport: { width, height },
        devicePixelRatio: 1,
        startedAt: "2026-08-30T12:05:00.000Z",
        completedAt: "2026-08-30T12:05:01.000Z",
        durationMs: 1000,
        timeoutMs: 10000,
        status: "pass",
        completedSteps: journey.steps.length,
        passedAssertions: journey.assertions.length,
        screenshotArtifactId,
        capture: {
          consoleComplete: true,
          networkComplete: true,
          timeoutsComplete: true,
          consoleErrors: [],
          networkErrors: [],
          timeouts: [],
        },
        manual: {
          observer: "Synthetic harness operator",
          noHorizontalOverflow: true,
          keyboardPathPass: true,
          focusVisible: true,
          accessibleNameOrderPass: true,
          zoom200Pass: true,
          reducedMotionPass: true,
        },
      };
    }));
  const reviewedEvidenceIds = [...artifacts.map((entry) => entry.id), "human-attestation"];
  const evidence = {
    schemaVersion: 1,
    template: false,
    fixture,
    runId: "2026-08-30-synthetic-green-feature",
    evidenceDate: "2026-08-30",
    featureId: "public-roadmap",
    timeZone: "America/Toronto",
    sourceSha,
    startedAt: "2026-08-30T12:00:00.000Z",
    completedAt: "2026-08-30T12:20:00.000Z",
    environment,
    dimensions: {
      truth: { status: "pass", evidenceIds: ["truth-report"] },
      taskCompletion: { status: "pass", evidenceIds: ["task-report"] },
      recovery: { status: "pass", evidenceIds: ["recovery-report"] },
      responsiveAccessibility: { status: "pass", evidenceIds: ["responsive-report"] },
      productionEvidence: { status: "pass", evidenceIds: ["deployment-receipt", "live-smoke"] },
    },
    truthGuardrails: manifest.guardrails.map((entry: { id: string }) => ({
      id: entry.id,
      status: "pass",
      artifactId: "truth-report",
    })),
    artifacts,
    browserRuns,
    production: {
      deploymentId: environment.deploymentId,
      deployedSha: sourceSha,
      origin: environment.origin,
      deploymentArtifactId: "deployment-receipt",
      liveSmokeArtifactId: "live-smoke",
    },
    redaction: {
      complete: true,
      findings: [],
      artifactId: "redaction-report",
    },
    humanAcceptance: {
      accepted: true,
      role: "human",
      acceptedBy: "Jonathan Beaulne",
      acceptedAt: "2026-08-30T12:25:00.000Z",
      attestationArtifactId: "human-attestation",
      reviewedEvidenceIds,
    },
  };
  const attestation = {
    schemaVersion: 1,
    type: "hearth-human-acceptance",
    claimDigest: createClaimDigest(evidence),
    sourceSha,
    environmentId,
    acceptedBy: evidence.humanAcceptance.acceptedBy,
    acceptedAt: evidence.humanAcceptance.acceptedAt,
    reviewedEvidenceIds,
  };
  artifacts.push(artifact(
    "human-attestation",
    "human-attestation",
    evidence.humanAcceptance.acceptedAt,
    JSON.stringify(attestation),
  ));
  return evidence;
}

function evaluate(evidence: Fixture, options: Partial<Parameters<typeof evaluateFeatureEvidence>[0]> = {}) {
  return evaluateFeatureEvidence({
    manifest,
    evidence,
    evidenceRoot,
    evidencePath,
    expectedSha: sourceSha,
    expectedEnvironmentId: environmentId,
    worktreeClean: true,
    now,
    allowFixture: true,
    ...options,
  });
}

function refreshHumanAttestation(evidence: Fixture) {
  const entry = evidence.artifacts.find((candidate) => candidate.id === "human-attestation")!;
  const body = JSON.stringify({
    schemaVersion: 1,
    type: "hearth-human-acceptance",
    claimDigest: createClaimDigest(evidence),
    sourceSha,
    environmentId,
    acceptedBy: evidence.humanAcceptance.acceptedBy,
    acceptedAt: evidence.humanAcceptance.acceptedAt,
    reviewedEvidenceIds: evidence.humanAcceptance.reviewedEvidenceIds,
  });
  writeFileSync(join(evidenceRoot, entry.path), body);
  entry.sha256 = createHash("sha256").update(body).digest("hex");
}

async function replaceWithJpeg(evidence: Fixture, runIndex = 0) {
  const run = evidence.browserRuns[runIndex]!;
  const entry = evidence.artifacts.find((candidate) => candidate.id === run.screenshotArtifactId)! as ReturnType<typeof screenshotArtifact>;
  const oldPath = join(evidenceRoot, entry.path);
  const path = `${entry.id}.jpg`;
  const absolutePath = join(evidenceRoot, path);
  const width = Math.round(run.contentViewport.width * run.devicePixelRatio);
  const height = Math.round(run.contentViewport.height * run.devicePixelRatio);
  await sharp({
    create: { width, height, channels: 3, background: { r: 29, g: 42, b: 36 } },
  }).jpeg({ quality: 80 }).toFile(absolutePath);
  rmSync(oldPath);
  const body = readFileSync(absolutePath);
  entry.path = path;
  entry.mimeType = "image/jpeg";
  entry.sha256 = createHash("sha256").update(body).digest("hex");
  refreshHumanAttestation(evidence);
  return { entry, absolutePath };
}

beforeEach(() => {
  temporaryRoot = mkdtempSync(join(tmpdir(), "hearth-five-of-five-"));
  evidenceRoot = join(temporaryRoot, "artifacts", "five-of-five", "2026-08-30", "public-roadmap");
  mkdirSync(evidenceRoot, { recursive: true });
  evidencePath = join(evidenceRoot, `${sourceSha}-production.json`);
  writeFileSync(evidencePath, "{}");
});

afterEach(() => {
  rmSync(temporaryRoot, { recursive: true, force: true });
});

describe("P0-03 five-of-five evidence gate", () => {
  it("locks the manifest to five equal dimensions and the five required widths", () => {
    expect(validateJourneyManifest(manifest)).toEqual([]);
    expect(manifest.dimensions.map((entry: { weight: number }) => entry.weight)).toEqual([1, 1, 1, 1, 1]);
    expect(manifest.requiredViewports).toEqual([320, 390, 430, 720, 1100]);
  });

  it("passes the complete green feature fixture but permanently withholds a claimable label", async () => {
    const result = await evaluate(greenFixture());
    expect(result.fixturePassed).toBe(true);
    expect(result.earnedDimensions).toBe(5);
    expect(result.canDisplayFiveOfFive).toBe(false);
    expect(result.displayLabel).toBeNull();
    expect(result.issues).toEqual([]);
  });

  it("allows a real record to display 5/5 only after complete same-SHA evidence and human review", async () => {
    const evidence = greenFixture(false);
    const result = await evaluate(evidence);
    expect(result.canDisplayFiveOfFive).toBe(true);
    expect(result.displayLabel).toBe("5/5");
    expect(result.earnedDimensions).toBe(5);
  });

  it("invalidates the attestation when fixture state changes after review", async () => {
    const evidence = greenFixture();
    evidence.fixture = false;
    const result = await evaluate(evidence);
    expect(result.issues.map((entry) => entry.code)).toContain("HUMAN_ATTESTATION_INVALID");
    expect(result.canDisplayFiveOfFive).toBe(false);
  });

  it("rejects the intentionally failing feature and captures every required failure channel", async () => {
    const evidence = greenFixture();
    evidence.sourceSha = otherSha;
    evidence.completedAt = "2026-08-28T12:20:00.000Z";
    evidence.browserRuns = evidence.browserRuns.filter((run: { viewport: { width: number } }) => run.viewport.width !== 430);
    evidence.browserRuns[0]!.capture.consoleErrors.push({ message: "synthetic crash" } as never);
    evidence.browserRuns[0]!.capture.networkErrors.push({ status: 503, url: "/roadmap/" } as never);
    evidence.browserRuns[0]!.capture.timeouts.push({ step: "render", timeoutMs: 10000 } as never);
    evidence.humanAcceptance.accepted = false;
    evidence.humanAcceptance.reviewedEvidenceIds = [];
    const result = await evaluate(evidence, { now: new Date("2026-09-02T12:30:00.000Z") });
    const codes = new Set(result.issues.map((entry) => entry.code));
    expect(codes).toEqual(expect.objectContaining(new Set([
      "SHA_MISMATCH",
      "EVIDENCE_STALE",
      "VIEWPORT_MISSING",
      "VIEWPORT_430_MISSING",
      "CONSOLE_ERROR",
      "NETWORK_ERROR",
      "JOURNEY_TIMEOUT",
      "HUMAN_ACCEPTANCE_MISSING",
    ])));
    expect(result.canDisplayFiveOfFive).toBe(false);
    expect(result.displayLabel).toBeNull();
  });

  it("fails dirty worktrees, environment mismatch, and synthetic claims", async () => {
    const dirty = await evaluate(greenFixture(), { worktreeClean: false });
    expect(dirty.issues.map((entry) => entry.code)).toContain("DIRTY_WORKTREE");
    const wrongEnvironment = await evaluate(greenFixture(), { expectedEnvironmentId: "production|wrong|wrong|wrong" });
    expect(wrongEnvironment.issues.map((entry) => entry.code)).toContain("ENVIRONMENT_MISMATCH");
    const fixtureClaim = await evaluateFeatureEvidence({
      manifest,
      evidence: greenFixture(),
      evidenceRoot,
      evidencePath,
      expectedSha: sourceSha,
      expectedEnvironmentId: environmentId,
      worktreeClean: true,
      now,
      allowFixture: false,
    });
    expect(fixtureClaim.issues.map((entry) => entry.code)).toContain("FIXTURE_NOT_CLAIMABLE");
  });

  it("fails missing and tampered artifacts", async () => {
    const missing = greenFixture();
    rmSync(join(evidenceRoot, "truth-report.txt"));
    expect((await evaluate(missing)).issues.map((entry) => entry.code)).toContain("ARTIFACT_MISSING");

    const tampered = greenFixture();
    writeFileSync(join(evidenceRoot, "truth-report.txt"), "tampered");
    expect((await evaluate(tampered)).issues.map((entry) => entry.code)).toContain("ARTIFACT_HASH_MISMATCH");
  });

  it("fails incomplete capture and an unproven guardrail", async () => {
    const evidence = greenFixture();
    evidence.browserRuns[0]!.capture.networkComplete = false;
    evidence.truthGuardrails.pop();
    const codes = (await evaluate(evidence)).issues.map((entry) => entry.code);
    expect(codes).toContain("CAPTURE_INCOMPLETE");
    expect(codes).toContain("GUARDRAIL_UNPROVEN");

    const malformed = greenFixture();
    malformed.browserRuns[0]!.capture.consoleErrors = undefined as never;
    expect((await evaluate(malformed)).issues.map((entry) => entry.code)).toContain("CAPTURE_INCOMPLETE");
  });

  it("fails Development or preview evidence presented as Production evidence", async () => {
    const evidence = greenFixture();
    evidence.environment = { ...evidence.environment, kind: "development" };
    const result = await evaluate(evidence, {
      expectedEnvironmentId: Object.values(evidence.environment).join("|"),
    });
    expect(result.issues.map((entry) => entry.code)).toContain("PRODUCTION_EVIDENCE_INVALID");
    expect(result.dimensionPass.productionEvidence).toBe(false);
  });

  it("fails missing, early, or incomplete human acceptance", async () => {
    const evidence = greenFixture();
    evidence.humanAcceptance.acceptedAt = "2026-08-30T12:05:00.000Z";
    evidence.humanAcceptance.reviewedEvidenceIds = ["truth-report"];
    const result = await evaluate(evidence);
    expect(result.issues.map((entry) => entry.code)).toContain("HUMAN_ACCEPTANCE_MISSING");
    expect(result.canDisplayFiveOfFive).toBe(false);

    const future = greenFixture();
    future.humanAcceptance.acceptedAt = "2099-08-30T12:25:00.000Z";
    expect((await evaluate(future)).issues.map((entry) => entry.code)).toContain("HUMAN_ACCEPTANCE_MISSING");
  });

  it("requires artifact kinds, distinct evidence, and unique viewport screenshots", async () => {
    const evidence = greenFixture();
    evidence.dimensions.recovery.evidenceIds = ["task-report"];
    evidence.browserRuns[5]!.screenshotArtifactId = evidence.browserRuns[0]!.screenshotArtifactId;
    evidence.production.liveSmokeArtifactId = evidence.production.deploymentArtifactId;
    const codes = (await evaluate(evidence)).issues.map((entry) => entry.code);
    expect(codes).toContain("ARTIFACT_KIND_MISMATCH");
    expect(codes).toContain("EVIDENCE_REUSED");
    expect(codes).toContain("SCREENSHOT_REUSED");
    expect(codes).toContain("PRODUCTION_EVIDENCE_INVALID");
  });

  it("accepts a fully decoded JPEG bound to the measured content viewport", async () => {
    const evidence = greenFixture();
    await replaceWithJpeg(evidence);
    const result = await evaluate(evidence);
    expect(result.issues).toEqual([]);
    expect(result.fixturePassed).toBe(true);
  });

  it("rejects corrupt JPEG bytes and MIME or extension mismatches", async () => {
    const corrupt = greenFixture();
    const { entry, absolutePath } = await replaceWithJpeg(corrupt);
    const truncated = readFileSync(absolutePath).subarray(0, 96);
    writeFileSync(absolutePath, truncated);
    entry.sha256 = createHash("sha256").update(truncated).digest("hex");
    refreshHumanAttestation(corrupt);
    expect((await evaluate(corrupt)).issues.map((issue) => issue.code)).toContain("SCREENSHOT_MISSING");

    const mismatch = greenFixture();
    const replaced = await replaceWithJpeg(mismatch);
    replaced.entry.mimeType = "image/png";
    refreshHumanAttestation(mismatch);
    expect((await evaluate(mismatch)).issues.map((issue) => issue.code)).toContain("SCREENSHOT_MISSING");
  });

  it("rejects excessive content insets and screenshot pixels that do not match content viewport times DPR", async () => {
    const inset = greenFixture();
    inset.browserRuns[0]!.contentViewport.width = inset.browserRuns[0]!.viewport.width - 33;
    refreshHumanAttestation(inset);
    expect((await evaluate(inset)).issues.map((issue) => issue.code)).toContain("VIEWPORT_INVALID");

    const pixels = greenFixture();
    pixels.browserRuns[0]!.contentViewport.width -= 1;
    refreshHumanAttestation(pixels);
    expect((await evaluate(pixels)).issues.map((issue) => issue.code)).toContain("SCREENSHOT_MISSING");

    const dpr = greenFixture();
    dpr.browserRuns[0]!.devicePixelRatio = 0.1;
    refreshHumanAttestation(dpr);
    expect((await evaluate(dpr)).issues.map((issue) => issue.code)).toContain("VIEWPORT_INVALID");
  });

  it("keeps the literal feature score out of runtime source", () => {
    const sourceRoot = new URL("../src/", import.meta.url);
    const files = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name));
    for (const file of files) {
      expect(readFileSync(join(file.parentPath, file.name), "utf8")).not.toContain("5/5");
    }
  });
});
