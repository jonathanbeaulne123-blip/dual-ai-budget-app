import type { KittyDesignReference } from './designContracts.ts';
import type { Goal,Household } from '../core/types.ts';

/** Financial restoration changes books, never the current authored studio or design reference. */
export function preserveGoalArtwork(current: Goal[], restored: Goal[]): Goal[] {
  return restored.map(goal => {
    const live=current.find(row=>row.id===goal.id)?.envelope;
    if (!goal.envelope && !live?.studio && !live?.designRef) return goal;
    const {studio:_oldStudio,designRef:_oldDesign,...financial}=goal.envelope ?? {
      version: 1 as const, kind: 'build' as const, purpose: '', refill: 'target' as const,
      glaze: 'cream' as const, archivedAt: null,
    };
    return {...goal,envelope:{...financial,...(live?.designRef?{designRef:live.designRef}:live?.studio?{studio:live.studio}:{})}};
  });
}

export type CanonicalBankArtwork={ownerMemberId:string|null;reference:KittyDesignReference};
/** Only authority supplies this lookup; request payloads cannot attach design identities. */
export function restoreCanonicalBankArtwork(goals:Goal[],lookup:(bankId:string)=>CanonicalBankArtwork|null):Goal[]{
  return goals.map(goal=>{
    const known=lookup(goal.id);if(!known)return goal;
    if((goal.shared?null:goal.ownerMemberId)!==known.ownerMemberId)throw Error('KITTY_DESIGN_OWNERSHIP_REVIEW_REQUIRED');
    if(goal.envelope?.designRef&&goal.envelope.designRef.designId!==known.reference.designId)throw Error('KITTY_DESIGN_AUTHORITY_REQUIRED');
    const {studio:_legacy,...financial}=goal.envelope??{version:1 as const,kind:'build' as const,purpose:'',refill:'target' as const,glaze:'cream' as const,archivedAt:null};
    return {...goal,envelope:{...financial,designRef:known.reference}};
  });
}

/** Financial recovery preserves the complete operational/story graph, including its approvals. */
type SharedLifeRecords=Pick<Household,'hearthside'|'playRoom'|'companionGallery'|'chapters'|'rituals'|'moves'|'wins'|'tasks'|'taskLists'|'nativeEvents'>;
export function currentSharedLifeRecords(current:SharedLifeRecords):SharedLifeRecords{
  return {hearthside:current.hearthside,playRoom:current.playRoom,companionGallery:current.companionGallery,chapters:current.chapters,rituals:current.rituals,moves:current.moves,wins:current.wins,tasks:current.tasks,taskLists:current.taskLists,nativeEvents:current.nativeEvents};
}
