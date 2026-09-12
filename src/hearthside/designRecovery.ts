import {acceptKittyDesignOperation,projectKittyDesign} from './design.ts';
import {decodeKittyDesignOperation,type KittyDesignDocument,type KittyDesignOperation} from './designContracts.ts';
export const canReviewRejectedEdit=(operation:KittyDesignOperation)=>['append-stroke','change-shape-field','change-dip','add-stamp','update-stamp'].includes(operation.kind);
export function reviewRejectedEdit(original:KittyDesignOperation,document:KittyDesignDocument,actor:string,ids:{operation:string;gesture:string;stamp:string}){
 if(original.designId!==document.id||!canReviewRejectedEdit(original))throw Error('Open the current piece to make this choice again.');
 const row=projectKittyDesign(document).pieces.find(p=>p.piece.id===original.pieceId);if(!row||row.status!=='clay')throw Error('Return this same piece to the wheel before reviewing the retained edit.');
 let operation:KittyDesignOperation={...original,id:ids.operation,gestureId:ids.gesture};
 if('expectedEditEpoch' in operation)operation.expectedEditEpoch=row.editEpoch;
 if(operation.kind==='change-shape-field')operation.expectedFieldRevision=row.fieldRevisions[`shape:${operation.field}`]??0;
 if(operation.kind==='change-dip')operation.expectedFieldRevision=row.fieldRevisions[`dip:${operation.part}`]??0;
 if(operation.kind==='update-stamp')operation.expectedFieldRevision=row.fieldRevisions[`stamp:${operation.stampId}:${operation.field}`]??0;
 if(operation.kind==='add-stamp')operation.stamp={...operation.stamp,id:ids.stamp};
 // A retained brush mark keeps its original surface mapping, even when that paint is temporarily unmappable.
 operation=decodeKittyDesignOperation(operation);
 const preview=acceptKittyDesignOperation(document,operation,{environment:document.scope.environment,householdId:document.scope.householdId,actorId:actor,order:document.revision+1,acceptedAt:new Date().toISOString()});
 return {operation,baseRevision:document.revision,current:row.piece,proposed:projectKittyDesign(preview.document).pieces.find(p=>p.piece.id===original.pieceId)!.piece,
  recoverable:projectKittyDesign(preview.document).pieces.find(p=>p.piece.id===original.pieceId)!.recoverablePaint.length};
}
export type RejectedEditReview=ReturnType<typeof reviewRejectedEdit>;
