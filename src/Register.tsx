import {
  REGISTER_EMPTY_LINE,
  REGISTER_ERROR_LINE,
  REGISTER_OFFLINE_LINE,
  REGISTER_UNTIED_LINE,
  REGISTER_VIEW,
  contributionCountFor,
  contributionCountPhrase,
  memberViewById,
  registerCad,
  registerDateLabel,
  registerFigureLabel,
  registerMaxRowCents,
  registerMembersDraw,
  registerPreviousMonthName,
  registerScale,
  registerTitle,
  segmentWidth,
  sourceTone,
  type RegisterMemberView,
  type RegisterPresentation,
} from "./core/registerView.ts";
import type { ContributionRegister } from "./core/contributionRegister.ts";
import "./register.css";

type RegisterProps = {
  register: ContributionRegister;
  members: readonly RegisterMemberView[];
  presentation?: RegisterPresentation;
  errorLine?: string;
};

const HEADER = 44;
const FOOTER = 116;
const SKELETON_RULES = [56, 86, 116, 146, 176, 206];

function drawingHeight(rowCount: number): number {
  return HEADER + Math.max(rowCount, 1) * REGISTER_VIEW.rowHeight + FOOTER;
}

function toneFill(tone: "carried" | "hers" | "his"): string {
  if (tone === "carried") return "var(--reg-carried)";
  if (tone === "hers") return "var(--reg-hers)";
  return "var(--reg-his)";
}

function Staff({
  title,
  members,
  height,
}: {
  title: string;
  members: readonly RegisterMemberView[];
  height: number;
}) {
  return (
    <svg
      className="register-svg"
      viewBox={`0 0 ${REGISTER_VIEW.width} ${height}`}
      width={REGISTER_VIEW.width}
      height={height}
      aria-hidden="true"
      focusable="false"
    >
      <text className="register-title" x={REGISTER_VIEW.labelLeft} y="12">{title}</text>
      <Legend members={members} />
      <line className="register-rule" x1="0" y1="24" x2={REGISTER_VIEW.width} y2="24" />
    </svg>
  );
}

function Legend({ members }: { members: readonly RegisterMemberView[] }) {
  const swatch = 10;
  let x = 470;
  const items: Array<{ label: string; tone: "carried" | "hers" | "his" | "unfunded" }> = [
    { label: "carried", tone: "carried" },
    ...members.map((member) => ({ label: member.displayName, tone: member.tone as "hers" | "his" })),
    { label: "not yet", tone: "unfunded" as const },
  ];
  return (
    <g aria-hidden="true">
      {items.map((item) => {
        const here = x;
        x += 76;
        return (
          <g key={`${item.tone}-${item.label}`} transform={`translate(${here},4)`}>
            {item.tone === "unfunded" ? (
              <rect className="register-unfunded" x="0" y="1" width={swatch} height={swatch} fill="none" stroke="var(--reg-unfunded)" strokeDasharray="3 2" />
            ) : (
              <rect x="0" y="1" width={swatch} height={swatch} fill={toneFill(item.tone)} />
            )}
            <text className="register-legend-label" x="15" y="10">{item.label}</text>
          </g>
        );
      })}
    </g>
  );
}

