import type { PlanLens } from "../core/planSystem.ts";

export type StepId = "hello" | "back" | "in" | "prepare" | "protect" | "build" | "everyday" | "together" | "sitdown";
export type StepDef = { id: StepId; title: string; tag?: string; lens?: PlanLens; question: string; personal?: string; why: string; householdOnly?: boolean };

/**
 * The one check-in (F2: the Sitdown and the guided draft, merged). The old
 * words stay (F1): the Sitdown closes the Chapter, and a Chapter is a calendar month (F5).
 *
 * Resume reads the Shared Sitdown session's saved `stage` (0–7). v3 reads that
 * number as its own step index, with the ninth step (the Sitdown closing the
 * Chapter) saved as stage 7 plus the session's `close` checkpoint — see D-275.
 */
export const STEPS: readonly StepDef[] = [
  { id: "hello", title: "Hello", question: "Doing this together, or getting your own thoughts down first?", personal: "Ready to look at your month?", why: "About 10 minutes. Anything you're unsure of can stay “not sure yet”." },
  { id: "back", title: "Looking back", question: "Here's how last month went. Anything worth remembering?", why: "Not a grade. Just what happened, so this month's plan fits real life." },
  { id: "in", title: "Coming in", tag: "Contributions", question: "Here's what each of you is putting in this month. Does this look right?", personal: "Here's what's coming in to you this month. Does this look right?", why: "Money that hasn't arrived yet is an expectation. Hercules won't count it twice. A contribution is marked divided once you both confirm its split; the funds still fill in order." },
  { id: "prepare", title: "Prepare", tag: "Has to leave", lens: "prepare", question: "These have to be paid. Are they all here?", why: "Bills, subscriptions and now-and-then costs." },
  { id: "protect", title: "Protect top-up", tag: "Our backup", lens: "protect", question: "Does our cushion need a top-up this month?", personal: "Does your cushion need a top-up this month?", why: "Protect is the backup. The custodian proposes a refill; the partner confirms." },
  { id: "build", title: "Build", tag: "We want it to leave", lens: "build", question: "What are we growing this month?", personal: "What are you growing this month?", why: "Goals and investments we choose to fund." },
  { id: "everyday", title: "Everyday", tag: "Now", lens: "everyday", question: "Here's what's left for groceries, gas and fun. Does that feel livable?", why: "The Queen's Now: money already here, less what's set aside." },
  { id: "together", title: "Read it together", question: "Here's the month on one page. Ready to agree?", personal: "Here's your month on one page. Keep it as your plan?", why: "Each of you agrees for yourself. Nothing moves money." },
  { id: "sitdown", title: "Sitdown", tag: "Close the Chapter", question: "Close this Chapter and open the next?", why: "The Sitdown closes the month's Chapter. The island keeps it.", householdOnly: true },
];

/** The saved Sitdown stage for a step (0–7); the Sitdown step shares stage 7 with Read it together. */
export function stageForStep(index: number): number {
  return Math.max(0, Math.min(7, index));
}
