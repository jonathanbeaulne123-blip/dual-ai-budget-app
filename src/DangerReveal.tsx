import {useId,useRef,useState} from 'react';
export interface DestructiveReview { openingId:string; identity:string; readIdentity:()=>string }
/** The release target stays a range; it never becomes the destructive button. */
export function DangerReveal({label,busy,onReveal,onDragging}:{label:string;busy:boolean;onReveal:()=>void;onDragging:(active:boolean)=>void}){
 const id=useId(),input=useRef<HTMLInputElement>(null),value=useRef(0),gesture=useRef<{id:number;before:number}|null>(null),cancelled=useRef(false),[position,setPosition]=useState(0),[dragging,setDragging]=useState(false);
 const set=(next:number)=>{value.current=next;setPosition(next);};
 const finish=(pointerId?:number,cancel=false)=>{const active=gesture.current;if(!active||(pointerId!==undefined&&pointerId!==active.id))return;gesture.current=null;setDragging(false);onDragging(false);if(cancel){cancelled.current=true;set(active.before);}else if(value.current===100)onReveal();if(input.current?.hasPointerCapture(active.id))input.current.releasePointerCapture(active.id);};
 return <div className='danger-reveal' data-dialog-escape-boundary={dragging?'true':undefined}>
  <label htmlFor={id}>Slide to show {label}</label>
  <input ref={input} id={id} type='range' min={0} max={100} step={1} value={position} disabled={busy} aria-valuetext={position===100?'Ready to show confirmation':'Slide to show confirmation'}
   onChange={event=>{if(cancelled.current)return;const next=Number(event.currentTarget.value);set(next);if(!gesture.current&&next===100)onReveal();}}
   onPointerDown={event=>{if(gesture.current){finish(undefined,true);return;}if(!event.isPrimary||event.button!==0||busy)return;cancelled.current=false;gesture.current={id:event.pointerId,before:value.current};setDragging(true);onDragging(true);event.currentTarget.setPointerCapture(event.pointerId);}}
   onPointerUp={event=>finish(event.pointerId)} onPointerCancel={event=>finish(event.pointerId,true)} onLostPointerCapture={event=>finish(event.pointerId,true)}
   onKeyDown={event=>{if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopPropagation();finish(undefined,true);}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))cancelled.current=false;}}/>
  <button className='ghost' type='button' disabled={busy||dragging} onClick={()=>{cancelled.current=false;onReveal();}}>Show {label}</button>
 </div>;
}
