import {useMemo} from 'react';
import type {Household} from '../core/types.ts';
import {decodeHearthside,memoryKeptByEveryone} from './contracts.ts';
import {GuestVisits} from './GuestVisits.tsx';
import {useHearthsideVault} from './VaultProvider.tsx';
import type {GuestSourceChoice} from './guestClient.ts';
import type {GuestTheme} from './guestContracts.ts';

export function guestSourceChoices(household:Household):GuestSourceChoice[]{
 const state=decodeHearthside(household.hearthside),members=household.members.filter(m=>m.active).map(m=>m.id);
 return [
  ...state.experiences.filter(e=>e.state!=='archived').map(e=>({kind:'experience' as const,id:e.id,revision:e.revision,label:e.title,detail:e.intention})),
  ...state.notes.filter(n=>!n.archived).map(n=>({kind:'note' as const,id:n.id,revision:n.revision,label:n.text.slice(0,80),detail:n.text})),
  ...state.memories.filter(m=>memoryKeptByEveryone(m,members)).map(m=>({kind:'memory' as const,id:m.id,revision:m.revision,label:m.title})),
  ...state.designs.flatMap(d=>d.pieceIds.map(id=>({kind:'piece' as const,id,designId:d.designId,revision:d.revision,label:'An authored piece',detail:id===d.displayPieceId?'The chosen display piece':'A shared Studio piece'}))),
 ];
}
export function GuestVisitsEntry({household,theme,onClose}:{household:Household;theme:GuestTheme;onClose:()=>void}){
 const {connection,error}=useHearthsideVault();
 const host=useMemo(()=>({householdId:household.householdId,choices:guestSourceChoices(household)}),[household]);
 const auth=useMemo(()=>connection?{scopeKey:JSON.stringify(['guest',connection.identity,connection.scope.environment,connection.scope.subject,connection.scope.householdId]),token:connection.token}:null,[connection]);
 if(!auth)return <section className="hearthside-focus"><h2>Our doorway</h2><p role="status">{error||'Connecting to your own account…'}</p><button onClick={onClose}>Return to our room</button></section>;
 return <GuestVisits embedded auth={auth} host={host} theme={theme} onClose={onClose}/>;
}
