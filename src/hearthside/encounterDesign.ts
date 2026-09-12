import {sha256String} from '../core/synchronousHash.ts';
import {createKittyDesignDocument,acceptKittyDesignOperation,projectKittyDesign,type KittyDesignDocument,type KittyDesignOperation} from './design.ts';
import {encounterStudioRecipe} from './encounterKeepsake.ts';
import type {SharedEncounter} from './encounterContracts.ts';

type OperationInput<T> = T extends unknown?Omit<T,'version'|'id'|'designId'|'pieceId'|'gestureId'>:never;
export const encounterDesignIdentity=(environment:string,householdId:string,id:string,digest:string)=>{
 const key=sha256String(JSON.stringify(['encounter-design-v1',environment,householdId,id,digest]));
 // Piece IDs share the legacy 60-character display/reference contract.
 return {designId:'DESIGN-encounter-'+key,pieceId:'PIECE-encounter-'+key.slice(0,44)};
};
/** A user-requested copy of reviewed choices, with real attributable operations and no firing or backing. */
export async function createEncounterDesign(encounter:SharedEncounter,scope:{environment:'development'|'production';householdId:string;memberId:string},acceptedAt:string):Promise<KittyDesignDocument>{
 const recipe=await encounterStudioRecipe(encounter),ids=encounterDesignIdentity(scope.environment,scope.householdId,encounter.id,recipe.compositionDigest);
 let document=createKittyDesignDocument(ids.designId,{environment:scope.environment,householdId:scope.householdId,ownerMemberId:null});
 const base={version:1 as const,designId:ids.designId,pieceId:ids.pieceId};
 const accept=(fields:OperationInput<KittyDesignOperation>)=>{
  const n=document.revision+1,id='OP-encounter-'+recipe.compositionDigest+'-'+n;
  document=acceptKittyDesignOperation(document,{...base,id,gestureId:'GESTURE-encounter-'+recipe.compositionDigest+(n===1?'-create':'-copy'),...fields} as KittyDesignOperation,{environment:scope.environment,householdId:scope.householdId,actorId:scope.memberId,order:n,acceptedAt}).document;
 };
 accept({kind:'create-piece',base:recipe.base,sculpt:recipe.sculpt});
 for(const stamp of recipe.stamps)accept({kind:'add-stamp',expectedEditEpoch:0,stamp});
 for(const {stroke} of recipe.derivedStrokes){const piece=projectKittyDesign(document).pieces[0]!;accept({kind:'append-stroke',expectedEditEpoch:piece.editEpoch,surfaceRevision:piece.surfaceRevisions[stroke.part],stroke});}
 return document;
}
