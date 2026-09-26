import { lazy, Suspense, useEffect, useState } from 'react';
import type { HarbourWorldProps } from './HarbourWorld.tsx';
import { harbourPlaceFor, type HarbourPlaceId } from './flag.ts';
import { readQualityInput, qualityTier } from './scene/quality.ts';
import { MOTION_KEY } from './nav/motionEdition.ts';
import { usePublishEditionAvailability, type EditionAvailability } from './nav/editionAvailability.ts';
import { useHarbourReading } from './data/useHarbourReading.ts';
import { useAppearance } from '../theme/ThemeProvider.tsx';
import { useComfort } from '../theme/comfort.ts';
import { DeskShell } from './desk/DeskShell.tsx';
import { DeskPlace } from './desk/DeskPlace.tsx';
import { HarbourFlat } from './flat/PlaceFlat.tsx';
import { VILLAGE_ADDRESS } from './village/layout.ts';
import { useIslandBar } from './nav/Compass.tsx';
import { GlassBar } from './bubbles/GlassChrome.tsx';
import { HostPanel } from './panels/HostPanel.tsx';
import './village/village.css';

/** The reading entry stays independent of the illustrated terrain chunk. */
function flatReason(): EditionAvailability['reason'] {
  try {
    const input = readQualityInput(window, window.innerWidth);
    return !input.webgl ? 'no-webgl' : input.saveData ? 'save-data' : null;
  } catch { return 'no-webgl'; }
}

function flatRequested(): boolean {
  try { return qualityTier(readQualityInput(window, window.innerWidth)) === 'flat'; }
  catch { return true; }
}

function ReadingHarbour(props: HarbourWorldProps & { failed?: boolean }) {
  const { household, memberId, today, route, interpretationGate, onOpen, onQuickSheet } = props;
  const place = harbourPlaceFor(route, props.scope, true) ?? 'court';
  const toolOpen = Boolean(route.surface && route.surface !== 'queen');
  const appearance = useAppearance();
  const theme = appearance.preview ?? appearance.saved.theme;
  const [reason] = useState(flatReason);
  const [comfort] = useComfort(household.environment);
  const freshness = interpretationGate?.freshness === 'stale' || interpretationGate?.freshness === 'offline'
    ? interpretationGate.freshness : 'current';
  const { reading } = useHarbourReading({ household, memberId, today, freshness, interpretationGate });
  usePublishEditionAvailability({ flat: true, reason: props.failed ? 'failed' : reason });
  useIslandBar(Boolean(props.fab) && !toolOpen);
  useEffect(() => { props.onWorldReady?.(); }, [props.onWorldReady]);
  const visit = (next: HarbourPlaceId) => {
    const address = VILLAGE_ADDRESS[next];
    if (props.onNavigateLocation) props.onNavigateLocation({ householdId: household.householdId, scope: props.scope, ...address });
    else props.onNavigate(address.room, address.level);
  };
  return <section className={`harbour-world harbour-world--${theme}${toolOpen ? ' has-open-object' : ''}`} data-world-status={props.failed ? 'fallback' : 'flat'} data-world-scope={props.scope} data-harbour-place={place} data-harbour-tier="flat">
    <div className="harbour-world__stage" aria-label={`${place}. Reading edition. Every destination is a button.`}>
      {toolOpen ? <HarbourFlat place={place} reading={reading} status={props.failed ? 'fallback' : 'flat'} theme={theme} /> : <>
        <DeskShell household={household} memberId={memberId} scope={props.scope} today={today} reading={reading} theme={theme} ready={props.ready} interpretationGate={interpretationGate} status={props.failed ? 'fallback' : 'flat'} titleId="house-world-title" onOpen={onOpen} onQuickSheet={onQuickSheet} spaceSlot={props.spaceSlot}
          context={<DeskPlace place={place} reading={reading} onOpen={onOpen} onVisit={visit} onGuide={() => onQuickSheet?.()} />} />
        {/* The flat bar (Tool Atlas brief §3.5, §6): [Island] [Record] [All tools], Record centred —
            the island's three things and nothing else. The Desk's header drops its own flip while this stands. */}
        <GlassBar edition="desk" fab={props.fab} onOpenTools={onQuickSheet} toolsOpen={props.toolsOpen} member={memberId} theme={theme} calm={comfort.quiet} alwaysShowLabels={comfort.labels} />
        {props.panel?.host && <HostPanel key={props.panel.host} host={props.panel.host} reading={reading} extras={props.panel.extras} theme={theme} onClose={props.panel.onClose} onOpen={props.panel.onOpen}
          onRecord={props.panel.onRecord} onMarkPaid={props.panel.onMarkPaid} onTalk={props.panel.onTalk} returnFocusTo={props.panel.returnFocusTo}
          onVisit={props.panel.host !== 'hercules' ? () => { const host = props.panel?.host; if (host && host !== 'hercules') visit(host); props.panel?.onClose(); } : undefined} />}
      </>}
    </div>
  </section>;
}

const IllustratedHarbour = lazy(() => import('./HarbourWorld.tsx').catch(() => ({ default: (props: HarbourWorldProps) => <ReadingHarbour {...props} failed /> })));

export default function HarbourEntry(props: HarbourWorldProps) {
  const [flat, setFlat] = useState(flatRequested);
  useEffect(() => {
    const check = () => setFlat(flatRequested());
    window.addEventListener(MOTION_KEY, check);
    window.addEventListener('resize', check);
    return () => { window.removeEventListener(MOTION_KEY, check); window.removeEventListener('resize', check); };
  }, []);
  return flat ? <ReadingHarbour {...props} /> : <Suspense fallback={<HarbourFlat place={harbourPlaceFor(props.route, props.scope, true) ?? 'court'} reading={null} status="loading" />}><IllustratedHarbour {...props} /></Suspense>;
}
