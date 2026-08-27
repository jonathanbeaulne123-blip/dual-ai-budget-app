import { useState } from "react";
import { formatCad, workOwedFacts, workReportFacts, type Household } from "./core/index.ts";

export function downloadWorkReportCsv(household: Household, memberId: string) {
  const rows = household.shifts.filter((shift) => shift.memberId === memberId && shift.jobId).map((shift) => {
    const job = household.workJobs.find((row) => row.id === shift.jobId);
    const role = job?.roles.find((row) => row.id === shift.roleId);
    return [shift.date, job?.name ?? "Job", role?.name ?? "Role", shift.hours, shift.paidBreakHours ?? 0, (shift.grossWagesCents ?? shift.wagesCents) / 100, shift.wagesCents / 100, (shift.cashTipsCents + shift.ccTipsCents) / 100, shift.netTipsCents / 100];
  });
  const csv = [["Date", "Job", "Role", "Worked hours", "Paid-break hours", "Gross wages CAD", "Take-home wages CAD", "Gross tips CAD", "Tips after tip-outs CAD"], ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `hearth-work-${memberId}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function WorkReportCard({ household, memberId, today }: { household: Household; memberId: string; today: string }) {
  const [period, setPeriod] = useState<"month" | "all">("month");
  const from = period === "month" ? `${today.slice(0, 7)}-01` : "1970-01-01";
  const report = workReportFacts(household, memberId, from, today);
  const owed = workOwedFacts(household, today, memberId);
  const tipsPerHour = report.hours > 0 ? Math.round(report.netTipsCents / report.hours) : 0;
  return (
    <section className="card work-report">
      <header><h2>Work report</h2><div className="chips"><button type="button" className={`chip ${period === "month" ? "selected" : ""}`} onClick={() => setPeriod("month")}>This month</button><button type="button" className={`chip ${period === "all" ? "selected" : ""}`} onClick={() => setPeriod("all")}>All time</button></div></header>
      <div className="work-report-metrics">
        <div><span>Shifts</span><strong>{report.count}</strong></div>
        <div><span>Worked</span><strong>{report.hours.toFixed(2)} h</strong></div>
        <div><span>Paid breaks</span><strong>{report.paidBreakHours.toFixed(2)} h</strong></div>
        <div><span>Gross wages</span><strong>{formatCad(report.grossWagesCents)}</strong></div>
        <div><span>Expected take-home</span><strong>{formatCad(report.takeHomeWagesCents)}</strong></div>
        <div><span>Gross tips</span><strong>{formatCad(report.grossTipsCents)}</strong></div>
        <div><span>Tip-outs</span><strong>{formatCad(report.tipOutCents)}</strong></div>
        <div><span>Tips after tip-outs</span><strong>{formatCad(report.netTipsCents)}</strong></div>
        <div><span>After-tip-out tips / h</span><strong>{formatCad(tipsPerHour)}</strong></div>
      </div>
      {report.byJob.map((row) => <div className="row" key={row.job.id}><span><i className="swatch" style={{ background: row.job.color }} /> {row.job.name} · {row.shifts} shifts · {row.hours.toFixed(2)} h</span><strong>{formatCad(row.cents)}</strong></div>)}
      {owed.length > 0 && <div className="work-report-owed"><strong>Still waiting</strong>{owed.map((fact) => <div className="row" key={fact.id}><span>{fact.title}</span><span>{formatCad(fact.amountCents)}</span></div>)}</div>}
      <button type="button" className="chip" disabled={!report.count} onClick={() => downloadWorkReportCsv(household, memberId)}>Export for Google Sheets (.csv)</button>
      <p className="muted">Reporting only. Calendar Confirm moves received money; this card never posts.</p>
    </section>
  );
}
