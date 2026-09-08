import { expect, it } from "vitest";
import { catalogHousehold, postEntry, postTransfer, reversePostedMoney } from "../src/core/index.ts";
import { createReadingReceiptReader } from "../src/readingReceipt.ts";
const expense = () => postEntry(catalogHousehold(), { date: "2026-09-08", type: "expense", amount: "12.34", accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES", createdBy: "MEM-001", visibility: "household" }).household;

it("binds source to the exact accepted row and scope, refusing pending or missing data", () => {
  const household = expense(), row = household.transactions[0]!;
  const read = createReadingReceiptReader(household, "MEM-001", "household");
  expect(read(row)).toMatchObject({ kind: "ready", date: row.date, revision: household.revision, view: "household", transactionId: row.id, recognized: true });
  expect(read({ ...row, amountCents: row.amountCents + 1 })).toMatchObject({kind: "unavailable"});
  expect(read({...row, id: "not-accepted"})).toMatchObject({kind: "unavailable"});
  const privateRow = {...row, visibility: "personal" as const, createdBy: "MEM-002"};
  const privateBooks = {...household, transactions: [privateRow]};
  expect(createReadingReceiptReader(privateBooks, "MEM-001", "household")(privateRow).kind).toBe("unavailable");
  expect(createReadingReceiptReader(privateBooks, "MEM-001", "personal")(privateRow).kind).toBe("unavailable");
});
it("uses compiler origin links for a complete transfer and refuses a missing or mismatched mate", () => {
  const h = postTransfer(catalogHousehold(), {date:"2026-09-08",amount:"20.00",fromAccountId:"ACC-CHEQUING",toAccountId:"ACC-VISA"}).household;
  const [a,b] = h.transactions;
  const read = createReadingReceiptReader(h,"MEM-001","household");
  const first = read(a!), second = read(b!);
  expect(first.kind).toBe("ready");expect(second.kind).toBe("ready");
  if(first.kind==='ready' && second.kind==='ready') expect(first.journalId).toBe(second.journalId);
  expect(createReadingReceiptReader({...h,transactions:[a!]},"MEM-001","household")(a!).kind).toBe("unavailable");
  expect(createReadingReceiptReader({...h,transactions:[a!,{...b!,amountCents:1}]},"MEM-001","household")(a!).kind).toBe("unavailable");
});
it("reports reversal history separately from journal eligibility and exposes no compiler exception details", () => {
  let h=expense();const original=h.transactions[0]!;
  h=reversePostedMoney(h,original.id,{reversalDate:"2026-09-08"}).household;
  const read=createReadingReceiptReader(h,"MEM-001","household");
  const receipt=read(h.transactions.find(t=>t.id===original.id)!);
  expect(receipt).toMatchObject({kind:"ready",recognized:true,reversedByIds:[h.transactions.find(t=>t.reversalOfId===original.id)!.id]});
  const bad={...h,transactions:h.transactions.map(t=>({...t,accountId:'PRIVATE-CANARY'}))};
  const unavailable=createReadingReceiptReader(bad,"MEM-001","household")(bad.transactions[0]!);
  expect(unavailable.kind).toBe('unavailable');expect(JSON.stringify(unavailable)).not.toContain('CANARY');
});

it("shows the same transfer reversal history from either original leg", () => {
  let h=postTransfer(catalogHousehold(),{date:"2026-09-08",amount:"20.00",fromAccountId:"ACC-CHEQUING",toAccountId:"ACC-VISA"}).household;
  const [a,b]=h.transactions;
  h=reversePostedMoney(h,a!.id,{reversalDate:"2026-09-08"}).household;
  const read=createReadingReceiptReader(h,"MEM-001","household");
  const first=read(h.transactions.find(t=>t.id===a!.id)!),second=read(h.transactions.find(t=>t.id===b!.id)!);
  expect(first.kind).toBe("ready");expect(second.kind).toBe("ready");
  if(first.kind==='ready'&&second.kind==='ready'){expect(first.reversedByIds).toHaveLength(2);expect(second.reversedByIds).toEqual(first.reversedByIds);}
});
