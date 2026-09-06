import { acceptedHouseholdOnboarding } from "./core/index.ts";
import {
  MonthRehearsalPanel,
  type MonthRehearsalPanelProps,
} from "./MonthRehearsalPanel.tsx";

/** One deliberate gate shared by Home and More. */
export function MonthRehearsalAccess(props: MonthRehearsalPanelProps) {
  if (acceptedHouseholdOnboarding(props.household)?.state !== "complete") {
    return (
      <section className="card" aria-labelledby={`rehearsal-locked-title-${props.surface ?? "home"}`}>
        <header><h2 id={`rehearsal-locked-title-${props.surface ?? "home"}`}>Four-week household rehearsal</h2></header>
        <p className="muted">
          This is a later Development reliability exercise, not household setup. It becomes available after both people finish guided setup.
        </p>
      </section>
    );
  }
  return <MonthRehearsalPanel {...props} />;
}
