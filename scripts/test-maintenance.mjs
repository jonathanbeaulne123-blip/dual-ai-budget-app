import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const codeSource = readFileSync("Code.gs", "utf8");
const maintenanceSource = readFileSync("Maintenance.gs", "utf8");

function columnName(column) {
  let result = "";
  while (column > 0) {
    const remainder = (column - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    column = Math.floor((column - 1) / 26);
  }
  return result;
}

function columnNumber(name) {
  return [...name].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0);
}

class MockRange {
  constructor(sheet, row, column, rowCount = 1, columnCount = 1) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rowCount = rowCount;
    this.columnCount = columnCount;
  }

  getValues() {
    return Array.from({ length: this.rowCount }, (_, rowOffset) =>
      Array.from({ length: this.columnCount }, (_, columnOffset) =>
        this.sheet.valueAt(this.row + rowOffset, this.column + columnOffset)),
    );
  }

  getValue() {
    return this.sheet.valueAt(this.row, this.column);
  }

  getFormula() {
    return this.sheet.formulaAt(this.row, this.column);
  }

  setValue(value) {
    const a1 = this.getA1Notation();
    if (this.sheet.failOnSet === a1) {
      throw new Error(`Injected write failure at ${this.sheet.name}!${a1}`);
    }
    this.sheet.setValueAt(this.row, this.column, value);
    if (typeof this.sheet.afterSet === "function") {
      this.sheet.afterSet({ a1, row: this.row, column: this.column, value });
    }
    if (this.sheet.failAfterSet === a1) {
      this.sheet.failAfterSet = "";
      throw new Error(`Injected post-write failure at ${this.sheet.name}!${a1}`);
    }
    return this;
  }

  getA1Notation() {
    const start = `${columnName(this.column)}${this.row}`;
    if (this.rowCount === 1 && this.columnCount === 1) return start;
    return `${start}:${columnName(this.column + this.columnCount - 1)}${this.row + this.rowCount - 1}`;
  }
}

class MockSheet {
  constructor(name, headers, rowRecords) {
    this.name = name;
    this.headers = [...headers];
    this.failOnSet = "";
    this.failAfterSet = "";
    this.afterSet = null;
    this.rows = Array.from({ length: 80 }, () => Array(headers.length).fill(""));
    this.formulas = Array.from({ length: 80 }, () => Array(headers.length).fill(""));
    this.rows[3] = [...headers];
    rowRecords.forEach(({ row, values, formulas = {} }) => {
      Object.entries(values).forEach(([header, value]) => {
        const column = headers.indexOf(header);
        if (column < 0) throw new Error(`Test fixture header not found: ${name}.${header}`);
        this.rows[row - 1][column] = value;
      });
      Object.entries(formulas).forEach(([header, formula]) => {
        const column = headers.indexOf(header);
        if (column < 0) throw new Error(`Test fixture formula header not found: ${name}.${header}`);
        this.formulas[row - 1][column] = formula;
      });
    });
  }

  valueAt(row, column) {
    return this.rows[row - 1]?.[column - 1] ?? "";
  }

  formulaAt(row, column) {
    return this.formulas[row - 1]?.[column - 1] ?? "";
  }

  setValueAt(row, column, value) {
    while (this.rows.length < row) this.rows.push([]);
    while (this.rows[row - 1].length < column) this.rows[row - 1].push("");
    this.rows[row - 1][column - 1] = value;
    const manualColumn = this.headers.indexOf("Manual_Category_ID") + 1;
    const effectiveColumn = this.headers.indexOf("Effective_Category_ID") + 1;
    if (this.name === "Transactions" && column === manualColumn && effectiveColumn > 0 &&
        this.formulaAt(row, effectiveColumn)) {
      this.rows[row - 1][effectiveColumn - 1] = value;
    }
  }

  getLastRow() {
    for (let row = this.rows.length; row > 0; row -= 1) {
      if (this.rows[row - 1].some((value) => value !== "" && value !== null)) return row;
    }
    return 0;
  }

  getLastColumn() {
    return this.rows[3].length;
  }

