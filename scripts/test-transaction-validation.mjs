import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const codeSource = readFileSync("Code.gs", "utf8");
const context = vm.createContext({ console });
vm.runInContext(codeSource, context, { filename: "Code.gs" });

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const categories = [
  {
    subId: "SUB-FOOD-GROCERIES",
    subName: "Groceries",
    parentId: "CAT-FOOD",
    transactionType: "Expense",
    essentialDefault: "Yes",
    incomeStabilityDefault: "",
  },
  {
    subId: "SUB-INCOME-WAGES",
    subName: "Wages",
    parentId: "INCOME",
    transactionType: "Income",
    essentialDefault: "",
    incomeStabilityDefault: "Variable",
  },
];
const members = [
  { id: "MEM-JONATHAN", name: "Jonathan" },
  { id: "MEM-BIANCA", name: "Bianca" },
];
const referenceData = {
  categories,
  members,
  accountId: "ACC-CHEQUING",
  timeZone: "America/Toronto",
};

function validate(form, refs = referenceData) {
  return plain(context.validateAndNormalizeTransactionInput_(form, refs));
}

function validExpense(overrides = {}) {
  return {
    date: "2026-08-18",
    type: "Expense",
    amount: "12.30",
    subId: "SUB-FOOD-GROCERIES",
    memberId: "MEM-JONATHAN",
    note: "  weekly groceries  ",
    ...overrides,
  };
}

{
  const originalReferences = JSON.stringify(referenceData);
  assert.deepEqual(validate(validExpense()), {
    dateKey: "2026-08-18",
    timeZone: "America/Toronto",
    type: "Expense",
    amount: 12.3,
    amountCents: 1230,
    subId: "SUB-FOOD-GROCERIES",
    memberId: "MEM-JONATHAN",
    note: "weekly groceries",
    accountId: "ACC-CHEQUING",
    category: categories[0],
  });
  assert.equal(JSON.stringify(referenceData), originalReferences, "pure validation must not mutate reference data");
}

{
  const result = validate({
    date: "2024-02-29",
    type: "Income",
    amount: 0.1 + 0.2,
    subId: "SUB-INCOME-WAGES",
    memberId: "",
    note: "",
  });
  assert.equal(result.amount, 0.3, "ordinary floating-point noise must normalize to exact cents");
  assert.equal(result.amountCents, 30);
  assert.equal(result.memberId, "", "blank ownership must remain Joint/Shared");
  assert.equal(result.category.transactionType, "Income");
}

for (const type of ["", "Transfer", "expense", "INCOME", "Refund"]) {
  assert.throws(
    () => validate(validExpense({ type })),
    /Transaction type must be Income or Expense/,
    `unsupported type ${JSON.stringify(type)} must be rejected`,
  );
}

