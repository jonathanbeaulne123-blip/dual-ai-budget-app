/**
 * T3-S2 soft presence — calm “who’s in the kitchen” derived from D-100 devices
 * plus optional Realtime presence. Never carries money or personal ledger rows.
 */

import type { Environment, Household, HouseholdDevice, Member } from "./core/types.ts";

/** Device / live presence older than this is not “in the kitchen”. */
export const SOFT_PRESENCE_FRESH_MS = 15 * 60 * 1000;

/**
 * Re-stamp local device at most this often.
 * T3-S3: do not wire a focus/visibility heartbeat — touch only on session/household entry.
 */
export const SOFT_PRESENCE_TOUCH_THROTTLE_MS = 5 * 60 * 1000;

const OPT_OUT_KEY_PREFIX = "hearth.soft-presence.opt-out:";

export type SoftPresencePeer = {
  memberId: string;
  name: string;
  source: "live" | "device";
  seenAt: string;
};

export type SoftPresenceDisplay = {
  visible: boolean;
  line: string;
  peers: SoftPresencePeer[];
  optedOut: boolean;
};

export type SoftPresenceLiveRow = {
  memberId: string;
  deviceId: string;
  seenAt: string;
};

function storageGet(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota */
  }
}

function storageRemove(key: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function softPresenceOptOutKey(environment: Environment): string {
  return `${OPT_OUT_KEY_PREFIX}${environment}`;
}

export function isSoftPresenceOptedOut(
  environment: Environment,
  store?: { getItem(key: string): string | null },
): boolean {
  const get = store?.getItem?.bind(store) ?? storageGet;
  return get(softPresenceOptOutKey(environment)) === "1";
}

export function setSoftPresenceOptOut(
  environment: Environment,
  optedOut: boolean,
  store?: { setItem(key: string, value: string): void; removeItem(key: string): void },
): void {
  const key = softPresenceOptOutKey(environment);
  if (optedOut) {
    if (store) store.setItem(key, "1");
    else storageSet(key, "1");
  } else if (store) {
    store.removeItem(key);
  } else {
    storageRemove(key);
  }
}

export function memberDisplayName(members: Member[], memberId: string): string {
  const member = members.find((row) => row.id === memberId && row.active);
  return member?.name?.trim() || "Someone";
}

export function isFreshPresence(seenAt: string, nowMs: number, windowMs = SOFT_PRESENCE_FRESH_MS): boolean {
  const at = Date.parse(seenAt);
  if (!Number.isFinite(at)) return false;
  return nowMs - at <= windowMs;
}

/** Newest fresh device row per member (shared devices only). */
export function peersFromDevices(input: {
  devices: HouseholdDevice[];
  members: Member[];
  viewerMemberId: string;
  environment: Environment;
  nowMs?: number;
}): SoftPresencePeer[] {
  const nowMs = input.nowMs ?? Date.now();
  const best = new Map<string, SoftPresencePeer>();
  for (const device of input.devices) {
    if (!device.active) continue;
    if (device.environment !== input.environment) continue;
    if (!device.memberId || device.memberId === input.viewerMemberId) continue;
    if (!isFreshPresence(device.seenAt, nowMs)) continue;
    const existing = best.get(device.memberId);
    if (existing && existing.seenAt >= device.seenAt) continue;
    best.set(device.memberId, {
      memberId: device.memberId,
      name: memberDisplayName(input.members, device.memberId),
      source: "device",
      seenAt: device.seenAt,
    });
  }
  return [...best.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function peersFromLivePresence(input: {
  live: SoftPresenceLiveRow[];
  members: Member[];
  viewerMemberId: string;
  nowMs?: number;
}): SoftPresencePeer[] {
  const nowMs = input.nowMs ?? Date.now();
  const best = new Map<string, SoftPresencePeer>();
  for (const row of input.live) {
    if (!row.memberId || row.memberId === input.viewerMemberId) continue;
    if (!isFreshPresence(row.seenAt, nowMs)) continue;
    const existing = best.get(row.memberId);
    if (existing && existing.seenAt >= row.seenAt) continue;
    best.set(row.memberId, {
      memberId: row.memberId,
      name: memberDisplayName(input.members, row.memberId),
      source: "live",
      seenAt: row.seenAt,
    });
  }
  return [...best.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Live peers win over device peers for the same member. */
export function mergePresencePeers(live: SoftPresencePeer[], devices: SoftPresencePeer[]): SoftPresencePeer[] {
  const map = new Map<string, SoftPresencePeer>();
  for (const peer of devices) map.set(peer.memberId, peer);
  for (const peer of live) map.set(peer.memberId, peer);
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function softPresenceLine(peers: SoftPresencePeer[]): string | null {
  if (!peers.length) return null;
  if (peers.length === 1) return `${peers[0]!.name} is in the kitchen`;
  if (peers.length === 2) return `${peers[0]!.name} and ${peers[1]!.name} are in the kitchen`;
  const head = peers.slice(0, -1).map((peer) => peer.name).join(", ");
  const last = peers.at(-1)!.name;
  return `${head}, and ${last} are in the kitchen`;
}

export function buildSoftPresenceDisplay(input: {
  household: Household | null;
  viewerMemberId: string | null;
  environment: Environment;
  optedOut?: boolean;
  live?: SoftPresenceLiveRow[];
  nowMs?: number;
}): SoftPresenceDisplay {
  const optedOut = input.optedOut ?? isSoftPresenceOptedOut(input.environment);
  if (!input.household || !input.viewerMemberId) {
    return { visible: false, line: "", peers: [], optedOut };
  }
  const livePeers = peersFromLivePresence({
    live: input.live ?? [],
    members: input.household.members,
    viewerMemberId: input.viewerMemberId,
    nowMs: input.nowMs,
  });
  const devicePeers = peersFromDevices({
    devices: input.household.devices ?? [],
    members: input.household.members,
    viewerMemberId: input.viewerMemberId,
    environment: input.environment,
    nowMs: input.nowMs,
  });
  const peers = mergePresencePeers(livePeers, devicePeers);
  const line = softPresenceLine(peers);
  return {
    visible: Boolean(line),
    line: line ?? "",
    peers,
    optedOut,
  };
}

/** True when this kitchen may advertise presence (signed-in member + not opted out). */
export function canAdvertiseSoftPresence(input: {
  signedIn: boolean;
  memberId: string | null | undefined;
  environment: Environment;
  optedOut?: boolean;
}): boolean {
  if (!input.signedIn || !input.memberId) return false;
  const optedOut = input.optedOut ?? isSoftPresenceOptedOut(input.environment);
  return !optedOut;
}

export function deactivateLocalDevice(
  devices: HouseholdDevice[],
  deviceId: string,
  at = new Date().toISOString(),
): HouseholdDevice[] {
  return devices.map((row) => (
    row.id === deviceId
      ? { ...row, active: false, updatedAt: at, seenAt: at }
      : row
  ));
}
