import { createElement, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {SpecimenDesign} from './specimenDesign.tsx';
import Hearthside from './Hearthside.tsx';
import { hearthsideFixture, type HearthsideFixture } from '../../test/fixtures/hearthside.ts';
import { ThemeProvider, useSceneBinding } from '../theme/ThemeProvider.tsx';
import { AppearanceStore } from '../theme/appearanceStore.ts';
import { appearanceAccount } from '../theme/appearanceAccount.ts';
import type { ThemeId } from '../theme/scenes.ts';
import type { KitchenCommand } from '../kitchenCommand.ts';
import type { CommandOutcome } from '../core/index.ts';
import { HouseholdTogether } from '../HouseholdLife.tsx';
import HerculesPlay from '../play/HerculesPlay.tsx';
import '../styles.css';
import '../hearth-theme.css';
import '../theme/worlds.css';
import '../theme/whisper.css';
import './specimen.css';

/** This entry is served only by Vite Development. It cannot connect to a household. */
if (!import.meta.env.DEV) throw Error('Synthetic studio is Development-only.');
const appearance = new AppearanceStore(appearanceAccount,null,()=>false);
function Specimen() {
  const [kind,setKind]=useState<HearthsideFixture>('free'),[household,setHousehold]=useState(()=>hearthsideFixture('free'));
  const [memberId,setMember]=useState('MEM-001'),[connected,setConnected]=useState(true),[lose,setLose]=useState(false),[message,setMessage]=useState('');
  const live=useRef(household);live.current=household;
  const receipts=useRef(new Map<string,CommandOutcome>());
  useSceneBinding('more','household',false);
  const onCommand:KitchenCommand=async(fn,options)=>{
    if(!connected)return null;
    const id=options?.confirmationId??crypto.randomUUID(),old=receipts.current.get(id);
    if(old){options?.onRecoveredConfirmation?.();return old;}
    const previous=live.current,result=fn(previous),next=result.household;
    live.current=next;setHousehold(next);
    const outcome:CommandOutcome={kind:'synchronized',ok:true,household:next,previous,postedIds:result.postedIds,confirmationId:id,identityHash:null,revision:next.revision,sharingMode:'synchronized',errorClass:null,userMessage:null,retryable:false,postedExactlyOnce:true,postedNothing:false,recoveryAvailable:false};
    receipts.current.set(id,outcome);
    if(lose){setLose(false);return null;}return outcome;
  };
  function fixture(next:HearthsideFixture){setKind(next);const h=hearthsideFixture(next);live.current=h;setHousehold(h);receipts.current.clear();history.replaceState(null,'',`/hearthside-specimen.html`);}
  return <><aside className="hearthside-specimen-toolbar" aria-label="Synthetic studio controls"><strong>Development · fictional household</strong><label>World<select aria-label="World" defaultValue="classic" onChange={e=>appearance.preview(e.target.value as ThemeId)}><option value="classic">Classic Hearth</option><option value="taylor">Taylor’s Scrapbook</option><option value="newfoundland">Newfoundland</option></select></label><label>Journey<select aria-label="Journey" value={kind} onChange={e=>fixture(e.target.value as HearthsideFixture)}>{['empty','paid','free','interrupted','difficult-month','dense'].map(k=><option key={k}>{k}</option>)}</select></label><label>Acting as<select aria-label="Acting as" value={memberId} onChange={e=>setMember(e.target.value)}><option value="MEM-001">Alex</option><option value="MEM-002">Sam</option></select></label><label><input type="checkbox" checked={connected} onChange={e=>setConnected(e.target.checked)}/>Connected</label><label><input type="checkbox" checked={lose} onChange={e=>setLose(e.target.checked)}/>Lose next acknowledgement</label><p>No account, hosted writes or authenticated-device proof. {message}</p></aside><SpecimenDesign household={household} memberId={memberId} onHousehold={h=>{live.current=h;setHousehold(h);}}><Hearthside household={household} memberId={memberId} identity={`specimen:${household.householdId}:${memberId}`} connected={connected} onCommand={onCommand} onReadSubmission={async id=>receipts.current.has(id)?'accepted':'missing'} onReference={r=>setMessage(`Selected ${r.kind}: ${r.id}`)} practical={<HouseholdTogether embedded household={household} memberId={memberId} today="2026-09-12" busy={false} onCommand={onCommand} onOpenPlan={()=>setMessage('Plan selected in this synthetic storyboard.')}/>} studio={<HerculesPlay embedded household={household} memberId={memberId} connected={connected} onCommand={onCommand} onTogether={()=>setMessage('Common room selected.')} onGoal={()=>setMessage('Bank selected.')} initialArea="dressing"/>}/></SpecimenDesign></>;
}
createRoot(document.getElementById('root')!).render(createElement(ThemeProvider,{store:appearance,children:createElement(Specimen)}));
