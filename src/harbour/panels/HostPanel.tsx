import type { ThemeId } from "../../theme/scenes.ts";
import type { HarbourReading } from "../data/reading.ts";
import { CompactPanel } from "./CompactPanel.tsx";
import { MINE_FUND_WORDS } from "../mine/mineLayer.ts";
import { useHerculesSuggestion } from "../nav/barBadges.ts";
import { Pawprint } from "../court/CourtTwins.tsx";
import {
  PANEL_TITLES, atlasPanel, boathousePanel, campfirePanel, cellarPanel, cottagePanel, fundBankPanel, glasshousePanel, kitchenPanel, libraryPanel, loftPanel,
  type PanelExtras, type PanelHost,
} from "./panelModel.ts";

/**
 * One compact panel per host on the map (brief §3.2's right-hand column).
 * Props in, callbacks out: the integrator feeds `reading` (`useHarbourReading`)
 * and `extras`, and routes each callback to an existing door or flow.
 *
 * Doors (`PANEL_DOORS`) are the house targets `openHouseObject` already knows,
 * except `campfire`, which the integrator routes to the Campfire ritual.
 * "Mark paid" hands a recurrence to `onMarkPaid`; the integrator opens the
 * existing Bill paid confirm (`postOneRecurrence` at its named Confirm). The
 * panel itself never posts.
 */
export const PANEL_DOORS: Readonly<Record<Exclude<PanelHost, "hercules">, { target: string; words: string }>> = Object.freeze({
  // K1: the bank's open state is the Fund (Books › the Fund: balance, Needs you, To settle, The Level).
  bank: { target: "fund", words: "Open the bank" },
  cellar: { target: "cellar-bills", words: "Open the Cellar" },
  tower: { target: "loft-banks", words: "Open the banks" },
  kitchen: { target: "plan-studio", words: "Open the table" },
  library: { target: "books", words: "Open the books" },
  glasshouse: { target: "planner", words: "Open the steps" },
  campfire: { target: "campfire", words: "Open the Campfire" },
  boathouse: { target: "wishes", words: "Open the Boathouse" },
  atlas: { target: "journey", words: "Open the Atlas" },
  cottage: { target: "wardrobe", words: "Visit" },
});

export type HostPanelProps = {
  host: PanelHost;
  reading: HarbourReading | null;
  extras?: PanelExtras;
  onClose: () => void;
  /** An existing house door: `openHouseObject(target, object?)`. */
  onOpen: (target: string, object?: string) => void;
  /** The Fund bank's Record: opens the Record dial (or Purchase) — never posts. */
  onRecord?: () => void;
  /** Cellar: the integrator opens the Bill paid confirm for this recurrence. */
  onMarkPaid?: (recurrenceId: string) => void;
  /** Step in to this host's place in the world. */
  onStepIn?: (host: PanelHost) => void;
  stepInReason?: string | null;
  /** Hercules's bubble. */
  onTalk?: () => void;
  onVisit?: () => void;
  returnFocusTo?: HTMLElement | null;
  theme?: ThemeId;
};

function Door({ host, onOpen }: { host: Exclude<PanelHost, "hercules">; onOpen: (target: string) => void }) {
  const door = PANEL_DOORS[host];
  return <button type="button" className="compact-panel__door" data-panel-door={door.target} onClick={() => onOpen(door.target)}>{door.words}</button>;
}

