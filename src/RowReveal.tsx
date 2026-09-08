import {Component,createRef,useEffect,useRef,useState,type ReactNode,type KeyboardEvent} from 'react';
import './row-reveal.css';
/** A row gesture discloses controls. It cannot activate them. */
export function RowReveal({label,children,right,left,busy=false,focusOnMount=false}:{label:string;children:ReactNode;right:ReactNode;left?:ReactNode;busy?:boolean;focusOnMount?:boolean}){
 const [side,setSide]=useState<'left'|'right'|null>(null),[dragging,setDragging]=useState(false);
 const clickAllowed=useRef(true);
 const handle=useRef<HTMLButtonElement>(null),gesture=useRef<{id:number;x:number;y:number;before:typeof side}|null>(null);
 useEffect(()=>{if(focusOnMount)handle.current?.focus();},[]);
 const stop=(cancel:boolean)=>{const g=gesture.current;if(!g)return;gesture.current=null;setDragging(false);if(cancel){clickAllowed.current=false;setSide(g.before);}if(handle.current?.hasPointerCapture(g.id))handle.current.releasePointerCapture(g.id);};
 return <RowFocusBoundary side={side??'rest'} onKeyDown={e=>{if(e.key==='Escape'&&gesture.current){e.preventDefault();e.stopPropagation();stop(true);}}}>
  <div className='row-reveal-reading'>{children}</div>
  <button ref={handle} type='button' className='ghost row-reveal-handle' disabled={busy} aria-label={`Actions for ${label}`} aria-expanded={side!==null}
   onPointerDown={e=>{if(gesture.current){stop(true);return;}if(!e.isPrimary||e.button!==0||busy)return;clickAllowed.current=true;gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY,before:side};setDragging(true);e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.focus();}}
   onPointerMove={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(Math.abs(dx)>12||Math.abs(dy)>12)clickAllowed.current=false;if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>12){stop(true);return;}if(Math.abs(dx)>=36)setSide(dx>0?'right':left?'left':null);}}
   onPointerUp={()=>stop(false)} onPointerCancel={()=>stop(true)} onLostPointerCapture={()=>stop(true)}
   onClick={e=>{if(e.detail>0&&!clickAllowed.current){clickAllowed.current=true;return;}if(e.detail===0)setSide(side?null:'right');else if(!side)setSide('right');}}>Actions</button>
  {left&&<button type='button' className='ghost row-reveal-later' disabled={busy||dragging} onClick={()=>setSide(side==='left'?null:'left')}>Later</button>}
  {side&&<div className='row-reveal-actions' inert={dragging||undefined}>{side==='left'?left:right}<button type='button' className='ghost' disabled={busy||dragging} onClick={()=>{setSide(null);handle.current?.focus();}}>Close actions</button></div>}
 </RowFocusBoundary>;
}

class RowFocusBoundary extends Component<{children:ReactNode;side:string;onKeyDown:(event:KeyboardEvent<HTMLDivElement>)=>void},object,boolean>{
 root=createRef<HTMLDivElement>();getSnapshotBeforeUpdate(){return !!this.root.current?.contains(document.activeElement);}
 componentDidUpdate(_props:Readonly<{children:ReactNode;side:string;onKeyDown:(event:KeyboardEvent<HTMLDivElement>)=>void}>,_state:object,hadFocus:boolean){const active=document.activeElement as HTMLButtonElement|null;if(hadFocus&&(active===document.body||active?.disabled))(this.root.current?.querySelector<HTMLElement>('[data-row-status],.row-reveal-handle:not([disabled])')??this.root.current)?.focus({preventScroll:true});}
 render(){return <div ref={this.root} className='row-reveal' data-side={this.props.side} tabIndex={-1} onKeyDown={this.props.onKeyDown}>{this.props.children}</div>;}
}
