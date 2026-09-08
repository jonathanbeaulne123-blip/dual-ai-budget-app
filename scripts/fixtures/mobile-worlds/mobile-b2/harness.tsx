// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import {useState} from 'react';
import {useDialog} from '/src/useDialog';
import {createRoot} from 'react-dom/client';
import {RecoverableWorkShiftFlow as WorkShiftFlow} from '/src/RecoverableWorkShiftFlow';
import {catalogHousehold,configureHouseholdFund,upsertWorkJob,clockInShift,clockOutShift,activeOpenShift,postWorkShiftWithAttendanceReview} from '/src/core/index';
import {shapeWorkJob} from '/src/core/index';
import '/src/styles.css';

function job(){
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

const params=new URLSearchParams(location.search);
const now=new Date(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
let base=configureHouseholdFund(catalogHousehold(),{custodianMemberId:'MEM-001',openedOn:'2026-08-01',createdBy:'MEM-001'}).household;
base=upsertWorkJob(base,{job:job()}).household;
base=clockInShift(base,{memberId:'MEM-002'}).household;
base.kitchen.openShifts=base.kitchen.openShifts.map(p=>({...p,startedAt:new Date(Date.now()-4*3600000).toISOString()}));
if(params.has('history'))for(let i=0;i<8;i++)base=postWorkShiftWithAttendanceReview(base,{date:`2026-08-${23+i}`,memberId:'MEM-002',jobId:base.workJobs[0].id,roleId:'ROLE-SERVER',workedHours:4,paidBreakHours:0,salesByField:{FOOD:'1000'},cashTips:'50',cardTips:String(40+i*20),customersServed:40,staffingCount:1,createdBy:'MEM-002'}).household;
if(params.has('history')){base=clockInShift(base,{memberId:'MEM-002'}).household;base.kitchen.openShifts=base.kitchen.openShifts.map(p=>({...p,startedAt:new Date(Date.now()-4*3600000).toISOString()}));}
window.evidenceActions=[];window.evidencePayload=null;
function Harness(){const[h,setH]=useState(base),[open,setOpen]=useState(false),[error,setError]=useState('');
 const currentJob=h.workJobs[0]; const dialog=useDialog(open&&params.has('dialog'),()=>{window.evidenceActions.push('dialog-close');setOpen(false);});
 const draft=params.has('populated')?{date:today,jobId:currentJob.id,roleId:'ROLE-SERVER',workedHours:params.has('exact')?6.02:4,paidBreakHours:0,sales:1000,cashTips:params.has('huge')?12345678.90:params.has('exact')?12.34:50,cardTips:params.has('exact')?245.67:100,customersServed:40,staffingCount:1,eventTag:'regular'}:null;
 return <div ref={dialog} className="app" style={{maxWidth:680,margin:'auto'}}>{!open?<button onClick={()=>{setH(clockOutShift(h,{memberId:'MEM-002'}).household);setOpen(true);window.evidenceActions.push('clock-out');}}>Clock out</button>:<WorkShiftFlow household={h} memberId="MEM-002" today={today} punch={activeOpenShift(h.kitchen,'MEM-002')} initialDraft={draft} busy={false} onConfirm={(input,attendance,callbacks)=>{try{window.evidencePayload=input;const result=postWorkShiftWithAttendanceReview(h,input,attendance);setH(result.household);window.evidenceActions.push('accepted-shift');callbacks?.onAccepted();}catch(e){setError(e.message);window.evidenceActions.push('error');}}}/>}<p role="alert">{error}</p></div>;
}
createRoot(document.getElementById('root')).render(<MobileWorldFixture><Harness/></MobileWorldFixture>);


import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
