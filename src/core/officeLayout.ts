import type { CompanionMood } from "./companion.ts";
import type { KettlePhase } from "./hercules.ts";
import type { Environment } from "./types.ts";
import type { HerculesPose } from "./herculesTalk.ts";

export const CAT = 96;
export const NAV = 76;
export const WIDE_BREAKPOINT = 720;

export const INSTRUMENT_IDS = [
  "calculator",
  "blotter",
  "wallet",
  "mail",
  "timesheet",
  "chalkboard",
  "postcard",
  "cookoff",
  "jars",
  "lamp",
] as const;

export type InstrumentId = (typeof INSTRUMENT_IDS)[number];

export type FurnitureKind = "sill" | "tray" | "board" | "envelope" | "clock" | "lamp" | "card" | "pad" | "jar" | "kettle";

export type Furniture = {
  id: string;
  rect: { x: number; y: number; w: number; h: number };
  perchable: boolean;
  warn: boolean;
  kind: FurnitureKind;
};

export type Point = { x: number; y: number };

export type OfficeBreakpoint = "phone" | "wide";

export type LayoutItem = {
  id: InstrumentId;
  hidden?: boolean;
  x?: number;
  y?: number;
};

export type OfficeLayout = {
  v: 1;
  items: LayoutItem[];
  expanded: InstrumentId | "window" | null;
  minimized: InstrumentId[];
  windowMinimized: boolean;
};

export const DEFAULT_ORDER: InstrumentId[] = [...INSTRUMENT_IDS];

export function officeLayoutKey(environment: Environment, breakpoint: OfficeBreakpoint): string {
  return `hearth.office.${environment}.${breakpoint}`;
}

export function officeRingsKey(environment: Environment): string {
  return `hearth.office.rings.${environment}`;
}

export function defaultLayout(): OfficeLayout {
  return {
    v: 1,
    items: DEFAULT_ORDER.map((id) => ({ id })),
    expanded: null,
    minimized: [],
    windowMinimized: false,
  };
}

export function isInstrumentId(value: unknown): value is InstrumentId {
  return typeof value === "string" && (INSTRUMENT_IDS as readonly string[]).includes(value);
}

export function parseOfficeLayout(raw: unknown): OfficeLayout {
  const fallback = defaultLayout();
  if (!raw || typeof raw !== "object") return fallback;
  const record = raw as Record<string, unknown>;
  if (record.v !== 1) return fallback;
  const seen = new Set<InstrumentId>();
  const items: LayoutItem[] = [];
  if (Array.isArray(record.items)) {
    for (const row of record.items) {
      if (!row || typeof row !== "object") continue;
      const id = (row as LayoutItem).id;
      if (!isInstrumentId(id) || seen.has(id)) continue;
      seen.add(id);
      const hidden = Boolean((row as LayoutItem).hidden) && id !== "calculator";
      const x = Number((row as LayoutItem).x);
      const y = Number((row as LayoutItem).y);
      items.push({
        id,
        hidden,
        x: Number.isFinite(x) ? x : undefined,
        y: Number.isFinite(y) ? y : undefined,
      });
    }
  }
  for (const id of DEFAULT_ORDER) {
    if (!seen.has(id)) items.push({ id });
  }
  const expanded = record.expanded === "window" || isInstrumentId(record.expanded) ? record.expanded : null;
  const minimized = Array.isArray(record.minimized)
    ? record.minimized.filter(isInstrumentId)
    : [];
  return {
    v: 1,
    items,
    expanded,
    minimized,
    windowMinimized: Boolean(record.windowMinimized),
  };
}

export function loadOfficeLayout(
  environment: Environment,
  breakpoint: OfficeBreakpoint,
  storage?: { getItem(key: string): string | null },
): OfficeLayout {
  if (!storage) return defaultLayout();
  try {
    const raw = storage.getItem(officeLayoutKey(environment, breakpoint));
    if (!raw) return defaultLayout();
    return parseOfficeLayout(JSON.parse(raw));
  } catch {
    return defaultLayout();
  }
}

export function saveOfficeLayout(
  environment: Environment,
  breakpoint: OfficeBreakpoint,
  layout: OfficeLayout,
  storage?: { setItem(key: string, value: string): void },
): void {
  if (!storage) return;
  try {
    storage.setItem(officeLayoutKey(environment, breakpoint), JSON.stringify(layout));
  } catch {
    /* private mode */
  }
}

