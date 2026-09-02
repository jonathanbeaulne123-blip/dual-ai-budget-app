import { describe, expect, it } from "vitest";
import {
  acceptVisitGoal,
  addAppointment,
  advanceAppointmentCadence,
  appointmentPublicTitle,
  assembleHousehold,
  catalogHousehold,
  claimRemainingCents,
  compileHousehold,
  craMedicalLog,
  emptyHousehold,
  expenseEffect,
  formatClaimStatus,
  groupUpcomingVisits,
  householdWallet,
  isCashLikeKind,
  isLiabilityKind,
  isReceivableKind,
  learnedVisitIntervalDays,
  markDuplicate,
  mergeShared,
  normalizeAccountKind,
  openClaim,
  postEntry,
  postedVisitsFor,
  postVisit,
  projectAppointmentDates,
  proposeVisitGoal,
  runHealthCheck,
  reversePostedMoney,
  seedDemoHousehold,
  settleClaim,
  splitForSync,
  submitClaim,
  suggestedAppointmentCadence,
  trialBalance,
  upcomingVisitBoard,
  updateAppointment,
  visitCadenceCompare,
  visitDriftSentence,
  writeOffClaim,
} from "../src/core/index.ts";
import { cashFlowStatement } from "../src/core/statements.ts";

const today = "2026-08-22";

function catalog() {
  return catalogHousehold("development");
}

describe("receivable kind", () => {
  it("is an asset, not a jar, not a liability", () => {
    expect(normalizeAccountKind("ar")).toBe("receivable");
    expect(isLiabilityKind("receivable")).toBe(false);
    expect(isCashLikeKind("receivable")).toBe(false);
    expect(isReceivableKind("receivable")).toBe(true);
    const claims = catalog().accounts.find((account) => account.id === "ACC-CLAIMS");
    expect(claims?.kind).toBe("receivable");
  });
});

describe("appointment cadence", () => {
  it("walks every six months the way a hygienist actually slips", () => {
    expect(advanceAppointmentCadence("2026-02-12", { kind: "monthly", interval: 6 })).toBe("2026-08-12");
    expect(advanceAppointmentCadence("2026-08-22", { kind: "weekly", interval: 2 })).toBe("2026-09-05");
    const thirdTuesdays = projectAppointmentDates("2026-08-18", { kind: "nthWeekday", weekday: 2, nth: 3, intervalMonths: 1 }, "2026-08-01", "2026-10-31");
    expect(thirdTuesdays).toContain("2026-08-18");
    expect(thirdTuesdays).toContain("2026-09-15");
  });
});

