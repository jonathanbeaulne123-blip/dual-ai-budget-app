// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HerculesPresence } from "../src/Hercules.tsx";
import { catalogHousehold, addRecurrence, postEntry } from "../src/core/index.ts";
import { companionFor, commitCompanion } from "../src/core/herculesCompanion.ts";
import type { KitchenCommand } from "../src/kitchenCommand.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  HTMLElement.prototype.scrollTo = vi.fn();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function send(text: string) {
  const input = host.querySelector('input[aria-label="Ask Hercules"]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => { input.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
}
describe("private chat pending continuity", () => {
  it("keeps talking and includes the complete pending exchange before cloud ACK", async () => {
    const requests: Record<string, any>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      requests.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ ok: true, provider: "gemini", reply: "A warm windowsill. Excellent for a nap." }), { headers: { "Content-Type": "application/json" } });
    }));
    const h = catalogHousehold(); h.companionProfile = companionFor(h, "MEM-001");
    const onCommand = vi.fn<KitchenCommand>().mockImplementation(() => new Promise(() => {}));
    await act(async () => root.render(createElement(HerculesPresence, { household: h, today: "2026-09-10", tab: "ledger", adding: false, memberId: "MEM-001", view: "household", onOpenAdd: vi.fn(), onGo: vi.fn(), onLedger: vi.fn(), onCompanionCommand: onCommand, onOpenSource: vi.fn() })));
    await act(async () => (host.querySelector('.hercules-pill') as HTMLButtonElement).click());
    await send("Tell me about your favourite napping spot");
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Saving this conversation");
    await send("why?");
    expect(requests).toHaveLength(2);
    expect(requests[1]!.companion.context.map((row: { role: string }) => row.role)).toEqual(["user", "hercules"]);
    expect(JSON.stringify(requests[1]!.companion.context)).toContain("napping spot");
    expect(host.textContent).not.toContain("Conversation saved privately");
  });
  it.each([false, true])("Undo restores an earlier preference without creating another Undo; stale=%s", async stale => {
    let h = catalogHousehold(); h.companionProfile = companionFor(h, "MEM-001");
    h.companionProfile.preferences = [{ key: "answerLength", value: "detailed", revision: 1, updatedAt: new Date().toISOString(), source: "explicit-user" }];
    const callback = vi.fn<KitchenCommand>().mockImplementation(async (fn, options) => {
      try { const result = fn(h); h = result.household; render(); return { kind: "synchronized", ok: true, household: h } as import("../src/kitchenCommand.ts").KitchenCommandResult; }
      catch { options?.onDefinitiveRejected?.({ retryable: false }); return null; }
    });
    function render() { root.render(createElement(HerculesPresence, { household: h, today: "2026-09-10", tab: "ledger", adding: false, memberId: "MEM-001", view: "household", onOpenAdd: vi.fn(), onGo: vi.fn(), onLedger: vi.fn(), onCompanionCommand: callback, onOpenSource: vi.fn() })); }
    await act(async () => render());
    await act(async () => (host.querySelector('.hercules-pill') as HTMLButtonElement).click());
    await send("keep answers short");
    expect(h.companionProfile!.preferences.find(row => row.key === "answerLength")?.value).toBe("concise");
    if (stale) {
      h = commitCompanion(h, { version: 1, id: crypto.randomUUID(), scope: h.companionProfile!.scope, operation: { kind: "preference.set", key: "answerLength", value: "detailed", expectedRevision: 2, origin: { kind: "manual" } } }).household;
      await act(async () => render());
    }
    await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === "Undo remembered preference")!.click());
    expect(h.companionProfile!.preferences.find(row => row.key === "answerLength")?.value).toBe("detailed");
    expect(host.textContent).not.toContain("Undo remembered preference");
    if (stale) expect(host.textContent).toContain("not applied");
    await send("my favourite colour is blue");
    expect(h.companionProfile!.preferences.find(row => row.key === "favouriteColours")?.value).toEqual(["blue"]);
  });

});

