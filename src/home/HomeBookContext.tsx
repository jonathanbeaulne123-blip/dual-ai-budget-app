import {createContext,useContext} from 'react';
import type {HomeLayout} from './model.ts';
import type {HomeDisplayContent} from './displays.ts';
/** Scene-facing read-only context. All editing and command composition live in the App provider. */
export const HomeBookContext=createContext<{open:()=>void;editing:boolean;visitRequested:boolean;pendingVisit:boolean;visit:()=>void;acknowledgeVisit:()=>void;plotId:string|undefined;layout:HomeLayout|null;displays:HomeDisplayContent[]}|null>(null);
export const useHomeBook=()=>useContext(HomeBookContext);
export function HomeBookButton({label='Renovation book'}:{label?:string}){const home=useHomeBook();return home?<button type="button" className="home-book-entry" onClick={home.open} aria-haspopup="dialog">⌂ {label}</button>:null;}