describe("visit receivable then settle", () => {
  it("posts the full visit, parks expected recovery as an asset, and settles as a transfer never income", () => {
    let household = catalog();
    household = addAppointment(household, {
      title: "Hygienist",
      kind: "dentist",
      nextDate: "2026-08-12",
      cadence: { kind: "monthly", interval: 6 },
      typicalCost: 248,
      typicalRecovery: 180,
      subcategoryId: "SUB-HEALTH-DENTAL",
      accountId: "ACC-VISA",
    }).household;
    const appointmentId = household.appointments[0]!.id;
    const posted = postVisit(household, {
      date: "2026-08-12",
      amount: 248,
      appointmentId,
      expectedRecovery: 180,
      craEligible: true,
      lines: [
        { code: "01204", description: "Exam", amount: 72 },
        { code: "11101", description: "Debridement", amount: 128 },
        { code: "12111", description: "Fluoride", amount: 48 },
      ],
      confirmDuplicate: true,
      createdBy: "MEM-002",
    });
    household = posted.household;
    const expense = household.transactions.find((tx) => tx.type === "expense" && tx.source === "visit")!;
    const refund = household.transactions.find((tx) => tx.type === "refund" && tx.accountId === "ACC-CLAIMS")!;
    const claim = household.claims[0]!;
    expect(expense.amountCents).toBe(24800);
    expect(refund.amountCents).toBe(18000);
    expect(refund.refundOfId).toBe(expense.id);
    expect(household.transactions.some((tx) => tx.type === "income" && tx.source === "visit")).toBe(false);
    expect(claim.status).toBe("pending");
    expect(claimRemainingCents(claim)).toBe(18000);
    expect(expenseEffect(expense) + expenseEffect(refund)).toBe(6800);

    const books = compileHousehold(household);
    expect(trialBalance(books).inBalance).toBe(true);
    const ar = books.entries.flatMap((entry) => entry.lines).filter((line) => line.accountId === "ACC-CLAIMS");
    expect(ar.reduce((sum, line) => sum + line.debitCents - line.creditCents, 0)).toBe(18000);

    const wallet = householdWallet(household, "2026-08-12");
    expect(wallet.receivableCents).toBe(18000);
    expect(wallet.netWorthCents).toBe(wallet.cashCents + wallet.investedCostCents + wallet.receivableCents - wallet.owedCents);

    household = submitClaim(household, claim.id).household;
    expect(household.claims[0]!.status).toBe("submitted");

    const settled = settleClaim(household, {
      claimId: claim.id,
      toAccountId: "ACC-CHEQUING",
      date: "2026-08-22",
      confirmDuplicate: true,
      createdBy: "MEM-002",
    });
    household = settled.household;
    expect(household.claims[0]!.status).toBe("settled");
    expect(household.claims[0]!.receivedCents).toBe(18000);
    expect(household.transactions.filter((tx) => tx.type === "income").every((tx) => tx.source !== "visit")).toBe(true);
    expect(settled.postedIds.some((id) => household.transactions.find((tx) => tx.id === id)?.type === "transfer")).toBe(true);
    const after = compileHousehold(household);
    expect(trialBalance(after).inBalance).toBe(true);
    const arAfter = after.entries.flatMap((entry) => entry.lines).filter((line) => line.accountId === "ACC-CLAIMS");
    expect(arAfter.reduce((sum, line) => sum + line.debitCents - line.creditCents, 0)).toBe(0);
    const cash = cashFlowStatement(household, "2026-08");
    expect(cash.operatingInCents).toBe(18000);
    expect(cash.cardSpendCents).toBe(24800);
  });

  it("refuses itemized lines that do not sum to the posted total", () => {
    const household = catalog();
    expect(() => postVisit(household, {
      date: today,
      amount: 100,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HEALTH-DENTAL",
      expectedRecovery: 40,
      lines: [{ description: "Cleaning", amount: 80 }],
      createdBy: "MEM-002",
    })).toThrow(/itemized lines/i);
  });

  it("writes a shortfall back to the expense and never calls it income", () => {
    let household = catalog();
    household = postVisit(household, {
      date: today,
      amount: 200,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HEALTH-DENTAL",
      expectedRecovery: 120,
      craEligible: true,
      confirmDuplicate: true,
      createdBy: "MEM-001",
    }).household;
    const claimId = household.claims[0]!.id;
    household = settleClaim(household, {
      claimId,
      amount: 90,
      toAccountId: "ACC-CHEQUING",
      date: today,
      confirmDuplicate: true,
      createdBy: "MEM-001",
    }).household;
    expect(claimRemainingCents(household.claims[0]!)).toBe(3000);
    household = writeOffClaim(household, { claimId, createdBy: "MEM-001" }).household;
    expect(household.claims[0]!.status).toBe("short");
    expect(household.transactions.some((tx) => tx.type === "income")).toBe(false);
    const net = household.transactions.filter((tx) => tx.subcategoryId === "SUB-HEALTH-DENTAL").reduce((sum, tx) => sum + expenseEffect(tx), 0);
    expect(net).toBe(11000);
  });

  it("posts extra recovery as a refund to the bank that received cash, not income", () => {
    let household = catalog();
    household = postVisit(household, {
      date: today,
      amount: 100,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HEALTH-CARE",
      expectedRecovery: 40,
      confirmDuplicate: true,
      createdBy: "MEM-002",
    }).household;
    household = settleClaim(household, {
      claimId: household.claims[0]!.id,
      amount: 55,
      toAccountId: "ACC-CHEQUING",
      date: today,
      confirmDuplicate: true,
      createdBy: "MEM-002",
    }).household;
    expect(household.transactions.some((tx) => tx.type === "income")).toBe(false);
    const extra = household.transactions.find((tx) => tx.type === "refund" && tx.accountId === "ACC-CHEQUING");
    expect(extra?.amountCents).toBe(1500);
    expect(household.claims[0]!.status).toBe("settled");
  });

  it("posts a $0-recovery visit without opening a claim", () => {
    const household = postVisit(catalog(), {
      date: today,
      amount: 186,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HEALTH-VET",
      expectedRecovery: 0,
      confirmDuplicate: true,
      createdBy: "MEM-002",
    }).household;
    expect(household.claims).toHaveLength(0);
    expect(household.transactions.filter((tx) => tx.source === "visit")).toHaveLength(1);
    expect(household.transactions[0]?.type).toBe("expense");
  });

  it("opens an Owed-to-us account when the household does not have one yet", () => {
    const base = catalog();
    const stripped: typeof base = { ...base, accounts: base.accounts.filter((account) => account.kind !== "receivable") };
    const posted = postVisit(stripped, {
      date: today,
      amount: 80,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HEALTH-CARE",
      expectedRecovery: 40,
      confirmDuplicate: true,
      createdBy: "MEM-002",
    }).household;
    expect(posted.accounts.some((account) => account.kind === "receivable")).toBe(true);
    expect(posted.claims).toHaveLength(1);
    expect(compileHousehold(posted).entries.length).toBeGreaterThan(0);
    expect(trialBalance(compileHousehold(posted)).inBalance).toBe(true);
  });

  it("opens a general claim against an existing expense", () => {
    let household = catalog();
    household = postEntry(household, {
      date: today,
      type: "expense",
      amount: 47,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-TRANSPORT-TRANSIT",
      note: "Client Uber",
      confirmDuplicate: true,
      createdBy: "MEM-002",
    }).household;
    const expenseId = household.transactions.at(-1)!.id;
    household = openClaim(household, {
      expenseTransactionId: expenseId,
      expectedRecovery: 47,
      claimKind: "employer",
      claimLabel: "Work expense",
      createdBy: "MEM-002",
    }).household;
    expect(household.claims[0]!.kind).toBe("employer");
    expect(household.claims[0]!.status).toBe("pending");
  });
});

