import { it, expect } from "vitest";
import {
  catalogHousehold,
  postEntry,
  splitForSync,
} from "../src/core/index.ts";
import { capturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture, type Scope } from "../src/ledgerSync/protocol.ts";
import { prepareCommand } from "../src/ledgerSync/authority.ts";
import {
  seal,
  restoreArchive,
  type Checkpoint,
} from "../src/ledgerSync/backup.ts";
it("restores accepted money and exact retry receipts, rejecting a damaged or incomplete archive", async () => {
  const h = catalogHousehold(),
    one = splitForSync(h, "MEM-001"),
    two = splitForSync(h, "MEM-002");
  const scope: Scope = {
    environment: h.environment,
    householdId: h.householdId,
    memberId: "MEM-001",
    subject: "test",
    role: "owner",
    expires: Date.now() + 60000,
    aclEpoch: 1,
  };
  const personal = new Map([
    ["MEM-001", one.personal],
    ["MEM-002", two.personal],
  ]);
  const checkpoint = await seal<Checkpoint>({
    version: 2,
    scope: `${h.environment}/${h.householdId}`,
    authorityInstance: crypto.randomUUID(),
    sequence: h.revision,
    shared: one.shared,
    personal: [...personal],
    receipts: [],
  });
  const preview = postEntry(h, {
    date: "2026-09-07",
    type: "expense",
    amount: "10",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    createdBy: "MEM-001",
    note: "archived grocery",
    confirmDuplicate: true,
  });
  const command = await commandFromCapture(
    capturedIntent(preview.household)!,
    scope,
    crypto.randomUUID(),
  );
  const accepted = await prepareCommand(
    { sequence: h.revision, shared: one.shared, personal },
    command,
    scope,
    () => {},
  );
  const record = await seal({
    scope: checkpoint.data.scope,
    authorityInstance: checkpoint.data.authorityInstance,
    event: accepted.event,
    receipt: accepted.receipt,
  });
  const restored = await restoreArchive(checkpoint.data.scope, checkpoint, [
    record,
  ]);
  expect(restored.sequence).toBe(accepted.receipt.sequence);
  expect(restored.receipts).toEqual([accepted.receipt]);
  expect(
    restored.shared.transactions.some((t) => t.note === "archived grocery"),
  ).toBe(true);
  expect(restored.personal.find(([id]) => id === "MEM-002")?.[1]).toEqual(
    two.personal,
  );
  await expect(
    restoreArchive(checkpoint.data.scope, { ...checkpoint, sha256: "bad" }, [
      record,
    ]),
  ).rejects.toThrow("CHECKPOINT_CHECKSUM");
  await expect(
    restoreArchive(checkpoint.data.scope, checkpoint, [
      await seal({
        ...record.data,
        event: { ...accepted.event, sequence: accepted.event.sequence + 1 },
      }),
    ]),
  ).rejects.toThrow("ARCHIVE_GAP");
  await expect(
    restoreArchive(checkpoint.data.scope, checkpoint, [
      await seal({ ...record.data, scope: "development/HH-foreign" }),
    ]),
  ).rejects.toThrow("ARCHIVE_AUTHORITY_MISMATCH");
  await expect(
    restoreArchive(checkpoint.data.scope, checkpoint, [
      await seal({ ...record.data, authorityInstance: crypto.randomUUID() }),
    ]),
  ).rejects.toThrow("ARCHIVE_AUTHORITY_MISMATCH");
  await expect(
    restoreArchive("production/HH-other", checkpoint, [record]),
  ).rejects.toThrow("BACKUP_SCOPE_MISMATCH");
});
