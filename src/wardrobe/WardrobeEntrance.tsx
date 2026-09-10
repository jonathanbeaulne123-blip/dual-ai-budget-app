import type {Household} from '../core/types.ts';
import type {KitchenCommand} from '../kitchenCommand.ts';
import {wardrobeReturnFocus} from './focus.ts';
import {Component,Suspense,lazy,useState,useEffect,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useDialog} from '../useDialog.ts';
type Props={environment:string;householdId:string;memberId:string;view:'personal'|'household';busy:boolean;household?:Household;onCommand?:KitchenCommand;connected?:boolean};
const Room=lazy(()=>import('./HerculesDressingRoom.tsx'));
function LoadingRoom({onClose,retry}:{onClose:()=>void;retry?:()=>void}){const dialog=useDialog(true,onClose,wardrobeReturnFocus);return createPortal(<div ref={dialog} role="dialog" aria-modal="true" aria-label="Hercules dressing room" className="wardrobe-loading-room"><h2>{retry?'The dressing room could not open':'Opening Hercules’s room…'}</h2><p>{retry?'Your desk and local fitting draft are still available. Reload Hearth, then open the dressing room again.':'Your fitting appointment is just a moment away.'}</p>{retry&&<button type="button" onClick={retry}>Reload Hearth to retry</button>}<button type="button" onClick={onClose}>Close dressing room</button></div>,document.body);}
class RoomBoundary extends Component<{children:ReactNode;onClose:()=>void;retry:()=>void},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<LoadingRoom onClose={this.props.onClose} retry={this.props.retry}/>:this.props.children;}}
export function WardrobeEntrance(props:Props){return <section className="wardrobe-fitting-entrance"><h3>A room of his own</h3><p>Six collections, familiar favourites, and a room to make them your own.</p><button type="button" disabled={props.busy} onClick={()=>window.dispatchEvent(new CustomEvent('hearth:open-fitting',{detail:{environment:props.environment,householdId:props.householdId,memberId:props.memberId}}))}>Open dressing room</button><small>Try on here · wear and save for your account</small></section>;}
/** Stable Office owner: breakpoint changes cannot discard an open fitting session. */
export function WardrobeRoomHost(props:Props){const [open,setOpen]=useState(false);const close=()=>setOpen(false);
 useEffect(()=>{const receive=(event:Event)=>{const detail=(event as CustomEvent).detail;if(!props.busy&&detail?.environment===props.environment&&detail.householdId===props.householdId&&detail.memberId===props.memberId)setOpen(true);};window.addEventListener('hearth:open-fitting',receive);return()=>window.removeEventListener('hearth:open-fitting',receive);},[props.environment,props.householdId,props.memberId,props.busy]);
 return open?<RoomBoundary onClose={close} retry={()=>window.location.reload()}><Suspense fallback={<LoadingRoom onClose={close}/>}><Room {...props} onClose={close}/></Suspense></RoomBoundary>:null;}