describe("privacy and Hercules autonomy", () => {
  it("shows the typed title on the card and a coded title to Hercules when quiet", () => {
    const household = addAppointment(catalog(), {
      title: "Therapy",
      kind: "therapy",
      memberId: "MEM-001",
      sensitivity: "quiet",
      nextDate: "2026-08-25",
      cadence: { kind: "weekly", interval: 2 },
      typicalCost: 160,
      typicalRecovery: 80,
      subcategoryId: "SUB-HEALTH-THERAPY",
      accountId: "ACC-VISA",
    }).household;
    const appointment = household.appointments[0]!;
    expect(appointmentPublicTitle(appointment, "card")).toBe("Therapy");
    expect(appointmentPublicTitle(appointment, "hercules")).toMatch(/tuesday visit/i);
  });

  it("proposes a jar without writing, and only a human tap creates the goal", () => {
    let household = addAppointment(catalog(), {
      title: "Hercules — checkup",
      kind: "vet",
      memberId: "companion",
      nextDate: "2027-03-03",
      cadence: { kind: "monthly", interval: 12 },
      typicalCost: 186,
      subcategoryId: "SUB-HEALTH-VET",
      accountId: "ACC-VISA",
    }).household;
    const before = household.goals.length;
    const proposal = proposeVisitGoal(household, household.appointments[0]!.id, today);
    expect(proposal).toBeTruthy();
    expect(proposal?.hercules).toMatch(/I have a date/i);
    expect(household.goals).toHaveLength(before);
    household = acceptVisitGoal(household, household.appointments[0]!.id, "MEM-002").household;
    expect(household.goals.some((goal) => /vet/i.test(goal.name))).toBe(true);
    expect(household.appointments[0]!.savingGoalId).toBeTruthy();
    expect(household.transactions.filter((tx) => tx.source === "visit")).toHaveLength(0);
  });
});