export function HostPanel(props: HostPanelProps) {
  const { host, reading, extras = {}, onOpen } = props;
  const suggestion = useHerculesSuggestion();
  const stepIn = props.onStepIn ? () => props.onStepIn?.(host) : undefined;
  const shell = { host, title: PANEL_TITLES[host], onClose: props.onClose, onStepIn: stepIn, stepInReason: props.stepInReason, returnFocusTo: props.returnFocusTo, theme: props.theme };

  switch (host) {
    case "bank": {
      const fund = fundBankPanel(reading, extras);
      return (
        <CompactPanel {...shell} subtitle={`${extras.space === "mine" ? `${MINE_FUND_WORDS} · ` : ""}Everyday · now ${fund.everyday}`} actions={<>
          {props.onRecord && <button type="button" className="compact-panel__primary" data-panel-record="" onClick={props.onRecord}>Record</button>}
          <Door host="bank" onOpen={onOpen} />
        </>}>
          <p className="compact-panel__figure"><span>Accepted balance</span> <strong>{fund.accepted}</strong>{fund.asOf && <small> as of {fund.asOf}</small>}</p>
          {fund.moves.length > 0
            ? <ul className="compact-panel__rows" aria-label="The last three moves">{fund.moves.map((move) => <li key={move.key}><span>{move.label}</span><span className="compact-panel__amount">{move.amount}</span><small>{move.date}</small></li>)}</ul>
            : <p className="compact-panel__empty">No moves yet this month</p>}
        </CompactPanel>
      );
    }
    case "cellar": {
      const cellar = cellarPanel(reading, extras);
      return (
        <CompactPanel {...shell} subtitle={cellar.total === 0 ? "Nothing leaving" : `${cellar.total} ${cellar.total === 1 ? "bill" : "bills"} still to leave`} actions={<Door host="cellar" onOpen={onOpen} />}>
          {cellar.bills.length > 0
            ? <ul className="compact-panel__rows" aria-label="The next three bills">{cellar.bills.map((bill) => {
              const can = Boolean(bill.recurrenceId && props.onMarkPaid);
              const reason = `${bill.key}-reason`;
              return <li key={bill.key}>
                <span>{bill.label}</span><span className="compact-panel__amount">{bill.amount}</span><small>{bill.due}</small>
                <button type="button" className="compact-panel__mark" data-panel-mark-paid={bill.recurrenceId ?? ""}
                  aria-label={`Mark paid: ${bill.label}, ${bill.amount}`}
                  aria-disabled={can ? undefined : true} aria-describedby={can ? undefined : reason}
                  onClick={() => { if (can && bill.recurrenceId) props.onMarkPaid?.(bill.recurrenceId); }}>Mark paid</button>
                {!can && <span id={reason} className="compact-panel__reason">Open the Cellar to mark this bill paid</span>}
              </li>;
            })}</ul>
            : <p className="compact-panel__empty">No bill is waiting this month</p>}
        </CompactPanel>
      );
    }
    case "tower": {
      const loft = loftPanel(reading);
      return (
        <CompactPanel {...shell} subtitle="Kitty Banks" actions={<Door host="tower" onOpen={onOpen} />}>
          {loft.banks.length > 0
            ? <ul className="compact-panel__rows" aria-label="Kitty Banks">{loft.banks.map((bank) => <li key={bank.key}>
              <span>{bank.name}</span><span className="compact-panel__amount">{bank.line}</span>
              <span className="compact-panel__meter" role="img" aria-label={`Backed ${bank.step} of 10`}><i style={{ width: `${bank.step * 10}%` }} /></span>
            </li>)}</ul>
            : <p className="compact-panel__empty">No Kitty Bank yet</p>}
          {loft.more > 0 && <p className="compact-panel__more">and {loft.more} more</p>}
        </CompactPanel>
      );
    }
    case "kitchen": {
      const kitchen = kitchenPanel(reading);
      return (
        <CompactPanel {...shell} subtitle="the kitchen table" actions={<Door host="kitchen" onOpen={onOpen} />}>
          <p className="compact-panel__figure"><strong>{kitchen.title}</strong></p>
          <p className="compact-panel__line">{kitchen.line}</p>
        </CompactPanel>
      );
    }
    case "library": {
      const books = libraryPanel(reading, extras);
      return (
        <CompactPanel {...shell} subtitle={books.month ? `Books · ${books.month}` : "Books · this month"} actions={<Door host="library" onOpen={onOpen} />}>
          <dl className="compact-panel__ledger">{books.rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.amount}</dd></div>)}</dl>
          <p className="compact-panel__line">{books.freshness}</p>
        </CompactPanel>
      );
    }
    case "glasshouse": {
      const glass = glasshousePanel(reading);
      return (
        <CompactPanel {...shell} subtitle="steps, week by week" actions={<Door host="glasshouse" onOpen={onOpen} />}>
          <dl className="compact-panel__ledger">{glass.rows.map((row) => <div key={row.state}><dt>{row.state}</dt><dd>{row.count}</dd></div>)}</dl>
          {glass.late > 0 && <p className="compact-panel__line">{glass.late} past {glass.late === 1 ? "its" : "their"} date</p>}
        </CompactPanel>
      );
    }
    case "campfire": {
      const fire = campfirePanel(reading, extras);
      return (
        <CompactPanel {...shell} subtitle="the Chapter" actions={<Door host="campfire" onOpen={onOpen} />}>
          <p className="compact-panel__line" data-panel-campfire-line="">{fire.line}</p>
        </CompactPanel>
      );
    }
    case "boathouse": {
      const shore = boathousePanel(reading);
      return (
        <CompactPanel {...shell} subtitle="wishes, memories and letters" actions={<Door host="boathouse" onOpen={onOpen} />}>
          <p className="compact-panel__line">{shore.line}</p>
        </CompactPanel>
      );
    }
    case "atlas": {
      const atlas = atlasPanel(reading);
      return (
        <CompactPanel {...shell} subtitle="this era" actions={<Door host="atlas" onOpen={onOpen} />}>
          <p className="compact-panel__figure"><strong>{atlas.era}</strong></p>
          <p className="compact-panel__line">{atlas.line}</p>
        </CompactPanel>
      );
    }
    case "cottage": {
      const cottage = cottagePanel(reading);
      return (
        <CompactPanel {...shell} subtitle="his looks and keepsakes" actions={<button type="button" className="compact-panel__door" data-panel-door="wardrobe" onClick={() => (props.onVisit ? props.onVisit() : onOpen("wardrobe"))}>Visit</button>}>
          <p className="compact-panel__line">{cottage.line}</p>
        </CompactPanel>
      );
    }
    case "hercules":
      return (
        <CompactPanel {...shell} noStepIn subtitle="talk with him, or visit his Cottage" actions={<>
          <button type="button" className="compact-panel__primary" data-panel-talk="" onClick={() => (props.onTalk ? props.onTalk() : onOpen("hercules"))}>Talk</button>
          <button type="button" className="compact-panel__door" data-panel-visit="" onClick={() => (props.onVisit ? props.onVisit() : onOpen("wardrobe"))}>Visit</button>
        </>}>
          {suggestion
            ? <p className="compact-panel__line" data-panel-suggestion=""><span className="compact-panel__paw" aria-hidden="true"><Pawprint /></span> He has a suggestion for you. Talk with him to hear it.</p>
            : <p className="compact-panel__line">He is on the island. Talk with him here, or visit his Cottage.</p>}
        </CompactPanel>
      );
  }
}
