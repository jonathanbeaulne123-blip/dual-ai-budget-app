import {useEffect,useState,type CSSProperties} from 'react';
import {SWIPE_COPY,SWIPE_UNDO_MS} from './core/index.ts';
import type {SwipeUndoWindow} from './swipeUndoReview.ts';
export function SwipeReceiptStrip({strip,message,disabled,reason,onUndo}:{strip:SwipeUndoWindow;message:string;disabled:boolean;reason:string|null;onUndo:()=>void}){
 const [clock,setClock]=useState(()=>Date.now());const [duration]=useState(()=>Math.max(0,strip.expiresAt-Date.now()));
 useEffect(()=>{const refresh=()=>setClock(Date.now());document.addEventListener('visibilitychange',refresh);window.addEventListener('pageshow',refresh);const id=window.setTimeout(refresh,Math.max(0,strip.expiresAt-Date.now()));return()=>{window.clearTimeout(id);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('pageshow',refresh);};},[strip.expiresAt]);
 return <div className='swipe-strip' role='status'><i className='swipe-strip-paper' aria-hidden='true' style={{animationDuration:`${duration}ms`,'--receipt-start':Math.min(1,duration/SWIPE_UNDO_MS)} as CSSProperties}/><span>{message}</span><button type='button' className='swipe-strip-undo' disabled={disabled||Boolean(reason)||clock>=strip.expiresAt} title={reason??undefined} onClick={()=>{if(!disabled&&!reason&&Date.now()<strip.expiresAt)onUndo();}}>{SWIPE_COPY.undo}</button>{reason&&<small className='swipe-strip-reason'>{reason}</small>}</div>;
}
