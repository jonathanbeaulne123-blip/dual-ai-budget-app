import { ledgerRouteContract, type LedgerTab, type LedgerView } from "./core/index.ts";

export function LedgerPurposeBanner({
  tab,
  view,
  label,
}: {
  tab: LedgerTab;
  view: LedgerView;
  label: string;
}) {
  const contract = ledgerRouteContract(tab, view);
  return (
    <section className="ledger-purpose-banner" aria-label={contract.heading} data-ledger-mode={view} data-ledger-tab={tab}>
      <p className="ledger-purpose-kicker">{label}</p>
      <h2 className="ledger-purpose-heading">{contract.heading}</h2>
      <p className="ledger-purpose-copy">{contract.purpose}</p>
    </section>
  );
}
