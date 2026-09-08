import { Component, createRef, useId, useRef, useState, type ReactNode } from "react";
import { addDays, calendarDaysBetween, daysInMonthKey } from "./core/calendar.ts";
import "./date-turn.css";

export function useTurnDate(scope:string,basis:string,month:string,today:string){
  const key=JSON.stringify([scope,month,basis]),days=daysInMonthKey(month),fallback=Math.max(1,Math.min(days,today.startsWith(month)?Number(today.slice(8,10)):1));
  const [selection,setSelection]=useState({key,day:fallback});const day=selection.key===key?selection.day:fallback;
  return {key,days,day,date:`${month}-${String(day).padStart(2,"0")}`,setDay:(next:number)=>setSelection({key,day:Math.max(1,Math.min(days,next))})};
}
export function useTurnWindow(scope:string,basis:string,from:string,through:string,initial:string){
  const key=JSON.stringify([scope,from,through,basis]),days=calendarDaysBetween(from,through)+1,fallback=Math.max(1,Math.min(days,calendarDaysBetween(from,initial)+1));
  const [selection,setSelection]=useState({key,day:fallback});const day=selection.key===key?selection.day:fallback;
  return {key,days,day,date:addDays(from,day-1),setDay:(next:number)=>setSelection({key,day:Math.max(1,Math.min(days,next))})};
}
/** Restore focus to a replaced read-head in the same scope, never across rooms. */
export class TurnFocusBoundary extends Component<{scope:string;children:ReactNode},object,boolean>{
  root=createRef<HTMLDivElement>();getSnapshotBeforeUpdate(){return !!this.root.current?.contains(document.activeElement);}
  componentDidUpdate(previous:Readonly<{scope:string;children:ReactNode}>,_state:object,hadFocus:boolean){if(hadFocus&&previous.scope===this.props.scope&&document.activeElement===document.body)this.root.current?.querySelector<HTMLElement>(".date-turn input")?.focus({preventScroll:true});}
  render(){return <div ref={this.root} className="turn-focus-boundary">{this.props.children}</div>;}
}
/** One native day axis. It changes only the selected reading. */
export function DateTurn({day,days,date,onChange,label="Days of the month"}:{day:number;days:number;date:string;label?:string;onChange:(day:number)=>void}){
  const id=useId(),input=useRef<HTMLInputElement>(null),gesture=useRef<{id:number;before:number}|null>(null),canceled=useRef(false),[dragging,setDragging]=useState(false);
  const finish=(pointerId?:number,cancel=false)=>{const active=gesture.current;if(!active||(pointerId!==undefined&&active.id!==pointerId))return;gesture.current=null;setDragging(false);if(cancel){canceled.current=true;onChange(active.before);}if(input.current?.hasPointerCapture(active.id))input.current.releasePointerCapture(active.id);};
  return <div className="date-turn" data-dialog-escape-boundary={dragging?"true":undefined}>
    <label htmlFor={id}>{label} <span>{date}</span></label>
    <input ref={input} id={id} type="range" min={1} max={days} step={1} value={day} aria-valuetext={date}
      onChange={event=>{if(!canceled.current)onChange(Number(event.currentTarget.value));}}
      onPointerDown={event=>{if(gesture.current){finish(undefined,true);return;}if(!event.isPrimary||event.button!==0)return;canceled.current=false;gesture.current={id:event.pointerId,before:day};setDragging(true);event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerUp={event=>finish(event.pointerId)} onPointerCancel={event=>finish(event.pointerId,true)} onLostPointerCapture={event=>finish(event.pointerId,true)}
      onKeyDown={event=>{if(event.key==="Escape"&&gesture.current){event.preventDefault();event.stopPropagation();finish(undefined,true);}else if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"].includes(event.key))canceled.current=false;}}/>
    <div className="date-turn-stops"><button type="button" disabled={dragging||day===1} onClick={()=>{canceled.current=false;onChange(day-1);}}>Previous day</button><button type="button" disabled={dragging||day===days} onClick={()=>{canceled.current=false;onChange(day+1);}}>Next day</button></div>
  </div>;
}
