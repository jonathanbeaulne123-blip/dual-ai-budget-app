import {useEffect,useMemo} from 'react';
import {KittyFlat} from '../kitty/studio/flat.tsx';
import {useDesignClient} from './DesignProvider.tsx';
import {snapshotKittyDesignRevision} from './design.ts';
import type {DesignReference} from './contracts.ts';

export function useMemoryDesigns(references:DesignReference[]){
  const client=useDesignClient(),key=JSON.stringify(references);
  useEffect(()=>{if(client)for(const ref of references)void client.load(ref.documentId,ref.revision);},[client,key]);
  const revisions=references.map(ref=>client?.documents.get(ref.documentId)?.revision??-1).join(',');
  const snapshots=useMemo(()=>references.map(ref=>{
    const document=client?.documents.get(ref.documentId);if(!document||document.revision<ref.revision)return null;
    try{return snapshotKittyDesignRevision(document,ref.pieceId,ref.revision);}catch{return null;}
  }),[client,key,revisions]);
  return {snapshots,ready:snapshots.every(Boolean),errors:references.map(ref=>client?.errors.get(ref.documentId)??'')};
}
export function MemoryArtwork({references,snapshots}:{references:DesignReference[];snapshots:Array<ReturnType<typeof snapshotKittyDesignRevision>|null>}){
  return <div className="hearthside-memory-artwork">{references.map((ref,index)=><figure key={JSON.stringify(ref)}>{snapshots[index]?<KittyFlat piece={snapshots[index]!.piece} title="The piece as it was when this memory was composed"/>:<p role="status">This saved piece is unavailable. Its chosen revision has not been replaced.</p>}<figcaption>Our piece, kept at revision {ref.revision}</figcaption></figure>)}</div>;
}
/** An immutable authored view for room objects; money scale is deliberately supplied nowhere here. */
export function SavedPiecePreview({reference}:{reference:DesignReference}){
  const {snapshots}=useMemoryDesigns([reference]),snapshot=snapshots[0];
  return snapshot?<KittyFlat piece={snapshot.piece} title="Our authored piece"/>:<span role="status">Artwork unavailable</span>;
}
