import { useState, type ComponentProps } from 'react';

/** Local presentation preference only; never persists the contents or a draft. */
export function RememberedDetails({remember, defaultOpen = false, ...props}: Omit<ComponentProps<'details'>,'open'> & {remember:string;defaultOpen?:boolean}) {
  const key=`hearth:disclosure:v1:${remember}`;
  const [open,setOpen]=useState(()=>{try {const saved=localStorage.getItem(key);return saved===null?defaultOpen:saved==='open';}catch{return defaultOpen;}});
  return <details {...props} open={open} onToggle={event=>{
    const next=event.currentTarget.open;setOpen(next);
    try{localStorage.setItem(key,next?'open':'closed');}catch{/* Readable without storage. */}
    props.onToggle?.(event);
  }}/>;
}