  getRange(rowOrA1, column, rowCount = 1, columnCount = 1) {
    if (typeof rowOrA1 === "string") {
      const match = /^([A-Z]+)(\d+)$/.exec(rowOrA1);
      if (!match) throw new Error(`Unsupported A1 notation in mock: ${rowOrA1}`);
      return new MockRange(this, Number(match[2]), columnNumber(match[1]));
    }
    return new MockRange(this, rowOrA1, column, rowCount, columnCount);
  }
}

function buildFixture() {
  const categoryHeaders = [
    "Category_ID", "Parent_Category_ID", "Record_Type", "Category_Name",
    "Transaction_Type", "Essential_Default", "Income_Stability_Default",
    "Active_Flag", "Legacy_Budget_Label", "Sort_Order",
  ];
  const categoryRecords = [
    [18, "SUB-HOUSING-RENT", "HOUSING"],
    [19, "SUB-HOUSING-GAS", "HOUSING"],
    [20, "SUB-HOUSING-ELECTRIC", "HOUSING"],
    [21, "SUB-FOOD-GROCERIES", "FOOD"],
    [22, "SUB-TRANSPORT-PRIVATE", "TRANSPORT"],
    [23, "SUB-TRANSPORT-PUBLIC", "TRANSPORT"],
    [24, "SUB-TRANSPORT-FUEL", "TRANSPORT"],
  ].map(([row, id, parent]) => ({
    row,
    values: { Category_ID: id, Parent_Category_ID: parent, Active_Flag: "Yes" },
  }));
  categoryRecords.push({
    row: 34,
    values: { Category_ID: "SUB-CAT-CAT-LITTER-2", Parent_Category_ID: "CAT-CAT", Active_Flag: "Yes" },
  });

  const transactionHeaders = Array(31).fill("");
  transactionHeaders[0] = "Transaction_ID";
  transactionHeaders[16] = "Manual_Category_ID"; // Q
  transactionHeaders[18] = "Effective_Category_ID"; // S
  const transactionRecords = [
    [5, "TXN-MANUAL-000001"],
    [32, "TXN-MANUAL-000028"],
    [36, "TXN-MANUAL-000032"],
    [37, "TXN-MANUAL-000033"],
  ].map(([row, id]) => ({
    row,
    values: { Transaction_ID: id, Manual_Category_ID: "HOUSING", Effective_Category_ID: "HOUSING" },
  }));
  for (let number = 6; number <= 19; number += 1) {
    const row = number + 4;
    const id = `TXN-SHIFT-${String(number).padStart(6, "0")}`;
    transactionRecords.push({
      row,
      values: { Transaction_ID: id, Manual_Category_ID: "CAT-INCOME", Effective_Category_ID: "CAT-INCOME" },
      formulas: { Effective_Category_ID: `=IF(Q${row}<>"",Q${row},N${row})` },
    });
  }

  const budgetHeaders = Array(11).fill("");
  budgetHeaders[0] = "Budget_ID";
  budgetHeaders[5] = "Subcategory_ID"; // F
  const budgetRecords = [{
    row: 54,
    values: { Budget_ID: "BUD-202601-034", Subcategory_ID: "SUB-CAT-CAT-LITTER-2" },
  }];

  return {
    Categories: new MockSheet("Categories", categoryHeaders, categoryRecords),
    Transactions: new MockSheet("Transactions", transactionHeaders, transactionRecords),
    "Budget Plan": new MockSheet("Budget Plan", budgetHeaders, budgetRecords),
  };
}

function createHarness({ appVersion = "v0.0.25", timezone = "America/Toronto" } = {}) {
  const sheets = buildFixture();
  const spreadsheet = {
    name: "devCopy of Budget_App__v 0.23",
    timezone,
    getName() { return this.name; },
    getSpreadsheetTimeZone() { return this.timezone; },
    setSpreadsheetTimeZone(value) { this.timezone = value; },
    getSheetByName(name) { return sheets[name] ?? null; },
  };
  const context = vm.createContext({
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      flush: () => {},
    },
    Session: { getScriptTimeZone: () => "America/Toronto" },
  });
  vm.runInContext(codeSource, context, { filename: "Code.gs" });
  vm.runInContext(maintenanceSource, context, { filename: "Maintenance.gs" });
  context.APP_VERSION = appVersion;
  return { context, spreadsheet, sheets };
}

