import { formatCad, type SharedLedgerStory as SharedLedgerStoryModel } from "./core/index.ts";

export type SharedStoryPanel = "all" | "now" | "attention" | "change";

export function SharedLedgerStory({
  story,
  onOpenFund,
  onOpenHealth,
  panel = "all",
}: {
  story: SharedLedgerStoryModel;
  onOpenFund: () => void;
  onOpenHealth: () => void;
  panel?: SharedStoryPanel;
}) {
  const showNow = panel === "all" || panel === "now";
  const showAttention = panel === "all" || panel === "attention";
  const showChange = panel === "all" || panel === "change";
  const opening = story.opening;
  const recon = opening.lastReconciledAt
    ? opening.reconciliationTied
      ? "tied"
      : "needs review"
    : "not yet recorded";
  return (
    <section className="ledger-story-room" aria-label="Shared household story" data-ledger-story="shared" data-story-panel={panel}>
      {showNow ? (
        <article className="ledger-story-sheet ledger-story-opening">
          <p className="ledger-purpose-kicker">Now</p>
          <h3>{opening.headline}</h3>
          <p>{opening.body}</p>
          <div className="ledger-story-stats" aria-label="Together right now">
            <div className="stat"><span>Operating</span><strong>{formatCad(opening.operatingBalanceCents)}</strong></div>
            <div className="stat"><span>Transfer due</span><strong>{formatCad(opening.transferDueCents)}</strong></div>
            <div className="stat"><span>Upcoming reserve</span><strong>{formatCad(opening.upcomingReserveCents)}</strong></div>
            <div className="stat">
              <span>{opening.topUpNeededCents ? "Top-up needed" : "Fund free-to-spend"}</span>
              <strong className={opening.topUpNeededCents ? "negative" : ""}>
                {formatCad(opening.topUpNeededCents || opening.freeToSpendCents)}
              </strong>
            </div>
            <div className="stat"><span>Monthly target</span><strong>{formatCad(opening.targetProgressCents)} / {formatCad(opening.monthlyTargetCents)}</strong></div>
            <div className="stat"><span>Reconciliation</span><strong>{recon}</strong></div>
          </div>
        </article>
      ) : null}

      {showNow ? (
        <article className="ledger-story-sheet ledger-story-flow" aria-label="How the shared pool moves">
          <p className="ledger-purpose-kicker">Flow</p>
          <h3>How the shared pool moves</h3>
          <ol className="ledger-flow-list">
            {story.flow.nodes.map((node) => (
              <li key={node.id} className={`ledger-flow-node is-${node.state}${node.empty ? " is-empty" : ""}`}>
                <span className="ledger-flow-label">{node.label}</span>
                <strong>{formatCad(node.cents)}</strong>
                <span className="muted">{node.empty ? "None yet" : node.source}</span>
                {node.state === "deficit" ? <span>Shortfall — needs a top-up, not extra to spend.</span> : null}
              </li>
            ))}
          </ol>
          <p className="muted">Connectors are arithmetic direction. They do not move money between banks. Operating plus Kitty {formatCad(story.flow.conservationCents)} stays conserved.</p>
        </article>
      ) : null}

      {showAttention ? (
        <article className="ledger-story-sheet ledger-story-queue" aria-label="Who needs to do what">
          <p className="ledger-purpose-kicker">Attention</p>
          <h3>Who needs to do what</h3>
          {story.queue.length === 0 ? (
            <p className="muted">Nothing is waiting on a person right now.</p>
          ) : (
            <ul className="ledger-action-queue">
              {story.queue.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="ledger-action-item"
                    onClick={() => (item.sourceTab === "more" ? onOpenHealth() : onOpenFund())}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.actorLabel}{item.amountCents != null ? ` · ${formatCad(item.amountCents)}` : ""}</span>
                    <span className="muted">{item.reason}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      ) : null}

      {showChange ? (
        <article className="ledger-story-sheet ledger-story-week" aria-label="This week’s household story">
          <p className="ledger-purpose-kicker">Change</p>
          <h3>This week</h3>
          {story.weekly.length === 0 ? (
            <p className="muted">No shared Fund events this week yet.</p>
          ) : (
            <ol className="ledger-week-ribbon">
              {story.weekly.map((event) => (
                <li key={event.id}>
                  <time dateTime={event.date}>{event.date}</time>
                  <span>{event.label}</span>
                  <strong>{event.recordOnly ? "record only" : formatCad(event.amountCents)}</strong>
                  <span className="muted">{[event.actorLabel, event.destinationLabel].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ol>
          )}
        </article>
      ) : null}

      {showChange ? (
        <article className="ledger-story-sheet ledger-story-month" aria-label="This month’s household arc">
          <p className="ledger-purpose-kicker">Next</p>
          <h3>This month</h3>
          <div className="ledger-story-stats">
            <div className="stat"><span>Opening operating</span><strong>{formatCad(story.monthly.openingOperatingCents)}</strong></div>
            <div className="stat"><span>Confirmed contributions</span><strong>{formatCad(story.monthly.confirmedContributionsCents)}</strong></div>
            <div className="stat"><span>Purchases</span><strong>{formatCad(story.monthly.purchasesCents)}</strong></div>
            <div className="stat"><span>Refunds</span><strong>{formatCad(story.monthly.refundsCents)}</strong></div>
            <div className="stat"><span>Clearing</span><strong>{formatCad(story.monthly.settledCents)}</strong></div>
            <div className="stat"><span>Safe rollover</span><strong>{formatCad(story.monthly.safeRolloverCents)}</strong></div>
            <div className="stat"><span>Closing operating</span><strong>{formatCad(story.monthly.closingOperatingCents)}</strong></div>
            <div className="stat"><span>Kitty</span><strong>{formatCad(story.monthly.kittyCents)}</strong></div>
          </div>
        </article>
      ) : null}

      {showNow ? (
        <footer className="ledger-story-sheet ledger-story-trust" aria-label="Why we can trust this view">
          <p className="ledger-purpose-kicker">Trust</p>
          <p className="fund-disclosure">{story.trust.custodyDisclosure}</p>
          <p>
            Shared slice {story.trust.lastReconciledAt ? (story.trust.reconciliationTied ? "tied" : "needs review") : "not yet reconciled"}
            {story.trust.pendingProposalCount ? ` · ${story.trust.pendingProposalCount} proposal${story.trust.pendingProposalCount === 1 ? "" : "s"} waiting` : " · no open proposals"}
            {" · "}{story.trust.environment}
          </p>
          <button type="button" className="ghost" onClick={onOpenFund}>{story.trust.auditLabel}</button>
        </footer>
      ) : null}
    </section>
  );
}
