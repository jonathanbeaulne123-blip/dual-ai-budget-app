import {useCallback,useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SharedLifeRestore,type SharedLifeRestoreSource} from '../../src/hearthside/SharedLifeRestore.tsx';
import type {Household} from '../../src/core/types.ts';
import type {SharedLifeRestoreIntent} from '../../src/hearthside/sharedLifeRestoreContracts.ts';
import {capturedIntent,clearCapturedIntent} from '../../src/ledgerSync/capture.ts';
import type {KitchenCommand} from '../../src/kitchenCommand.ts';
let loseReply=false;
declare global{interface Window{sharedLifeRestoreProof:{theme:(value:'classic'|'taylor'|'newfoundland')=>void;scope:(household:string,member?:string)=>void;online:(value:boolean)=>void;loseReply:()=>void;refresh:()=>Promise<void>;snapshot:()=>Household|null;editor:()=>string;closed:()=>number}}}
async function api<T>(householdId:string,memberId:string,action:string,input:unknown={},signal?:AbortSignal):Promise<T>{const r=await fetch('/__restore_api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({householdId,memberId,action,input}),signal});if(!r.ok)throw Error(await r.text());return await r.json() as T;}
function Proof(){
 const [theme,setTheme]=useState<'classic'|'taylor'|'newfoundland'>('classic'),[householdId,setHouseholdId]=useState('HH-browser-a'),[memberId,setMemberId]=useState('MEM-001'),[connected,setConnected]=useState(true),[h,setH]=useState<Household|null>(null),[editor,setEditor]=useState(''),[closed,setClosed]=useState(0);
 const refresh=useCallback(async()=>{const next=await api<Household>(householdId,memberId,'state');setH(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);},[householdId,memberId]);
 useEffect(()=>{let alive=true;void api<Household>(householdId,memberId,'state').then(value=>{if(alive)setH(value);});return()=>{alive=false;};},[householdId,memberId]);
 const client=useMemo<SharedLifeRestoreSource>(()=>({sharedLifeRestorePoints:signal=>api(householdId,memberId,'points',{},signal),sharedLifeRestorePreview:(input,signal)=>api(householdId,memberId,'preview',input,signal)}),[householdId,memberId]);
 const source=useCallback(()=>client,[client]);
 const onCommand:KitchenCommand=async(run,options)=>{
  if(!h||h.householdId!==householdId)return null;clearCapturedIntent(h);const result=run(h),capture=capturedIntent(result.household);if(!capture)throw Error('Missing capture');
  const intent=capture.steps[0]!.args[0] as SharedLifeRestoreIntent;
  const ack=await api<{type:string;definitive?:boolean}>(householdId,memberId,'command',intent);
  if(loseReply){loseReply=false;throw Error('Synthetic lost reply after authority accepted');}
  if(ack.type==='ack'){options?.onRecoveredConfirmation?.();await refresh();}else if(ack.definitive)options?.onDefinitiveRejected?.();return null;
 };
 window.sharedLifeRestoreProof={theme:setTheme,scope:(household,member='MEM-001')=>{setHouseholdId(household);setMemberId(member);setH(null);},online:setConnected,loseReply:()=>{loseReply=true;},refresh,snapshot:()=>h,editor:()=>editor,closed:()=>closed};
 return <main style={{maxWidth:1400,margin:'auto',padding:12}}><p style={{fontSize:14}}>Local synthetic review • actual LedgerRoom and archived points • {householdId} • {memberId}</p>{h&&h.householdId===householdId?<SharedLifeRestore household={h} memberId={memberId} identity={`synthetic-${memberId}`} connected={connected} theme={theme} source={source} onCommand={onCommand} onClose={()=>setClosed(n=>n+1)} onEditMemory={setEditor}/>:<p role="status">Loading this shared home…</p>}</main>;
}
createRoot(document.getElementById('root')!).render(<Proof/>);
