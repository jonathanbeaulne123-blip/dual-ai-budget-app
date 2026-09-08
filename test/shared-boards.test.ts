import { describe, expect, it } from "vitest";
import { catalogHousehold, saveBoardTask, removeBoardTask, saveBoardMilestone, setBoardPhoto, shapeSharedBoards, mergeKitchen, splitForSync, compileHousehold } from "../src/core/index.ts";
import { executeIntent } from "../src/ledgerSync/registry.ts";
import { capturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture, type Scope } from "../src/ledgerSync/protocol.ts";
import { prepareCommand, type AuthorityState } from "../src/ledgerSync/authority.ts";
import { difference, project } from "../src/ledgerSync/patch.ts";

const task = (id="one", memberId="MEM-001") => ({ memberId, id:`BOARD-TASK-${id}`, title:"Feed Hercules", assigneeId:null, dueDate:null, completed:false, expectedVersion:0 });
const mediaId="BM-00000000-0000-4000-8000-000000000001";
describe("shared boards", () => {
  it("opens old households with empty boards and never changes money for shared content", () => {
    const h=catalogHousehold(), before=compileHousehold(h);
    expect(shapeSharedBoards(undefined)).toEqual({photos:[],tasks:[],milestones:[]});
    let next=saveBoardTask(h,task()).household;
    next=saveBoardMilestone(next,{...task(),id:"BOARD-MILESTONE-one",title:"Our anniversary"}).household;
    next=setBoardPhoto(next,{memberId:"MEM-001",slot:1,mediaId,caption:"At home",crop:{x:50,y:50,zoom:1},expectedVersion:0}).household;
    expect({ ...compileHousehold(next), activity: before.activity, lastCommittedAt: before.lastCommittedAt }).toEqual(before);
    expect(next.transactions).toEqual(h.transactions);
    expect(next.goalContributions).toEqual(h.goalContributions);
    expect(splitForSync(next,"MEM-002").shared.kitchen.boards).toEqual(next.kitchen.boards);
  });
  it("refuses stale edits and removed-item resurrection while preserving the caller's input", () => {
    const h=saveBoardTask(catalogHousehold(),task()).household;
    const changed=saveBoardTask(h,{...task(),expectedVersion:1,title:"Feed Hercules at six"}).household;
    expect(()=>saveBoardTask(changed,{...task(),expectedVersion:1,completed:true})).toThrow(/changed on another device/);
    const removed=removeBoardTask(changed,{...task(),expectedVersion:2}).household;
    expect(()=>saveBoardTask(removed,task())).toThrow(/changed on another device/);
    expect(mergeKitchen(removed.kitchen,h.kitchen,removed.tombstones).boards?.tasks).toEqual([]);
    expect(h.kitchen.boards?.tasks[0]?.title).toBe("Feed Hercules");
  });
  it("merges unrelated offline rows in either order and retains a cleared photo slot version", () => {
    const h=catalogHousehold(), a=saveBoardTask(h,task("one")).household, b=saveBoardTask(h,task("two","MEM-002")).household;
    expect(mergeKitchen(a.kitchen,b.kitchen,[]).boards).toEqual(mergeKitchen(b.kitchen,a.kitchen,[]).boards);
    expect(mergeKitchen(a.kitchen,b.kitchen,[]).boards?.tasks).toHaveLength(2);
    const full=setBoardPhoto(h,{memberId:"MEM-001",slot:2,mediaId,caption:"",crop:{x:50,y:50,zoom:1},expectedVersion:0}).household;
    const empty=setBoardPhoto(full,{memberId:"MEM-002",slot:2,mediaId:null,caption:"",crop:{x:50,y:50,zoom:1},expectedVersion:1}).household;
    expect(mergeKitchen(empty.kitchen,full.kitchen,[]).boards?.photos[0]).toMatchObject({mediaId:null,version:2});
    expect(()=>setBoardPhoto(empty,{memberId:"MEM-001",slot:2,mediaId,caption:"",crop:{x:50,y:50,zoom:1},expectedVersion:1})).toThrow(/changed/);
  });
  it("binds authenticated actors and rejects invalid assignments, dates and photo payloads", () => {
    const h=catalogHousehold();
    expect(()=>executeIntent(h,"saveBoardTask",[task()],"MEM-002","test")).toThrow(/ACTOR_MISMATCH/);
    expect(()=>saveBoardTask(h,{...task(),assigneeId:"MEM-other"})).toThrow(/active household member/);
    expect(()=>saveBoardTask(h,{...task(),dueDate:"2026-02-30"})).toThrow();
    expect(()=>saveBoardTask(h,{...task(),title:" "})).toThrow();
    expect(()=>setBoardPhoto(h,{memberId:"MEM-001",slot:1,mediaId:"data:image/jpeg;base64,secret",caption:"",crop:{x:50,y:50,zoom:1},expectedVersion:0})).toThrow(/Upload/);
    h.members[0]!.active=false;
    expect(()=>saveBoardTask(h,task())).toThrow();
  });
  it("replays two independently queued client commands through authority without losing either item", async () => {
    const h=catalogHousehold(), one=splitForSync(h,"MEM-001"),two=splitForSync(h,"MEM-002");
    const state:AuthorityState={sequence:h.revision,shared:one.shared,personal:new Map([["MEM-001",one.personal],["MEM-002",two.personal]])};
    const scope:Scope={environment:h.environment,householdId:h.householdId,memberId:"MEM-001",subject:"test-one",role:"owner",expires:Date.now()+60000,aclEpoch:1};
    const a=await commandFromCapture(capturedIntent(saveBoardTask(h,task("a")).household)!,scope,crypto.randomUUID());
    const b=await commandFromCapture(capturedIntent(saveBoardTask(h,task("b","MEM-002")).household)!,{...scope,memberId:"MEM-002",subject:"test-two"},crypto.randomUUID());
    const first=await prepareCommand(state,a,scope,()=>{});
    const second=await prepareCommand({...state,sequence:first.receipt.sequence,shared:first.shared,personal:new Map([...state.personal,["MEM-001",first.personal]])},b,{...scope,memberId:"MEM-002",subject:"test-two"},()=>{});
    expect(second.shared.kitchen.boards?.tasks.map(r=>r.id).sort()).toEqual(["BOARD-TASK-a","BOARD-TASK-b"]);
    expect(second.receipt.postedIds).toEqual([]);
    expect(project(first.shared,difference(first.shared,second.shared))).toEqual(second.shared);
  });
});
