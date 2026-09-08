// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { LedgerPage, type DuplicateCommand } from "../src/Ledger.tsx";
import { catalogHousehold, postEntry, type Household } from "../src/core/index.ts";
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
async function mount(){
 Object.defineProperty(window,"innerWidth",{value:390,configurable:true});Object.assign(HTMLElement.prototype,{setPointerCapture(){},releasePointerCapture(){},hasPointerCapture(){return false;}});
 let h=catalogHousehold();for(const date of ["2026-09-07","2026-09-08"])h=postEntry(h,{date,note:"Groceries",type:"expense",amount:"47.23",accountId:"ACC-VISA",subcategoryId:"SUB-FOOD-GROCERIES",createdBy:"MEM-001",confirmDuplicate:true}).household;
 h={...h,transactions:h.transactions.map(tx=>({...tx,potentialDuplicate:true}))};
 const host=document.createElement("div"),root=createRoot(host);document.body.append(host);const calls:Household[]=[],legacy:Household[]=[];
 const m={h,host,root,calls,legacy,props:{authorityGeneration:0,household:h,memberId:"MEM-001",view:"household" as "household"|"personal",sourceFocus:null,onClearSource:()=>{},onChange:(next:Household)=>legacy.push(next),onRemove:()=>{},onDuplicateCommand:(async fn=>{const result=fn(m.h);m.h=result.household;calls.push(m.h);await render();return {ok:true};}) as DuplicateCommand}};
 async function render(){m.props.household=m.h;await act(async()=>root.render(createElement(LedgerPage,m.props)));}
 await render();const button=(text:string)=>[...document.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.textContent===text)!;
 return {...m,state:m,render,button,handle:()=>host.querySelector<HTMLElement>("[role=slider]")!,open:async()=>act(async()=>button("Review possible repeats").click()),close:async()=>{await act(async()=>root.unmount());host.remove();}};
}
function pointer(el:Element,type:string,x:number,id=1){const event=new Event(type,{bubbles:true});Object.assign(event,{pointerId:id,isPrimary:id===1,button:0,clientX:x});el.dispatchEvent(event);}
const key=async(el:Element,value:string)=>act(async()=>el.dispatchEvent(new KeyboardEvent("keydown",{bubbles:true,key:value})));
describe("Prise accepted review",()=>{
 it("keeps similarity fixed through parting and cancel; only named Confirm excludes and Include remains reachable",async()=>{
  const m=await mount();try{await m.open();const signal=m.host.querySelector(".prise-signal")!.textContent;
   await act(async()=>{pointer(m.handle(),"pointerdown",100);pointer(m.handle(),"pointermove",196);});expect(m.handle().getAttribute("aria-valuenow")).toBe("100");expect(m.button("Review exclusion · left").disabled).toBe(true);expect(m.calls).toEqual([]);
   await act(async()=>pointer(m.handle(),"pointerup",196));expect(m.host.querySelector(".prise-signal")!.textContent).toBe(signal);
   await act(async()=>m.button("Review exclusion · left").click());expect(m.calls).toEqual([]);expect(document.querySelector("[role=dialog]")!.textContent).toContain("Eligibility for dated totals changes for 1 entry");
   await act(async()=>m.button("Cancel").click());expect(m.calls).toEqual([]);
   await act(async()=>m.button("Review exclusion · left").click());await act(async()=>m.button("Confirm exclusion").click());expect(m.calls).toHaveLength(1);expect(m.legacy).toEqual([]);expect(m.button("Include")).toBeDefined();
   await act(async()=>m.button("Include").click());await act(async()=>m.button("Confirm inclusion").click());expect(m.calls).toHaveLength(2);expect(m.state.h.transactions.every(tx=>!tx.isDuplicate)).toBe(true);
  }finally{await m.close();}
 });
 it("rolls back cancel, capture loss, Escape and a second pointer, with keyboard and named stop equivalents",async()=>{
  const m=await mount();try{await m.open();for(const cancel of ["pointercancel","lostpointercapture","Escape","second"]){await act(async()=>{pointer(m.handle(),"pointerdown",100);pointer(m.handle(),"pointermove",196);if(cancel==="second")pointer(m.handle(),"pointerdown",200,2);else if(cancel!=="Escape")pointer(m.handle(),cancel,196);});if(cancel==="Escape")await key(m.handle(),"Escape");expect(m.handle().getAttribute("aria-valuenow")).toBe("0");}
   await key(m.handle(),"End");expect(m.handle().getAttribute("aria-valuenow")).toBe("100");await act(async()=>m.button("Together").click());expect(m.handle().getAttribute("aria-valuenow")).toBe("0");expect(m.calls).toEqual([]);
  }finally{await m.close();}
 });
 it("keeps readable card fields outside the slider and cancels a drag begun on text with focused Escape",async()=>{
  const m=await mount();try{await m.open();const field=m.host.querySelector(".prise-drag-card .prise-amount")!;expect(m.handle().querySelector(".prise-field")).toBeNull();
   await act(async()=>{pointer(field,"pointerdown",100);pointer(field,"pointermove",196);});expect(document.activeElement).toBe(m.handle());await key(document.activeElement!,"Escape");expect(m.handle().getAttribute("aria-valuenow")).toBe("0");expect(m.calls).toEqual([]);
   m.button("Review exclusion · left").focus();await act(async()=>m.button("Review exclusion · left").click());expect(m.host.hasAttribute("inert")).toBe(true);await act(async()=>m.button("Cancel").click());expect(m.host.hasAttribute("inert")).toBe(false);expect(document.activeElement).toBe(m.button("Review exclusion · left"));
   await act(async()=>m.button("Review exclusion · left").click());await act(async()=>m.button("Confirm exclusion").click());expect(document.activeElement).toBe(m.button("Include"));
  }finally{await m.close();}
 });
 it("invalidates an open review when comparison facts change, retaining a dismissible stale dialog",async()=>{
  const m=await mount();try{await m.open();await act(async()=>m.button("Review exclusion · left").click());m.state.h={...m.state.h,transactions:m.state.h.transactions.map((tx,i)=>i?{...tx,note:"Changed evidence"}:tx)};await m.render();expect(document.querySelector("[role=dialog]")!.textContent).toContain("Entries changed");await act(async()=>m.button("Return to entries").click());expect(m.calls).toEqual([]);expect(document.querySelector("[role=dialog]")).toBeNull();
  }finally{await m.close();}
 });
 it("retires an open review when only authority generation changes",async()=>{
  const m=await mount();try{await m.open();await act(async()=>m.button("Review exclusion · left").click());expect(document.querySelector("[role=dialog]")).not.toBeNull();m.state.props.authorityGeneration++;await m.render();expect(document.querySelector("[role=dialog]")).toBeNull();expect(m.calls).toEqual([]);
  }finally{await m.close();}
 });
 it("revalidates inside the queued action and refuses a room round trip",async()=>{
  const m=await mount();try{let queued!:Parameters<DuplicateCommand>[0],release!:(result:{ok:boolean})=>void;m.state.props.onDuplicateCommand=fn=>{queued=fn;return new Promise(resolve=>release=resolve);};await m.render();await m.open();await act(async()=>m.button("Review exclusion · left").click());await act(async()=>m.button("Confirm exclusion").click());expect(m.button("Saving…").disabled).toBe(true);
   m.state.props.view="personal";await m.render();m.state.props.view="household";await m.render();expect(()=>queued(m.state.h)).toThrow(/view changed/);await act(async()=>release({ok:false}));expect(m.calls).toEqual([]);expect(document.querySelector("[role=dialog]")).toBeNull();
  }finally{await m.close();}
 });
 it("keeps protected Work evidence comparable, but refuses its generic exclusion",async()=>{
  const m=await mount();try{m.state.h={...m.state.h,transactions:m.state.h.transactions.map(tx=>({...tx,source:"shift" as const}))};await m.render();await m.open();await act(async()=>m.button("Review exclusion · left").click());expect(document.querySelector("[role=dialog]")).toBeNull();expect(m.host.textContent).toContain("linked to Work");expect(m.calls).toEqual([]);
  }finally{await m.close();}
 });
 it("shows rejected acceptance inside the review without changing the ledger",async()=>{
  const m=await mount();try{m.state.props.onDuplicateCommand=async()=>({ok:false,userMessage:"Ledger unavailable"});await m.render();await m.open();await act(async()=>m.button("Review exclusion · left").click());await act(async()=>m.button("Confirm exclusion").click());expect(document.querySelector("[role=dialog]")!.textContent).toContain("Ledger unavailable");expect(m.calls).toEqual([]);expect(m.button("Cancel").disabled).toBe(false);
  }finally{await m.close();}
 });
});