describe("CRA medical log and sync", () => {
  it("counts eligible medical net of reimbursements and keeps vet off the list", () => {
    const demo = seedDemoHousehold({ today: "2026-08-22" });
    const log = craMedicalLog(demo, "2026-08-22");
    expect(log.eligibleCents).toBe(6800);
    expect(log.hercules).not.toMatch(/vet/i);
    expect(runHealthCheck(demo).filter((finding) => finding.section === "Appointments" || finding.section === "Claims")).toEqual([]);
  });

  it("merges concurrent claims the way D-052 merges goals", () => {
    const base = catalog();
    const left = postVisit(base, {
      date: today,
      amount: 80,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HEALTH-CARE",
      expectedRecovery: 40,
      claimLabel: "Jonathan physio",
      confirmDuplicate: true,
      createdBy: "MEM-002",
    }).household;
    const right = postVisit(base, {
      date: today,
      amount: 90,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HEALTH-THERAPY",
      expectedRecovery: 50,
      claimLabel: "Bianca session",
      confirmDuplicate: true,
      createdBy: "MEM-001",
    }).household;
    const merged = assembleHousehold(
      mergeShared(splitForSync(left, "MEM-002").shared, splitForSync(right, "MEM-001").shared),
      splitForSync(left, "MEM-002").personal,
    );
    expect(merged.claims).toHaveLength(2);
  });
});

describe("empty household still shapes", () => {
  it("starts with empty appointments and claims", () => {
    const empty = emptyHousehold();
    expect(empty.appointments).toEqual([]);
    expect(empty.claims).toEqual([]);
  });
});

