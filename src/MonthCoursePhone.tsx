import { useId } from "react";
import { dayOfDateKey, type PaydayTick } from "./core/monthSpread.ts";
import type { SharedMonthCourse } from "./core/sharedLedgerStory.ts";

/** Same prepared operating/Kitty pairs, one scale, the full month on one ruler. */
export function MonthCoursePhone({course,date,ticks}:{course:SharedMonthCourse;date:string;ticks:PaydayTick[]}){
  const id=useId().replace(/:/g,""),width=344,height=180,left=12,right=332,baseline=118,top=18,bottom=162;
  const x=(day:number)=>left+(Math.max(1,Math.min(course.daysInMonth,day))-1)/(course.daysInMonth-1)*(right-left);
  const points=course.points.filter(point=>point.date<=course.today),above=Math.max(0,...points.flatMap(p=>[p.operatingCents,-p.kittyCents])),below=Math.max(0,...points.flatMap(p=>[p.kittyCents,-p.operatingCents]));
  const scale=Math.min(above>0?(baseline-top)/above:Infinity,below>0?(bottom-baseline)/below:Infinity),unit=Number.isFinite(scale)?scale:0;
  const path=(kitty:boolean)=>{let d="";for(const point of points){const px=x(dayOfDateKey(point.date)),py=baseline+(kitty?point.kittyCents:-point.operatingCents)*unit;d+=d?` H ${px} V ${py}`:`M ${px} ${py}`;}return d?`${d} H ${x(dayOfDateKey(course.today))}`:"";};
  const todayX=x(dayOfDateKey(course.today)),selectedX=x(dayOfDateKey(date));
  return <div className="ms-phone-course">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="The full month. Operating and Kitty share one scale. The future is undated.">
      <defs><pattern id={id} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="6" className="ms-hatch-line"/></pattern></defs>
      <rect x={todayX} y={top} width={Math.max(0,right-todayX)} height={bottom-top} fill={`url(#${id})`} opacity=".35"/>
      <line x1={left} x2={right} y1={baseline} y2={baseline} className="ms-baseline"/>
      <path d={path(false)} className="ms-operating-line"/><path d={path(true)} className="ms-kitty-line"/>
      {course.claims.map(claim=><line key={claim.id} x1={x(dayOfDateKey(claim.date))} x2={x(dayOfDateKey(claim.date))} y1={8} y2={16} className={claim.kind==="refund-funded"?"ms-claim is-refund":"ms-claim"}/>)}
      {ticks.map(tick=><line key={tick.date} x1={x(dayOfDateKey(tick.date))} x2={x(dayOfDateKey(tick.date))} y1={bottom} y2={bottom+8} className="ms-payday-tick"/>)}
      <line x1={selectedX} x2={selectedX} y1={4} y2={bottom+6} className={`turn-readhead ${date>course.today?"is-projected":""}`}/>
    </svg>
    <div className="ms-phone-axis"><span>1</span><span>{Math.ceil(course.daysInMonth/2)}</span><span>{course.daysInMonth}</span></div>
  </div>;
}
