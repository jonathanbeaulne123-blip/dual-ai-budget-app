// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SplitCut } from '../src/SplitCut.tsx';
import { editSplitDraft, newSplitDraft, reviewedSplitPayload, splitReading, splitDraftScope } from '../src/core/splitDraft.ts';
import { createWriteQueue } from '../src/core/writeQueue.ts';
import { catalogHousehold, postEntry } from '../src/core/index.ts';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const viewer={memberId:'MEM-002',view:'household' as const,generation:1};
describe('Cut preview and reviewed ownership',()=>{
  it('uses current IDs and canonical cents, retaining a visible zero share',()=>{
    const h=catalogHousehold();h.members=h.members.map((m,i)=>({...m,id:`OTHER-${i}`}));
    const v={...viewer,memberId:'OTHER-0'},draft=newSplitDraft(h,v),ids=h.members.map(m=>m.id);
    expect(draft.percents).toEqual({'OTHER-0':50,'OTHER-1':50});
    expect(splitReading(ids,draft.percents,1)).toEqual({splits:[{party:'OTHER-0',amountCents:1}],cents:{'OTHER-0':1,'OTHER-1':0}});
    expect(splitReading(ids,editSplitDraft(draft,ids,ids[0]!,30).percents,1001).cents).toEqual({'OTHER-0':300,'OTHER-1':701});
    expect(splitReading(ids,editSplitDraft(draft,ids,ids[0]!,0).percents,1001).cents).toEqual({'OTHER-0':0,'OTHER-1':1001});
    expect(editSplitDraft(draft,ids,ids[0]!,NaN)).toBe(draft);
  });
  it('refuses invalid totals, nonfinite input and negative residual cents without changing the kernel',()=>{
    expect(()=>splitReading(['a','b'],{a:20,b:20},100)).toThrow(/100/);
    expect(()=>splitReading(['a','b'],{a:NaN,b:50},100)).toThrow(/Review/);
    expect(()=>splitReading(['a','b','c'],{a:50,b:50,c:0},1)).toThrow(/negative remainder/);
    expect(splitReading(['a','b','c'],{a:30,b:30,c:40},10).cents).toEqual({a:3,b:3,c:4});
  });
  for(const changed of ['order','inactive','added','household','member','view','generation','environment'] as const)it(`refuses a real queued post after ${changed} changes`,async()=>{
    const queue=createWriteQueue();let release!:()=>void;const barrier=queue(()=>new Promise<void>(resolve=>{release=resolve;}));await Promise.resolve();
    let h=catalogHousehold(),v={...viewer};const draft=newSplitDraft(h,v);let posts=0;
    const pending=queue(async()=>{const splits=reviewedSplitPayload(draft,h,v,1);posts++;h=postEntry(h,{date:'2026-09-08',type:'expense',amount:'0.01',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',note:'Fictional Cut fixture',createdBy:'MEM-002',visibility:'household',splits,confirmDuplicate:true}).household;});
    const refusal=expect(pending).rejects.toThrow(/Review the split again/);
    if(changed==='order')h={...h,members:[...h.members].reverse()};
    if(changed==='inactive')h={...h,members:h.members.map((m,i)=>i?{...m,active:false}:m)};
    if(changed==='added')h={...h,members:[...h.members,{...h.members[0]!,id:'THIRD'}]};
    if(changed==='household')h={...h,householdId:'OTHER-HH'};
    if(changed==='environment')h={...h,environment:'production'};
    if(changed==='member')v={...v,memberId:'MEM-001'};
    if(changed==='view')v={...v,view:'personal' as 'household'};
    if(changed==='generation')v={...v,generation:3};
    const before=JSON.stringify(h);release();await barrier;await refusal;expect(posts).toBe(0);expect(JSON.stringify(h)).toBe(before);
  });
  it('posts exactly the reviewed ownership after an unrelated same-scope revision',()=>{
    let h=catalogHousehold();const draft=newSplitDraft(h,viewer),reading=splitReading(h.members.map(m=>m.id),draft.percents,1);
    h=postEntry(h,{date:'2026-09-08',type:'expense',amount:'0.02',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',note:'Other accepted entry',createdBy:'MEM-002',visibility:'household',confirmDuplicate:true}).household;
    const result=postEntry(h,{date:'2026-09-08',type:'expense',amount:'0.01',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',note:'Fictional Cut fixture',createdBy:'MEM-002',visibility:'household',splits:reviewedSplitPayload(draft,h,viewer,1),confirmDuplicate:true});
    expect(result.household.transactions.at(-1)!.splits).toEqual(reading.splits);
    expect(splitDraftScope(h,viewer)).toBe(draft.scope);
  });
  it('changes named shares with keys and detents without posting, and keeps endpoint readings',()=>{
    const h=catalogHousehold(),members=[h.members[0]!,h.members[1]!] as [typeof h.members[number],typeof h.members[number]];
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let changes=0;
    function Harness(){const[d,setD]=useState(()=>newSplitDraft(h,viewer));return createElement(SplitCut,{members,percents:d.percents,amountCents:1,onChange:(id,p)=>{changes++;setD(editSplitDraft(d,members.map(m=>m.id),id,p));}});}
    try{
      act(()=>root.render(createElement(Harness)));const slider=host.querySelector('[role=slider]')!;
      expect([...host.querySelectorAll('[data-cut-cents]')].map(e=>e.textContent)).toEqual(['$0.01','$0.00']);
      act(()=>slider.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
      expect(slider.getAttribute('aria-valuenow')).toBe('51');expect(changes).toBe(1);
      act(()=>slider.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true})));
      expect([...host.querySelectorAll('[data-cut-cents]')].map(e=>e.textContent)).toEqual(['$0.00','$0.01']);
      act(()=>host.querySelectorAll<HTMLButtonElement>('.cut-detents button')[3]!.click());
      expect(slider.getAttribute('aria-valuenow')).toBe('50');expect(host.querySelector('button[type=submit]')).toBeNull();
    }finally{act(()=>root.unmount());host.remove();}
  });
  it('preserves a fractional exact share when the handle is clicked without moving',()=>{
    const h=catalogHousehold(),host=document.createElement('div');document.body.append(host);const root=createRoot(host);let value=0;
    try {
      act(()=>root.render(createElement(SplitCut,{members:[h.members[0]!,h.members[1]!],percents:{'MEM-001':12.5,'MEM-002':87.5},amountCents:100,onChange:(_id,p)=>value=p})));
      const slider=host.querySelector<HTMLButtonElement>('[role=slider]')!,lane=host.querySelector<HTMLElement>('.cut-lane')!;
      slider.setPointerCapture=()=>{};slider.hasPointerCapture=()=>false;slider.releasePointerCapture=()=>{};
      lane.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:200,bottom:44,width:200,height:44,toJSON:()=>{}});
      for(const type of ['pointerdown','pointerup']){const e=new MouseEvent(type,{bubbles:true,cancelable:true,clientX:30,button:0});Object.defineProperties(e,{pointerId:{value:1},isPrimary:{value:true}});act(()=>slider.dispatchEvent(e));}
      expect(value).toBe(12.5);
    }finally{act(()=>root.unmount());host.remove();}
  });
  it('wires queued validation and explicit review into App without hardcoded seed IDs',()=>{
    const app=readFileSync('src/App.tsx','utf8');expect(app).not.toContain('setSplitPercents');
    expect(app).toContain('reviewedSplitPayload(splitDraft, from, { memberId: currentSession.memberId');
    expect(app).toContain('onReviewSplit={reviewSplit}');expect(app).toContain('setSplitDraft(null)');
  });
});
