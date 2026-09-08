// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { TimesheetBody, TimesheetGlance } from "../src/widgets/Timesheet.tsx";
import { catalogHousehold, clockInShift, clockOutShift, shiftPostingStreak, startShiftBreak } from "../src/core/index.ts";
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
async function mount(width=390){
 Object.defineProperty(window,"innerWidth",{value:width,configurable:true});Object.defineProperty(document,"visibilityState",{value:"visible",configurable:true});
 Object.assign(HTMLElement.prototype,{setPointerCapture(){},releasePointerCapture(){},hasPointerCapture(){return false;}});
 const h=clockInShift(catalogHousehold(),{memberId:"MEM-002"}).household,host=document.createElement("div"),root=createRoot(host);document.body.append(host);const calls:string[]=[];
 const props={household:h,streak:shiftPostingStreak(h,"2026-09-08"),view:"household" as const,memberId:"MEM-002",memberName:"Jonathan",today:"2026-09-08",busy:false,onClockIn:()=>calls.push("in"),onAbandon:()=>calls.push("discard"),onStartBreak:(kind:string)=>calls.push(kind),onEndBreak:()=>calls.push("end"),onChooseTimeline:()=>calls.push("choose"),onSignOut:()=>calls.push("out"),onFinished:()=>calls.push("finished")};
 await act(async()=>root.render(createElement(TimesheetBody,props)));
 return {h,host,root,props,calls,handle:()=>host.querySelector<HTMLButtonElement>(".shift-punch-handle")!,button:(text:string)=>[...host.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.textContent===text)!,close:async()=>{await act(async()=>root.unmount());host.remove();}};
}
function pointer(el:Element,type:string,y:number,id=1){const event=new Event(type,{bubbles:true});Object.assign(event,{pointerId:id,isPrimary:id===1,button:0,clientY:y});el.dispatchEvent(event);}
const key=async(el:Element,value:string)=>act(async()=>el.dispatchEvent(new KeyboardEvent("keydown",{bubbles:true,key:value})));
describe("Claude Punch",()=>{
 it("reveals through a downward edge drag without action, suppresses release click, then requires a named action",async()=>{
  const m=await mount();try{
   expect(m.handle().getAttribute("aria-expanded")).toBe("false");
   await act(async()=>{pointer(m.handle(),"pointerdown",100);pointer(m.handle(),"pointermove",140);});expect(m.button("Paid break").disabled).toBe(true);expect(m.calls).toEqual([]);
   await act(async()=>{pointer(m.handle(),"pointerup",140);m.handle().click();});expect(m.handle().getAttribute("aria-expanded")).toBe("true");expect(m.calls).toEqual([]);
   await act(async()=>m.button("Paid break").click());expect(m.calls).toEqual(["paid"]);
  }finally{await m.close();}
 });
 it("restores disclosure on cancel, capture loss, Escape and another pointer; keyboard remains usable",async()=>{
  const m=await mount();try{
   for(const type of ["pointercancel","lostpointercapture","escape","second"]){
    await act(async()=>{pointer(m.handle(),"pointerdown",100);pointer(m.handle(),"pointermove",140);if(type==="second")pointer(m.handle(),"pointerdown",150,2);else if(type!=="escape")pointer(m.handle(),type,140);});
    if(type==="escape")await key(m.handle(),"Escape");expect(m.handle().getAttribute("aria-expanded")).toBe("false");expect(m.calls).toEqual([]);
   }
   await key(m.handle(),"Enter");await act(async()=>m.handle().click());expect(m.handle().getAttribute("aria-expanded")).toBe("true");await key(m.handle(),"Escape");expect(m.handle().getAttribute("aria-expanded")).toBe("false");
  }finally{await m.close();}
 });
 it("resets disclosure with room, timeline and busy changes; confirming and conflict use existing flows",async()=>{
  const m=await mount();try{
   await key(m.handle(),"ArrowDown");await act(async()=>m.root.render(createElement(TimesheetBody,{...m.props,view:"personal"})));expect(m.handle().getAttribute("aria-expanded")).toBe("false");
   await key(m.handle(),"ArrowDown");const h=startShiftBreak(m.h,{memberId:"MEM-002",kind:"unpaid"}).household;
   await act(async()=>m.root.render(createElement(TimesheetBody,{...m.props,household:h})));expect(m.handle().getAttribute("aria-expanded")).toBe("false");await key(m.handle(),"ArrowDown");expect(m.button("End break")).toBeDefined();
   await act(async()=>m.root.render(createElement(TimesheetBody,{...m.props,household:h,busy:true})));expect(m.handle().disabled).toBe(true);expect(m.handle().getAttribute("aria-expanded")).toBe("false");
   await act(async()=>m.root.render(createElement(TimesheetBody,{...m.props,household:clockOutShift(h,{memberId:"MEM-002"}).household})));expect(m.handle()).toBeNull();expect(m.host.textContent).toContain("Nothing has reached the ledger yet");
   const conflict={...m.h,kitchen:{...m.h.kitchen,openShifts:[...m.h.kitchen.openShifts,{...m.h.kitchen.openShifts[0]!,id:"other-device"}]}};
   await act(async()=>m.root.render(createElement(TimesheetBody,{...m.props,household:conflict})));expect(m.handle()).toBeNull();expect(m.host.textContent).toContain("Two devices recorded this shift");expect(m.calls).toEqual([]);
  }finally{await m.close();}
 });
 it("keeps keyboard focus through busy, accepted break and confirming replacements",async()=>{
  const m=await mount();try{
   await key(m.handle(),"ArrowDown");m.button("Paid break").focus();
   await act(async()=>m.root.render(createElement(TimesheetBody,{...m.props,busy:true})));expect(document.activeElement).toBe(m.host.querySelector(".timesheet-focus-boundary"));
   const h=startShiftBreak(m.h,{memberId:"MEM-002",kind:"paid"}).household;
   await act(async()=>m.root.render(createElement(TimesheetBody,{...m.props,household:h})));expect(document.activeElement).toBe(m.handle());
   await key(m.handle(),"ArrowDown");m.button("Clock out").focus();
   await act(async()=>m.root.render(createElement(TimesheetBody,{...m.props,household:clockOutShift(h,{memberId:"MEM-002"}).household})));expect(document.activeElement).toBe(m.host.querySelector(".timesheet-status"));
  }finally{await m.close();}
 });
 it("retains desktop actions and the idle clock",async()=>{
  const m=await mount(720);try{expect(m.handle()).toBeNull();expect(m.button("Paid break")).toBeDefined();await act(async()=>m.root.render(createElement(TimesheetBody,{...m.props,household:catalogHousehold()})));expect(m.host.querySelector(".analog-clock")).not.toBeNull();expect(m.host.textContent).toContain("Start shift");}finally{await m.close();}
 });
 it("pauses both clocks while hidden and derives elapsed readings immediately on resume",async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));const m=await mount();try{
   await act(async()=>m.root.render(createElement("div",null,createElement(TimesheetBody,m.props),createElement(TimesheetGlance,m.props))));expect(vi.getTimerCount()).toBe(2);
   Object.defineProperty(document,"visibilityState",{value:"hidden",configurable:true});await act(async()=>document.dispatchEvent(new Event("visibilitychange")));expect(vi.getTimerCount()).toBe(0);
   vi.setSystemTime(new Date("2026-09-08T16:00:00Z"));Object.defineProperty(document,"visibilityState",{value:"visible",configurable:true});await act(async()=>document.dispatchEvent(new Event("visibilitychange")));expect(vi.getTimerCount()).toBe(2);expect(m.host.querySelector(".shift-punch-figure")!.textContent).toBe("4.00 h");expect(m.host.textContent).toContain("4.00 h · live");
   vi.setSystemTime(new Date("2026-09-08T17:00:00Z"));await act(async()=>window.dispatchEvent(new Event("pageshow")));expect(m.host.querySelector(".shift-punch-figure")!.textContent).toBe("5.00 h");
  }finally{await m.close();expect(vi.getTimerCount()).toBe(0);vi.useRealTimers();}
 });
});