describe("integrated session conversation", () => {
 it("keeps an unsaved exchange in its view, recovers its receipt, and does not expose it to another person", async () => {
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({ok:true,provider:"gemini",reply:"The blanket is excellent."}),{headers:{"Content-Type":"application/json"}})));
  let h=catalogHousehold();h.companionProfile=companionFor(h,"MEM-001");let view:"household"|"personal"="household",memberId="MEM-001",mutations=0;
  const command:KitchenCommand=async(fn,options)=>{if(options?.recoverConfirmation){options.onRecoveredConfirmation?.();return null;}mutations++;h=fn(h).household;return null;};
  const render=()=>root.render(createElement(HerculesPresence,{household:h,today:"2026-09-10",tab:"ledger",adding:false,memberId,view,onOpenAdd:vi.fn(),onGo:vi.fn(),onLedger:vi.fn(),onCompanionCommand:command,onOpenSource:vi.fn()}));
  await act(async()=>render());await act(async()=>(host.querySelector('.hercules-pill') as HTMLButtonElement).click());await send("Tell me about a cobalt napping blanket");
  view="personal";await act(async()=>render());expect(host.textContent).not.toContain("cobalt napping blanket");
  view="household";await act(async()=>render());expect(host.textContent).toContain("cobalt napping blanket");
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Retry conversation save')!.click());expect(mutations).toBe(1);expect(host.textContent).toContain('Conversation saved privately');
  memberId="MEM-002";await act(async()=>render());expect(host.textContent).not.toContain("cobalt napping blanket");
 });
 it("keeps a delayed reply out after books change and makes the composer usable", async()=>{
  let resolve!:(r:Response)=>void;vi.stubGlobal("fetch",vi.fn(()=>new Promise(done=>resolve=done)));
  let h=catalogHousehold();const command=vi.fn<KitchenCommand>().mockResolvedValue(null);
  const render=()=>root.render(createElement(HerculesPresence,{household:h,today:"2026-09-10",tab:"ledger",adding:false,memberId:"MEM-001",view:"household",onOpenAdd:vi.fn(),onGo:vi.fn(),onLedger:vi.fn(),onCompanionCommand:command,onOpenSource:vi.fn()}));
  await act(async()=>render());await act(async()=>(host.querySelector('.hercules-pill') as HTMLButtonElement).click());await send("Tell me about the windowsill");
  h=addRecurrence(h,{cadence:"monthly",nextDate:"2026-09-12",type:"expense",amount:"4.00",accountId:"ACC-VISA",subcategoryId:"SUB-HOUSING-ELECTRIC",note:"New current bill"}).household;await act(async()=>render());await act(async()=>resolve(new Response(JSON.stringify({ok:true,provider:"gemini",reply:"STALE_REPLY_MARKER"}),{headers:{"Content-Type":"application/json"}})));
  expect(host.textContent).not.toContain('STALE_REPLY_MARKER');expect((host.querySelector('input[aria-label="Ask Hercules"]') as HTMLInputElement).disabled).toBe(false);expect(command).not.toHaveBeenCalled();
 });
 it("does not cancel the next reply when the prior private exchange receives its ACK", async()=>{
  let h=catalogHousehold();h.companionProfile=companionFor(h,"MEM-001");let resolve!:(r:Response)=>void;
  vi.stubGlobal("fetch",vi.fn(()=>new Promise(done=>resolve=done)));
  const command=vi.fn<KitchenCommand>().mockResolvedValue(null);
  const render=()=>root.render(createElement(HerculesPresence,{household:h,today:"2026-09-10",tab:"ledger",adding:false,memberId:"MEM-001",view:"household",onOpenAdd:vi.fn(),onGo:vi.fn(),onLedger:vi.fn(),onCompanionCommand:command,onOpenSource:vi.fn()}));
  await act(async()=>render());await act(async()=>(host.querySelector('.hercules-pill') as HTMLButtonElement).click());await send("Tell me about the windowsill");
  h={...h,revision:h.revision+1,baseRevision:h.baseRevision+1,lastCommittedAt:new Date().toISOString()};
  await act(async()=>render());await act(async()=>resolve(new Response(JSON.stringify({ok:true,provider:"gemini",reply:"The windowsill is warm and quiet."}),{headers:{"Content-Type":"application/json"}})));
  expect(host.textContent).toContain('The windowsill is warm and quiet.');expect(host.textContent).not.toContain('books changed');expect(command).toHaveBeenCalled();
 });

});

describe("preference changes during acknowledgement",()=>{
 it.each(['Actually, keep it short.','Forget that preference.'])('keeps the final instruction while the first exchange awaits ACK: %s',async(last)=>{
  let h=catalogHousehold();h.companionProfile=companionFor(h,'MEM-001');let release!:(value:import('../src/kitchenCommand.ts').KitchenCommandResult)=>void;let first=true;
  const callback:KitchenCommand=async(fn,options)=>{try{const next=fn(h);h=next.household;if(first){first=false;return await new Promise(done=>release=done);}return {kind:'synchronized',ok:true,household:h} as import('../src/kitchenCommand.ts').KitchenCommandResult;}catch{options?.onDefinitiveRejected?.();return null;}};
  await act(async()=>root.render(createElement(HerculesPresence,{household:h,today:'2026-09-10',tab:'ledger',adding:false,memberId:'MEM-001',view:'household',onOpenAdd:vi.fn(),onGo:vi.fn(),onLedger:vi.fn(),onCompanionCommand:callback,onOpenSource:vi.fn()})));
  await act(async()=>(host.querySelector('.hercules-pill') as HTMLButtonElement).click());await send('Give me detailed answers');await send(last);
  await act(async()=>release({kind:'synchronized',ok:true,household:h} as import('../src/kitchenCommand.ts').KitchenCommandResult));
  expect(h.companionProfile!.preferences.find(row=>row.key==='answerLength')?.value).toBe(last.startsWith('Forget')?null:'concise');
  expect(h.companionProfile!.conversations.find(row=>row.view==='household')!.turns.some(row=>row.text===last)).toBe(true);
  if(last.startsWith('Forget'))expect(host.textContent).not.toContain('Undo remembered preference');
 });
});


