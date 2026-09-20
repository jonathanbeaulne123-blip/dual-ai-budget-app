import type { DateKey } from "../core/calendar.ts";
import type { Household, LedgerView } from "../core/types.ts";
import type { SoftPresenceDisplay } from "../softPresence.ts";
import type { HouseRoute, HouseRoom, HouseLevel } from "../hearthside/houseRoutes.ts";
import type { InterpretationGate } from "../house/supportedInterpretation.ts";
import { useAppearance } from "../theme/ThemeProvider.tsx";
import { CourtFlat } from "./flat/CourtFlat.tsx";
import "./harbour.css";

/**
 * The Court's React shell (BUILD_PLAN #2). Props are `HouseWorld`'s plus two
 * optional presence props; the App keeps no new state for it.
 *
 * Step 0 shell: the reading edition in the stage and the door strip when a
 * tool is open. Step 7 mounts `scene/runtime.ts`, the twins and the reading.
 */
export type HarbourWorldProps = {
  household: Household;
  memberId: string;
  scope: LedgerView;
  today: DateKey;
  route: HouseRoute;
  ready: boolean;
  freshness: string;
  interpretationGate?: InterpretationGate;
  onNavigate: (room: HouseRoom, level: HouseLevel, replace?: boolean) => void;
  onOpen: (target: string, object?: string) => void;
  onClose: () => void;
  presence?: SoftPresenceDisplay;
  partnerName?: string | null;
};

export default function HarbourWorld({ route, onOpen, onClose, partnerName = null }: HarbourWorldProps) {
  const appearance = useAppearance(), theme = appearance.preview ?? appearance.saved.theme;
  return <section className={`harbour-world harbour-world--${theme}${route.surface ? " has-open-object" : ""}`} data-world-status="loading" data-world-scope="household" aria-label="The Queen's Court">
    <div className="harbour-world__stage">
      <div className="house-world__canvas" aria-hidden="true" />
      {!route.surface && <CourtFlat reading={null} status="loading" theme={theme} partnerName={partnerName} onOpen={onOpen} />}
      {route.surface && <button type="button" className="harbour-world__put-back" onClick={onClose}>← Put it back in the Court</button>}
    </div>
  </section>;
}
