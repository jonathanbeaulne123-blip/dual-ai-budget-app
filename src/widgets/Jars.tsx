import { formatCad, formatDateLabel, JARS_EMPTY } from "../core/index.ts";
import type { Dashboard } from "../core/insights.ts";
import type { DateKey } from "../core/calendar.ts";

export function JarsGlance({ dashboard }: { dashboard: Dashboard }) {
  const nearest = dashboard.goals[0];
  if (!nearest) return <span>shelf</span>;
  return <span>{nearest.goal.name} · {Math.round(nearest.progress * 100)}%</span>;
}

export function JarsBody({
  dashboard,
  today,
  onPlan,
}: {
  dashboard: Dashboard;
  today: DateKey;
  onPlan: () => void;
}) {
  if (!dashboard.goals.length) {
    return (
      <>
        <p className="muted">{JARS_EMPTY}</p>
        <button type="button" className="cabinet-handle" onClick={onPlan}>Add a goal</button>
      </>
    );
  }
  return (
    <>
      {dashboard.goals.map((item) => {
        const late = Boolean(item.goal.deadline && item.goal.deadline < today && item.progress < 1);
        return (
          <div key={item.goal.id} style={{ marginBottom: 10 }}>
            <div className="row">
              <span>
                {item.goal.name}
                {late ? <span className="jar-lid tilt" aria-hidden="true"> lid</span> : null}
              </span>
              <span>{Math.round(item.progress * 100)}%</span>
            </div>
            <div className="jar-fill"><i style={{ width: `${item.progress * 100}%` }} /></div>
            <p className="muted">
              {formatCad(item.goal.savedCents)} / {formatCad(item.goal.targetCents)}
              {item.goal.deadline ? ` · ${formatDateLabel(item.goal.deadline)}` : ""}
            </p>
          </div>
        );
      })}
      <p className="muted">Contribute stays on Plan until two-phone goal merges are honest.</p>
      <button type="button" className="cabinet-handle" onClick={onPlan}>Plan</button>
    </>
  );
}
