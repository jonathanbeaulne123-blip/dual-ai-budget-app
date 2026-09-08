import { trustFixture } from "./fixtures/fund-trust.ts";
import { fundTrustReading } from "../src/core/fundTrust.ts";
import { describe, expect, it } from "vitest";
import { catalogHousehold, fundWalk, sharedMonthCourse, type FundWalk } from "../src/core/index.ts";
import { levelTurnReading, courseTurnReading, trustTurnReading } from "../src/core/turnReading.ts";
function walk():FundWalk{return {...fundWalk(catalogHousehold(),"2026-09","2026-09-08"),tiesToProjection:true,openingCents:10000,todayBalanceCents:12500,points:[
 {date:"2026-09-01",kind:"opening",label:"Opening",deltaCents:0,balanceCents:10000,actual:true,estimated:false,memberId:null,sourceId:null},
 {date:"2026-09-07",kind:"contribution",label:"First",deltaCents:5000,balanceCents:15000,actual:true,estimated:false,memberId:null,sourceId:"first"},
 {date:"2026-09-07",kind:"settlement",label:"Second",deltaCents:-2500,balanceCents:12500,actual:true,estimated:false,memberId:null,sourceId:"second"},
 {date:"2026-09-08",kind:"obligation",label:"Today scheduled",deltaCents:-3000,balanceCents:9500,actual:false,estimated:false,memberId:null,sourceId:"today"},
 {date:"2026-09-10",kind:"obligation",label:"Rent",deltaCents:-16500,balanceCents:-7000,actual:false,estimated:false,memberId:null,sourceId:"rent"},
 ]};}
describe("The Turn exact source selection",()=>{
 it("preserves same-day canonical order and uses the last exact recorded point on blank days",()=>{const w=walk(),before=JSON.stringify(w);const day=levelTurnReading(w,"2026-09-07");expect(day).toMatchObject({kind:"ready",cents:12500,sourceIndex:2});if(day.kind==="ready")expect(day.rows.map(row=>row.sourceId)).toEqual(["first","second"]);expect(levelTurnReading(w,"2026-09-06")).toMatchObject({cents:10000});expect(JSON.stringify(w)).toBe(before);});
 it("keeps today's actual reading separate from its scheduled projection and retains signed future values",()=>{expect(levelTurnReading(walk(),"2026-09-08")).toMatchObject({cents:12500,todayProjection:9500,phase:"recorded"});expect(levelTurnReading(walk(),"2026-09-09")).toMatchObject({cents:9500,phase:"projected"});expect(levelTurnReading(walk(),"2026-09-30")).toMatchObject({cents:-7000,phase:"projected"});});
 it("accepts exact month endpoints including leap day and refuses untied or unsafe readings",()=>{for(const [month,end] of [["2026-02","28"],["2028-02","29"],["2026-04","30"],["2026-07","31"]]){const w={...walk(),monthKey:month!,today:`${month}-01`,points:[]};expect(levelTurnReading(w,`${month}-${end}`).kind).toBe("ready");expect(levelTurnReading(w,`${month}-32`).kind).toBe("unavailable");}expect(levelTurnReading({...walk(),tiesToProjection:false},"2026-09-07").kind).toBe("unavailable");expect(levelTurnReading({...walk(),todayBalanceCents:NaN},"2026-09-08").kind).toBe("unavailable");});
 it("reads today's selected Trust path separately and refuses stale or beyond-wall Trust input",()=>{
  const {horizon}=trustFixture(),result=fundTrustReading(horizon,"confirmed");if(result.kind!=="trust-reading")throw Error(result.reason);
  const base=horizon.acceptedMonthlyWalk,first=result.lower.future[0]!;
  const current={...result,lower:{...result.lower,future:[{...first,date:base.today,balanceCents:12300}]},expected:{...result.expected,future:[{...first,date:base.today,balanceCents:12400}]}};
  expect(trustTurnReading(base,current,base.today)).toMatchObject({kind:"trust-today",actualCents:base.todayBalanceCents,lowerCents:12300,expectedCents:12400});
  expect(trustTurnReading(base,result,"2026-10-08").kind).toBe("unavailable");
  for(const changed of [{...base,tiesToProjection:false},{...base,todayBalanceCents:base.todayBalanceCents+1},{...base,today:"2026-09-09"}])expect(trustTurnReading(changed,result,"2026-10-01").kind).toBe("unavailable");
 });
 it("selects exact Course pairs in same-day order without mistaking all-date headline for day closing",()=>{
  const {h}=trustFixture(),course=sharedMonthCourse(h,"2026-09-08"),event=course.points.find(point=>point.event)!.event!;
  const custom={...course,operatingCents:999999,points:[course.points[0]!,{date:"2026-09-07",operatingCents:10000,kittyCents:0,event},{date:"2026-09-07",operatingCents:7500,kittyCents:2500,event:{...event,id:"rollover",kind:"kitty-allocated" as const,amountCents:2500}},{date:"2026-09-10",operatingCents:12500,kittyCents:2500,event:{...event,id:"future",date:"2026-09-10"}}]};
  const reading=courseTurnReading(custom,"2026-09-07");expect(reading).toMatchObject({kind:"ready",operatingCents:7500,kittyCents:2500,sourceIndex:2});if(reading.kind==="ready")expect(reading.rows.map(row=>row.event!.id)).toEqual([event.id,"rollover"]);
  expect(courseTurnReading(custom,"2026-09-08")).toMatchObject({operatingCents:7500,kittyCents:2500});expect(courseTurnReading(custom,"2026-09-10")).toMatchObject({kind:"undated-future",rows:[expect.objectContaining({event:expect.objectContaining({id:"future"})})]});
 });
 it("keeps configured tied zero inspectable; future Course never samples its aggregate-reserve graphic",()=>{const course={...sharedMonthCourse(catalogHousehold(),"2026-09-08"),configured:true,tiesToProjection:true,upcomingReserveCents:165000};expect(courseTurnReading(course,"2026-09-08")).toMatchObject({kind:"ready",operatingCents:0,kittyCents:0});expect(courseTurnReading(course,"2026-09-09")).toMatchObject({kind:"undated-future"});expect(courseTurnReading({...course,configured:false},"2026-09-08").kind).toBe("unavailable");expect(courseTurnReading({...course,tiesToProjection:false},"2026-09-08").kind).toBe("unavailable");});
});
