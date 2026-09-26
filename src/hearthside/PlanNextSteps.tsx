import { useEffect, useRef, useState } from 'react';
import type { Household, HerculesNumberSource } from '../core/index.ts';
import type { PlanVersion } from '../core/planSystem.ts';
import { planAcknowledgementState } from '../core/planSystem.ts';
import { adoptBoardTasks, saveTask, type TaskInput } from '../core/tasks.ts';
import { shapeSharedBoards } from '../core/sharedBoards.ts';
import type { KitchenCommand } from '../kitchenCommand.ts';

/** A stable identity prevents two devices from creating the same agreed next step twice. */
async function identityDigest(parts: string[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(parts));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export async function nextStepTaskId(householdId: string, planVersionId: string, planLineId: string): Promise<string> {
  return `TASK-plan-${await identityDigest([householdId,planVersionId,planLineId])}`;
}
async function confirmationFor(taskId:string,memberId:string) {
  const hex=await identityDigest(['hearthside-next-step-confirmation',taskId,memberId]);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-8${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

export function PlanNextSteps({household,memberId,version,busy,onCommand,onOpenPlan,onOpenPlanner}: {
  household:Household; memberId:string; version:PlanVersion|null; busy:boolean; onCommand:KitchenCommand;
  onOpenPlan:(source:HerculesNumberSource)=>void; onOpenPlanner?:(taskId?:string)=>void;
}) {
  const [working,setWorking]=useState(false),[message,setMessage]=useState('');
  const epoch=useRef(0),lock=useRef(false);
  useEffect(()=>{epoch.current++;lock.current=false;setWorking(false);setMessage('');return()=>{epoch.current++;};},[household.environment,household.householdId,memberId]);
  const rows=version?.lines.filter(line=>line.decision?.nextStep)??[], boards=shapeSharedBoards(household.kitchen.boards);
  const agreed=version?planAcknowledgementState(household,version).complete:false;
  async function add(line:PlanVersion['lines'][number]) {
    if(!version||!agreed||busy||lock.current)return;
    const generation=epoch.current;lock.current=true;setWorking(true);setMessage('');
    try {
      const id=await nextStepTaskId(household.householdId,version.id,line.id);
      if(generation!==epoch.current)return;
      const confirmationId=await confirmationFor(id,memberId);
      if(generation!==epoch.current)return;
      const task:TaskInput['task']={visibility:'household',title:line.decision!.nextStep!.slice(0,240),notes:'',listId:null,parentId:null,doDate:null,dueDate:line.dueDate??null,repeat:'none',cue:'none',assigneeId:line.responsibility?.kind==='member'?line.responsibility.memberId??null:null,backupId:null,chapterId:null,planReference:{planVersionId:version.id,planLineId:line.id},moneyLink:null,expectedAmountCents:null,deleted:false};
      let recovered=false;
      const result=await onCommand(current=>saveTask(current,{memberId,id,expectedRevision:0,task}),{confirmationId,recoverConfirmation:true,onRecoveredConfirmation:()=>{recovered=true;}});
      if(generation===epoch.current)setMessage(recovered||result?.ok?'The next step is in our planner. Its responsible person can accept it there.':'Not confirmed yet. This same next step can be checked again.');
    } catch(error) {if(generation===epoch.current)setMessage(error instanceof Error?error.message:'The next step could not be confirmed.');}
    finally {if(generation===epoch.current){lock.current=false;setWorking(false);}}
  }
  return <section className="together-responsibilities"><h3>Small actions behind our agreed Plan</h3>
    {rows.length?rows.map(line=>{
      const matches=(row:{planReference?:{planVersionId:string;planLineId:string}|null})=>row.planReference?.planLineId===line.id&&row.planReference.planVersionId===version!.id;
      const task=household.tasks?.find(matches),legacy=boards.tasks.find(matches);
      return <article key={line.id}><div><h4>{line.labelSnapshot}</h4><p>{line.decision!.nextStep}</p><small>{line.responsibility?.kind==='joint'?'Both of us':household.members.find(m=>m.id===line.responsibility?.memberId)?.name??'Choose a responsible person'}</small></div>
        {task?<><span>{task.deleted?'Put away in our planner':task.completedAt?'Completed in our planner':'In our planner'}</span>{onOpenPlanner&&<button onClick={()=>onOpenPlanner(task.id)}>Open this next step</button>}</>:legacy?<button disabled={busy||working} onClick={()=>void onCommand(current=>adoptBoardTasks(current,{memberId}))}>Move the existing board tasks into our planner</button>:<button disabled={busy||working||!agreed} onClick={()=>void add(line)}>Add this agreed next step to our tasks</button>}
        <button onClick={()=>onOpenPlan({route:'plan',view:'household',label:line.labelSnapshot,planVersionId:version!.id,planLineId:line.id})}>Read the agreement</button>
      </article>;
    }):<p>Practical next steps from an active Plan appear here. Responsibility is separate from who holds an account.</p>}
    {rows.length>0&&!agreed&&<p>Both people acknowledge this exact Plan before its next steps are added.</p>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
