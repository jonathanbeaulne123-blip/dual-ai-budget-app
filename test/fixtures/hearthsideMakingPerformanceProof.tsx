import {createRoot} from 'react-dom/client';
import {StrictMode,useState} from 'react';
import {SpecimenDesign} from '../../src/hearthside/specimenDesign.tsx';
import {CollaborativeStudio} from '../../src/hearthside/CollaborativeStudio.tsx';
import {RoomScene} from '../../src/hearthside/RoomScene.tsx';
import {hearthsideFixture} from './hearthside.ts';
import '../../src/kitty/kitty-room.css';
import '../../src/kitty/studio/studio.css';
function Proof(){
 const [household,setHousehold]=useState(()=>hearthsideFixture('free')),[open,setOpen]=useState(false),[selected,setSelected]=useState<string|undefined>();
 return <main><p>Local synthetic rendering fixture · no network authority or device certification.</p><button onClick={()=>{if(!open)setSelected(household.hearthside?.designs[0]?.designId);setOpen(value=>!value);}}>{open?'Return to room':'Enter making table'}</button><SpecimenDesign household={household} memberId="MEM-001" onHousehold={setHousehold}>{open?<CollaborativeStudio household={household} memberId="MEM-001" initialDesignId={selected} writesEnabled/>:<RoomScene room="studio" theme="classic" objects={[]} onNavigate={()=>{}}/>}</SpecimenDesign></main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Proof/></StrictMode>);