function ReadyDrawing({
  register,
  members,
}: {
  register: ContributionRegister;
  members: readonly RegisterMemberView[];
}) {
  const byId = memberViewById(members);
  const scale = registerScale(registerMaxRowCents(register.rows));
  const height = drawingHeight(register.rows.length);
  const ruleY = HEADER + register.rows.length * REGISTER_VIEW.rowHeight + 2;
  const label = registerFigureLabel(register, members);

  return (
    <svg
      className="register-svg"
      viewBox={`0 0 ${REGISTER_VIEW.width} ${height}`}
      width={REGISTER_VIEW.width}
      height={height}
      role="img"
      aria-label={label}
    >
      <g aria-hidden="true">
        <text className="register-title" x={REGISTER_VIEW.labelLeft} y="12">{registerTitle(register.monthKey)}</text>
        <Legend members={members} />
        <line className="register-rule" x1="0" y1="24" x2={REGISTER_VIEW.width} y2="24" />
        {register.rows.map((row, index) => {
          const y = HEADER + index * REGISTER_VIEW.rowHeight;
          let cursorCents = 0;
          const segments = row.segments.flatMap((segment, segmentIndex) => {
            const source = register.sources[segment.sourceIndex];
            if (!source) return [];
            const tone = sourceTone(source, byId);
            if (!tone) return [];
            const x = REGISTER_VIEW.barLeft + segmentWidth(cursorCents, scale);
            const width = segmentWidth(segment.amountCents, scale);
            cursorCents += segment.amountCents;
            return [(
              <rect
                key={`${row.obligationId}-${segmentIndex}`}
                data-register-segment={tone}
                x={x}
                y={y + 2}
                width={width}
                height={REGISTER_VIEW.barHeight}
                fill={toneFill(tone)}
              />
            )];
          });
          const unfundedX = REGISTER_VIEW.barLeft + segmentWidth(cursorCents, scale);
          const unfundedWidth = segmentWidth(row.unfundedCents, scale);
          return (
            <g key={row.obligationId} data-register-row={row.label}>
              <text className="register-row-label" x={REGISTER_VIEW.labelLeft} y={y + 12}>{row.label}</text>
              <text className="register-date" x={REGISTER_VIEW.dateLeft} y={y + 12}>{registerDateLabel(row.date)}</text>
              {segments}
              {row.unfundedCents > 0 && unfundedWidth > 0 ? (
                <rect
                  className="register-unfunded"
                  data-register-segment="unfunded"
                  x={unfundedX}
                  y={y + 2}
                  width={unfundedWidth}
                  height={REGISTER_VIEW.barHeight}
                  fill="none"
                  stroke="var(--reg-unfunded)"
                  strokeDasharray="3 2"
                />
              ) : null}
              <text className="register-value" x={REGISTER_VIEW.valueRight} y={y + 12} textAnchor="end">
                {registerCad(row.amountCents)}
              </text>
            </g>
          );
        })}
        <line className="register-rule" x1="0" y1={ruleY} x2={REGISTER_VIEW.width} y2={ruleY} />
        <text className="register-utility" x={REGISTER_VIEW.labelLeft} y={ruleY + 20}>the month owes</text>
        <text className="register-value register-total-strong" x={REGISTER_VIEW.valueRight} y={ruleY + 20} textAnchor="end">
          {registerCad(register.owedCents)}
        </text>
        {register.byMember.map((row, index) => {
          const member = byId.get(row.memberId);
          if (!member) return null;
          const y = ruleY + 44 + index * 22;
          const count = contributionCountFor(register, row.memberId);
          return (
            <g key={row.memberId}>
              <rect x="0" y={y - 9} width="9" height="9" fill={toneFill(member.tone)} />
              <text className="register-row-label" x="16" y={y}>
                {member.displayName} · {contributionCountPhrase(count)}
              </text>
              <text className="register-value" x={REGISTER_VIEW.valueRight} y={y} textAnchor="end">
                {registerCad(row.amountCents)}
              </text>
            </g>
          );
        })}
        <g>
          <rect
            x="0"
            y={ruleY + 44 + register.byMember.length * 22 - 9}
            width="9"
            height="9"
            fill={toneFill("carried")}
          />
          <text className="register-row-label" x="16" y={ruleY + 44 + register.byMember.length * 22}>
            carried in from {registerPreviousMonthName(register.monthKey)}
          </text>
          <text
            className="register-value"
            x={REGISTER_VIEW.valueRight}
            y={ruleY + 44 + register.byMember.length * 22}
            textAnchor="end"
          >
            {registerCad(register.carriedCents)}
          </text>
        </g>
      </g>
    </svg>
  );
}

