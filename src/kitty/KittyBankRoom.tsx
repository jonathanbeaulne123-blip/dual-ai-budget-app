import { useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  addGoal,
  saveGoalEnvelope,
  fundGoal,
  purchaseGoal,
  allocateHouseholdFundSurplus,
  releaseHouseholdFundKitty,
  formatCad,
  goalsVaultAccount,
  goalVaultCapacity,
  projectHouseholdFund,
  isCashLikeKind,
  kittyBankBackingStep,
  todayKey,
  type Goal,
  type Household,
  type CommitResult,
  type LedgerView,
  type PlanLine,
} from "../core/index.ts";
import {
  defaultGoalEnvelope,
  KITTY_GLAZES,
  goalEnvelopeDependencies,
  goalEnvelopeUsedCents,
  goalFundReserve,
} from "../core/goalEnvelopes.ts";
import {
  matchPlanEvidence,
  projectPlan,
  preparePlanSchedule,
  type PlanProjection,
  type PlanSelection,
} from "../core/planProjection.ts";
import { goalVisibleInView } from "../core/visibility.ts";
import { fillDraftCents } from "../GoalFill.tsx";
import { ConfirmSheet } from "../Confirm.tsx";
import { useDialog } from "../useDialog.ts";
import { useAsyncScope } from "../asyncScope.ts";
import { KittyStage } from "./KittyStage.tsx";
import { StudioBench, useKittyStudio } from "./studio/KittyStudio.tsx";
import { displayedKittyPiece, newKittyPiece } from "../core/kittyStudio.ts";
import { studioHex } from "./studio/palette.ts";
import { bisqueHex } from "./studio/paintCanvas.ts";
/** Seal colour: the displayed studio piece's dip (chalky while unfired), else the legacy glaze. */
function sealColor(goal: Goal): string {
  const piece = displayedKittyPiece(goal.envelope?.studio);
  if (!piece) return KITTY_GLAZES[goal.envelope?.glaze ?? "cream"];
  const base = piece.paint.parts.body ?? piece.paint.base;
  return piece.firedAt ? studioHex(base) : bisqueHex(base);
}
import type { PlanAsk } from "../PlanLensWorkbench.tsx";
import "./kitty-room.css";
import { Whisper } from "../theme/Whisper.tsx";

export type KittyPlanContext = {
  selection: PlanSelection;
  projection: PlanProjection;
  goalId?: string;
  lineId?: string;
  onClose: () => void;
  onSaveLine: (line: PlanLine, expected?: PlanLine) => Promise<boolean>;
  onScenario: (name: string, lines: PlanLine[]) => Promise<boolean>;
  onAsk: PlanAsk;
};
export type KittySubmissionReader = (
  id: string,
) => Promise<"accepted" | "pending" | "rejected" | "missing">;
export type KittyCommandOptions = {
  confirmationId?: string;
  recoverConfirmation?: boolean;
  onRecoveredConfirmation?: () => void;
  onDefinitiveRejected?: () => void;
  suppressUndo?: boolean;
};
export type KittyRoomProps = {
  household: Household;
  view: LedgerView;
  memberId: string;
  busy?: boolean;
  identity: string;
  onReadSubmission?: KittySubmissionReader;
  onCommand: (
    fn: (h: Household) => CommitResult,
    options?: KittyCommandOptions,
  ) => unknown;
  context?: KittyPlanContext;
  initialGoalId?: string;
  returnTo?: "Plan" | "Home";
  onClose: () => void;
};
type SavedReview = { id: string; title: string };
function readSavedReview(key: string): SavedReview | null {
  try {
    const row = JSON.parse(sessionStorage.getItem(key) ?? "null");
    return row && typeof row.id === "string" && typeof row.title === "string"
      ? row
      : null;
  } catch {
    return null;
  }
}
type Review = {
  id: string;
  attempted?: boolean;
  title: string;
  body: string;
  extra: string;
  basis: string;
  command: (h: Household) => CommitResult;
};
const basis = (h: Household) =>
  JSON.stringify([
    h.environment,
    h.householdId,
    h.goals,
    h.accounts,
    h.transactions,
    h.goalContributions,
    h.goalPurchases,
    h.fundEvents,
    h.fundKittyAllocations,
    h.recurrences,
    h.appointments,
    h.planVersions,
  ]);
