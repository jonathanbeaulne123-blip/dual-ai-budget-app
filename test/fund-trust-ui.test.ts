// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { FundStage } from "../src/FundStage.tsx";
import { fundTrustStorageKey } from "../src/core/fundTrust.ts";
import { trustFixture } from "./fixtures/fund-trust.ts";
import * as sources from "../src/core/scenarioSources.ts";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
async function mount() {
  sessionStorage.clear(); const {h}=trustFixture();
  const host=document.createElement("div");document.body.append(host);const root=createRoot(host),writes:string[]=[];
  const props={household:h,memberId:"MEM-001",today:"2026-09-08",view:"household" as const,presentation:"phone" as const,widgetId:"level" as const,busy:false,onKitchen:()=>{writes.push("write");},onOpenAccount:()=>{},onOpenDestination:()=>{}};
  await act(async()=>root.render(createElement(FundStage,props)));
  const button=(name:string)=>[...host.querySelectorAll<HTMLButtonElement>(".trust-stop")].find(button => button.getAttribute("aria-label")?.startsWith(name+"."))!;
  return {h,host,root,props,writes,button,close:async()=>{await act(async()=>root.unmount());host.remove();}};
}
describe("Trust in the phone Fund stage",()=>{
  it("defaults to Confirmed, keeps current Fund and accepted geometry fixed, and invents no Observed cone",async()=>{
    const spy=vi.spyOn(sources,"reviewScenarioSources"),m=await mount(),before=JSON.stringify(m.h);
    try {
      expect(m.button("Confirmed").getAttribute("aria-pressed")).toBe("true");expect(m.button("+ Estimated").disabled).toBe(true);expect(m.button("+ Estimated").textContent).toContain("No scenario");
      expect(m.host.querySelectorAll("svg")).toHaveLength(1);const amount=m.host.querySelector("h2")!.textContent;
      const actual=m.host.querySelector(".reach-actual")!.getAttribute("d"), dot=m.host.querySelector(".reach-dot")!.getAttribute("cy"),wall=m.host.querySelector(".trust-wall")!.getAttribute("x1");
      await act(async()=>m.button("+ Observed").click());expect(m.button("+ Observed").getAttribute("aria-pressed")).toBe("true");
      expect(m.host.querySelector("h2")!.textContent).toBe(amount);expect(m.host.querySelector(".reach-actual")!.getAttribute("d")).toBe(actual);expect(m.host.querySelector(".reach-dot")!.getAttribute("cy")).toBe(dot);
      expect(m.host.querySelector(".trust-wall")!.getAttribute("x1")).not.toBe(wall);expect(m.host.querySelector(".reach-cone")).toBeNull();expect(m.host.textContent).toContain("Not modelled");
      expect(m.writes).toEqual([]);expect(spy).not.toHaveBeenCalled();expect(JSON.stringify(m.h)).toBe(before);
    }finally{await m.close();spy.mockRestore();}
  });
  it("stores only an enum in its room/day and restores the original room preference",async()=>{
    const m=await mount();try{
      await act(async()=>m.button("+ Observed").click());const key=fundTrustStorageKey(m.h.environment,m.h.householdId,"MEM-001","household",m.props.today);expect(sessionStorage.getItem(key)).toBe("observed");
      await act(async()=>m.root.render(createElement(FundStage,{...m.props,view:"personal"})));expect(m.button("Confirmed").getAttribute("aria-pressed")).toBe("true");
      await act(async()=>m.root.render(createElement(FundStage,m.props)));expect(m.button("+ Observed").getAttribute("aria-pressed")).toBe("true");
      await act(async()=>m.root.render(createElement(FundStage,{...m.props,today:"2026-09-09"})));expect(m.button("Confirmed").getAttribute("aria-pressed")).toBe("true");expect(m.writes).toEqual([]);
    }finally{await m.close();}
  });
});
