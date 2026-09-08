import { describe, expect, it } from "vitest";
import { addAccount, addRecurrence, askRoutes, askRoutesByCount, catalogHousehold, configureHouseholdFund, observeTipShifts, postWorkShiftWithAttendanceReview, refreshShiftEnvelopesFromEvidence, shapeWorkJob, upsertWorkJob, type Household, type WorkJob, type ShiftEnvelopeEvidenceProposal } from "../src/core/index.ts";
import { reviewForecastRoutes, resolveForecastAvailability, type ForecastAvailabilityAssumption, type ForecastRouteReview } from "../src/core/forecastAvailability.ts";
import type { ScenarioAcceptedSource } from "../src/core/scenarioSources.ts";
import type { FundScenarioRequest } from "../src/core/fundScenario.ts";
const MEMBER = "MEM-002", AS_OF = "2026-09-08", THROUGH = "2026-10-08";
function marker(h: Household): ScenarioAcceptedSource { return {kind: "accepted", scope: {environment: h.environment, householdId: h.householdId, memberId: MEMBER, subject: "fictional-member", viewerRoom: "personal", targetRoom: "household", fundId: h.householdFund!.id, authorityGeneration: "fixture-1"}, acceptedRevision: h.revision, acceptedStateId: `fictional-accepted:${h.revision}`, ownBooks: "ready"}; }
function reason(result: {kind: string; reasons?: readonly {code: string}[]}) { return result.reasons?.[0]?.code ?? result.kind; }

function job(accountId: string): WorkJob {
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
    defaults: { wagesVisibility: "personal", cashTipsVisibility: "personal", cardTipsVisibility: "personal", tipOutVisibility: "personal", wagesDepositAccountId: "ACC-CHEQUING", cashTipsAccountId: accountId, cardTipsDepositAccountId: accountId },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "",
    createdAt: "",
    updatedAt: "",
  });
}
function posted(h: Household, jobId: string, date: string, index: number, channel: "cash" | "card" | "mixed") {
  const j = h.workJobs.find(row => row.id === jobId)!;
  const proposal: ShiftEnvelopeEvidenceProposal = {canonicalShiftKey: `s7shift_${index.toString(16).padStart(64,"0")}`, kind: "worked-shift", jobId, roleId: "ROLE-SERVER", date, startedAt: `${date}T20:00:00.000Z`, endedAt: `${date}T23:00:00.000Z`, workedMinutes: 180, paidBreakMinutes: 0, unpaidBreakMinutes: 0, observedAt: `${date}T23:30:00.000Z`, finality: "approved", source: "seven_shifts_timesheet"};
  const mail = refreshShiftEnvelopesFromEvidence(h, {memberId: MEMBER, createdBy: MEMBER, proposals: [proposal]}).household;
  const envelope = mail.shiftEnvelopes!.find(row => row.canonicalShiftKey === proposal.canonicalShiftKey)!;
  return postWorkShiftWithAttendanceReview(mail, {date, memberId: MEMBER, jobId, roleId: "ROLE-SERVER", workedHours: "3", paidBreakHours: "0", startedAt: envelope.actualStart!, endedAt: envelope.actualEnd!, shiftEnvelopeId: envelope.id, shiftBibleDraft: {envelopeId: envelope.id, unpaidBreakMinutes: 0, approvalState: "approved", authority: envelope.authority}, confirmationId: `forecast-fixture-${index}`, sales: "1000", salesByField: {FOOD: "1000"}, cashTips: channel === "card" ? "0" : String(100 + index*4), cardTips: channel === "cash" ? "0" : String(index === 1 ? 184 : 180 + index*5), customersServed: 40, staffingCount: 4, eventTag: "regular", cashTipsAccountId: j.defaults.cashTipsAccountId, wagesDepositAccountId: j.defaults.wagesDepositAccountId, cardTipsDepositAccountId: j.defaults.cardTipsDepositAccountId, createdBy: MEMBER}, null).household;
}
function fixture(channel: "cash" | "card" = "cash", count = 8) {
  const configured = configureHouseholdFund(catalogHousehold(), {custodianMemberId: "MEM-001", openedOn: "2026-01-01", createdBy: "MEM-001"}).household;
  const added = addAccount(configured, {name: "Own cash", kind: "other", scope: "personal", ownerMemberId: MEMBER});
  const j = job(added.postedIds[0]!);
  j.tipOutRules = channel === "cash" ? [j.tipOutRules[0]!] : [{...j.tipOutRules[1]!, value: 15}];
  let h = upsertWorkJob(added.household, {job: j}).household;
  h = addRecurrence(h, {cadence: "monthly", nextDate: "2026-09-30", type: "expense", amount: "500", accountId: "ACC-VISA", subcategoryId: "SUB-HOUSING-ELECTRIC", fundingDefault: {fundId: h.householdFund!.id, fundedCents: "full", destinationAccountId: "ACC-VISA"}}).household;
  const dates = ["2026-08-07", "2026-08-08", "2026-08-14", "2026-08-15", "2026-08-21", "2026-08-22", "2026-08-28", "2026-08-29"];
  for (let index = 0; index < count; index++) h = posted(h, h.workJobs[0]!.id, dates[index]!, index + 1, channel);
  return h;
}
async function reviewed(h: Household, through = THROUGH) {
  const result = await reviewForecastRoutes(h, marker(h), AS_OF, through);
  if (result.kind !== "forecast-review") throw Error(JSON.stringify(result));
  return result;
}
function choice(review: Extract<ForecastRouteReview, {kind: "forecast-review"}>, count = 1) {
  const route = review.families[count]!.routes[0]!;
  const request: FundScenarioRequest = {version: 1, basis: review.basis, elections: []};
  const assumption: ForecastAvailabilityAssumption = {routeId: route.id, reviewedRouteDigest: route.factsDigest, reviewedPolicyDigest: review.policyDigest, chosenByMemberId: MEMBER, policy: review.policy, acknowledgesForecastReceiptAssumption: true};
  return {route, request, assumption};
}