const expectedCells = [
  "Categories!B18", "Categories!B19", "Categories!B20", "Categories!B21",
  "Categories!B22", "Categories!B23", "Categories!B24", "Categories!H34",
  "Transactions!Q5", "Transactions!Q32", "Transactions!Q36", "Transactions!Q37",
  "Budget Plan!F54",
];

{
  const { context, spreadsheet } = createHarness({ appVersion: "v0.0.24", timezone: "America/Los_Angeles" });
  assert.equal(context.isDataIntegrityV0024DevSpreadsheet_(), true);
  assert.equal(context.isLegacyIncomeV0025DevSpreadsheet_(), false);
  const plan = context.buildDataIntegrityV0024Plan_();
  assert.equal(plan.cellChanges.length, 13);
  assert.equal(plan.cellChanges.filter((change) => change.state === "pending").length, 13);
  assert.deepEqual(
    Array.from(plan.cellChanges, (change) => `${change.sheet}!${change.a1}`),
    expectedCells,
  );
  assert.equal(plan.timezone.currentValue, "America/Los_Angeles");
  assert.equal(plan.timezone.newValue, "America/Toronto");

  const result = context.applyDataIntegrityV0024Plan_(plan);
  assert.deepEqual({ ...result }, { changedCells: 13, changedTimezone: true });
  assert.equal(spreadsheet.timezone, "America/Toronto");
  const finalPlan = context.buildDataIntegrityV0024Plan_();
  assert.equal(finalPlan.cellChanges.filter((change) => change.state === "already-applied").length, 13);
  assert.equal(finalPlan.timezone.state, "already-applied");
  assert.deepEqual(
    { ...context.applyDataIntegrityV0024Plan_(finalPlan) },
    { changedCells: 0, changedTimezone: false },
  );
}

{
  const { context, spreadsheet, sheets } = createHarness({ appVersion: "v0.0.24", timezone: "America/Los_Angeles" });
  const plan = context.buildDataIntegrityV0024Plan_();
  sheets.Categories.failOnSet = "B21";
  assert.throws(
    () => context.applyDataIntegrityV0024Plan_(plan),
    /Injected write failure at Categories!B21.*rolled back/,
  );
  assert.equal(spreadsheet.timezone, "America/Los_Angeles");
  sheets.Categories.failOnSet = "";
  const afterRollback = context.buildDataIntegrityV0024Plan_();
  assert.equal(afterRollback.cellChanges.filter((change) => change.state === "pending").length, 13);
}

{
  const { context, sheets } = createHarness({ appVersion: "v0.0.24", timezone: "America/Los_Angeles" });
  sheets.Categories.getRange("B18").setValue("CAT-UNEXPECTED");
  assert.throws(
    () => context.buildDataIntegrityV0024Plan_(),
    /unexpected Parent_Category_ID value.*CAT-UNEXPECTED/,
  );
}

const expectedLegacyIncomeDirectCells = Array.from({ length: 14 }, (_, index) => `Transactions!Q${index + 10}`);
const expectedLegacyIncomeDerivedCells = Array.from({ length: 14 }, (_, index) => `Transactions!S${index + 10}`);

