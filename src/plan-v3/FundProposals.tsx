import { useState } from "react";
import type { CommitResult, Household } from "../core/index.ts";
import {
  agreeFundDivision, agreeProtectRefill, declineFundDivision, declineProtectRefill, proposeFundDivision, proposeProtectRefill, withdrawFundProposal,
} from "../core/fundModelCommands.ts";
import type { MonthKey } from "../core/calendar.ts";
import { dayWords, moneyWords, type RefillReading, type UndividedContribution } from "./model.ts";

type Run = (fn: (current: Household) => CommitResult) => Promise<{ household?: Household } | null>;
const FUND_NAMES = { prepare: "Prepare", protect: "Protect", build: "Build", everyday: "Everyday" } as const;
const ORDER = ["prepare", "protect", "build", "everyday"] as const;

/**
 * "Not divided yet" (D-272, wired in D-282): one partner proposes Hercules's
 * split, the other confirms it. A record only — nothing moves at the bank, and
 * the words say "agreed" only after the command came back accepted.
 */
export function DivideCard({ row, memberId, busy, run, headingLevel = 2 }: {
  row: UndividedContribution; memberId: string; busy: boolean; run: Run; headingLevel?: 2 | 3;
}) {
  const [said, setSaid] = useState("");
  const H = headingLevel === 2 ? "h2" : "h3";
  const proposal = row.proposal ?? null;
  const mine = proposal?.proposedBy === memberId;
  const iAgreed = Boolean(proposal?.agreedBy.includes(memberId));
  const act = async (fn: (current: Household) => CommitResult, words: string) => { setSaid(""); const saved = await run(fn); if (saved) setSaid(words); };
  const split = row.suggestion;
  return (
    <div className="pv3-divide" role="region" aria-labelledby={`pv3-divide-h-${row.id}`}>
      <p className="pv3-kicker">{row.memberName}'s contribution · {dayWords(row.date)}</p>
      <H id={`pv3-divide-h-${row.id}`} tabIndex={-1}>Divide {moneyWords(row.amountCents)}</H>
      {split ? <>
        <p className="pv3-note">{proposal ? `${mine ? "You" : "Your partner"} suggested:` : "Hercules suggests:"}</p>
        <ul className="pv3-split" aria-label={proposal ? "Suggested split waiting for a yes" : "Suggested split"}>
          {ORDER.filter(key => split[key] > 0).map(key => <li key={key}>{FUND_NAMES[key]} <span>{moneyWords(split[key])}</span></li>)}
        </ul>
        <p className="pv3-note">A shared record of how you see this money. It doesn't change the funds: they still fill Prepare, then Protect, then Build.</p>
      </> : <p className="pv3-note">Not divided yet. Saying yes together marks it divided; the funds still fill Prepare, then Protect, then Build.</p>}
      {!proposal && split && (
        <button type="button" className="pv3-btn" disabled={busy} onClick={() => void act(current => proposeFundDivision(current, { memberId, contributionEventId: row.id, split }), "Suggested. It's marked divided once you both say yes.")}>
          Propose this split<small>{row.waitingOn.length ? `${row.waitingOn.join(" and ")} confirm` : "You both confirm"}</small>
        </button>
      )}
      {proposal && mine && <>
        <p className="pv3-note">Waiting for {row.waitingOn.join(" and ") || "your partner"} to say yes.</p>
        <button type="button" className="pv3-btn pv3-btn--quiet" disabled={busy} onClick={() => void act(current => withdrawFundProposal(current, { memberId, id: proposal.id, revision: proposal.revision, kind: "division" }), "Taken back. It's not divided yet.")}>Take the suggestion back</button>
      </>}
      {proposal && !mine && !iAgreed && (
        <div className="pv3-stepnav">
          <button type="button" className="pv3-btn pv3-btn--quiet" disabled={busy} onClick={() => void act(current => declineFundDivision(current, { memberId, id: proposal.id, revision: proposal.revision }), "Set aside. It stays not divided yet.")}>Not this split</button>
          <button type="button" className="pv3-btn" disabled={busy} onClick={() => void act(current => agreeFundDivision(current, { memberId, id: proposal.id, revision: proposal.revision }), "Marked divided by both of you. The funds still fill Prepare, then Protect, then Build.")}>Yes, divide it this way<small>A record, not a bank move</small></button>
        </div>
      )}
      {said && <p className="pv3-note" role="status">{said}</p>}
    </div>
  );
}

