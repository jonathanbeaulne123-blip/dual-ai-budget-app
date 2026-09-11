import { fundContributionReviewDigest } from "../src/core/fundContributionSources.ts";
import { describe, expect, it } from "vitest";
import { addRecurrence, catalogHousehold, configureHouseholdFund, confirmHouseholdFundContribution, postEntry, proposeHouseholdFundContribution, type Household, type PlanLine } from "../src/core/index.ts";
import { matchPlanEvidence, projectPlan, rehearsePlanPurchase, preparePlanSchedule, type PlanSelection } from "../src/core/planProjection.ts";
const memberId = "MEM-001", asOf = "2026-09-10";
function line(id: string, amountCents: number, lens: PlanLine["lens"] = "protect", dueDate = "2026-09-20"): PlanLine {
  return { id, lens, amountCents, dueDate, cadence: "monthly", kind: lens === "everyday" ? "everyday-pool" : "obligation", labelSnapshot: id, sourceReference: { type: "category", id: lens === "everyday" ? "SUB-FOOD-GROCERIES" : "SUB-HOUSING-ELECTRIC" }, decision: { funding: "available" }, assumptionIds: [], createdBy: memberId };
}
function personal(cash = "1000") {
  const h = catalogHousehold();
  h.accounts = h.accounts.map(row => row.id === "ACC-CHEQUING" ? { ...row, scope: "personal" as const, ownerMemberId: memberId } : row);
  return postEntry(h, { type: "income", subcategoryId: h.categories.find(row => row.recordType === "category" && row.transactionType === "income")!.id, date: "2026-09-01", amount: cash, accountId: "ACC-CHEQUING", createdBy: memberId, visibility: "personal" }).household;
}
function run(h: Household, lines: PlanLine[], assumptions: PlanSelection["assumptions"] = [], scope: "personal" | "household" = "personal") {
  return projectPlan(h, { memberId, scope, acceptedRevision: h.revision, asOf, through: "2026-09-30", selection: { kind: "draft", id: "draft", ownerMemberId: memberId, scope, monthKey: "2026-09", lines, assumptions } });
}
describe("one Plan evidence and consequence engine", () => {
  it("uses signed canonical actuals including refund/reversal and ignores duplicates", () => {
    let h = personal();
    h = postEntry(h, { type: "expense", date: "2026-09-02", amount: "100", accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", createdBy: memberId, visibility: "personal" }).household;
    const tx = h.transactions.at(-1)!;
    h = postEntry(h, { type: "refund", date: "2026-09-03", amount: "30", accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", refundOfId: tx.id, createdBy: memberId, visibility: "personal" }).household;
    expect(matchPlanEvidence(h, line("bill", 10000), "2026-09", asOf, memberId, "personal").reduce((sum, row) => sum + row.amountCents, 0)).toBe(7000);
    h.transactions.push({ ...tx, id: "duplicate", isDuplicate: true });
    expect(run(h, [line("bill", 10000)]).lines[0]!.actualCents).toBe(7000);
    h.transactions.push({ ...tx, id: "reverse", date: "2026-09-04", source: "reversal", reversalOfId: tx.id });
    expect(run(h, [line("bill", 10000)]).lines[0]!.actualCents).toBe(-3000);
  });
  it("cannot allocate the same cash to two promises and leaves the books untouched", () => {
    const h = personal(), before = JSON.stringify(h);
    const result = run(h, [line("a", 70000), { ...line("b", 70000), sourceReference: { type: "category", id: "SUB-FOOD-GROCERIES" } }]);
    expect(result.cashNowCents).toBe(100000);
    expect(result.lines.reduce((sum, row) => sum + row.coveredNowCents, 0)).toBe(100000);
    expect(result.firstExposed?.gapCents).toBe(40000);
    expect(JSON.stringify(h)).toBe(before);
  });
  it("does not finance a pre-payday purchase from a later contribution", () => {
    let h = personal();
    h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-30", type: "income", amount: "500", accountId: "ACC-CHEQUING", subcategoryId: h.categories.find(row => row.recordType === "category" && row.transactionType === "income")!.id, note: "Payday" }).household;
    const result = run(h, [line("rent", 90000), line("everyday", 50000, "everyday", "2026-09-30")], [{ id: "pay", kind: "income", valueCents: 50000, expectedDate: "2026-09-30", confidence: "estimated", observedAt: asOf, sourceReferences: [{ type: "recurrence", id: h.recurrences.at(-1)!.id }] }]);
    const purchase = rehearsePlanPurchase(result, 50000, "2026-09-15");
    expect(purchase.kind).toBe("comparison");
    if (purchase.kind === "comparison") { expect(purchase.fits).toBe(false); expect(purchase.availableCents).toBe(10000); }
  });
  it("does not subtract a linked Fund recurrence twice", () => {
    let h = configureHouseholdFund(catalogHousehold(), { custodianMemberId: memberId, openedOn: "2026-09-01", createdBy: memberId }).household;
    const offer = proposeHouseholdFundContribution(h, { memberId: "MEM-002", contributorMemberId: "MEM-002", amount: "1000", date: "2026-09-01", source: { version: 1, kind: "external-received", explanation: "Synthetic existing money" } });
    h = confirmHouseholdFundContribution(offer.household, { memberId, proposalEventId: offer.postedIds[0]!, received: true, expectedProposalDigest: fundContributionReviewDigest(offer.household, offer.postedIds[0]!) }).household;
    h = addRecurrence(h, { cadence: "monthly", nextDate: "2026-09-20", type: "expense", amount: "600", accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", fundingDefault: { fundId: h.householdFund!.id, fundedCents: "full", destinationAccountId: "ACC-VISA" } }).household;
    const bill = { ...line("bill", 60000), sourceReference: { type: "recurrence" as const, id: h.recurrences.at(-1)!.id } };
    const result = run(h, [bill], [], "household");
    expect(result.lowPoint?.balanceCents).toBe(40000);
    expect(result.lines[0]!.coveredNowCents).toBe(60000);
  });
  it("does not label old unlinked intentions covered", () => {
    const result = run(personal(), [{ ...line("intent", 1000), sourceReference: undefined, decision: undefined }]);
    expect(result.lines[0]!.status).toBe("intention");
    const purchase = rehearsePlanPurchase(result, 0, asOf);
    expect(purchase.kind === "comparison" && purchase.unresolved).toBe(true);
  });
  it("keeps private partner balances out of Personal consequences", () => {
    const h = personal(), before = run(h, [line("bill", 1000)]);
    h.accounts.push({ ...h.accounts[0]!, id: "partner", scope: "personal", ownerMemberId: "MEM-002" });
    h.transactions.push({ ...h.transactions[0]!, id: "partner-opening", accountId: "partner", amountCents: 987654321, splits: [{ party: "MEM-002", amountCents: 987654321 }], createdBy: "MEM-002", visibility: "personal" });
    expect(run(h, [line("bill", 1000)]).cashNowCents).toBe(before.cashNowCents);
  });
  it("spreads a future target over distinct remaining paydays with exact cents", () => {
    const planLine = { ...line("prepare", 15000, "prepare"), decision: { targetCents: 120000, deadline: "2026-12-01", paydays: ["2026-09-15", "2026-10-01", "2026-10-15", "2026-11-01", "2026-11-15", "2026-12-01"] } };
    const row = run(personal(), [planLine]).lines[0]!;
    const schedule = preparePlanSchedule(planLine, { ...row, verifiedProgressCents: 30000 }, asOf);
    expect(schedule.perPaydayCents).toBe(15000);
    expect(schedule.schedule.reduce((sum, row) => sum + row.amountCents, 0)).toBe(90000);
  });
});

describe("Plan reserve and schedule regressions", () => {
  it("counts an economic transfer once across opposite leg claims", async () => {
    const { addGoal, fundGoal, contributeToGoal } = await import("../src/core/index.ts");
    let h = addGoal(personal(), { name: "First", target: 100, shared: false, ownerMemberId: memberId }).household;
    const goal1 = h.goals.at(-1)!.id;
    h = fundGoal(h, { goalId: goal1, amount: 100, fromAccountId: "ACC-CHEQUING", date: "2026-09-02", createdBy: memberId }).household;
    const transfer = h.transactions.find(tx => tx.id === h.goalContributions!.at(-1)!.transferId)!;
    h = addGoal(h, { name: "Second", target: 100, shared: false, ownerMemberId: memberId }).household;
    h = contributeToGoal(h, h.goals.at(-1)!.id, 100, { date: "2026-09-02", createdBy: memberId, transferId: transfer.transferPairId!, markFunded: true }).household;
    const lines = h.goals.map(goal => ({ ...line(goal.id, 10000, "prepare"), sourceReference: { type: "goal" as const, id: goal.id } }));
    const projection = run(h, lines);
    expect(projection.lines.reduce((sum, row) => sum + row.verifiedProgressCents, 0)).toBe(0);
    expect(projection.lines.every(row => row.issues.length > 0)).toBe(true);
  });
  it.each([50, 100])("keeps a historical contribution distinct from a withdrawn reserve (%s CAD)", async amount => {
    const { addGoal, fundGoal, postTransfer } = await import("../src/core/index.ts");
    let h = addGoal(personal(), { name: "Reserve", target: 100, shared: false, ownerMemberId: memberId }).household;
    const goalId = h.goals.at(-1)!.id;
    h = fundGoal(h, { goalId, amount: 100, fromAccountId: "ACC-CHEQUING", date: "2026-09-02", createdBy: memberId }).household;
    const reserve = { ...line("reserve", 10000, "prepare"), sourceReference: { type: "goal" as const, id: goalId } };
    expect(run(h, [reserve]).lines[0]!.verifiedProgressCents).toBe(10000);
    h = postTransfer(h, { fromAccountId: "ACC-GOALS", toAccountId: "ACC-CHEQUING", amount, date: "2026-09-03", createdBy: memberId, visibility: "personal" }).household;
    const row = run(h, [reserve]).lines[0]!;
    expect(row.actualCents).toBe(10000);
    expect(row.verifiedProgressCents).toBe(0);
    expect(row.status).toBe("intention");
  });
  it("includes overdue obligations and net partial/refunded/reversed payment evidence", () => {
    let h = addRecurrence(personal(), { type: "expense", cadence: "monthly", nextDate: "2026-09-01", amount: "900", accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Overdue rent" }).household;
    const recurrence = h.recurrences.at(-1)!;
    const everyday = line("everyday", 50000, "everyday");
    expect(run(h, [everyday]).everydayNowCents).toBe(10000);
    h = postEntry(h, { type: "expense", amount: "400", date: "2026-09-04", accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", createdBy: memberId, visibility: "personal", source: "recurring", sourceId: recurrence.id }).household;
    const paid = h.transactions.at(-1)!;
    h.recurrences.at(-1)!.payments = [{ occurrenceDate: "2026-09-01", paymentDate: paid.date, transactionId: paid.id, amountCents: 40000, accountId: paid.accountId, recordedBy: memberId }];
    h.recurrences.at(-1)!.nextDate = "2026-09-01";
    expect(run(h, [everyday]).movements.find(row => row.sourceId?.startsWith("recurrence:"))!.deltaCents).toBe(-50000);
    h.transactions.push({ ...paid, id: "reversal", date: "2026-09-05", reversalOfId: paid.id, source: "reversal" });
    expect(run(h, [everyday]).movements.find(row => row.sourceId?.startsWith("recurrence:"))!.deltaCents).toBe(-90000);
  });
  it("does not erase an early payday promise with a later operational payment", () => {
    let h = personal("2000");
    h = addRecurrence(h, { type: "expense", cadence: "monthly", nextDate: "2026-09-30", amount: "600", accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "Later cost" }).household;
    const row = { ...line("prepare", 120000, "prepare", "2026-09-15"), sourceReference: { type: "recurrence" as const, id: h.recurrences.at(-1)!.id }, decision: { funding: "available" as const, paydays: ["2026-09-15", "2026-09-30"] } };
    const result = run(h, [row]);
    expect(result.movements.filter(row => row.deltaCents < 0).map(row => [row.date, row.deltaCents]).sort()).toEqual([["2026-09-15", -60000], ["2026-09-30", -60000]]);
  });
  it("applying a payday schedule reserves future contributions after this month's actual", async () => {
    const { applyPlanSchedule } = await import("../src/core/planProjection.ts");
    const { planLifeFixture } = await import("./fixtures/plan-life.ts");
    const h = planLifeFixture("personal"), lines = h.planDrafts![0]!.lines;
    const reserve = lines.find(row => row.lens === "prepare")!;
    reserve.decision!.paydays = ["2026-09-15", "2026-09-30", "2026-10-15", "2026-11-01", "2026-11-15", "2026-12-01"];
    const projection = run(h, lines), row = projection.lines.find(row => row.line.id === reserve.id)!;
    expect(row.actualCents).toBe(30000);
    const applied = applyPlanSchedule(reserve, row, asOf, "2026-09");
    expect(applied.amountCents).toBe(60000);
    const after = run(h, lines.map(line => line.id === reserve.id ? applied : line));
    expect(after.lines.find(row => row.line.id === reserve.id)!.remainingCents).toBe(30000);
    expect(after.movements.filter(row => row.sourceId?.startsWith(`plan:${reserve.id}`)).map(row => [row.date, row.deltaCents])).toEqual([["2026-09-15", -15000], ["2026-09-30", -15000]]);
  });
});

describe("dated accepted evidence", () => {
  it("includes future accepted Personal spending without counting its category intention twice", () => {
    const h = postEntry(personal(), { type: "expense", amount: "900", date: "2026-09-20", accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", visibility: "personal", createdBy: memberId }).household;
    const projection = run(h, [line("bill", 90000), line("everyday", 50000, "everyday")]);
    expect(projection.cashNowCents).toBe(100000);
    expect(projection.movements.filter(row => row.deltaCents < 0).reduce((sum, row) => sum - row.deltaCents, 0)).toBe(140000);
    const purchase = rehearsePlanPurchase(projection, 50000, asOf);
    expect(purchase.kind === "comparison" && purchase.availableCents).toBe(10000);
    expect(purchase.kind === "comparison" && purchase.fits).toBe(false);
  });
  it("keeps an intact goal backed after spending a different goal", async () => {
    const { addGoal, fundGoal, purchaseGoal } = await import("../src/core/index.ts");
    let h = personal();
    for (const name of ["One", "Two"]) { h = addGoal(h, { name, target: 100, shared: false, ownerMemberId: memberId }).household; h = fundGoal(h, { goalId: h.goals.at(-1)!.id, amount: 100, date: "2026-09-02", createdBy: memberId, fromAccountId: "ACC-CHEQUING" }).household; }
    h = purchaseGoal(h, { goalId: h.goals[0]!.id, amount: 100, date: "2026-09-03", createdBy: memberId }).household;
    expect(run(h, [{ ...line("intact", 10000, "prepare"), sourceReference: { type: "goal", id: h.goals[1]!.id } }]).lines[0]!.verifiedProgressCents).toBe(10000);
  });
  it("does not reveal private Fund-backed recurrence labels or full private amounts", async () => {
    const { planSourceVisible } = await import("../src/core/planProjection.ts");
    let h = configureHouseholdFund(personal(), { custodianMemberId: memberId, openedOn: "2026-09-01", createdBy: memberId }).household;
    h = addRecurrence(h, { type: "expense", amount: "9876.54", nextDate: "2026-09-20", cadence: "monthly", accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-ELECTRIC", note: "PRIVATE SOURCE CANARY", fundingDefault: { fundId: h.householdFund!.id, fundedCents: 1000, destinationAccountId: "ACC-VISA" } }).household;
    expect(planSourceVisible(h, { type: "recurrence", id: h.recurrences.at(-1)!.id }, "MEM-002", "household")).toBe(false);
  });
});

describe('Everyday promises already made', () => {
 it('keeps an accepted future purchase inside Everyday from being spent again', () => {
  const h=postEntry(personal(),{type:'expense',amount:'900',date:'2026-09-20',accountId:'ACC-CHEQUING',subcategoryId:'SUB-FOOD-GROCERIES',visibility:'personal',createdBy:memberId}).household;
  const projection=run(h,[line('everyday',50000,'everyday')]);
  const choice=rehearsePlanPurchase(projection,12000,asOf);
  expect(projection.everydayAllowanceCents).toBe(0);
  expect(choice.kind==='comparison'&&choice.fits).toBe(false);
 });
 it('lets an intended reserve purchase complete its outcome without demanding the reserve again', async()=>{
  const {addGoal,fundGoal,purchaseGoal}=await import('../src/core/index.ts');
  let h=addGoal(personal(),{name:'Prepared purchase',target:100,shared:false,ownerMemberId:memberId}).household;
  const goalId=h.goals.at(-1)!.id;
  h=fundGoal(h,{goalId,amount:100,fromAccountId:'ACC-CHEQUING',date:'2026-09-02',createdBy:memberId}).household;
  h=purchaseGoal(h,{goalId,amount:100,date:'2026-09-03',createdBy:memberId}).household;
  const row=run(h,[{...line('prepared',10000,'prepare'),sourceReference:{type:'goal',id:goalId},decision:{funding:'available',targetCents:10000,paydays:['2026-09-15']}}]).lines[0]!;
  expect(row).toMatchObject({status:'completed',remainingCents:0,verifiedProgressCents:0,outcomeFulfilled:true});
  expect(preparePlanSchedule(row.line,row,asOf).remainingCents).toBe(0);
 });
});

describe('dated income and bill revisions', () => {
 it('counts accepted future pay once and preserves the gap before payday', () => {
  let h=addRecurrence(personal(),{type:'income',amount:'500',nextDate:'2026-09-30',cadence:'monthly',accountId:'ACC-CHEQUING',subcategoryId:'SUB-INCOME-WAGES'}).household;
  const sourceId=h.recurrences.at(-1)!.id;
  h=postEntry(h,{type:'income',amount:'500',date:'2026-09-30',accountId:'ACC-CHEQUING',subcategoryId:'SUB-INCOME-WAGES',createdBy:memberId,visibility:'personal',source:'recurring',sourceId}).household;
  const projection=run(h,[line('rent',90000),line('everyday',50000,'everyday')],[{id:'payday',kind:'income',valueCents:50000,expectedDate:'2026-09-30',sourceReferences:[{type:'recurrence',id:sourceId}],observedAt:asOf,confidence:'confirmed'}]);
  expect(projection.movements.filter(row=>row.deltaCents>0).reduce((sum,row)=>sum+row.deltaCents,0)).toBe(50000);
  const before=rehearsePlanPurchase(projection,50000,'2026-09-15'),after=rehearsePlanPurchase(projection,50000,'2026-09-30');
  expect(before.kind==='comparison'&&before.fits).toBe(false);expect(after.kind==='comparison'&&after.fits).toBe(true);
 });
 it('does not move an already paid Shared occurrence into Personal when its next template changes', async()=>{
  const {recordBillPayment,updateRecurrence}=await import('../src/core/index.ts');
  let h=addRecurrence(personal(),{type:'expense',amount:'800',nextDate:'2026-09-01',cadence:'monthly',accountId:'ACC-VISA',subcategoryId:'SUB-HOUSING-ELECTRIC'}).household;
  const id=h.recurrences.at(-1)!.id;
  h=recordBillPayment(h,{recurrenceId:id,occurrenceDate:'2026-09-01',paymentDate:'2026-09-01',amount:'800',accountId:'ACC-VISA',createdBy:memberId}).household;
  h=updateRecurrence(h,{...h.recurrences.at(-1)!,id,amount:'900',accountId:'ACC-CHEQUING',splits:[{party:memberId,amountCents:90000}]}).household;
  const projection=run(h,[line('everyday',50000,'everyday')]);
  expect(projection.movements.some(row=>row.sourceId===`recurrence:${id}:2026-09-01`&&row.deltaCents<0)).toBe(false);
 });
});


describe('future payment conservation', () => {
 it.each(['category', 'recurrence'] as const)('reserves a later %s payment once at the earlier promise date', source => {
  let h=personal(); let reference: PlanLine['sourceReference'];
  if(source==='recurrence') {
   h=addRecurrence(h,{type:'expense',amount:'900',nextDate:'2026-09-20',cadence:'monthly',accountId:'ACC-CHEQUING',subcategoryId:'SUB-HOUSING-ELECTRIC'}).household;
   reference={type:'recurrence',id:h.recurrences.at(-1)!.id};
  } else {
   h=postEntry(h,{type:'expense',amount:'900',date:'2026-09-20',accountId:'ACC-CHEQUING',subcategoryId:'SUB-HOUSING-ELECTRIC',createdBy:memberId,visibility:'personal'}).household;
   reference={type:'category',id:'SUB-HOUSING-ELECTRIC'};
  }
  const p=run(h,[{...line('bill',90000,'protect','2026-09-15'),sourceReference:reference}]);
  expect(p.movements.filter(row=>row.deltaCents<0).map(row=>[row.date,row.deltaCents])).toEqual([['2026-09-15',-90000]]);
  expect(p.lowPoint).toEqual({date:'2026-09-15',balanceCents:10000});
  expect(p.lines[0]).toMatchObject({actualCents:0,coveredNowCents:90000,gapCents:0});
 });
 it('matches a posted future Calendar purchase without prematurely calling it paid', async()=>{
  const {addPotentialExpense,postPotentialExpense}=await import('../src/core/index.ts');
  let h=addPotentialExpense(personal(),{title:'Planned cost',amount:'900',date:'2026-09-20',accountId:'ACC-CHEQUING',subcategoryId:'SUB-HOUSING-ELECTRIC',createdBy:memberId,visibility:'personal'}).household;
  const id=h.potentialExpenses.at(-1)!.id;
  h=postPotentialExpense(h,{id,createdBy:memberId}).household;
  const p=run(h,[{...line('calendar',90000),sourceReference:{type:'potential-expense',id}}]);
  expect(p.movements.filter(row=>row.deltaCents<0).reduce((sum,row)=>sum+row.deltaCents,0)).toBe(-90000);
  expect(p.lines[0]).toMatchObject({actualCents:0,coveredNowCents:90000,gapCents:0});
 });
});
