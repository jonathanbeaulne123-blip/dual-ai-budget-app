import { useState } from "react";
import {
  acceptedHouseholdOnboarding, memberRequirementSatisfied, requiredHouseholdChapters,
  type ChapterId, type Household,
} from "./core/index.ts";
import "./onboarding-journey.css";

export type JourneyDestination = "people" | "books" | "plan" | "practice" | "ready" | "fund" | "bills" | "work" | "personal" | "boards" | "hercules";
const stages: { title: string; destination: JourneyDestination; requirements: ChapterId[]; description: string }[] = [
  { title: "People and agreement", destination: "people", requirements: ["ch-01-meet", "ch-02-household", "ch-03-charter"], description: "Our identities, household and agreement." },
  { title: "Starting books", destination: "books", requirements: ["ch-04-accounts", "ch-05-opening"], description: "Accounts and truthful opening balances." },
  { title: "Our first plan", destination: "plan", requirements: ["ch-09-categories", "ch-10-estimates", "ch-11-plan"], description: "Choose categories, review amounts and agree together." },
  { title: "Using Hearth day to day", destination: "practice", requirements: ["ch-12-ready"], description: "Practise an expense and its correction in discarded Practice." },
  { title: "Ready together", destination: "ready", requirements: [], description: "Review accepted facts and independently approve." },
];

export function OnboardingPreparation() {
  return <section className="journey-preparation" aria-label="Before we begin">
    <h3>A little preparation</h3>
    <ul>
      <li>Each person uses their own Google account to join this household.</li>
      <li>Bring balances for your Shared accounts, or PDF, OFX/QFX or image statements.</li>
      <li>You can stop. Accepted checkpoints save your progress; unfinished learning stays unfinished.</li>
    </ul>
    <p>Five stages, {requiredHouseholdChapters().length} required learning checkpoints, then both Ready approvals. Statement review depends on your accounts and any questions in the source; there is no timed deadline.</p>
  </section>;
}

export function OnboardingJourney({ household, memberId, onGo }: {
  household: Household; memberId: string; onGo: (destination: JourneyDestination) => void;
}) {
  const state = acceptedHouseholdOnboarding(household);
  const members = household.members.filter(member => member.active);
  const finished = state?.state === "complete";
  const satisfied = (id: string, requirements: ChapterId[]) => requirements.every(requirement => memberRequirementSatisfied(household, id, requirement));
  const current = stages.findIndex(stage => stage.requirements.length ? !satisfied(memberId, stage.requirements) : !finished);
  return <aside className="onboarding-journey" aria-label="Our setup journey">
    <p className="kicker">Setting up together</p><h2>Make Hearth yours</h2>
    <ol className="journey-stages">
      {stages.map((stage, index) => <li key={stage.destination} aria-current={index === current ? "step" : undefined}>
        <button type="button" onClick={() => onGo(stage.destination)} aria-describedby={`journey-${stage.destination}-description`}>
          <span className="journey-number" aria-hidden="true">{index + 1}</span><strong>{stage.title}</strong>
        </button>
        <p id={`journey-${stage.destination}-description`}>{stage.description}</p>
        <small>{stage.requirements.length ? members.map(member => `${member.name}: ${satisfied(member.id, stage.requirements) ? "accepted" : "unfinished"}`).join(" · ") : finished ? "Both approved" : "Both approvals required"}</small>
      </li>)}
    </ol>
    <details className="journey-guidance"><summary>Preparation and visibility</summary>
      <OnboardingPreparation />
      <h3>Shared and Personal</h3>
      <p>Shared accounts, accepted transactions, the household plan and boards are visible to both members. A Shared grocery expense is part of both people's household books.</p>
      <p>Your Personal accounts, transactions and learning history stay in your Personal scope. A Personal purchase does not become Shared by appearing in a statement. Choose the scope before uploading; An upload draft stays on this device. Sharing a reviewed correction makes its proposed rows and balances visible to your partner before Final Confirm; only Final Confirm posts money.</p>
    </details>
    <JourneyInterests key={`${household.environment}:${household.householdId}:${memberId}`} />
    <details className="journey-guidance"><summary>Learn more when you want</summary>
      <p>Optional introductions can wait. Opening one does not mark its learning complete.</p>
      <ul className="journey-followups">
        {([['fund', 'Fund setup'], ['bills', 'Bills in Calendar'], ['work', 'Shifts and tips'], ['personal', 'Personal books and planning'], ['boards', 'Try the To-do board'], ['hercules', 'Meet Hercules']] as const).map(([destination, title]) => <li key={destination}><button type="button" onClick={() => onGo(destination)}>{title}<span>Optional · continue learning</span></button></li>)}
      </ul>
      <p>Notes hold thoughts; Photos share moments; To-do holds tasks; Goals hold milestones; Shift Ask helps with work planning. Board goals do not move money.</p>
      <p>Hercules explains what you are seeing and can help prepare a draft. You review and confirm financial changes yourself.</p>
    </details>
  </aside>;
}

// Optional interests guide this sitting; they are never Shared evidence or approval.
function JourneyInterests() {
  const [interests, setInterests] = useState<string[]>([]);
  return <details className="journey-guidance"><summary>What would you like help with?</summary><p>Optional. Choose what interests you for this visit.</p>
    <div className="journey-interests">{["Spending", "Bills", "Work", "Household routines"].map(interest => <label key={interest}><input type="checkbox" checked={interests.includes(interest)} onChange={event => setInterests(current => event.target.checked ? [...current, interest] : current.filter(value => value !== interest))} />{interest}</label>)}</div>
  </details>;
}