{
  const { context, sheets } = createHarness();
  assert.equal(context.isLegacyIncomeV0025DevSpreadsheet_(), true);
  assert.equal(context.isDataIntegrityV0024DevSpreadsheet_(), false);
  const plan = context.buildLegacyIncomeV0025Plan_();
  assert.equal(plan.directChanges.length, 14);
  assert.equal(plan.derivedCells.length, 14);
  assert.equal(plan.directChanges.filter((change) => change.state === "pending").length, 14);
  assert.deepEqual(
    Array.from(plan.directChanges, (change) => `${change.sheet}!${change.a1}`),
    expectedLegacyIncomeDirectCells,
  );
  assert.deepEqual(
    Array.from(plan.derivedCells, (cell) => `${cell.sheet}!${cell.a1}`),
    expectedLegacyIncomeDerivedCells,
  );

  const originalFormulas = Array.from(plan.derivedCells, (cell) => cell.formula);
  assert.deepEqual(
    { ...context.applyLegacyIncomeV0025Plan_(plan) },
    { changedCells: 14, verifiedFormulaCells: 14 },
  );
  assert.deepEqual(
    Array.from({ length: 14 }, (_, index) => sheets.Transactions.getRange(`Q${index + 10}`).getValue()),
    Array(14).fill("INCOME"),
  );
  assert.deepEqual(
    Array.from({ length: 14 }, (_, index) => sheets.Transactions.getRange(`S${index + 10}`).getValue()),
    Array(14).fill("INCOME"),
  );
  assert.deepEqual(
    Array.from({ length: 14 }, (_, index) => sheets.Transactions.getRange(`S${index + 10}`).getFormula()),
    originalFormulas,
  );

  const finalPlan = context.buildLegacyIncomeV0025Plan_();
  assert.equal(finalPlan.directChanges.filter((change) => change.state === "already-applied").length, 14);
  assert.deepEqual(
    { ...context.applyLegacyIncomeV0025Plan_(finalPlan) },
    { changedCells: 0, verifiedFormulaCells: 14 },
  );
}

{
  const { context } = createHarness({ timezone: "America/Los_Angeles" });
  assert.throws(
    () => context.buildLegacyIncomeV0025Plan_(),
    /spreadsheet timezone must already be America\/Toronto/,
  );
}

{
  const { context, sheets } = createHarness();
  const plan = context.buildLegacyIncomeV0025Plan_();
  sheets.Transactions.failOnSet = "Q16";
  assert.throws(
    () => context.applyLegacyIncomeV0025Plan_(plan),
    /Injected write failure at Transactions!Q16.*rolled back/,
  );
  sheets.Transactions.failOnSet = "";
  const afterRollback = context.buildLegacyIncomeV0025Plan_();
  assert.equal(afterRollback.directChanges.filter((change) => change.state === "pending").length, 14);
  assert.deepEqual(
    Array.from(afterRollback.derivedCells, (cell) => cell.currentValue),
    Array(14).fill("CAT-INCOME"),
  );
}

{
  const { context, sheets } = createHarness();
  sheets.Transactions.formulas[9][18] = "";
  assert.throws(
    () => context.buildLegacyIncomeV0025Plan_(),
    /Transactions!S10.*has no Effective_Category_ID formula/,
  );
}

{
  const { context, sheets } = createHarness();
  sheets.Transactions.formulas[9][18] = '=IF(Q11<>"",Q11,N10)';
  assert.throws(
    () => context.buildLegacyIncomeV0025Plan_(),
    /Transactions!S10.*does not reference.*Q10/,
  );
}

