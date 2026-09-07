import { eraseDevelopmentActivity } from "../src/ledgerSync/lifecycle.ts";
import { describe, it, expect } from "vitest";
import {
  catalogHousehold,
  postEntry,
  addRecurrence,
  postOneRecurrence,
  splitForSync,
  compileHousehold,
  buildBatchImport,
  prepareImportRows,
  assertAcceptableBooks,
} from "../src/core/index.ts";
import {
  capturedIntent,
  clearCapturedIntent,
} from "../src/ledgerSync/capture.ts";
import { commandFromCapture, type Scope } from "../src/ledgerSync/protocol.ts";
import {
  prepareCommand,
  intentDigest,
  type AuthorityState,
} from "../src/ledgerSync/authority.ts";
import { difference, project } from "../src/ledgerSync/patch.ts";
import { encodeMessage, MessageReader } from "../src/ledgerSync/wire.ts";
const grocery = (note: string, actor = "MEM-001") => ({
  date: "2026-09-07",
  type: "expense" as const,
  amount: "4.00",
  accountId: "ACC-VISA",
  subcategoryId: "SUB-FOOD-GROCERIES",
  note,
  createdBy: actor,
  confirmDuplicate: true,
});
function fixture() {
  const h = catalogHousehold();
  const one = splitForSync(h, "MEM-001"),
    two = splitForSync(h, "MEM-002");
  const state: AuthorityState = {
    sequence: h.revision,
    shared: one.shared,
    personal: new Map([
      ["MEM-001", one.personal],
      ["MEM-002", two.personal],
    ]),
  };
  const scope: Scope = {
    environment: h.environment,
    householdId: h.householdId,
    memberId: "MEM-001",
    subject: "test-one",
    role: "owner",
    expires: Date.now() + 60000,
    aclEpoch: 1,
  };
  return { h, state, scope };
}
describe("ledger sync v2 money authority", () => {
  it("accepts simultaneous groceries against the same observed sequence without overwriting either", async () => {
    const { h, state, scope } = fixture();
    const a = await commandFromCapture(
      capturedIntent(postEntry(h, grocery("milk")).household)!,
      scope,
      crypto.randomUUID(),
    );
    const b = await commandFromCapture(
      capturedIntent(postEntry(h, grocery("bread", "MEM-002")).household)!,
      scope,
      crypto.randomUUID(),
    );
    const first = await prepareCommand(state, a, scope, () => {});
    const second = await prepareCommand(
      {
        ...state,
        sequence: first.receipt.sequence,
        shared: first.shared,
        personal: new Map([...state.personal, ["MEM-001", first.personal]]),
      },
      b,
      { ...scope, memberId: "MEM-002", subject: "test-two" },
      () => {},
    );
    expect(
      second.household.transactions
        .filter((t) => ["milk", "bread"].includes(t.note))
        .map((t) => t.note)
        .sort(),
    ).toEqual(["bread", "milk"]);
    expect(second.receipt.sequence).toBe(state.sequence + 2);
    expect(second.receipt.postedIds[0]).not.toBe(b.steps[0]!.previewIds[0]);
    expect(compileHousehold(second.household).entries.length).toBeGreaterThan(
      0,
    );
    expect(project(state.shared, first.event.shared)).toEqual(first.shared);
  });
  it("keeps an intent fingerprint stable across reconnection catch-up", async () => {
    const { h, scope } = fixture();
    const c = await commandFromCapture(
      capturedIntent(postEntry(h, grocery("retry")).household)!,
      scope,
      crypto.randomUUID(),
    );
    expect(await intentDigest(c, scope.memberId)).toBe(
      await intentDigest({ ...c, observedSequence: 999 }, scope.memberId),
    );
    expect(await intentDigest(c, scope.memberId)).not.toBe(
      await intentDigest(c, "MEM-002"),
    );
  });
  it("rejects actor substitution and public reversal injection", async () => {
    const { h, state, scope } = fixture();
    const c = await commandFromCapture(
      capturedIntent(postEntry(h, grocery("actor")).household)!,
      scope,
      crypto.randomUUID(),
    );
    await expect(
      prepareCommand(state, c, { ...scope, memberId: "MEM-002" }, () => {}),
    ).rejects.toThrow("ACTOR_MISMATCH");
    (c.steps[0]!.args[0] as Record<string, unknown>).reversalOfId =
      "TX-arbitrary";
    await expect(prepareCommand(state, c, scope, () => {})).rejects.toThrow(
      "USE_REVERSAL_COMMAND",
    );
  });
  it("rejects a forged preview amount before persistence", async () => {
    const { h, state, scope } = fixture();
    const c = await commandFromCapture(
      capturedIntent(postEntry(h, grocery("amount")).household)!,
      scope,
      crypto.randomUUID(),
    );
    (c.steps[0]!.reviewed[0] as Record<string, unknown>).amountCents = 1;
    await expect(prepareCommand(state, c, scope, () => {})).rejects.toThrow(
      "BUSINESS_INTENT_CHANGED",
    );
  });
  it("rechecks authorization after asynchronous validation", async () => {
    const { h, state, scope } = fixture();
    const c = await commandFromCapture(
      capturedIntent(postEntry(h, grocery("revoked")).household)!,
      scope,
      crypto.randomUUID(),
    );
    let checks = 0;
    await expect(
      prepareCommand(state, c, scope, () => {
        if (++checks > 1) throw new Error("AUTH_EXPIRED");
      }),
    ).rejects.toThrow("AUTH_EXPIRED");
  });
  it("refuses cumulative cent overflow even when each posting is individually safe", () => {
    let { h } = fixture();
    for (const amount of ["45035996273704.96", "45035996273704.96", "0.01"])
      h = postEntry(h, { ...grocery(amount), amount }).household;
    expect(() => assertAcceptableBooks(h)).toThrow("exact CAD-cent");
  });
  it("Undo of an import replacement restores the excluded original without deleting it", async () => {
    const f = fixture();
    const base = postEntry(f.h, grocery("original")).household;
    clearCapturedIntent(base);
    const first = base.transactions.at(-1)!;
    const split = splitForSync(base, "MEM-001");
    const state = {
      ...f.state,
      shared: split.shared,
      personal: new Map(f.state.personal).set("MEM-001", split.personal),
    };
    const rows = prepareImportRows({
      household: base,
      memberId: "MEM-001",
      view: "household",
      rows: [
        {
          id: "IMP-one",
          sourceKind: "ofx",
          sourceName: "bank.ofx",
          sourceHash: "test",
          provenanceId: "ofx:1",
          documentKind: "bank-statement",
          accountRef: "acct",
          accountLast4: "",
          currency: "CAD",
          date: "2026-09-07",
          amountCents: 400,
          signedAmountCents: -400,
          suggestedType: "expense",
          bankType: "DEBIT",
          note: "replacement",
          place: "",
          fitId: "1",
          extractionConfidence: null,
        },
      ],
    });
    Object.assign(rows[0]!, {
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      resolution: "exclude-ledger",
      duplicateMatch: { kind: "ledger", transactionId: first.id },
    });
    const preview = buildBatchImport({
      household: base,
      memberId: "MEM-001",
      rows,
    });
    const command = await commandFromCapture(
      capturedIntent(preview.household)!,
      f.scope,
      crypto.randomUUID(),
    );
    const imported = await prepareCommand(state, command, f.scope, () => {});
    expect(imported.receipt.undo.postedIds).not.toContain(first.id);
    expect(imported.receipt.undoRestore?.[0]?.before.id).toBe(first.id);
    const undo = {
      version: 2 as const,
      id: crypto.randomUUID(),
      environment: base.environment,
      householdId: base.householdId,
      observedSequence: imported.receipt.sequence,
      steps: [
        {
          kind: "undoConfirm",
          args: [command.id],
          previewIds: [],
          reviewed: [],
          resources: [],
        },
      ],
    };
    const undone = await prepareCommand(
      {
        ...state,
        sequence: imported.receipt.sequence,
        shared: imported.shared,
        personal: new Map(state.personal).set("MEM-001", imported.personal),
      },
      undo,
      f.scope,
      () => {},
      () => imported.receipt,
    );
    expect(undone.household.transactions).toHaveLength(1);
    expect(undone.household.transactions[0]).toEqual(first);
  });
  it("Undo restores a paid recurrence and refuses to overwrite a later edit to it", async () => {
    const f = fixture(),
      base = addRecurrence(f.h, {
        cadence: "monthly",
        nextDate: "2026-09-07",
        type: "expense",
        amount: "20",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
      }).household;
    clearCapturedIntent(base);
    const recurrence = base.recurrences.at(-1)!,
      split = splitForSync(base, "MEM-001");
    const state = {
      sequence: base.revision,
      shared: split.shared,
      personal: new Map(f.state.personal).set("MEM-001", split.personal),
    };
    const command = await commandFromCapture(
      capturedIntent(
        postOneRecurrence(base, recurrence.id, "2026-09-07", {
          createdBy: "MEM-001",
        }).household,
      )!,
      f.scope,
      crypto.randomUUID(),
    );
    const accepted = await prepareCommand(state, command, f.scope, () => {});
    expect(accepted.household.recurrences.at(-1)!.nextDate).toBe("2026-10-07");
    const after = {
      ...state,
      sequence: accepted.receipt.sequence,
      shared: accepted.shared,
      personal: new Map(state.personal).set("MEM-001", accepted.personal),
    };
    const undo = {
      version: 2 as const,
      id: crypto.randomUUID(),
      environment: base.environment,
      householdId: base.householdId,
      observedSequence: accepted.receipt.sequence,
      steps: [
        {
          kind: "undoConfirm",
          args: [command.id],
          previewIds: [],
          reviewed: [],
          resources: [],
        },
      ],
    };
    const undone = await prepareCommand(
      after,
      undo,
      f.scope,
      () => {},
      () => accepted.receipt,
    );
    expect(undone.household.recurrences.at(-1)).toEqual(recurrence);
    expect(undone.household.transactions).toHaveLength(0);
    const changed = structuredClone(after);
    changed.shared.recurrences.at(-1)!.amountCents = 3000;
    await expect(
      prepareCommand(
        changed,
        undo,
        f.scope,
        () => {},
        () => accepted.receipt,
      ),
    ).rejects.toThrow("BUSINESS_PRECONDITION_CHANGED");
  });
  it("requires owner authority and the reviewed sequence for Development erasure", async () => {
    const f = fixture();
    const command = await commandFromCapture(
      capturedIntent(eraseDevelopmentActivity(f.h, "MEM-001").household)!,
      f.scope,
      crypto.randomUUID(),
    );
    await expect(
      prepareCommand(
        f.state,
        command,
        { ...f.scope, role: "member" },
        () => {},
      ),
    ).rejects.toThrow("OWNER_REQUIRED");
    const moved = {
      ...f.state,
      sequence: f.state.sequence + 1,
      shared: { ...f.state.shared, revision: f.state.sequence + 1 },
    };
    await expect(
      prepareCommand(moved, command, f.scope, () => {}),
    ).rejects.toThrow("BUSINESS_PRECONDITION_CHANGED");
    const erased = await prepareCommand(f.state, command, f.scope, () => {});
    expect(erased.household.transactions).toHaveLength(0);
    expect(erased.receipt.sequence).toBe(f.state.sequence + 1);
  });
  it("preserves deletes and additions in trusted row projections", () => {
    const a = {
        rows: [
          { id: "a", value: 1 },
          { id: "b", value: 2 },
        ],
        x: 1,
      },
      b = {
        rows: [
          { id: "b", value: 3 },
          { id: "c", value: 4 },
        ],
        x: 2,
      };
    expect(project(a, difference(a, b))).toEqual(b);
  });
  it("reassembles a large snapshot and refuses a damaged chunk", async () => {
    const value = { type: "snapshot", payload: "x".repeat(250000) };
    const frames = await encodeMessage(value);
    const reader = new MessageReader();
    let result;
    for (const frame of frames) result = await reader.accept(frame);
    expect(result).toEqual(value);
    const broken = frames.map((f) => f.slice(0));
    const last = new Uint8Array(broken.at(-1)!);
    last[80] = last[80]! ^ 1;
    const damaged = new MessageReader();
    await expect(
      (async () => {
        for (const frame of broken) await damaged.accept(frame);
      })(),
    ).rejects.toThrow();
  });
});
