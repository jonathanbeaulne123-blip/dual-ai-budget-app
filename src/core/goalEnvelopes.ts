import { isValidDateKey } from "./calendar.ts";
import {
  projectedCountable,
  projectedExpenseEffect,
  transactionProjection,
} from "./budget.ts";
import { activeHouseholdFundEvents } from "./householdFund.ts";
import { goalVisibleInView, isVisibleInView } from "./visibility.ts";
import {
  assertKittyStudioTransition,
  displayedKittyPiece,
  kittyGlazeForBase,
  shapeKittyStudio,
} from "./kittyStudio.ts";
import {
  ValidationError,
  type Goal,
  type GoalEnvelope,
  type Household,
  type Transaction,
} from "./types.ts";

export const KITTY_GLAZES = {
  cream: "#eadcc5",
  "sea-glass": "#8da99b",
  terracotta: "#b66c50",
  midnight: "#41546b",
  rose: "#cda1a0",
} as const;
export const defaultGoalEnvelope = (): GoalEnvelope => ({
  version: 1,
  kind: "build",
  purpose: "",
  refill: "target",
  glaze: "cream",
  archivedAt: null,
});
export function shapeGoalEnvelope(value: unknown): GoalEnvelope | undefined {
  if (value === undefined) return undefined;
  const row = value as GoalEnvelope;
  if (
    !row ||
    row.version !== 1 ||
    !["protect", "prepare", "build"].includes(row.kind) ||
    !["target", "refill", "repeat"].includes(row.refill) ||
    !Object.hasOwn(KITTY_GLAZES, row.glaze) ||
    typeof row.purpose !== "string" ||
    row.purpose.length > 1000 ||
    (row.archivedAt !== null &&
      (typeof row.archivedAt !== "string" ||
        !Number.isFinite(Date.parse(row.archivedAt))))
  )
    throw new ValidationError(
      "This Kitty Bank needs a compatible envelope reader. Reload Hearth.",
    );
  const studio = shapeKittyStudio(row.studio);
  // Legacy readers (shelf seals, `.kitty-seal`) keep working: the displayed
  // piece's dip colour wins whenever it is one of the five named glazes.
  const displayedBase = displayedKittyPiece(studio)?.paint.base;
  const glaze =
    (displayedBase !== undefined && kittyGlazeForBase(displayedBase)) ||
    row.glaze;
  return {
    version: 1,
    kind: row.kind,
    purpose: row.purpose,
    refill: row.refill,
    glaze,
    archivedAt: row.archivedAt,
    ...(studio !== undefined ? { studio } : {}),
  };
}
export function goalEnvelopeDependencies(
  h: Household,
  goalId: string,
  memberId: string,
  view: "personal" | "household",
): string[] {
  const result: string[] = [];
  for (const row of h.recurrences)
    if (
      row.active &&
      row.goalId === goalId &&
      h.accounts.some(
        (account) =>
          account.id === row.accountId &&
          (view === "personal"
            ? account.scope === "personal" && account.ownerMemberId === memberId
            : account.scope !== "personal"),
      )
    )
      result.push(`Standing order: ${row.note || row.id}`);
  for (const row of h.appointments ?? [])
    if (view === "household" && row.savingGoalId === goalId)
      result.push(`Calendar: ${row.title || row.id}`);
  for (const row of h.planVersions ?? [])
    if (
      row.scope === view &&
      (view === "household" || row.ownerMemberId === memberId) &&
      row.lines.some(
        (line) =>
          (line.sourceReference?.type === "goal" &&
            line.sourceReference.id === goalId) ||
          line.envelopeGoalId === goalId,
      )
    )
      result.push(`Plan version ${row.sequence} · ${row.monthKey}`);
  return result;
}
function receiptRoot(
  tx: Transaction,
  byId: Map<string, Transaction>,
): Transaction | null {
  let root = transactionProjection(tx, byId).root;
  const visited = new Set<string>();
  while (root.refundOfId) {
    if (visited.has(root.id)) return null;
    visited.add(root.id);
    const parent = byId.get(root.refundOfId);
    if (!parent) return null;
    root = transactionProjection(parent, byId).root;
  }
  return root;
}
/** Exact attributed use, including refunds and corrections. No category/note matching. */
export function goalEnvelopeUsedCents(
  h: Household,
  goalId: string,
  asOf: string,
): number {
  const goal = h.goals.find((row) => row.id === goalId);
  if (!goal) return 0;
  const receipts = (h.goalPurchases ?? []).filter(
    (row) =>
      row.goalId === goalId && row.envelopeUse === "vault" && row.date <= asOf,
  );
  const roots = new Set(receipts.flatMap((row) => row.transactionIds));
  if (!roots.size) return 0;
  const byId = new Map(
    h.transactions.filter((tx) => tx.date <= asOf).map((tx) => [tx.id, tx]),
  );
  if (
    byId.size !== h.transactions.filter((tx) => tx.date <= asOf).length ||
    [...roots].some((id) => !byId.has(id))
  )
    throw new ValidationError(
      "Envelope spending has missing or duplicate receipt identities.",
    );
  const usedByRoot = new Map<string, number>();
  for (const receipt of receipts) {
    const actualVault =
      h.accounts.find(
        (account) =>
          account.active &&
          account.scope !== "personal" &&
          account.kind === "savings" &&
          account.savings?.purpose === "goals",
      ) ??
      h.accounts.find(
        (account) =>
          account.id === "ACC-GOALS" &&
          account.kind === "savings" &&
          account.scope !== "personal",
      );
    if (receipt.vaultAccountId !== actualVault?.id)
      throw new ValidationError(
        "An envelope purchase must use the real Goals vault.",
      );
    const txs = receipt.transactionIds.map((id) => byId.get(id)!);
    if (
      txs.some(
        (tx) =>
          tx.type !== "expense" ||
          tx.date !== receipt.date ||
          tx.createdBy !== receipt.memberId ||
          tx.reversalOfId ||
          tx.refundOfId ||
          tx.sourceId !== receipt.id ||
          tx.accountId !== receipt.vaultAccountId ||
          !isVisibleInView(
            tx,
            goal.ownerMemberId ?? "",
            goal.shared ? "household" : "personal",
          ),
      ) ||
      txs.reduce((sum, tx) => sum + tx.amountCents, 0) !== receipt.spentCents ||
      receipt.lines.reduce((sum, line) => sum + line.amountCents, 0) !==
        receipt.spentCents ||
      (h.goalPurchases ?? []).some(
        (other) =>
          other.id !== receipt.id &&
          other.transactionIds.some((id) =>
            receipt.transactionIds.includes(id),
          ),
      )
    )
      throw new ValidationError("Envelope purchase attribution needs review.");
  }
  const links = new Map<string, Set<string>>();
  for (const tx of byId.values())
    for (const parent of [tx.reversalOfId, tx.refundOfId].filter(
      Boolean,
    ) as string[]) {
      if (!links.has(tx.id)) links.set(tx.id, new Set());
      if (!links.has(parent)) links.set(parent, new Set());
      links.get(tx.id)!.add(parent);
      links.get(parent)!.add(tx.id);
    }
  const connectedIds = new Set<string>(),
    pending = [...roots];
  while (pending.length) {
    const id = pending.pop()!;
    if (connectedIds.has(id)) continue;
    connectedIds.add(id);
    if (!byId.has(id))
      throw new ValidationError(
        "An envelope receipt is missing connected correction history.",
      );
    pending.push(...(links.get(id) ?? []));
  }
  for (const id of connectedIds) {
    const tx = byId.get(id)!;
    let cursor = tx;
    const seen = new Set<string>();
    while (cursor.reversalOfId || cursor.refundOfId) {
      if (seen.has(cursor.id))
        throw new ValidationError("A receipt has circular correction history.");
      seen.add(cursor.id);
      const parent = byId.get((cursor.reversalOfId || cursor.refundOfId)!);
      if (!parent)
        throw new ValidationError(
          "A receipt is missing its original correction or refund.",
        );
      cursor = parent;
    }
    const root = receiptRoot(tx, byId);
    if (!root || !roots.has(root.id)) continue;
    const receipt = receipts.find((row) =>
      row.transactionIds.includes(root.id),
    )!;
    if (
      tx.accountId !== receipt.vaultAccountId ||
      !isVisibleInView(
        tx,
        goal.ownerMemberId ?? "",
        goal.shared ? "household" : "personal",
      )
    )
      throw new ValidationError(
        "Envelope spending crosses its account or private scope.",
      );
    if (projectedCountable(tx, byId))
      usedByRoot.set(
        root.id,
        (usedByRoot.get(root.id) ?? 0) + projectedExpenseEffect(tx, byId),
      );
  }
  // Reject over-refunds independently; they cannot offset another receipt.
  let used = 0;
  for (const id of roots) {
    const net = usedByRoot.get(id) ?? 0;
    if (
      !Number.isSafeInteger(net) ||
      net < 0 ||
      net > byId.get(id)!.amountCents
    )
      throw new ValidationError(
        "An envelope receipt's corrections exceed its original purchase. Review the books.",
      );
    used += net;
  }
  if (!Number.isSafeInteger(used))
    throw new ValidationError("Envelope spending exceeds exact-cent limits.");
  return used;
}
export function goalRemainingClaim(
  h: Household,
  goal: Goal,
  asOf: string,
): number {
  return Math.max(
    0,
    (h.goalContributions ?? [])
      .filter((row) => row.goalId === goal.id && row.date <= asOf)
      .reduce((sum, row) => sum + row.amountCents, 0) -
      goalEnvelopeUsedCents(h, goal.id, asOf),
  );
}
/** A legacy unassigned release cannot be guessed into an individual bank. */
export function goalFundReserve(h: Household, goalId: string, asOf: string) {
  const events = activeHouseholdFundEvents(
    { ...h, fundEvents: h.fundEvents?.filter((row) => row.date <= asOf) },
    h.householdFund?.id,
  );
  const allocatedCents = (h.fundKittyAllocations ?? [])
    .filter(
      (row) =>
        row.goalId === goalId &&
        events.some(
          (event) =>
            event.id === row.eventId && event.kind === "kitty-allocated",
        ),
    )
    .reduce((sum, row) => sum + row.amountCents, 0);
  const releases = events.filter((row) => row.kind === "kitty-released");
  const deficits = events
    .filter((row) => row.kind === "kitty-released" && row.goalId)
    .some((release) => {
      const allocated = (h.fundKittyAllocations ?? [])
        .filter(
          (row) =>
            row.goalId === release.goalId &&
            events.some(
              (event) =>
                event.id === row.eventId &&
                event.kind === "kitty-allocated" &&
                event.date <= release.date,
            ),
        )
        .reduce((sum, row) => sum + row.amountCents, 0);
      const released = releases
        .filter(
          (row) => row.goalId === release.goalId && row.date <= release.date,
        )
        .reduce((sum, row) => sum + row.amountCents, 0);
      return released > allocated;
    });
  const unresolved = releases.some((row) => !row.goalId) || deficits;
  const releasedCents = releases
    .filter((row) => row.goalId === goalId)
    .reduce((sum, row) => sum + row.amountCents, 0);
  return {
    allocatedCents,
    releasedCents,
    unresolved,
    reservedCents: unresolved ? 0 : Math.max(0, allocatedCents - releasedCents),
  };
}
export function hasGoalEnvelopeData(h: Household): boolean {
  return (
    h.goals.some((goal) => goal.envelope !== undefined) ||
    Boolean(h.goalPurchases?.some((row) => row.envelopeUse)) ||
    Boolean(h.fundEvents?.some((row) => row.goalId)) ||
    [...(h.planDrafts ?? []), ...(h.planVersions ?? [])].some((row) =>
      row.lines.some((line) => line.envelopeGoalId),
    ) ||
    Boolean(
      h.planScenarios?.some((row) =>
        row.changedLines.some((line) => line.envelopeGoalId),
      ),
    )
  );
}
export function assertGoalEnvelopeIntegrity(
  h: Household,
  exactReceipts = true,
): void {
  const fundEvents = activeHouseholdFundEvents(h, h.householdFund?.id);
  for (const event of fundEvents)
    if (event.goalId) {
      if (
        event.kind !== "kitty-released" ||
        !h.goals.some((goal) => goal.id === event.goalId && goal.shared)
      )
        throw new ValidationError(
          "A Fund release has invalid bank attribution.",
        );
      const allocated = (h.fundKittyAllocations ?? [])
        .filter(
          (row) =>
            row.goalId === event.goalId &&
            fundEvents.some(
              (source) =>
                source.id === row.eventId &&
                source.kind === "kitty-allocated" &&
                source.date <= event.date,
            ),
        )
        .reduce((sum, row) => sum + row.amountCents, 0);
      const released = fundEvents
        .filter(
          (row) =>
            row.kind === "kitty-released" &&
            row.goalId === event.goalId &&
            row.date <= event.date,
        )
        .reduce((sum, row) => sum + row.amountCents, 0);
      if (released > allocated)
        throw new ValidationError(
          "Correct this bank’s releases before reversing its Fund allocation.",
        );
    }
  for (const goal of h.goals) shapeGoalEnvelope(goal.envelope);
  for (const row of h.goalPurchases ?? [])
    if (row.envelopeUse !== undefined) {
      if (
        row.envelopeUse !== "vault" ||
        !isValidDateKey(row.date) ||
        !Number.isSafeInteger(row.spentCents) ||
        row.spentCents <= 0 ||
        !row.transactionIds.length ||
        new Set(row.transactionIds).size !== row.transactionIds.length
      )
        throw new ValidationError(
          "An envelope purchase has invalid receipt evidence.",
        );
      const goal = h.goals.find((goal) => goal.id === row.goalId);
      if (!goal || (!goal.shared && goal.ownerMemberId !== row.memberId))
        throw new ValidationError(
          "An envelope purchase has invalid ownership.",
        );
    }
  if (exactReceipts)
    for (const id of new Set(
      (h.goalPurchases ?? [])
        .filter((row) => row.envelopeUse)
        .map((row) => row.goalId),
    ))
      goalEnvelopeUsedCents(h, id, "9999-12-31");
  for (const container of [
    ...(h.planVersions ?? []).map((row) => ({
      ...row,
      member: row.ownerMemberId ?? "",
    })),
    ...(h.planDrafts ?? []).map((row) => ({
      ...row,
      member: row.ownerMemberId,
    })),
    ...(h.planScenarios ?? []).map((row) => ({
      ...row,
      lines: row.changedLines,
      member: row.ownerMemberId,
    })),
  ])
    for (const line of container.lines)
      if (
        line.envelopeGoalId &&
        !h.goals.some(
          (goal) =>
            goal.id === line.envelopeGoalId &&
            goalVisibleInView(goal, container.member, container.scope),
        )
      )
        throw new ValidationError(
          "A linked envelope is outside this Plan's scope.",
        );
}
export function assertGoalEnvelopeTransition(
  previous: Household | null | undefined,
  next: Household,
): void {
  assertGoalEnvelopeIntegrity(next);
  if (!previous) return;
  for (const goal of previous.goals.filter((row) => row.envelope)) {
    const current = next.goals.find((row) => row.id === goal.id);
    if (
      !current?.envelope ||
      current.shared !== goal.shared ||
      current.ownerMemberId !== goal.ownerMemberId
    )
      throw new ValidationError(
        "An accepted envelope cannot disappear or change owner. Archive it instead.",
      );
    assertKittyStudioTransition(goal.envelope!.studio, current.envelope.studio);
  }
  for (const row of previous.goalPurchases ?? [])
    if (
      row.envelopeUse &&
      JSON.stringify(
        next.goalPurchases?.find((current) => current.id === row.id),
      ) !== JSON.stringify(row)
    )
      throw new ValidationError(
        "Accepted envelope receipts are immutable. Correct their transactions instead.",
      );
}
