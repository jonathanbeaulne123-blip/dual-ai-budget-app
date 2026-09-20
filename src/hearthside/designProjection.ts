import {applyNestDesignReference} from './nestDesignSource.ts';
import type { Household } from '../core/types.ts';
import { defaultGoalEnvelope } from '../core/goalEnvelopes.ts';
import { decodeHearthside } from './contracts.ts';
import { kittyDesignReference, projectKittyDesign } from './design.ts';
import type { KittyDesignDocument } from './designContracts.ts';
import {decodePersonalLife} from './personalLifeContracts.ts';

/** Authority-only reference update. It cannot change backing, targets, ownership, or financial timestamps. */
export function applyAcceptedDesignReference(household:Household,document:KittyDesignDocument,bankId:string|null,acceptedAt=new Date().toISOString()):Household {
  if(document.scope.environment!==household.environment || document.scope.householdId!==household.householdId)throw Error('SCOPE_MISMATCH');
  if(document.nest){if(bankId!==null)throw Error('DESIGN_NEST_GOAL_CONFLICT');household=applyNestDesignReference(household,document,acceptedAt);}
  const reference=kittyDesignReference(document), view=projectKittyDesign(document);
  const next={...household,goals:household.goals.map(goal=>{
    if(goal.id!==bankId)return goal;
    if((goal.shared?null:goal.ownerMemberId)!==document.scope.ownerMemberId)throw Error('DESIGN_OWNERSHIP_CHANGED');
    const {studio:_legacy,...envelope}=goal.envelope??defaultGoalEnvelope();
    if(envelope.designRef && envelope.designRef.designId!==document.id)throw Error('DESIGN_BANK_ALREADY_LINKED');
    return {...goal,envelope:{...envelope,designRef:reference}};
  })};
  if(document.scope.ownerMemberId===null) {
    const hearthside=decodeHearthside(household.hearthside);
    const index={...reference,bankId,pieceIds:view.pieces.map(row=>row.piece.id)};
    next.hearthside=decodeHearthside({...hearthside,designs:[...hearthside.designs.filter(row=>row.designId!==document.id),index]});
  } else {
    const personalLife=decodePersonalLife(household.personalLife,document.scope.ownerMemberId);
    const index={version:1 as const,designId:document.id,revision:document.revision,pieceIds:view.pieces.map(row=>row.piece.id)};
    next.personalLife=decodePersonalLife({...personalLife,designs:[...personalLife.designs.filter(row=>row.designId!==document.id),index]},document.scope.ownerMemberId);
  }
  return next;
}
