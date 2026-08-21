import { getStore } from "@netlify/blobs";
import {
  assembleHousehold,
  emptyPersonal,
  ensureHouseholdShape,
  mergePersonal,
  mergeShared,
  splitForSync,
} from "../../src/core/sync.ts";
import { isValidInviteCode, normalizeInviteCode, randomHouseholdId, randomInviteCode } from "../../src/core/ids.ts";
import type { Household, PersonalEnvelope, SharedEnvelope } from "../../src/core/types.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function json(status: number, body: unknown) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", ...CORS },
    body: JSON.stringify(body),
  };
}

function sharedKey(code: string) {
  return `invite:${code}:shared`;
}

function personalKey(code: string, memberId: string) {
  return `invite:${code}:personal:${memberId}`;
}

async function readJson<T>(store: ReturnType<typeof getStore>, key: string): Promise<T | null> {
  const value = await store.get(key, { type: "json" });
  return (value as T | null) ?? null;
}

async function writeJson(store: ReturnType<typeof getStore>, key: string, value: unknown): Promise<void> {
  await store.setJSON(key, value);
}

function clientMissing(
  client: { transactions: { id: string }[]; tombstones: { id: string }[] },
  latest: { transactions: { id: string }[]; tombstones: { id: string }[] },
): boolean {
  return client.transactions.some((row) =>
    !latest.transactions.some((item) => item.id === row.id)
    && !latest.tombstones.some((tombstone) => tombstone.id === row.id),
  );
}

export const handler = async (event: { httpMethod?: string; body?: string | null }) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if (event.httpMethod === "GET") {
    return json(200, { ok: true, service: "hearth" });
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Use POST to create, join, pull, or push a household." });
  }

  let payload: {
    action?: string;
    inviteCode?: string;
    memberId?: string;
    household?: Household;
  };
  try {
    payload = JSON.parse(event.body || "{}") as typeof payload;
  } catch {
    return json(400, { error: "That request was not valid JSON." });
  }

  let store: ReturnType<typeof getStore>;
  try {
    store = getStore("hearth-households");
  } catch {
    return json(503, { error: "Shared household storage is not available on this host yet." });
  }

  const action = payload.action;
  const memberId = String(payload.memberId ?? "").trim();
  const inviteCode = normalizeInviteCode(payload.inviteCode ?? payload.household?.inviteCode);

  try {
    if (action === "create") {
      if (!payload.household) return json(400, { error: "A household snapshot is required to create a shared ledger." });
      if (!memberId) return json(400, { error: "Choose who you are before creating a shared household." });
      let code = isValidInviteCode(inviteCode) ? inviteCode : randomInviteCode();
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const existing = await readJson(store, sharedKey(code));
        if (!existing) break;
        code = randomInviteCode();
      }
      const shaped = ensureHouseholdShape({
        ...payload.household,
        householdId: payload.household.householdId || randomHouseholdId(),
        inviteCode: code,
        linked: true,
      });
      const parts = splitForSync(shaped, memberId);
      parts.shared.inviteCode = code;
      parts.shared.householdId = shaped.householdId;
      parts.shared.revision = Math.max(shaped.revision, 1);
      await writeJson(store, sharedKey(code), parts.shared);
      await writeJson(store, personalKey(code, memberId), parts.personal);
      return json(200, { household: assembleHousehold(parts.shared, parts.personal), inviteCode: code });
    }

    if (action === "join" || action === "pull") {
      if (!isValidInviteCode(inviteCode)) return json(400, { error: "That household code does not look right." });
      const shared = await readJson<SharedEnvelope>(store, sharedKey(inviteCode));
      if (!shared) return json(404, { error: "No household uses that code. Check the six characters and try again." });
      const personal = memberId
        ? await readJson<PersonalEnvelope>(store, personalKey(inviteCode, memberId))
        : null;
      return json(200, {
        household: assembleHousehold(shared, personal ?? emptyPersonal(memberId || "pending")),
        inviteCode,
      });
    }

    if (action === "push") {
      if (!payload.household) return json(400, { error: "A household snapshot is required to sync." });
      if (!memberId) return json(400, { error: "Choose who you are before syncing." });
      if (!isValidInviteCode(inviteCode)) return json(400, { error: "That household code does not look right." });
      const client = splitForSync({ ...payload.household, inviteCode, linked: true }, memberId);
      let shared = await readJson<SharedEnvelope>(store, sharedKey(inviteCode));
      if (!shared) return json(404, { error: "No household uses that code. Create or join it first." });
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const merged = mergeShared(shared, client.shared);
        await writeJson(store, sharedKey(inviteCode), merged);
        const latest = await readJson<SharedEnvelope>(store, sharedKey(inviteCode));
        if (!latest) return json(500, { error: "The shared household could not be saved." });
        if (!clientMissing(client.shared, latest)) {
          shared = latest;
          break;
        }
        shared = latest;
      }
      let personal = await readJson<PersonalEnvelope>(store, personalKey(inviteCode, memberId)) ?? emptyPersonal(memberId);
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const merged = mergePersonal(personal, client.personal);
        await writeJson(store, personalKey(inviteCode, memberId), merged);
        const latest = await readJson<PersonalEnvelope>(store, personalKey(inviteCode, memberId));
        if (!latest) {
          personal = merged;
          break;
        }
        if (!clientMissing(client.personal, latest)) {
          personal = latest;
          break;
        }
        personal = latest;
      }
      return json(200, { household: assembleHousehold(shared, personal), inviteCode });
    }

    return json(400, { error: "Unknown household action." });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : "The shared household could not be updated." });
  }
};
