import {
  stageLedgerCreation,
  completeLedgerCreation,
} from "../../src/ledgerSync/creationStore.ts";
import { LedgerSyncClient } from "../../src/ledgerSync/client.ts";
import { LedgerStore } from "../../src/ledgerSync/localStore.ts";
import {
  catalogHousehold,
  postEntry,
  type Household,
} from "../../src/core/index.ts";
const target = window as any;
let client: LedgerSyncClient, household: Household, scope: any;
target.initialize = async (id: string, memberId: string) => {
  const baseline = {
    ...catalogHousehold(),
    householdId: id,
    revision: 0,
    baseRevision: 0,
  };
  for (let n = 3; n <= 6; n++)
    baseline.members.push({
      ...baseline.members[0]!,
      id: `MEM-00${n}`,
      name: `Test member ${n}`,
    });
  scope = {
    environment: "development",
    householdId: id,
    memberId,
    subject: `local:${memberId}`,
  };
  await fetch(`/ledger-sync/v2/development/${id}/import`, {
    method: "POST",
    headers: {
      Authorization: `Bearer local:${memberId}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(baseline),
  }).catch(() => {});
  client = new LedgerSyncClient({
    scope,
    token: async () => `local:${memberId}`,
    pendingChanged:rows=>{target.previews=rows;},
    rejectedChanged:rows=>{target.rejectedEntries=rows;},
    adopt: async (next,_status,rows) => {
      target.previews=rows;
      household = next;
      target.replica = next;
    },
    status: (status, message) => {
      target.syncStatus = status;
      target.syncMessage = message;
    },
  });
  void client.start().catch(() => {});
  target.retry = () => client.retryPending();
};
target.queue = async (note: string, online = false) => {
  const id = crypto.randomUUID(),
    preview = postEntry(household, {
      date: "2026-09-07",
      type: "expense",
      amount: "1.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: scope.memberId,
      note,
      confirmDuplicate: true,
    });
  const result = client.confirm(preview.household, id);
  void result.catch(() => {});
  if (online) {
    await result;
    return id;
  }
  const store = await LedgerStore.open(scope);
  try {
    for (let n = 0; n < 100; n++) {
      if ((await store.load()).pending.some((command) => command.id === id))
        return id;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("Intent was not durably queued");
  } finally {
    store.close();
  }
};
target.pending = async () => {
  const store = await LedgerStore.open(scope);
  try {
    return (await store.load()).pending;
  } finally {
    store.close();
  }
};

target.stageCreation = async (id: string) =>
  (
    await stageLedgerCreation(
      { ...household, householdId: id },
      scope.memberId,
      scope.subject,
    )
  ).householdId;
target.finishCreation = async (id: string) =>
  completeLedgerCreation(
    { ...household, householdId: id },
    scope.memberId,
    scope.subject,
  );
target.poisonCache = async () => {
  const store = await LedgerStore.open(scope);
  try {
    const saved = await store.load();
    if (!saved.replica) throw new Error("No replica");
    saved.replica.shared.name = "DAMAGED CACHE";
    await store.save(saved.replica);
  } finally {
    store.close();
  }
};

target.rejectQueued = async (id:string) => {const store=await LedgerStore.open(scope);try{await store.reject(id,'Synthetic definitive refusal');}finally{store.close();}};
target.restart = async () => {await client.destroy();await target.initialize(scope.householdId,scope.memberId);};
target.dismissRejected = (id:string)=>client.dismissRejected(id);
