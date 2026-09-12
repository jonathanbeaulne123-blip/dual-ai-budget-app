import { captureCommand } from "../ledgerSync/capture.ts";
import { canonical } from "../ledgerSync/patch.ts";
import { shapeKittyStudio, KITTY_STUDIO_LIMITS } from "./kittyStudio.ts";
import { isVisibleInView } from "./visibility.ts";
import { ValidationError, type CommitResult, type Household, type KittyGlaze, type KittyStudioV1, type LedgerView } from "./types.ts";

export const NEST_CATEGORIES = ["protect", "everyday", "build", "prepare"] as const;
export type NestCategory = typeof NEST_CATEGORIES[number];
/** Cosmetic records only. Parent banks never enter Goals or claim money. */
export type KittyNestLook = { at: string; name: string; glaze: KittyGlaze; studio?: KittyStudioV1 };
export type KittyNestDesign = {
  version: 1;
  id: string;
  bankKey: string;
  visibility: LedgerView;
  createdBy: string;
  revision: number;
  name: string;
  glaze: KittyGlaze;
  studio?: KittyStudioV1;
  history?: KittyNestLook[];
  category: NestCategory | null;
  archivedAt: string | null;
  setupCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export const nestDesignId = (view: LedgerView, memberId: string, bankKey: string) => `NEST:${view}:${view === "personal" ? encodeURIComponent(memberId) : "shared"}:${bankKey}`;
export const nestDesignInView = (row: KittyNestDesign, memberId: string, view: LedgerView) => row.visibility === view && (view === "household" || row.createdBy === memberId);
const fail = (): never => { throw new ValidationError("This bank design needs an updated Hearth. Reload and try again."); };
const iso = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const keys = ["version", "id", "bankKey", "visibility", "createdBy", "revision", "name", "glaze", "studio", "category", "archivedAt", "setupCompletedAt", "createdAt", "updatedAt", "history"];
export function shapeKittyNestDesigns(value: unknown): KittyNestDesign[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 4000) return fail();
  const rows = value.map((raw): KittyNestDesign => {
    const r = raw as KittyNestDesign;
    if (!r || typeof r !== "object" || Object.keys(r).some(key => !keys.includes(key)) || r.version !== 1
      || !["household", "personal"].includes(r.visibility) || typeof r.createdBy !== "string" || !r.createdBy
      || typeof r.bankKey !== "string" || r.bankKey.length > 300 || !/^(king|plan:(protect|everyday|build|prepare)|(?:recurrence|potential|appointment|task|plan-line):.+)$/.test(r.bankKey)
      || r.id !== nestDesignId(r.visibility, r.createdBy, r.bankKey) || !Number.isSafeInteger(r.revision) || r.revision < 1
      || typeof r.name !== "string" || r.name.length > 120 || !["cream", "sea-glass", "terracotta", "midnight", "rose"].includes(r.glaze)
      || (r.category !== null && !(NEST_CATEGORIES as readonly string[]).includes(r.category))
      || (r.archivedAt !== null && !iso(r.archivedAt)) || (r.setupCompletedAt !== null && !iso(r.setupCompletedAt))
      || !iso(r.createdAt) || !iso(r.updatedAt)) return fail();
    if ((r.bankKey === "king" || r.bankKey.startsWith("plan:")) && r.archivedAt !== null) return fail();
    if (r.bankKey === "king" && r.category !== null) return fail();
    if (r.bankKey.startsWith("plan:") && r.category !== null && r.category !== r.bankKey.slice(5)) return fail();
    const studio = shapeKittyStudio(r.studio);
    if (r.history !== undefined && !Array.isArray(r.history)) return fail();
    const history = r.history?.map(look => {
      if (!look || Object.keys(look).some(key => !["at", "name", "glaze", "studio"].includes(key)) || !iso(look.at) || typeof look.name !== "string" || look.name.length > 120 || !["cream", "sea-glass", "terracotta", "midnight", "rose"].includes(look.glaze)) return fail();
      return { ...look, studio: shapeKittyStudio(look.studio) };
    });
    if (history?.some((look, i) => look.at < r.createdAt || look.at > r.updatedAt || (i > 0 && look.at < history[i - 1]!.at))) return fail();
    return { ...r, name: r.name.trim(), ...(studio ? { studio } : {}), ...(history?.length ? { history } : {}) };
  });
  if (new Set(rows.map(row => row.id)).size !== rows.length) return fail();
  return rows;
}
export function mergeKittyNestDesigns(a: unknown, b: unknown): KittyNestDesign[] {
  const result = new Map<string, KittyNestDesign>();
  for (const row of [...shapeKittyNestDesigns(a), ...shapeKittyNestDesigns(b)]) {
    const old = result.get(row.id);
    if (old && row.revision === old.revision && canonical(old) !== canonical(row)) throw new ValidationError("This bank was decorated in two places. Open its latest design before saving.");
    if (!old || row.revision > old.revision) result.set(row.id, row);
  }
  return [...result.values()];
}
export const hasKittyNestData = (h: Pick<Household, "kittyNestDesigns" | "goals">) => Boolean(h.kittyNestDesigns?.length || h.goals.some(goal => goal.envelope?.kind === "everyday"));
export type SaveNestDesignInput = {
  memberId: string;
  view: LedgerView;
  bankKey: string;
  expectedRevision: number;
  name: string;
  glaze: KittyGlaze;
  studio?: KittyStudioV1;
  category?: NestCategory | null;
  archived?: boolean;
  fire?: boolean;
  completeSetup?: boolean;
};
export function nestSourceVisible(h: Household, memberId: string, view: LedgerView, bankKey: string): boolean {
  const [source, ...rest] = bankKey.split(":");
  const sourceId = rest.join(":");
  const accountVisible = (accountId: string) => h.accounts.some(a => a.id === accountId && (view === "household" ? a.scope !== "personal" : a.scope === "personal" && a.ownerMemberId === memberId));
  const sourceVisible = source === "king" || (source === "plan" && (NEST_CATEGORIES as readonly string[]).includes(sourceId))
    || (source === "recurrence" && h.recurrences.some(r => r.id === sourceId && r.type === "expense" && accountVisible(r.accountId)))
    || (source === "potential" && h.potentialExpenses.some(r => r.id === sourceId && r.status !== "removed" && accountVisible(r.accountId) && isVisibleInView(r, memberId, view)))
    || (source === "appointment" && h.appointments.some(r => r.id === sourceId && accountVisible(r.accountId) && (view === "household" ? r.sensitivity === "household" : r.memberId === memberId || r.memberId === "joint" || r.memberId === "companion")))
    || (source === "task" && h.tasks?.some(r => r.id === sourceId && !r.deleted && !r.moneyLink && (r.expectedAmountCents ?? 0) > 0 && r.visibility === view && (view === "household" || r.createdBy === memberId)))
    || (source === "plan-line" && h.planVersions?.some(v => v.scope === view && (view === "household" || v.ownerMemberId === memberId) && v.lines.some(line => line.id === sourceId)));
  return Boolean(sourceVisible);
}