function buildCurrencyFixture() {
  const accounts = new MockSheet("Accounts", [
    "Account_ID", "Account_Name", "Institution", "Account_Type", "Owner_Member_ID", "Currency",
    "External_Account_ID", "Last_Four", "Active_Flag", "Opened_Date", "Closed_Date", "Notes",
  ], [{
    row: 5,
    values: {
      Account_ID: "ACC-LEGACY-001",
      Account_Name: "Legacy / Unassigned Account",
      Account_Type: "Other",
      Currency: "USD",
      Active_Flag: "Yes",
      Notes: "fixture account",
    },
  }]);
  const raw = new MockSheet("Raw Transactions", [
    "Raw_Record_ID", "Import_Batch_ID", "Source_System", "Source_File", "Source_Row_Number", "Account_ID",
    "Imported_At", "Source_Transaction_ID", "Raw_Transaction_Date", "Raw_Posted_Date", "Raw_Type",
    "Raw_Category", "Raw_Description", "Raw_Merchant", "Raw_Amount", "Raw_Currency", "Raw_Debit_Credit",
    "Raw_Notes", "Raw_Payload", "Normalization_Status",
  ], [
    { row: 5, values: { Raw_Record_ID: "RAW-MANUAL-000001", Account_ID: "ACC-LEGACY-001", Raw_Transaction_Date: "2026-08-18", Raw_Amount: 12.3, Raw_Currency: "USD" } },
    { row: 6, values: { Raw_Record_ID: "RAW-MANUAL-000002", Account_ID: "ACC-LEGACY-001", Raw_Transaction_Date: "2026-08-19", Raw_Amount: 4.56, Raw_Currency: "CAD" } },
  ]);
  const transactions = new MockSheet("Transactions", [
    "Transaction_ID", "Raw_Record_ID", "Import_Batch_ID", "Account_ID", "Member_ID", "Transaction_Date",
    "Posted_Date", "Transaction_Type", "Amount", "Currency", "Original_Description", "Normalized_Merchant",
    "Income_Stability", "Auto_Category_ID", "Auto_Subcategory_ID", "Auto_Category_Confidence",
    "Manual_Category_ID", "Manual_Subcategory_ID", "Effective_Category_ID", "Effective_Subcategory_ID",
    "Reviewed_Flag", "Review_Status", "Duplicate_Key", "Potential_Duplicate_Flag", "Is_Duplicate",
    "Duplicate_Of_Transaction_ID", "Recurring_Transaction_ID", "Source_Transaction_ID", "User_Notes",
    "Created_At", "Updated_At",
  ], [
    { row: 5, values: { Transaction_ID: "TXN-MANUAL-000001", Raw_Record_ID: "RAW-MANUAL-000001", Account_ID: "ACC-LEGACY-001", Transaction_Date: "2026-08-18", Transaction_Type: "Expense", Amount: 12.3, Currency: "USD" } },
    { row: 6, values: { Transaction_ID: "TXN-MANUAL-000002", Raw_Record_ID: "RAW-MANUAL-000002", Account_ID: "ACC-LEGACY-001", Transaction_Date: "2026-08-19", Transaction_Type: "Expense", Amount: 4.56, Currency: "CAD" } },
  ]);
  return { Accounts: accounts, "Raw Transactions": raw, Transactions: transactions };
}

function createCurrencyHarness({ timezone = "America/Toronto", spreadsheetName = "devCopy of Budget_App__v 0.23" } = {}) {
  const sheets = buildCurrencyFixture();
  const spreadsheet = {
    name: spreadsheetName,
    timezone,
    getName() { return this.name; },
    getSpreadsheetTimeZone() { return this.timezone; },
    getSheetByName(name) { return sheets[name] ?? null; },
  };
  const context = vm.createContext({
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      flush: () => {},
    },
    Session: { getScriptTimeZone: () => "America/Toronto" },
  });
  vm.runInContext(codeSource, context, { filename: "Code.gs" });
  vm.runInContext(maintenanceSource, context, { filename: "Maintenance.gs" });
  context.APP_VERSION = "v0.0.30";
  return { context, spreadsheet, sheets };
}

