import './nestCanonical.css';
import {useState} from 'react';
import type {Household,LedgerView} from '../core/types.ts';
import type {NestBank} from '../core/kittyNest.ts';
import {saveKittyNestDesign,nestDesignId} from '../core/kittyNestDesigns.ts';
import {nestDefaultPiece,nestOrnament} from '../kitty/nestAppearance.ts';
import type {StudioRun} from '../kitty/studio/KittyStudio.tsx';
import {CollaborativeStudio} from './CollaborativeStudio.tsx';
import {decodeNestSource} from './nestDesignBinding.ts';
import {useNestArtwork} from './NestCanonicalArtwork.tsx';
import {HEARTHSIDE_FLAGS} from './flags.ts';

export function NestCanonicalStudio({bank,h,memberId,view,busy,run}:{bank:NestBank;h:Household;memberId:string;view:LedgerView;busy:boolean;run:StudioRun}){
 const row=h.kittyNestDesigns?.find(r=>r.id===nestDesignId(view,memberId,bank.designKey));
 const [name,setName]=useState(row?.name??bank.name),[message,setMessage]=useState('');
 const {document}=useNestArtwork(row);
 const theme=typeof window!=='undefined'?window.document.documentElement.dataset.theme??'classic':'classic';
 const source=document?.nest??decodeNestSource({version:1,view,designKey:bank.designKey,appearance:{version:1,...nestOrnament(bank,theme)}});
 async function save(completeSetup=false){
  const result=await run(current=>saveKittyNestDesign(current,{memberId,view,bankKey:bank.designKey,expectedRevision:row?.revision??0,name,glaze:row?.glaze??'cream',category:row?.category??bank.category,completeSetup}),completeSetup?'Your King chapter is complete.':'Your pottery name is kept.');
  setMessage(result?'Kept.':'Your name is still here. Review the current pottery before trying again.');
 }
 return <section className="nest-canonical-studio" aria-label={view==='personal'?'My pottery':'Shared pottery'}>
  <label>Bank name<input value={name} maxLength={120} onChange={event=>setName(event.target.value)}/></label>
  <button type="button" disabled={busy||!name.trim()} onClick={()=>void save()}>{row?'Keep this name':'Prepare our King'}</button>
  {message&&<p role="status">{message}</p>}
  {row?<CollaborativeStudio household={h} memberId={memberId} nestSource={source} initialSculpt={nestDefaultPiece(bank).sculpt} initialDesignId={row.designRef?.designId} writesEnabled={HEARTHSIDE_FLAGS.collaborativeDesign}/>:<p>Choose its name, then join the shared wheel. Your household’s money stays in its existing accounts.</p>}
  {bank.tier==='king'&&!row?.setupCompletedAt&&<button type="button" disabled={busy||!row?.designHasFired} onClick={()=>void save(true)}>Finish the King chapter</button>}
  {row?.setupCompletedAt&&<p>Your King chapter is complete. You can keep making together.</p>}
 </section>;
}
