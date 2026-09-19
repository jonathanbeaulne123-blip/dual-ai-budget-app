import {guestNestOrnament} from './nestGuestAppearance.ts';
import type {NestAppearance} from './nestDesignBinding.ts';
import {decodeRoomFurniture,type FurnitureRoom,type RoomFurnitureLayout} from './roomFurniture.ts';
import type { KittyPieceV1 } from '../core/types.ts';
import {
  decodeGuestAppearance, decodeGuestArrangement, decodeGuestPrepare, decodeGuestSourceProof, GUEST_LIMITS, guestAssert, guestDigest,
  type GuestAppearance, type GuestMedia, type GuestMemoryBinding, type GuestObject, type GuestPrepareInput, type GuestSourceCapture, type GuestSourceProof,
} from './guestContracts.ts';

export type GuestSourceMedia = { id: string; revision: number; publicationId: string; kind: 'image' | 'audio'; alt: string };
/** Constructed from canonical authority inside LedgerRoom. Never populated from HTTP JSON. */
export interface GuestSourceCatalogue {
  activeMemberIds: readonly string[];
  /** Fresh complete canonical layout at prepare and activation. Never called for an active visit. */
  furniture(room:FurnitureRoom):RoomFurnitureLayout;
  experience(id: string): { revision: number; shared: boolean; archived: boolean; title: string; intention: string } | null;
  note(id: string): { revision: number; shared: boolean; archived: boolean; text: string } | null;
  memory(id: string): { revision: number; shared: boolean; withdrawn: boolean; title: string; recollections: { memberId: string; text: string }[]; earlierNote?:{label:string;text:string}; approvals: { memberId: string; revision: number }[]; media: GuestSourceMedia[]; publicationId:string|null; designs:{designId:string;pieceId:string;revision:number}[] } | null;
  memoryAccess(binding:GuestMemoryBinding):Promise<boolean>;
  piece(designId: string, pieceId: string, revision: number): Promise<{ revision: number; shared: boolean; archived: boolean; piece: KittyPieceV1; ornament?:NestAppearance } | null>;
  /** Exact reviewed, metadata-clean image or voice-note bytes. May not resolve private Vault drafts/letters. */
  media(reference: GuestSourceMedia): Promise<{ mime: GuestMedia['mime']; sha256: string; bytes: ArrayBuffer } | null>;
}
function appearance(piece: KittyPieceV1,ornament?:NestAppearance): GuestAppearance {
  // Read only authored appearance. Creation/firing timestamps and all original object/stamp IDs stay private.
  const paint = { ...piece.paint, stamps: piece.paint.stamps.map((stamp,index)=>({...stamp,id:`stamp-${index+1}`})) };
  return decodeGuestAppearance({sculpt:piece.sculpt,paint,...(ornament?{ornament:guestNestOrnament(ornament)}:{})});
}
function approvedMemory(row: ReturnType<GuestSourceCatalogue['memory']>, members: readonly string[]) {
  guestAssert(row && row.shared && !row.withdrawn && members.length >= 2 && new Set(members).size === members.length && members.every(memberId=>row.approvals.some(a=>a.memberId===memberId && a.revision===row.revision)), 'GUEST_SOURCE_UNAVAILABLE'); return row;
}
export async function captureGuestSources(raw: unknown, catalogue: GuestSourceCatalogue): Promise<GuestSourceCapture> {
  const selection=decodeGuestPrepare(raw),objects:GuestObject[]=[],memoryBindings:GuestMemoryBinding[]=[],media:GuestSourceCapture['media']=[];let mediaBytes=0;
  for(const [index,item] of selection.items.entries()) {
    const base={id:`object-${index+1}`,x:item.x,y:item.y};
    if(item.kind==='experience') { const row=catalogue.experience(item.id);guestAssert(row?.shared&&!row.archived&&row.revision===item.revision,'GUEST_SOURCE_UNAVAILABLE');objects.push({...base,kind:'experience',title:row.title,text:row.intention}); }
    else if(item.kind==='note') { const row=catalogue.note(item.id);guestAssert(row?.shared&&!row.archived&&row.revision===item.revision,'GUEST_SOURCE_UNAVAILABLE');objects.push({...base,kind:'note',text:row.text}); }
    else if(item.kind==='piece') { const row=await catalogue.piece(item.designId!,item.id,item.revision);guestAssert(row?.shared&&!row.archived&&row.revision===item.revision,'GUEST_SOURCE_UNAVAILABLE');objects.push({...base,kind:'piece',appearance:appearance(row.piece,row.ornament),displaySize:'standard'}); }
    else {
      const row=approvedMemory(catalogue.memory(item.id),catalogue.activeMemberIds);guestAssert(row.revision===item.revision,'GUEST_SOURCE_CHANGED');
      guestAssert(row.media.length===0||row.publicationId!==null,'GUEST_SOURCE_UNAVAILABLE');const binding={id:item.id,revision:item.revision,publicationId:row.publicationId};guestAssert(await catalogue.memoryAccess(binding),'GUEST_SOURCE_UNAVAILABLE');memoryBindings.push(binding);const pieces:GuestAppearance[]=[];for(const ref of row.designs){const design=await catalogue.piece(ref.designId,ref.pieceId,ref.revision);guestAssert(design?.shared&&!design.archived&&design.revision===ref.revision,'GUEST_SOURCE_UNAVAILABLE');pieces.push(appearance(design.piece,design.ornament));}const images:GuestMedia[]=[];
      for(const reference of row.media) {
        const copied=await catalogue.media(reference);guestAssert(copied&&copied.bytes.byteLength>0&&copied.bytes.byteLength<=GUEST_LIMITS.mediaBytes,'GUEST_MEDIA_UNAVAILABLE');
        const sha256=await guestDigest(copied.bytes);guestAssert(sha256===copied.sha256,'GUEST_MEDIA_CHANGED');mediaBytes+=copied.bytes.byteLength;guestAssert(mediaBytes<=GUEST_LIMITS.totalMediaBytes,'GUEST_SELECTION_TOO_LARGE');
        const id=`media-${media.length+1}`;media.push({id,mime:copied.mime,sha256,bytes:copied.bytes});images.push({id,kind:reference.kind,mime:copied.mime,sha256,byteLength:copied.bytes.byteLength,alt:reference.alt});
      }
      objects.push({...base,kind:'memory',title:row.title,captions:[...row.recollections.map((r,index)=>({label:`Voice ${index+1}`,text:r.text})),...(row.earlierNote?[row.earlierNote]:[])],media:images,pieces});
    }
  }
  const {title,welcome,theme,room,mode}=selection,arrangement=decodeGuestArrangement({version:1,title,welcome,theme,room,mode,objects,furniture:decodeRoomFurniture(catalogue.furniture(room))});
  return {version:1,arrangement,proof:{version:1,selection,memoryBindings,digest:await guestDigest({selection,arrangement,memoryBindings})},media};
}
/** Editing a source cannot rewrite an activated copy; withdrawal/private visibility still closes it. */
export async function validateGuestSources(proof: GuestSourceProof, catalogue: GuestSourceCatalogue, mode:'activation'|'visit'):Promise<boolean> {
  try {
    proof=decodeGuestSourceProof(proof);
    if(mode==='activation') return (await captureGuestSources(proof.selection,catalogue)).proof.digest===proof.digest;
    const selection:GuestPrepareInput=decodeGuestPrepare(proof.selection);
    for(const item of selection.items) {
      if(item.kind==='experience'){const row=catalogue.experience(item.id);guestAssert(row?.shared&&!row.archived,'GUEST_SOURCE_UNAVAILABLE');}
      else if(item.kind==='note'){const row=catalogue.note(item.id);guestAssert(row?.shared&&!row.archived,'GUEST_SOURCE_UNAVAILABLE');}
      else if(item.kind==='memory'){approvedMemory(catalogue.memory(item.id),catalogue.activeMemberIds);const binding=proof.memoryBindings.find(b=>b.id===item.id);guestAssert(binding&&await catalogue.memoryAccess(binding),'GUEST_SOURCE_UNAVAILABLE');}
      else {const row=await catalogue.piece(item.designId!,item.id,item.revision);guestAssert(row?.shared&&!row.archived,'GUEST_SOURCE_UNAVAILABLE');}
    }
    return true;
  }catch{return false;}
}
