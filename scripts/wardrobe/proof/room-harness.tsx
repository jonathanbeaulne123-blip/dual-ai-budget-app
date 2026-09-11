/** Evidence harness for the dressing room: the real ThemeProvider, scene binding and room, fictional fixture only. */
import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider,useAppearance,useSceneBinding} from '../../../src/theme/ThemeProvider.tsx';
import type {SceneRoute,ThemeId} from '../../../src/theme/scenes.ts';
import type {LedgerView} from '../../../src/core/types.ts';
import HerculesDressingRoom from '../../../src/wardrobe/HerculesDressingRoom.tsx';
import {WornLookContext} from '../../../src/wardrobe/Appearance.tsx';
import {catalogHousehold} from '../../../src/core/index.ts';
import {companionFor} from '../../../src/core/herculesCompanion.ts';
import {COLLECTION_LOOKS} from '../../../src/wardrobe/catalogue.ts';
import '../../../src/styles.css';
const params=new URLSearchParams(location.search);
const theme=(['classic','taylor','newfoundland'].includes(params.get('theme')??'')?params.get('theme'):'classic') as ThemeId;
const route=(params.get('route')??'home') as SceneRoute,view=(params.get('view')==='personal'?'personal':'household') as LedgerView;
const h=catalogHousehold();const profile=companionFor(h,'MEM-001');
profile.savedLooks=[{id:'L-rain',revision:1,value:{...structuredClone(COLLECTION_LOOKS.rain!),id:'L-rain',name:'Rainy Tuesday'}},{id:'L-night',revision:1,value:{...structuredClone(COLLECTION_LOOKS.night!),id:'L-night',name:'Bedtime, apparently'}}];
profile.wornLook={revision:1,value:{...structuredClone(COLLECTION_LOOKS.cozy!),id:'W-cozy',name:'A quiet afternoon'}};
h.companionProfile=profile;
function Room(){
 useSceneBinding(route,view,false);const appearance=useAppearance();const [open,setOpen]=useState(true);
 useEffect(()=>{appearance.store?.apply(theme);},[appearance.store]);
 return <><h1 style={{padding:20}}>Fictional wardrobe evidence · {theme} · {route} · {view}</h1>{!open&&<button onClick={()=>setOpen(true)}>Open dressing room</button>}{open&&<HerculesDressingRoom environment={h.environment} householdId={h.householdId} memberId="MEM-001" view={view} household={h} connected={false} onClose={()=>setOpen(false)}/>}</>;
}
createRoot(document.getElementById('root')!).render(<ThemeProvider><WornLookContext.Provider value={null}><Room/></WornLookContext.Provider></ThemeProvider>);
