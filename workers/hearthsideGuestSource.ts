import {winPublicCaption} from '../src/hearthside/winMemoryProvenance.ts';
import {assertGuestImage} from '../src/hearthside/guestImage.ts';
import {captureRoomFurniture} from '../src/hearthside/roomFurniture.ts';
import {memoryKeptByEveryone,type HearthsideState} from '../src/hearthside/contracts.ts';
import {guestAssert,guestDigest,GUEST_LIMITS,type GuestMedia} from '../src/hearthside/guestContracts.ts';
import type {GuestSourceCatalogue} from '../src/hearthside/guestProjection.ts';
import type {MemoryPublicationBinding} from '../src/hearthside/memoryPublication.ts';

/** A detached, narrow accepted-state snapshot. Readers never run under the LedgerRoom lock. */
export function guestSourceCatalogue(state:HearthsideState,activeMemberIds:string[],readers:{
  piece:GuestSourceCatalogue['piece'];
  active(binding:MemoryPublicationBinding):Promise<boolean>;
  media(id:string,publicationId:string):Promise<Response>;
}):GuestSourceCatalogue{
 const memory=(id:string)=>state.memories.find(m=>m.id===id);
 const catalogue:GuestSourceCatalogue={activeMemberIds,furniture:room=>captureRoomFurniture(room,state.furniture??[]),
  experience:id=>{const r=state.experiences.find(e=>e.id===id);return r?{revision:r.revision,shared:true,archived:r.state==='archived',title:r.title,intention:r.intention}:null;},
  note:id=>{const r=state.notes.find(n=>n.id===id);return r?{revision:r.revision,shared:true,archived:r.archived,text:r.text}:null;},
  memory:id=>{const r=memory(id);return r?{revision:r.revision,shared:memoryKeptByEveryone(r,activeMemberIds),withdrawn:r.withdrawn,title:r.title,recollections:r.recollections,...(winPublicCaption(r.legacySource)?{earlierNote:winPublicCaption(r.legacySource)!}:{}),approvals:r.approvals,
    publicationId:r.publication?.publicationId??null,media:r.media.map(m=>({id:m.contentId,revision:m.revision,publicationId:r.publication?.publicationId??'',kind:m.kind,alt:m.alt})),
    designs:r.designs.map(d=>({designId:d.documentId,pieceId:d.pieceId,revision:d.revision}))}:null;},
  piece:readers.piece,
  memoryAccess:async binding=>{const r=memory(binding.id);if(!r||r.withdrawn||r.revision!==binding.revision||!memoryKeptByEveryone(r,activeMemberIds)||(r.publication?.publicationId??null)!==binding.publicationId)return false;
    for(const d of r.designs){const p=await readers.piece(d.documentId,d.pieceId,d.revision);if(!p?.shared||p.archived)return false;}
    return binding.publicationId===null?r.media.length===0:!!r.publication&&await readers.active(r.publication);
  },
  media:async reference=>{const r=state.memories.find(m=>m.publication?.publicationId===reference.publicationId&&m.media.some(v=>v.contentId===reference.id&&v.revision===reference.revision));
    if(!r||!await catalogue.memoryAccess({id:r.id,revision:r.revision,publicationId:reference.publicationId}))return null;
    const response=await readers.media(reference.id,reference.publicationId);
    const mime=response.headers.get('Content-Type') as GuestMedia['mime'];
    const stream=response.body?.getReader();let count=0;const chunks:Uint8Array[]=[];
    try{guestAssert(response.ok&&stream&&['image/jpeg','image/png','audio/webm','audio/mp4','audio/ogg'].includes(mime)&&mime.startsWith(reference.kind+'/'),'GUEST_MEDIA_UNAVAILABLE');
      while(true){const chunk=await stream.read();if(chunk.done)break;count+=chunk.value.length;guestAssert(count<=GUEST_LIMITS.mediaBytes,'GUEST_SELECTION_TOO_LARGE');chunks.push(chunk.value);}
      guestAssert(count>0,'GUEST_MEDIA_UNAVAILABLE');const bytes=new Uint8Array(count);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
      if(mime==='image/jpeg'||mime==='image/png')assertGuestImage(bytes,mime);
      guestAssert(await catalogue.memoryAccess({id:r.id,revision:r.revision,publicationId:reference.publicationId}),'GUEST_SOURCE_CHANGED');
      return {mime,sha256:await guestDigest(bytes.buffer),bytes:bytes.buffer};
    }finally{await stream?.cancel().catch(()=>{});stream?.releaseLock();}
  },
 };return catalogue;
}
