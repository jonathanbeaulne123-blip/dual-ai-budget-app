import { addRecurrence, catalogHousehold, configureHouseholdFund, confirmHouseholdFundContribution, proposeHouseholdFundContribution, recordEarningCadence, type Household } from "../../src/core/index.ts";
import { prepareFundHorizon } from "../../src/core/fundHorizon.ts";
const today = "2026-09-08", through = "2026-10-08", member = "MEM-002";
function addCash(h: Household, amount: string, date: string) {
  const p = proposeHouseholdFundContribution(h, { memberId: member, contributorMemberId: member, amount, date });
  return confirmHouseholdFundContribution(p.household, { memberId: "MEM-001", proposalEventId: p.postedIds[0]! }).household;
}
export function trustFixture() {
  let h = configureHouseholdFund(catalogHousehold(), { custodianMemberId: "MEM-001", openedOn: "2026-01-01", createdBy: "MEM-001" }).household;
  h = addCash(h, "1685", "2026-09-07");
  for (const date of ["2026-08-20", "2026-08-27"]) h = addCash(h, "100", date);
  h = recordEarningCadence(h, { memberId: member, createdBy: member, detailAction: "skip", paySchedule: { cadence: "custom", anchorDate: "2026-08-01", weekday: 5, monthDays: [15,30], customDates: ["2026-09-15", "2026-10-04"], reminderTime: "09:00" } }).household;
  for (const [amount, date] of [["586", "2026-09-30"], ["1650", "2026-10-01"]]) h = addRecurrence(h, { cadence: "monthly", nextDate: date!, type: "expense", amount: amount!, accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", fundingDefault: { fundId: h.householdFund!.id, fundedCents: "full", destinationAccountId: "ACC-VISA" } }).household;
  const horizon = prepareFundHorizon(h, today, through);
  if (horizon.kind !== "horizon") throw Error(JSON.stringify(horizon));
  return { h, horizon };
}