{
  const { context, sheets } = createCurrencyHarness();
  assert.equal(context.isCadCurrencyV0030DevSpreadsheet_(), true);
  assert.throws(() => context.getActiveAccount_(), /authoritative currency CAD/);
  const plan = context.buildCadCurrencyV0030Plan_();
  assert.equal(plan.changes.length, 5);
  assert.equal(plan.changes.filter((change) => change.state === "pending").length, 3);
  assert.deepEqual(
    Array.from(plan.changes, (change) => `${change.sheet}!${change.a1}`),
    ["Accounts!F5", "Raw Transactions!P5", "Raw Transactions!P6", "Transactions!J5", "Transactions!J6"],
  );
  const preview = context.formatCadCurrencyV0030Plan_(plan);
  assert.match(preview, /Raw_Record_ID=RAW-MANUAL-000001/);
  assert.match(preview, /Transaction_ID=TXN-MANUAL-000002/);
  assert.match(preview, /No amounts, dates, categories, owners, tips, wages, formulas, duplicate decisions, or financial calculations will change/);

  const protectedBefore = {
    raw1Amount: sheets["Raw Transactions"].getRange(5, 15).getValue(),
    raw2Date: sheets["Raw Transactions"].getRange(6, 9).getValue(),
    tx1Amount: sheets.Transactions.getRange(5, 9).getValue(),
    tx2Date: sheets.Transactions.getRange(6, 6).getValue(),
  };
  const applyResult = context.applyCadCurrencyV0030Plan_(plan);
  assert.deepEqual(
    { ...applyResult, changedBySheet: { ...applyResult.changedBySheet } },
    { changedCells: 3, changedBySheet: { Accounts: 1, "Raw Transactions": 1, Transactions: 1 }, verifiedCells: 5 },
  );
  assert.equal(sheets.Accounts.getRange("F5").getValue(), "CAD");
  assert.equal(sheets["Raw Transactions"].getRange("P5").getValue(), "CAD");
  assert.equal(sheets["Raw Transactions"].getRange("P6").getValue(), "CAD");
  assert.equal(sheets.Transactions.getRange("J5").getValue(), "CAD");
  assert.equal(sheets.Transactions.getRange("J6").getValue(), "CAD");
  assert.deepEqual({
    raw1Amount: sheets["Raw Transactions"].getRange(5, 15).getValue(),
    raw2Date: sheets["Raw Transactions"].getRange(6, 9).getValue(),
    tx1Amount: sheets.Transactions.getRange(5, 9).getValue(),
    tx2Date: sheets.Transactions.getRange(6, 6).getValue(),
  }, protectedBefore);
  assert.deepEqual({ ...context.getActiveAccount_() }, { id: "ACC-LEGACY-001", currency: "CAD" });
  const finalPlan = context.buildCadCurrencyV0030Plan_();
  assert.equal(finalPlan.changes.every((change) => change.state === "already-applied"), true);
  assert.deepEqual(
    { ...context.applyCadCurrencyV0030Plan_(finalPlan), changedBySheet: {} },
    { changedCells: 0, changedBySheet: {}, verifiedCells: 5 },
  );
}

{
  const { context, sheets } = createCurrencyHarness();
  const plan = context.buildCadCurrencyV0030Plan_();
  sheets.Transactions.failAfterSet = "J5";
  assert.throws(
    () => context.applyCadCurrencyV0030Plan_(plan),
    /Injected post-write failure at Transactions!J5.*All currency writes from this attempt were rolled back/,
  );
  assert.equal(sheets.Accounts.getRange("F5").getValue(), "USD");
  assert.equal(sheets["Raw Transactions"].getRange("P5").getValue(), "USD");
  assert.equal(sheets.Transactions.getRange("J5").getValue(), "USD");
}

{
  const { context, sheets } = createCurrencyHarness();
  const plan = context.buildCadCurrencyV0030Plan_();
  sheets["Raw Transactions"].afterSet = ({ a1 }) => {
    if (a1 === "P5") sheets.Transactions.setValueAt(5, 9, 999);
  };
  assert.throws(
    () => context.applyCadCurrencyV0030Plan_(plan),
    /Protected account or ledger data changed.*All currency writes from this attempt were rolled back/,
  );
  assert.equal(sheets.Accounts.getRange("F5").getValue(), "USD");
  assert.equal(sheets["Raw Transactions"].getRange("P5").getValue(), "USD");
  assert.equal(sheets.Transactions.getRange("J5").getValue(), "USD");
}

{
  const { context, sheets } = createCurrencyHarness();
  const plan = context.buildCadCurrencyV0030Plan_();
  let firstTransactionWrite = true;
  sheets.Transactions.afterSet = ({ a1 }) => {
    if (a1 === "J5" && firstTransactionWrite) {
      firstTransactionWrite = false;
      sheets.Transactions.failOnSet = "J5";
      throw new Error("Injected write-then-recovery failure");
    }
  };
  assert.throws(
    () => context.applyCadCurrencyV0030Plan_(plan),
    /CRITICAL: v0\.0\.30 currency correction failed.*Recovery could not be proven.*Do not retry/,
  );
}

