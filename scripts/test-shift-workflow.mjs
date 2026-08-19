import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const codeSource = readFileSync("Code.gs", "utf8");
const shiftSource = readFileSync("ShiftWorkflow.gs", "utf8");
const dialogSource = readFileSync("AddShiftDialog.html", "utf8");

function freshContext() {
  const context = vm.createContext({ console });
  vm.runInContext(codeSource, context, { filename: "Code.gs" });
  vm.runInContext(shiftSource, context, { filename: "ShiftWorkflow.gs" });
  return context;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const settings = {
  floorPct: 6,
  barPct: 1,
  barRound: 5,
  ccPct: 2,
  hourlyRate: 17.6,
};
const categories = {
  wages: { id: "SUB-INCOME-WAGES", name: "Wages" },
  tips: { id: "SUB-INCOME-TIPS", name: "Tips" },
};
const referenceData = {
  members: [
    { id: "MEM-JONATHAN", name: "Jonathan" },
    { id: "MEM-BIANCA", name: "Bianca" },
  ],
  accountId: "ACC-CHEQUING",
  accountCurrency: "CAD",
  timeZone: "America/Toronto",
  categories,
};

function validForm(context, overrides = {}) {
  return {
    date: "2026-08-19",
    memberId: "MEM-JONATHAN",
    sales: "1000.00",
    cashTips: "50.00",
    ccTips: "100.00",
    hours: "4.00",
    settingsFingerprint: context.shiftSettingsFingerprint_(settings),
    confirmed: false,
    ...overrides,
  };
}

{
  const context = freshContext();
  assert.deepEqual(plain(context.calcShiftAmounts_(
    { sales: 1000, cashTips: 50, ccTips: 100, hours: 4 },
    settings,
  )), {
    floorTipOut: 60,
    barTipOut: 10,
    ccTipOut: 2,
    netTips: 78,
    wages: 70.4,
  });

  assert.deepEqual(plain(context.calcShiftAmounts_(
    { sales: 1.01, cashTips: 0, ccTips: 0, hours: 0.25 },
    settings,
  )), {
    floorTipOut: 0.06,
    barTipOut: 5,
    ccTipOut: 0,
    netTips: -5.06,
    wages: 4.4,
  }, "cent rounding and the existing negative-net-tip behavior must be deterministic");

  const changedRules = { ...settings, floorPct: 5, barRound: 0, hourlyRate: 20 };
  assert.deepEqual(plain(context.calcShiftAmounts_(
    { sales: 100, cashTips: 10, ccTips: 20, hours: 2 },
    changedRules,
  )), {
    floorTipOut: 5,
    barTipOut: 1,
    ccTipOut: 0.4,
    netTips: 23.6,
    wages: 40,
  }, "settings changes must alter both preview and posting math without a code change");

  const preview = plain(context.buildShiftPreviewWithSettings_(validForm(context), settings));
  assert.equal(preview.ready, true);
  assert.deepEqual(preview.calculation, plain(context.calcShiftAmounts_(
    { sales: 1000, cashTips: 50, ccTips: 100, hours: 4 },
    settings,
  )));
  assert.equal(preview.settingsFingerprint, context.shiftSettingsFingerprint_(settings));
}

{
  const context = freshContext();
  const normalized = plain(context.validateAndNormalizeShiftInput_(validForm(context), referenceData, settings));
  assert.equal(normalized.dateKey, "2026-08-19");
  assert.equal(normalized.memberId, "MEM-JONATHAN");
  assert.equal(normalized.currency, "CAD");
  assert.equal(normalized.sales, 1000);
  assert.equal(normalized.hours, 4);
  assert.deepEqual(normalized.calculation, {
    floorTipOut: 60, barTipOut: 10, ccTipOut: 2, netTips: 78, wages: 70.4,
  });

  for (const malformed of [null, undefined, [], "shift", 7]) {
    assert.throws(() => context.validateAndNormalizeShiftInput_(malformed, referenceData, settings), /Shift input is missing or invalid/);
  }
  for (const malformedRefs of [null, undefined, [], "references", 7]) {
    assert.throws(() => context.validateAndNormalizeShiftInput_(validForm(context), malformedRefs, settings), /Shift reference data is unavailable/);
  }
  for (const date of ["", "2026-2-01", "2026-02-29", "2026-04-31", "0999-12-31"]) {
    assert.throws(() => context.validateAndNormalizeShiftInput_(validForm(context, { date }), referenceData, settings), /Date must use YYYY-MM-DD|valid Toronto calendar date/);
  }
  for (const field of ["sales", "cashTips", "ccTips"]) {
    assert.throws(
      () => context.validateAndNormalizeShiftInput_(validForm(context, { [field]: "1.001" }), referenceData, settings),
      /no more than 2 decimal places/,
    );
    assert.throws(
      () => context.validateAndNormalizeShiftInput_(validForm(context, { [field]: "-1" }), referenceData, settings),
      /no more than 2 decimal places|cannot be negative/,
    );
  }
  for (const hours of ["", "0", "24.01", "1.001", "not-a-number"]) {
    assert.throws(
      () => context.validateAndNormalizeShiftInput_(validForm(context, { hours }), referenceData, settings),
      /Hours worked/,
    );
  }
  assert.throws(
    () => context.validateAndNormalizeShiftInput_(validForm(context, { memberId: "MEM-INACTIVE" }), referenceData, settings),
    /Household member is no longer active/,
  );
  assert.throws(
    () => context.validateAndNormalizeShiftInput_(validForm(context), { ...referenceData, accountCurrency: "USD" }, settings),
    /authoritative currency CAD/,
  );
  assert.throws(
    () => context.validateAndNormalizeShiftInput_(validForm(context), { ...referenceData, timeZone: "America\/Los_Angeles" }, settings),
    /Spreadsheet timezone must be America\/Toronto/,
  );
  assert.throws(
    () => context.validateAndNormalizeShiftInput_(validForm(context, { confirmed: "yes" }), referenceData, settings),
    /confirmation is invalid/,
  );
  assert.throws(() => context.normalizeShiftSettings_({ ...settings, barRound: -1 }), /Bar tip-out rounding/);
  assert.throws(() => context.normalizeShiftSettings_({ ...settings, hourlyRate: 0 }), /Hourly wage rate/);
}

function commitState(overrides = {}) {
  return {
    transactionIds: ["TXN-MANUAL-000039", "TXN-SHIFT-000042"],
    rawRecordIds: ["RAW-MANUAL-000039", "RAW-SHIFT-000042"],
    shiftIds: ["SHIFT-000001"],
    importBatches: [{
      _row: 6,
      Import_Batch_ID: "BATCH-SHIFT-ENTRY",
      Account_ID: "ACC-CHEQUING",
      Record_Count: 15,
    }],
    tipTrackerRows: [],
    nextTransactionRow: 47,
    nextRawRow: 47,
    nextBatchRow: 7,
    nextTipTrackerRow: 25,
    now: "NOW",
    ...overrides,
  };
}

function normalizedShiftInput(context, overrides = {}) {
  return {
    dateKey: "2026-08-19",
    timeZone: "America/Toronto",
    memberId: "MEM-JONATHAN",
    accountId: "ACC-CHEQUING",
    currency: "CAD",
    confirmed: false,
    settingsFingerprint: context.shiftSettingsFingerprint_(settings),
    sales: 1000,
    cashTips: 50,
    ccTips: 100,
    hours: 4,
    settings: { ...settings },
    calculation: context.calcShiftAmounts_({ sales: 1000, cashTips: 50, ccTips: 100, hours: 4 }, settings),
    categories,
    ...overrides,
  };
}

{
  const context = freshContext();
  const input = normalizedShiftInput(context);
  const state = commitState();
  const inputBefore = JSON.stringify(input);
  const stateBefore = JSON.stringify(state);
  const plan = plain(context.planShiftCommit_(input, "TORONTO_DATE", state));

  assert.equal(plan.shiftId, "SHIFT-000002");
  assert.deepEqual(plan.transactionIds, ["TXN-SHIFT-000043", "TXN-SHIFT-000044"]);
  assert.deepEqual(plan.rawRecordIds, ["RAW-SHIFT-000043", "RAW-SHIFT-000044"]);
  assert.equal(plan.batch.previousRecordCount, 15);
  assert.equal(plan.batch.nextRecordCount, 16, "the shift batch counts submitted source shifts, not its two derived rows");
  assert.equal(plan.tipTracker.values.length, 14);
  assert.equal(plan.tipTracker.values[12], "SHIFT-000002");
  assert.deepEqual(JSON.parse(plan.tipTracker.values[13]), { version: "v1-cent-rounded", ...settings });
  assert.deepEqual(plan.raw.map((row) => row.values.Raw_Category), ["Wages", "Tips"]);
  assert.deepEqual(plan.raw.map((row) => row.values.Raw_Amount), [70.4, 78]);
  assert.equal(plan.raw.every((row) => row.values.Source_Transaction_ID === "SHIFT-000002"), true);
  assert.equal(plan.transactions.every((row) => row.values.Source_Transaction_ID === "SHIFT-000002"), true);
  assert.deepEqual(plan.transactions.map((row) => row.values.Raw_Record_ID), plan.rawRecordIds);
  assert.deepEqual(plan.transactions.map((row) => row.values.Manual_Subcategory_ID), ["SUB-INCOME-WAGES", "SUB-INCOME-TIPS"]);
  assert.equal(JSON.stringify(input), inputBefore, "planning must not mutate validated shift input");
  assert.equal(JSON.stringify(state), stateBefore, "planning must not mutate serialized commit state");

  assert.throws(
    () => context.planShiftCommit_(input, "DATE", commitState({ importBatches: [
      { Import_Batch_ID: "BATCH-SHIFT-ENTRY", Record_Count: 1 },
      { Import_Batch_ID: "BATCH-SHIFT-ENTRY", Record_Count: 2 },
    ] })),
    /More than one BATCH-SHIFT-ENTRY/,
  );
  assert.throws(
    () => context.planShiftCommit_(input, "DATE", commitState({
      importBatches: [{ Import_Batch_ID: "BATCH-SHIFT-ENTRY", Account_ID: "ACC-OTHER", Record_Count: 1 }],
    })),
    /different account/,
  );
}

{
  const context = freshContext();
  const headers = {
    "Import Batches": ["Import_Batch_ID", "Imported_At", "Source_System", "Source_File", "Account_ID", "Record_Count", "Status", "Notes"],
    "Raw Transactions": [
      "Raw_Record_ID", "Import_Batch_ID", "Source_System", "Source_File", "Source_Row_Number", "Account_ID",
      "Imported_At", "Source_Transaction_ID", "Raw_Transaction_Date", "Raw_Posted_Date", "Raw_Type",
      "Raw_Category", "Raw_Description", "Raw_Merchant", "Raw_Amount", "Raw_Currency", "Raw_Debit_Credit",
      "Raw_Notes", "Raw_Payload", "Normalization_Status",
    ],
    Transactions: [
      "Transaction_ID", "Raw_Record_ID", "Import_Batch_ID", "Account_ID", "Member_ID", "Transaction_Date",
      "Posted_Date", "Transaction_Type", "Amount", "Currency", "Original_Description", "Normalized_Merchant",
      "Income_Stability", "Auto_Category_ID", "Auto_Subcategory_ID", "Auto_Category_Confidence",
      "Manual_Category_ID", "Manual_Subcategory_ID", "Effective_Category_ID", "Effective_Subcategory_ID",
      "Reviewed_Flag", "Review_Status", "Duplicate_Key", "Potential_Duplicate_Flag", "Is_Duplicate",
      "Duplicate_Of_Transaction_ID", "Recurring_Transaction_ID", "Source_Transaction_ID", "User_Notes",
      "Created_At", "Updated_At",
    ],
    "Tip Tracker": [
      "Date", "Member", "Sales", "Cash Tips", "CC Tips", "Hours", "Floor Tip-Out", "Bar Tip-Out",
      "CC Tip-Out", "Net Tips", "Wages", "Logged At", "Shift ID", "Calculation Settings",
    ],
  };
  const tables = {
    "Import Batches": [{
      _row: 6, Import_Batch_ID: "BATCH-SHIFT-ENTRY", Account_ID: "ACC-CHEQUING", Record_Count: 15,
    }],
    "Raw Transactions": [],
    Transactions: [],
    "Tip Tracker": [],
  };
  const lastRows = { "Import Batches": 6, "Raw Transactions": 46, Transactions: 46, "Tip Tracker": 24 };
  let failAfterRawPair = false;
  const events = [];

  function objectFromValues(name, values, rowNumber) {
    const row = { _row: rowNumber };
    headers[name].forEach((header, index) => { row[header] = values[index] === undefined ? "" : values[index]; });
    return row;
  }

  function deleteMockRow(name, rowNumber) {
    const index = tables[name].findIndex((row) => row._row === rowNumber);
    assert.notEqual(index, -1, `${name} row ${rowNumber} must exist before deletion`);
    tables[name].splice(index, 1);
    tables[name].forEach((row) => { if (row._row > rowNumber) row._row -= 1; });
    lastRows[name] -= 1;
    events.push(`delete-${name}`);
  }

  function mockSheet(name) {
    return {
      getLastRow: () => lastRows[name],
      appendRow(values) {
        const rowNumber = lastRows[name] + 1;
        tables[name].push(objectFromValues(name, values, rowNumber));
        lastRows[name] = rowNumber;
        events.push(`append-${name}`);
      },
      deleteRow(rowNumber) { deleteMockRow(name, rowNumber); },
      getRange(rowNumber, column, rowCount, columnCount) {
        return {
          setValues(rows) {
            assert.equal(rowCount, rows.length);
            assert.equal(columnCount, rows[0].length);
            rows.forEach((values, index) => {
              const targetRow = rowNumber + index;
              assert.equal(targetRow, lastRows[name] + 1, `${name} writes must append contiguously`);
              tables[name].push(objectFromValues(name, values, targetRow));
              lastRows[name] = targetRow;
            });
            events.push(`write-${name}`);
            if (name === "Raw Transactions" && failAfterRawPair) throw new Error("simulated raw-pair write-then-throw failure");
          },
          setValue(value) {
            const row = tables[name].find((candidate) => candidate._row === rowNumber);
            assert.ok(row, `${name} row ${rowNumber} must exist before setValue`);
            const header = headers[name][column - 1];
            row[header] = value;
            events.push(`set-${name}-${header}`);
          },
          getFormula() {
            const row = tables[name].find((candidate) => candidate._row === rowNumber);
            assert.ok(row, `${name} row ${rowNumber} must exist before getFormula`);
            return row[headers[name][column - 1]] || "";
          },
        };
      },
    };
  }

  const sheets = Object.fromEntries(Object.keys(tables).map((name) => [name, mockSheet(name)]));
  context.sheet_ = (name) => sheets[name];
  context.requireTipTrackerLayout_ = () => sheets["Tip Tracker"];
  context.readTipTrackerRows_ = () => tables["Tip Tracker"].map((row) => ({ ...row }));
  context.findRowsByStableId_ = (sheetName, idHeader, id) => tables[sheetName].filter((row) => row[idHeader] === id);
  context.rowFromHeaders_ = (sheetName, values) => headers[sheetName].map((header) => values[header] === undefined ? "" : values[header]);
  context.col_ = (sheetName, headerName) => {
    const index = headers[sheetName].indexOf(headerName);
    if (index < 0) throw new Error(`Unknown mock column ${sheetName}.${headerName}`);
    return index + 1;
  };
  const transactionLetters = {
    Manual_Category_ID: "Q", Manual_Subcategory_ID: "R", Auto_Category_ID: "N", Auto_Subcategory_ID: "O",
    Transaction_Date: "F", Amount: "I", Account_ID: "D", Transaction_Type: "H", Original_Description: "K",
  };
  context.colLetter_ = (sheetName, headerName) => {
    assert.equal(sheetName, "Transactions");
    if (!transactionLetters[headerName]) throw new Error(`Unknown formula column ${headerName}`);
    return transactionLetters[headerName];
  };
  context.SpreadsheetApp = { flush: () => { events.push("flush"); } };

  const firstPlan = context.planShiftCommit_(normalizedShiftInput(context), "TORONTO_DATE", commitState());
  context.executeShiftCommit_(firstPlan, context.createShiftSheetAdapter_(firstPlan));

  assert.equal(tables["Import Batches"][0].Record_Count, 16);
  assert.equal(tables["Tip Tracker"].length, 1);
  assert.equal(tables["Raw Transactions"].length, 2);
  assert.equal(tables.Transactions.length, 2);
  assert.deepEqual(tables["Raw Transactions"].map((row) => row.Raw_Category), ["Wages", "Tips"]);
  assert.deepEqual(tables.Transactions.map((row) => row.Amount), [70.4, 78]);
  assert.match(tables.Transactions[0].Effective_Category_ID, /^=IF\(Q47/);
  assert.match(tables.Transactions[0].Effective_Subcategory_ID, /^=IF\(R47/);
  assert.match(tables.Transactions[0].Duplicate_Key, /^=IF\(F47/);

  const stableAfterSuccess = plain({ tables, lastRows });
  const secondPlan = context.planShiftCommit_(normalizedShiftInput(context, { dateKey: "2026-08-20" }), "TORONTO_DATE_2", commitState({
    transactionIds: ["TXN-SHIFT-000043", "TXN-SHIFT-000044"],
    rawRecordIds: ["RAW-SHIFT-000043", "RAW-SHIFT-000044"],
    shiftIds: ["SHIFT-000001", "SHIFT-000002"],
    importBatches: [{ _row: 6, Import_Batch_ID: "BATCH-SHIFT-ENTRY", Account_ID: "ACC-CHEQUING", Record_Count: 16 }],
    nextTransactionRow: 49,
    nextRawRow: 49,
    nextTipTrackerRow: 26,
  }));
  failAfterRawPair = true;
  assert.throws(
    () => context.executeShiftCommit_(secondPlan, context.createShiftSheetAdapter_(secondPlan)),
    /Shift was not saved.*raw-pair write-then-throw failure/,
  );
  assert.deepEqual(plain({ tables, lastRows }), stableAfterSuccess,
    "the real adapter must remove both raw rows, the source row, and the batch increment after a write-then-throw failure");

  failAfterRawPair = false;
  tables["Raw Transactions"].push({
    _row: 49, Raw_Record_ID: "RAW-EXTERNAL-000001", Import_Batch_ID: "BATCH-EXTERNAL",
  });
  lastRows["Raw Transactions"] = 49;
  const stableWithExternalRow = plain({ tables, lastRows });
  assert.throws(
    () => context.executeShiftCommit_(secondPlan, context.createShiftSheetAdapter_(secondPlan)),
    /Shift was not saved.*Raw Transactions changed before commit.*Expected row 49, found 50/,
  );
  assert.deepEqual(plain({ tables, lastRows }), stableWithExternalRow,
    "extent drift must roll back the shift attempt without removing the unrelated row that caused the abort");
}

function executorFixture({ failureStage = "", timing = "before", rollbackFailure = "" } = {}) {
  const context = freshContext();
  const state = { batchCount: 15, tip: [], raw: [], transactions: [] };
  const initial = plain(state);
  const plan = {
    shiftId: "SHIFT-000002",
    batch: { previousRecordCount: 15, nextRecordCount: 16 },
    rawRecordIds: ["RAW-SHIFT-000043", "RAW-SHIFT-000044"],
    transactionIds: ["TXN-SHIFT-000043", "TXN-SHIFT-000044"],
  };
  const events = [];
  function fail(stage, point) {
    if (failureStage === stage && timing === point) throw new Error(`simulated ${stage} ${point} failure`);
  }
  const adapter = {
    applyBatch() {
      events.push("apply-batch"); fail("batch", "before"); state.batchCount = 16; fail("batch", "after");
    },
    writeTipTracker() {
      events.push("write-tip"); fail("tip", "before"); state.tip.push(plan.shiftId); fail("tip", "after");
    },
    writeRawPair() {
      events.push("write-raw"); fail("raw", "before"); state.raw.push(...plan.rawRecordIds); fail("raw", "after");
    },
    writeTransactionPair() {
      events.push("write-transactions"); fail("transactions", "before");
      state.transactions.push(...plan.transactionIds); fail("transactions", "after");
    },
    verify() { events.push("verify"); fail("verify", "before"); },
    rollbackTransactionPair() {
      events.push("rollback-transactions");
      if (rollbackFailure === "transactions") throw new Error("simulated transaction recovery failure");
      state.transactions = [];
    },
    rollbackRawPair() { events.push("rollback-raw"); state.raw = []; },
    rollbackTipTracker() { events.push("rollback-tip"); state.tip = []; },
    rollbackBatch() { events.push("rollback-batch"); state.batchCount = 15; },
    verifyRollback() {
      events.push("verify-rollback");
      if (JSON.stringify(state) !== JSON.stringify(initial)) throw new Error("residual state remains");
    },
  };
  return { context, state, initial, plan, adapter, events };
}

{
  const fixture = executorFixture();
  fixture.context.executeShiftCommit_(fixture.plan, fixture.adapter);
  assert.deepEqual(fixture.state, {
    batchCount: 16,
    tip: ["SHIFT-000002"],
    raw: ["RAW-SHIFT-000043", "RAW-SHIFT-000044"],
    transactions: ["TXN-SHIFT-000043", "TXN-SHIFT-000044"],
  });
  assert.deepEqual(fixture.events, ["apply-batch", "write-tip", "write-raw", "write-transactions", "verify"]);
}

for (const [failureStage, timing] of [
  ["batch", "before"], ["batch", "after"],
  ["tip", "before"], ["tip", "after"],
  ["raw", "before"], ["raw", "after"],
  ["transactions", "before"], ["transactions", "after"],
  ["verify", "before"],
]) {
  const fixture = executorFixture({ failureStage, timing });
  assert.throws(
    () => fixture.context.executeShiftCommit_(fixture.plan, fixture.adapter),
    new RegExp(`Shift was not saved.*simulated ${failureStage} ${timing} failure`),
  );
  assert.deepEqual(fixture.state, fixture.initial, `${failureStage}/${timing} must restore the complete source and ledger state`);
  assert.deepEqual(fixture.events.slice(-2), ["rollback-batch", "verify-rollback"]);
}

{
  const fixture = executorFixture({ failureStage: "transactions", timing: "after", rollbackFailure: "transactions" });
  assert.throws(
    () => fixture.context.executeShiftCommit_(fixture.plan, fixture.adapter),
    /CRITICAL: Add Shift failed and automatic recovery was incomplete.*Do not retry/,
  );
  assert.deepEqual(fixture.state.raw, []);
  assert.deepEqual(fixture.state.tip, []);
  assert.equal(fixture.state.batchCount, 15);
  assert.equal(fixture.state.transactions.length, 2, "the critical error must correspond to unrecovered rows");
}

{
  const context = freshContext();
  const categoryRows = [
    { Record_Type: "Subcategory", Parent_Category_ID: "INCOME", Active_Flag: "Yes", Category_Name: "Wages", Category_ID: "SUB-INCOME-WAGES" },
    { Record_Type: "Subcategory", Parent_Category_ID: "INCOME", Active_Flag: "Yes", Category_Name: "Tips", Category_ID: "SUB-INCOME-TIPS" },
  ];
  const snapshot = JSON.stringify({ version: "v1-cent-rounded", ...settings });
  const shiftDate = vm.runInContext('new Date("2026-08-19T04:00:00.000Z")', context);
  const tipRows = [{
    _row: 25, "Shift ID": "SHIFT-000002", Member: "MEM-JONATHAN", Wages: 70.4,
    "Net Tips": 78, Date: shiftDate, "Calculation Settings": snapshot,
  }, { _row: 10, "Shift ID": "", Member: "MEM-JONATHAN" }];
  const raw = [
    { Raw_Record_ID: "RAW-SHIFT-000043", Source_Transaction_ID: "SHIFT-000002", Raw_Transaction_Date: shiftDate, Raw_Type: "Income", Raw_Category: "Wages", Raw_Amount: 70.4, Account_ID: "ACC-CHEQUING", Raw_Currency: "CAD" },
    { Raw_Record_ID: "RAW-SHIFT-000044", Source_Transaction_ID: "SHIFT-000002", Raw_Transaction_Date: shiftDate, Raw_Type: "Income", Raw_Category: "Tips", Raw_Amount: 78, Account_ID: "ACC-CHEQUING", Raw_Currency: "CAD" },
  ];
  const transactions = [
    { Transaction_ID: "TXN-SHIFT-000043", Raw_Record_ID: "RAW-SHIFT-000043", Source_Transaction_ID: "SHIFT-000002", Transaction_Date: shiftDate, Transaction_Type: "Income", Amount: 70.4, Account_ID: "ACC-CHEQUING", Member_ID: "MEM-JONATHAN", Currency: "CAD", Effective_Subcategory_ID: "SUB-INCOME-WAGES" },
    { Transaction_ID: "TXN-SHIFT-000044", Raw_Record_ID: "RAW-SHIFT-000044", Source_Transaction_ID: "SHIFT-000002", Transaction_Date: shiftDate, Transaction_Type: "Income", Amount: 78, Account_ID: "ACC-CHEQUING", Member_ID: "MEM-JONATHAN", Currency: "CAD", Effective_Subcategory_ID: "SUB-INCOME-TIPS" },
  ];
  assert.deepEqual(plain(context.calcShiftLinkHealthFindings_(tipRows, raw, transactions, categoryRows)), [],
    "legacy blank-ID rows must remain valid while new stable links cross-reference cleanly");

  const drifted = plain(context.calcShiftLinkHealthFindings_(tipRows, raw, [
    { ...transactions[0], Amount: 99 }, transactions[1],
  ], categoryRows));
  assert.match(drifted.map((finding) => finding.msg).join("\n"), /Wages amount does not agree/);
  const orphaned = plain(context.calcShiftLinkHealthFindings_(tipRows, [
    ...raw, { Source_Transaction_ID: "SHIFT-999999", Raw_Record_ID: "RAW-ORPHAN" },
  ], transactions, categoryRows));
  assert.match(orphaned.map((finding) => finding.msg).join("\n"), /SHIFT-999999.*no Tip Tracker source row/);
}

{
  const context = freshContext();
  const events = [];
  const input = normalizedShiftInput(context);
  const plan = {
    shiftId: "SHIFT-000002", transactionIds: ["TXN-1", "TXN-2"], rawRecordIds: ["RAW-1", "RAW-2"], input,
  };
  let validationCount = 0;
  context.getTipTrackerSettings_ = () => { events.push("settings"); return settings; };
  context.getShiftReferenceData_ = () => { events.push("references"); return referenceData; };
  context.validateAndNormalizeShiftInput_ = () => { validationCount += 1; events.push(`validate-${validationCount}`); return input; };
  context.parseShiftDate_ = () => { events.push("parse"); return "TORONTO_DATE"; };
  context.readShiftCommitState_ = () => { events.push("state"); return commitState(); };
  context.planShiftCommit_ = () => { events.push("plan"); return plan; };
  context.createShiftSheetAdapter_ = () => { events.push("adapter"); return {}; };
  context.executeShiftCommit_ = () => { events.push("execute"); };
  context.recomputePotentialDuplicateFlags_ = () => { events.push("duplicates"); };
  context.recomputeBudgetSummaryMetrics_ = () => { events.push("summary"); };
  context.logChange_ = () => { events.push("log"); };
  context.LockService = { getDocumentLock: () => ({
    tryLock(timeout) { events.push(`lock-${timeout}`); return true; },
    releaseLock() { events.push("release"); },
  }) };

  const result = plain(context.addShift(validForm(context)));
  assert.equal(result.ok, true);
  assert.deepEqual(events, [
    "settings", "references", "validate-1", "parse", "lock-10000",
    "settings", "references", "validate-2", "parse", "state", "plan", "adapter", "execute",
    "release", "duplicates", "summary", "log",
  ], "posting must revalidate, calculate, plan, and commit under one lock before follow-up work");
}

{
  const context = freshContext();
  let stateReads = 0;
  context.getTipTrackerSettings_ = () => settings;
  context.getShiftReferenceData_ = () => referenceData;
  context.Utilities = {
    parseDate: () => vm.runInContext('new Date("2026-08-19T04:00:00.000Z")', context),
    formatDate: () => "2026-08-19",
  };
  context.readShiftCommitState_ = () => { stateReads += 1; };
  assert.throws(() => context.addShift(validForm(context, { hours: "0" })), /Hours worked must be greater than zero/);
  assert.equal(stateReads, 0, "invalid input must not read commit state or reach a write boundary");
}

{
  const context = freshContext();
  const events = [];
  const changedSettings = { ...settings, hourlyRate: 18 };
  let settingsReads = 0;
  context.getTipTrackerSettings_ = () => (++settingsReads === 1 ? settings : changedSettings);
  context.getShiftReferenceData_ = () => referenceData;
  context.Utilities = {
    parseDate: () => vm.runInContext('new Date("2026-08-19T04:00:00.000Z")', context),
    formatDate: () => "2026-08-19",
  };
  context.readShiftCommitState_ = () => { events.push("state"); };
  context.LockService = { getDocumentLock: () => ({ tryLock: () => true, releaseLock: () => { events.push("release"); } }) };
  const result = plain(context.addShift(validForm(context)));
  assert.equal(result.settingsChanged, true);
  assert.equal(result.preview.calculation.wages, 72);
  assert.deepEqual(events, ["release"], "settings drift must release the lock without reading state or writing");
}

{
  const context = freshContext();
  const events = [];
  context.getTipTrackerSettings_ = () => settings;
  context.getShiftReferenceData_ = () => referenceData;
  context.validateAndNormalizeShiftInput_ = () => normalizedShiftInput(context);
  context.parseShiftDate_ = () => "DATE";
  context.readShiftCommitState_ = () => ({
    ...commitState(),
    tipTrackerRows: [{ Date: vm.runInContext('new Date("2026-08-19T04:00:00.000Z")', context), Member: "MEM-JONATHAN" }],
  });
  context.Utilities = { formatDate: () => "2026-08-19" };
  context.planShiftCommit_ = () => { events.push("plan"); };
  context.LockService = { getDocumentLock: () => ({ tryLock: () => true, releaseLock: () => { events.push("release"); } }) };
  const result = plain(context.addShift(validForm(context)));
  assert.equal(result.duplicate, true);
  assert.deepEqual(events, ["release"], "an unconfirmed same-member same-date shift must warn without planning or writing");
}

{
  const context = freshContext();
  const events = [];
  const input = normalizedShiftInput(context);
  const plan = { shiftId: "SHIFT-000002", transactionIds: ["TXN-1", "TXN-2"], rawRecordIds: ["RAW-1", "RAW-2"], input };
  context.getTipTrackerSettings_ = () => settings;
  context.getShiftReferenceData_ = () => referenceData;
  context.validateAndNormalizeShiftInput_ = () => input;
  context.parseShiftDate_ = () => "DATE";
  context.readShiftCommitState_ = () => commitState();
  context.planShiftCommit_ = () => plan;
  context.createShiftSheetAdapter_ = () => ({});
  context.executeShiftCommit_ = () => {};
  context.recomputePotentialDuplicateFlags_ = () => { throw new Error("duplicate refresh unavailable"); };
  context.recomputeBudgetSummaryMetrics_ = () => { throw new Error("summary unavailable"); };
  context.logChange_ = () => { throw new Error("log unavailable"); };
  context.LockService = { getDocumentLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
  const result = plain(context.addShift(validForm(context)));
  assert.equal(result.ok, true, "post-commit follow-up failures must not invite duplicate resubmission");
  assert.deepEqual(result.warnings, [
    "duplicate flags need a manual refresh",
    "budget summary needs a manual refresh",
    "Change Log needs a manual entry",
  ]);
  assert.match(result.message, /Saved successfully/);
}

for (const [functionName, nextFunction] of [
  ["calcShiftAmounts_", "function validateShiftDateKey_"],
  ["planShiftCommit_", "function shiftErrorMessage_"],
  ["executeShiftCommit_", "function shiftSettingsChangedResult_"],
]) {
  const start = shiftSource.indexOf(`function ${functionName}(`);
  const end = shiftSource.indexOf(nextFunction, start);
  assert.ok(start >= 0 && end > start, `${functionName} must be discoverable for portability checks`);
  assert.doesNotMatch(
    shiftSource.slice(start, end),
    /SpreadsheetApp|sheet_|readTable_|LockService/,
    `${functionName} must remain independent of Spreadsheet services and locks`,
  );
}

assert.match(dialogSource, /<meta name="viewport"/);
assert.match(dialogSource, /@media \(max-width: 430px\)/);
assert.match(dialogSource, /\.getShiftPreview\(calculationFields\(\)\)/);
assert.match(dialogSource, /settingsFingerprint/);
assert.doesNotMatch(dialogSource, /sales\s*\*\s*SETTINGS|floorPct\s*\/\s*100|Math\.ceil\(barRaw/,
  "the browser must display server-calculated values rather than duplicate financial rules");
assert.doesNotMatch(shiftSource, /function postShiftTransaction_|function getOrCreateShiftBatch_/);
assert.match(shiftSource, /function addShift\(form\)[\s\S]*?tryLock\(SHIFT_LOCK_TIMEOUT_MS_\)[\s\S]*?readShiftCommitState_\(\)[\s\S]*?executeShiftCommit_\([\s\S]*?releaseLock\(\)[\s\S]*?recomputePotentialDuplicateFlags_/);

console.log("Shift workflow tests passed: shared settings-driven math, strict validation, stable linked IDs, four-stage rollback, drift/duplicate guards, mobile UI wiring, and health checks.");
