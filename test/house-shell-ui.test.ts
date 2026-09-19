// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HouseShell } from "../src/hearthside/HouseShell.tsx";

let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=document.createElement("div");document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});

it("offers the four canonical rooms and three named levels with one navigation callback",async()=>{
  const visits:Array<[string,string]>=[];
  await act(async()=>root.render(createElement(HouseShell,{route:{room:"kitchen-table",level:"above",householdId:"HH-one"},onNavigate:(room,level)=>visits.push([room,level])})));
  expect([...host.querySelectorAll(".house-shell__rooms button")].map(button=>button.textContent)).toEqual(["Home","Study","Kitchen Table","Together"]);
  expect([...host.querySelectorAll(".house-shell__levels strong")].map(node=>node.textContent)).toEqual(["Journey","Work centre","Plan Studio"]);
  const studio=[...host.querySelectorAll<HTMLButtonElement>("button")].find(button=>button.textContent?.includes("Plan Studio"))!;
  await act(async()=>studio.click());
  expect(visits).toEqual([["kitchen-table","below"]]);
  expect(host.querySelector('[aria-current="page"]')?.textContent).toBe("Kitchen Table");
});

it("keeps a readable condition alongside the room controls",async()=>{
  await act(async()=>root.render(createElement(HouseShell,{route:{room:"home",level:"below",householdId:"HH-one"},onNavigate:()=>undefined,condition:{state:"wilting",days:7,words:"The vine is resting after a week of uncovered, recorded Fund purchases."}})));
  expect(host.querySelector('[data-house-condition="wilting"]')).not.toBeNull();
  expect(host.querySelector('[role="status"]')?.textContent).toContain("The vine is resting");
  expect(host.querySelector('[aria-current="location"]')?.textContent).toContain("Cellar");
});
