import {useRef,type MouseEvent as ReactMouseEvent,type PointerEvent as ReactPointerEvent} from 'react';
import {nearestDetent,throttleDetents,type AircraftId} from './aircraft.ts';

/**
 * Touch cockpit: a notched throttle lever under one thumb and two yaw pedals beside it, so the other
 * thumb stays on the flight pad. The lever and pedals are pointer surfaces only; the panel's detent
 * buttons and its visually hidden native slider are the keyboard and screen-reader route to the same power.
 */
export function CockpitControls(props:{aircraft:AircraftId;power:number;onPower:(value:number)=>void;onRudder:(value:number)=>void;refocus:()=>void}){
  const {aircraft,power,onPower,onRudder,refocus}=props;
  const track=useRef<HTMLDivElement>(null),drag=useRef<number|null>(null),pedal=useRef<number|null>(null);
  const detents=throttleDetents(aircraft),active=nearestDetent(aircraft,power/100);
  function lever(event:ReactPointerEvent<HTMLDivElement>){
    if(event.type==='pointerdown'){event.preventDefault();drag.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);refocus();}
    else if(drag.current!==event.pointerId)return;
    if(event.type==='pointerup'||event.type==='pointercancel'||event.type==='lostpointercapture'){drag.current=null;return;}
    const box=(track.current??event.currentTarget).getBoundingClientRect();
    if(box.height<=0)return;
    const raw=1-(event.clientY-box.top)/box.height,next=nearestDetent(aircraft,Math.max(0,Math.min(1,raw)));
    if(next.value!==power/100)onPower(next.value);
  }
  function press(event:ReactPointerEvent<HTMLButtonElement>,side:-1|1){
    event.preventDefault();refocus();pedal.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);onRudder(side);
  }
  function release(event:ReactPointerEvent<HTMLButtonElement>){if(pedal.current!==null&&pedal.current!==event.pointerId)return;pedal.current=null;onRudder(0);}
  function tap(event:ReactMouseEvent<HTMLButtonElement>,side:-1|1){
    // A pointer press already drove the rudder; a keyboard or assistive-tech activation (detail 0) pulses it instead.
    if(event.detail!==0)return;refocus();onRudder(side);window.setTimeout(()=>onRudder(0),260);
  }
  return <div className="horizon-cockpit" role="group" aria-label="Aircraft power lever and yaw pedals">
    <div className="horizon-lever" ref={track} aria-hidden="true" data-detent={active.id} onPointerDown={lever} onPointerMove={lever} onPointerUp={lever} onPointerCancel={lever} onLostPointerCapture={lever}>
      {detents.map(d=><span key={d.id} className="horizon-lever__notch" data-on={d.id===active.id?'true':undefined} style={{bottom:`${d.value*100}%`}}><i>{d.label}</i></span>)}
      <span className="horizon-lever__knob" style={{bottom:`${active.value*100}%`}} />
    </div>
    <div className="horizon-pedals">
      <button type="button" aria-label="Yaw left (Q)" onPointerDown={e=>press(e,-1)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onClick={e=>tap(e,-1)}><span aria-hidden="true">◀</span></button>
      <button type="button" aria-label="Yaw right (R)" onPointerDown={e=>press(e,1)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onClick={e=>tap(e,1)}><span aria-hidden="true">▶</span></button>
    </div>
  </div>;
}
