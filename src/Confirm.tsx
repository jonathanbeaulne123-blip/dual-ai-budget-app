import {Component,createRef,useEffect,useRef,useState,type ReactNode} from "react";
import {canonical} from "./ledgerSync/patch.ts";
import {DangerReveal,type DestructiveReview} from "./DangerReveal.tsx";
import "./confirm-mobile.css";
import { useDialog } from "./useDialog.ts";

export function ConfirmSheet({
  review,
  returnFocusFallback,
  className,
  title,
  body,
  extra,
  notice,
  content,
  confirmDisabled=false,
  confirmLabel,
  danger,
  busy,
  option,
  onCancel,
  onConfirm,
}: {
  review?:DestructiveReview;
  returnFocusFallback?:()=>HTMLElement|null;
  className?:string;
  title: string;
  body: string;
  extra?: string;
  notice?:string;
  content?:ReactNode;
  confirmDisabled?:boolean;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  option?: {
    id: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  };
  onCancel: () => void;
  onConfirm: () => void;
}) {

  const [phone,setPhone]=useState(()=>typeof window!=='undefined'&&window.innerWidth<720);
  useEffect(()=>{const resize=()=>setPhone(window.innerWidth<720);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
  const phoneDanger=Boolean(phone&&danger),opening=review?.openingId??'missing';
  const identity=canonical([review?.identity??null,title,body,extra??null,confirmLabel,option?.id??null,option?.label??null]);
  const latch=useRef({opening,identity,invalid:false});
  if(latch.current.opening!==opening)latch.current={opening,identity,invalid:false};
  else if(latch.current.identity!==identity)latch.current.invalid=true;
  if(review&&review.readIdentity()!==review.identity)latch.current.invalid=true;
  const [,refresh]=useState(0),[revealed,setRevealed]=useState<string|null>(null);
  const revealBasis=canonical([opening,identity,option?.checked??null,phoneDanger,Boolean(busy)]);
  const revealEpoch=useRef({basis:revealBasis,generation:0});
  if(revealEpoch.current.basis!==revealBasis)revealEpoch.current={basis:revealBasis,generation:revealEpoch.current.generation+1};
  const revealKey=canonical([revealBasis,revealEpoch.current.generation]);
  const [drag,setDrag]=useState({key:revealKey,active:false});
  const dragging=drag.key===revealKey&&drag.active;
  const latest=useRef({busy,phoneDanger,revealKey,revealed,dragging,confirmDisabled});latest.current={busy,phoneDanger,revealKey,revealed,dragging,confirmDisabled};
  const requiresReview=Boolean(danger||review);
  const valid=!requiresReview||Boolean(review&&!latch.current.invalid);
  const isCurrent=()=>{
    if(!requiresReview)return true;
    if(!review||latch.current.invalid||review.readIdentity()!==review.identity){latch.current.invalid=true;refresh(n=>n+1);return false;}
    return true;
  };
  const describedBy=['guard-body',extra?'guard-extra':null,option?'guard-option':null,!valid?'guard-stale':null].filter(Boolean).join(' ');
  const sheetRef=useDialog(true,busy?undefined:onCancel,returnFocusFallback);
  const cancel=<button className='ghost' type='button' data-autofocus={busy?undefined:true} onClick={onCancel} disabled={busy}>Cancel</button>;
  const confirm=<button type='button' className={danger?'danger':'primary'} style={{width:'100%',marginTop:12}} disabled={busy||confirmDisabled||!valid||dragging} aria-busy={busy||undefined} onClick={()=>{const now=latest.current;if(!now.busy&&!now.confirmDisabled&&!now.dragging&&(!now.phoneDanger||now.revealed===now.revealKey)&&isCurrent())onConfirm();}}>{confirmLabel}</button>;
  return <div className={`sheet guard ${phoneDanger?'phone-danger':''} ${className??''}`} role='dialog' aria-modal='true' aria-labelledby='guard-title' aria-describedby={describedBy} ref={sheetRef}>
    <ConfirmFocusBoundary>
      <div className='confirm-copy'>
        <div className='topbar'><h1 id='guard-title'>{title}</h1>{!phoneDanger&&cancel}</div>
        <p id='guard-body'>{body}</p>
        {content}
        {extra&&<p id='guard-extra' className='muted'>{extra}</p>}
        {option&&<label id='guard-option' className='confirm-option'><input type='checkbox' checked={option.checked} disabled={busy||!valid} onChange={event=>option.onChange(event.currentTarget.checked)}/><span>{option.label}</span></label>}
      </div>
      <div className='confirm-footer'>
        {notice&&<p role='status' className='confirm-review-notice'>{notice}</p>}
        {!valid&&!busy&&<p id='guard-stale' className='confirm-review-stale' role='status'>This review changed. Cancel and open it again.</p>}
        {busy&&<p className='confirm-status' data-autofocus role='status' tabIndex={0}>Working…</p>}
        {phoneDanger&&valid&&<DangerReveal key={revealKey} label={confirmLabel} busy={Boolean(busy)} onDragging={active=>setDrag({key:revealKey,active})} onReveal={()=>{if(!busy&&isCurrent())setRevealed(revealKey);}}/>}
        {(!phoneDanger||(valid&&revealed===revealKey))&&confirm}
        {phoneDanger&&cancel}
      </div>
    </ConfirmFocusBoundary>
  </div>;
}
/** Keep focus in the existing modal when responsive or review controls retire. */
class ConfirmFocusBoundary extends Component<{children:ReactNode},object,boolean>{
  root=createRef<HTMLDivElement>();getSnapshotBeforeUpdate(){return !!this.root.current?.contains(document.activeElement);}
  componentDidUpdate(_previous:Readonly<{children:ReactNode}>,_state:object,hadFocus:boolean){const active=document.activeElement as HTMLButtonElement|null;if(hadFocus&&(active===document.body||active?.disabled))this.root.current?.querySelector<HTMLElement>('[data-autofocus]:not([disabled]),.confirm-status')?.focus({preventScroll:true});}
  render(){return <div ref={this.root} className='sheet-inner'>{this.props.children}</div>;}
}
