import { isValidDateKey } from "./calendar.ts";
import type { FundWalk, WalkPoint } from "./fundWalk.ts";
import type { SharedMonthCourse, CoursePoint, CourseClaim } from "./sharedLedgerStory.ts";
const valid=(month:string,date:string)=>isValidDateKey(date)&&date.slice(0,7)===month;
const unavailable=(reason:string)=>({kind:"unavailable" as const,reason});
/** Select exact prepared points. Scrubbing never changes the model's as-of date or order. */
export function levelTurnReading(walk:FundWalk,date:string){
  if(!valid(walk.monthKey,date))return unavailable("Choose a day in this month.");
  if(!walk.tiesToProjection)return unavailable("This reading does not tie to the books.");
  let actualIndex=-1,projectedIndex=-1;
  walk.points.forEach((point,index)=>{if(point.date<=date){if(point.actual)actualIndex=index;else projectedIndex=index;}});
  const phase=date>walk.today?"projected":"recorded";
  const index=phase==="projected"?projectedIndex:actualIndex;
  const cents=date===walk.today?walk.todayBalanceCents:phase==="projected"?(index>=0?walk.points[index]!.balanceCents:walk.todayBalanceCents):(index>=0?walk.points[index]!.balanceCents:walk.openingCents);
  const todayProjection=date===walk.today&&projectedIndex>=0?walk.points[projectedIndex]!.balanceCents:null;
  const rows:readonly WalkPoint[]=walk.points.filter(point=>point.date===date&&point.kind!=="opening");
  if(!Number.isSafeInteger(cents)||(todayProjection!==null&&!Number.isSafeInteger(todayProjection))||rows.some(row=>!Number.isSafeInteger(row.balanceCents)||!Number.isSafeInteger(row.deltaCents)))return unavailable("These amounts need review before drawing a reading.");
  return {kind:"ready" as const,date,phase,cents,todayProjection,sourceIndex:index,rows};
}
export function courseTurnReading(course:SharedMonthCourse,date:string){
  if(!valid(course.monthKey,date))return unavailable("Choose a day in this month.");
  if(!course.configured)return unavailable("The Fund is not open yet.");
  if(!course.tiesToProjection)return unavailable("This drawing does not tie to the Fund.");
  const rows:readonly CoursePoint[]=course.points.filter(point=>point.date===date&&point.event),claims:readonly CourseClaim[]=course.claims.filter(claim=>claim.date===date);
  if(rows.some(row=>!Number.isSafeInteger(row.operatingCents)||!Number.isSafeInteger(row.kittyCents)||!Number.isSafeInteger(row.event!.amountCents))||claims.some(claim=>!Number.isSafeInteger(claim.amountCents)))return unavailable("These amounts need review before drawing a reading.");
  if(date>course.today)return {kind:"undated-future" as const,date,rows,claims,reason:"No dated Fund projection for this day. Upcoming commitments are an aggregate, not a scheduled closing balance."};
  let sourceIndex=-1;course.points.forEach((point,index)=>{if(point.date<=date)sourceIndex=index;});
  const point=course.points[sourceIndex],operatingCents=point?.operatingCents??course.openingOperatingCents,kittyCents=point?.kittyCents??course.openingKittyCents;
  if(!Number.isSafeInteger(operatingCents)||!Number.isSafeInteger(kittyCents))return unavailable("These amounts need review before drawing a reading.");
  return {kind:"ready" as const,date,operatingCents,kittyCents,sourceIndex,rows,claims};
}

/** Standalone phone Level follows its selected Trust path, not the Walk's excluded sources. */
export function trustTurnReading(walk:FundWalk,trust:import("./fundTrust.ts").FundTrustReading,date:string){
  if(!walk.tiesToProjection||trust.asOf!==walk.today||trust.anchorCents!==walk.todayBalanceCents||!isValidDateKey(trust.asOf)||!isValidDateKey(trust.windowThrough)||trust.windowThrough<trust.asOf||trust.lastSourceDate<trust.asOf||trust.lastSourceDate>trust.windowThrough)return unavailable("The selected sources need a current, tied Fund reading.");
  if(date<walk.today)return levelTurnReading({...walk,points:walk.points.filter(p=>p.actual)},date);
  if(date===walk.today){
    const actual=levelTurnReading({...walk,points:walk.points.filter(p=>p.actual)},date);
    if(actual.kind!=="ready")return actual;
    const lower=trust.lower.future.filter(point=>point.date===date),expected=trust.expected.future.filter(point=>point.date===date);
    if(!lower.length&&!expected.length)return actual;
    const lowerCents=lower.at(-1)?.balanceCents??trust.anchorCents,expectedCents=expected.at(-1)?.balanceCents??trust.anchorCents;
    if(!Number.isSafeInteger(lowerCents)||!Number.isSafeInteger(expectedCents)||lowerCents>expectedCents)return unavailable("The selected source amounts need review.");
    return {kind:"trust-today" as const,date,actualCents:actual.cents,lowerCents,expectedCents,rows:[...actual.rows,...lower]};
  }
  if(!isValidDateKey(date)||date>trust.windowThrough||date>trust.lastSourceDate)return unavailable(`The selected sources stop at ${trust.lastSourceDate}. No later daily projection is drawn.`);
  const last=(points:readonly WalkPoint[])=>{let cents=trust.anchorCents;for(const point of points)if(point.date<=date)cents=point.balanceCents;return cents;};
  const lowerCents=last(trust.lower.future),expectedCents=last(trust.expected.future);
  if(!Number.isSafeInteger(lowerCents)||!Number.isSafeInteger(expectedCents)||lowerCents>expectedCents)return unavailable("The selected source amounts need review.");
  return {kind:"trust-day" as const,date,lowerCents,expectedCents,rows:trust.lower.future.filter(point=>point.date===date)};
}
