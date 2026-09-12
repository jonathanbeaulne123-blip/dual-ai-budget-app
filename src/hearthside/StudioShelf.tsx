import {useState} from 'react';
import type {Household} from '../core/types.ts';
import {SavedPiecePreview} from './MemoryArtwork.tsx';
import './studioShelf.css';

/** Unfinished work stays reachable before it is ever fired, displayed, funded or linked to an intention. */
export function StudioShelf({household,memberId,onOpen}:{household:Household;memberId:string;onOpen:(designId:string,pieceId:string)=>void}){
 const [page,setPage]=useState(0),designs=household.hearthside?.designs??[];
 const pieces=designs.flatMap(d=>d.pieceIds.map((pieceId,i)=>({documentId:d.designId,pieceId,revision:d.revision,label:d.bankId?household.goals.find(g=>g.id===d.bankId&&g.shared)?.name??`Piece ${i+1}`:`Piece ${i+1}`,displayed:d.displayPieceId===pieceId})));
 const invitations=household.hearthside?.handoffs?.filter(h=>!h.withdrawn&&h.recipientId===memberId&&pieces.some(p=>p.documentId===h.design.documentId&&p.pieceId===h.design.pieceId))??[];
 const pages=Math.max(1,Math.ceil(pieces.length/12)),current=Math.min(page,pages-1);
 return <section className="studio-shelf" aria-labelledby="studio-shelf-title">
  {invitations.length>0&&<div className="studio-shelf-invitations"><h2>A little space left for you</h2>{invitations.map(h=><article key={h.id}><p>{household.members.find(m=>m.id===h.authorId)?.name??'Your partner'} left an invitation at the making table.</p><blockquote>{h.text||'Come back whenever you feel like making.'}</blockquote><button id={`studio-invitation-${h.id}`} onClick={()=>onOpen(h.design.documentId,h.design.pieceId)}>Pick up this piece</button><small>The invitation keeps revision {h.design.revision}. The table opens the current shared piece.</small></article>)}</div>}
  <header><h2 id="studio-shelf-title">What we’re making</h2><p>Clay, finished pieces, and pieces resting in the archive all have a place here.</p></header>
  {pieces.length?<><div className="studio-shelf-pieces">{pieces.slice(current*12,(current+1)*12).map(p=><button key={JSON.stringify([p.documentId,p.pieceId])} onClick={()=>onOpen(p.documentId,p.pieceId)}><span className="studio-shelf-piece-preview" aria-hidden="true"><SavedPiecePreview reference={{version:1,documentId:p.documentId,pieceId:p.pieceId,revision:p.revision}}/></span><strong>{p.label}</strong><small>{p.displayed?'Chosen for our room':'On our work shelf'}</small></button>)}</div>{pages>1&&<nav aria-label="Work shelf pages"><button disabled={current===0} onClick={()=>setPage(current-1)}>Earlier pieces</button><span>Page {current+1} of {pages}</span><button disabled={current>=pages-1} onClick={()=>setPage(current+1)}>More pieces</button></nav>}</>:<p className="studio-shelf-empty">The clay is here whenever you are. Your first piece can be just for the pleasure of making it.</p>}
 </section>;
}
