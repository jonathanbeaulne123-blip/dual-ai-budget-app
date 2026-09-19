import {useEffect} from 'react';
import {useDesignClient} from './DesignProvider.tsx';
import {snapshotKittyDesignRevision} from './design.ts';
import {KittyFlat} from '../kitty/studio/flat.tsx';
import {NestProp} from '../kitty/NestProp.tsx';
import type {KittyNestDesign} from '../core/kittyNestDesigns.ts';
/** A receipt's source reference is exact even when this client already holds later edits. */
export function useNestArtwork(design:KittyNestDesign|undefined){
 const client=useDesignClient(),reference=design?.designRef;
 useEffect(()=>{if(client&&reference)void client.load(reference.designId,reference.revision);},[client,reference?.designId,reference?.revision]);
 const document=reference?client?.documents.get(reference.designId):undefined;
 let snapshot=null;
 if(reference&&document&&document.revision>=reference.revision&&reference.displayPieceId){try{snapshot=snapshotKittyDesignRevision(document,reference.displayPieceId,reference.revision);}catch{/* Show unavailable; never replace paid pottery with the latest piece. */}}
 return {client,document,snapshot,loading:Boolean(reference&&!document),error:reference?client?.errors.get(reference.designId):undefined};
}
export function NestCanonicalArtwork({design,step=0}:{design:KittyNestDesign;step?:number}){
 const {snapshot,error,loading}=useNestArtwork(design);
 if(!snapshot)return <span role="status">{loading&&!error?'Opening your pottery…':'This saved pottery is unavailable.'}</span>;
 return <><KittyFlat piece={snapshot.piece} glaze={design.glaze} step={step}/>{snapshot.appearance&&<NestProp ornament={snapshot.appearance}/>}</>;
}