/** The caller supplies a source already visible in the nest, checked below without money mutation. */
export const saveKittyNestDesign = captureCommand("saveKittyNestDesign", (h: Household, input: SaveNestDesignInput): CommitResult => {
  if (!h.members.some(member => member.id === input.memberId && member.active)) throw new ValidationError("Choose an active member.");
  const id = nestDesignId(input.view, input.memberId, input.bankKey);
  const old = h.kittyNestDesigns?.find(row => row.id === id);
  if ((old?.revision ?? 0) !== input.expectedRevision) throw new ValidationError("This bank design changed. Reopen it before saving.");
  if (!nestSourceVisible(h, input.memberId, input.view, input.bankKey)) throw new ValidationError("This bank is no longer available in this space.");
  const source = input.bankKey.split(":")[0];
  const now = new Date().toISOString();
  const history = old && !["king", "plan"].includes(source!) ? receiptLooks(h, old) : old?.history;
  let studio = shapeKittyStudio(input.studio ?? old?.studio);
  if (input.fire) {
    if (!studio?.draft) throw new ValidationError("Put some clay on the wheel first.");
    const piece = { ...studio.draft, firedAt: now, firedBy: input.memberId, firings: (studio.draft.firings ?? 0) + 1 };
    const fired = [...studio.fired.filter(p => p.id !== piece.id), piece];
    if (fired.length > KITTY_STUDIO_LIMITS.fired) throw new ValidationError("Make room on your pottery shelf first.");
    studio = { version: 1, draft: null, fired, displayId: piece.id };
  }
  if (input.completeSetup && (source !== "king" || !studio?.fired.length)) throw new ValidationError("Fire your King before completing this chapter.");
  const row = shapeKittyNestDesigns([{ version: 1, id, bankKey: input.bankKey, visibility: input.view,
    createdBy: old?.createdBy ?? input.memberId, revision: (old?.revision ?? 0) + 1,
    name: input.name, glaze: input.glaze, ...(studio ? { studio } : {}), ...(history?.length ? { history } : {}), category: input.category ?? old?.category ?? null,
    archivedAt: input.archived === undefined ? old?.archivedAt ?? null : input.archived ? now : null,
    setupCompletedAt: old?.setupCompletedAt ?? (input.completeSetup ? now : null), createdAt: old?.createdAt ?? now, updatedAt: now }])[0]!;
  return { household: { ...h, kittyNestDesigns: [...(h.kittyNestDesigns ?? []).filter(r => r.id !== id), row] }, postedIds: [id], warnings: [],
    undo: { id: crypto.randomUUID(), label: "Decorate bank", snapshot: h, postedIds: [id], commandKind: input.view === "personal" ? "saveKittyNestDesign-personal" : "saveKittyNestDesign" } };
});

