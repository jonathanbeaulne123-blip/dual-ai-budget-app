// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { PlanLineEditor } from '../src/PlanLensWorkbench.tsx';
import { planLifeFixture } from './fixtures/plan-life.ts';
import { applyPlanSchedule, projectPlan, planSelectionForDraft } from '../src/core/planProjection.ts';
import type { PlanLine } from '../src/core/index.ts';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
describe('Plan editing preserves the reviewed decision', () => {
 it('keeps exact payday amounts and dates when editing only the title', async () => {
  const household=planLifeFixture('personal'), draft=household.planDrafts![0]!;
  const reserve=draft.lines.find(row=>row.lens==='prepare')!;
  reserve.decision!.paydays=['2026-09-15','2026-09-30','2026-10-15','2026-11-01','2026-11-15','2026-12-01'];
  const project=(lines:PlanLine[])=>projectPlan(household,{memberId:'MEM-001',scope:'personal',acceptedRevision:household.revision,asOf:'2026-09-11',through:'2026-09-30',selection:{...planSelectionForDraft(draft),lines}});
  const initial=applyPlanSchedule(reserve,project(draft.lines).lines.find(row=>row.line.id===reserve.id)!,'2026-09-11','2026-09');
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let saved:PlanLine|undefined;
  try {
   await act(async()=>root.render(createElement(PlanLineEditor,{household,memberId:'MEM-001',scope:'personal',lens:'prepare',initial,today:'2026-09-11',busy:false,onSave:async line=>{saved=line;return true;}})));
   const label=[...host.querySelectorAll('label')].find(row=>row.textContent?.startsWith('What is this for?'))!.querySelector('input')!;
   await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(label,'More precise title');label.dispatchEvent(new Event('input',{bubbles:true}));});
   await act(async()=>host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   expect(saved?.labelSnapshot).toBe('More precise title');
   expect(saved?.decision?.contributionSchedule).toEqual(initial.decision!.contributionSchedule);
   expect(project([saved!]).movements).toEqual(project([initial]).movements.map(row=>row.sourceId?.startsWith(`plan:${initial.id}`)?{...row,label:'More precise title'}:row));
  } finally {await act(async()=>root.unmount());host.remove();}
 });
});
