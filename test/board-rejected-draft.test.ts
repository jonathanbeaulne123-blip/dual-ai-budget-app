// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { BoardRejectedDraft, isBoardDraft } from "../src/BoardRejectedDraft.tsx";
import { catalogHousehold } from "../src/core/index.ts";
import type { LedgerCommand } from "../src/ledgerSync/protocol.ts";
it("retains authored fields after reload and opens the board without replaying the rejected command", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const household=catalogHousehold(),onOpen=vi.fn();
  const command:LedgerCommand={version:2,id:"rejected",environment:household.environment,householdId:household.householdId,observedSequence:1,steps:[{kind:"saveBoardTask",args:[{title:"Buy groceries",dueDate:"2026-09-10",assigneeId:"MEM-001",completed:false,accessToken:"must-not-render"}],resources:[],reviewed:[],previewIds:[]}]};
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try {
    for(const theme of ["classic","taylor","newfoundland"]) {
      document.documentElement.dataset.theme=theme;
      await act(async()=>root.render(createElement(BoardRejectedDraft,{command:JSON.parse(JSON.stringify(command)),household,onOpen})));
      expect(host.querySelector("textarea")?.value).toContain("Buy groceries\nDate: 2026-09-10");
      expect(host.innerHTML).not.toContain("must-not-render");
      await act(async()=>host.querySelector("button")!.click());
    }
    expect(onOpen.mock.calls).toEqual([["tasks"],["tasks"],["tasks"]]);
    await act(async()=>root.render(createElement(BoardRejectedDraft,{command:{...command,householdId:"HH-other"},household,onOpen})));
    expect(host.textContent).toBe("");
    expect(isBoardDraft({...command,steps:[...command.steps,{...command.steps[0]!,kind:"postEntry"}]})).toBe(false);
  } finally { await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals(); }
});
