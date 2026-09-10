// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {CalendarPage} from '../src/Calendar.tsx';
import {addRecurrence,catalogHousehold,type HerculesNumberSource} from '../src/core/index.ts';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
it.each([false,true])('opens and focuses the exact bill without making a write; first mount=%s',async(firstMount)=>{
 localStorage.clear();const household=addRecurrence(catalogHousehold(),{cadence:'monthly',nextDate:'2026-09-12',type:'expense',amount:'4.00',accountId:'ACC-VISA',subcategoryId:'SUB-HOUSING-ELECTRIC',note:'Synthetic source bill'}).household,host=document.createElement('div');document.body.append(host);const root=createRoot(host),noop=vi.fn();let sourceFocus:HerculesNumberSource|null=null;
 const props={household,today:'2026-09-10' as const,environment:'development' as const,memberId:'MEM-001',view:'household' as const,busy:false,onCommand:noop,onAskPost:noop,onAskPostDue:noop,onAskSaveRepeating:noop,onAskVisit:noop,onAskSettle:noop,onAskWriteOff:noop,onAskStartJar:noop,onOpenPlan:noop,onOpenShiftEnvelope:noop};
 const render=()=>root.render(createElement(CalendarPage,{...props,sourceFocus}));
 try{if(!firstMount){await act(async()=>render());expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Calendar');}else localStorage.setItem('hearth.calendar.intent','board');
 sourceFocus={route:'calendar',view:'household',label:'Selected repeating item',recurrenceId:household.recurrences[0]!.id,from:'2026-09-10',to:'2026-09-30'};
 await act(async()=>render());expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Bills');expect((document.activeElement as HTMLElement).dataset.recurrenceId).toBe(sourceFocus.recurrenceId);expect(noop).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();}
});
