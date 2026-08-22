import { formatCad } from "../core/money.ts";
import { blotterFacts } from "../core/officeFacts.ts";
import type { Dashboard } from "../core/insights.ts";
import type { AuditOpinion } from "../core/statements.ts";

export function BlotterBody({
  dashboard,
  opinion,
  findings,
}: {
  dashboard: Dashboard;
  opinion: AuditOpinion;
  findings: number;
}) {
  const facts = blotterFacts(dashboard, opinion, findings);
  if (facts.empty) {
    return <p className="muted">{facts.glance}</p>;
  }
  return (
    <>
      <p className="blotter-net">{formatCad(facts.netCents)}</p>
      <p className="muted">{formatCad(facts.incomeCents)} in · {formatCad(facts.expenseCents)} out</p>
      <p>{opinion.hercules}</p>
      {facts.warn && <p>{opinion.cpa}</p>}
      {!facts.warn && <p className="muted">{opinion.cpa}</p>}
      <p className="muted">
        Trial {opinion.trialInBalance ? "✓" : "✗"} · equation {opinion.equationHolds ? "✓" : "✗"}
      </p>
    </>
  );
}

export function BlotterGlance({
  dashboard,
  opinion,
  findings,
}: {
  dashboard: Dashboard;
  opinion: AuditOpinion;
  findings: number;
}) {
  const facts = blotterFacts(dashboard, opinion, findings);
  if (facts.empty) return <span className="wax-stamp outline">stamp</span>;
  return (
    <>
      <span className="blotter-net" style={{ fontSize: 18 }}>{formatCad(facts.netCents)}</span>
      <span className={`wax-stamp ${facts.warn ? "warn" : ""}`}>{facts.stamp}</span>
      {facts.lampDot ? <span aria-hidden="true"> ·</span> : null}
    </>
  );
}