describe("appointment tracker projections", () => {
  it("surfaces history, itemized lines, upcoming dates, and spouse-readable claim status", () => {
    const demo = seedDemoHousehold({ today });
    const dentist = demo.appointments.find((item) => item.kind === "dentist")!;
    const history = postedVisitsFor(demo, dentist.id);
    expect(history).toHaveLength(1);
    expect(history[0]!.lines.map((line) => line.code)).toEqual(["01204", "11101", "12111"]);
    expect(history[0]!.remainingCents).toBe(18000);
    const board = upcomingVisitBoard(demo, today);
    expect(board.some((row) => row.title === "Therapy" && !row.overdue)).toBe(true);
    expect(board.some((row) => row.kind === "vet")).toBe(false);
    const groups = groupUpcomingVisits(board);
    expect(groups[0]?.monthKey).not.toBe("overdue");
    expect(formatClaimStatus("pending")).toBe("Waiting");
    expect(formatClaimStatus("settled")).toBe("Landed");
    expect(suggestedAppointmentCadence("spa")).toEqual({ kind: "weekly", interval: 8 });
    const log = craMedicalLog(demo, today);
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]!.eligibleCents).toBe(6800);
    expect(log.rows[0]!.lines).toHaveLength(3);
    expect(log.omitted).toEqual([]);
  });

  it("teaches claimed vs learned cadence when the dentist slips", () => {
    let household = catalog();
    household = addAppointment(household, {
      title: "Hygienist",
      kind: "dentist",
      nextDate: "2026-01-12",
      cadence: { kind: "monthly", interval: 6 },
      typicalCost: 248,
      typicalRecovery: 180,
      subcategoryId: "SUB-HEALTH-DENTAL",
      accountId: "ACC-VISA",
    }).household;
    const id = household.appointments[0]!.id;
    household = postVisit(household, {
      date: "2026-01-12",
      amount: 248,
      appointmentId: id,
      expectedRecovery: 180,
      confirmDuplicate: true,
      createdBy: "MEM-002",
    }).household;
    household = postVisit(household, {
      date: "2026-09-12",
      amount: 248,
      appointmentId: id,
      expectedRecovery: 180,
      confirmDuplicate: true,
      createdBy: "MEM-002",
    }).household;
    const appointment = household.appointments[0]!;
    expect(learnedVisitIntervalDays(household, appointment)).toBeGreaterThan(200);
    expect(visitDriftSentence(household, appointment)).toMatch(/every 6 months/i);
    expect(visitCadenceCompare(household, appointment).sentence).toMatch(/books say about every/i);
  });

  it("lists overdue visits before the next ninety days", () => {
    const household = addAppointment(catalog(), {
      title: "Called-in cleaning",
      kind: "dentist",
      nextDate: "2026-07-01",
      cadence: { kind: "once" },
      typicalCost: 80,
      subcategoryId: "SUB-HEALTH-DENTAL",
      accountId: "ACC-VISA",
    }).household;
    const groups = groupUpcomingVisits(upcomingVisitBoard(household, today));
    expect(groups[0]?.monthKey).toBe("overdue");
    expect(groups[0]?.rows[0]?.title).toBe("Called-in cleaning");
  });

  it("keeps itemized lines on a $0-recovery visit without posting a refund", () => {
    let household = catalog();
    household = addAppointment(household, {
      title: "Physio",
      kind: "physio",
      nextDate: today,
      cadence: { kind: "weekly", interval: 1 },
      typicalCost: 90,
      subcategoryId: "SUB-HEALTH-CARE",
      accountId: "ACC-VISA",
    }).household;
    household = postVisit(household, {
      date: today,
      amount: 90,
      appointmentId: household.appointments[0]!.id,
      expectedRecovery: 0,
      lines: [
        { code: "A", description: "Assessment", amount: 50 },
        { code: "B", description: "Treatment", amount: 40 },
      ],
      confirmDuplicate: true,
      createdBy: "MEM-002",
    }).household;
    expect(household.transactions.some((tx) => tx.type === "refund")).toBe(false);
    const visit = postedVisitsFor(household, household.appointments[0]!.id)[0]!;
    expect(visit.lines).toHaveLength(2);
    expect(visit.claim?.status).toBe("settled");
    expect(visit.remainingCents).toBe(0);
    const log = craMedicalLog(household, today);
    expect(log.eligibleCents).toBe(9000);
    expect(log.rows[0]!.lines).toHaveLength(2);
  });

  it("keeps CRA medical totals on the full correction lineage", () => {
    let household = addAppointment(catalog(), {
      title: "Physio",
      kind: "physio",
      nextDate: today,
      cadence: { kind: "once" },
      typicalCost: 90,
      subcategoryId: "SUB-HEALTH-CARE",
      accountId: "ACC-VISA",
    }).household;
    const appointmentId = household.appointments[0]!.id;
    const visit = postVisit(household, {
      date: today,
      amount: 90,
      appointmentId,
      expectedRecovery: 20,
      confirmDuplicate: true,
      createdBy: "MEM-001",
    });
    const expenseId = visit.household.claims[0]!.expenseTransactionId;
    expect(craMedicalLog(visit.household, today).eligibleCents).toBe(7_000);

    const reversed = reversePostedMoney(visit.household, expenseId, { reversalDate: today, createdBy: "MEM-002" });
    expect(craMedicalLog(reversed.household, today).eligibleCents).toBe(0);
    const reversalId = reversed.household.transactions.find((tx) => tx.reversalOfId === expenseId)?.id;
    if (!reversalId) throw new Error("Missing visit reversal");
    const reinstated = reversePostedMoney(reversed.household, reversalId, { reversalDate: today, createdBy: "MEM-002" });
    expect(craMedicalLog(reinstated.household, today).eligibleCents).toBe(7_000);

    const excludedIntermediate = markDuplicate(reversed.household, reversalId, true).household;
    const excludedReinstatement = reversePostedMoney(excludedIntermediate, reversalId, { reversalDate: today, createdBy: "MEM-002" });
    expect(craMedicalLog(excludedReinstatement.household, today).eligibleCents).toBe(7_000);

    household = postVisit(household, {
      date: today,
      amount: 40,
      appointmentId,
      expectedRecovery: 0,
      confirmDuplicate: true,
      createdBy: "MEM-001",
    }).household;
    const unclaimedId = household.transactions.find((tx) => tx.source === "visit" && tx.amountCents === 4_000)!.id;
    expect(craMedicalLog(household, today).eligibleCents).toBe(4_000);
    household = reversePostedMoney(household, unclaimedId, { reversalDate: today, createdBy: "MEM-002" }).household;
    expect(craMedicalLog(household, today).eligibleCents).toBe(0);
  });

  it("lets edit change coverage, kind, and member without touching the books", () => {
    let household = addAppointment(catalog(), {
      title: "Spa",
      kind: "spa",
      nextDate: "2026-09-01",
      cadence: { kind: "weekly", interval: 8 },
      typicalCost: 85,
      coverage: "none",
      subcategoryId: "SUB-HEALTH-CARE",
      accountId: "ACC-VISA",
    }).household;
    const before = household.transactions.length;
    household = updateAppointment(household, {
      appointmentId: household.appointments[0]!.id,
      kind: "other",
      coverage: "private",
      memberId: "MEM-001",
      practitioner: "Ada",
      place: "Queen",
    }).household;
    expect(household.appointments[0]!.kind).toBe("other");
    expect(household.appointments[0]!.coverage).toBe("private");
    expect(household.appointments[0]!.memberId).toBe("MEM-001");
    expect(household.appointments[0]!.practitioner).toBe("Ada");
    expect(household.transactions).toHaveLength(before);
  });
});
