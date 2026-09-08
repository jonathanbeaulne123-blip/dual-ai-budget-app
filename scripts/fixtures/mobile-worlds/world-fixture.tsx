import {useEffect, type ReactNode} from 'react';
import {ThemeProvider,useAppearance,useSceneBinding} from '/src/theme/ThemeProvider';
import {ThemeSceneHeading} from '/src/theme/SceneArtwork';
import '/src/theme/worlds.css';
import '/src/mobile-canon.css';
import '/src/theme/mobile-worlds.css';
import '/src/theme/mobile-worlds-refinement.css';
const routes = {"mobile-b2":"shift","mobile-b3":"plan","mobile-b4":"calendar","mobile-b5":"plan","mobile-b7":"shift","mobile-b8":"ledger","mobile-b9":"calendar","mobile-c6":"till","mobile-c7":"home","mobile-c9":"ledger","mobile-proof":"ledger","mobile-c11":"shift"};
export function MobileWorldFixture({children}: {children: ReactNode}) {return <ThemeProvider><WorldBinding>{children}</WorldBinding></ThemeProvider>}
function WorldBinding({children}: {children: ReactNode}) {
 const {store,scene}=useAppearance(); const q=new URLSearchParams(location.search);
 const name=location.pathname.split('/').at(-2);const route=q.get('route')||routes[name]||'home';
 useSceneBinding(route,q.has('personal')?'personal':'household',false);
 useEffect(()=>{store.preview(q.get('theme')||'classic')},[store]);
 return <><header style={{padding:10,fontSize:12}}><p>Hearth · fictional component specimen</p><label>Theme<select aria-label="Theme" value={scene.theme} onChange={e=>store.preview(e.target.value)}>{['classic','taylor','newfoundland'].map(t=><option key={t}>{t}</option>)}</select></label></header><div style={{padding:'0 14px'}}><ThemeSceneHeading home={route==='home'}/></div>{children}</>
}
