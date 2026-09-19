import type {Household} from '../core/types.ts';
import {canonical} from '../ledgerSync/patch.ts';
import {decodeHearthside} from './contracts.ts';
import {decodeArtifactPublication,type ArtifactPublication} from './workspacePublication.ts';
/** Called only after LedgerRoom verifies the prepared/revoked copy through the trusted shared namespace. */
export function acceptWorkspacePublicationState(h:Household,input:ArtifactPublication,actor:string):Household{
 const p=decodeArtifactPublication(input),state=decodeHearthside(h.hearthside),old=state.artifactPublications?.find(row=>row.id===p.id),experience=state.experiences.find(e=>e.id===p.experienceId);
 if(p.sharedBy!==actor||!h.members.some(m=>m.active&&m.id===actor))throw Error('HEARTHSIDE_ARTIFACT_AUTHOR_REQUIRED');
 if(old&&canonical({...old,state:p.state})!==canonical(p))throw Error('HEARTHSIDE_ARTIFACT_ID_REUSED');
 if(old?.state==='withdrawn'&&p.state!=='withdrawn')throw Error('ARTIFACT_WITHDRAWN');
 if(p.state==='active')throw Error('HEARTHSIDE_ARTIFACT_ACCEPTANCE_REQUIRED');
 if(p.state==='accepted'&&!old){
  if(!experience||experience.state==='archived'||experience.revision!==p.experienceRevision)throw Error('EXPERIENCE_CONTEXT_CHANGED');
  if(experience.references.some(r=>r.kind==='artifact'&&r.id===p.id))throw Error('HEARTHSIDE_ARTIFACT_REFERENCE_CHANGED');
  experience.references.push({kind:'artifact',id:p.id,revision:1});experience.revision++;
 }else if(p.state==='withdrawn'&&experience&&experience.references.some(r=>r.kind==='artifact'&&r.id===p.id)){
  experience.references=experience.references.filter(r=>r.kind!=='artifact'||r.id!==p.id);experience.revision++;
 }
 state.artifactPublications=[...(state.artifactPublications??[]).filter(row=>row.id!==p.id),p];
 return {...h,hearthside:decodeHearthside(state)};
}
