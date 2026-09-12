import {useEffect,useRef,useState} from 'react';
import {KittyFlat} from '../kitty/studio/flat.tsx';
import type {HearthsideDesignClient,PendingDesignRequest} from './designClient.ts';
import {canReviewRejectedEdit,type RejectedEditReview} from './designRecovery.ts';
export function RejectedDesignEdit({client,pending,enabled}:{client:HearthsideDesignClient;pending:PendingDesignRequest;enabled:boolean}){
 const [review,setReview]=useState<RejectedEditReview|null>(null),[working,setWorking]=useState(false),[error,setError]=useState(''),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const operation=pending.request.kind==='operate'?pending.request.operation:null,current=operation?client.documents.get(operation.designId):null;
 async function prepare(){setWorking(true);setError('');try{const next=await client.reviewRejected(pending.id);if(alive.current)setReview(next);}catch(e){if(alive.current)setError(e instanceof Error?e.message:'The current piece is unavailable.');}finally{if(alive.current)setWorking(false);}}
 async function apply(){if(!review)return;setWorking(true);try{await client.reapplyRejected(pending.id,review);}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Your retained choice is still here.');}finally{if(alive.current)setWorking(false);}}
 async function discard(){setWorking(true);try{await client.discardRejected(pending.id);}catch(e){if(alive.current)setError(e instanceof Error?e.message:'This edit could not be removed from the retained queue.');}finally{if(alive.current)setWorking(false);}}
 return <div className="studio-recovery"><p>{pending.message}</p><p>{operation?.kind==='append-stroke'?`Your brush mark on ${operation.stroke.part} is kept on this device.`:'Your creative choice is kept on this device.'}</p>
  {operation&&canReviewRejectedEdit(operation)&&<button disabled={!enabled||working} onClick={()=>void prepare()}>{review?'Refresh the comparison':'Review my retained choice'}</button>}
  {review&&<section aria-label="Retained edit comparison"><div className="studio-recovery-comparison"><figure><KittyFlat piece={review.current}/><figcaption>The current shared piece</figcaption></figure><figure><KittyFlat piece={review.proposed}/><figcaption>Preview with my retained choice</figcaption></figure></div>{review.recoverable>0&&<p>Paint without a matching surface remains recoverable with its earlier mapping.</p>}<p>This creates a new gesture from your retained choice. Other gestures stay in history. Review how your choice changes the current piece.</p>{current?.revision!==review.baseRevision&&<p role="status">The piece changed. Refresh this comparison before choosing.</p>}<button disabled={!enabled||working||current?.revision!==review.baseRevision} onClick={()=>void apply()}>Use my choice on this piece</button><button disabled={working} onClick={()=>setReview(null)}>Keep it for later</button></section>}
  <button disabled={working} onClick={()=>void discard()}>Discard this rejected edit</button>{error&&<p role="status">{error}</p>}
 </div>;
}
