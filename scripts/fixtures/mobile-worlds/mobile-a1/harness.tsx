// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OfficePhone } from '/src/OfficePhone';
import { catalogHousehold, buildDashboard, defaultLayout, fallbackWeather } from '/src/core/index';
import '/src/styles.css';
import '/src/office.css';
import '/src/office-phone.css';
import '/src/hearth-theme.css';
const today = '2026-09-08';
const params = new URLSearchParams(location.search);
const h = catalogHousehold('development');
const memberId = h.members[0].id;
const dashboard = buildDashboard(h,today,new Date('2026-09-08T12:00:00Z'));
if(params.has('figures')) Object.assign(dashboard.month,{incomeActualCents:338000,expenseActualCents:410500,netActualCents:-72500});
if(params.has('urgent')) h.kitchen.openShift = {id:'SYNTHETIC',memberId,startedAt:'2026-09-08T11:00:00Z',updatedAt:'2026-09-08T11:00:00Z',status:'open',breaks:[]};
const form = { date:today,amount:'',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',note:'',place:'',who:'joint',fromAccountId:'ACC-CHEQUING',toAccountId:'ACC-VISA',memberId,sales:'0',cashTips:'0',ccTips:'0',hours:'',customersServed:'40',staffingCount:'4',eventTag:'regular',visibility:'household',occurredAt:'',useHouseholdFund:false,fundedAmount:'',fundDestinationAccountId:'ACC-VISA'};
window.evidenceActions=[];
const action = (kind) => (...args) => window.evidenceActions.push(kind);
function Harness(){const [layout,onLayout]=useState(defaultLayout('phone')); return <main style={{maxWidth:680,margin:'auto',padding:12}}><OfficePhone household={h} dashboard={dashboard} sill={{figures:[],needsMe:params.has('error')?'Connection interrupted. Your accepted books remain readable.':''}} reading={fallbackWeather(today,new Date('2026-09-08T12:00:00Z'))} layout={layout} onLayout={onLayout} today={today} memberId={memberId} busy={params.has('loading')} adding={false} form={form} mode="expense" error="" categories={h.categories} postLabel="Confirm" integrityFindings={[]} {...Object.fromEntries(['onForm','onPost','onMore','onMilk','onCoffee','onClockIn','onAbandonShift','onStartBreak','onEndBreak','onChooseShiftTimeline','onSignOut','onFinishedShift','onPayCard','onOpenAccount','onKitchen','onMarkPaid','onGo'].map(k=>[k,action(k)]))}/></main>};
createRoot(document.getElementById('root')).render(<MobileWorldFixture><Harness/></MobileWorldFixture>);


import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
