// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { LedgerPage } from "../src/Ledger.tsx";
import { seedDemoHousehold } from "../src/core/index.ts";

it("opens activity with bounded rows and searches the entire list without changing money", async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const household = seedDemoHousehold({today:"2026-08-21"});
  const original = household.transactions.find(row => row.type === "expense" && row.visibility === "household")
    ?? household.transactions.find(row => row.type === "expense")!;
  household.transactions = Array.from({length:80}, (_,i) => ({...original,id:`TXN-RENDER-${i}`,note:i===0?"Find the earliest row":"Regular entry",potentialDuplicate:true,isDuplicate:false}));
  const before = JSON.stringify(household);
  const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
  try {
    await act(async()=>root.render(createElement(LedgerPage,{household,memberId:"MEM-001",view:"household",presentedTransactions:true,sourceFocus:null,onClearSource:()=>{},onChange:()=>{throw new Error("Read actions must not write");},onRemove:()=>{throw new Error("Read actions must not write");}})));
    expect(host.querySelectorAll("[data-ledger-row-id]")).toHaveLength(50);
    expect(host.querySelector(".duplicate-contrast")).toBeNull();
    const more=[...host.querySelectorAll("button")].find(node=>node.textContent?.startsWith("Show 30 more"))!;
    await act(async()=>more.click());
    expect(host.querySelectorAll("[data-ledger-row-id]")).toHaveLength(80);
    const input=host.querySelector("input")!;
    await act(async()=>{
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,"Find the earliest row");
      input.dispatchEvent(new Event("input",{bubbles:true}));
    });
    expect(host.querySelectorAll("[data-ledger-row-id]")).toHaveLength(1);
    expect(host.querySelector("[data-ledger-row-id]")?.getAttribute("data-ledger-row-id")).toBe("TXN-RENDER-0");
    expect(JSON.stringify(household)).toBe(before);
  } finally {await act(async()=>root.unmount());host.remove();}
});
