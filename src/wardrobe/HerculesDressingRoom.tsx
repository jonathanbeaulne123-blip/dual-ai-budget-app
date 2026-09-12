import {wardrobeReturnFocus} from './focus.ts';
import {useEffect,useRef,useState,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {useDialog} from '../useDialog.ts';
import {useAppearance} from '../theme/ThemeProvider.tsx';
import {COMPANION_SLOTS,legacyCompanionPreview,validateLookForWear,type LookV1,type CompanionSlot,type CompanionScope} from '../core/herculesCompanionContracts.ts';
import type {Household} from '../core/types.ts';
import type {KitchenCommand} from '../kitchenCommand.ts';
import {companionFor} from '../core/herculesCompanion.ts';
import {fitSelection,sameOutfit,shuffleLook} from './lookTools.ts';
import {useWardrobeCommands} from './useWardrobeCommands.ts';
import {PieceGlyph} from './PieceGlyph.tsx';
import {SavedLooks} from './SavedLooks.tsx';
import {COZY_LOOK,COLLECTIONS,COLLECTION_LOOKS,FITTING_MANIFEST,FITTING_ITEMS,FITTING_REACTIONS,canPlayReaction,fittingColour,type FittingReaction} from './catalogue.ts';
import {fitEdit,fitRedo,fitUndo,fittingDraftKey,loadFittingDraft,saveFittingDraft,type FittingHistory} from './draft.ts';
import {FittingFigure} from './FittingFigure.tsx';
import type {WardrobeScene} from './scene.ts';
import {readSceneTokens,roomPalette,type RoomPalette} from './roomPalette.ts';
import {availableColours,cyclePiece,piecesInColour,pushRecent,readRecent,searchPieces,slotLabel,typingTarget,wornPieces,writeRecent,type SlotFilter} from './navigation.ts';
import './wardrobe.css';
type Shelf='collection'|'favourites'|'recent';
type Props={environment:string;householdId:string;memberId:string;view:'household'|'personal';onClose:()=>void;household?:Household;onCommand?:KitchenCommand;connected?:boolean};
/** Room names and captions are authored per theme, view and lighting. They describe furniture, never money. */
export function roomCopy(theme:string,personal:boolean,dark:boolean):{name:string;caption:string}{
 if(theme==='taylor')return dark?{name:personal?'The attic, lamp on':'The attic after dark',caption:'Cards on the string, a warm lamp, and the room to yourself.'}:personal?{name:'The scrapbook attic',caption:'Pastel walls, a string of blank photo cards, and somewhere quiet to get ready.'}:{name:'The cottage attic',caption:'Soft knits, a patchwork cushion, and a botanical pot by the lamp.'};
 if(theme==='newfoundland')return dark?{name:personal?'The music room, after hours':'The harbour room, after hours',caption:'Street lights through the porthole, a cone lamp, and the good record sleeves out.'}:personal?{name:'The music-room wardrobe',caption:'Jellybean clapboard, a rope rail with brass hooks, and a porthole onto the harbour.'}:{name:'The harbour dressing room',caption:'Painted boards, three favourite records, and something for the weather.'};
 return dark?{name:personal?'The little study, lamp on':'The dressing room, lamp on',caption:'Wainscot, a brass rail, and a warm lamp for a late fitting.'}:{name:personal?'The little study':'The little dressing room',caption:'Wainscot and brass, tall window light, and a rather important appointment.'};
}
export default function HerculesDressingRoom({environment,householdId,memberId,view,onClose,household,onCommand,connected=false}:Props){
 const appearance=useAppearance(),theme=appearance.scene.theme,scene=appearance.scene;const key=fittingDraftKey(environment,householdId,memberId);
 const profile=household?companionFor(household,memberId):null;
 const legacy=household?legacyCompanionPreview(household.kitchen.companion.equipped):null;
 const initial=profile?.wornLook.value??legacy?.look??COZY_LOOK;
 const [online,setOnline]=useState(navigator.onLine);
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
 const commands=useWardrobeCommands({environment,householdId,memberId} as CompanionScope,connected&&online,onCommand);
 const [storage]=useState(()=>{try{return window.localStorage;}catch{return null;}});
 // Shelf navigation: collection chips, favourites, recently worn, search and colour-first all feed one hanger grid.
 const [collection,setCollection]=useState('cozy'),[shelf,setShelf]=useState<Shelf>('collection'),[slotFilter,setSlotFilter]=useState<SlotFilter>('all'),[locked,setLocked]=useState<CompanionSlot[]>([]);
 const [favourites,setFavourites]=useState<string[]>(()=>{try{const value=JSON.parse(localStorage.getItem(key+':favourites')??'[]');return Array.isArray(value)?value.filter(v=>typeof v==='string').slice(0,60):[];}catch{return [];}});
 const [recent,setRecent]=useState<string[]>(()=>readRecent(storage,key+':recent'));
 const [queryInput,setQueryInput]=useState(''),[query,setQuery]=useState(''),[colour,setColour]=useState<string|null>(null);
 useEffect(()=>{const handle=setTimeout(()=>setQuery(queryInput.trim()),180);return()=>clearTimeout(handle);},[queryInput]);
 const [replacement,setReplacement]=useState<{look:LookV1;names:string[]}|null>(null),[fitStatus,setFitStatus]=useState('ready'),[shelfStatus,setShelfStatus]=useState('ready'),[keepsake,setKeepsake]=useState<string|null>(legacy?.keepsakes[0]??null);
 const [resolvedLegacy,setResolvedLegacy]=useState<string[]>(()=>{try{const value=JSON.parse(localStorage.getItem(key+':legacy-resolved')??'[]');return Array.isArray(value)?value.filter(v=>typeof v==='string'):[];}catch{return [];}});
 function resolveLegacy(slots:string[]){setResolvedLegacy(old=>{const next=[...new Set([...old,...slots])];try{localStorage.setItem(key+':legacy-resolved',JSON.stringify(next));}catch{}return next;});}
 const [history,setHistory]=useState<FittingHistory>(()=>({past:[],present:loadFittingDraft(storage,key,initial),future:[]}));
 const look=history.present;const latestLook=useRef(look);latestLook.current=look;
 const [selected,setSelected]=useState<string>('cozy-sweater'),[status,setStatus]=useState('loading'),[attempt,setAttempt]=useState(0),[saved,setSaved]=useState(true);
 const [paused,setPaused]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches),[reduced,setReduced]=useState(paused),[pose,setPose]=useState<FittingReaction>('breathe-blink');
 const [angle,setAngle]=useState(27),[zoom,setZoom]=useState(1),[mirror,setMirror]=useState(true),[flat,setFlat]=useState(false);
 const [drawer,setDrawer]=useState<'clothes'|'poses'|'looks'>('clothes'),[sheet,setSheet]=useState(false);
 const [phone,setPhone]=useState(()=>window.matchMedia('(max-width: 719px)').matches);
 useEffect(()=>{const media=window.matchMedia('(max-width: 719px)');const changed=()=>setPhone(media.matches);media.addEventListener?.('change',changed);return()=>media.removeEventListener?.('change',changed);},[]);
 const host=useRef<HTMLDivElement>(null),controller=useRef<WardrobeScene|null>(null),dialog=useDialog(true,onClose,wardrobeReturnFocus),searchBox=useRef<HTMLInputElement>(null);
 // The 3D room follows the live scene: the authored scene palette renders first, then computed tokens (written by ThemeProvider's layout effect) refine it after commit and on every scene change.
 const [palette,setPalette]=useState<RoomPalette>(()=>roomPalette({theme,personal:view==='personal',dark:scene.dark,palette:scene.palette}));
 useEffect(()=>{setPalette(roomPalette({theme,personal:view==='personal',dark:scene.dark,palette:scene.palette},readSceneTokens(document.documentElement)));},[theme,view,scene]);
 const presentation=useRef({paused:paused||reduced,pose,angle,zoom,mirror,collection,keepsake,palette});presentation.current={paused:paused||reduced,pose,angle,zoom,mirror,collection,keepsake,palette};
 const active=FITTING_ITEMS.find(item=>item.id===selected)??FITTING_ITEMS[0]!;
 useEffect(()=>{setSaved(saveFittingDraft(storage,key,look));},[look,key,storage]);
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const changed=()=>{setReduced(media.matches);if(media.matches)setPaused(true);};media.addEventListener('change',changed);return()=>media.removeEventListener('change',changed);},[]);
 useEffect(()=>{
  const node=host.current;if(!node||flat)return;const abort=new AbortController();let live=true;setStatus('loading');
  import('./scene.ts').then(({createWardrobeScene})=>{if(!live)return null;return createWardrobeScene(node,{palette:presentation.current.palette,signal:abort.signal,paused:paused||reduced,onError:()=>{if(live){controller.current=null;setStatus('error');}},onReady:()=>{if(live)setStatus('ready');},onFittingState:state=>{if(live)setFitStatus(state);},onCollectionState:state=>{if(live)setShelfStatus(state);},onPick:id=>{if(live){pick(id);}}});}).then(instance=>{if(!instance)return;if(!live){instance.dispose();return;}controller.current=instance;const current=presentation.current;instance.setPaused(current.paused);instance.setLook(latestLook.current);instance.setCamera(current.angle,current.zoom);instance.setMirror(current.mirror);instance.setPose(current.pose);instance.setRoom?.(current.palette);instance.setCollection?.(current.collection);instance.setKeepsake?.(current.keepsake);}).catch(()=>{if(live)setStatus('error');});
  return()=>{live=false;abort.abort();controller.current?.dispose();controller.current=null;};
 },[attempt,theme,flat]);
 useEffect(()=>{controller.current?.setRoom?.(palette);},[palette,status]);
 useEffect(()=>{controller.current?.setLook(look);if(!canPlayReaction(pose,look)){setPose('breathe-blink');controller.current?.setPose('breathe-blink');}},[look,pose]);
 useEffect(()=>controller.current?.setPaused(paused||reduced),[paused,reduced]);
 useEffect(()=>controller.current?.setCamera(angle,zoom),[angle,zoom]);
 useEffect(()=>controller.current?.setMirror(mirror),[mirror]);
 useEffect(()=>{controller.current?.setCollection?.(collection);},[collection,status]);
 useEffect(()=>{controller.current?.setKeepsake?.(keepsake);},[keepsake,status]);
 function remember(id:string){setRecent(old=>{const next=pushRecent(old,id);writeRecent(storage,key+':recent',next);return next;});}
 function change(slot:CompanionSlot,itemId:string|null,variantId?:string){const item=FITTING_ITEMS.find(p=>p.id===itemId);const result=fitSelection(latestLook.current,slot,item?{itemId:item.id,variantId:variantId??item.variants[0]!}:null);if(result.replaced.length)setReplacement({look:result.look,names:result.replaced});else{setReplacement(null);setHistory(previous=>fitEdit(previous,result.look));resolveLegacy([slot]);if(item)remember(item.id);}}
 function pick(id:string){const item=FITTING_ITEMS.find(p=>p.id===id);if(!item)return;setSelected(id);setDrawer('clothes');change(item.slot,id,colour&&item.variants.includes(colour)?colour:undefined);}
 function preview(next:LookV1){const first=Object.values(next.selections).find(value=>value&&FITTING_ITEMS.some(item=>item.id===value.itemId));if(first)setSelected(first.itemId);resolveLegacy(legacy?.conflicts.map(c=>c.slot)??[]);setReplacement(null);setHistory(s=>fitEdit(s,structuredClone(next)));}
 function favourite(id:string){setFavourites(old=>{const next=old.includes(id)?old.filter(x=>x!==id):[...old,id];try{localStorage.setItem(key+':favourites',JSON.stringify(next));}catch{}return next;});}
 function jumpTo(slot:CompanionSlot,itemId?:string){setSlotFilter(slot);if(itemId&&FITTING_ITEMS.some(p=>p.id===itemId))setSelected(itemId);setDrawer('clothes');if(phone)setSheet(true);}
 let wearable=true;try{validateLookForWear(look,FITTING_MANIFEST);}catch{wearable=false;}
 const conflict=!profile?.wornLook.value?legacy?.conflicts.find(c=>!look.selections[c.slot]&&!resolvedLegacy.includes(c.slot)):undefined;
 const base=query?searchPieces(FITTING_ITEMS,query):colour?piecesInColour(FITTING_ITEMS,colour):shelf==='favourites'?FITTING_ITEMS.filter(item=>favourites.includes(item.id)):shelf==='recent'?recent.map(id=>FITTING_ITEMS.find(item=>item.id===id)!).filter(Boolean):FITTING_ITEMS.filter(item=>item.collection===collection);
 const shown=base.filter(item=>slotFilter==='all'||item.slot===slotFilter);
 const currentSlot:CompanionSlot=slotFilter==='all'?active.slot:slotFilter;
 const slotPool=base.filter(item=>item.slot===currentSlot);
 function step(direction:1|-1){const next=cyclePiece(base,currentSlot,look.selections[currentSlot]?.itemId??null,direction);if(next)pick(next.id);}
 function shortcuts(event:ReactKeyboardEvent<HTMLDivElement>){
  if(typingTarget(event.target)||event.metaKey||event.ctrlKey||event.altKey)return;
  if(event.key===']'){event.preventDefault();step(1);}else if(event.key==='['){event.preventDefault();step(-1);}
  else if(event.key==='S'&&event.shiftKey){event.preventDefault();preview(shuffleLook(look,locked));}
  else if(event.key==='f'||event.key==='F'){event.preventDefault();favourite(active.id);}
  else if(event.key==='Backspace'){event.preventDefault();if(look.selections[currentSlot])change(currentSlot,null);}
  else if(event.key==='/'){event.preventDefault();searchBox.current?.focus();}
  else if(event.key==='Escape'&&phone&&sheet&&(event.target as Element|null)?.closest?.('[data-dialog-escape-boundary]')){event.preventDefault();event.stopPropagation();setSheet(false);}
 }
 const collectionInfo=COLLECTIONS.find(c=>c.id===collection);
 const copy=roomCopy(theme,view==='personal',scene.dark);
 const worn=wornPieces(look);
 const savedLooks=profile?.savedLooks.filter(row=>row.value).map(row=>row.value!)??[];
 const shelfTitle=query?`Search · ${shown.length} ${shown.length===1?'piece':'pieces'}`:colour?`Everything in ${colour.replace('-',' ')}`:shelf==='favourites'?'Your favourites':shelf==='recent'?'Recently worn':collectionInfo?.name??'Old favourites';
 const shelfNote=query?'Names, collections, shapes and details.':colour?'Pick a colour first, then the piece.':shelf==='favourites'?'Favourites stay on this device.':shelf==='recent'?'The last twelve pieces you tried, newest first, on this device.':collectionInfo?.note??'Every original piece is here. No financial milestones required.';
 const drawerTabs=<div className="fitting-tabs" role="tablist" aria-label="Fitting drawer">{([['clothes','The outfit'],['poses','Hercules’s poses'],['looks','Saved looks']] as const).map(([id,label])=><button key={id} type="button" role="tab" aria-selected={drawer===id} onClick={()=>{setDrawer(id);if(phone)setSheet(true);}}>{label}</button>)}</div>;
 return createPortal(<div ref={dialog} className="hercules-fitting-backdrop" role="dialog" aria-modal="true" aria-labelledby="fitting-title" data-fitting-theme={theme} data-fitting-view={view} data-fitting-lighting={scene.dark?'dark':'light'} data-fitting-sheet={sheet} onKeyDown={shortcuts}>
  <div className="hercules-fitting-room">
   <header className="fitting-header"><div><span className="fitting-eyebrow">Hercules outfits · your dressing room</span><h1 id="fitting-title">{copy.name}</h1><p>{copy.caption}</p></div><button type="button" data-autofocus className="fitting-close" onClick={onClose} aria-label="Close dressing room">Close <span aria-hidden="true">×</span></button></header>
   <main className="fitting-stage-wrap">
    <div className="fitting-wearing" aria-label="Wearing now"><span className="fitting-eyebrow">Wearing now</span>
     {worn.length?<ul>{worn.map(({slot,item,itemId,variantId})=><li key={slot}><button type="button" className="fitting-chip" aria-label={`${slotLabel(slot)}: ${item?.name??itemId}. Show ${slotLabel(slot).toLowerCase()} pieces`} aria-pressed={slotFilter===slot} onClick={()=>jumpTo(slot,itemId)}>{item?<PieceGlyph itemId={itemId} variantId={variantId} size={26}/>:<span aria-hidden="true">?</span>}<span>{item?.name??itemId}</span></button><button type="button" className="fitting-chip-remove" aria-label={`Remove ${item?.name??itemId}`} onClick={()=>change(slot,null)}>×</button></li>)}</ul>:<p>Nothing on yet. Natural mane, very proud of it.</p>}
    </div>
    <div className="fitting-stage" data-fitting-stage>
     <div ref={host} className="fitting-webgl" hidden={flat||status==='error'} data-state={status}/>
     {(flat||status!=='ready')&&<div className="fitting-fallback"><FittingFigure look={look} size={230}/><p>{flat?'2D outfit preview':status==='error'?'3D is unavailable. Your outfit preview is still here.':'Opening the dressing room…'}</p>{status==='error'&&!flat&&<button type="button" onClick={()=>setAttempt(n=>n+1)}>Retry 3D</button>}</div>}
     <span className="fitting-stage-label">{flat||status==='error'?'2D preview':fitStatus==='loading'?'Fitting the selected pieces…':fitStatus==='error'?'Last available 3D look':'Fitting platform'}</span>
     {fitStatus==='error'&&!flat&&<div className="fitting-asset-error"><p>The selected piece could not load. Your draft is kept; 3D shows the previous fit.</p><button type="button" onClick={()=>controller.current?.setLook(look)}>Retry pieces</button></div>}
     <button type="button" className="fitting-step fitting-step-prev" aria-label={`Previous ${slotLabel(currentSlot).toLowerCase()} piece`} aria-keyshortcuts="[" disabled={!slotPool.length} onClick={()=>step(-1)}><span aria-hidden="true">‹</span></button>
     <button type="button" className="fitting-step fitting-step-next" aria-label={`Next ${slotLabel(currentSlot).toLowerCase()} piece`} aria-keyshortcuts="]" disabled={!slotPool.length} onClick={()=>step(1)}><span aria-hidden="true">›</span></button>
    </div>
    <div className="fitting-slot-tabs" role="tablist" aria-label="Wardrobe slots">
     <button type="button" role="tab" aria-selected={slotFilter==='all'} onClick={()=>setSlotFilter('all')}>All</button>
     {COMPANION_SLOTS.map(slot=><button key={slot} type="button" role="tab" aria-selected={slotFilter===slot} data-worn={Boolean(look.selections[slot])} onClick={()=>setSlotFilter(slot)}>{slotLabel(slot)}{look.selections[slot]&&<i aria-hidden="true"/>}</button>)}
    </div>
    <div className="fitting-camera" aria-label="Fitting camera"><label>Turn <input type="range" aria-label="Turn Hercules" min="-180" max="180" step="3" value={angle} onChange={e=>setAngle(Number(e.target.value))} disabled={flat||status!=='ready'}/></label><label>Zoom <input type="range" aria-label="Zoom Hercules" min="0.78" max="1.3" step="0.02" value={zoom} onChange={e=>setZoom(Number(e.target.value))} disabled={flat||status!=='ready'}/></label><button type="button" onClick={()=>{setAngle(-153);setZoom(1);}} disabled={flat||status!=='ready'}>See the back</button><button type="button" onClick={()=>{setAngle(27);setZoom(1);}} disabled={flat||status!=='ready'}>Reset view</button></div>
    <div className="fitting-view-options"><button type="button" aria-pressed={mirror} disabled={flat||status!=='ready'} onClick={()=>setMirror(x=>!x)}>Mirror {mirror?'on':'off'}</button><button type="button" aria-pressed={paused||reduced} disabled={reduced||flat||status==='error'} onClick={()=>setPaused(x=>!x)}>{reduced?'Reduced motion':paused?'Resume motion':'Pause motion'}</button><button type="button" aria-pressed={flat} onClick={()=>setFlat(x=>!x)}>{flat?'Return to 3D':'Compare 2D look'}</button></div>
   </main>
   <aside className="fitting-rail" aria-label="The wardrobe">
    <label className="fitting-search"><span>Find a piece</span><input ref={searchBox} type="search" value={queryInput} placeholder="Toque, brass, rain…" aria-describedby="fitting-search-count" onChange={e=>setQueryInput(e.target.value)}/></label>
    <p id="fitting-search-count" className="fitting-search-count" aria-live="polite">{query?`${shown.length} ${shown.length===1?'piece matches':'pieces match'} “${query}”`:''}</p>
    <div className="fitting-shelves" role="group" aria-label="Collections">
     {COLLECTIONS.map(c=><button key={c.id} type="button" className="fitting-chip" aria-pressed={!query&&!colour&&shelf==='collection'&&collection===c.id} onClick={()=>{setCollection(c.id);setShelf('collection');setColour(null);setQueryInput('');}}>{c.name}</button>)}
     <button type="button" className="fitting-chip" aria-pressed={!query&&!colour&&shelf==='collection'&&collection==='legacy'} onClick={()=>{setCollection('legacy');setShelf('collection');setColour(null);setQueryInput('');}}>Old favourites</button>
     <button type="button" className="fitting-chip" aria-pressed={!query&&!colour&&shelf==='favourites'} onClick={()=>{setShelf(s=>s==='favourites'?'collection':'favourites');setColour(null);setQueryInput('');}}>Favourites</button>
     <button type="button" className="fitting-chip" aria-pressed={!query&&!colour&&shelf==='recent'} onClick={()=>{setShelf(s=>s==='recent'?'collection':'recent');setColour(null);setQueryInput('');}}>Recently worn</button>
    </div>
    <details className="fitting-colour-first" open={Boolean(colour)}><summary>Colour first{colour?` · ${colour.replace('-',' ')}`:''}</summary><p>Pick a colour, see every piece available in it.</p><div className="fitting-colour-grid" role="group" aria-label="Colours">{availableColours().map(c=><button key={c} type="button" aria-label={`Pieces in ${c.replace('-',' ')}`} aria-pressed={colour===c} onClick={()=>{setColour(v=>v===c?null:c);setQueryInput('');}}><span style={{background:fittingColour(c)}} aria-hidden="true"/></button>)}{colour&&<button type="button" className="fitting-chip" onClick={()=>setColour(null)}>Any colour</button>}</div></details>
    <div className="fitting-collection"><h2>{shelfTitle}</h2><p>{shelfNote}</p></div>
    {!query&&!colour&&shelf==='collection'&&COLLECTION_LOOKS[collection]&&<button type="button" className="fitting-recommended" onClick={()=>preview(COLLECTION_LOOKS[collection]!)}>Try the collection look</button>}
    {shelfStatus==='error'&&<p role="status">These display pieces could not load. The catalogue still works. <button type="button" onClick={()=>controller.current?.setCollection(collection)}>Retry collection display</button></p>}
    <div className="fitting-hangers">{shown.map(item=>{const wornHere=look.selections[item.slot]?.itemId===item.id;return <button key={item.id} type="button" aria-label={`Try ${item.name}`} aria-pressed={wornHere} data-slot={item.slot} onClick={()=>pick(item.id)}><PieceGlyph itemId={item.id} variantId={wornHere?look.selections[item.slot]?.variantId:colour&&item.variants.includes(colour)?colour:undefined}/><strong>{item.name}</strong><small>{wornHere?'In this preview':slotLabel(item.slot)}</small></button>;})}</div>
    {!shown.length&&<p className="fitting-empty">{query?'Nothing matches yet. Try a colour, a collection name or a shape like “round”.':shelf==='recent'?'Nothing tried on yet. Pieces you try appear here.':shelf==='favourites'?'No favourites yet. Press F or use Favourite piece on the fitting table.':'No pieces in this selection. Choose another slot or collection.'}</p>}
    <details className="fitting-keepsakes"><summary>Keepsakes shelf</summary><p>The original houses decorate the room. Winter ruff is Hercules’s natural mane.</p>{['cottage','townhouse','patio'].map(id=><button type="button" key={id} aria-pressed={keepsake===id} onClick={()=>setKeepsake(id)}>{id}</button>)}<button type="button" onClick={()=>setKeepsake(null)}>Clear shelf</button></details>
    <p className="fitting-shortcuts"><kbd>[</kbd> <kbd>]</kbd> previous / next in this slot · <kbd>Shift</kbd>+<kbd>S</kbd> surprise me · <kbd>F</kbd> favourite · <kbd>⌫</kbd> remove · <kbd>/</kbd> search</p>
   </aside>
   <aside className={`fitting-drawer${phone?' fitting-sheet':''}`} aria-label="Fitting controls" data-open={sheet} data-dialog-escape-boundary={phone&&sheet?'':undefined}>
    <div className="fitting-sheet-head">{phone&&<button type="button" className="fitting-sheet-handle" aria-label={sheet?'Close outfit details':'Open outfit details'} aria-expanded={sheet} onClick={()=>setSheet(v=>!v)}><span aria-hidden="true"/></button>}{drawerTabs}</div>
    <div className="fitting-drawer-body" hidden={phone&&!sheet}>
    {drawer==='looks'?<SavedLooks household={household} memberId={memberId} look={look} wearable={wearable&&!conflict} commands={commands} onPreview={preview}/>:drawer==='clothes'?<section><p className="fitting-eyebrow">ON THE FITTING TABLE</p><h2>{active.name}</h2><p>{active.detail}</p><div className="fitting-swatches" aria-label={`${active.name} colours`}>{active.variants.map(variant=><button key={variant} type="button" aria-label={`${active.name}: ${variant}`} aria-pressed={look.selections[active.slot]?.itemId===active.id&&look.selections[active.slot]?.variantId===variant} onClick={()=>change(active.slot,active.id,variant)}><span style={{background:fittingColour(variant,active.id)}} aria-hidden="true"/>{variant.replace('-',' ')}</button>)}</div><button type="button" className="fitting-remove" disabled={look.selections[active.slot]?.itemId!==active.id} onClick={()=>change(active.slot,null)}>Remove {active.name.toLowerCase()}</button><div className="fitting-piece-actions"><button type="button" aria-pressed={favourites.includes(active.id)} onClick={()=>favourite(active.id)}>{favourites.includes(active.id)?'Unfavourite piece':'Favourite piece'}</button><button type="button" aria-pressed={locked.includes(active.slot)} onClick={()=>setLocked(old=>old.includes(active.slot)?old.filter(s=>s!==active.slot):[...old,active.slot])}>{locked.includes(active.slot)?'Unlock':'Lock'} {active.slot}</button></div>{phone&&<div className="fitting-piece-actions"><button type="button" onClick={()=>preview(profile?.wornLook.value??initial)}>Reset to worn</button><button type="button" onClick={()=>preview({...look,selections:{}})}>No accessories</button></div>}<div className="fitting-look-note"><h3>A little styling note</h3><p>Hats and glasses belong together. Lock a favourite slot before a surprise; Hercules will work around it. Favourites stay on this device.</p></div></section>:<section><h2>A moment in the mirror</h2><p>{flat||status==='error'?'Fitting poses are available in 3D. You can still style the outfit here.':status==='loading'?'Choose a pose for when 3D is ready.':paused||reduced?'Choose a still fitting pose.':'Choose a reaction, then inspect the fit.'}</p><div className="fitting-poses">{FITTING_REACTIONS.map(reaction=><button type="button" key={reaction.id} disabled={flat||status==='error'||!canPlayReaction(reaction.id,look)} aria-pressed={pose===reaction.id} onClick={()=>{setPose(reaction.id);controller.current?.setPose(reaction.id);}}>{reaction.label}{!canPlayReaction(reaction.id,look)&&<small>{reaction.id==='admire-cape'?'Requires a cape':`Add ${'requires' in reaction?reaction.requires:'the piece'} first`}</small>}</button>)}</div></section>}
    </div>
   </aside>
   <section className="fitting-notices" aria-label="Outfit notices">
    {replacement&&<div role="status"><p>This piece replaces {replacement.names.join(', ')} so the outfit fits.</p><button type="button" onClick={()=>{preview(replacement.look);setReplacement(null);}}>Replace and try on</button><button type="button" onClick={()=>setReplacement(null)}>Keep current outfit</button></div>}
    {Object.entries(look.selections).filter(([,v])=>!FITTING_ITEMS.some(i=>i.id===v.itemId&&i.variants.includes(v.variantId))).map(([slot,value])=><p key={slot}>Unavailable piece: {value.itemId}. It is preserved in this draft. <button type="button" onClick={()=>change(slot as CompanionSlot,null)}>Remove unavailable {slot}</button></p>)}
    {conflict&&<div><p>Your original look has two {conflict.slot} pieces. Choose which one to try; the original household configuration stays preserved.</p>{conflict.itemIds.map(id=><button type="button" key={id} onClick={()=>pick(id)}>Choose {FITTING_ITEMS.find(p=>p.id===id)?.name??id}</button>)}</div>}
    {legacy?.unknown.length? <p>Some original items are unavailable: {legacy.unknown.map(v=>v.itemId).join(', ')}. Their IDs remain in the original household configuration.</p>:null}
   </section>
   <section className="fitting-look-strip" aria-label="Looks to try"><span className="fitting-eyebrow">Looks</span><ul>
    {savedLooks.map(saved=><li key={saved.id}><button type="button" aria-pressed={sameOutfit(saved,look)} onClick={()=>preview(saved)}><FittingFigure look={saved} size={48}/><span>{saved.name}</span><small>Saved</small></button></li>)}
    {COLLECTIONS.map(c=>{const cl=COLLECTION_LOOKS[c.id];return cl?<li key={c.id}><button type="button" aria-pressed={sameOutfit(cl,look)} onClick={()=>preview(cl)}><FittingFigure look={cl} size={48}/><span>{c.name}</span><small>Collection</small></button></li>:null;})}
   </ul></section>
   <footer className="fitting-footer"><div role="status"><strong>{profile?.wornLook.value&&sameOutfit(profile.wornLook.value,look)?'Your worn look':'Preview · not worn yet'}</strong><span>{commands.message||(!saved?'Device storage is unavailable. Keep this room open to retain the draft.':!online||!connected?'Browsing and fitting are available. Connect to save, wear or share.':saved?'Draft kept on this device. Wear and Save wait for your household’s confirmation.':'Device storage is unavailable. Keep this room open to retain the draft.')}</span>{commands.retry&&<button type="button" disabled={commands.pending||!online||!connected} onClick={()=>void commands.retryNow()}>Retry unconfirmed request</button>}</div>
    <div className="fitting-footer-actions"><div className="fitting-history"><button type="button" disabled={!history.past.length} onClick={()=>setHistory(fitUndo)}>Undo</button><button type="button" disabled={!history.future.length} onClick={()=>setHistory(fitRedo)}>Redo</button><button type="button" className="fitting-secondary" onClick={()=>preview(profile?.wornLook.value??initial)}>Reset to worn</button><button type="button" aria-keyshortcuts="Shift+S" onClick={()=>preview(shuffleLook(look,locked))}>Surprise me</button><button type="button" className="fitting-secondary" onClick={()=>preview({...look,selections:{}})}>No accessories</button></div>
     <div className="fitting-save-actions"><button type="button" disabled={!commands.canStart||!wearable||Boolean(conflict)||Boolean(replacement)} onClick={()=>void commands.submit({kind:'look.wear',look,expectedRevision:profile?.wornLook.revision??0})}>Wear this</button><button type="button" onClick={()=>{setDrawer('looks');if(phone)setSheet(true);requestAnimationFrame(()=>document.getElementById('fitting-look-name')?.focus());}}>Save look…</button></div></div>
   </footer>
  </div>
 </div>,document.body);
}