for (const date of ["", "2026-2-01", "2026/02/01", "1900-02-29", "2026-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "0999-12-31"]) {
  assert.throws(
    () => validate(validExpense({ date })),
    /valid Toronto calendar date/,
    `invalid date ${JSON.stringify(date)} must be rejected`,
  );
}

for (const amount of ["", 0, "0.00", -1, "not-a-number", Infinity, true, [1], { value: 1 }]) {
  assert.throws(
    () => validate(validExpense({ amount })),
    /Amount is required|Amount must be a positive number|Amount must be a positive decimal with no more than two decimal places/,
    `invalid amount ${JSON.stringify(amount)} must be rejected`,
  );
}

for (const amount of ["1.001", "0.009", 12.345]) {
  assert.throws(
    () => validate(validExpense({ amount })),
    /positive decimal with no more than two decimal places|no more than two decimal places/,
    `non-cent amount ${JSON.stringify(amount)} must be rejected`,
  );
}
for (const amount of ["0x10", "1e2", "+12.30", "12."]) {
  assert.throws(
    () => validate(validExpense({ amount })),
    /positive decimal with no more than two decimal places/,
    `non-currency numeric syntax ${JSON.stringify(amount)} must be rejected`,
  );
}
assert.throws(
  () => validate(validExpense({ amount: 90_071_992_547_409.92 })),
  /too large to represent safely in cents/,
);

assert.throws(
  () => validate(validExpense({ subId: "SUB-REMOVED" })),
  /Category is no longer active/,
  "a stale or inactive category must be rejected",
);
assert.throws(
  () => validate(validExpense({ type: "Income" })),
  /does not match the transaction type/,
  "a tampered category/type combination must be rejected",
);
assert.throws(
  () => validate(validExpense({ memberId: "MEM-INACTIVE" })),
  /Household member is no longer active/,
  "a stale or inactive member must be rejected",
);
assert.throws(
  () => validate(validExpense({ memberId: 123 })),
  /Household member selection is invalid/,
);
assert.throws(
  () => validate(validExpense({ note: { text: "tampered" } })),
  /Note must be text/,
);
assert.throws(
  () => validate(validExpense(), { ...referenceData, accountId: "" }),
  /No active account/,
);
assert.throws(
  () => validate(validExpense(), { ...referenceData, timeZone: "America/Los_Angeles" }),
  /Spreadsheet timezone must be America\/Toronto/,
);

{
  let writeCapableCalls = 0;
  let parseCalls = 0;
  context.getCategoriesList_ = () => categories;
  context.getHouseholdMembersList_ = () => members;
  context.getActiveAccountId_ = () => "ACC-CHEQUING";
  context.getTz_ = () => "America/Toronto";
  context.Utilities = {
    parseDate() {
      parseCalls += 1;
      throw new Error("date parser should not run for an invalid request");
    },
  };
  context.getOrCreateManualBatch_ = () => { writeCapableCalls += 1; };
  context.nextSequence_ = () => { writeCapableCalls += 1; };
  context.sheet_ = () => { writeCapableCalls += 1; };

  for (const form of [
    validExpense({ type: "Transfer" }),
    validExpense({ date: "2026-02-29" }),
    validExpense({ amount: "1.001" }),
    validExpense({ subId: "SUB-REMOVED" }),
    validExpense({ type: "Income" }),
    validExpense({ memberId: "MEM-INACTIVE" }),
  ]) {
    assert.throws(() => context.addTransaction(form));
  }
  assert.equal(parseCalls, 0, "pure request rejection must happen before date parsing");
  assert.equal(writeCapableCalls, 0, "invalid requests must make zero Sheet or batch changes");

  context.Utilities.parseDate = () => {
    parseCalls += 1;
    throw new Error("simulated Toronto date parser failure");
  };
  assert.throws(() => context.addTransaction(validExpense()), /simulated Toronto date parser failure/);
  assert.equal(parseCalls, 1);
  assert.equal(writeCapableCalls, 0, "date parsing must complete before the first write-capable helper");
}

assert.match(
  codeSource,
  /function addTransaction\(form\)[\s\S]*?validateAndNormalizeTransactionInput_\([\s\S]*?Utilities\.parseDate\([\s\S]*?getOrCreateManualBatch_\(/,
  "addTransaction must validate and parse before updating the manual batch",
);

{
  const validatorMatch = codeSource.match(
    /function validateAndNormalizeTransactionInput_\(form, referenceData\) \{[\s\S]*?\n\}\n\nfunction showAddTransactionDialog/,
  );
  assert.ok(validatorMatch, "the pure Transaction Input validator must be discoverable");
  assert.doesNotMatch(
    validatorMatch[0],
    /SpreadsheetApp|sheet_|readTable_|Utilities|LockService/,
    "the validator must remain independent of Spreadsheet services and Sheet I/O",
  );
}

console.log("Transaction validation tests passed: valid and boundary inputs normalize deterministically; malformed, stale, and tampered requests reach zero write-capable helpers.");
