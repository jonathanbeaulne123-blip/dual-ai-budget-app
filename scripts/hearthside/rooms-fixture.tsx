import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RoomScene, type RoomSceneRoom, type RoomSceneObject } from '../../src/hearthside/RoomScene.tsx';
import type { ThemeId } from '../../src/theme/scenes.ts';

const params = new URLSearchParams(location.search);
function Fixture() {
  const [room,setRoom] = useState<RoomSceneRoom>((params.get('room')??'common') as RoomSceneRoom), [theme,setTheme] = useState<ThemeId>((params.get('theme')??'classic') as ThemeId);
  const [message,setMessage] = useState(''), [positions,setPositions] = useState<Record<string,{x:number;y:number}>>({}), [paused,setPaused] = useState(params.has('paused'));
  const labels = params.has('long') ? ['A quiet weekend for us to remember, with a long title that must remain readable at every size','A little note with details that keep going: breakfast, a walk, and an ordinary afternoon together','Our painted piece, with a deliberately long name and no balance included','The day we chose to keep in our own words'] : ['A quiet weekend','Breakfast, together','Our painted piece','An ordinary afternoon'];
  const kinds:RoomSceneObject['kind'][]=params.has('many')?Array.from({length:8},()=> 'note'):['experience','note','piece','memory'];
  const objects = params.has('empty') ? [] : kinds.map((kind,i)=>({id:`fixture-${i}`,kind,label:labels[i%labels.length]!,detail:params.has('long')?'Synthetic shared-life fixture. This long description belongs on a readable surface without hiding the other room controls.':undefined,...positions[`fixture-${i}`],onActivate:()=>setMessage(`Opened ${kind}: ${labels[i%labels.length]}`)}));
  return <><div className="fixture-controls"><span>Synthetic room-scene harness</span><label>Theme <select aria-label="Theme" value={theme} onChange={e=>setTheme(e.target.value as ThemeId)}><option value="classic">Classic</option><option value="taylor">Taylor</option><option value="newfoundland">Newfoundland</option></select></label><button onClick={()=>setPaused(!paused)}>Pause {paused?'off':'on'}</button><output id="fixture-result">{message}</output></div><RoomScene room={room} theme={theme} objects={objects} onNavigate={setRoom} onArrange={(id,x,y)=>{setPositions({...positions,[id]:{x,y}});setMessage(`Position ${id}: ${x},${y}`);}} intention={objects.length?{label:'A quiet weekend',objectIds:['fixture-0','fixture-1','fixture-3']}:undefined} paused={paused} illustrated={params.has('illustrated')}/></>;
}
const style=document.createElement('style');style.textContent='html{background:#ece7dd}body{margin:0;padding:18px 18px 40px;font-family:system-ui}.fixture-controls{max-width:1520px;margin:0 auto 12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:11px;color:#514c44}.fixture-controls select,.fixture-controls button{min-height:36px}.fixture-controls output{flex:1;min-width:160px}@media(max-width:719px){body{padding:8px 6px 30px}.fixture-controls{font-size:9px;gap:5px}}';document.head.append(style);
createRoot(document.getElementById('root')!).render(<Fixture/>);