function initialEnvelope(goal: Goal, context?: KittyPlanContext) {
  if (goal.envelope) return goal.envelope;
  const lens = context?.selection.lines.find(
    (line) =>
      line.sourceReference?.type === "goal" &&
      line.sourceReference.id === goal.id,
  )?.lens;
  return {
    ...defaultGoalEnvelope(),
    ...(lens === "protect" || lens === "prepare" || lens === "build"
      ? { kind: lens }
      : {}),
  };
}
function bankEvidence(
  h: Household,
  goal: Goal,
  today: string,
  memberId: string,
  view: LedgerView,
) {
  try {
    const evidence = matchPlanEvidence(
      h,
      {
        id: goal.id,
        lens: "build",
        kind: "goal-contribution",
        labelSnapshot: goal.name,
        amountCents: 0,
        cadence: "one-time",
        assumptionIds: [],
        createdBy: memberId,
        sourceReference: { type: "goal", id: goal.id },
      },
      today.slice(0, 7),
      today,
      memberId,
      view,
    );
    const vaultCents =
      goal.status === "retired"
        ? 0
        : evidence
            .filter(
              (row) =>
                row.kind === "goal-funding" &&
                row.reserveCents !== undefined &&
                !h.fundKittyAllocations?.some(
                  (allocation) => allocation.id === row.id,
                ),
            )
            .reduce((sum, row) => sum + (row.reserveCents ?? 0), 0);
    return {
      vaultCents,
      usedCents: goalEnvelopeUsedCents(h, goal.id, today),
      fund: goalFundReserve(h, goal.id, today),
      error: "",
    };
  } catch (cause) {
    return {
      vaultCents: 0,
      usedCents: 0,
      fund: {
        reservedCents: 0,
        unresolved: true,
        allocatedCents: 0,
        releasedCents: 0,
      },
      error:
        cause instanceof Error ? cause.message : "Review the backing receipts.",
    };
  }
}
export function KittyBankRoom(props: KittyRoomProps) {
  return createPortal(<Room key={props.identity} {...props} />, document.body);
}
function Room({
  household: h,
  view,
  memberId,
  busy = false,
  identity,
  onReadSubmission,
  onCommand,
  context,
  initialGoalId,
  returnTo = "Plan",
  onClose,
}: KittyRoomProps) {
  const recoveryKey = `hearth-kitty-pending:${identity}`;
  const [recovery, setRecovery] = useState(() => readSavedReview(recoveryKey));
  const persistReview = (review: Review | null) => {
    try {
      if (review)
        sessionStorage.setItem(
          recoveryKey,
          JSON.stringify({ id: review.id, title: review.title }),
        );
      else sessionStorage.removeItem(recoveryKey);
      return true;
    } catch {
      return false;
    }
  };
  const [filter, setFilter] = useState<"active" | "archived" | "completed">(
    "active",
  );
  const [selected, setSelected] = useState(context?.goalId ?? initialGoalId ?? "");
  const [creating, setCreating] = useState(false);
  const [studioFor, setStudioFor] = useState("");
  const all = h.goals.filter((goal) => goalVisibleInView(goal, memberId, view));
  const visible = all.filter((goal) =>
    filter === "completed"
      ? goal.status === "retired"
      : filter === "archived"
        ? goal.envelope?.archivedAt && goal.status !== "retired"
        : !goal.envelope?.archivedAt && goal.status !== "retired",
  );
  const requested = all.find((goal) => goal.id === selected);
  const goal = requested ?? visible[0];
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState("");
  const lock = useRef(false),
    scope = useAsyncScope(identity),
    latest = useRef(h);
  latest.current = h;
  const dialog = useDialog(
    true,
    saving || recovery ? undefined : onClose,
  );
  const run = async (
    command: (h: Household) => CommitResult,
    message: string,
    review?: Review,
  ) => {
    if (lock.current || busy) return false;
    lock.current = true;
    setSaving(true);
    setError("");
    const token = scope.capture();
    let recovered = false,
      definitivelyRejected = false;
    if (review) {
      review.attempted = Boolean(review.attempted);
      if (!persistReview(review)) {
        lock.current = false;
        setSaving(false);
        setError(
          "This browser could not preserve the review for recovery. Nothing was submitted. Enable session storage and try again.",
        );
        return false;
      }
    }
    const recovering = review?.attempted;
    if (review) review.attempted = true;
    try {
      if (recovering && review && onReadSubmission) {
        const status = await onReadSubmission(review.id);
        if (!scope.isCurrent(token)) return false;
        if (status === "accepted") {
          persistReview(null);
          setRecovery(null);
          setReceipt(message);
          return true;
        }
        if (status === "rejected" || status === "missing") {
          definitivelyRejected = true;
          throw new Error(
            status === "rejected"
              ? "This change was rejected. Cancel and review the current bank."
              : "No submission was found. Cancel and review the current bank before confirming again.",
          );
        }
        throw new Error(
          "This change is still waiting for its receipt. Keep this review and check again.",
        );
      }
      const result = await onCommand(
        (current) => {
          try {
            if (!scope.isCurrent(token))
              throw new Error("This ledger changed. Open the bank again.");
            return command(current);
          } catch (cause) {
            definitivelyRejected = true;
            throw cause;
          }
        },
        review
          ? {
              confirmationId: review.id,
              recoverConfirmation: recovering,
              onRecoveredConfirmation: () => {
                recovered = true;
              },
              onDefinitiveRejected: () => {
                definitivelyRejected = true;
                review.attempted = false;
              },
            }
          : undefined,
      );
      if (!scope.isCurrent(token)) return false;
      if (recovered) {
        persistReview(null);
        setRecovery(null);
        setReceipt(message);
        return true;
      }
      const outcome = result as {
        ok?: boolean;
        kind?: string;
        household?: Household;
        userMessage?: string;
      } | null;
      if (!outcome || outcome.ok === false || !outcome.household) {
        if (outcome?.ok === false) definitivelyRejected = true;
        if (review) review.attempted = !definitivelyRejected;
        throw new Error(
          outcome?.userMessage ||
            (definitivelyRejected
              ? "This change was rejected. Cancel and review the current bank."
              : "Acceptance is not confirmed. Keep this review and check its saved status before trying another change."),
        );
      }
      persistReview(null);
      setRecovery(null);
      setReceipt(message);
      return true;
    } catch (cause) {
      if (definitivelyRejected) {
        if (review) review.attempted = false;
        persistReview(null);
        setRecovery(null);
      }
      if (scope.isCurrent(token))
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not save. Your input is still here.",
        );
      return false;
    } finally {
      lock.current = false;
      if (scope.isCurrent(token)) setSaving(false);
    }
  };
  const theme = document.documentElement.dataset.theme ?? "classic";
  const world =
    theme === "taylor"
      ? view === "personal"
        ? "The midnight studio"
        : "The shared scrapbook"
      : theme === "newfoundland"
        ? view === "personal"
          ? "The lighthouse keeper’s desk"
          : "The harbour workshop"
        : view === "personal"
          ? "Your little workshop"
          : "The household workshop";
  const select = (id: string) => {
    setSelected(id);
    setCreating(false);
    setError("");
    setReceipt("");
  };
  return (
    <div
      className="kitty-room"
      data-view={view}
      data-world={theme}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kitty-room-title"
      ref={dialog}
    >
      <header className="kitty-room-header">
        <button
          type="button"
          className="kitty-back"
          onClick={onClose}
          disabled={saving}
        >
          ← Back to {returnTo}
        </button>
        <div>
          <span className="kitty-eyebrow">
            {view === "personal"
              ? "Personal · only you"
              : "Shared · our future"}
          </span>
          <h1 id="kitty-room-title">Kitty Banks</h1>
        </div>
        <button
          type="button"
          className="kitty-new"
          onClick={() => setCreating(true)}
          disabled={busy || saving}
        >
          ＋ New bank
        </button>
      </header>
      <div className="kitty-room-heading">
        <p>{world}</p>
        <span>A place for the things you’re making possible.</span>
      </div>
      <nav className="kitty-collection" aria-label="Your Kitty Banks">
        <div className="kitty-collection-filters">
          {(["active", "archived", "completed"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setSelected("");
                setCreating(false);
              }}
            >
              {value[0]!.toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
        <div className="kitty-bank-tabs">
          {visible.map((item) => (
            <button
              key={item.id}
              aria-pressed={goal?.id === item.id && !creating}
              onClick={() => select(item.id)}
            >
              <span
                className="kitty-seal"
                style={
                  {
                    "--glaze": sealColor(item),
                  } as CSSProperties
                }
                aria-hidden="true"
              >
                ♧
              </span>
              <span>
                {item.name}
                <small>
                  {initialEnvelope(item, context).kind}
                  {item.envelope?.archivedAt ? " · archived" : ""}
                </small>
              </span>
            </button>
          ))}
        </div>
      </nav>
      {error && (
        <p className="kitty-notice is-error" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </p>
      )}
      {receipt && (
        <p className="kitty-notice" role="status">
          ✓ {receipt}
        </p>
      )}
      {creating || !goal ? (
        <CreateBank
          key={creating ? "new" : "empty"}
          view={view}
          memberId={memberId}
          busy={busy || saving}
          onCancel={goal ? () => setCreating(false) : undefined}
          onCreate={async (input) => {
            let id = "";
            const saved = await run((current) => {
              const result = addGoal(current, input);
              id = result.postedIds[0]!;
              return result;
            }, "Bank created. Your new purpose is ready for its first plan.");
            if (saved) {
              setFilter("active");
              setStudioFor(id);
              select(id);
            }
            return saved;
          }}
        />
      ) : (
        <Bank
          key={goal.id}
          goal={goal}
          h={h}
          today={todayKey()}
          view={view}
          memberId={memberId}
          context={context}
          busy={busy || saving}
          submitError={error}
          celebrate={Boolean(receipt)}
          identity={identity}
          initialPage={studioFor === goal.id ? "studio" : "bank"}
          run={run}
          readLatest={() => latest.current}
        />
      )}
      {recovery && (
        <ConfirmSheet
          title={recovery.title}
          body="This bank has a change whose acceptance was not confirmed before the page closed."
          extra="Check the original submission before starting another money change."
          notice={error || undefined}
          confirmLabel="Check saved status"
          cancelDisabled
          busy={saving || busy}
          onCancel={() => {}}
          onConfirm={() => {
            const review: Review = {
              ...recovery,
              attempted: true,
              body: "",
              extra: "",
              basis: "",
              command: () => {
                throw new Error(
                  "The original submission was not found. Review the current bank before making a new change.",
                );
              },
            };
            void run(
              review.command,
              "The original change was accepted. Your bank is up to date.",
              review,
            );
          }}
        />
      )}
      <footer className="kitty-room-footer">
        <span>One bank. Every chapter.</span>
        <p>
          Plan chooses the next step. Your books hold the receipts. Your bank
          keeps the purpose.
        </p>
      </footer>
    </div>
  );
}
function CreateBank({
  view,
  memberId,
  busy,
  onCreate,
  onCancel,
}: {
  view: LedgerView;
  memberId: string;
  busy: boolean;
  onCreate: (input: Parameters<typeof addGoal>[1]) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(""),
    [target, setTarget] = useState(""),
    [envelope, setEnvelope] = useState(() => ({
      ...defaultGoalEnvelope(),
      studio: {
        version: 1 as const,
        draft: newKittyPiece(crypto.randomUUID().slice(0, 8), new Date().toISOString(), "cream"),
        fired: [],
      },
    }));
  return (
    <div className="kitty-room-spread">
      <KittyStage piece={envelope.studio.draft} glaze={envelope.glaze} open={true} name="New bank" />
      <form
        className="kitty-folio"
        onSubmit={(event) => {
          event.preventDefault();
          void onCreate({
            name,
            target,
            shared: view === "household",
            ownerMemberId: view === "personal" ? memberId : null,
            envelope,
          });
        }}
      >
        <span className="kitty-eyebrow">The first page</span>
        <h2>What are we making room for?</h2>
        <p>Two things to start. Everything else can wait, or never happen at all.</p>
        <label>
          Bank name
          <input
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="A slower week away"
          />
        </label>
        <label>
          How much (CAD)
          <input
            required
            inputMode="decimal"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="2,000"
          />
        </label>
        <details className="kitty-optional">
          <summary>Say more (optional)</summary>
          <label>
            Why this one
            <textarea
              maxLength={1000}
              value={envelope.purpose}
              onChange={(event) =>
                setEnvelope({ ...envelope, purpose: event.target.value })
              }
              placeholder="What will this make possible?"
            />
          </label>
          <label>
            Belongs in
            <select
              value={envelope.kind}
              onChange={(event) =>
                setEnvelope({
                  ...envelope,
                  kind: event.target.value as typeof envelope.kind,
                })
              }
            >
              <option value="build">Build · a future we choose</option>
              <option value="protect">Protect · a promise or cushion</option>
              <option value="prepare">Prepare · a cost that comes around</option>
            </select>
          </label>
        </details>
        <div className="kitty-actions">
          <button
            className="kitty-primary"
            disabled={busy || !name.trim() || !fillDraftCents(target)}
          >
            Create {view === "personal" ? "personal" : "shared"} bank
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
        <small>
          This makes the bank and a lump of clay to shape next. It does not
          assign or move money.
        </small>
      </form>
    </div>
  );
}
function Bank({
  goal,
  h,
  today,
  view,
  memberId,
  context,
  busy,
  submitError,
  celebrate,
  identity,
  initialPage,
  run,
  readLatest,
}: {
  goal: Goal;
  h: Household;
  today: string;
  view: LedgerView;
  memberId: string;
  context?: KittyPlanContext;
  busy: boolean;
  submitError: string;
  celebrate: boolean;
  identity: string;
  initialPage: "bank" | "studio";
  run: (
    command: (h: Household) => CommitResult,
    message: string,
    review?: Review,
  ) => Promise<boolean>;
  readLatest: () => Household;
}) {
  const bankRef = useRef<HTMLDivElement>(null);
  const [planStatus, setPlanStatus] = useState("");
  const savePlan = async (action: () => Promise<boolean>) => {
    setPlanStatus("");
    try {
      const saved = await action();
      setPlanStatus(
        saved
          ? "Saved to your private Plan."
          : "This Plan change was not saved. Your choices are still here; return to Plan to review its latest state.",
      );
    } catch (cause) {
      setPlanStatus(
        cause instanceof Error
          ? cause.message
          : "This Plan change was not saved.",
      );
    }
  };
  const [page, setPage] = useState<
      "bank" | "studio" | "plan" | "money" | "history"
    >(initialPage),
    [open, setOpen] = useState(true),
    [editing, setEditing] = useState(false);
  const [editBasis, setEditBasis] = useState(goal.updatedAt);
  const [name, setName] = useState(goal.name),
    [target, setTarget] = useState(String(goal.targetCents / 100)),
    [arrival, setArrival] = useState(goal.arrivalDate ?? ""),
    [envelope, setEnvelope] = useState(initialEnvelope(goal, context));
  const [amount, setAmount] = useState(""),
    [source, setSource] = useState(""),
    [spend, setSpend] = useState(""),
    [note, setNote] = useState(""),
    [category, setCategory] = useState(goal.subcategoryId ?? "SUB-LIFE-FUN"),
    [date, setDate] = useState(today);
  const [pending, setPending] = useState<Review | null>(null),
    [planLineId, setPlanLineId] = useState(context?.lineId ?? ""),
    [previewAmount, setPreviewAmount] = useState(""),
    [scenarioName, setScenarioName] = useState("");
  const info = useMemo(
    () => bankEvidence(h, goal, today, memberId, view),
    [h, goal, today, memberId, view],
  );
  const step = useMemo(
    () => kittyBankBackingStep(h, goal, today),
    [h, goal, today],
  );
  const studio = useKittyStudio({
    goal,
    identity,
    memberId,
    envelope: initialEnvelope(goal, context),
    active: page === "studio",
    run,
    readLatest,
  });
  const linked =
    context?.selection.lines.filter(
      (line) =>
        (line.sourceReference?.type === "goal" &&
          line.sourceReference.id === goal.id) ||
        line.envelopeGoalId === goal.id,
    ) ?? [];
  const chosen = linked.find((line) => line.id === planLineId) ?? linked[0];
  const proposed = linked
    .filter((line) => line.sourceReference?.type === "goal")
    .reduce((sum, line) => sum + line.amountCents, 0);
  const capacities = goalVaultCapacity(h, goal.id, date),
    fund = h.householdFund ? projectHouseholdFund(h, date) : null;
  const ownCash = h.accounts.filter(
    (account) =>
      account.active &&
      isCashLikeKind(account.kind) &&
      account.id !== goalsVaultAccount(h)?.id &&
      (view === "personal"
        ? account.scope === "personal" && account.ownerMemberId === memberId
        : account.scope !== "personal"),
  );
  const total = info.vaultCents + info.fund.reservedCents,
    archived = Boolean(goal.envelope?.archivedAt),
    completed = goal.status === "retired";
  const review = (
    title: string,
    body: string,
    extra: string,
    command: (h: Household) => CommitResult,
  ) =>
    setPending({
      id: crypto.randomUUID(),
      title,
      body,
      extra,
      command,
      basis: basis(h),
    });
  const reviewCurrent = pending?.basis === basis(h);
  const changedLines =
    chosen && fillDraftCents(previewAmount) !== null
      ? context?.selection.lines.map((line) =>
          line.id === chosen.id
            ? {
                ...line,
                amountCents: fillDraftCents(previewAmount)!,
                decision: {
                  ...line.decision,
                  contributionSchedule: undefined,
                  scheduleActualCents: undefined,
                },
              }
            : line,
        )
      : undefined;
  const preview =
    changedLines && context
      ? projectPlan(h, {
          memberId,
          scope: view,
          acceptedRevision: h.revision,
          asOf: today,
          through: context.projection.through,
          selection: { ...context.selection, lines: changedLines },
        })
      : null;
  const selectedProjection = chosen
    ? context?.projection.lines.find((row) => row.line.id === chosen.id)
    : undefined;
  const schedule =
    chosen && selectedProjection
      ? preparePlanSchedule(chosen, selectedProjection, today)
      : null;
  return (
    <>
      <div className="kitty-mobile-backing">
        <span>
          In the vault <strong>{formatCad(info.vaultCents)}</strong>
        </span>
        {view === "household" && (
          <span>
            In the Fund{" "}
            <strong>
              {info.fund.unresolved
                ? "Review history"
                : formatCad(info.fund.reservedCents)}
            </strong>
          </span>
        )}
      </div>
      <div
        className="kitty-room-spread"
        ref={bankRef}
        data-goal-id={goal.id}
        data-page={page}
        tabIndex={-1}
      >
        <section className="kitty-object">
          <KittyStage
            piece={studio.stagePiece}
            glaze={envelope.glaze}
            open={open}
            name={goal.name}
            step={step}
            celebrate={celebrate}
            fired={studio.stageFired}
            mode={studio.mode}
            spin={studio.spin}
            brush={studio.stageBrush}
            apiRef={studio.apiRef}
            onPaint={(hit, phase) => studio.onPaintRef.current?.(hit, phase)}
            onThrow={(dy) => studio.onThrowRef.current?.(dy)}
            onFlatChange={studio.setFlat}
          />
          <div className="kitty-nameplate">
            <span>
              {goal.envelope?.kind ?? linked[0]?.lens ?? "Build"} ·{" "}
              {archived
                ? "Archived"
                : completed
                  ? "Completed"
                  : "Your envelope"}
            </span>
            <h2>{goal.name}</h2>
            <button
              type="button"
              aria-pressed={open}
              onClick={() => setOpen(!open)}
            >
              {open ? "Close the little door" : "Open this bank"}
            </button>
          </div>
          <fieldset className="kitty-glazes">
            <legend>Try a glaze</legend>
            {Object.entries(KITTY_GLAZES).map(([key, color]) => (
              <button
                type="button"
                key={key}
                aria-label={`${key} glaze`}
                aria-pressed={envelope.glaze === key}
                style={{ "--glaze": color } as CSSProperties}
                onClick={() => {
                  if (!editing) {
                    setEditBasis(goal.updatedAt);
                    setName(goal.name);
                    setTarget(String(goal.targetCents / 100));
                    setArrival(goal.arrivalDate ?? "");
                  }
                  setEnvelope({
                    ...(!editing ? initialEnvelope(goal, context) : envelope),
                    glaze: key as typeof envelope.glaze,
                  });
                  setEditing(true);
                }}
              />
            ))}
          </fieldset>
          <p className="kitty-caption">
            A little work of art. A very real purpose.
          </p>
        </section>
        <section className="kitty-folio">
          <nav className="kitty-folio-tabs" aria-label="Inside this bank">
            {(["bank", "studio", "plan", "money", "history"] as const).map((value) => (
              <button
                key={value}
                aria-current={page === value ? "page" : undefined}
                onClick={() => setPage(value)}
              >
                {
                  {
                    bank: "This bank",
                    studio: "Studio",
                    plan: "Its plan",
                    money: "Use money",
                    history: "History",
                  }[value]
                }
              </button>
            ))}
          </nav>
          <div className="kitty-totals">
            <div>
              <span>In the vault</span>
              <strong>{formatCad(info.vaultCents)}</strong>
            </div>
            {view === "household" && (
              <div>
                <span>Reserved in the Fund</span>
                <strong>
                  {info.fund.unresolved
                    ? "Review history"
                    : formatCad(info.fund.reservedCents)}
                </strong>
              </div>
            )}
            <div className="kitty-proposed">
              <span>
                Plan for {context?.selection.monthKey ?? "this month"}
              </span>
              <strong>{context ? formatCad(proposed) : "Open Plan"}</strong>
              <small>This month’s intention</small>
            </div>
          </div>
          {info.error && <p role="alert">{info.error}</p>}
          {info.fund.unresolved && view === "household" && (
            <p>
              A past Fund release has no bank identity. Review it in the Fund
              before relying on this bank’s allocation.
            </p>
          )}
          {page === "studio" && (
            <StudioBench state={studio} goal={goal} busy={busy} step={step} />
          )}
          {page === "bank" && (
            <>
              <span className="kitty-eyebrow">The reason it exists</span>
              <h3>
                {goal.envelope?.purpose || "A little room for your future."}
              </h3>
              <div className="kitty-target">
                <div>
                  <span>{formatCad(total)} backed reserve</span>
                  <strong>Target {formatCad(goal.targetCents)}</strong>
                </div>
                <progress
                  aria-label="Backed reserve toward target"
                  max={Math.max(1, goal.targetCents)}
                  value={Math.min(total, goal.targetCents)}
                />
                <p>
                  {goal.arrivalDate
                    ? `Aiming for ${goal.arrivalDate}. `
                    : "Choose a date when the timing matters. "}
                  {formatCad(Math.max(0, goal.targetCents - total))} still to
                  prepare.
                </p>
              </div>
              <div className="kitty-actions">
                <button
                  className="kitty-primary"
                  disabled={archived || completed}
                  onClick={() => setPage("money")}
                >
                  Give this bank a job
                </button>
                <button
                  onClick={() => {
                    if (!editing) {
                      setEditBasis(goal.updatedAt);
                      setName(goal.name);
                      setTarget(String(goal.targetCents / 100));
                      setArrival(goal.arrivalDate ?? "");
                      setEnvelope(initialEnvelope(goal, context));
                    }
                    setEditing(!editing);
                  }}
                >
                  {editing ? "Close details" : "Edit purpose & style"}
                </button>
              </div>
              {editing && (
                <form
                  className="kitty-details"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(
                      (current) =>
                        saveGoalEnvelope(current, {
                          goalId: goal.id,
                          expectedUpdatedAt: editBasis,
                          name,
                          target,
                          arrivalDate: arrival,
                          envelope,
                          createdBy: memberId,
                        }),
                      "Bank details saved.",
                    ).then((saved) => {
                      if (saved) {
                        setEditing(false);
                        bankRef.current?.focus();
                      }
                    });
                  }}
                >
                  <label>
                    Name
                    <input
                      value={name}
                      required
                      maxLength={100}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  <div className="kitty-fields">
                    <label>
                      Target (CAD)
                      <input
                        required
                        inputMode="decimal"
                        value={target}
                        onChange={(event) => setTarget(event.target.value)}
                      />
                    </label>
                    <label>
                      Aim for
                      <input
                        type="date"
                        value={arrival}
                        onChange={(event) => setArrival(event.target.value)}
                      />
                    </label>
                  </div>
                  <details className="kitty-optional" open={Boolean(envelope.purpose)}>
                    <summary>Say more (optional)</summary>
                    <label>
                      Purpose
                      <textarea
                        maxLength={1000}
                        value={envelope.purpose}
                        onChange={(event) =>
                          setEnvelope({
                            ...envelope,
                            purpose: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Purpose type
                      <select
                        value={envelope.kind}
                        onChange={(event) =>
                          setEnvelope({
                            ...envelope,
                            kind: event.target.value as typeof envelope.kind,
                          })
                        }
                      >
                        <option value="protect">Protect</option>
                        <option value="prepare">Prepare</option>
                        <option value="build">Build</option>
                      </select>
                    </label>
                    <label>
                      After using it
                      <select
                        value={envelope.refill}
                        onChange={(event) =>
                          setEnvelope({
                            ...envelope,
                            refill: event.target.value as typeof envelope.refill,
                          })
                        }
                      >
                        <option value="target">
                          Keep saving toward the target
                        </option>
                        <option value="refill">Refill when needed</option>
                        <option value="repeat">Prepare for the next cycle</option>
                      </select>
                    </label>
                  </details>
                  <button disabled={busy || !fillDraftCents(target)}>
                    Save details & glaze
                  </button>
                  <small>
                    Money, schedules and existing Plan agreements keep their own
                    review.
                  </small>
                </form>
              )}
              <details className="kitty-removal">
                <summary tabIndex={0}>Remove from the active room</summary>
                <p>
                  Archive keeps the bank, its money and its history. Standing
                  orders and existing Plan decisions remain linked; review them
                  separately.
                </p>
                {goalEnvelopeDependencies(h, goal.id, memberId, view).map(
                  (item) => (
                    <p key={item}>↗ {item}</p>
                  ),
                )}
                <button
                  disabled={busy || completed}
                  onClick={() =>
                    review(
                      archived ? "Restore this bank" : "Archive this bank",
                      `${goal.name}: ${formatCad(info.vaultCents)} in the vault${view === "household" ? `, ${formatCad(info.fund.reservedCents)} earmarked in the Fund` : ""}.`,
                      "This changes which collection shows the bank. It does not release money, cancel orders or remove receipts.",
                      (current) =>
                        saveGoalEnvelope(current, {
                          goalId: goal.id,
                          expectedUpdatedAt: goal.updatedAt,
                          name: goal.name,
                          target: goal.targetCents / 100,
                          arrivalDate: goal.arrivalDate,
                          envelope: {
                            ...initialEnvelope(goal, context),
                            archivedAt: archived
                              ? null
                              : `${date}T12:00:00.000Z`,
                          },
                          createdBy: memberId,
                        }),
                    )
                  }
                >
                  {archived ? "Review restore" : "× Review archive"}
                </button>
              </details>
            </>
          )}
          {page === "plan" && (
            <>
              <span className="kitty-eyebrow">A purpose across chapters</span>
              <h3>The bank stays. The plan evolves.</h3>
              {planStatus && <p role="status">{planStatus}</p>}
              <Whisper mode="aside" id="kitty.plan-lenses" label="What these mean">Protect keeps promises, Prepare anticipates recurring costs, and Build makes room for an outcome. Each can refer to this same bank.</Whisper>
              {linked.map((line) => (
                <button
                  className="kitty-linked-plan"
                  key={line.id}
                  onClick={() => setPlanLineId(line.id)}
                  aria-pressed={chosen?.id === line.id}
                >
                  <span>
                    {line.lens} · {line.labelSnapshot}
                  </span>
                  <strong>{formatCad(line.amountCents)}</strong>
                  <small>{line.dueDate ?? "Date to choose"}</small>
                </button>
              ))}
              {context && (
                <label>
                  Link a future-facing decision
                  <select
                    value=""
                    disabled={busy || archived || completed}
                    onChange={(event) => {
                      const line = context.selection.lines.find(
                        (row) => row.id === event.target.value,
                      );
                      if (line)
                        void savePlan(() =>
                          context.onSaveLine(
                            { ...line, envelopeGoalId: goal.id },
                            line,
                          ),
                        );
                    }}
                  >
                    <option value="">Choose a Plan decision</option>
                    {context.selection.lines
                      .filter(
                        (line) =>
                          ["protect", "prepare", "build"].includes(line.lens) &&
                          (!line.sourceReference ||
                            line.sourceReference.type !== "goal" ||
                            line.sourceReference.id === goal.id),
                      )
                      .map((line) => (
                        <option key={line.id} value={line.id}>
                          {line.lens} · {line.labelSnapshot}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {!linked.length && (
                <p>
                  Link a decision in this month’s private draft. A link
                  identifies the bank; it does not mark an obligation paid.
                </p>
              )}
              {schedule && (
                <div className="kitty-paydays">
                  <h4>Small steps, real paydays</h4>
                  {schedule.schedule.length ? (
                    schedule.schedule.map((row) => (
                      <div key={row.date}>
                        <span>{row.date}</span>
                        <strong>{formatCad(row.amountCents)}</strong>
                      </div>
                    ))
                  ) : (
                    <p>
                      Add real paydays to the linked Plan decision to build its
                      schedule.
                    </p>
                  )}
                </div>
              )}
              {chosen && context && (
                <div className="kitty-rehearsal">
                  <span className="kitty-eyebrow">
                    Try a different pace · no money moves
                  </span>
                  <label>
                    This month’s contribution (CAD)
                    <input
                      inputMode="decimal"
                      value={previewAmount}
                      onChange={(event) => setPreviewAmount(event.target.value)}
                      placeholder={String(chosen.amountCents / 100)}
                    />
                  </label>
                  {preview && (
                    <div aria-live="polite">
                      <p>
                        Lowest dated capacity:{" "}
                        <strong>
                          {preview.lowPoint
                            ? formatCad(preview.lowPoint.balanceCents)
                            : "Evidence to review"}
                        </strong>
                      </p>
                      <p>
                        Everyday from current money:{" "}
                        <strong>
                          {preview.everydayNowCents === null
                            ? "Evidence to review"
                            : formatCad(preview.everydayNowCents)}
                        </strong>
                      </p>
                      {preview.firstExposed && (
                        <p>
                          First exposed: {preview.firstExposed.label} ·{" "}
                          {preview.firstExposed.date}
                        </p>
                      )}
                    </div>
                  )}
                  <label>
                    Name this possibility
                    <input
                      value={scenarioName}
                      onChange={(event) => setScenarioName(event.target.value)}
                      placeholder="A little more room this month"
                    />
                  </label>
                  <button
                    disabled={busy || !changedLines || !scenarioName.trim()}
                    onClick={() =>
                      changedLines &&
                      void savePlan(() =>
                        context.onScenario(scenarioName.trim(), changedLines),
                      )
                    }
                  >
                    Keep as a private scenario
                  </button>
                  <button
                    onClick={() => {
                      context.onClose();
                      context.onAsk(
                        `Help me explore ${goal.name} in this Plan, with its real backing, next paydays and time constraints.`,
                        undefined,
                        chosen.id,
                      );
                    }}
                  >
                    Explore with Hercules
                  </button>
                </div>
              )}
            </>
          )}
          {page === "money" && (
            <>
              <span className="kitty-eyebrow">Make the next step real</span>
              <h3>Assign. Use. Refill.</h3>
              <p>
                Every change gets one review and a Final Confirm. Hearth records
                your books; it does not move money at your bank.
              </p>
              {archived || completed ? (
                <p>
                  {archived
                    ? "Restore the bank before assigning or using money."
                    : "This bank is completed. Its receipts remain in History."}
                </p>
              ) : (
                <>
                  <label>
                    Date
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </label>
                  <section className="kitty-money-action">
                    <h4>Add to this bank</h4>
                    <label>
                      Amount (CAD)
                      <input
                        inputMode="decimal"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                      />
                    </label>
                    {view === "personal" ? (
                      <>
                        <label>
                          Record transfer from
                          <select
                            value={source}
                            onChange={(event) => setSource(event.target.value)}
                          >
                            <option value="">Choose your cash account</option>
                            {ownCash.map((account) => (
                              <option value={account.id} key={account.id}>
                                {account.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          disabled={busy || !source || !fillDraftCents(amount)}
                          onClick={() =>
                            review(
                              "Fund this bank",
                              `Record ${formatCad(fillDraftCents(amount)!)} from ${h.accounts.find((row) => row.id === source)?.name} to Goals savings for ${goal.name}, on ${date}.`,
                              `Personal · only you. A transfer and matching contribution will be recorded.`,
                              (current) =>
                                fundGoal(current, {
                                  goalId: goal.id,
                                  amount,
                                  fromAccountId: source,
                                  date,
                                  createdBy: memberId,
                                  visibility: view,
                                }),
                            )
                          }
                        >
                          Review contribution
                        </button>
                      </>
                    ) : (
                      <>
                        <p>
                          Fund surplus available to allocate:{" "}
                          {fund
                            ? formatCad(fund.safeRolloverCents)
                            : "Open the Household Fund first"}
                          .
                        </p>
                        <button
                          disabled={
                            busy ||
                            !fillDraftCents(amount) ||
                            h.householdFund?.custodianMemberId !== memberId
                          }
                          onClick={() =>
                            review(
                              "Reserve Fund money",
                              `Earmark ${formatCad(fillDraftCents(amount)!)} for ${goal.name} on ${date}.`,
                              "Shared money stays in the Household Fund and is reserved once. Only the Fund custodian can confirm this allocation.",
                              (current) =>
                                allocateHouseholdFundSurplus(current, {
                                  memberId,
                                  date,
                                  allocations: [{ goalId: goal.id, amount }],
                                  note: `Reserve for ${goal.name}`,
                                }),
                            )
                          }
                        >
                          Review Fund assignment
                        </button>
                        {h.householdFund?.custodianMemberId !== memberId && (
                          <p>The Fund custodian confirms shared assignments.</p>
                        )}
                      </>
                    )}
                  </section>
                  <section className="kitty-money-action">
                    <h4>Record a purchase & keep the bank</h4>
                    <p>
                      {formatCad(info.vaultCents)} currently backed in the
                      vault. This purchase leaves the bank open for its next
                      contribution.
                    </p>
                    <label>
                      Spent (CAD)
                      <input
                        inputMode="decimal"
                        value={spend}
                        onChange={(event) => setSpend(event.target.value)}
                      />
                    </label>
                    <label>
                      What was it for?
                      <input
                        value={note}
                        maxLength={80}
                        onChange={(event) => setNote(event.target.value)}
                      />
                    </label>
                    <label>
                      Expense category
                      <select
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                      >
                        {h.categories
                          .filter(
                            (row) =>
                              row.recordType === "category" &&
                              row.transactionType === "expense" &&
                              row.active,
                          )
                          .map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button
                      disabled={
                        busy ||
                        !fillDraftCents(spend) ||
                        !note.trim() ||
                        capacities.kind !== "ready" ||
                        info.vaultCents < fillDraftCents(spend)!
                      }
                      onClick={() =>
                        review(
                          "Use this bank’s vault money",
                          `Record ${formatCad(fillDraftCents(spend)!)} for ${note}, from Goals savings on ${date}.`,
                          `${goal.name} stays open. The receipt reduces this bank’s remaining reserve; lifetime contributions remain in History.`,
                          (current) =>
                            purchaseGoal(current, {
                              goalId: goal.id,
                              amount: spend,
                              keepOpen: true,
                              lines: [{ note, amount: spend }],
                              subcategoryId: category,
                              date,
                              createdBy: memberId,
                              visibility: view,
                            }),
                        )
                      }
                    >
                      Review purchase
                    </button>
                  </section>
                  {view === "household" && (
                    <section className="kitty-money-action">
                      <h4>Return earmarked money to the Fund</h4>
                      <p>
                        For Fund-backed costs, release this bank’s earmark, then
                        review the real payment in the Fund. A release is not a
                        purchase.
                      </p>
                      <label>
                        Release (CAD)
                        <input
                          aria-label="Fund release amount"
                          inputMode="decimal"
                          value={spend}
                          onChange={(event) => setSpend(event.target.value)}
                        />
                      </label>
                      <button
                        disabled={
                          busy ||
                          !fillDraftCents(spend) ||
                          info.fund.unresolved ||
                          info.fund.reservedCents < fillDraftCents(spend)! ||
                          h.householdFund?.custodianMemberId !== memberId
                        }
                        onClick={() =>
                          review(
                            "Release this bank’s earmark",
                            `Return ${formatCad(fillDraftCents(spend)!)} from ${goal.name} to the Fund’s operating pool.`,
                            "This records the exact bank identity. No payment or bank transfer is recorded.",
                            (current) =>
                              releaseHouseholdFundKitty(current, {
                                memberId,
                                date,
                                goalId: goal.id,
                                amount: spend,
                                note: `Release ${goal.name}`,
                              }),
                          )
                        }
                      >
                        Review release
                      </button>
                    </section>
                  )}
                </>
              )}
            </>
          )}
          {page === "history" && (
            <>
              <span className="kitty-eyebrow">
                The bank’s story, from receipts
              </span>
              <h3>Every little step stays here.</h3>
              <p>
                Lifetime recorded contributions: {formatCad(goal.savedCents)}.
                Net attributed partial use: {formatCad(info.usedCents)}.
              </p>
              <ol className="kitty-history">
                {[
                  ...(h.goalContributions ?? [])
                    .filter((row) => row.goalId === goal.id)
                    .map((row) => ({
                      id: row.id,
                      date: row.date,
                      label: row.transferId
                        ? "Vault contribution"
                        : "Recorded progress · backing to review",
                      amount: row.amountCents,
                    })),
                  ...(h.goalPurchases ?? [])
                    .filter((row) => row.goalId === goal.id)
                    .map((row) => ({
                      id: row.id,
                      date: row.date,
                      label: row.envelopeUse
                        ? "Used from this bank · kept open"
                        : "Completed purchase",
                      amount: -row.spentCents,
                    })),
                  ...(h.fundKittyAllocations ?? [])
                    .filter((row) => row.goalId === goal.id)
                    .map((row) => ({
                      id: row.id,
                      date:
                        h.fundEvents?.find((event) => event.id === row.eventId)
                          ?.date ?? row.createdAt.slice(0, 10),
                      label: "Fund allocation · see current backing above",
                      amount: row.amountCents,
                    })),
                  ...(h.fundEvents ?? [])
                    .filter(
                      (row) =>
                        row.goalId === goal.id && row.kind === "kitty-released",
                    )
                    .map((row) => ({
                      id: row.id,
                      date: row.date,
                      label: "Released to Fund",
                      amount: -row.amountCents,
                    })),
                ]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((row) => (
                    <li key={row.id}>
                      <time>{row.date}</time>
                      <span>{row.label}</span>
                      <strong>{formatCad(row.amount)}</strong>
                      <small>{row.id}</small>
                    </li>
                  ))}
              </ol>
              {!goal.savedCents && !info.fund.allocatedCents && (
                <p>
                  The first page is still blank. Choose the next step when
                  you’re ready.
                </p>
              )}
              <p>
                Corrections and refunds remain on the books. Current backing
                above reflects their exact linked receipts.
              </p>
            </>
          )}
        </section>
      </div>
      {pending && (
        <ConfirmSheet
          returnFocusFallback={() => bankRef.current}
          title={pending.title}
          body={pending.body}
          extra={pending.extra}
          cancelDisabled={pending.attempted}
          confirmLabel={
            pending.attempted ? "Check saved status" : "Final Confirm"
          }
          busy={busy}
          confirmDisabled={!reviewCurrent && !pending.attempted}
          notice={
            submitError ||
            (pending.attempted
              ? "Check this change’s saved status before closing its review. This keeps a delayed response from becoming a duplicate."
              : !reviewCurrent
                ? "The bank or books changed. Cancel and review the current facts."
                : undefined)
          }
          onCancel={() => {
            if (!pending.attempted) setPending(null);
          }}
          onConfirm={() => {
            const review = pending;
            void run(
              (current) => {
                if (
                  review.basis !== basis(readLatest()) ||
                  review.basis !== basis(current)
                )
                  throw new Error("The bank or books changed. Review again.");
                return review.command(current);
              },
              "Saved to the books. Your bank is up to date.",
              review,
            ).then((saved) => {
              if (saved) {
                setPending(null);
                setAmount("");
                setSpend("");
                requestAnimationFrame(() =>
                  bankRef.current?.focus({ preventScroll: true }),
                );
              }
            });
          }}
        />
      )}
    </>
  );
}
