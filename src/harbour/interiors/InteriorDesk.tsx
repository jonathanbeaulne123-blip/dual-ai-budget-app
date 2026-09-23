import { useEffect, useMemo, useState } from 'react';
import type { Household, LedgerView, KittyPieceV1 } from '../../core/types.ts';
import { useDesignClient } from '../../hearthside/DesignProvider.tsx';
import { assertNestDocumentVisible } from '../../hearthside/nestDesignSource.ts';
import { projectKittyDesign } from '../../hearthside/design.ts';
import { KittyFlat } from '../../kitty/studio/flat.tsx';

const volumes = [
  ['Today','A little clarity','chapter/today'],
  ['Accounts','Every balance','bindery/cut-bank'],
  ['Spending','Where it went','bindery/lantern-row'],
  ['Bills','What comes next','bindery/low-water'],
  ['Goals','Room to grow','bindery/glasshouse-pane'],
  ['Contributions','Between us','bindery/handoff-bench'],
  ['Record','The paper trail','chapter/record'],
] as const;
const stations = [
  ['wheel','01','The wheel','Give it a shape','shape'],
  ['paint','02','The glaze bench','Make it yours','paint'],
  ['kiln','03','The kiln','Keep this version','fire'],
] as const;

type Props = { place:'library'|'kiln';household:Household;memberId:string;scope:LedgerView;onOpen:(target:string,object?:string)=>void;onView:()=>void };
/** Readable door labels above the world. These can open a tool, never edit it. */
export default function InteriorDesk({place,household,memberId,scope,onOpen,onView}:Props) {
  const library=place==='library';
  return <div className={`interior-desk interior-desk--${place}`} onKeyDown={event=>event.stopPropagation()} onPointerDown={event=>event.stopPropagation()}>
    <header className="interior-title">
      <p className="interior-eyebrow">Little Harbour <span> / </span> {library?'A room for understanding':'A room for making'}</p>
      <h1>{library?'The Library':'The Pottery Studio'}</h1>
      <p className="interior-intro">{library?'Find your place. Open a book. Let the rest of the day wait.':'A little clay. Your own hands. Something worth keeping.'}</p>
      <button className="interior-view" onClick={onView}>↗ Take in the room</button>
    </header>
    {library?<nav className="interior-volumes" aria-label="Library volumes">
      {volumes.map(([title,line,object],i)=><button className={`interior-volume interior-volume--${i}`} key={title} onClick={()=>onOpen('books',object)}><span className="interior-volume__number">{String(i+1).padStart(2,'0')}</span><strong>{title}</strong><span className="interior-volume__line">{line}</span><span className="interior-volume__open">Open ↗</span></button>)}
    </nav>:<>
      <nav className="interior-stations" aria-label="Pottery stations">{stations.map(([object,n,title,line,icon])=><button key={object} onClick={()=>onOpen('pottery',object)}><span className={`interior-station-art interior-station-art--${icon}`} aria-hidden="true"><i/><b/></span><span><small>{n} / {line}</small><strong>{title}</strong></span><em aria-hidden="true">↗</em></button>)}</nav>
      <AcceptedShelf household={household} memberId={memberId} scope={scope} onOpen={onOpen}/>
    </>}
  </div>;
}

function AcceptedShelf({household:h,memberId,scope,onOpen}:Omit<Props,'place'|'onView'>) {
  const client=useDesignClient(),[open,setOpen]=useState(false);
  const refs=useMemo(()=>{
    const indices=scope==='personal'?(h.personalLife?.ownerMemberId===memberId?h.personalLife.designs:[]):h.hearthside?.designs??[];
    // Only the active audience's canonical index grants a shelf entry. A cached
    // document or a legacy decorative bank alone never grants visibility.
    return indices.map(index=>({designId:index.designId,revision:index.revision}));
  },[h,memberId,scope]);
  const signature=JSON.stringify(refs);
  useEffect(()=>{if(client&&open)for(const ref of refs)void client.load(ref.designId,ref.revision);},[client,open,signature]);
  const pieces:{designId:string;piece:KittyPieceV1;revision:number;status:string}[]=[];
  let unavailable=0,loading=0;
  for(const ref of refs){
    const doc=client?.documents.get(ref.designId);
    if(!doc||doc.revision<ref.revision){if(client?.errors.get(ref.designId))unavailable++;else loading++;continue;}
    if(doc.scope.environment!==h.environment||doc.scope.householdId!==h.householdId||doc.scope.ownerMemberId!==(scope==='personal'?memberId:null))continue;
    try{assertNestDocumentVisible(h,memberId,doc);}catch{continue;}
    for(const row of projectKittyDesign(doc).pieces)if(row.status!=='archived')pieces.push({designId:doc.id,piece:row.piece,revision:doc.revision,status:row.status});
  }
  return <aside className={`interior-shelf ${open?'is-open':''}`}>
    <button className="interior-shelf__handle" aria-expanded={open} onClick={()=>setOpen(!open)}><span>◈</span> {scope==='personal'?'My':'Our'} piece cabinet <span>{open?'−':'+'}</span></button>
    {open&&<div className="interior-shelf__inside"><p>Pick up the same piece, with its accepted shape and paint.</p>
      {!client&&refs.length>0&&<p role="status">Connect to open your artwork.</p>}
      {loading>0&&client&&<p role="status">Opening {loading} artwork {loading===1?'journal':'journals'}…</p>}
      {unavailable>0&&<p role="status">Some artwork is unavailable. Your pieces have not been removed.</p>}
      {!refs.length&&<p>Your cabinet is waiting. Start at the wheel; your pieces will have a place here.</p>}
      {refs.length>0&&!pieces.length&&!loading&&!unavailable&&<p>No visible pieces in this cabinet.</p>}
      <div className="interior-shelf__pieces">{pieces.map((item,i)=><button key={`${item.designId}:${item.piece.id}`} onClick={()=>onOpen('pottery',`piece/${item.piece.id}/${item.designId}`)}><KittyFlat piece={item.piece}/><strong>Piece {i+1}</strong><small>{item.status==='fired'?'Fired':'On the wheel'} · revision {item.revision}</small></button>)}</div>
    </div>}
  </aside>;
}
