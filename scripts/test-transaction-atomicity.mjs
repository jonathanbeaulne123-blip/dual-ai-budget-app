import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const codeSource = readFileSync("Code.gs", "utf8");

function freshContext() {
  const context = vm.createContext({ console });
  vm.runInContext(codeSource, context, { filename: "Code.gs" });
  return context;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const normalizedInput = {
  dateKey: "2026-08-18",
  timeZone: "America/Toronto",
  type: "Expense",
  amount: 12.3,
  amountCents: 1230,
  subId: "SUB-FOOD-GROCERIES",
  memberId: "MEM-JONATHAN",
  note: "weekly groceries",
  accountId: "ACC-CHEQUING",
  currency: "CAD",
  category: {
    subId: "SUB-FOOD-GROCERIES",
    subName: "Groceries",
    parentId: "CAT-FOOD",
    transactionType: "Expense",
    essentialDefault: "Yes",
    incomeStabilityDefault: "",
  },
};

function commitState(overrides = {}) {
  return {
    transactionIds: ["TXN-SHIFT-000035", "TXN-MANUAL-000037"],
    rawRecordIds: ["RAW-SHIFT-000035", "RAW-MANUAL-000037"],
    importBatches: [{
      _row: 6,
      Import_Batch_ID: "BATCH-MANUAL-ENTRY",
      Account_ID: "ACC-CHEQUING",
      Record_Count: 13,
    }],
    nextTransactionRow: 42,
    nextRawRow: 42,
    nextBatchRow: 7,
    now: "2026-08-18T23:30:00.000Z",
    ...overrides,
  };
}

{
  const context = freshContext();
  const originalState = commitState();
  const originalInput = JSON.stringify(normalizedInput);
  const originalCommitState = JSON.stringify(originalState);
  const plan = plain(context.planManualTransactionCommit_(normalizedInput, "TORONTO_DATE", originalState));

  assert.equal(plan.transactionId, "TXN-MANUAL-000038");
  assert.equal(plan.rawRecordId, "RAW-MANUAL-000038");
  assert.deepEqual(plan.batch, {
    id: "BATCH-MANUAL-ENTRY",
    existed: true,
    row: 6,
    previousRecordCount: 13,
    nextRecordCount: 14,
    values: {
      Import_Batch_ID: "BATCH-MANUAL-ENTRY",
      Imported_At: "2026-08-18T23:30:00.000Z",
      Source_System: "Manual entry (Add Transaction tool)",
      Source_File: "",
      Account_ID: "ACC-CHEQUING",
      Record_Count: 14,
      Status: "Completed",
      Notes: "Auto-created by the Add Transaction tool; reused for every manual entry.",
    },
  });
  assert.equal(plan.raw.row, 42);
  assert.equal(plan.raw.values.Raw_Record_ID, "RAW-MANUAL-000038");
  assert.equal(plan.raw.values.Raw_Transaction_Date, "TORONTO_DATE");
  assert.equal(plan.raw.values.Raw_Currency, "CAD");
  assert.equal(plan.transaction.row, 42);
  assert.equal(plan.transaction.values.Transaction_ID, "TXN-MANUAL-000038");
  assert.equal(plan.transaction.values.Raw_Record_ID, "RAW-MANUAL-000038");
  assert.equal(plan.transaction.values.Currency, "CAD");
  assert.equal(JSON.stringify(normalizedInput), originalInput, "planning must not mutate normalized input");
  assert.equal(JSON.stringify(originalState), originalCommitState, "planning must not mutate current state");

  const newBatchPlan = plain(context.planManualTransactionCommit_(
    normalizedInput,
    "TORONTO_DATE",
    commitState({ importBatches: [], nextBatchRow: 5 }),
  ));
  assert.equal(newBatchPlan.batch.existed, false);
  assert.equal(newBatchPlan.batch.row, 5);
  assert.equal(newBatchPlan.batch.previousRecordCount, 0);
  assert.equal(newBatchPlan.batch.nextRecordCount, 1);

  assert.throws(
    () => context.planManualTransactionCommit_(normalizedInput, "TORONTO_DATE", commitState({
      importBatches: [
        { _row: 5, Import_Batch_ID: "BATCH-MANUAL-ENTRY", Record_Count: 1 },
        { _row: 6, Import_Batch_ID: "BATCH-MANUAL-ENTRY", Record_Count: 2 },
      ],
    })),
    /More than one BATCH-MANUAL-ENTRY/,
  );
  assert.throws(
    () => context.planManualTransactionCommit_(normalizedInput, "TORONTO_DATE", commitState({
      importBatches: [{ _row: 6, Import_Batch_ID: "BATCH-MANUAL-ENTRY", Record_Count: "drift" }],
    })),
    /invalid Record_Count/,
  );
}

{
  const context = freshContext();
  const tables = {
    "Import Batches": [{
      _row: 6,
      Import_Batch_ID: "BATCH-MANUAL-ENTRY",
      Account_ID: "ACC-CHEQUING",
      Record_Count: 13,
    }],
    "Raw Transactions": [],
    Transactions: [],
  };
  const lastRows = { "Import Batches": 6, "Raw Transactions": 41, Transactions: 41 };
  const events = [];
  let failAfterRawAppend = false;

  const transactionColumnByHeader = {
    Effective_Category_ID: 19,
    Effective_Subcategory_ID: 20,
    Duplicate_Key: 25,
  };
  const transactionHeaderByColumn = Object.fromEntries(
    Object.entries(transactionColumnByHeader).map(([header, column]) => [column, header]),
  );

  function fakeSheet(name) {
    return {
      getLastRow: () => lastRows[name],
      appendRow(values) {
        const row = lastRows[name] + 1;
        lastRows[name] = row;
        tables[name].push({ ...values, _row: row });
        events.push(`append-${name}`);
        if (name === "Raw Transactions" && failAfterRawAppend) throw new Error("simulated raw append post-write failure");
      },
      deleteRow(rowNumber) {
        const index = tables[name].findIndex((row) => row._row === rowNumber);
        assert.notEqual(index, -1, `mock ${name} row ${rowNumber} must exist before deletion`);
        tables[name].splice(index, 1);
        tables[name].forEach((row) => { if (row._row > rowNumber) row._row -= 1; });
        lastRows[name] -= 1;
        events.push(`delete-${name}`);
      },
      getRange(rowNumber, column) {
        const row = tables[name].find((candidate) => candidate._row === rowNumber);
        return {
          setValue(value) {
            assert.ok(row, `mock ${name} row ${rowNumber} must exist before setValue`);
            if (name === "Import Batches" && column === 6) row.Record_Count = value;
            else throw new Error(`Unexpected mock setValue ${name} column ${column}`);
            events.push(`set-${name}`);
          },
          getFormula() {
            assert.ok(row, `mock ${name} row ${rowNumber} must exist before getFormula`);
            const header = transactionHeaderByColumn[column];
            return header ? row[header] : "";
          },
        };
      },
    };
  }

  const sheets = Object.fromEntries(Object.keys(tables).map((name) => [name, fakeSheet(name)]));
  context.sheet_ = (name) => sheets[name];
  context.findRowsByStableId_ = (sheetName, idHeader, id) => tables[sheetName].filter((row) => row[idHeader] === id);
  context.rowFromHeaders_ = (_sheetName, values) => ({ ...values });
  context.col_ = (sheetName, headerName) => {
    if (sheetName === "Import Batches" && headerName === "Record_Count") return 6;
    if (sheetName === "Transactions" && transactionColumnByHeader[headerName]) return transactionColumnByHeader[headerName];
    throw new Error(`Unexpected mock column ${sheetName}.${headerName}`);
  };
  const formulaColumns = {
    Manual_Category_ID: "Q",
    Manual_Subcategory_ID: "R",
    Auto_Category_ID: "O",
    Auto_Subcategory_ID: "P",
    Transaction_Date: "F",
    Amount: "H",
    Account_ID: "D",
    Transaction_Type: "G",
    Original_Description: "J",
  };
  context.colLetter_ = (sheetName, headerName) => {
    assert.equal(sheetName, "Transactions");
    return formulaColumns[headerName];
  };
  context.SpreadsheetApp = { flush: () => { events.push("flush"); } };

  const firstPlan = context.planManualTransactionCommit_(normalizedInput, "TORONTO_DATE", commitState());
  const firstAdapter = context.createManualTransactionSheetAdapter_(firstPlan);
  context.executeManualTransactionCommit_(firstPlan, firstAdapter);

  assert.equal(tables["Import Batches"][0].Record_Count, 14);
  assert.equal(tables["Raw Transactions"].length, 1);
  assert.equal(tables.Transactions.length, 1);
  assert.equal(tables.Transactions[0].Transaction_ID, "TXN-MANUAL-000038");
  assert.match(tables.Transactions[0].Effective_Category_ID, /^=IF\(Q42/);
  assert.match(tables.Transactions[0].Effective_Subcategory_ID, /^=IF\(R42/);
  assert.match(tables.Transactions[0].Duplicate_Key, /^=IF\(F42/);
  assert.deepEqual(events, [
    "set-Import Batches",
    "append-Raw Transactions",
    "append-Transactions",
    "flush",
  ]);

  const stableAfterFirst = plain({ tables, lastRows });
  const secondPlan = context.planManualTransactionCommit_(
    { ...normalizedInput, amount: 8.75, amountCents: 875 },
    "TORONTO_DATE_2",
    commitState({
      transactionIds: ["TXN-MANUAL-000037", "TXN-MANUAL-000038"],
      rawRecordIds: ["RAW-MANUAL-000037", "RAW-MANUAL-000038"],
      importBatches: [{ _row: 6, Import_Batch_ID: "BATCH-MANUAL-ENTRY", Account_ID: "ACC-CHEQUING", Record_Count: 14 }],
      nextTransactionRow: 43,
      nextRawRow: 43,
    }),
  );
  const secondAdapter = context.createManualTransactionSheetAdapter_(secondPlan);
  failAfterRawAppend = true;
  assert.throws(
    () => context.executeManualTransactionCommit_(secondPlan, secondAdapter),
    /Transaction was not saved.*simulated raw append post-write failure/,
  );
  assert.deepEqual(plain({ tables, lastRows }), stableAfterFirst, "the real adapter must undo a raw append that wrote before throwing");

  const driftPlan = context.planManualTransactionCommit_(
    { ...normalizedInput, amount: 6.4, amountCents: 640 },
    "TORONTO_DATE_3",
    commitState({
      transactionIds: ["TXN-MANUAL-000037", "TXN-MANUAL-000038"],
      rawRecordIds: ["RAW-MANUAL-000037", "RAW-MANUAL-000038"],
      importBatches: [{ _row: 6, Import_Batch_ID: "BATCH-MANUAL-ENTRY", Account_ID: "ACC-CHEQUING", Record_Count: 14 }],
      nextTransactionRow: 43,
      nextRawRow: 43,
    }),
  );
  const driftAdapter = context.createManualTransactionSheetAdapter_(driftPlan);
  tables["Raw Transactions"].push({
    _row: 43,
    Raw_Record_ID: "RAW-EXTERNAL-000001",
    Import_Batch_ID: "BATCH-EXTERNAL",
  });
  lastRows["Raw Transactions"] = 43;
  const stableWithExternalRow = plain({ tables, lastRows });
  failAfterRawAppend = false;
  assert.throws(
    () => context.executeManualTransactionCommit_(driftPlan, driftAdapter),
    /Transaction was not saved.*Raw Transactions changed.*Expected row 43 but found 44/,
  );
  assert.deepEqual(
    plain({ tables, lastRows }),
    stableWithExternalRow,
    "row-extent drift must restore the batch count and preserve the unrelated row that caused the abort",
  );

  tables["Import Batches"].length = 0;
  tables["Raw Transactions"].length = 0;
  tables.Transactions.length = 0;
  lastRows["Import Batches"] = 4;
  lastRows["Raw Transactions"] = 41;
  lastRows.Transactions = 41;
  events.length = 0;
  const noBatchState = commitState({ importBatches: [], nextBatchRow: 5 });
  const newBatchPlan = context.planManualTransactionCommit_(normalizedInput, "TORONTO_DATE", noBatchState);
  const emptyBeforeNewBatchAttempt = plain({ tables, lastRows });
  failAfterRawAppend = true;
  assert.throws(
    () => context.executeManualTransactionCommit_(newBatchPlan, context.createManualTransactionSheetAdapter_(newBatchPlan)),
    /Transaction was not saved.*simulated raw append post-write failure/,
  );
  assert.deepEqual(
    plain({ tables, lastRows }),
    emptyBeforeNewBatchAttempt,
    "rollback must remove a newly-created manual batch as well as the failed raw append",
  );

  failAfterRawAppend = false;
  context.executeManualTransactionCommit_(newBatchPlan, context.createManualTransactionSheetAdapter_(newBatchPlan));
  assert.equal(tables["Import Batches"].length, 1);
  assert.equal(tables["Import Batches"][0].Record_Count, 1);
  assert.equal(tables["Raw Transactions"].length, 1);
  assert.equal(tables.Transactions.length, 1);
}

function executorFixture({ failureStage = "", timing = "before", rollbackFailure = "" } = {}) {
  const context = freshContext();
  const state = { batchExists: true, batchCount: 13, raw: [], transactions: [] };
  const initial = plain(state);
  const plan = {
    batch: { previousRecordCount: 13, nextRecordCount: 14 },
    rawRecordId: "RAW-MANUAL-000038",
    transactionId: "TXN-MANUAL-000038",
  };
  const events = [];

  function fail(stage, point) {
    if (failureStage === stage && timing === point) throw new Error(`simulated ${stage} ${point} failure`);
  }

  const adapter = {
    applyBatch() {
      events.push("apply-batch");
      fail("batch", "before");
      state.batchCount = 14;
      fail("batch", "after");
    },
    writeRaw() {
      events.push("write-raw");
      fail("raw", "before");
      state.raw.push(plan.rawRecordId);
      fail("raw", "after");
    },
    writeTransaction() {
      events.push("write-transaction");
      fail("transaction", "before");
      state.transactions.push({ id: plan.transactionId, rawId: plan.rawRecordId });
      fail("transaction", "after");
    },
    verify() {
      events.push("verify");
      fail("verify", "before");
      assert.equal(state.batchCount, 14);
      assert.deepEqual(state.raw, [plan.rawRecordId]);
      assert.deepEqual(state.transactions, [{ id: plan.transactionId, rawId: plan.rawRecordId }]);
    },
    rollbackTransaction() {
      events.push("rollback-transaction");
      if (rollbackFailure === "transaction") throw new Error("simulated transaction rollback failure");
      state.transactions = state.transactions.filter((row) => row.id !== plan.transactionId);
    },
    rollbackRaw() {
      events.push("rollback-raw");
      if (rollbackFailure === "raw") throw new Error("simulated raw rollback failure");
      state.raw = state.raw.filter((id) => id !== plan.rawRecordId);
    },
    rollbackBatch() {
      events.push("rollback-batch");
      if (rollbackFailure === "batch") throw new Error("simulated batch rollback failure");
      if (state.batchCount === 14) state.batchCount = 13;
    },
    verifyRollback() {
      events.push("verify-rollback");
      if (JSON.stringify(state) !== JSON.stringify(initial)) throw new Error("simulated recovery verification found residual state");
    },
  };
  return { context, state, initial, plan, adapter, events };
}

{
  const fixture = executorFixture();
  fixture.context.executeManualTransactionCommit_(fixture.plan, fixture.adapter);
  assert.deepEqual(fixture.state, {
    batchExists: true,
    batchCount: 14,
    raw: ["RAW-MANUAL-000038"],
    transactions: [{ id: "TXN-MANUAL-000038", rawId: "RAW-MANUAL-000038" }],
  });
  assert.deepEqual(fixture.events, ["apply-batch", "write-raw", "write-transaction", "verify"]);
}

for (const [failureStage, timing] of [
  ["batch", "before"],
  ["batch", "after"],
  ["raw", "before"],
  ["raw", "after"],
  ["transaction", "before"],
  ["transaction", "after"],
  ["verify", "before"],
]) {
  const fixture = executorFixture({ failureStage, timing });
  assert.throws(
    () => fixture.context.executeManualTransactionCommit_(fixture.plan, fixture.adapter),
    new RegExp(`Transaction was not saved.*simulated ${failureStage} ${timing} failure`),
    `${failureStage}/${timing} must fail visibly`,
  );
  assert.deepEqual(fixture.state, fixture.initial, `${failureStage}/${timing} must restore the exact initial state`);
  assert.deepEqual(
    fixture.events.slice(-2),
    ["rollback-batch", "verify-rollback"],
    "rollback must finish with the earliest batch mutation and an exact recovery check",
  );
}

{
  const fixture = executorFixture({ failureStage: "transaction", timing: "after", rollbackFailure: "transaction" });
  assert.throws(
    () => fixture.context.executeManualTransactionCommit_(fixture.plan, fixture.adapter),
    /CRITICAL: Add Transaction failed and automatic recovery was incomplete.*Do not retry/,
  );
  assert.deepEqual(fixture.state.raw, [], "recovery must continue after one rollback operation fails");
  assert.equal(fixture.state.batchCount, 13, "batch recovery must still run after a transaction rollback failure");
  assert.equal(fixture.state.transactions.length, 1, "the loud error must correspond to the unrecovered row");
}

{
  const context = freshContext();
  const store = {
    transactionIds: ["TXN-MANUAL-000037"],
    rawRecordIds: ["RAW-MANUAL-000037"],
    batchCount: 13,
    raw: [],
    transactions: [],
  };
  function currentState() {
    return commitState({
      transactionIds: [...store.transactionIds],
      rawRecordIds: [...store.rawRecordIds],
      importBatches: [{ _row: 6, Import_Batch_ID: "BATCH-MANUAL-ENTRY", Account_ID: "ACC-CHEQUING", Record_Count: store.batchCount }],
      nextTransactionRow: 5 + store.transactionIds.length,
      nextRawRow: 5 + store.rawRecordIds.length,
    });
  }
  function commit(plan) {
    context.executeManualTransactionCommit_(plan, {
      applyBatch: () => { store.batchCount = plan.batch.nextRecordCount; },
      writeRaw: () => { store.rawRecordIds.push(plan.rawRecordId); store.raw.push(plan.rawRecordId); },
      writeTransaction: () => { store.transactionIds.push(plan.transactionId); store.transactions.push({ id: plan.transactionId, rawId: plan.rawRecordId }); },
      verify: () => {},
      rollbackTransaction: () => { store.transactionIds.pop(); store.transactions.pop(); },
      rollbackRaw: () => { store.rawRecordIds.pop(); store.raw.pop(); },
      rollbackBatch: () => { store.batchCount = plan.batch.previousRecordCount; },
    });
  }

  const first = context.planManualTransactionCommit_(normalizedInput, "DATE-1", currentState());
  commit(first);
  const second = context.planManualTransactionCommit_({ ...normalizedInput, amount: 8.75, amountCents: 875 }, "DATE-2", currentState());
  commit(second);

  assert.deepEqual(store.transactionIds.slice(-2), ["TXN-MANUAL-000038", "TXN-MANUAL-000039"]);
  assert.deepEqual(store.rawRecordIds.slice(-2), ["RAW-MANUAL-000038", "RAW-MANUAL-000039"]);
  assert.equal(store.batchCount, 15);
  assert.deepEqual(store.transactions.map((row) => row.rawId), store.raw);
}

{
  const context = freshContext();
  const events = [];
  let validationCalls = 0;
  context.getTransactionReferenceData_ = () => { events.push("references"); return {}; };
  context.validateAndNormalizeTransactionInput_ = () => { validationCalls += 1; events.push(`validate-${validationCalls}`); return normalizedInput; };
  context.parseTransactionDate_ = () => { events.push("parse"); return "TORONTO_DATE"; };
  context.readManualTransactionCommitState_ = () => { events.push("read-state"); return commitState(); };
  context.planManualTransactionCommit_ = () => { events.push("plan"); return { transactionId: "TXN-MANUAL-000038", input: normalizedInput }; };
  context.createManualTransactionSheetAdapter_ = () => { events.push("create-adapter"); return {}; };
  context.executeManualTransactionCommit_ = () => { events.push("execute"); };
  context.recomputePotentialDuplicateFlags_ = () => { events.push("refresh-duplicates"); };
  context.logChange_ = () => { events.push("log"); };
  context.refreshBudgetSummarySilently_ = () => { events.push("refresh-summary"); };
  context.LockService = {
    getDocumentLock() {
      events.push("get-lock");
      return {
        tryLock(timeoutMs) { events.push(`try-lock-${timeoutMs}`); return true; },
        releaseLock() { events.push("release-lock"); },
      };
    },
  };

  const result = plain(context.addTransaction({}));
  assert.equal(result.ok, true);
  assert.deepEqual(events, [
    "references", "validate-1", "parse",
    "get-lock", "try-lock-10000",
    "references", "validate-2", "parse", "read-state", "plan", "create-adapter", "execute",
    "release-lock", "refresh-duplicates", "log", "refresh-summary",
  ]);
}

{
  const context = freshContext();
  const events = [];
  context.getTransactionReferenceData_ = () => ({});
  context.validateAndNormalizeTransactionInput_ = () => normalizedInput;
  context.parseTransactionDate_ = () => "TORONTO_DATE";
  context.readManualTransactionCommitState_ = () => { events.push("read-state"); return commitState(); };
  context.LockService = {
    getDocumentLock: () => ({
      tryLock(timeoutMs) { assert.equal(timeoutMs, 10_000); events.push("timeout"); return false; },
      releaseLock() { events.push("release"); },
    }),
  };
  assert.throws(() => context.addTransaction({}), /Could not obtain the Add Transaction lock within 10 seconds/);
  assert.deepEqual(events, ["timeout"], "lock timeout must happen before commit-state reads or writes");
}

{
  const context = freshContext();
  const events = [];
  let validationCalls = 0;
  context.getTransactionReferenceData_ = () => ({});
  context.validateAndNormalizeTransactionInput_ = () => {
    validationCalls += 1;
    if (validationCalls === 2) throw new Error("stale category under lock");
    return normalizedInput;
  };
  context.parseTransactionDate_ = () => "TORONTO_DATE";
  context.readManualTransactionCommitState_ = () => { events.push("read-state"); };
  context.LockService = {
    getDocumentLock: () => ({
      tryLock: () => true,
      releaseLock() { events.push("release"); },
    }),
  };
  assert.throws(() => context.addTransaction({}), /stale category under lock/);
  assert.deepEqual(events, ["release"], "a failed authoritative recheck must release the lock without reading commit state");
}

{
  const context = freshContext();
  const events = [];
  context.getTransactionReferenceData_ = () => ({});
  context.validateAndNormalizeTransactionInput_ = () => normalizedInput;
  context.parseTransactionDate_ = () => "TORONTO_DATE";
  context.readManualTransactionCommitState_ = () => commitState();
  context.planManualTransactionCommit_ = () => ({ transactionId: "TXN-MANUAL-000038", input: normalizedInput });
  context.createManualTransactionSheetAdapter_ = () => ({});
  context.executeManualTransactionCommit_ = () => { throw new Error("simulated commit failure"); };
  context.recomputePotentialDuplicateFlags_ = () => { events.push("refresh-duplicates"); };
  context.LockService = {
    getDocumentLock: () => ({
      tryLock: () => true,
      releaseLock() { events.push("release"); },
    }),
  };
  assert.throws(() => context.addTransaction({}), /simulated commit failure/);
  assert.deepEqual(events, ["release"], "a failed commit must release the lock and skip all post-commit work");
}

{
  const context = freshContext();
  const events = [];
  context.getTransactionReferenceData_ = () => ({});
  context.validateAndNormalizeTransactionInput_ = () => normalizedInput;
  context.parseTransactionDate_ = () => "TORONTO_DATE";
  context.readManualTransactionCommitState_ = () => commitState();
  context.planManualTransactionCommit_ = () => ({ transactionId: "TXN-MANUAL-000038", input: normalizedInput });
  context.createManualTransactionSheetAdapter_ = () => ({});
  context.executeManualTransactionCommit_ = () => {};
  context.recomputePotentialDuplicateFlags_ = () => { throw new Error("duplicate refresh unavailable"); };
  context.logChange_ = () => { events.push("log"); };
  context.refreshBudgetSummarySilently_ = () => { events.push("summary"); };
  context.LockService = {
    getDocumentLock: () => ({
      tryLock: () => true,
      releaseLock() { events.push("release"); },
    }),
  };
  const result = plain(context.addTransaction({}));
  assert.equal(result.ok, true, "post-commit refresh failure must not invite a duplicate resubmission");
  assert.match(result.message, /Saved successfully; duplicate-review flags need a manual refresh/);
  assert.deepEqual(events, ["release", "log", "summary"]);
}

for (const [functionName, endMarker] of [
  ["planManualTransactionCommit_", "function addManualTransactionFormulaValues_"],
  ["executeManualTransactionCommit_", "function showAddTransactionDialog"],
]) {
  const start = codeSource.indexOf(`function ${functionName}(`);
  const end = codeSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `${functionName} must be discoverable for purity checks`);
  const functionSource = codeSource.slice(start, end);
  assert.doesNotMatch(
    functionSource,
    /SpreadsheetApp|sheet_|readTable_|LockService/,
    `${functionName} must remain independent of Spreadsheet services and locks`,
  );
}

assert.match(
  codeSource,
  /function addTransaction\(form\)[\s\S]*?tryLock\(MANUAL_TRANSACTION_LOCK_TIMEOUT_MS_\)[\s\S]*?validateAndNormalizeTransactionInput_\(form, getTransactionReferenceData_\(\)\)[\s\S]*?readManualTransactionCommitState_\(\)[\s\S]*?executeManualTransactionCommit_\(plan, adapter\)[\s\S]*?releaseLock\(\)[\s\S]*?recomputePotentialDuplicateFlags_\(\)/,
  "Add Transaction must revalidate, plan, and commit under one lock, then refresh derived flags after release",
);

console.log("Transaction atomicity tests passed: deterministic planning, serialized IDs, three-stage recovery, loud rollback failure, lock lifecycle, and post-commit retry safety.");
