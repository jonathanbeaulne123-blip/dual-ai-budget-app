import { shapeSevenShiftsEvidenceBundle } from "../src/core/evidence.ts";
import { sevenShiftsAutomationEligibility, sevenShiftsAutomationJobKey } from "../src/core/sevenShiftsAutomation.ts";
import { boundedText, corsHeaders, requestOrigin, verifiedScope } from "./sevenshifts.js";
import { deriveEvidenceBytes } from "./evidenceExtract.js";

export const EVIDENCE_STATUS_PATH = "/work/evidence/status";
const PREFIX = "/work/evidence/";
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_JSON_BYTES = 300 * 1024;
const CALENDAR_MAX_BYTES = 2 * 1024 * 1024;
const R2_STORAGE_BUDGET_BYTES = 1024 * 1024 * 1024;
const R2_OBJECT_BUDGET = 100_000;
const R2_CLASS_A_PUT_BUDGET = 10_000;
const R2_CLASS_B_GET_BUDGET = 100_000;
const CAPTURE_KINDS = new Set([
  "browser-structured", "browser-dom", "selected-json", "selected-csv", "selected-ics",
  "calendar-sync", "email", "gmail-7shifts-email", "screenshot", "pdf", "ios-share", "local-ocr", "cloud-vision",
]);
const CONTENT_TYPES = new Set([
  "application/json", "text/csv", "text/calendar", "text/plain", "text/html", "application/pdf",
  "image/jpeg", "image/png", "image/webp", "message/rfc822", "application/octet-stream",
]);

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

function enabled(env) {
  return String(env?.EVIDENCE_ENABLED || "").trim().toLowerCase() === "true";
}

function activeConfig(env, environment = "development") {
  if (!enabled(env)) throw new Error("Evidence Mesh is not enabled.");
  if (environment !== "development" && environment !== "production") throw new Error("Evidence environment is invalid.");
  const production = environment === "production";
  if (production && String(env?.EVIDENCE_ALLOW_PRODUCTION || "").trim().toLowerCase() !== "true") {
    throw new Error("Evidence Mesh Production activation is not permitted.");
  }
  const db = production ? env?.EVIDENCE_PRODUCTION_DB : env?.EVIDENCE_DB;
  const raw = production ? env?.EVIDENCE_PRODUCTION_RAW : env?.EVIDENCE_RAW;
  const queue = production ? env?.EVIDENCE_PRODUCTION_DERIVE : env?.EVIDENCE_DERIVE;
  const keyMaterial = String((production ? env?.EVIDENCE_PRODUCTION_KEK_V1 : env?.EVIDENCE_KEK_V1) || "");
  if (!db || !raw || !queue) throw new Error(`Evidence Mesh ${environment} bindings are not configured.`);
  if (keyMaterial.length < 32) throw new Error(`Evidence ${environment} encryption key is not configured.`);
  return { db, raw, queue, environment, keyMaterial };
}

function base64Url(bytes) {
  let raw = "";
  for (const value of bytes) raw += String.fromCharCode(value);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function randomId(prefix) {
  return `${prefix}${base64Url(crypto.getRandomValues(new Uint8Array(24)))}`;
}

function hex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

function ownership(scope, evidenceId, digest, cipherVersion = 1) {
  return `evidence:v1:${scope.environment}:${scope.authUserId}:${scope.householdId}:${scope.memberId}:${evidenceId}:${digest}:c${cipherVersion}`;
}

async function kek(config) {
  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(config.keyMaterial));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptRaw(config, scope, evidenceId, digest, plaintext) {
  const aad = new TextEncoder().encode(ownership(scope, evidenceId, digest));
  const dekBytes = crypto.getRandomValues(new Uint8Array(32));
  const dataKey = await crypto.subtle.importKey("raw", dekBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  const contentIv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: contentIv, additionalData: aad }, dataKey, plaintext));
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: wrapIv, additionalData: aad }, await kek(config), dekBytes));
  return {
    ciphertext,
    wrappedDek: `v1.${base64Url(wrapIv)}.${base64Url(wrapped)}`,
    nonceManifest: JSON.stringify({ version: 1, contentIv: base64Url(contentIv) }),
  };
}

async function decryptRaw(config, scope, row, ciphertext) {
  const [version, wrapIvRaw, wrappedRaw, extra] = String(row.wrapped_dek || "").split(".");
  const manifest = JSON.parse(String(row.nonce_manifest || "{}"));
  if (version !== "v1" || !wrapIvRaw || !wrappedRaw || extra || manifest.version !== 1 || !manifest.contentIv) {
    throw new Error("Evidence encryption metadata is invalid.");
  }
  const aad = new TextEncoder().encode(ownership(scope, row.evidence_id, row.plaintext_sha256, row.cipher_version));
  const dek = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(wrapIvRaw), additionalData: aad },
    await kek(config),
    fromBase64Url(wrappedRaw),
  );
  const dataKey = await crypto.subtle.importKey("raw", dek, "AES-GCM", false, ["decrypt"]);
  const plaintext = new Uint8Array(await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(manifest.contentIv), additionalData: aad },
    dataKey,
    ciphertext,
  ));
  if (plaintext.byteLength !== Number(row.byte_length) || await sha256(plaintext) !== row.plaintext_sha256) {
    throw new Error("Evidence content failed its integrity check.");
  }
  return plaintext;
}

