import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import vm from "node:vm";

const codeSource = readFileSync("Code.gs", "utf8");
const context = vm.createContext({ console });
vm.runInContext(codeSource, context, { filename: "Code.gs" });

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

{
  const result = plain(context.calcPotentialDuplicateFlags_([
    "alpha", "ALPHA", "", null, "beta", "beta", "gamma", "__proto__", "__PROTO__",
  ]));
  assert.deepEqual(result, {
    flags: ["Yes", "Yes", "", "", "Yes", "Yes", "No", "Yes", "Yes"],
    duplicateKeyCount: 3,
    duplicateRowCount: 6,
  });
}

{
  const keys = Array.from({ length: 6_001 }, (_, index) => `key-${index}`);
  keys[5_000] = keys[0];
  const result = plain(context.calcPotentialDuplicateFlags_(keys));
  assert.equal(result.flags[0], "Yes", "the first occurrence must be flagged");
  assert.equal(result.flags[5_000], "Yes", "a duplicate at row-equivalent 5,005 must be detected");
  assert.equal(result.duplicateKeyCount, 1);
  assert.equal(result.duplicateRowCount, 2);
}

{
  const rowCount = 12_000;
  const keys = Array.from({ length: rowCount }, (_, index) => `scale-key-${index}`);
  keys[11_999] = keys[1];
  let writtenValues = null;
  let readCalls = 0;
  let writeCalls = 0;
  let flushCalls = 0;

  const sheet = {
    getLastRow: () => rowCount + 4,
    getRange(row, column, rows, columns) {
      assert.equal(row, 5);
      assert.equal(rows, rowCount);
      assert.equal(columns, 1);
      if (column === 25) {
        readCalls += 1;
        return { getValues: () => keys.map((key) => [key]) };
      }
      if (column === 26) {
        return {
          setValues(values) {
            writeCalls += 1;
            writtenValues = values;
          },
        };
      }
      throw new Error(`Unexpected Transactions column ${column}`);
    },
  };

  context.SpreadsheetApp = { flush: () => { flushCalls += 1; } };
  context.sheet_ = (name) => {
    assert.equal(name, "Transactions");
    return sheet;
  };
  context.col_ = (sheetName, headerName) => {
    assert.equal(sheetName, "Transactions");
    if (headerName === "Duplicate_Key") return 25;
    if (headerName === "Potential_Duplicate_Flag") return 26;
    throw new Error(`Unexpected header ${headerName}`);
  };

  const start = performance.now();
  const result = plain(context.recomputePotentialDuplicateFlags_());
  const elapsedMs = performance.now() - start;

  assert.equal(flushCalls, 1);
  assert.equal(readCalls, 1, "scale must use one Duplicate_Key column read");
  assert.equal(writeCalls, 1, "scale must use one Potential_Duplicate_Flag column write");
  assert.equal(writtenValues.length, rowCount);
  assert.equal(writtenValues[1][0], "Yes");
  assert.equal(writtenValues[11_999][0], "Yes");
  assert.deepEqual(result, {
    scannedRows: rowCount,
    duplicateKeyCount: 1,
    duplicateRowCount: 2,
  });
  assert.ok(elapsedMs < 2_000, `12,000-row compute and adapter simulation took ${elapsedMs.toFixed(1)} ms`);
  console.log(`Duplicate scale fixture: ${rowCount.toLocaleString()} rows in ${elapsedMs.toFixed(1)} ms, one read and one write.`);
}

{
  const duplicateInputColumns = {
    Transaction_Date: 6,
    Amount: 8,
    Account_ID: 4,
    Transaction_Type: 7,
    Original_Description: 10,
    Duplicate_Key: 25,
    Potential_Duplicate_Flag: 26,
  };
  let recomputeCalls = 0;
  context.col_ = (sheetName, headerName) => {
    assert.equal(sheetName, "Transactions");
    return duplicateInputColumns[headerName];
  };
  context.recomputePotentialDuplicateFlags_ = () => { recomputeCalls += 1; };
  const editEvent = ({ sheetName = "Transactions", row = 5, column = 6, rows = 1, columns = 1 } = {}) => ({
    range: {
      getSheet: () => ({ getName: () => sheetName }),
      getRow: () => row,
      getNumRows: () => rows,
      getColumn: () => column,
      getNumColumns: () => columns,
    },
  });

  context.onEdit(editEvent({ sheetName: "Budget" }));
  context.onEdit(editEvent({ row: 4 }));
  context.onEdit(editEvent({ column: 5 }));
  assert.equal(recomputeCalls, 0, "unrelated edits must not scan the ledger");
  context.onEdit(editEvent({ column: 6 }));
  context.onEdit(editEvent({ column: 24, columns: 3 }));
  assert.equal(recomputeCalls, 2, "duplicate-key inputs and pasted ranges spanning them must refresh flags");
}

assert.equal(codeSource.includes("$5000"), false, "Code.gs must not retain a row-5,000 formula boundary");
assert.match(
  codeSource,
  /function addTransaction\(form\)[\s\S]*?recomputePotentialDuplicateFlags_\(\);[\s\S]*?return \{ ok: true/,
  "Add Transaction must refresh the full-ledger flags",
);
assert.match(
  codeSource,
  /function addShift\(form\)[\s\S]*?recomputePotentialDuplicateFlags_\(\);[\s\S]*?return \{ ok: true/,
  "Add Shift must refresh the full-ledger flags once after posting both transactions",
);

console.log("Duplicate flag tests passed: exact matching, beyond-row-5,000 coverage, full-ledger wiring, and 12,000-row linear batch behavior.");
