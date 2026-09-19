import {object,identifier,revisionValue,textValue,type DesignReference} from './contracts.ts';
export type StudioHandoff={version:1;id:string;revision:number;authorId:string;recipientId:string;design:DesignReference;text:string;withdrawn:boolean};
export function decodeStudioHandoff(input:unknown):StudioHandoff{
 const v=object(input,['version','id','revision','authorId','recipientId','design','text','withdrawn']),d=object(v.design,['version','documentId','pieceId','revision']);
 if(v.version!==1||d.version!==1||typeof v.withdrawn!=='boolean')throw Error('HEARTHSIDE_HANDOFF_INVALID');
 return {version:1,id:identifier(v.id),revision:revisionValue(v.revision,1),authorId:identifier(v.authorId),recipientId:identifier(v.recipientId),design:{version:1,documentId:identifier(d.documentId),pieceId:identifier(d.pieceId),revision:revisionValue(d.revision,1)},text:textValue(v.text,2000,true),withdrawn:v.withdrawn};
}