describe("desktop source parity",()=>{
 it("offers an accessible help invitation and opens the quoted account source",async()=>{
  Object.defineProperty(window,"innerWidth",{configurable:true,value:1440});
  vi.stubGlobal("fetch",vi.fn(async()=>new Response('{}',{status:503})));
  const household=postEntry(catalogHousehold(),{date:'2026-09-10',type:'expense',amount:'4.00',accountId:'ACC-VISA',subcategoryId:'SUB-FOOD-GROCERIES',note:'Synthetic groceries',createdBy:'MEM-001'}).household;
  const onOpenSource=vi.fn();
  await act(async()=>root.render(createElement(HerculesPresence,{household,today:'2026-09-10',tab:'ledger',adding:false,memberId:'MEM-001',view:'household',onOpenAdd:vi.fn(),onGo:vi.fn(),onLedger:vi.fn(),onCompanionCommand:vi.fn().mockResolvedValue(null),onOpenSource})));
  const launcher=host.querySelector('.hercules-live')!;expect(launcher.getAttribute('aria-label')).toContain('How can I help?');
  await act(async()=>launcher.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));await send("What's on the Visa?");
  const source=host.querySelector('.hercules-grounded-fact') as HTMLButtonElement;expect(source).not.toBeNull();await act(async()=>source.click());
  expect(onOpenSource).toHaveBeenCalledWith(expect.objectContaining({accountId:'ACC-VISA',view:'household'}));
 });
});


it("bounds repeated offline forget requests and retains every queued forget exchange",async()=>{
 let h=catalogHousehold();h.companionProfile=companionFor(h,'MEM-001');let release!:(value:import('../src/kitchenCommand.ts').KitchenCommandResult)=>void;let first=true,calls=0;
 const callback:KitchenCommand=async(fn,options)=>{calls++;try{h=fn(h).household;if(first){first=false;return await new Promise(done=>release=done);}return {kind:'synchronized',ok:true,household:h} as import('../src/kitchenCommand.ts').KitchenCommandResult;}catch{options?.onDefinitiveRejected?.();return null;}};
 await act(async()=>root.render(createElement(HerculesPresence,{household:h,today:'2026-09-10',tab:'ledger',adding:false,memberId:'MEM-001',view:'household',onOpenAdd:vi.fn(),onGo:vi.fn(),onLedger:vi.fn(),onCompanionCommand:callback,onOpenSource:vi.fn()})));
 await act(async()=>(host.querySelector('.hercules-pill') as HTMLButtonElement).click());await send('Give me detailed answers');
 for(let i=0;i<25;i++)await send('Forget that preference.');
 expect(host.textContent).toContain('I have not applied this request.');
 await act(async()=>release({kind:'synchronized',ok:true,household:h} as import('../src/kitchenCommand.ts').KitchenCommandResult));
 expect(calls).toBeLessThanOrEqual(40);expect(h.companionProfile!.preferences.find(p=>p.key==='answerLength')?.value).toBeNull();
 const turns=h.companionProfile!.conversations.find(p=>p.view==='household')!.turns;
 expect(turns.filter(t=>t.role==='user'&&t.text==='Forget that preference.')).toHaveLength(19);
}, 15_000);


it("moves focus into phone help, wraps Tab, and restores the launcher on Escape",async()=>{
 await act(async()=>root.render(createElement(HerculesPresence,{household:catalogHousehold(),today:'2026-09-10',tab:'ledger',adding:false,memberId:'MEM-001',view:'household',onOpenAdd:vi.fn(),onGo:vi.fn(),onLedger:vi.fn(),onCompanionCommand:vi.fn().mockResolvedValue(null),onOpenSource:vi.fn()})));
 const launcher=host.querySelector('.hercules-pill') as HTMLButtonElement;launcher.focus();await act(async()=>launcher.click());
 const dialog=host.querySelector('[role="dialog"]')!;expect(dialog.contains(document.activeElement)).toBe(true);
 const controls=[...dialog.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
 controls.at(-1)!.focus();await act(async()=>document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})));expect(document.activeElement).toBe(controls[0]);
 await act(async()=>document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));expect(host.querySelector('[role="dialog"]')).toBeNull();expect(document.activeElement).toBe(host.querySelector('.hercules-pill'));
});