describe("source-supported forecast receipt assumptions", () => {
  it("provides five true cardinality families while leaving old routes unchanged", async () => {
    const h = fixture(), input = {askCents: 50000, memberId: MEMBER, from: AS_OF, to: THROUGH};
    const before = askRoutes(h, input), source = JSON.stringify(h), review = await reviewed(h);
    expect(review.families.map(family => family.count)).toEqual([0, 1, 2, 3, 4]);
    for (const family of review.families) {
      expect(family.routes.length).toBeGreaterThan(0);
      expect(family.routes.every(row => row.route.shifts.length === family.count)).toBe(true);
      expect(new Set(family.routes.map(row => row.id)).size).toBe(family.routes.length);
    }
    expect(review.families[2]!.routes.length).toBeGreaterThan(1);
    expect(askRoutes(h, input)).toEqual(before); expect(JSON.stringify(h)).toBe(source);
  });
  it("uses the unchanged net cash bands only after explicit receipt consent", async () => {
    const h = fixture(), review = await reviewed(h), c = choice(review);
    expect(review.policy).toBe("net-cash-on-shift-day");
    const noChoice = await resolveForecastAvailability(h, marker(h), c.request, []);
    expect(noChoice).toMatchObject({kind: "available", tranches: []});
    expect(reason(await resolveForecastAvailability(h, marker(h), c.request, [{...c.assumption, acknowledgesForecastReceiptAssumption: false} as never]))).toBe("availability-date-missing");
    const result = await resolveForecastAvailability(h, marker(h), c.request, [c.assumption]);
    expect(result).toMatchObject({kind: "available", tranches: [{availableOn: c.route.route.shifts[0]!.date, lowerCents: c.route.route.shifts[0]!.safeCents, expectedCents: c.route.route.shifts[0]!.expectedCents, evidence: "forecast-availability"}]});
    expect(c.request.elections).toEqual([]);
  });
  it("uses net card bands at the next recorded payout without a second 15 percent withholding", async () => {
    const h = fixture("card"), review = await reviewed(h), c = choice(review);
    expect(h.shifts[0]!.cardTipsAfterTipOutCents).toBe(15640);
    expect(h.shifts[0]!.shiftBible!.netTipsCents).toBe(15640);
    expect(review.policy).toBe("net-card-at-next-recorded-payout");
    const result = await resolveForecastAvailability(h, marker(h), c.request, [c.assumption]);
    if (result.kind !== "available") throw Error(JSON.stringify(result));
    expect(result.tranches[0]!.availableOn > c.route.route.shifts[0]!.date).toBe(true);
    expect(result.tranches[0]!.lowerCents).toBe(c.route.route.shifts[0]!.safeCents);
    expect(result.tranches[0]!.expectedCents).toBe(c.route.route.shifts[0]!.expectedCents);
    expect(result.assumptions.join(" ")).toContain("does not prove cutoff or payment");
  });
  it("refuses mixed channels anywhere in the full observation pool", async () => {
    const h = fixture();
    const mixed = posted(h, h.workJobs[0]!.id, "2026-08-30", 20, "mixed");
    expect(reason(await reviewForecastRoutes(mixed, marker(mixed), AS_OF, THROUGH))).toBe("cash-card-split-missing");
  });
  it("refuses another job in the pool rather than assigning its route a convenient employer", async () => {
    const h = fixture(), second = job(h.workJobs[0]!.defaults.cashTipsAccountId);
    second.name = "Second job"; second.tipOutRules = [second.tipOutRules[0]!];
    const added = upsertWorkJob(h, {job: second}).household;
    const mixed = posted(added, added.workJobs.at(-1)!.id, "2026-08-30", 21, "cash");
    expect(reason(await reviewForecastRoutes(mixed, marker(mixed), AS_OF, THROUGH))).toBe("forecast-model-unsupported");
  });
  it("refuses missing permanent receipt facts and changed policy", async () => {
    const h = fixture();
    const missing = {...h, shifts: h.shifts.map((shift, index) => index ? shift : {...shift, shiftBible: {...shift.shiftBible!, cashTipsCents: null}})};
    expect(reason(await reviewForecastRoutes(missing, marker(missing), AS_OF, THROUGH))).toBe("tipout-timing-missing");
    const changed = upsertWorkJob(h, {job: {...h.workJobs[0]!, tipOutRules: h.workJobs[0]!.tipOutRules.map(rule => ({...rule, value: 2}))}}).household;
    expect(reason(await reviewForecastRoutes(changed, marker(changed), AS_OF, THROUGH))).toBe("forecast-model-unsupported");
  });
  it.each(["minutes", "end", "future"])("refuses incoherent or future %s observation facts", async kind => {
    const h = fixture();
    const changed = {...h, shifts: h.shifts.map((shift, index) => index ? shift : kind === "minutes" ? {...shift, shiftBible: {...shift.shiftBible!, workedMinutes: 60}}
      : kind === "end" ? {...shift, endedAt: "invalid", shiftBible: {...shift.shiftBible!, actualEnd: "invalid"}}
      : {...shift, date: "2026-10-01"})};
    expect(reason(await reviewForecastRoutes(changed, marker(changed), AS_OF, THROUGH))).toBe("source-not-accepted");
  });
  it("refuses an unowned forecast payout destination", async () => {
    const h = fixture("card");
    const partner = addAccount(h, {name: "Partner cash", kind: "other", scope: "personal", ownerMemberId: "MEM-001"});
    const changed = upsertWorkJob(partner.household, {job: {...h.workJobs[0]!, defaults: {...h.workJobs[0]!.defaults, cardTipsDepositAccountId: partner.postedIds[0]!}}}).household;
    expect(changed.workJobs[0]!.defaults.cardTipsDepositAccountId).toBe(partner.postedIds[0]);
    expect(reason(await reviewForecastRoutes(changed, marker(changed), AS_OF, THROUGH))).toBe("source-not-owned");
  });
  it("refuses irregular and beyond-horizon card availability", async () => {
    const h = fixture("card");
    const irregular = upsertWorkJob(h, {job: {...h.workJobs[0]!, tipSchedule: {...h.workJobs[0]!.tipSchedule, cadence: "irregular"}}}).household;
    const review = await reviewed(irregular), c = choice(review);
    expect(reason(await resolveForecastAvailability(irregular, marker(irregular), c.request, [c.assumption]))).toBe("availability-date-missing");
    const short = await reviewed(h, "2026-09-11"), shortChoice = choice(short);
    expect(reason(await resolveForecastAvailability(h, marker(h), shortChoice.request, [shortChoice.assumption]))).toBe("availability-date-missing");
  });
  it("keeps missing count stops empty and preserves the four-observation threshold", async () => {
    const h = fixture(), review = await reviewed(h, "2026-09-11");
    expect(review.families[1]!.routes.length).toBeGreaterThan(0);
    expect(review.families[2]!.routes).toEqual([]); expect(review.families[4]!.routes).toEqual([]);
    const thin = fixture("cash", 3);
    expect(reason(await reviewForecastRoutes(thin, marker(thin), AS_OF, THROUGH))).toBe("route-unavailable");
  });
  it("does not combine alternate routes or reuse stale route/policy identities", async () => {
    const h = fixture(), review = await reviewed(h), c = choice(review), other = choice(review, 2);
    expect(reason(await resolveForecastAvailability(h, marker(h), c.request, [c.assumption, other.assumption]))).toBe("invalid-election");
    expect(reason(await resolveForecastAvailability(h, marker(h), c.request, [{...c.assumption, reviewedPolicyDigest: "old"}]))).toBe("baseline-stale");
    const first = await resolveForecastAvailability(h, marker(h), c.request, [c.assumption]);
    const two = await resolveForecastAvailability(h, marker(h), other.request, [other.assumption]);
    if (first.kind !== "available" || two.kind !== "available") throw Error("unavailable");
    const shared = two.tranches.find(row => first.tranches.some(one => one.id === row.id));
    if (shared) expect(first.tranches.find(one => one.id === shared.id)).toEqual(shared);
  });
  it("does not forecast another shift on an already posted date", () => {
    const h = fixture(), input = {askCents: 50000, memberId: MEMBER, from: AS_OF, to: THROUGH, unavailableDates: ["2026-09-11"]};
    const result = askRoutesByCount(h, input);
    if (result.kind !== "families") throw Error("no routes");
    expect(result.families.every(family => family.routes.every(route => route.shifts.every(shift => shift.date !== "2026-09-11")))).toBe(true);
    expect(observeTipShifts(h, MEMBER)).toHaveLength(8);
  });
});