function RegisterList({
  register,
  members,
}: {
  register: ContributionRegister;
  members: readonly RegisterMemberView[];
}) {
  const byId = memberViewById(members);
  return (
    <ol className="register-list">
      {register.rows.map((row) => {
        const funded = row.segments.map((segment) => {
          const source = register.sources[segment.sourceIndex];
          if (!source) return null;
          const name = source.kind === "carried"
            ? "carried"
            : (source.memberId ? byId.get(source.memberId)?.displayName : null);
          if (!name) return null;
          return `${name} ${registerCad(segment.amountCents)}`;
        }).filter((part): part is string => Boolean(part));
        return (
          <li className="register-list-item" key={row.obligationId}>
            <div className="register-list-head">
              <span>{row.label}</span>
              <span>{registerCad(row.amountCents)}</span>
            </div>
            <div className="register-list-meta">
              {registerDateLabel(row.date)}
              {funded.length ? ` · ${funded.join(" · ")}` : ""}
              {row.unfundedCents > 0 ? ` · not yet ${registerCad(row.unfundedCents)}` : ""}
            </div>
          </li>
        );
      })}
      <li className="register-list-item">
        <div className="register-list-head">
          <span>the month owes</span>
          <span>{registerCad(register.owedCents)}</span>
        </div>
        {register.byMember.map((row) => {
          const member = byId.get(row.memberId);
          if (!member) return null;
          return (
            <div className="register-list-meta" key={row.memberId}>
              {member.displayName} · {registerCad(row.amountCents)}
            </div>
          );
        })}
        <div className="register-list-meta">
          carried in from {registerPreviousMonthName(register.monthKey)} · {registerCad(register.carriedCents)}
        </div>
        {register.unfundedCents > 0 ? (
          <div className="register-list-meta">not yet {registerCad(register.unfundedCents)}</div>
        ) : null}
      </li>
    </ol>
  );
}

export function Register({
  register,
  members,
  presentation = "ready",
  errorLine = REGISTER_ERROR_LINE,
}: RegisterProps) {
  const title = registerTitle(register.monthKey);
  const height = drawingHeight(Math.max(register.rows.length, 3));
  const canDraw = register.tiesToProjection && registerMembersDraw(register, members);
  const emptyTied = canDraw && register.rows.length === 0;
  const showEmpty = emptyTied && presentation !== "loading" && presentation !== "error";

  if (presentation === "loading") {
    return (
      <section className="register" aria-busy="true" aria-label={`${title} loading`}>
        <div className="register-scroll" tabIndex={0}>
          <svg
            className="register-svg"
            viewBox={`0 0 ${REGISTER_VIEW.width} ${height}`}
            width={REGISTER_VIEW.width}
            height={height}
            aria-hidden="true"
            focusable="false"
          >
            <text className="register-title" x={REGISTER_VIEW.labelLeft} y="12">{title}</text>
            <line className="register-rule" x1="0" y1="24" x2={REGISTER_VIEW.width} y2="24" />
            {SKELETON_RULES.map((y) => (
              <line key={y} className="register-skeleton-rule" x1={REGISTER_VIEW.barLeft} y1={y} x2={REGISTER_VIEW.barRight} y2={y} />
            ))}
          </svg>
        </div>
      </section>
    );
  }

  if (presentation === "error") {
    return (
      <section className="register" aria-label={title}>
        <div className="register-scroll" tabIndex={0}>
          <Staff title={title} members={members} height={height} />
        </div>
        <p className="register-status" role="status">{errorLine}</p>
      </section>
    );
  }

  const refusal = !canDraw;
  const showReady = presentation === "ready" && canDraw && !emptyTied;
  const showOffline = presentation === "offline";
  const drawOffline = showOffline && canDraw && !emptyTied;

  return (
    <section className="register" aria-label={title}>
      {showOffline ? <p className="register-offline" role="status">{REGISTER_OFFLINE_LINE}</p> : null}
      <div className="register-scroll" tabIndex={0}>
        {showReady || drawOffline ? (
          <ReadyDrawing register={register} members={members} />
        ) : (
          <Staff title={title} members={members} height={height} />
        )}
      </div>
      {refusal ? <p className="register-status" role="status">{REGISTER_UNTIED_LINE}</p> : null}
      {showEmpty ? <p className="register-status" role="status">{REGISTER_EMPTY_LINE}</p> : null}
      {(showReady || drawOffline) ? <RegisterList register={register} members={members} /> : null}
    </section>
  );
}
