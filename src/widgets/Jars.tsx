import { formatCad, formatDateLabel, JARS_EMPTY } from "../core/index.ts";
import type { Dashboard } from "../core/insights.ts";
import type { DateKey } from "../core/calendar.ts";

function Piggy({ fill, late, clipId }: { fill: number; late?: boolean; clipId: string }) {
  const level = Math.max(0, Math.min(1, fill));
  const clipY = 62 - level * 34;
  const clip = `pig-fill-${clipId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg className={`piggy ${late ? "is-late" : ""}`} viewBox="0 0 88 72" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <rect x="8" y={clipY} width="72" height="48" />
        </clipPath>
      </defs>
      <ellipse cx="46" cy="42" rx="28" ry="20" fill="#fdfbf6" stroke="#1b1712" strokeWidth="1.6" />
      <ellipse cx="46" cy="42" rx="28" ry="20" fill="#c9a884" opacity="0.35" clipPath={`url(#${clip})`} />
      <rect x="42" y="16" width="10" height="5" rx="1.4" fill="#1b1712" />
      <ellipse cx="22" cy="40" rx="8" ry="7" fill="#fdfbf6" stroke="#1b1712" strokeWidth="1.4" />
      <circle cx="19" cy="38" r="1.1" fill="#1b1712" />
      <circle cx="24" cy="38" r="1.1" fill="#1b1712" />
      <ellipse cx="22" cy="43" rx="3.2" ry="2" fill="#e8d7c0" stroke="#1b1712" strokeWidth="0.8" />
      <path d="M70 34c6 2 10 8 8 14" fill="none" stroke="#1b1712" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="36" cy="60" rx="5" ry="3.2" fill="#e8d7c0" stroke="#1b1712" strokeWidth="1.1" />
      <ellipse cx="56" cy="60" rx="5" ry="3.2" fill="#e8d7c0" stroke="#1b1712" strokeWidth="1.1" />
      <circle cx="38" cy="36" r="3.2" fill="#c9a884" opacity="0.55" />
      <circle cx="58" cy="46" r="2.4" fill="#c9a884" opacity="0.45" />
      {late && <path d="M18 14h12l-2 8h-8z" fill="#c45c26" />}
    </svg>
  );
}

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
      <div className="piggy-shelf">
        {dashboard.goals.map((item) => {
          const late = Boolean(item.goal.deadline && item.goal.deadline < today && item.progress < 1);
          return (
            <div key={item.goal.id} className="piggy-card">
              <Piggy fill={item.progress} late={late} clipId={item.goal.id} />
              <div className="row">
                <span>{item.goal.name}</span>
                <span>{Math.round(item.progress * 100)}%</span>
              </div>
              <p className="muted">
                {formatCad(item.goal.savedCents)} / {formatCad(item.goal.targetCents)}
                {item.goal.deadline ? ` · ${formatDateLabel(item.goal.deadline)}` : ""}
              </p>
            </div>
          );
        })}
      </div>
      <p className="muted">Hercules-coat pigs. Contribute stays on Plan until two-phone goal merges are honest.</p>
      <button type="button" className="cabinet-handle" onClick={onPlan}>Plan</button>
    </>
  );
}