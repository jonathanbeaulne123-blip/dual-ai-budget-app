// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {CalendarPage} from '../src/Calendar.tsx';
import {addPotentialExpense,addRecurrence,catalogHousehold,type HerculesNumberSource} from '../src/core/index.ts';
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


it('keeps a new Move editor on its Calendar date despite a retained older bill source',async()=>{
 localStorage.clear();const household=addPotentialExpense(catalogHousehold(),{date:'2026-10-12',title:'Synthetic future plan',amount:'4.00',accountId:'ACC-CHEQUING',subcategoryId:'SUB-LIFE-FUN',createdBy:'MEM-001',visibility:'household'}).household;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),noop=vi.fn();
 const props={household,today:'2026-09-10',environment:'development',memberId:'MEM-001',view:'household',busy:false,onCommand:noop,onAskPost:noop,onAskPostDue:noop,onAskSaveRepeating:noop,onAskVisit:noop,onAskSettle:noop,onAskWriteOff:noop,onAskStartJar:noop,onOpenPlan:noop,onOpenShiftEnvelope:noop,openPotentialEditorId:household.potentialExpenses[0]!.id,sourceFocus:{route:'calendar',view:'household',label:'Old source',from:'2026-09-01'}} as Parameters<typeof CalendarPage>[0];
 try{await act(async()=>root.render(createElement(CalendarPage,props)));
 expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Calendar');
 expect((host.querySelector('#potential-date') as HTMLInputElement).value).toBe('2026-10-12');
 expect(host.textContent).toContain('October 2026');expect(noop).not.toHaveBeenCalled();
 await act(async()=>root.render(createElement(CalendarPage,{...props,openPotentialEditorId:null})));
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Cancel')!.click());
 expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Calendar');
 expect(host.textContent).toContain('October 2026');
 }finally{await act(async()=>root.unmount());host.remove();}
});