export function instrumentRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const signed = ((hash % 9) - 4) / 10;
  return Math.max(-0.4, Math.min(0.4, signed));
}

export function visibleInstruments(layout: OfficeLayout): InstrumentId[] {
  return layout.items.filter((item) => !item.hidden).map((item) => item.id);
}

export function promoteRail(order: InstrumentId[], promoted: InstrumentId, lampLit: boolean): InstrumentId[] {
  const next = [...order];
  const lift = (id: InstrumentId, index: number) => {
    const at = next.indexOf(id);
    if (at < 0 || at === index) return;
    next.splice(at, 1);
    next.splice(Math.min(index, next.length), 0, id);
  };
  lift(promoted, 0);
  if (lampLit) lift("lamp", 1);
  return next;
}

export function kindWeight(kind: FurnitureKind): number {
  if (kind === "sill") return 3;
  if (kind === "tray" || kind === "board") return 2;
  return 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function jitter(seed: number): number {
  return ((seed % 9) - 4);
}

function rectsOverlap(a: Furniture["rect"], b: Furniture["rect"]): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function catRectAt(point: Point): Furniture["rect"] {
  return { x: point.x, y: point.y, w: CAT, h: CAT };
}

export function perchTarget(
  furniture: Furniture[],
  mood: CompanionMood,
  phase: KettlePhase,
  adding: boolean,
  viewport: { w: number; h: number },
  postRect?: Furniture["rect"] | null,
  random = Math.random,
): { x: number; y: number; on: string | null; pose: HerculesPose } {
  const pad = 6;
  const maxX = Math.max(pad, viewport.w - CAT - pad);
  const maxY = Math.max(pad, viewport.h - CAT - NAV - pad);
  if (adding) {
    return { x: pad, y: pad, on: null, pose: "loaf" };
  }
  if (mood === "hiding") {
    return { x: random() > 0.5 ? pad : maxX, y: maxY, on: null, pose: "hide" };
  }
  const perchable = furniture.filter((item) => item.perchable && item.rect.w > 0 && item.rect.h > 0);
  const weights = perchable.map((item) => {
    let weight = kindWeight(item.kind);
    if (phase === "morning" && item.id === "calculator") weight *= 2;
    if (phase === "after-shift" && item.id === "timesheet") weight *= 2;
    if (phase === "sunday" && item.id === "postcard") weight *= 2;
    if (phase === "evening" && item.id === "blotter") weight *= 2;
    return weight;
  });
  const pick = (list: Furniture[], wts: number[]): Furniture | null => {
    if (!list.length) return null;
    const total = wts.reduce((sum, n) => sum + n, 0);
    let ticket = random() * total;
    for (let i = 0; i < list.length; i += 1) {
      ticket -= wts[i] ?? 1;
      if (ticket <= 0) return list[i]!;
    }
    return list[list.length - 1] ?? null;
  };

  const pose: HerculesPose = phase === "evening"
    ? "sleep"
    : phase === "morning"
      ? "stretch"
      : mood === "glowing" || mood === "content"
        ? "perch"
        : "loaf";

  const tryLand = (item: Furniture | null): { x: number; y: number; on: string | null } => {
    if (!item) {
      return { x: pad, y: Math.min(52, maxY), on: null };
    }
    const seed = item.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const x = clamp(item.rect.x + item.rect.w / 2 - CAT / 2 + jitter(seed), pad, maxX);
    const y = clamp(item.rect.y - CAT + 12 + jitter(seed + 3), pad, maxY);
    return { x, y, on: item.id };
  };

  let chosen = pick(perchable, weights);
  let land = tryLand(chosen);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!postRect || !rectsOverlap(catRectAt(land), postRect)) {
      return { ...land, pose };
    }
    chosen = pick(perchable, weights);
    land = tryLand(chosen);
  }
  return { x: pad, y: pad, on: null, pose: "loaf" };
}

export function attackTarget(furniture: Furniture[]): Furniture | null {
  const rank = (id: string) => {
    if (id === "mail") return 0;
    if (id === "timesheet") return 1;
    if (id === "wallet") return 2;
    if (id === "lamp") return 3;
    return 9;
  };
  const warns = furniture.filter((item) => item.warn).sort((left, right) => rank(left.id) - rank(right.id));
  return warns[0] ?? null;
}

