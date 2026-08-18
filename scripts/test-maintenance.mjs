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

console.log("Maintenance tests passed: v0.0.24 exact migration plus v0.0.25 exact 14-cell plan, formula preservation, idempotence, rollback, and safety aborts.");