{
  const { context, sheets } = createCurrencyHarness();
  sheets.Accounts.getRange("F5").setValue("EUR");
  assert.throws(() => context.buildCadCurrencyV0030Plan_(), /unsupported Currency "EUR"/);
}

{
  const { context, sheets } = createCurrencyHarness();
  sheets["Raw Transactions"].getRange("F5").setValue("ACC-UNKNOWN");
  assert.throws(() => context.buildCadCurrencyV0030Plan_(), /references unknown Account_ID "ACC-UNKNOWN"/);
}

{
  const { context, sheets } = createCurrencyHarness();
  sheets["Raw Transactions"].getRange("A6").setValue("RAW-MANUAL-000001");
  assert.throws(() => context.buildCadCurrencyV0030Plan_(), /Stable IDs must be unique/);
}

{
  const { context } = createCurrencyHarness({ timezone: "America/Los_Angeles" });
  assert.throws(() => context.buildCadCurrencyV0030Plan_(), /timezone must be America\/Toronto/);
}

{
  const { context } = createCurrencyHarness({ spreadsheetName: "Budget_App__v 0.23" });
  assert.equal(context.isCadCurrencyV0030DevSpreadsheet_(), false);
  assert.throws(() => context.buildCadCurrencyV0030Plan_(), /only in the development spreadsheet/);
}

{
  const context = createCurrencyHarness().context;
  const clean = JSON.parse(JSON.stringify(context.calcCurrencyHealthFindings_(
    [{ Account_ID: "ACC-1", Currency: "CAD" }],
    [{ Raw_Record_ID: "RAW-1", Account_ID: "ACC-1", Raw_Currency: "CAD" }],
    [{ Transaction_ID: "TXN-1", Account_ID: "ACC-1", Currency: "CAD" }],
  )));
  assert.deepEqual(clean, []);
  const findings = JSON.parse(JSON.stringify(context.calcCurrencyHealthFindings_(
    [{ Account_ID: "ACC-1", Currency: "CAD" }],
    [{ Raw_Record_ID: "RAW-USD", Account_ID: "ACC-1", Raw_Currency: "USD" }],
    [{ Transaction_ID: "TXN-EUR", Account_ID: "ACC-1", Currency: "EUR" }],
  )));
  assert.equal(findings.length, 4);
  assert.match(findings.map((finding) => finding.msg).join("\n"), /RAW-USD/);
  assert.match(findings.map((finding) => finding.msg).join("\n"), /TXN-EUR/);
}

{
  const { context, sheets } = createCurrencyHarness();
  sheets.Accounts.getRange("F5").setValue("CAD");
  sheets.Accounts.setValueAt(6, 1, "ACC-SECOND");
  sheets.Accounts.setValueAt(6, 6, "CAD");
  sheets.Accounts.setValueAt(6, 9, "Yes");
  assert.throws(() => context.getActiveAccount_(), /More than one active account/);
}

assert.doesNotMatch(codeSource, /Raw_Currency\s*:\s*['"]USD['"]/);
assert.doesNotMatch(codeSource, /\bCurrency\s*:\s*['"]USD['"]/);
assert.match(
  codeSource,
  /function addShift\(form\)[\s\S]*?getActiveAccount_\(\)[\s\S]*?getOrCreateTipTrackerSheet_\(\)/,
  "Add Shift must validate account-derived currency before any Tip Tracker creation/write helper",
);
assert.match(
  codeSource,
  /function postShiftTransaction_\([^)]*currency\)[\s\S]*?requireAuthoritativeCurrency_\(currency[\s\S]*?Raw_Currency:\s*currency[\s\S]*?Currency:\s*currency/,
  "Add Shift must validate and write the same account-derived CAD metadata to both record layers",
);

console.log("Maintenance tests passed: v0.0.24/v0.0.25 exact corrections plus v0.0.30 account-derived CAD migration, idempotence, protected-data verification, rollback, and safety aborts.");