/** A paid pot is a keepsake: later series edits belong to future pots. */
export function nestLookAt(design: KittyNestDesign | undefined, paidAt: string): KittyNestDesign | undefined {
  if (!design || design.createdAt > paidAt) return undefined;
  const looks: KittyNestLook[] = [...(design.history ?? []), { at: design.updatedAt, name: design.name, glaze: design.glaze, studio: design.studio }];
  const look = looks.filter(row => row.at <= paidAt).sort((a,b) => b.at.localeCompare(a.at))[0];
  return look ? { ...design, name: look.name, glaze: look.glaze, studio: look.studio } : undefined;
}
/** Retain only appearances that an accepted receipt can reference. Repeated editing
 * and archive/restore cannot exhaust a pot's history or rewrite a paid keepsake. */
function sourceReceipts(h: Household, design: KittyNestDesign) {
  const [source, ...parts] = design.bankKey.split(":");
  const id = parts.join(":");
  const linked = new Set<string>();
  if (source === "recurrence") {
    for (const payment of h.recurrences.find(row => row.id === id)?.payments ?? []) linked.add(payment.transactionId);
    for (const tx of h.transactions) if (tx.source === "recurring" && tx.sourceId === id) linked.add(tx.id);
  } else if (source === "potential") {
    const receipt = h.potentialExpenses.find(row => row.id === id)?.transactionId;
    if (receipt) linked.add(receipt);
  } else if (source === "appointment") {
    const receipt = h.appointments.find(row => row.id === id)?.lastPostedTransactionId;
    if (receipt) linked.add(receipt);
    for (const tx of h.transactions) if (tx.source === "visit" && tx.sourceId === id) linked.add(tx.id);
    for (const claim of h.claims) if (claim.appointmentId === id) linked.add(claim.expenseTransactionId);
  } else if (source === "task") {
    const evidence = h.tasks?.find(row => row.id === id)?.completionEvidence;
    if (evidence?.kind === "transaction") linked.add(evidence.transactionId);
  }
  return h.transactions.filter(tx => linked.has(tx.id) && tx.type === "expense" && !tx.refundOfId && !tx.reversalOfId && isVisibleInView(tx, design.createdBy, design.visibility));
}
function receiptLooks(h: Household, design: KittyNestDesign): KittyNestLook[] {
  const looks = [...(design.history ?? []), { at: design.updatedAt, name: design.name, glaze: design.glaze, ...(design.studio ? { studio: design.studio } : {}) }];
  const keep = new Set<number>();
  for (const receipt of sourceReceipts(h, design)) {
    if (receipt.type !== "expense" || receipt.createdAt < design.createdAt) continue;
    let index = looks.length - 1;
    while (index >= 0 && looks[index]!.at > receipt.createdAt) index -= 1;
    if (index >= 0) keep.add(index);
  }
  return looks.filter((_, index) => keep.has(index));
}
export function assertNestKeepsakes(h: Household, old: KittyNestDesign, row: KittyNestDesign): void {
  const appearance = (design: KittyNestDesign | undefined) => design ? { name: design.name, glaze: design.glaze, studio: design.studio } : null;
  for (const receipt of sourceReceipts(h, old)) {
    if (receipt.type === "expense" && canonical(appearance(nestLookAt(old, receipt.createdAt))) !== canonical(appearance(nestLookAt(row, receipt.createdAt)))) {
      throw new ValidationError("A broken pot keeps its original appearance.");
    }
  }
}
export function assertKittyNestTransition(previous: Household | null | undefined, next: Household, actorMemberId?: string, commandKind?: string): void {
  const nextRows = shapeKittyNestDesigns(next.kittyNestDesigns);
  if (!previous) return;
  const oldRows = shapeKittyNestDesigns(previous.kittyNestDesigns);
  for (const old of oldRows) {
    const row = nextRows.find(r => r.id === old.id);
    if (!row || row.createdBy !== old.createdBy || row.visibility !== old.visibility || row.bankKey !== old.bankKey || row.createdAt !== old.createdAt || (old.setupCompletedAt && row.setupCompletedAt !== old.setupCompletedAt)) throw new ValidationError("An accepted bank design cannot disappear or change owner. Archive it instead.");
    if (row.revision < old.revision || (row.revision === old.revision && canonical(row) !== canonical(old))) throw new ValidationError("The bank design changed. Open its current version.");
    if (!["king", "plan"].includes(old.bankKey.split(":")[0]!)) assertNestKeepsakes(previous, old, row);
  }
  for (const row of nextRows) {
    const old = oldRows.find(r => r.id === row.id);
    if (old && canonical(old) === canonical(row)) continue;
    if (!commandKind?.startsWith("saveKittyNestDesign") || !actorMemberId || !next.members.some(m => m.id === actorMemberId && m.active) || !nestSourceVisible(next, actorMemberId, row.visibility, row.bankKey)
      || (!old && row.createdBy !== actorMemberId) || (row.visibility === "personal" && row.createdBy !== actorMemberId) || row.revision !== (old?.revision ?? 0) + 1) throw new ValidationError("Open this bank in its own space before changing its design.");
  }
}
