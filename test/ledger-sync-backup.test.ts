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
  assertRecoveredPersonalDesignArchives,
  seal,
  restoreArchive,
  type Checkpoint,
} from "../src/ledgerSync/backup.ts";
import {acceptKittyDesignOperation,createKittyDesignDocument} from '../src/hearthside/design.ts';
import {applyAcceptedDesignReference} from '../src/hearthside/designProjection.ts';
import {emptyPersonalLife} from '../src/hearthside/personalLifeContracts.ts';
import type {DesignArchiveReference} from '../src/hearthside/designArchive.ts';
import type { Household } from '../src/core/types.ts';
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

function privateDesignFixture(){
  const memberId='MEM-001';
  let household:Household={...catalogHousehold(),personalLife:emptyPersonalLife(memberId)};
  let document=createKittyDesignDocument('DESIGN-private-archive',{environment:household.environment,householdId:household.householdId,ownerMemberId:memberId});
  document=acceptKittyDesignOperation(document,{version:1,id:'OP-private-archive',designId:document.id,pieceId:'PIECE-private-archive',gestureId:'GESTURE-private-archive',kind:'create-piece',base:'cream'},
    {environment:household.environment,householdId:household.householdId,actorId:memberId,order:1,acceptedAt:'2026-09-19T12:00:00.000Z'}).document;
  household=applyAcceptedDesignReference(household,document,null,'2026-09-19T12:00:00.000Z');
  const owner=splitForSync(household,memberId),partner=splitForSync(household,'MEM-002');
  const reference:DesignArchiveReference={version:1,designId:document.id,revision:document.revision,sha256:'a'.repeat(64),bankId:null};
  const checkpoint:Checkpoint={version:2,scope:`${household.environment}/${household.householdId}`,authorityInstance:'archive-private-design',sequence:household.revision,
    shared:owner.shared,personal:[[memberId,owner.personal],['MEM-002',partner.personal]],receipts:[],designs:[reference]};
  return {memberId,household,document,reference,checkpoint};
}

it('requires the exact creative archive reference and revision for Personal Together designs',async()=>{
  const fixture=privateDesignFixture();
  await expect(restoreArchive(fixture.checkpoint.scope,await seal(fixture.checkpoint),[])).resolves.toMatchObject({designs:[fixture.reference]});
  const missing=await seal({...fixture.checkpoint,designs:[]});
  await expect(restoreArchive(fixture.checkpoint.scope,missing,[])).rejects.toThrow('DESIGN_ARCHIVE_REFERENCE_MISSING');
  const stale=await seal({...fixture.checkpoint,designs:[{...fixture.reference,revision:0}]});
  await expect(restoreArchive(fixture.checkpoint.scope,stale,[])).rejects.toThrow('DESIGN_ARCHIVE_REFERENCE_MISSING');
});

it('binds recovered Personal Together designs to the exact owner and indexed pieces before commit',()=>{
  const fixture=privateDesignFixture(),state={shared:fixture.checkpoint.shared,personal:fixture.checkpoint.personal};
  expect(()=>assertRecoveredPersonalDesignArchives(state,[{document:fixture.document,reference:fixture.reference}])).not.toThrow();

  let wrongOwner=createKittyDesignDocument(fixture.document.id,{environment:fixture.household.environment,householdId:fixture.household.householdId,ownerMemberId:'MEM-002'});
  wrongOwner=acceptKittyDesignOperation(wrongOwner,{version:1,id:'OP-wrong-owner',designId:wrongOwner.id,pieceId:'PIECE-private-archive',gestureId:'GESTURE-wrong-owner',kind:'create-piece',base:'cream'},
    {environment:fixture.household.environment,householdId:fixture.household.householdId,actorId:'MEM-002',order:1,acceptedAt:'2026-09-19T12:00:00.000Z'}).document;
  expect(()=>assertRecoveredPersonalDesignArchives(state,[{document:wrongOwner,reference:fixture.reference}])).toThrow('DESIGN_ARCHIVE_OWNERSHIP_MISMATCH');

  const forged=structuredClone(state);
  forged.personal[0]![1].personalLife!.designs[0]!.pieceIds=['PIECE-forged'];
  expect(()=>assertRecoveredPersonalDesignArchives(forged,[{document:fixture.document,reference:fixture.reference}])).toThrow('DESIGN_ARCHIVE_PIECES_MISMATCH');
});