async function readBytes(request, maximum) {
  const announced = Number(request.headers.get("Content-Length") || 0);
  if (announced > maximum) throw new Error("Evidence is larger than the allowed capture size.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximum) {
      await reader.cancel();
      throw new Error("Evidence is larger than the allowed capture size.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function readJson(request) {
  const text = await boundedText(request.body, MAX_JSON_BYTES, request.headers.get("Content-Length"));
  const value = JSON.parse(text || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Evidence Mesh request.");
  return value;
}

function queryScope(url) {
  return {
    environment: url.searchParams.get("environment"),
    householdId: url.searchParams.get("householdId"),
    memberId: url.searchParams.get("memberId"),
  };
}

async function audit(config, scope, evidenceId, action, outcome) {
  try {
    await config.db.prepare(
      "INSERT INTO evidence_access_audit (audit_id, evidence_id, environment, auth_user_id, household_id, member_id, action, outcome, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(randomId("eva_"), evidenceId || null, scope.environment, scope.authUserId, scope.householdId, scope.memberId, action, outcome, new Date().toISOString()).run();
  } catch {
    // Audit failure never widens access or leaks raw evidence. The primary action still fails closed where required.
  }
}

function usageMonth(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

async function reserveR2Storage(config, byteLength) {
  const now = new Date().toISOString();
  await config.db.prepare("INSERT OR IGNORE INTO evidence_r2_budget (singleton, stored_bytes, object_count, updated_at) VALUES (1, 0, 0, ?)").bind(now).run();
  const reserved = await config.db.prepare(
    "UPDATE evidence_r2_budget SET stored_bytes = stored_bytes + ?, object_count = object_count + 1, updated_at = ? WHERE singleton = 1 AND stored_bytes + ? <= ? AND object_count + 1 <= ?",
  ).bind(byteLength, now, byteLength, R2_STORAGE_BUDGET_BYTES, R2_OBJECT_BUDGET).run();
  if (!reserved?.meta?.changes) throw new Error("Evidence storage safety limit reached. Delete or export older evidence before capturing more.");
}

async function releaseR2Storage(config, byteLength) {
  await config.db.prepare(
    "UPDATE evidence_r2_budget SET stored_bytes = MAX(0, stored_bytes - ?), object_count = MAX(0, object_count - 1), updated_at = ? WHERE singleton = 1",
  ).bind(byteLength, new Date().toISOString()).run();
}

async function reserveR2Operation(config, operation) {
  const now = new Date().toISOString();
  const month = usageMonth();
  await config.db.prepare(
    "INSERT OR IGNORE INTO evidence_r2_monthly_usage (month_key, class_a_puts, class_b_gets, updated_at) VALUES (?, 0, 0, ?)",
  ).bind(month, now).run();
  const column = operation === "put" ? "class_a_puts" : "class_b_gets";
  const limit = operation === "put" ? R2_CLASS_A_PUT_BUDGET : R2_CLASS_B_GET_BUDGET;
  const reserved = await config.db.prepare(
    `UPDATE evidence_r2_monthly_usage SET ${column} = ${column} + 1, updated_at = ? WHERE month_key = ? AND ${column} < ?`,
  ).bind(now, month, limit).run();
  if (!reserved?.meta?.changes) throw new Error("Evidence monthly storage-operation safety limit reached. Capture stays paused until next month or an explicit budget review.");
}

async function createCapture(request, env, config, url) {
  const scope = await verifiedScope(request, env, queryScope(url));
  const captureKind = String(request.headers.get("X-Evidence-Capture-Kind") || "").trim();
  const contentType = String(request.headers.get("Content-Type") || "application/octet-stream").split(";", 1)[0].trim().toLowerCase();
  if (!CAPTURE_KINDS.has(captureKind)) throw new Error("Evidence capture kind is not supported.");
  if (!CONTENT_TYPES.has(contentType)) throw new Error("Evidence content type is not supported.");
  const bytes = await readBytes(request, MAX_BYTES);
  if (captureKind === "gmail-7shifts-email") {
    if (contentType !== "message/rfc822") throw new Error("Gmail 7shifts capture must be a raw RFC822 message.");
    const headerText = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 64 * 1024));
    const headerEnd = headerText.search(/\r?\n\r?\n/);
    const headers = (headerEnd >= 0 ? headerText.slice(0, headerEnd) : headerText).replace(/\r?\n[ \t]+/g, " ");
    const from = (headers.split(/\r?\n/).find((line) => /^from\s*:/i.test(line)) || "").replace(/^from\s*:/i, "").trim();
    const mailbox = from.match(/<\s*[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@([A-Z0-9.-]+)\s*>/i)
      || from.match(/^\s*[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@([A-Z0-9.-]+)\s*$/i);
    const domain = mailbox?.[1]?.toLowerCase().replace(/\.$/, "") || "";
    if (domain !== "7shifts.com" && !domain.endsWith(".7shifts.com")) {
      throw new Error("Gmail message sender is not a 7shifts domain.");
    }
  }
  return storeCapture(env, config, scope, captureKind, contentType, bytes);
}

async function storeCapture(env, config, scope, captureKind, contentType, bytes, state = "ready") {
  if (!bytes.byteLength) throw new Error("Evidence capture is empty.");
  const digest = await sha256(bytes);
  if (captureKind === "gmail-7shifts-email") {
    const existing = await config.db.prepare(
      "SELECT evidence_id, state, capture_kind, content_type, byte_length, revision, created_at, updated_at FROM evidence_items WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND capture_kind = 'gmail-7shifts-email' AND plaintext_sha256 = ? AND state != 'deleted' ORDER BY created_at LIMIT 1",
    ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId, digest).first();
    if (existing) {
      await audit(config, scope, existing.evidence_id, "capture-deduplicated", existing.state);
      return {
        evidenceId: existing.evidence_id,
        state: existing.state,
        captureKind: existing.capture_kind,
        contentType: existing.content_type,
        byteLength: Number(existing.byte_length),
        revision: Number(existing.revision),
        capturedAt: existing.created_at,
        updatedAt: existing.updated_at,
        duplicate: true,
      };
    }
  }
  const evidenceId = randomId("evi_");
  const objectKey = `v1/${evidenceId}`;
  const encrypted = await encryptRaw(config, scope, evidenceId, digest, bytes);
  const now = new Date().toISOString();
  await reserveR2Storage(config, bytes.byteLength);
  try {
    await reserveR2Operation(config, "put");
    await config.raw.put(objectKey, encrypted.ciphertext, { httpMetadata: { contentType: "application/octet-stream" } });
  } catch (error) {
    await releaseR2Storage(config, bytes.byteLength);
    throw error;
  }
  try {
    await config.db.prepare(
      "INSERT INTO evidence_items (evidence_id, environment, auth_user_id, household_id, member_id, capture_kind, state, content_type, byte_length, plaintext_sha256, cipher_version, kek_version, wrapped_dek, nonce_manifest, object_key, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, 1, ?, ?)",
    ).bind(evidenceId, scope.environment, scope.authUserId, scope.householdId, scope.memberId, captureKind, state, contentType, bytes.byteLength, digest, encrypted.wrappedDek, encrypted.nonceManifest, objectKey, now, now).run();
  } catch (error) {
    await config.raw.delete(objectKey);
    await releaseR2Storage(config, bytes.byteLength);
    throw error;
  }
  if (state === "ready" || state === "quarantined") await config.queue.send({ evidenceId, revision: 1 });
  await audit(config, scope, evidenceId, "capture", state);
  return { evidenceId, state, captureKind, contentType, byteLength: bytes.byteLength, revision: 1, capturedAt: now, duplicate: false };
}

async function provisionMailbox(request, env, config) {
  if (String(env?.EVIDENCE_EMAIL_ENABLED || "").toLowerCase() !== "true") throw new Error("Evidence email capture is disabled.");
  const domain = String(env?.EVIDENCE_EMAIL_DOMAIN || "").trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error("Evidence email domain is not configured.");
  const input = await readJson(request);
  const scope = await verifiedScope(request, env, input);
  const token = base64Url(crypto.getRandomValues(new Uint8Array(24)));
  const mailboxHash = await sha256(new TextEncoder().encode(token));
  const now = new Date().toISOString();
  await config.db.prepare("UPDATE evidence_mailboxes SET active = 0, revoked_at = ? WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND active = 1")
    .bind(now, scope.environment, scope.authUserId, scope.householdId, scope.memberId).run();
  await config.db.prepare("INSERT INTO evidence_mailboxes (mailbox_hash, environment, auth_user_id, household_id, member_id, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)")
    .bind(mailboxHash, scope.environment, scope.authUserId, scope.householdId, scope.memberId, now).run();
  return { address: `h-${token}@${domain}`, createdAt: now };
}

function capabilityOrigin(channel, value) {
  const clean = String(value || "").trim();
  if (channel === "extension" && /^chrome-extension:\/\/[a-p]{32}$/.test(clean)) return clean;
  if (channel === "ios" && clean === "com.hearth.capture.dev") return clean;
  throw new Error("Capture capability origin is invalid.");
}

async function mintCaptureCapability(request, env, config) {
  const input = await readJson(request);
  const scope = await verifiedScope(request, env, input);
  const channel = input.channel === "extension" || input.channel === "ios" ? input.channel : null;
  if (!channel) throw new Error("Capture capability channel is invalid.");
  const origin = capabilityOrigin(channel, input.origin);
  const byteLimit = Math.max(1, Math.min(MAX_BYTES, Math.round(Number(input.byteLimit) || MAX_BYTES)));
  const token = `${scope.environment === "production" ? "p" : "d"}_${base64Url(crypto.getRandomValues(new Uint8Array(32)))}`;
  const capabilityHash = await sha256(new TextEncoder().encode(token));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60_000).toISOString();
  await config.db.prepare("INSERT INTO evidence_capture_capabilities (capability_hash, environment, auth_user_id, household_id, member_id, channel, origin, byte_limit, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)")
    .bind(capabilityHash, scope.environment, scope.authUserId, scope.householdId, scope.memberId, channel, origin, byteLimit, expiresAt, now.toISOString()).run();
  return { capability: token, channel, origin, byteLimit, expiresAt };
}

async function capabilityUpload(request, env, config) {
  const header = String(request.headers.get("Authorization") || "");
  const match = header.match(/^Evidence ([A-Za-z0-9_-]{40,80})$/);
  if (!match) throw new Error("Capture capability is missing.");
  const capabilityHash = await sha256(new TextEncoder().encode(match[1]));
  const row = await config.db.prepare("SELECT * FROM evidence_capture_capabilities WHERE capability_hash = ? AND used_at IS NULL AND expires_at > ? LIMIT 1")
    .bind(capabilityHash, new Date().toISOString()).first();
  if (!row) throw new Error("Capture capability is expired or already used.");
  const caller = row.channel === "extension" ? String(request.headers.get("Origin") || "") : String(request.headers.get("X-Hearth-App-ID") || "");
  if (caller !== row.origin) throw new Error("Capture capability origin does not match.");
  const usedAt = new Date().toISOString();
  const used = await config.db.prepare("UPDATE evidence_capture_capabilities SET used_at = ? WHERE capability_hash = ? AND used_at IS NULL AND expires_at > ?")
    .bind(usedAt, capabilityHash, usedAt).run();
  if (!used?.meta?.changes) throw new Error("Capture capability was already used.");
  const captureKind = String(request.headers.get("X-Evidence-Capture-Kind") || "").trim();
  const contentType = String(request.headers.get("Content-Type") || "application/octet-stream").split(";", 1)[0].trim().toLowerCase();
  if (!CAPTURE_KINDS.has(captureKind) || !CONTENT_TYPES.has(contentType)) throw new Error("Capability upload type is not supported.");
  const bytes = await readBytes(request, Math.min(MAX_BYTES, Number(row.byte_limit)));
  const scope = { environment: row.environment, authUserId: row.auth_user_id, householdId: row.household_id, memberId: row.member_id };
  return storeCapture(env, config, scope, captureKind, contentType, bytes);
}

async function readStreamBytes(stream, maximum) {
  const reader = stream?.getReader?.();
  if (!reader) throw new Error("Inbound email has no raw message.");
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximum) { await reader.cancel(); throw new Error("Inbound email is too large."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function handleEvidenceEmail(message, env) {
  if (String(env?.EVIDENCE_EMAIL_ENABLED || "").toLowerCase() !== "true") {
    message.setReject?.("Hearth Evidence email capture is disabled.");
    return;
  }
  const domain = String(env?.EVIDENCE_EMAIL_DOMAIN || "").trim().toLowerCase();
  const recipient = String(message.to || "").trim().toLowerCase();
  const match = recipient.match(/^h-([A-Za-z0-9_-]{32})@(.+)$/);
  if (!match || match[2] !== domain) { message.setReject?.("Unknown Hearth Evidence mailbox."); return; }
  const mailboxHash = await sha256(new TextEncoder().encode(match[1]));
  const matches = [];
  for (const environment of ["development", "production"]) {
    try {
      const config = activeConfig(env, environment);
      const owner = await config.db.prepare("SELECT environment, auth_user_id, household_id, member_id FROM evidence_mailboxes WHERE mailbox_hash = ? AND active = 1 LIMIT 1").bind(mailboxHash).first();
      if (owner) matches.push({ config, owner });
    } catch {
      // An inactive environment cannot own a live mailbox.
    }
  }
  if (matches.length !== 1) { message.setReject?.("Unknown Hearth Evidence mailbox."); return; }
  const { config, owner } = matches[0];
  const bytes = await readStreamBytes(message.raw, MAX_BYTES);
  const scope = { environment: owner.environment, authUserId: owner.auth_user_id, householdId: owner.household_id, memberId: owner.member_id };
  await storeCapture(env, config, scope, "email", "message/rfc822", bytes, "quarantined");
}

async function routeEnvironment(request, url) {
  const queryEnvironment = String(url.searchParams.get("environment") || "");
  if (queryEnvironment) return queryEnvironment;
  if ((request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
    const input = await readJson(request.clone());
    return String(input.environment || "");
  }
  throw new Error("Evidence environment is required.");
}

async function listEvidence(request, env, config, url) {
  const scope = await verifiedScope(request, env, queryScope(url));
  const result = await config.db.prepare(
    "SELECT evidence_id, capture_kind, state, content_type, byte_length, revision, created_at, updated_at, deleted_at FROM evidence_items WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state <> 'deleted' ORDER BY updated_at DESC LIMIT 100",
  ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId).all();
  await audit(config, scope, null, "list", "allowed");
  return (result?.results || []).map((row) => ({
    evidenceId: row.evidence_id,
    captureKind: row.capture_kind,
    state: row.state,
    contentType: row.content_type,
    byteLength: row.byte_length,
    revision: row.revision,
    capturedAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function loadOwned(config, scope, evidenceId, includeDeleted = false) {
  const row = await config.db.prepare(
    `SELECT * FROM evidence_items WHERE evidence_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ?${includeDeleted ? "" : " AND state <> 'deleted'"} LIMIT 1`,
  ).bind(evidenceId, scope.environment, scope.authUserId, scope.householdId, scope.memberId).first();
  if (!row) throw new Error("Evidence item not found.");
  return row;
}

async function readRaw(request, env, config, url, evidenceId) {
  const scope = await verifiedScope(request, env, queryScope(url));
  const row = await loadOwned(config, scope, evidenceId);
  await reserveR2Operation(config, "get");
  const object = await config.raw.get(row.object_key);
  if (!object) throw new Error("Evidence object is unavailable.");
  const ciphertext = new Uint8Array(await object.arrayBuffer());
  const plaintext = await decryptRaw(config, scope, row, ciphertext);
  await audit(config, scope, evidenceId, "read-raw", "allowed");
  return new Response(plaintext, {
    status: 200,
    headers: {
      "Content-Type": row.content_type,
      "Content-Length": String(plaintext.byteLength),
      "Cache-Control": "no-store, private",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function parseStoredJson(value) {
  try { return JSON.parse(String(value)); } catch { return null; }
}

async function readDerived(request, env, config, url, evidenceId) {
  const scope = await verifiedScope(request, env, queryScope(url));
  const row = await loadOwned(config, scope, evidenceId);
  const [derivativeResult, observationResult, driftResult] = await Promise.all([
    config.db.prepare(
      "SELECT canonical_shift_key, parser_version, schema_fingerprint, sanitized_json, created_at FROM evidence_derivatives WHERE evidence_id = ? AND revision = ? ORDER BY canonical_shift_key",
    ).bind(evidenceId, row.revision).all(),
    config.db.prepare(
      "SELECT observation_id, canonical_shift_key, field_key, value_json, unit, source_location, confidence_bps, finality, extraction_method, conflict_state, created_at FROM evidence_observations WHERE evidence_id = ? AND revision = ? ORDER BY canonical_shift_key, field_key, observation_id",
    ).bind(evidenceId, row.revision).all(),
    config.db.prepare(
      "SELECT drift_id, canonical_shift_key, field_path, value_json, value_type, value_digest, created_at FROM evidence_schema_drift WHERE evidence_id = ? AND revision = ? ORDER BY canonical_shift_key, field_path, drift_id",
    ).bind(evidenceId, row.revision).all(),
  ]);
  await audit(config, scope, evidenceId, "read-derived", "allowed");
  return {
    evidenceId,
    revision: row.revision,
    state: row.state,
    parserVersion: row.parser_version || null,
    schemaFingerprint: row.schema_fingerprint || null,
    derivatives: (derivativeResult?.results || []).map((item) => ({
      canonicalShiftKey: item.canonical_shift_key,
      parserVersion: item.parser_version,
      schemaFingerprint: item.schema_fingerprint,
      facts: parseStoredJson(item.sanitized_json),
      createdAt: item.created_at,
    })),
    observations: (observationResult?.results || []).map((item) => ({
      observationId: item.observation_id,
      canonicalShiftKey: item.canonical_shift_key,
      field: item.field_key,
      value: parseStoredJson(item.value_json),
      unit: item.unit,
      sourceLocation: item.source_location,
      confidenceBps: item.confidence_bps,
      finality: item.finality,
      extractionMethod: item.extraction_method,
      conflictState: item.conflict_state,
      createdAt: item.created_at,
    })),
    schemaDrift: (driftResult?.results || []).map((item) => ({
      driftId: item.drift_id,
      canonicalShiftKey: item.canonical_shift_key || null,
      fieldPath: item.field_path,
      value: parseStoredJson(item.value_json),
      valueType: item.value_type,
      valueDigest: item.value_digest,
      createdAt: item.created_at,
    })),
  };
}

async function deleteEvidence(request, env, config, url, evidenceId) {
  const scope = await verifiedScope(request, env, queryScope(url));
  const row = await loadOwned(config, scope, evidenceId);
  const objectKey = row.object_key;
  const now = new Date().toISOString();
  await config.db.prepare(
    "UPDATE evidence_items SET state = 'deleted', wrapped_dek = NULL, nonce_manifest = NULL, object_key = NULL, deleted_at = ?, updated_at = ? WHERE evidence_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state <> 'deleted'",
  ).bind(now, now, evidenceId, scope.environment, scope.authUserId, scope.householdId, scope.memberId).run();
  if (objectKey) await config.raw.delete(objectKey);
  if (objectKey) await releaseR2Storage(config, Number(row.byte_length) || 0);
  await audit(config, scope, evidenceId, "delete", "crypto-erased");
  return { ok: true, evidenceId, deleted: true };
}

function allowedCalendarUrl(value) {
  const url = new URL(String(value || ""));
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("7shifts calendar links must use HTTPS.");
  if (host !== "7shifts.com" && !host.endsWith(".7shifts.com")) throw new Error("Only a 7shifts calendar host is allowed.");
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) || host === "localhost" || host.endsWith(".local")) throw new Error("Private calendar hosts are not allowed.");
  return url;
}

async function readCalendar(request, env) {
  const input = await readJson(request);
  await verifiedScope(request, env, input);
  let target = allowedCalendarUrl(input.url);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetch(target, { method: "GET", redirect: "manual", headers: { Accept: "text/calendar" } });
    if (response.status >= 300 && response.status < 400) {
      if (redirect === 3) throw new Error("7shifts calendar redirected too many times.");
      const location = response.headers.get("Location");
      if (!location) throw new Error("7shifts calendar returned an invalid redirect.");
      target = allowedCalendarUrl(new URL(location, target).toString());
      continue;
    }
    if (!response.ok) throw new Error("7shifts calendar could not be read.");
    const bytes = await readResponseBytes(response, CALENDAR_MAX_BYTES);
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("7shifts calendar is not valid UTF-8."); }
    if (!text.includes("BEGIN:VCALENDAR") || !text.includes("END:VCALENDAR")) throw new Error("7shifts calendar response is not an iCalendar feed.");
    return { source: text };
  }
  throw new Error("7shifts calendar could not be read.");
}

async function readResponseBytes(response, maximum) {
  const announced = Number(response.headers.get("Content-Length") || 0);
  if (announced > maximum) throw new Error("7shifts calendar is too large.");
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximum) { await reader.cancel(); throw new Error("7shifts calendar is too large."); }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

function shapePolicy(raw, scope) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Automation policy is invalid.");
  const jobId = String(raw.jobId || "").trim();
  if (!/^[A-Za-z0-9_-]{3,100}$/.test(jobId)) throw new Error("Automation policy needs an exact Hearth job.");
  const stableWindowHours = Math.max(1, Math.min(168, Math.round(Number(raw.stableWindowHours) || 24)));
  const correctionHorizonDays = Math.max(1, Math.min(366, Math.round(Number(raw.correctionHorizonDays) || 60)));
  const payrollWeekStarts = Math.max(0, Math.min(6, Math.round(Number(raw.payrollWeekStarts) || 0)));
  return {
    version: 1,
    environment: scope.environment,
    householdId: scope.householdId,
    memberId: scope.memberId,
    jobId,
    enabled: raw.enabled === true,
    stableWindowHours,
    payrollWeekStarts,
    correctionHorizonDays,
    closedPeriodAction: "variance",
    ...(raw.wagesVisibility ? { wagesVisibility: raw.wagesVisibility } : {}),
    ...(raw.cashTipsVisibility ? { cashTipsVisibility: raw.cashTipsVisibility } : {}),
    ...(raw.cardTipsVisibility ? { cardTipsVisibility: raw.cardTipsVisibility } : {}),
    ...(raw.tipOutVisibility ? { tipOutVisibility: raw.tipOutVisibility } : {}),
    updatedAt: new Date().toISOString(),
  };
}

async function putPolicy(request, env, config) {
  const input = await readJson(request);
  const scope = await verifiedScope(request, env, input);
  const policy = shapePolicy(input.policy, scope);
  await config.db.prepare(
    "INSERT INTO evidence_automation_policies (environment, auth_user_id, household_id, member_id, job_id, enabled, policy_version, policy_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT(environment, auth_user_id, household_id, member_id, job_id) DO UPDATE SET enabled = excluded.enabled, policy_version = excluded.policy_version, policy_json = excluded.policy_json, updated_at = excluded.updated_at",
  ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId, policy.jobId, policy.enabled ? 1 : 0, JSON.stringify(policy), policy.updatedAt).run();
  return policy;
}

async function listPolicies(request, env, config, url) {
  const scope = await verifiedScope(request, env, queryScope(url));
  const result = await config.db.prepare(
    "SELECT policy_json FROM evidence_automation_policies WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? ORDER BY updated_at DESC LIMIT 50",
  ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId).all();
  return (result?.results || []).map((row) => JSON.parse(row.policy_json));
}

function samePrimitive(left, right) {
  return (left === null || ["string", "number", "boolean"].includes(typeof left)) && left === right;
}

function envelopeDerivationFacts(envelope, bundle) {
  return {
    canonicalShiftKey: bundle.canonicalShiftKey,
    providerSubjectKey: bundle.providerSubjectKey,
    jobId: bundle.jobId,
    startedAt: bundle.startedAt,
    endedAt: bundle.endedAt,
    workedMinutes: bundle.workedMinutes,
    paidBreakMinutes: bundle.paidBreakMinutes,
    sourceKind: envelope.sourceKind,
    observedAt: envelope.observedAt,
    providerResourceKind: envelope.providerResourceKind,
    providerResourceId: envelope.providerResourceId,
    providerRevision: envelope.providerRevision,
    finality: envelope.finality,
    supersedesEvidenceId: envelope.supersedesEvidenceId,
  };
}

function exactObject(left, right) {
  const keys = Object.keys(left).sort();
  return keys.length === Object.keys(right || {}).length && keys.every((key) => samePrimitive(left[key], right[key]));
}

function observationFromRow(row) {
  let value;
  try { value = JSON.parse(row.value_json); } catch { throw new Error("Stored evidence observation is invalid."); }
  return {
    evidenceId: row.evidence_id,
    field: row.field_key,
    value,
    unit: row.unit,
    sourcePath: row.source_location,
    confidenceBps: Number(row.confidence_bps),
    finality: row.finality,
    extraction: row.extraction_method,
    conflict: row.conflict_state,
  };
}

function observationKey(row) {
  return JSON.stringify([
    row.evidenceId, row.field, row.value, row.unit, row.sourcePath,
    row.confidenceBps, row.finality, row.extraction, row.conflict,
  ]);
}

async function verifyBundleProvenance(config, scope, bundle) {
  const eligible = bundle.state === "eligible";
  const seenObservations = [];
  for (const envelope of bundle.evidence) {
    const item = await config.db.prepare(
      "SELECT * FROM evidence_items WHERE evidence_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state <> 'deleted' LIMIT 1",
    ).bind(envelope.evidenceId, scope.environment, scope.authUserId, scope.householdId, scope.memberId).first();
    if (!item) throw new Error("Evidence bundle references an unavailable member-owned capture.");
    if (item.plaintext_sha256 !== envelope.rawDigest || item.capture_kind !== envelope.sourceKind || item.created_at !== envelope.capturedAt) {
      throw new Error("Evidence bundle reference does not match its immutable captured object.");
    }
    if (!eligible) continue;
    if (item.state !== "ready_to_review") throw new Error("Eligible evidence must finish member-owned derivation before automation.");
    const derivative = await config.db.prepare(
      "SELECT parser_version, schema_fingerprint, sanitized_json FROM evidence_derivatives WHERE evidence_id = ? AND revision = ? AND canonical_shift_key = ? LIMIT 1",
    ).bind(envelope.evidenceId, item.revision, bundle.canonicalShiftKey).first();
    if (!derivative || derivative.parser_version !== envelope.parserVersion || derivative.schema_fingerprint !== envelope.schemaFingerprint) {
      throw new Error("Eligible evidence has no matching immutable derivative.");
    }
    let derivativeJson;
    try { derivativeJson = JSON.parse(derivative.sanitized_json); } catch { throw new Error("Stored evidence derivative is invalid."); }
    if (!exactObject(envelopeDerivationFacts(envelope, bundle), derivativeJson?.bundleFacts)) {
      throw new Error("Evidence bundle identity, shift window, mapping, or finality differs from its server derivative.");
    }
    const rows = await config.db.prepare(
      "SELECT evidence_id, field_key, value_json, unit, source_location, confidence_bps, finality, extraction_method, conflict_state FROM evidence_observations WHERE evidence_id = ? AND revision = ? AND canonical_shift_key = ? ORDER BY observation_id",
    ).bind(envelope.evidenceId, item.revision, bundle.canonicalShiftKey).all();
    seenObservations.push(...(rows?.results || []).map(observationFromRow));
  }
  if (eligible) {
    const submitted = bundle.observations.map(observationKey).sort();
    const stored = seenObservations.map(observationKey).sort();
    if (submitted.length !== stored.length || submitted.some((value, index) => value !== stored[index])) {
      throw new Error("Eligible bundle observations must exactly match the immutable server-derived shift observations.");
    }
  }
}

function bundleTorontoDate(bundle) {
  const value = bundle.observations.find((row) => row.field === "date")?.value;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Evidence bundle has no derived Toronto date.");
  return value;
}

function pastCorrectionHorizon(bundle, policy, now = new Date()) {
  // Noon UTC keeps a civil Toronto date stable across both EST and EDT.
  const date = new Date(`${bundleTorontoDate(bundle)}T12:00:00Z`);
  return now.getTime() - date.getTime() > policy.correctionHorizonDays * 86_400_000;
}

function bearerToken(request) {
  const match = String(request.headers.get("Authorization") || "").match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new Error("Continue with Google before recovering automation receipts.");
  return match[1];
}

async function hostedCommandReceipt(request, env, scope, jobKey) {
  const url = String(env?.SUPABASE_URL || "https://tykhocwacaxwquhynkok.supabase.co").replace(/\/$/, "");
  const key = String(env?.SUPABASE_PUBLISHABLE_KEY || "");
  if (!url.startsWith("https://") || !key || /service_role|secret/i.test(key)) throw new Error("Hearth Auth is not configured.");
  const query = new URLSearchParams({
    environment: `eq.${scope.environment}`,
    household_id: `eq.${scope.householdId}`,
    idempotency_key: `eq.${jobKey}`,
    select: "id,member_id,idempotency_key,confirmation_id,identity_hash,result_revision,payload_json",
    limit: "1",
  });
  const response = await fetch(`${url}/rest/v1/continuity_command_events?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${bearerToken(request)}`, Accept: "application/json" },
  });
  const bodyText = await boundedText(response.body, 128 * 1024, response.headers.get("Content-Length"));
  if (!response.ok) throw new Error("Hearth could not recover the hosted automation receipt.");
  let rows;
  try { rows = JSON.parse(bodyText); } catch { rows = null; }
  const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  const payload = row?.payload_json;
  if (!row) return null;
  if (row.member_id !== scope.memberId || row.idempotency_key !== jobKey || row.confirmation_id !== jobKey
    || payload?.confirmationId !== jobKey || payload?.identityHash !== row.identity_hash
    || !String(payload?.auditHash || "") || !Number.isSafeInteger(Number(row.result_revision))) {
    throw new Error("Hosted automation receipt does not match this member and deterministic command.");
  }
  return {
    commandEventId: String(row.id), confirmationId: jobKey, resultRevision: Number(row.result_revision),
    identityHash: String(row.identity_hash), auditHash: String(payload.auditHash), acknowledgedAt: new Date().toISOString(),
  };
}

async function persistRecoveredReceipt(config, scope, job, receipt) {
  const now = new Date().toISOString();
  await config.db.batch([
    config.db.prepare("INSERT OR IGNORE INTO evidence_automation_receipts (job_key, command_event_id, confirmation_id, result_revision, identity_hash, audit_hash, acknowledged_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(job.job_key, receipt.commandEventId, receipt.confirmationId, receipt.resultRevision, receipt.identityHash, receipt.auditHash, now),
    config.db.prepare("UPDATE evidence_bundles SET state = 'posted', updated_at = ? WHERE bundle_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ?")
      .bind(now, job.bundle_id, scope.environment, scope.authUserId, scope.householdId, scope.memberId),
    config.db.prepare("UPDATE evidence_automation_jobs SET state = 'acknowledged', lease_id = NULL, lease_expires_at = NULL, updated_at = ? WHERE job_key = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ?")
      .bind(now, job.job_key, scope.environment, scope.authUserId, scope.householdId, scope.memberId),
  ]);
}

async function recoverHostedReceiptsForShift(request, env, config, scope, canonicalShiftKey, throughRevision) {
  const result = await config.db.prepare(
    "SELECT j.job_key, j.bundle_id FROM evidence_automation_jobs j JOIN evidence_bundles b ON b.bundle_id = j.bundle_id WHERE j.environment = ? AND j.auth_user_id = ? AND j.household_id = ? AND j.member_id = ? AND b.canonical_shift_key = ? AND b.revision <= ? AND j.state <> 'acknowledged' ORDER BY b.revision LIMIT 16",
  ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId, canonicalShiftKey, throughRevision).all();
  for (const job of result?.results || []) {
    const receipt = await hostedCommandReceipt(request, env, scope, job.job_key);
    if (receipt) await persistRecoveredReceipt(config, scope, job, receipt);
  }
}

async function putBundle(request, env, config) {
  const input = await readJson(request);
  const scope = await verifiedScope(request, env, input);
  const bundle = shapeSevenShiftsEvidenceBundle(input.bundle);
  if (bundle.environment !== scope.environment || bundle.householdId !== scope.householdId || bundle.memberId !== scope.memberId) throw new Error("Evidence bundle scope does not match this member.");
  await verifyBundleProvenance(config, scope, bundle);
  const bundleId = String(input.bundleId || randomId("evb_")).trim();
  if (!/^[A-Za-z0-9_-]{20,120}$/.test(bundleId)) throw new Error("Evidence bundle id is invalid.");
  const now = new Date().toISOString();
  const state = bundle.state === "eligible" ? "eligible" : "quarantined";
  const existingBundle = await config.db.prepare(
    "SELECT bundle_id, material_hash FROM evidence_bundles WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND canonical_shift_key = ? AND revision = ? LIMIT 1",
  ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId, bundle.canonicalShiftKey, bundle.revision).first();
  if (existingBundle && existingBundle.material_hash !== bundle.materialHash) throw new Error("Evidence bundle revision already exists with different material facts.");
  const storedBundleId = existingBundle?.bundle_id || bundleId;
  if (!existingBundle) {
    await config.db.prepare(
      "INSERT INTO evidence_bundles (bundle_id, environment, auth_user_id, household_id, member_id, canonical_shift_key, revision, state, material_hash, sanitized_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(storedBundleId, scope.environment, scope.authUserId, scope.householdId, scope.memberId, bundle.canonicalShiftKey, bundle.revision, state, bundle.materialHash, JSON.stringify(bundle), now, now).run();
  }
  const policyRow = await config.db.prepare(
    "SELECT policy_json FROM evidence_automation_policies WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND job_id = ? AND enabled = 1 LIMIT 1",
  ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId, bundle.jobId).first();
  let jobKey = null;
  let eligibility = null;
  if (policyRow) {
    const policy = JSON.parse(policyRow.policy_json);
    eligibility = sevenShiftsAutomationEligibility(bundle, policy);
    if (eligibility.eligible) {
      const priorPosted = await config.db.prepare(
        "SELECT bundle_id FROM evidence_bundles WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND canonical_shift_key = ? AND revision < ? AND state = 'posted' ORDER BY revision DESC LIMIT 1",
      ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId, bundle.canonicalShiftKey, bundle.revision).first();
      const actionKind = priorPosted ? (pastCorrectionHorizon(bundle, policy) ? "variance" : "reconcile_week") : "post";
      await config.db.prepare(
        "UPDATE evidence_automation_jobs SET state = 'quarantined', last_error_code = 'superseded-before-claim', updated_at = ? WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND bundle_id IN (SELECT bundle_id FROM evidence_bundles WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND canonical_shift_key = ? AND revision < ?) AND state = 'pending'",
      ).bind(now, scope.environment, scope.authUserId, scope.householdId, scope.memberId, scope.environment, scope.authUserId, scope.householdId, scope.memberId, bundle.canonicalShiftKey, bundle.revision).run();
      await config.db.prepare(
        "UPDATE evidence_bundles SET state = 'superseded', updated_at = ? WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND canonical_shift_key = ? AND revision < ? AND state = 'eligible'",
      ).bind(now, scope.environment, scope.authUserId, scope.householdId, scope.memberId, bundle.canonicalShiftKey, bundle.revision).run();
      jobKey = sevenShiftsAutomationJobKey(bundle, actionKind);
      await config.db.prepare(
        "INSERT OR IGNORE INTO evidence_automation_jobs (job_key, environment, auth_user_id, household_id, member_id, hearth_job_id, bundle_id, bundle_revision, action_kind, state, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)",
      ).bind(jobKey, scope.environment, scope.authUserId, scope.householdId, scope.memberId, bundle.jobId, storedBundleId, bundle.revision, actionKind, now, now).run();
    }
  }
  return { bundleId: storedBundleId, state, bundle, automation: { jobKey, eligibility } };
}

async function listBundles(request, env, config, url) {
  const scope = await verifiedScope(request, env, queryScope(url));
  const result = await config.db.prepare(
    "SELECT bundle_id, state, sanitized_json, updated_at FROM evidence_bundles WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state <> 'deleted' ORDER BY updated_at DESC LIMIT 100",
  ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId).all();
  return (result?.results || []).map((row) => ({ bundleId: row.bundle_id, state: row.state, bundle: JSON.parse(row.sanitized_json), updatedAt: row.updated_at }));
}

async function claimJob(request, env, config) {
  const input = await readJson(request);
  const scope = await verifiedScope(request, env, input);
  for (let pass = 0; pass < 4; pass += 1) {
    const now = new Date();
    const row = await config.db.prepare(
      "SELECT j.*, b.canonical_shift_key, b.sanitized_json AS bundle_json, p.policy_json FROM evidence_automation_jobs j JOIN evidence_bundles b ON b.bundle_id = j.bundle_id JOIN evidence_automation_policies p ON p.environment = j.environment AND p.auth_user_id = j.auth_user_id AND p.household_id = j.household_id AND p.member_id = j.member_id AND p.job_id = j.hearth_job_id AND p.enabled = 1 WHERE j.environment = ? AND j.auth_user_id = ? AND j.household_id = ? AND j.member_id = ? AND b.state = 'eligible' AND (j.state = 'pending' OR (j.state = 'claimed' AND j.lease_expires_at < ?)) ORDER BY j.created_at LIMIT 1",
    ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId, now.toISOString()).first();
    if (!row) return null;
    const bundle = shapeSevenShiftsEvidenceBundle(JSON.parse(row.bundle_json));
    await verifyBundleProvenance(config, scope, bundle);
    await recoverHostedReceiptsForShift(request, env, config, scope, bundle.canonicalShiftKey, bundle.revision);
    const recoveredCurrent = await config.db.prepare("SELECT state FROM evidence_automation_jobs WHERE job_key = ? LIMIT 1").bind(row.job_key).first();
    if (recoveredCurrent?.state === "acknowledged") continue;
    const latest = await config.db.prepare(
      "SELECT revision FROM evidence_bundles WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND canonical_shift_key = ? AND state NOT IN ('deleted','superseded') ORDER BY revision DESC LIMIT 1",
    ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId, row.canonical_shift_key).first();
    if (latest && Number(latest.revision) > Number(row.bundle_revision)) {
      await config.db.prepare("UPDATE evidence_automation_jobs SET state = 'quarantined', last_error_code = 'superseded-before-claim', updated_at = ? WHERE job_key = ? AND state IN ('pending','claimed')")
        .bind(now.toISOString(), row.job_key).run();
      continue;
    }
    const policy = JSON.parse(row.policy_json);
    const eligibility = sevenShiftsAutomationEligibility(bundle, policy, now);
    if (!eligibility.eligible) {
      await config.db.prepare("UPDATE evidence_automation_jobs SET state = 'quarantined', last_error_code = 'no-longer-eligible', updated_at = ? WHERE job_key = ? AND state IN ('pending','claimed')")
        .bind(now.toISOString(), row.job_key).run();
      continue;
    }
    const priorPosted = await config.db.prepare(
      "SELECT bundle_id FROM evidence_bundles WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND canonical_shift_key = ? AND revision < ? AND state = 'posted' ORDER BY revision DESC LIMIT 1",
    ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId, bundle.canonicalShiftKey, bundle.revision).first();
    const desiredAction = priorPosted ? (pastCorrectionHorizon(bundle, policy, now) ? "variance" : "reconcile_week") : "post";
    if (desiredAction !== row.action_kind) {
      const desiredKey = sevenShiftsAutomationJobKey(bundle, desiredAction);
      await config.db.prepare(
        "INSERT OR IGNORE INTO evidence_automation_jobs (job_key, environment, auth_user_id, household_id, member_id, hearth_job_id, bundle_id, bundle_revision, action_kind, state, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)",
      ).bind(desiredKey, scope.environment, scope.authUserId, scope.householdId, scope.memberId, bundle.jobId, row.bundle_id, bundle.revision, desiredAction, now.toISOString(), now.toISOString()).run();
      await config.db.prepare("UPDATE evidence_automation_jobs SET state = 'quarantined', last_error_code = 'action-reclassified', updated_at = ? WHERE job_key = ? AND state IN ('pending','claimed')")
        .bind(now.toISOString(), row.job_key).run();
      continue;
    }
    const expires = new Date(now.getTime() + 5 * 60_000).toISOString();
    const leaseId = randomId("evl_");
    const claimed = await config.db.prepare(
      "UPDATE evidence_automation_jobs SET state = 'claimed', lease_id = ?, lease_expires_at = ?, attempts = attempts + 1, updated_at = ? WHERE job_key = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND (state = 'pending' OR (state = 'claimed' AND lease_expires_at < ?))",
    ).bind(leaseId, expires, now.toISOString(), row.job_key, scope.environment, scope.authUserId, scope.householdId, scope.memberId, now.toISOString()).run();
    if (!claimed?.meta?.changes) continue;
    return { jobKey: row.job_key, actionKind: row.action_kind, leaseId, leaseExpiresAt: expires, bundle, policy };
  }
  return null;
}

async function acknowledgeJob(request, env, config) {
  const input = await readJson(request);
  const scope = await verifiedScope(request, env, input);
  const jobKey = String(input.jobKey || "");
  const leaseId = String(input.leaseId || "");
  const receipt = input.receipt && typeof input.receipt === "object" ? input.receipt : null;
  if (!jobKey || !leaseId || !receipt) throw new Error("Automation acknowledgement is invalid.");
  for (const name of ["commandEventId", "confirmationId", "identityHash", "auditHash"]) {
    if (!String(receipt[name] || "").trim()) throw new Error("Automation receipt is incomplete.");
  }
  if (String(receipt.confirmationId) !== jobKey) throw new Error("Automation receipt must match the deterministic job key.");
  const now = new Date().toISOString();
  const claimed = await config.db.prepare(
    "SELECT bundle_id FROM evidence_automation_jobs WHERE job_key = ? AND lease_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state = 'claimed' LIMIT 1",
  ).bind(jobKey, leaseId, scope.environment, scope.authUserId, scope.householdId, scope.memberId).first();
  if (!claimed) throw new Error("Automation lease is stale or does not belong to this member.");
  await config.db.batch([
    config.db.prepare("INSERT OR IGNORE INTO evidence_automation_receipts (job_key, command_event_id, confirmation_id, result_revision, identity_hash, audit_hash, acknowledged_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(jobKey, String(receipt.commandEventId), jobKey, Number(receipt.resultRevision), String(receipt.identityHash), String(receipt.auditHash), now),
    config.db.prepare("UPDATE evidence_bundles SET state = 'posted', updated_at = ? WHERE bundle_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ?")
      .bind(now, claimed.bundle_id, scope.environment, scope.authUserId, scope.householdId, scope.memberId),
    config.db.prepare("UPDATE evidence_automation_jobs SET state = 'acknowledged', lease_id = NULL, lease_expires_at = NULL, updated_at = ? WHERE job_key = ? AND lease_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state = 'claimed'")
      .bind(now, jobKey, leaseId, scope.environment, scope.authUserId, scope.householdId, scope.memberId),
  ]);
  return { ok: true, jobKey, acknowledged: true };
}

async function validateClaimedJob(request, env, config) {
  const input = await readJson(request);
  const scope = await verifiedScope(request, env, input);
  const jobKey = String(input.jobKey || "");
  const leaseId = String(input.leaseId || "");
  const now = new Date();
  const job = await config.db.prepare(
    "SELECT j.*, b.canonical_shift_key, b.sanitized_json AS bundle_json, p.policy_json FROM evidence_automation_jobs j JOIN evidence_bundles b ON b.bundle_id = j.bundle_id JOIN evidence_automation_policies p ON p.environment = j.environment AND p.auth_user_id = j.auth_user_id AND p.household_id = j.household_id AND p.member_id = j.member_id AND p.job_id = j.hearth_job_id AND p.enabled = 1 WHERE j.job_key = ? AND j.lease_id = ? AND j.environment = ? AND j.auth_user_id = ? AND j.household_id = ? AND j.member_id = ? AND j.state = 'claimed' AND j.lease_expires_at > ? AND b.state = 'eligible' LIMIT 1",
  ).bind(jobKey, leaseId, scope.environment, scope.authUserId, scope.householdId, scope.memberId, now.toISOString()).first();
  if (!job) throw new Error("Automation policy, membership, evidence, or lease changed before posting.");
  const bundle = shapeSevenShiftsEvidenceBundle(JSON.parse(job.bundle_json));
  await verifyBundleProvenance(config, scope, bundle);
  const latest = await config.db.prepare(
    "SELECT revision FROM evidence_bundles WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND canonical_shift_key = ? AND state NOT IN ('deleted','superseded') ORDER BY revision DESC LIMIT 1",
  ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId, bundle.canonicalShiftKey).first();
  if (!latest || Number(latest.revision) !== bundle.revision) throw new Error("A newer evidence revision arrived before posting.");
  const policy = JSON.parse(job.policy_json);
  if (!sevenShiftsAutomationEligibility(bundle, policy, now).eligible) throw new Error("Evidence is no longer eligible for automation.");
  const priorPosted = await config.db.prepare(
    "SELECT bundle_id FROM evidence_bundles WHERE environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND canonical_shift_key = ? AND revision < ? AND state = 'posted' ORDER BY revision DESC LIMIT 1",
  ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId, bundle.canonicalShiftKey, bundle.revision).first();
  const actionKind = priorPosted ? (pastCorrectionHorizon(bundle, policy, now) ? "variance" : "reconcile_week") : "post";
  if (actionKind !== job.action_kind) throw new Error("Automation action changed before posting; reclaim the latest job.");
  return { valid: true, jobKey, actionKind, materialHash: bundle.materialHash, checkedAt: now.toISOString() };
}

async function failJob(request, env, config) {
  const input = await readJson(request);
  const scope = await verifiedScope(request, env, input);
  const state = input.quarantine === true ? "quarantined" : "pending";
  const updated = await config.db.prepare(
    "UPDATE evidence_automation_jobs SET state = ?, lease_id = NULL, lease_expires_at = NULL, last_error_code = ?, updated_at = ? WHERE job_key = ? AND lease_id = ? AND environment = ? AND auth_user_id = ? AND household_id = ? AND member_id = ? AND state = 'claimed'",
  ).bind(state, String(input.errorCode || "runner-failed").slice(0, 80), new Date().toISOString(), String(input.jobKey || ""), String(input.leaseId || ""), scope.environment, scope.authUserId, scope.householdId, scope.memberId).run();
  if (!updated?.meta?.changes) throw new Error("Automation lease is stale or does not belong to this member.");
  return { ok: true, state };
}

function evidencePath(pathname) {
  const match = pathname.match(/^\/work\/evidence\/captures\/(evi_[A-Za-z0-9_-]{20,80})(?:\/(raw|derived))?$/);
  return match ? { evidenceId: match[1], action: match[2] || "meta" } : null;
}

function capabilityCors(origin) {
  return /^chrome-extension:\/\/[a-p]{32}$/.test(origin || "") ? {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Evidence-Capture-Kind, X-Evidence-Nonce",
    "Cache-Control": "no-store",
    Vary: "Origin",
  } : { "Cache-Control": "no-store" };
}

export async function handleEvidence(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(PREFIX) && url.pathname !== EVIDENCE_STATUS_PATH) return null;
  if (url.pathname === "/work/evidence/capability-upload") {
    const origin = String(request.headers.get("Origin") || "");
    const cors = capabilityCors(origin);
    if (request.method === "OPTIONS") return /^chrome-extension:\/\/[a-p]{32}$/.test(origin)
      ? new Response(null, { status: 204, headers: cors })
      : json({ ok: false, error: "origin" }, 403, cors);
    if (request.method !== "POST") return json({ ok: false, error: "method" }, 405, cors);
    try {
      const token = String(request.headers.get("Authorization") || "").match(/^Evidence\s+([A-Za-z0-9_-]{40,80})$/)?.[1] || "";
      const environment = token.startsWith("p_") ? "production" : token.startsWith("d_") ? "development" : "";
      const config = activeConfig(env, environment);
      return json({ ok: true, capture: await capabilityUpload(request, env, config) }, 201, cors);
    } catch (error) {
      return json({ ok: false, error: String(error?.message || error) }, 400, cors);
    }
  }
  const active = url.pathname !== EVIDENCE_STATUS_PATH;
  const { allowed, origin } = requestOrigin(request, url, active);
  const cors = corsHeaders(origin, active);
  if (!allowed) return json({ ok: false, error: "origin" }, 403, cors);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (url.pathname === EVIDENCE_STATUS_PATH && request.method === "GET") {
    const states = {};
    for (const environment of ["development", "production"]) {
      try {
        const config = activeConfig(env, environment);
        await config.db.prepare("SELECT 1 AS ok FROM evidence_items LIMIT 1").first();
        states[environment] = { available: true };
      } catch (error) {
        states[environment] = { available: false, detail: String(error.message || error) };
      }
    }
    const productionAllowed = String(env?.EVIDENCE_ALLOW_PRODUCTION || "").trim().toLowerCase() === "true";
    return json({
      ok: true,
      available: states.development.available || states.production.available,
      environment: productionAllowed ? "development-and-production" : "development-only",
      rawStorage: "encrypted-private-r2",
      automation: "opt-in",
      productionAllowed,
      environments: states,
      ...(!states.development.available && !states.production.available ? { detail: states.development.detail } : {}),
    }, 200, cors);
  }
  let config;
  try { config = activeConfig(env, await routeEnvironment(request, url)); } catch (error) { return json({ ok: false, error: String(error.message || error) }, 503, cors); }
  try {
    if (url.pathname === "/work/evidence/captures" && request.method === "POST") return json({ ok: true, capture: await createCapture(request, env, config, url) }, 201, cors);
    if (url.pathname === "/work/evidence/captures" && request.method === "GET") return json({ ok: true, captures: await listEvidence(request, env, config, url) }, 200, cors);
    if (url.pathname === "/work/evidence/calendar/read" && request.method === "POST") return json({ ok: true, ...(await readCalendar(request, env)) }, 200, cors);
    if (url.pathname === "/work/evidence/capabilities" && request.method === "POST") return json({ ok: true, ...(await mintCaptureCapability(request, env, config)) }, 201, cors);
    if (url.pathname === "/work/evidence/email/alias" && request.method === "POST") return json({ ok: true, ...(await provisionMailbox(request, env, config)) }, 201, cors);
    if (url.pathname === "/work/evidence/automation/policies" && request.method === "PUT") return json({ ok: true, policy: await putPolicy(request, env, config) }, 200, cors);
    if (url.pathname === "/work/evidence/automation/policies" && request.method === "GET") return json({ ok: true, policies: await listPolicies(request, env, config, url) }, 200, cors);
    if (url.pathname === "/work/evidence/bundles" && request.method === "POST") return json({ ok: true, ...(await putBundle(request, env, config)) }, 201, cors);
    if (url.pathname === "/work/evidence/bundles" && request.method === "GET") return json({ ok: true, bundles: await listBundles(request, env, config, url) }, 200, cors);
    if (url.pathname === "/work/evidence/automation/jobs/claim" && request.method === "POST") return json({ ok: true, job: await claimJob(request, env, config) }, 200, cors);
    if (url.pathname === "/work/evidence/automation/jobs/validate" && request.method === "POST") return json({ ok: true, ...(await validateClaimedJob(request, env, config)) }, 200, cors);
    if (url.pathname === "/work/evidence/automation/jobs/ack" && request.method === "POST") return json(await acknowledgeJob(request, env, config), 200, cors);
    if (url.pathname === "/work/evidence/automation/jobs/fail" && request.method === "POST") return json(await failJob(request, env, config), 200, cors);
    const path = evidencePath(url.pathname);
    if (path?.action === "raw" && request.method === "GET") return await readRaw(request, env, config, url, path.evidenceId);
    if (path?.action === "derived" && request.method === "GET") return json({ ok: true, derived: await readDerived(request, env, config, url, path.evidenceId) }, 200, cors);
    if (path?.action === "meta" && request.method === "DELETE") return json(await deleteEvidence(request, env, config, url, path.evidenceId), 200, cors);
    return json({ ok: false, error: "Evidence Mesh route not found." }, 404, cors);
  } catch (error) {
    const message = String(error?.message || error || "Evidence Mesh request failed.");
    const status = /Continue with Google|session|linked to/.test(message) ? 401
      : /not found|unavailable/.test(message) ? 404
      : /Development|Production|bindings|encryption key/.test(message) ? 503
      : 400;
    return json({ ok: false, error: message }, status, cors);
  }
}

async function protectedProviderKey(prefix, value) {
  if (value === null || value === undefined || value === "") return null;
  return `${prefix}_${await sha256(new TextEncoder().encode(String(value)))}`;
}

async function mappingForDerivedRecord(config, scope, record, providerSubjectKey, at) {
  if (!record.rawSubject) return null;
  const result = await config.db.prepare(
    "SELECT m.hearth_job_id, m.hearth_role_id, m.provider_location_key, m.provider_role_key FROM evidence_provider_identities i JOIN evidence_job_mappings m ON m.identity_id = i.identity_id WHERE i.environment = ? AND i.auth_user_id = ? AND i.household_id = ? AND i.member_id = ? AND i.provider = '7shifts' AND i.provider_subject_key = ? AND i.state = 'active' AND m.effective_from <= ? AND (m.effective_to IS NULL OR m.effective_to >= ?) ORDER BY m.mapping_version DESC LIMIT 32",
  ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId, providerSubjectKey, at, at).all();
  const locationKey = await protectedProviderKey("s7location", record.rawLocation);
  const roleKey = await protectedProviderKey("s7role", record.rawRole);
  const matches = (result?.results || []).filter((row) => (!row.provider_location_key || row.provider_location_key === locationKey)
    && (!row.provider_role_key || row.provider_role_key === roleKey));
  return matches.length === 1 ? matches[0] : null;
}

function driftValue(value) {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
  return String(value).slice(0, 500);
}

async function runStatementBatches(db, statements, size = 64) {
  for (let index = 0; index < statements.length; index += size) await db.batch(statements.slice(index, index + size));
}

async function persistDerivation(config, row, derived) {
  const scope = {
    environment: row.environment,
    authUserId: row.auth_user_id,
    householdId: row.household_id,
    memberId: row.member_id,
  };
  const now = new Date().toISOString();
  const statements = [
    config.db.prepare("DELETE FROM evidence_observations WHERE evidence_id = ? AND revision = ?").bind(row.evidence_id, row.revision),
    config.db.prepare("DELETE FROM evidence_derivatives WHERE evidence_id = ? AND revision = ?").bind(row.evidence_id, row.revision),
    config.db.prepare("DELETE FROM evidence_schema_drift WHERE evidence_id = ? AND revision = ?").bind(row.evidence_id, row.revision),
  ];
  const canonicalKeys = [];
  for (const record of derived.records) {
    const canonicalShiftKey = `s7shift_${await sha256(new TextEncoder().encode(record.canonicalSeed))}`;
    const providerSubjectKey = record.rawSubject
      ? await protectedProviderKey("s7subject", record.rawSubject)
      : `s7subject_unbound_${await sha256(new TextEncoder().encode(`${scope.authUserId}:${canonicalShiftKey}`))}`;
    const mapping = await mappingForDerivedRecord(config, scope, record, providerSubjectKey, (record.startedAt || row.created_at).slice(0, 10));
    const providerResourceId = await protectedProviderKey("s7resource", record.rawResource);
    const providerRevision = await protectedProviderKey("s7revision", record.rawRevision);
    const schemaFingerprint = await sha256(new TextEncoder().encode(JSON.stringify(record.schemaShape || {})));
    const observations = [...record.observations];
    if (mapping?.hearth_role_id) observations.push({
      field: "roleId", value: mapping.hearth_role_id, unit: "identifier", sourcePath: "mapping.hearthRoleId",
      confidenceBps: 10_000, finality: record.finality, extraction: "human", conflict: "clear",
    });
    const bundleFacts = {
      canonicalShiftKey,
      providerSubjectKey,
      jobId: mapping?.hearth_job_id || null,
      startedAt: record.startedAt,
      endedAt: record.endedAt,
      workedMinutes: record.workedMinutes,
      paidBreakMinutes: record.paidBreakMinutes,
      sourceKind: row.capture_kind === "gmail-7shifts-email" ? "email" : row.capture_kind,
      observedAt: record.observedAt || row.created_at,
      providerResourceKind: record.kind,
      providerResourceId,
      providerRevision,
      finality: record.finality,
      supersedesEvidenceId: null,
    };
    const sanitized = {
      version: 1,
      bundleFacts,
      mappingState: mapping ? "mapped" : "unmapped",
      observationCount: observations.length,
      unknownFieldCount: record.drift.length,
      warnings: derived.warnings,
    };
    statements.push(config.db.prepare(
      "INSERT INTO evidence_derivatives (evidence_id, revision, canonical_shift_key, parser_version, schema_fingerprint, sanitized_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(row.evidence_id, row.revision, canonicalShiftKey, derived.parserVersion, schemaFingerprint, JSON.stringify(sanitized), now));
    for (const item of observations) statements.push(config.db.prepare(
      "INSERT INTO evidence_observations (observation_id, evidence_id, revision, canonical_shift_key, field_key, value_json, unit, source_location, confidence_bps, finality, extraction_method, conflict_state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(randomId("evo_"), row.evidence_id, row.revision, canonicalShiftKey, item.field, JSON.stringify(item.value), item.unit,
      item.sourcePath, item.confidenceBps, item.finality, item.extraction, item.conflict, now));
    for (const item of record.drift.slice(0, 128)) statements.push(config.db.prepare(
      "INSERT INTO evidence_schema_drift (drift_id, evidence_id, revision, canonical_shift_key, field_path, value_json, value_type, value_digest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(randomId("evd_"), row.evidence_id, row.revision, canonicalShiftKey, item.path, JSON.stringify(driftValue(item.value)), item.valueType,
      await sha256(new TextEncoder().encode(JSON.stringify(item.value))), now));
    canonicalKeys.push(canonicalShiftKey);
  }
  for (const item of derived.drift.slice(0, 128)) statements.push(config.db.prepare(
    "INSERT INTO evidence_schema_drift (drift_id, evidence_id, revision, canonical_shift_key, field_path, value_json, value_type, value_digest, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)",
  ).bind(randomId("evd_"), row.evidence_id, row.revision, item.path, JSON.stringify(driftValue(item.value)), item.valueType,
    await sha256(new TextEncoder().encode(JSON.stringify(item.value))), now));
  // D1 does not offer an application transaction across R2 and an arbitrary
  // statement count. The item remains `deriving`; a retry deletes this
  // revision's partial metadata and deterministically rebuilds it.
  await runStatementBatches(config.db, statements);
  for (const canonicalShiftKey of canonicalKeys) await reconcileIndependentScreenObservations(config, scope, canonicalShiftKey);
}

async function reconcileIndependentScreenObservations(config, scope, canonicalShiftKey) {
  const result = await config.db.prepare(
    "SELECT o.observation_id, o.field_key, o.value_json, o.extraction_method FROM evidence_observations o JOIN evidence_items i ON i.evidence_id = o.evidence_id WHERE i.environment = ? AND i.auth_user_id = ? AND i.household_id = ? AND i.member_id = ? AND o.canonical_shift_key = ? AND o.extraction_method IN ('local-ocr','cloud-vision') ORDER BY o.field_key, o.observation_id",
  ).bind(scope.environment, scope.authUserId, scope.householdId, scope.memberId, canonicalShiftKey).all();
  const byField = new Map();
  for (const row of result?.results || []) {
    const group = byField.get(row.field_key) || [];
    group.push(row); byField.set(row.field_key, group);
  }
  for (const [field, rows] of byField) {
    const local = rows.filter((item) => item.extraction_method === "local-ocr");
    const cloud = rows.filter((item) => item.extraction_method === "cloud-vision");
    if (!local.length || !cloud.length) continue;
    const values = new Set([...local, ...cloud].map((item) => item.value_json));
    const state = values.size === 1 ? "corroborated" : "conflicted";
    await runStatementBatches(config.db, [...local, ...cloud].map((item) => config.db.prepare(
      "UPDATE evidence_observations SET conflict_state = ? WHERE observation_id = ?",
    ).bind(state, item.observation_id)));
    if (state === "conflicted") {
      const conflictId = `evc_${await sha256(new TextEncoder().encode(`${scope.environment}:${scope.authUserId}:${canonicalShiftKey}:${field}`))}`;
      const now = new Date().toISOString();
      await config.db.prepare(
        "INSERT OR REPLACE INTO evidence_conflicts (conflict_id, environment, auth_user_id, household_id, member_id, canonical_shift_key, field_key, state, observation_ids_json, resolution_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, NULL, ?, ?)",
      ).bind(conflictId, scope.environment, scope.authUserId, scope.householdId, scope.memberId, canonicalShiftKey, field,
        JSON.stringify([...local, ...cloud].map((item) => item.observation_id)), now, now).run();
    }
  }
}

export async function processEvidenceQueue(batch, env) {
  const productionQueue = String(env?.EVIDENCE_PRODUCTION_QUEUE_NAME || "hearth-evidence-derive-production");
  const config = activeConfig(env, String(batch?.queue || "") === productionQueue ? "production" : "development");
  for (const message of batch.messages || []) {
    const evidenceId = String(message.body?.evidenceId || "");
    const revision = Number(message.body?.revision);
    if (!/^evi_[A-Za-z0-9_-]{20,80}$/.test(evidenceId) || !Number.isSafeInteger(revision) || revision < 1) {
      message.ack();
      continue;
    }
    try {
      const row = await config.db.prepare("SELECT * FROM evidence_items WHERE evidence_id = ? LIMIT 1").bind(evidenceId).first();
      if (!row || row.revision !== revision || ["ready_to_review", "deleted"].includes(row.state)) { message.ack(); continue; }
      if (!["ready", "quarantined", "deriving"].includes(row.state)) { message.retry(); continue; }
      if (row.state !== "deriving") await config.db.prepare("UPDATE evidence_items SET state = 'deriving', updated_at = ? WHERE evidence_id = ? AND revision = ? AND state IN ('ready','quarantined')").bind(new Date().toISOString(), evidenceId, revision).run();
      if (row.object_key) await reserveR2Operation(config, "get");
      const object = row.object_key ? await config.raw.get(row.object_key) : null;
      if (!object) throw new Error("Evidence object is unavailable during derivation.");
      const plaintext = await decryptRaw(config, {
        environment: row.environment, authUserId: row.auth_user_id, householdId: row.household_id, memberId: row.member_id,
      }, row, new Uint8Array(await object.arrayBuffer()));
      const derived = deriveEvidenceBytes({ bytes: plaintext, contentType: row.content_type, captureKind: row.capture_kind });
      await persistDerivation(config, row, derived);
      await config.db.prepare("UPDATE evidence_items SET state = 'ready_to_review', updated_at = ? WHERE evidence_id = ? AND revision = ? AND state = 'deriving'").bind(new Date().toISOString(), evidenceId, revision).run();
      message.ack();
    } catch (error) {
      const deterministic = /invalid|too many|unterminated|too large|UTF-8|empty after decoding|did not match/i.test(String(error?.message || error));
      if (deterministic) {
        await config.db.prepare("UPDATE evidence_items SET state = 'failed', updated_at = ? WHERE evidence_id = ? AND revision = ? AND state = 'deriving'")
          .bind(new Date().toISOString(), evidenceId, revision).run();
        message.ack();
      } else message.retry();
    }
  }
}
