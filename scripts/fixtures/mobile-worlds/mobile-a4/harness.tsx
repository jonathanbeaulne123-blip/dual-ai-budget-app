// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import { FundLedge } from "/src/FundLedge";
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OfficePhone } from '/src/OfficePhone';
import { catalogHousehold, buildDashboard, defaultLayout, fallbackWeather, seedDemoHousehold, configureHouseholdFund, householdForView } from '/src/core/index';
import '/src/styles.css';
import '/src/office.css';
import '/src/office-phone.css';
import '/src/hearth-theme.css';
import '/src/desk-plates.css';
import '/src/office-wide.css';
import '/src/month-spread.css';
const today = '2026-09-08';
const params = new URLSearchParams(location.search);
let h=params.has('empty')?catalogHousehold('development'):seedDemoHousehold({environment:'development',today});
if(!h.householdFund)h=configureHouseholdFund(h,{custodianMemberId:'MEM-001',openedOn:'2026-08-01',createdBy:'MEM-001'}).household;
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
