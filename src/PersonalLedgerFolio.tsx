import { formatCad, type PersonalLedgerStory as PersonalLedgerStoryModel } from "./core/index.ts";

export type PersonalFolioPanel = "all" | "mine" | "position" | "movement";

export function PersonalLedgerFolio({
  story,
  onOpenBooks,
  onOpenFund,
  panel = "all",
}: {
  story: PersonalLedgerStoryModel;
  onOpenBooks: () => void;
  onOpenFund: () => void;
  panel?: PersonalFolioPanel;
}) {
  const showMine = panel === "all" || panel === "mine";
  const showPosition = panel === "all" || panel === "position";
  const showMovement = panel === "all" || panel === "movement";
  return (
    <section className="ledger-story-room ledger-folio-room" aria-label="Personal folio" data-ledger-story="personal" data-story-panel={panel}>
      {showMine ? (
        <article className="ledger-story-sheet ledger-folio-opening">
          <p className="ledger-purpose-kicker">Mine</p>
          <h3>{story.headline}</h3>
          <p>{story.body}</p>
          <p className="fund-disclosure">{story.privacySeal}</p>
        </article>
      ) : null}

      {showPosition ? (
        <article className="ledger-story-sheet" aria-label="My accounts">
          <p className="ledger-purpose-kicker">Position</p>
          <h3>My accounts</h3>
          {story.position.length === 0 ? (
            <p className="muted">No Personal accounts in this envelope yet.</p>
          ) : (
            <ul className="ledger-folio-list">
              {story.position.map((account) => (
                <li key={account.accountId}>
                  <button type="button" className="ledger-action-item" onClick={onOpenBooks}>
                    <strong>{account.name}</strong>
                    <span className="muted">{account.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      ) : null}

      {showMovement ? (
        <article className="ledger-story-sheet" aria-label="My movement">
          <p className="ledger-purpose-kicker">Movement</p>
          <h3>What came in or went out</h3>
          {story.activity.length === 0 ? (
            <p className="muted">No Personal or both activity yet.</p>
          ) : (
            <ul className="ledger-folio-list">
              {story.activity.map((row) => (
                <li key={row.id}>
                  <span>{row.date} · {row.note}</span>
                  <strong>{formatCad(row.amountCents)}</strong>
                  <span className="muted">{row.visibility === "both" ? "Shared as both" : "Personal"}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      ) : null}

      {showMovement ? (
        <article className="ledger-story-sheet" aria-label="My obligations and goals">
          <p className="ledger-purpose-kicker">Obligations</p>
          <h3>What is mine to finish</h3>
          {story.obligations.length === 0 ? (
            <p className="muted">No private goals or Personal standing items yet.</p>
          ) : (
            <ul className="ledger-folio-list">
              {story.obligations.map((row) => (
                <li key={row.id}>
                  <span>{row.name}</span>
                  <strong>{formatCad(row.amountCents)}</strong>
                </li>
              ))}
            </ul>
          )}
        </article>
      ) : null}

      {showMine ? (
        <article className="ledger-story-sheet" aria-label="My contribution to the household">
          <p className="ledger-purpose-kicker">Shared choices</p>
          <h3>My contribution to the household</h3>
          <p className="muted">{story.sharedChoicesCount} posted row{story.sharedChoicesCount === 1 ? "" : "s"} marked both.</p>
          {story.contributionBridge.length === 0 ? (
            <p className="muted">No Fund contribution from this member yet.</p>
          ) : (
            <ul className="ledger-folio-list">
              {story.contributionBridge.map((row) => (
                <li key={row.eventId}>
                  <span>{row.date} · {row.status}</span>
                  <strong>{formatCad(row.amountCents)}</strong>
                </li>
              ))}
            </ul>
          )}
          {story.privateReconciliationAvailable ? (
            <button type="button" className="ghost" onClick={onOpenFund}>Open private Fund reconciliation</button>
          ) : (
            <button type="button" className="ghost" onClick={onOpenBooks}>Open my books</button>
          )}
        </article>
      ) : null}
    </section>
  );
}
