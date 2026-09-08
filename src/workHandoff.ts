const KEY='hearth:open-shift:v1';
/** A navigation hint, never an invitation, credential or household selection. */
export function workHandoffUrl(current:string):string|null{try{const url=new URL(current);if(!['https:','http:'].includes(url.protocol)||(/(^|\.)localhost$/i.test(url.hostname)||/^(127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\]|\[::\])$/.test(url.hostname)))return null;return new URL('/?open=shift',url.origin).href;}catch{return null;}}
export function rememberWorkHandoff(url:URL,storage:Pick<Storage,'getItem'|'setItem'>):boolean{try{if(url.searchParams.get('open')==='shift')storage.setItem(KEY,'shift');return storage.getItem(KEY)==='shift';}catch{return url.searchParams.get('open')==='shift';}}
export function clearWorkHandoff(storage:Pick<Storage,'removeItem'>):void{try{storage.removeItem(KEY);}catch{/* Navigation still works when device preferences are unavailable. */}}