/**
 * Protect refills (D-272, wired in D-282): the Fund's custodian proposes lending
 * part of the buffer to Build or Everyday for the month; the partner confirms.
 * It changes the month's picture only and posts nothing.
 */
export function RefillPanel({ household, memberId, monthKey, refills, busy, run }: {
  household: Household; memberId: string; monthKey: MonthKey; refills: readonly RefillReading[]; busy: boolean; run: Run;
}) {
  const [amount, setAmount] = useState("");
  const [toFund, setToFund] = useState<"build" | "everyday">("everyday");
  const [said, setSaid] = useState("");
  const custodian = household.householdFund?.custodianMemberId ?? null;
  const partnerName = household.members.find(row => row.active && row.id !== custodian)?.name ?? "your partner";
  const act = async (fn: (current: Household) => CommitResult, words: string) => { setSaid(""); const saved = await run(fn); if (saved) { setSaid(words); setAmount(""); } };
  const cents = Math.round(Number(amount) * 100);
  const valid = Number.isFinite(cents) && cents >= 1;
  return (
    <div className="pv3-card pv3-refill" aria-label="Protect refills">
      <p className="pv3-grp">Refills this month</p>
      {refills.length ? refills.map(row => {
        const mine = row.proposedBy === memberId;
        return (
          <div key={row.id} className="pv3-row">
            <div className="pv3-row__grow">
              Lend to {FUND_NAMES[row.toFund]}
              <small>{row.state === "confirmed" ? "Agreed by both of you · a plan, not a bank move" : mine ? `Waiting for ${partnerName} to say yes` : `${row.proposedByName} suggested this`}{row.note ? ` · ${row.note}` : ""}</small>
              {row.state === "proposed" && mine && <button type="button" className="pv3-link" disabled={busy} onClick={() => void act(current => withdrawFundProposal(current, { memberId, id: row.id, revision: row.revision, kind: "refill" }), "Refill taken back.")}>Take it back</button>}
              {row.state === "proposed" && !mine && (
                <span className="pv3-stepnav">
                  <button type="button" className="pv3-btn pv3-btn--quiet" disabled={busy} onClick={() => void act(current => declineProtectRefill(current, { memberId, id: row.id, revision: row.revision }), "Refill set aside.")}>Not now</button>
                  <button type="button" className="pv3-btn" disabled={busy} onClick={() => void act(current => agreeProtectRefill(current, { memberId, id: row.id, revision: row.revision }), "We both agreed the refill.")}>Yes, lend it</button>
                </span>
              )}
            </div>
            <span className="pv3-amt">{moneyWords(row.amountCents)}</span>
          </div>
        );
      }) : <p className="pv3-muted">No refill this month.</p>}
      {custodian === memberId ? (
        <form className="pv3-refill__form" onSubmit={event => { event.preventDefault(); if (valid) void act(current => proposeProtectRefill(current, { memberId, monthKey, toFund, amountCents: cents }), `Suggested. ${partnerName} confirms.`); }}>
          <label className="pv3-field">Lend from Protect<input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="Amount" /></label>
          <label className="pv3-field">To<select value={toFund} onChange={event => setToFund(event.target.value as "build" | "everyday")}><option value="everyday">Everyday</option><option value="build">Build</option></select></label>
          <button type="submit" className="pv3-btn" disabled={busy || !valid}>Suggest a refill<small>{partnerName} confirms</small></button>
        </form>
      ) : <p className="pv3-note">The Fund's custodian suggests a refill; you confirm it.</p>}
      {said && <p className="pv3-note" role="status">{said}</p>}
    </div>
  );
}
