import {decodeKittyDesignOperation,designRecord} from './designContracts.ts';
import type {KittyStrokeV1} from '../core/types.ts';
export type KeyboardStrokeDraft={stroke:KittyStrokeV1;expectedEditEpoch:number;surfaceRevision:number};
export function decodeKeyboardStrokeDraft(value:unknown):KeyboardStrokeDraft{
 designRecord(value,['stroke','expectedEditEpoch','surfaceRevision']);
 const op=decodeKittyDesignOperation({version:1,id:'draft',gestureId:'draft',designId:'draft',pieceId:'draft',kind:'append-stroke',...value});
 if(op.kind!=='append-stroke')throw Error('INVALID_STROKE_DRAFT');
 return {stroke:op.stroke,expectedEditEpoch:op.expectedEditEpoch,surfaceRevision:op.surfaceRevision};
}
export class KeyboardStrokeDraftStore{
 readonly key:string;
 constructor(private storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,scope:{identity:string;environment:string;householdId:string;memberId:string;designId:string;pieceId:string}){
  this.key='hearth:keyboard-stroke:'+JSON.stringify([scope.identity,scope.environment,scope.householdId,scope.memberId,scope.designId,scope.pieceId]);
 }
 read():KeyboardStrokeDraft|null{const raw=this.storage.getItem(this.key);if(raw===null)return null;if(raw.length>64000)throw Error('The retained brush line could not be read.');return decodeKeyboardStrokeDraft(JSON.parse(raw));}
 save(draft:KeyboardStrokeDraft){const value=decodeKeyboardStrokeDraft(draft),raw=JSON.stringify(value);if(raw.length>64000)throw Error('Finish this line before adding more points.');this.storage.setItem(this.key,raw);return value;}
 clearIf(draft:KeyboardStrokeDraft){const current=this.read();if(JSON.stringify(current)===JSON.stringify(decodeKeyboardStrokeDraft(draft)))this.storage.removeItem(this.key);}
 clear(){this.storage.removeItem(this.key);}
}
