import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from './useDialog.ts';
import './drawer-surface.css';

export function DrawerSurface({title,onClose,children,embedded=false,returnFocusFallback}: {title:string;onClose:()=>void;children:ReactNode;embedded?:boolean;returnFocusFallback?:()=>HTMLElement|null}) {
  const titleId=useId();
  const root=useDialog(!embedded,onClose,returnFocusFallback);
  if(embedded)return <div className="drawer-embedded">{children}</div>;
  return createPortal(<div className="drawer-backdrop" ref={root}>
    <section className="drawer-surface" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="drawer-toolbar"><h2 id={titleId}>{title}</h2><button type="button" className="ghost" onClick={onClose}>Close</button></header>
      <div className="drawer-scroll">{children}</div>
    </section>
  </div>,document.body);
}
