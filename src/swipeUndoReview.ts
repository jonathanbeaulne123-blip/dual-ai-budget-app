import {fundedMoneyUndoTarget,latestMemberLedgerToken,type Household,type UndoToken,type SwipeUndoStrip} from './core/index.ts';
export type SwipeUndoWindow=SwipeUndoStrip & {expiresAt:number;scopeIdentity:string};
/** A short-lived affordance; this does not expire the member's global Undo history. */
export function swipeUndoUnavailable(h:Household,history:UndoToken[],strip:SwipeUndoWindow,active:SwipeUndoWindow|null,scopeIdentity:string,now=Date.now()):string|null{
 if(!active||active.token.id!==strip.token.id||active.expiresAt!==strip.expiresAt||strip.scopeIdentity!==scopeIdentity)return 'This Undo belongs to an earlier view.';
 if(!Number.isFinite(strip.expiresAt)||now>=strip.expiresAt)return 'The quick Undo window has ended.';
 if(latestMemberLedgerToken(history,strip.memberId)?.id!==strip.token.id)return 'Undo your latest money change first.';
 try{const id=fundedMoneyUndoTarget(h,strip.token),tx=h.transactions.find(t=>t.id===id);if(!tx||tx.createdBy!==strip.memberId||tx.visibility!=="household"||tx.type!=="expense"||tx.isDuplicate||tx.reversalOfId||h.transactions.some(t=>t.reversalOfId===id))return 'This purchase already changed. Review it in Books.';}catch{return 'This purchase needs its recorded correction in Books.';}
 return null;
}
