import {describe,it,expect} from 'vitest';
import {catalogHousehold,shapeWorkJob,upsertWorkJob,configureHouseholdFund,addRecurrence,type WorkJob} from '../src/core/index.ts';
import {prepareAction,executeReviewedAction,type ActionContext} from '../src/core/herculesActions.ts';
function job(): WorkJob {
  return shapeWorkJob({
    id: "",
    memberId: "MEM-002",
    name: "Café Nola",
    color: "#a85a3d",
    active: true,
    timezone: "America/Toronto",
    locationName: "Toronto",
    gpsEnabled: true,
    roles: [{
      id: "ROLE-SERVER",
      name: "Server",
      tipped: true,
      active: true,
      rates: [
        { id: "RATE-OLD", effectiveDate: "2026-01-01", grossHourlyRateCents: 1800, takeHomeMode: "direct", takeHomeHourlyRateCents: 1500, deductions: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
        { id: "RATE-NEW", effectiveDate: "2026-09-01", grossHourlyRateCents: 2000, takeHomeMode: "deductions", takeHomeHourlyRateCents: 0, deductions: [{ id: "TAX", label: "Tax", percent: 20 }], createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    }],
    paidBreakRate: "role",
    paidBreakHourlyRateCents: 0,
    overtimeEnabled: true,
    overtimeWeeklyThresholdHours: 44,
    overtimeMultiplier: 1.5,
    tipOutRules: [
      { id: "BAR", label: "Bar", basis: "total-sales", value: 1, roundingCents: 500, roundingMode: "up", timing: "immediate", active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "FLOOR", label: "Floor", basis: "card-tips", value: 2, roundingCents: 1, roundingMode: "nearest", timing: "withheld", active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
    salesFields: [{ id: "FOOD", label: "Food", requirement: "required", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
    paySchedule: { cadence: "biweekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipSchedule: { cadence: "weekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipWeekStartsOn: 1,
    defaults: { wagesVisibility: "personal", cashTipsVisibility: "personal", cardTipsVisibility: "personal", tipOutVisibility: "personal", wagesDepositAccountId: "ACC-CHEQUING", cashTipsAccountId: "ACC-CASH", cardTipsDepositAccountId: "ACC-CASH" },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "",
    createdAt: "",
    updatedAt: "",
  });
}

describe('Hercules review destinations',()=>{
 it('discloses personal work components from a household conversation without overriding job defaults',()=>{
  const household=upsertWorkJob(catalogHousehold(),{job:job()}).household;
  const c:ActionContext={household,memberId:'MEM-002',view:'household',today:'2026-09-10'};
  const values={jobId:household.workJobs[0]!.id,roleId:'ROLE-SERVER',date:c.today,workedHours:'4',paidBreakHours:'0',cashTips:'50',cardTips:'100',customersServed:'40',staffingCount:'4',sales_0:'1000'};
  const review=prepareAction(c,'worked-shift',values);
  expect(review.effects.length).toBeGreaterThan(2);
  expect(review.effects.every(row=>row.label.startsWith('Personal books'))).toBe(true);
  const result=executeReviewedAction(c,review,crypto.randomUUID());
  expect(result.household.transactions.filter(t=>result.postedIds.includes(t.id)).every(t=>t.visibility==='personal')).toBe(true);
  expect(()=>prepareAction(c,'pay-tipout',{jobId:values.jobId,amount:'1',date:c.today,accountId:'ACC-CASH'})).toThrow(/books where this tip-out/);
 });
 it('shows inherited bill funding and settlement destination before recording an actual payment',()=>{
  let household=configureHouseholdFund(catalogHousehold(),{custodianMemberId:'MEM-001',createdBy:'MEM-001',openedOn:'2026-09-01'}).household;
  household=addRecurrence(household,{cadence:'monthly',nextDate:'2026-09-10',type:'expense',amount:'25',accountId:'ACC-VISA',subcategoryId:'SUB-HOUSING-ELECTRIC',fundingDefault:{fundId:household.householdFund!.id,fundedCents:'full',destinationAccountId:'ACC-VISA'}}).household;
  const c:ActionContext={household,memberId:'MEM-001',view:'household',today:'2026-09-10'};
  const review=prepareAction(c,'pay-bill',{recurrenceId:household.recurrences.at(-1)!.id,occurrenceDate:c.today,paymentDate:c.today,amount:'30',accountId:'ACC-VISA',matchTransactionId:'new'});
  expect(review.effects).toContainEqual({label:'Household Fund share · '+household.accounts.find(a=>a.id==='ACC-VISA')!.name,value:'$30.00'});
  expect(review.effects.some(row=>row.label==='Operating Fund balance')).toBe(true);
  expect(household.transactions).toHaveLength(0);
 });
});
