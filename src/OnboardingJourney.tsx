import { useState } from "react";
import {
  copy, acceptedHouseholdOnboarding, memberRequirementSatisfied, requiredHouseholdChapters,
  type ChapterId, type Household,
} from "./core/index.ts";
import "./onboarding-journey.css";

export type JourneyDestination = "people" | "books" | "plan" | "practice" | "ready" | "fund" | "bills" | "work" | "personal" | "boards" | "hercules" | "king";
const stages: { title: string; destination: JourneyDestination; requirements: ChapterId[]; description: string }[] = [
  { title: "People and agreement", destination: "people", requirements: ["ch-01-meet", "ch-02-household", "ch-03-charter"], description: "Our identities, household and agreement." },
  { title: "Build your King", destination: "king", requirements: ["ch-13-king"], description: "Name, shape, paint and fire your own King. Optional: save your clay and return whenever you like." },
  { title: "Starting books", destination: "books", requirements: ["ch-04-accounts", "ch-05-opening"], description: "Accounts and truthful opening balances." },
  { title: "Our first plan", destination: "plan", requirements: ["ch-09-categories", "ch-10-estimates", "ch-11-plan"], description: "Choose categories, review amounts and agree together." },
  { title: "Using Hearth day to day", destination: "practice", requirements: ["ch-12-ready"], description: "Practise an expense and its correction in discarded Practice." },
  { title: "Ready together", destination: "ready", requirements: [], description: "Review accepted facts and independently approve." },
];

export function OnboardingPreparation() {
  return <section className="journey-preparation" aria-label="Before we begin">
    <h3>A little preparation</h3>
    <ul>
      <li>{copy("journey.guidance.1")}</li>
      <li>{copy("journey.guidance.2")}</li>
      <li>{copy("journey.guidance.3")}</li>
    </ul>
    <p>{copy("journey.preparation-length", { count: String(requiredHouseholdChapters().length) })}</p>
  </section>;
}

export function OnboardingJourney({ household, memberId, onGo }: {
  household: Household; memberId: string; onGo: (destination: JourneyDestination) => void;
}) {
  const state = acceptedHouseholdOnboarding(household);
  const members = household.members.filter(member => member.active);
  const finished = state?.state === "complete";
  const satisfied = (id: string, requirements: ChapterId[]) => requirements.every(requirement => requirement === "ch-13-king" ? Boolean(household.kittyNestDesigns?.some(row => row.visibility === "household" && row.bankKey === "king" && row.setupCompletedAt)) : memberRequirementSatisfied(household, id, requirement));
  const current = stages.findIndex(stage => stage.destination === "king" ? false : stage.requirements.length ? !satisfied(memberId, stage.requirements) : !finished);
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
      <p>{copy("journey.guidance.4")}</p>
      <p>{copy("journey.guidance.5")}</p>
    </details>
    <JourneyInterests key={`${household.environment}:${household.householdId}:${memberId}`} />
    <details className="journey-guidance"><summary>Learn more when you want</summary>
      <p>{copy("journey.guidance.6")}</p>
      <ul className="journey-followups">
        {([['fund', 'Fund setup'], ['bills', 'Bills in Calendar'], ['work', 'Shifts and tips'], ['personal', 'Personal books and planning'], ['boards', 'Try the To-do board'], ['hercules', 'Meet Hercules']] as const).map(([destination, title]) => <li key={destination}><button type="button" onClick={() => onGo(destination)}>{title}<span>Optional · continue learning</span></button></li>)}
      </ul>
      <p>{copy("journey.guidance.7")}</p>
      <p>{copy("journey.guidance.8")}</p>
    </details>
  </aside>;
}

// Optional interests guide this sitting; they are never Shared evidence or approval.
function JourneyInterests() {
  const [interests, setInterests] = useState<string[]>([]);
  return <details className="journey-guidance"><summary>{copy("journey.guidance.9")}</summary><p>{copy("journey.guidance.10")}</p>
    <div className="journey-interests">{["Spending", "Bills", "Work", "Household routines"].map(interest => <label key={interest}><input type="checkbox" checked={interests.includes(interest)} onChange={event => setInterests(current => event.target.checked ? [...current, interest] : current.filter(value => value !== interest))} />{interest}</label>)}</div>
  </details>;
}