export function walkPath(from: Point, to: Point, furniture: Furniture[]): Point[] {
  const blocked = furniture.filter((item) => item.kind !== "sill");
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const hits = blocked.some((item) => (
    mid.x > item.rect.x && mid.x < item.rect.x + item.rect.w
    && mid.y > item.rect.y && mid.y < item.rect.y + item.rect.h
  ));
  if (!hits) return [from, to];
  const detour = { x: mid.x + 24, y: Math.max(8, mid.y - 28) };
  return [from, detour, to].slice(0, 3);
}

type FurnitureListener = () => void;
let furniture: Furniture[] = [];
const listeners = new Set<FurnitureListener>();

export function listFurniture(): Furniture[] {
  return furniture;
}

export function publishFurniture(item: Furniture): void {
  furniture = [...furniture.filter((row) => row.id !== item.id), item];
  for (const listener of listeners) listener();
}

export function unpublishFurniture(id: string): void {
  furniture = furniture.filter((row) => row.id !== id);
  for (const listener of listeners) listener();
}

export function subscribeFurniture(listener: FurnitureListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function resetFurnitureForTests(): void {
  furniture = [];
  listeners.clear();
}

export const INSTRUMENT_KIND: Record<InstrumentId, FurnitureKind> = {
  calculator: "pad",
  blotter: "card",
  wallet: "tray",
  mail: "envelope",
  timesheet: "clock",
  chalkboard: "board",
  postcard: "card",
  cookoff: "kettle",
  jars: "jar",
  lamp: "lamp",
};

export function snapGrid(value: number, grid = 8): number {
  return Math.round(value / grid) * grid;
}

export function defaultWidePosition(index: number): Point {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return { x: 8 + col * 188, y: 8 + row * 92 };
}

const PAIR_WITH = new Set(["mail|lamp", "lamp|mail", "cookoff|jars", "jars|cookoff"]);

export function railRows(order: InstrumentId[]): Array<InstrumentId | [InstrumentId, InstrumentId]> {
  const rows: Array<InstrumentId | [InstrumentId, InstrumentId]> = [];
  for (let i = 0; i < order.length; i += 1) {
    const current = order[i]!;
    const next = order[i + 1];
    if (current !== "calculator" && next && PAIR_WITH.has(`${current}|${next}`)) {
      rows.push([current, next]);
      i += 1;
    } else {
      rows.push(current);
    }
  }
  return rows;
}

export type DeskRing = { id: InstrumentId; x: number; y: number; at: number };
export const RING_TTL_MS = 24 * 60 * 60 * 1000;

export function parseOfficeRings(raw: unknown, now = Date.now()): DeskRing[] {
  if (!Array.isArray(raw)) return [];
  const rings: DeskRing[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const id = (row as DeskRing).id;
    const x = Number((row as DeskRing).x);
    const y = Number((row as DeskRing).y);
    const at = Number((row as DeskRing).at);
    if (!isInstrumentId(id) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(at)) continue;
    if (now - at > RING_TTL_MS) continue;
    rings.push({ id, x, y, at });
  }
  return rings;
}

export function loadOfficeRings(
  environment: Environment,
  storage?: { getItem(key: string): string | null },
  now = Date.now(),
): DeskRing[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(officeRingsKey(environment));
    if (!raw) return [];
    return parseOfficeRings(JSON.parse(raw), now);
  } catch {
    return [];
  }
}

export function saveOfficeRings(
  environment: Environment,
  rings: DeskRing[],
  storage?: { setItem(key: string, value: string): void },
): void {
  if (!storage) return;
  try {
    storage.setItem(officeRingsKey(environment), JSON.stringify(rings));
  } catch {
    /* private mode */
  }
}

export type OfficeIntent =
  | { type: "expand"; id: InstrumentId | "window" }
  | { type: "bump"; id: string };

const intentListeners = new Set<(intent: OfficeIntent) => void>();

export function emitOfficeIntent(intent: OfficeIntent): void {
  for (const listener of intentListeners) listener(intent);
}

export function subscribeOfficeIntent(listener: (intent: OfficeIntent) => void): () => void {
  intentListeners.add(listener);
  return () => { intentListeners.delete(listener); };
}
