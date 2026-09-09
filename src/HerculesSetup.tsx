import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { acceptedHouseholdOnboarding, adoptExistingOnboardingEvidence, memberNeedsAcceptedOnboardingEvidenceAdoption, nextChapterFor, offerHouseholdOnboarding, type Household, type UndoToken } from './core/index.ts';
import type { KitchenCommand } from './kitchenCommand.ts';
import { useDialog } from './useDialog.ts';
import { OnboardingJourney, type JourneyDestination } from './OnboardingJourney.tsx';
import { OnboardingChat } from './OnboardingChat.tsx';
import { OnboardingCategories } from './OnboardingCategories.tsx';
import { OnboardingEstimates } from './OnboardingEstimates.tsx';
import { OnboardingPlan } from './OnboardingPlan.tsx';
import { OnboardingReady } from './OnboardingReady.tsx';
import { AddAccountForm } from './Accounts.tsx';
import { AccountHistorySetup } from './AccountHistorySetup.tsx';
import { Charter } from './Charter.tsx';
import { CharterFounding } from './CharterFounding.tsx';
import './hercules-setup.css';

export type HerculesSetupProps = {
  household:Household; memberId:string; authUserId:string; today:string; busy:boolean;
  onCommand:KitchenCommand; onSave:(household:Household,undo?:UndoToken)=>void;
  onOptional:(destination:JourneyDestination)=>void;
};
export function HerculesSetup({open,onClose,onHelp,onPlay,...props}: HerculesSetupProps & {open:boolean;onClose:()=>void;onHelp:()=>void;onPlay:()=>void}) {
  const {household,memberId,authUserId,today,busy,onCommand,onSave,onOptional}=props;
  const [destination,setDestination]=useState<JourneyDestination | null>(null);
  const [visited,setVisited]=useState<JourneyDestination[]>([]);
  const [error,setError]=useState('');
  const attempt=useRef('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{if(!open)attempt.current='';},[open]);
  const root=useDialog(open,()=>destination ? setDestination(null) : onClose(),()=>document.querySelector<HTMLElement>(".hercules-pill,.hercules-live"));
  const title=useRef<HTMLHeadingElement>(null);
  const previousOpen=useRef(false);
  useEffect(()=>{if(open && !previousOpen.current) title.current?.focus();previousOpen.current=open;},[open]);
  useEffect(()=>{if(open) title.current?.focus();},[destination,open]);
  useEffect(()=>{
    if(!open || busy) return;
    const state=acceptedHouseholdOnboarding(household);
    const offer=!state || state.state==='inactive';
    const adopt=!offer && memberNeedsAcceptedOnboardingEvidenceAdoption(household,memberId);
    const key=`${household.environment}:${household.householdId}:${memberId}:${offer?'offer':'adopt'}:${household.revision}`;
    if((!offer&&!adopt)||attempt.current===key) return;
    attempt.current=key;
    let live=true;
    void Promise.resolve(onCommand(current=>offer ? offerHouseholdOnboarding(current,{memberId}) : adoptExistingOnboardingEvidence(current,{memberId,createdBy:memberId})))
      .then(result=>{if(live && (!result || !result.ok))setError(result && !result.ok ? result.userMessage ?? 'Setup needs review.' : 'Setup is waiting for acceptance. Reconnect and retry.');}).catch(e=>{if(live)setError(String(e));});
    return ()=>{live=false;};
  },[open,busy,household,memberId,onCommand,retry]);
  function go(next:JourneyDestination) {
    if(['fund','bills','work','personal','boards','hercules'].includes(next)){onClose();onOptional(next);return;}
    setVisited(items=>items.includes(next)?items:[...items,next]);setDestination(next);
  }
  const commit=(fn:Parameters<KitchenCommand>[0])=>{void onCommand(fn);};
  const chapter=nextChapterFor(household,memberId)?.id;
  return createPortal(<div className="hercules-setup-backdrop" hidden={!open} ref={root}>
    <section className="hercules-setup" role="dialog" aria-modal="true" aria-labelledby="hercules-setup-title">
      <header className="hercules-setup-toolbar">
        {destination && <button type="button" className="ghost" onClick={()=>setDestination(null)}>Back to journey</button>}
        <h2 ref={title} tabIndex={-1} id="hercules-setup-title">Hercules · setting up together</h2>
        <button type="button" className="ghost" onClick={onClose}>Close</button>
      </header>
      <div className="hercules-setup-body">
        {error && <div role="alert">{error}<button type="button" onClick={()=>{attempt.current="";setError("");setRetry(n=>n+1);}}>Retry setup</button></div>}
        <div hidden={destination!==null}>
          <div className="hercules-setup-options"><button type="button" className="ghost" onClick={onHelp}>Ask Hercules</button><button type="button" className="ghost" onClick={onPlay}>Play</button></div>
          <div className="hercules-setup-overview"><OnboardingJourney household={household} memberId={memberId} onGo={go} />
          <OnboardingChat embedded household={household} memberId={memberId} today={today} busy={busy} onCommit={commit} onDismiss={onClose}
            onOpenCharter={()=>go('people')} onOpenAccounts={()=>go('books')} onOpenOpeningBalances={()=>go('books')}
            onOpenCategories={()=>go('plan')} onOpenEstimates={()=>go('plan')} onOpenPlan={()=>go('plan')} onOpenReady={()=>go('ready')}
            onOpenHouseholdFund={()=>go('fund')} onOpenRecurrences={()=>go('bills')} onOpenEarningCadence={()=>go('work')} /></div>
        </div>
        {destination==='people' && (household.charter ? <Charter embedded household={household} memberId={memberId} busy={busy} onCommit={commit} onDismiss={()=>setDestination(null)} />
          : <CharterFounding embedded household={household} memberId={memberId} today={today} busy={busy} onCommit={commit} onDismiss={()=>setDestination(null)} />)}
        {visited.includes('books') && <div hidden={destination!=='books'}>
          <h3>Starting books</h3><p>Identify your Shared accounts, then confirm each opening balance or review a statement.</p>
          <AddAccountForm household={household} writeHousehold={household} memberId={memberId} onSave={onSave} />
          <AccountHistorySetup active={open && destination==='books'} household={household} memberId={memberId} authUserId={authUserId} view="household" today={today} busy={busy} onCommand={onCommand} />
          <button type="button" onClick={()=>setDestination(null)}>Review accepted accounts and balances with Hercules</button>
        </div>}
        {visited.includes('plan') && <div hidden={destination!=='plan'}>
          <h3>Our first plan</h3>
          {chapter==='ch-09-categories' ? <OnboardingCategories household={household} memberId={memberId} authUserId={authUserId} busy={busy} onCommit={commit} />
            : chapter==='ch-10-estimates' ? <OnboardingEstimates household={household} memberId={memberId} authUserId={authUserId} busy={busy} onCommit={commit} />
            : <OnboardingPlan household={household} memberId={memberId} today={today} busy={busy} onCommit={async fn=>await onCommand(fn) ?? null} />}
        </div>}
        {(visited.includes('practice')||visited.includes('ready')) && <div hidden={destination!=='practice'&&destination!=='ready'}>
          <OnboardingReady household={household} memberId={memberId} today={today} busy={busy} onCommit={async fn=>await onCommand(fn) ?? null} onDismiss={()=>setDestination(null)} />
        </div>}
      </div>
    </section>
  </div>,document.body);
}
