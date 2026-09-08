// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import { FundLedge } from "/src/FundLedge";
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OfficePhone } from '/src/OfficePhone';
import { postWorkShift, upsertWorkJob, shapeWorkJob, catalogHousehold, buildDashboard, defaultLayout, fallbackWeather, seedDemoHousehold, configureHouseholdFund, householdForView } from '/src/core/index';
import '/src/styles.css';
import '/src/office.css';
import '/src/office-phone.css';
import '/src/hearth-theme.css';
import '/src/desk-plates.css';
import '/src/office-wide.css';
import '/src/month-spread.css';
function job() {
  return shapeWorkJob({
    id: "",
    memberId: "MEM-002",
    name: "Café Nola",
    color: "#a85a3d",
    active: true,
    timezone: "America/Toronto",
    locationName: "Toronto",
    gpsEnabled: true,
    roles: [{
      id: "ROLE-SERVER",
      name: "Server",
      tipped: true,
      active: true,
      rates: [
        { id: "RATE-OLD", effectiveDate: "2026-01-01", grossHourlyRateCents: 1800, takeHomeMode: "direct", takeHomeHourlyRateCents: 1500, deductions: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
        { id: "RATE-NEW", effectiveDate: "2026-09-01", grossHourlyRateCents: 2000, takeHomeMode: "deductions", takeHomeHourlyRateCents: 0, deductions: [{ id: "TAX", label: "Tax", percent: 20 }], createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    }],
    paidBreakRate: "role",
    paidBreakHourlyRateCents: 0,
    overtimeEnabled: true,
    overtimeWeeklyThresholdHours: 44,
    overtimeMultiplier: 1.5,
    tipOutRules: [
      { id: "BAR", label: "Bar", basis: "total-sales", value: 1, roundingCents: 500, roundingMode: "up", timing: "immediate", active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "FLOOR", label: "Floor", basis: "card-tips", value: 2, roundingCents: 1, roundingMode: "nearest", timing: "withheld", active: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
    salesFields: [{ id: "FOOD", label: "Food", requirement: "required", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
    paySchedule: { cadence: "biweekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipSchedule: { cadence: "weekly", anchorDate: "2026-01-02", weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipWeekStartsOn: 1,
    defaults: { wagesVisibility: "personal", cashTipsVisibility: "personal", cardTipsVisibility: "personal", tipOutVisibility: "personal", wagesDepositAccountId: "ACC-CHEQUING", cashTipsAccountId: "ACC-CASH", cardTipsDepositAccountId: "ACC-CASH" },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "",
    createdAt: "",
    updatedAt: "",
  });
}

const today = '2026-09-08';
const params = new URLSearchParams(location.search);
let h=params.has('empty')?catalogHousehold('development'):seedDemoHousehold({environment:'development',today});
if(!h.householdFund)h=configureHouseholdFund(h,{custodianMemberId:'MEM-001',openedOn:'2026-08-01',createdBy:'MEM-001'}).household;
if(!params.has('empty')){
 const saved=upsertWorkJob(h,{job:job()}).household;const savedJob=saved.workJobs.find(j=>j.name==='Café Nola'&&j.memberId==='MEM-002')!;
 const posted=postWorkShift(saved,{date:'2026-09-07',memberId:'MEM-002',jobId:savedJob.id,roleId:'ROLE-SERVER',workedHours:4,paidBreakHours:0,salesByField:{FOOD:1000},cashTips:50,cardTips:100,customersServed:40,staffingCount:4,eventTag:'regular',createdBy:'MEM-002',confirmDuplicate:true}).household;
 const receipt=posted.shifts.at(-1)!;
 h={...posted,shifts:[{...receipt,createdAt:new Date(Date.now()-(params.has('expired')?7*3600000:60000)).toISOString()}]};
}
const memberId=params.has('custodian')?'MEM-001':'MEM-002';
const view=params.has('personal')?'personal':'household';
const display=householdForView(h,memberId,view);
const dashboard = buildDashboard(display,today,new Date('2026-09-08T12:00:00Z'));
if(params.has('figures')) Object.assign(dashboard.month,{incomeActualCents:338000,expenseActualCents:410500,netActualCents:-72500});
if(params.has('urgent')) h.kitchen.openShift = {id:'SYNTHETIC',memberId,startedAt:'2026-09-08T11:00:00Z',updatedAt:'2026-09-08T11:00:00Z',status:'open',breaks:[]};
const form = { date:today,amount:'',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',note:'',place:'',who:'joint',fromAccountId:'ACC-CHEQUING',toAccountId:'ACC-VISA',memberId,sales:'0',cashTips:'0',ccTips:'0',hours:'',customersServed:'40',staffingCount:'4',eventTag:'regular',visibility:'household',occurredAt:'',useHouseholdFund:false,fundedAmount:'',fundDestinationAccountId:'ACC-VISA'};
window.evidenceActions=[];
const action = (kind) => (...args) => window.evidenceActions.push(kind);
function Harness(){const [layout,onLayout]=useState(defaultLayout('phone'));const[urgent,setUrgent]=useState(false);window.setUrgent=setUrgent;const current=urgent?{...display,kitchen:{...display.kitchen,openShift:{id:'SYNTHETIC',memberId,startedAt:'2026-09-08T11:00:00Z',updatedAt:'2026-09-08T11:00:00Z',status:'open',breaks:[]}}}:display; return <div className="app"><main style={{maxWidth:680,margin:'auto',padding:0}}><OfficePhone household={current} booksHousehold={h} view={view} dashboard={dashboard} sill={{figures:[],needsMe:params.has('error')?'Connection interrupted. Your accepted books remain readable.':''}} reading={fallbackWeather(today,new Date('2026-09-08T12:00:00Z'))} layout={layout} onLayout={onLayout} today={today} memberId={memberId} busy={params.has('loading')} adding={false} form={form} mode="expense" error="" categories={h.categories} postLabel="Confirm" integrityFindings={[]} {...Object.fromEntries(['onForm','onPost','onMore','onMilk','onCoffee','onClockIn','onAbandonShift','onStartBreak','onEndBreak','onChooseShiftTimeline','onSignOut','onFinishedShift','onPayCard','onOpenAccount','onKitchen','onMarkPaid','onGo'].map(k=>[k,action(k)]))}/></main><FundLedge household={h} today={today} view={view} memberId={memberId} busy={false} onOpen={action("open-fund")} onKitchen={action("write-fund")} onOpenAccount={action("open-account")}/><nav className="nav"><button>Home</button><button>Cal</button><button>+</button><button>Plan</button><button>More</button></nav></div>};
createRoot(document.getElementById('root')).render(<MobileWorldFixture><Harness/></MobileWorldFixture>);


import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
