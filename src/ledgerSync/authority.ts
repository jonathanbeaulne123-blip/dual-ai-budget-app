import { IncrementalBooksGuard } from "../core/booksValidation.ts";
import { applyRestorePoint } from "../core/restorePoints.ts";
import {
  generateDemoSuite,
  preserveDemoShowcaseContinuity,
  DEMO_SUITE_VERSION,
} from "../core/demoSuite.ts";
import { DEMO_SUITE_COMMAND_KIND } from "../core/onboarding/lifecycle.ts";
import type {
  Household,
  PersonalEnvelope,
  SharedEnvelope,
  CommitResult,
  RestorePoint,
} from "../core/types.ts";
import { assembleHousehold, splitForSync } from "../core/sync.ts";
import {
  acceptHouseholdWrite,
  assertAcceptableBooks,
} from "../core/commandRuntime.ts";
import { undoLedgerConfirm } from "../core/confirmationUndo.ts";
import { reviewedFacts } from "./reviewedFacts.ts";
import { executeIntent } from "./registry.ts";
import { canonical, difference, digest } from "./patch.ts";
import { observedResources } from "./resources.ts";
import {
  parseCommand,
  type AcceptedEvent,
  type LedgerCommand,
  type Receipt,
  type Scope,
} from "./protocol.ts";
export type AuthorityState = {
  sequence: number;
  shared: SharedEnvelope;
  personal: Map<string, PersonalEnvelope>;
};
export type PreparedCommit = {
  event: AcceptedEvent;
  receipt: Receipt;
  shared: SharedEnvelope;
  personal: PersonalEnvelope;
  household: Household;
};
function remap(value: unknown, ids: Map<string, string>): unknown {
  if (typeof value === "string") return ids.get(value) ?? value;
  if (Array.isArray(value)) return value.map((v) => remap(v, ids));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, remap(v, ids)]),
    );
  return value;
}
export async function intentDigest(
  c: LedgerCommand,
  actor: string,
): Promise<string> {
  // observedSequence is a catch-up hint, not financial intent or a household CAS.
  return digest({
    version: c.version,
    householdId: c.householdId,
    environment: c.environment,
    actor,
    steps: c.steps,
  });
}
export async function prepareCommand(
  state: AuthorityState,
  raw: unknown,
  scope: Scope,
  authorize: () => void,
  undoReceipt?: (id: string) => Receipt,
  restorePoint?: (id: string) => Promise<RestorePoint>,
  booksGuards?: Map<string, IncrementalBooksGuard>,
): Promise<PreparedCommit> {
  const command = parseCommand(raw);
  if (
    command.householdId !== scope.householdId ||
    command.environment !== scope.environment
  )
    throw new Error("SCOPE_MISMATCH");
  const personal = state.personal.get(scope.memberId);
  if (!personal) throw new Error("PERSONAL_IMPORT_REQUIRED");
  let current = assembleHousehold(state.shared, personal, { linked: true });
  if (!current.members.some((m) => m.id === scope.memberId && m.active))
    throw new Error("MEMBERSHIP_CHANGED");
  const before = current,
    ids = new Map<string, string>();
  // Legacy receipts use another hash contract and do not bind an actor. They
  // cannot be fabricated into v2 receipts, but their UUIDs remain reserved.
  if (before.commandReceipts.some(receipt => receipt.confirmationId === command.id))
    throw new Error("IMPORTED_CONFIRMATION_EXISTS");
  let result: CommitResult | undefined;
  const warnings: string[] = [],
    postedIds: string[] = [];
  for (const step of command.steps) {
    const args = remap(step.args, ids) as unknown[];
    const required = observedResources(current, step.kind, args);
    for (const r of required) {
      // A resource minted by an earlier step is revalidated by the compound command.
      if ([...ids.values()].some((id) => r.key.endsWith("/" + id))) continue;
      const supplied = step.resources.find((x) => x.key === r.key);
      if (!supplied || supplied.hash !== (await digest(r.value)))
        throw new Error("BUSINESS_PRECONDITION_CHANGED");
    }
    authorize();
    if (step.kind === "undoConfirm") {
      if (
        command.steps.length !== 1 ||
        typeof args[0] !== "string" ||
        !undoReceipt
      )
        throw new Error("INVALID_UNDO");
      const original = undoReceipt(args[0]);
      if (original.actor !== scope.memberId) throw new Error("ACTOR_MISMATCH");
      if (!original.undoEligible) throw new Error("UNDO_UNAVAILABLE");
      for (const row of current.transactions.filter(
        (row) =>
          original.undo.postedIds?.includes(row.id) ||
          original.undoRestore?.some((r) => r.before.id === row.id),
      )) {
        if (
          current.kitchen.books.closedMonths.some(
            (month) => month.monthKey === row.date.slice(0, 7),
          )
        )
          throw new Error("BOOKS_PERIOD_CLOSED");
      }
      for (const restore of original.undoRestore ?? []) {
        const live = current.transactions.find(
          (row) => row.id === restore.before.id,
        );
        if (!live || (await digest(live)) !== restore.afterHash)
          throw new Error("BUSINESS_PRECONDITION_CHANGED");
      }
      for (const row of original.undoRelated ?? []) {
        const live = (current as unknown as Record<string, unknown[]>)[
          row.field
        ]?.find((value: any) => value.id === row.id);
        if (!live || (await digest(live)) !== row.afterHash)
          throw new Error("BUSINESS_PRECONDITION_CHANGED");
      }
      result = undoLedgerConfirm(current, {
        ...original.undo,
        snapshot: current,
      });
      if (original.undoRestore?.length) {
        const restored = new Map(
          original.undoRestore.map((row) => [row.before.id, row.before]),
        );
        result.household.transactions = result.household.transactions.map(
          (row) => restored.get(row.id) ?? row,
        );
      }
      for (const row of original.undoRelated ?? []) {
        const target = result.household as unknown as Record<string, unknown[]>;
        target[row.field] = target[row.field]!.map((value: any) =>
          value.id === row.id ? row.before : value,
        );
      }
    } else if (step.kind === "restoreSharedPoint" && restorePoint) {
      if (
        scope.role !== "owner" ||
        scope.environment !== "development" ||
        command.steps.length !== 1
      )
        throw new Error("OWNER_REQUIRED");
      const point = await restorePoint(String(args[0]));
      point.shared = {
        ...point.shared,
        members: current.members,
        google: current.google,
        devices: current.devices,
      };
      authorize();
      result = {
        household: applyRestorePoint(current, point, scope.memberId, {
          isOwner: true,
        }),
        postedIds: [],
        warnings: [],
        undo: {
          id: command.id,
          label: `Restore ${point.label}`,
          snapshot: current,
          postedIds: [],
          actorMemberId: scope.memberId,
          commandKind: "restoreSharedPoint",
        },
      };
    } else if (step.kind === "regenerateDemoSuite") {
      if (
        scope.role !== "owner" ||
        scope.environment !== "development" ||
        args[0] !== DEMO_SUITE_VERSION
      )
        throw new Error("OWNER_REQUIRED");
      const options = args[1] as Parameters<typeof generateDemoSuite>[0];
      if (
        !options ||
        !Number.isSafeInteger(options.seed) ||
        typeof options.today !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(options.today)
      )
        throw new Error("INVALID_COMMAND");
      const generated = await generateDemoSuite(options);
      authorize();
      result = {
        household: preserveDemoShowcaseContinuity(current, generated.household),
        postedIds: [],
        warnings: [],
        undo: {
          id: command.id,
          label: "Replace Demo Suite",
          snapshot: current,
          postedIds: [],
          actorMemberId: scope.memberId,
          commandKind: DEMO_SUITE_COMMAND_KIND,
        },
      };
    } else
      result = executeIntent(
        current,
        step.kind,
        args,
        scope.memberId,
        command.id,
        scope,
      );
    if (
      canonical(reviewedFacts(result)) !== canonical(remap(step.reviewed, ids))
    )
      throw new Error("BUSINESS_INTENT_CHANGED");
    for (let i = 0; i < step.previewIds.length; i++) {
      const actual = result.postedIds[i];
      if (actual) ids.set(step.previewIds[i]!, actual);
    }
    current = result.household;
    warnings.push(...result.warnings);
    postedIds.push(...result.postedIds);
  }
  if (!result) throw new Error("INVALID_COMMAND");
  const guardFor = (memberId: string) => {
    let guard = booksGuards?.get(memberId);
    if (!guard && booksGuards) { guard = new IncrementalBooksGuard(); booksGuards.set(memberId, guard); }
    return guard;
  };
  // Full existing Fund, onboarding and accounting transition rules still run.
  const accepted = await acceptHouseholdWrite({
    previous: ["eraseDevelopmentActivity", "restoreSharedPoint"].includes(
      command.steps[0]!.kind,
    )
      ? null
      : before,
    candidate: current,
    booksGuard: guardFor(scope.memberId)?.fork(),
    confirmationId: command.id,
    commandKind: result.undo.commandKind ?? command.steps.at(-1)!.kind,
    postedIds: [...new Set(postedIds)],
    actingMemberId: scope.memberId,
    adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
  });
  if (!accepted.ok) throw new Error(accepted.userMessage ?? "BOOKS_REJECTED");
  authorize();
  const household = {
      ...accepted.household,
      commandReceipts: [],
      restorePoints: [],
      revision: state.sequence + 1,
      baseRevision: state.sequence + 1,
    },
    split = splitForSync(household, scope.memberId);
  (guardFor(scope.memberId)?.validate(assembleHousehold(split.shared, split.personal, { linked: true })) ?? assertAcceptableBooks(household));
  for (const [memberId, own] of state.personal)
    if (memberId !== scope.memberId)
      { const visible = assembleHousehold(split.shared, own, { linked: true });
        guardFor(memberId)?.validate(visible) ?? assertAcceptableBooks(visible); }
  const fingerprint = await intentDigest(command, scope.memberId);
  authorize();
  const previousIds = new Set(
    Object.values(before as unknown as Record<string, unknown>).flatMap(
      (value) =>
        Array.isArray(value)
          ? value
              .filter((row) => row && typeof row.id === "string")
              .map((row) => row.id)
          : [],
    ),
  );
  const createdIds = [...new Set(postedIds)].filter(
    (id) => !previousIds.has(id),
  );
  const undoRestore = await Promise.all(
    before.transactions
      .filter((row) => postedIds.includes(row.id))
      .flatMap((row) => {
        const after = household.transactions.find((item) => item.id === row.id);
        return after && canonical(after) !== canonical(row)
          ? [(async () => ({ before: row, afterHash: await digest(after) }))()]
          : [];
      }),
  );
  const undoRelated: NonNullable<Receipt["undoRelated"]> = [];
  for (const [field, rows] of Object.entries(
    before as unknown as Record<string, unknown>,
  )) {
    if (
      [
        "transactions",
        "activity",
        "tombstones",
        "commandReceipts",
        "restorePoints",
      ].includes(field) ||
      !Array.isArray(rows)
    )
      continue;
    const afterRows = (household as unknown as Record<string, unknown>)[field];
    if (!Array.isArray(afterRows)) continue;
    for (const row of rows) {
      if (!row || typeof row.id !== "string") continue;
      const after = afterRows.find((value) => value.id === row.id);
      if (after && canonical(after) !== canonical(row))
        undoRelated.push({
          field,
          id: row.id,
          before: row,
          afterHash: await digest(after),
        });
    }
  }
  const receipt: Receipt = {
    undoRelated,
    undoEligible: createdIds.some((id) => /^(TXN|SHF)/.test(id)),
    undoRestore,
    ...(command.steps[0]!.kind === "undoConfirm"
      ? { undoOf: String(command.steps[0]!.args[0]) }
      : {}),
    id: command.id,
    sequence: state.sequence + 1,
    digest: fingerprint,
    actor: scope.memberId,
    postedIds: [...new Set(postedIds)],
    warnings,
    undo: {
      id: command.id,
      label: result.undo.label,
      postedIds: createdIds,
      actorMemberId: scope.memberId,
      ...(result.undo.commandKind
        ? { commandKind: result.undo.commandKind }
        : {}),
    },
    commandKind: result.undo.commandKind ?? command.steps.at(-1)!.kind,
    ...(result.persistenceScope
      ? {
          persistenceScope: result.persistenceScope,
          personalMemberId: scope.memberId,
        }
      : {}),
  };
  const event: AcceptedEvent = {
    confirmation: { commandId: command.id, idMap: Object.fromEntries(ids) },
    sequence: receipt.sequence,
    shared: difference(state.shared, split.shared),
    personal: difference(personal, split.personal),
    memberId: scope.memberId,
    acceptedAt: new Date().toISOString(),
  };
  if (canonical(split.shared).length > 32 * 1024 * 1024)
    throw new Error("HOUSEHOLD_LIMIT");
  return {
    event,
    receipt,
    shared: split.shared,
    personal: split.personal,
    household,
  };
}
