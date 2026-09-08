import { SharedFundTrust } from "./FundTrust.tsx";
import type { ScenarioSourceContext } from "./scenarioSourceContext.ts";
import "./phone-fund-readings.css";
import { useMemo, type Ref } from "react";
import {
  askBelongsOnDesk, categoryShape, fundPlates, fundWalk, fundWeek,
  fundWidgetIdForPlateId, monthKeyFromDateKey, moveAskGoalClaimToNextMonth,
  twoStreams, widgetAllowedFor,
  type CommitResult, type DeskPlateModel, type FundWidgetId, type Household, type LedgerView,
} from "./core/index.ts";
import { Level } from "./Level.tsx";
import { Ask } from "./Ask.tsx";
import { NextOutStage } from "./NextOutStage.tsx";
import { WeekStage } from "./WeekStage.tsx";
import { WaitingStage } from "./WaitingStage.tsx";
import { SettleStage } from "./SettleStage.tsx";
import { ShapeStage } from "./ShapeStage.tsx";
import { StreamsStage } from "./StreamsStage.tsx";
import { AccountsStage } from "./AccountsStage.tsx";
import { PlateFigureView } from "./DeskPlates.tsx";
import { FUND_WIDGET_CARD } from "./FundDrawer.tsx";

export type FundDestination = "swipe" | "contribute" | "record" | "minutes" | "seven-days" | "shelf";

/** One renderer for the desk and phone; detent motion is never an input. */
export function FundStage({ widgetId, household, memberId, today, busy, headingRef, view = "household",
  onKitchen, onOpenAccount, onOpenDestination, plate, onOpenCabinet, presentation = "desk", scenarioSource,
}: {
  view?: LedgerView;
  presentation?: "phone" | "desk";
  scenarioSource?: ScenarioSourceContext | null;
  widgetId: FundWidgetId; household: Household; memberId: string; today: string; busy: boolean;
  headingRef?: Ref<HTMLHeadingElement>; plate?: DeskPlateModel | null;
  onKitchen: (fn: (current: Household) => CommitResult) => void;
  onOpenAccount: (accountId: string) => void;
  onOpenDestination: (destination: FundDestination) => void;
  onOpenCabinet?: (plate: DeskPlateModel) => void;
}) {
  const allowed = household.members.some(member => member.id === memberId && member.active)
    && widgetAllowedFor(widgetId, household, memberId);
  const walk = useMemo(() => allowed && ["level", "next-out", "spoken-for"].includes(widgetId)
    ? fundWalk(household, monthKeyFromDateKey(today), today) : null, [allowed, household, today, widgetId]);
  const week = useMemo(() => allowed && widgetId === "week" ? fundWeek(household, today) : null, [allowed, household, today, widgetId]);
  const shape = useMemo(() => allowed && widgetId === "shape" ? categoryShape(household, monthKeyFromDateKey(today), today) : [], [allowed, household, today, widgetId]);
  const streams = useMemo(() => allowed && widgetId === "streams" ? twoStreams(household, today) : [], [allowed, household, today, widgetId]);
  const fallbackPlate = useMemo(() => allowed && widgetId === "shelf"
    ? plate ?? fundPlates({ household, memberId, today }).find(row => fundWidgetIdForPlateId(row.id) === widgetId)
    : null, [allowed, household, memberId, today, widgetId, plate]);
  const nameOf = (id: string | null | undefined) => household.members.find(member => member.id === id)?.name ?? "A member";
  const ask = () => <Ask viewerRoom={view} presentation={presentation} scenarioSource={scenarioSource} household={household} today={today} memberId={memberId} busy={busy}
    onMove={alternative => onKitchen(current => moveAskGoalClaimToNextMonth(current, {
      today, memberId, goalId: alternative.goalId, recurrenceId: alternative.recurrenceId, claimDate: alternative.claimDate,
    }))} />;
  if (!allowed) return <p className="desk-plate-empty">This reading is not available on this desk.</p>;
  if (widgetId === "level" && walk && presentation === "phone" && askBelongsOnDesk(memberId, household.householdFund?.custodianMemberId)) return ask();
  if (widgetId === "level" && walk && presentation === "phone") return <SharedFundTrust household={household} memberId={memberId} view={view} today={today} headline headingRef={headingRef} />;
  if (widgetId === "level" && walk) return <><Level compact={presentation === "phone"} walk={walk} household={household} headingRef={headingRef} />{askBelongsOnDesk(memberId, household.householdFund?.custodianMemberId) ? ask() : null}</>;
  if ((widgetId === "next-out" || widgetId === "spoken-for") && walk) return <NextOutStage walk={walk} today={today} headingRef={headingRef} />;
  if (widgetId === "week" && week) return <WeekStage week={week} nameOf={nameOf} headingRef={headingRef} />;
  if (widgetId === "waiting") return <WaitingStage household={household} memberId={memberId} today={today} onKitchen={onKitchen} headingRef={headingRef} />;
  if (widgetId === "settle") return <SettleStage household={household} memberId={memberId} today={today} busy={busy} onKitchen={onKitchen} headingRef={headingRef} />;
  if (widgetId === "shape") return <ShapeStage compact={presentation === "phone"} rows={shape} headingRef={headingRef} />;
  if (widgetId === "streams") return <StreamsStage compact={presentation === "phone"} streams={streams} today={today} nameOf={nameOf} headingRef={headingRef} />;
  if (widgetId === "accounts") return <AccountsStage household={household} memberId={memberId} today={today} onKitchen={onKitchen} onOpenAccount={onOpenAccount} headingRef={headingRef} />;
  if (widgetId === "ask") return ask();
  if (fallbackPlate) return <section className="fund-plate-stage" data-fund-stage={widgetId}>
    <p className="desk-plate-kicker">{fallbackPlate.kicker}</p>
    <h2 ref={headingRef} tabIndex={-1} className="fund-stage-heading">{fallbackPlate.glance}</h2>
    <p className={`desk-plate-detail${fallbackPlate.copperVerdict ? " is-copper" : ""}`}>{fallbackPlate.verdict}</p>
    {fallbackPlate.empty ? <p className="desk-plate-empty">{fallbackPlate.empty}</p> : <div className="fund-stage-figure"><PlateFigureView figure={fallbackPlate.figure} /></div>}
    <p className="desk-plate-foot">{fallbackPlate.footing}</p>
    <button type="button" className="desk-plate-handle" onClick={() => onOpenCabinet ? onOpenCabinet(fallbackPlate) : onOpenDestination("shelf")}>Open {fallbackPlate.cabinetName}</button>
  </section>;
  // These library entries already name existing workspaces, not invented chart models.
  const destination: FundDestination = widgetId === "swipe" || widgetId === "contribute" || widgetId === "minutes" || widgetId === "seven-days" ? widgetId : "record";
  const card = FUND_WIDGET_CARD[widgetId];
  const destinationLabel = destination === "seven-days" ? "activity" : destination === "minutes" ? "More" : destination === "record" ? "the Fund register" : card.name;
  return <section className="fund-plate-stage" data-fund-stage={widgetId}>
    <h2 ref={headingRef} tabIndex={-1} className="fund-stage-heading">{card.name}</h2>
    <p className="desk-plate-detail">{card.line}</p>
    <button type="button" className="desk-plate-handle" onClick={() => onOpenDestination(destination)}>Open {destinationLabel}</button>
  </section>;
}
