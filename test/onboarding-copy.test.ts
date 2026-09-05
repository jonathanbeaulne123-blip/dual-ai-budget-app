import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  copy,
  flavorFor,
  FLAVOR_POOL,
  ONBOARDING_COPY,
  ONBOARDING_REGISTRY,
  type CopyEntry,
} from "../src/core/index.ts";

const copySource = readFileSync(new URL("../src/core/onboarding/copy.ts", import.meta.url), "utf8");
const flavorSource = readFileSync(new URL("../src/core/onboarding/flavor.ts", import.meta.url), "utf8");

// The literal table from ONBOARDING_BUILD_MANUAL.md Appendix E. Every value
// here is byte-exact, including punctuation and the straight apostrophes
// the manual's own committed copy actually uses.
const APPENDIX_E: Record<string, { text: string; announce: CopyEntry["announce"] }> = {
  "invite.offer": { text: "When you're both ready to set up the household together, I can walk us through it.", announce: "none" },
  "invite.explain": { text: "This puts both of us in setup mode until we finish or stop. Three sittings, about an hour all in — we can stop between any of them.", announce: "none" },
  "invite.propose": { text: "Start together", announce: "none" },
  "invite.confirm": { text: "Yes, let's start", announce: "none" },
  "invite.waiting": { text: "Waiting for {name} to say yes on their device.", announce: "polite" },
  "invite.expired": { text: "That invitation expired. Start it again whenever you're both ready.", announce: "polite" },

  "chapter.turn.conductor": { text: "This one's yours.", announce: "none" },
  "chapter.turn.witness": { text: "{name} is doing this one — you don't need to type anything.", announce: "none" },
  "nav.go": { text: "Open {surface}", announce: "none" },
  "nav.return": { text: "Finish here, then open Hercules.", announce: "polite" },
  "probe.already": { text: "Looks like you already handled this.", announce: "none" },
  "notice.completed": { text: "Hercules noticed", announce: "polite" },
  "notice.congratulate": { text: "That's done. Nice.", announce: "none" },
  "continue.next": { text: "Next", announce: "none" },
  "continue.ask": { text: "Ready for the next one?", announce: "none" },
  "sitting.pause": { text: "Good place to stop. We'll pick up right here.", announce: "none" },
  "sitting.two.warning": { text: "This is the long one — bills, balances, the fund. Worth a coffee.", announce: "none" },

  "waiting.partner": { text: "Waiting on {name}. Nothing's lost — it'll pick up when they're in.", announce: "polite" },
  "skip.personal": { text: "Skip this for now", announce: "none" },
  "skip.personal.recorded": { text: "Skipped. I'll leave it on the list, not in the way.", announce: "none" },
  "stop.offer": { text: "Stop setup for now", announce: "none" },
  "stop.explain": { text: "This turns Hercules back on for both of us. Nothing gets marked done — we can pick it up whenever.", announce: "none" },
  "stop.recorded": { text: "Setup stopped. Nothing was marked done — we can pick it up whenever.", announce: "polite" },
  "stop.resume": { text: "We were partway through. Want to carry on where we left off?", announce: "none" },

  "blocked.identity": { text: "I can't see both of you in this household yet.", announce: "assertive" },
  "blocked.membership": { text: "{name} isn't a member of this household yet.", announce: "assertive" },
  "blocked.stale": { text: "Something changed underneath this since it was done. Worth another look.", announce: "polite" },
  "blocked.conflict": { text: "Two versions of this disagree. Let's settle which one is right.", announce: "assertive" },
  "blocked.untied": { text: "These numbers don't tie to the ledger yet. I'd rather show you nothing than show you the wrong thing.", announce: "polite" },
  "blocked.privacy": { text: "I can't use that here.", announce: "polite" },
  "offline.queued": { text: "Saved here. It'll sync when you're back.", announce: "polite" },
  "retry.honest": { text: "That didn't go through. Nothing changed — want to try again?", announce: "polite" },

  "guess.reassure": { text: "It's okay to guess. This is the first shape, not a promise; Hearth will learn from what actually happens.", announce: "none" },
  "categories.solo": { text: "Pick what our money should cover. {name} is picking too — we'll put the lists together after.", announce: "none" },
  "estimates.submit": { text: "Submit my numbers", announce: "none" },
  "runrate.absent": { text: "I've got nothing to go on yet — no month has gone by. This is built from the two of you and the bills we know about.", announce: "none" },
  "proposal.basis.floor": { text: "at least the bills assigned here", announce: "none" },
  "proposal.capacity": { text: "That's {total} against the {capacity} you said we have.", announce: "none" },
  "proposal.edit.warn": { text: "Changing this clears both approvals. We'd each say yes again.", announce: "none" },
  "approve.self": { text: "I approve this", announce: "none" },
  "approve.waiting": { text: "Waiting on {name} to approve the same plan.", announce: "none" },
  "adopt.done": { text: "That's our first month. It's a plan, not a promise.", announce: "none" },

  "ready.checklist": { text: "Here's everything we set up.", announce: "none" },
  "ready.self": { text: "I'm ready", announce: "none" },
  "ready.waiting": { text: "Waiting on {name} to say they're ready.", announce: "none" },
  "unlock.done": { text: "That's it. Hercules is back to normal for both of us.", announce: "none" },
  "unlock.honest": { text: "From here it's the ordinary work — the odd receipt, the odd shift. I'll keep the books, but I can't fill them in for you.", announce: "none" },
  "personal.offer": { text: "Whenever you want, I can show you the rest of what I do. No rush.", announce: "none" },
  "personal.decline": { text: "Not now", announce: "none" },
  "personal.off": { text: "Stop offering these", announce: "none" },
};

const SLICE_11_REPAIR_COPY: Record<string, { text: string; announce: CopyEntry["announce"] }> = {
  "blocked.revoked": { text: "Your household access isn't active right now.", announce: "polite" },
  "blocked.offline": { text: "You're offline, so I can't finish this check yet. Nothing's lost.", announce: "polite" },
  "blocked.scope": { text: "I found more than one household. Open the one you want, then come back here.", announce: "polite" },
  "probe.retry": { text: "Try again", announce: "none" },
  "onboarding.household.ch-02-household": {
    text: "Let me make sure this is the right household for both of you.", announce: "none",
  },
};

const SLICE_12_CHARTER_COPY: Record<string, { text: string; announce: CopyEntry["announce"] }> = {
  "onboarding.household.ch-03-charter": {
    text: "Your Charter puts the household's shared rules in your own words. Write it together, then each sign your own line.", announce: "none",
  },
  "charter.write": { text: "Write the Charter", announce: "none" },
  "charter.open": { text: "Open the Charter", announce: "none" },
  "charter.review-sign": { text: "Review and sign the Charter", announce: "none" },
};

const SLICE_13_ACCOUNTS_COPY: Record<string, { text: string; announce: CopyEntry["announce"] }> = {
  "onboarding.household.ch-04-accounts": {
    text: "Tell me which accounts the household actually uses. Add at least one Shared account and choose one Shared credit card for the Fund.", announce: "none",
  },
  "accounts.open": { text: "Open accounts", announce: "none" },
  "accounts.personal.offer": {
    text: "Want to add your own accounts too? They stay in your Personal books, or you can leave them for later.", announce: "none",
  },
  "accounts.personal.provenance": { text: "Visible only in your Personal books.", announce: "none" },
};

const SLICE_14_OPENING_COPY: Record<string, { text: string; announce: CopyEntry["announce"] }> = {
  "onboarding.household.ch-05-opening": {
    text: "Bring every Shared account to today with one opening batch. These are balances you already have — not income or spending.", announce: "none",
  },
  "opening.open": { text: "Enter opening balances", announce: "none" },
  "opening.review": { text: "Review opening entries", announce: "none" },
  "opening.partial": {
    text: "Some Shared accounts are missing from the opening batch. Reverse that batch, then confirm all of them together.", announce: "polite",
  },
  "opening.stale": {
    text: "There are already posted entries in the books, but no accepted opening balance. Review those entries before continuing.", announce: "polite",
  },
};

const SLICE_15_FUND_COPY: Record<string, { text: string; announce: CopyEntry["announce"] }> = {
  "onboarding.household.ch-06-fund": {
    text: "Set up the Household Fund at $0.00, then each of you reviews and approves the same setup.", announce: "none",
  },
  "fund.open": { text: "Open the Household Fund", announce: "none" },
  "fund.configure": { text: "Set up the Fund at $0.00", announce: "none" },
  "fund.approve": { text: "I approve this Fund setup", announce: "none" },
  "fund.approval.explain": { text: "This records your agreement with the setup. It doesn't move money.", announce: "none" },
  "fund.approval.current": { text: "You're approved on this version.", announce: "polite" },
  "fund.backing.private": { text: "The backing account stays in the custodian's Personal books.", announce: "none" },
  "fund.custody-mismatch": { text: "Custody moves through the Fund, not the charter.", announce: "polite" },
};

const SLICE_16_RECURRENCES_COPY: Record<string, { text: string; announce: CopyEntry["announce"] }> = {
  "onboarding.household.ch-07-recurrences": {
    text: "Put the household's rent or equivalent and one other regular item on the calendar as standing facts.", announce: "none",
  },
  "recurrences.open": { text: "Open regular money", announce: "none" },
  "recurrences.title": { text: "Regular money", announce: "none" },
  "recurrences.count": { text: "{count} standing", announce: "none" },
  "recurrences.add-another": { text: "Add another regular item", announce: "none" },
  "recurrences.add": { text: "Add a standing fact", announce: "none" },
  "recurrences.witness-add": {
    text: "{name} is leading this one. You can add a regular item too, if there's one you know.", announce: "none",
  },
  "recurrences.guide": {
    text: "A reminder helps you remember. A standing fact anchors the plan. An actual posted occurrence changes the books. We only need the standing fact here.", announce: "none",
  },
  "recurrences.minimum": { text: "Add rent or its equivalent, plus one other regular item.", announce: "polite" },
  "recurrences.empty": {
    text: "Add rent or its equivalent first. This list holds standing facts for the plan; nothing here posts an occurrence.", announce: "none",
  },
  "recurrences.ready": { text: "The two anchors are here. Add more if it helps, or return to Hercules.", announce: "polite" },
  "recurrences.pause": { text: "Three are plenty for one pass. Good place to pause or carry on.", announce: "polite" },
  "recurrences.standing": { text: "Standing fact, not a post", announce: "none" },
  "recurrences.form-explain": { text: "This anchors the plan. It doesn't post an occurrence or move money.", announce: "none" },
  "recurrences.form-add": { text: "Add regular money", announce: "none" },
  "recurrences.form-edit": { text: "Edit regular money", announce: "none" },
  "recurrences.adopt-explain": {
    text: "Adopt saves a standing fact from accepted history. Marking it paid is a separate step later.", announce: "none",
  },
  "recurrences.save": { text: "Save standing fact", announce: "none" },
};

const SLICE_17_CADENCE_COPY: Record<string, { text: string; announce: CopyEntry["announce"] }> = {
  "onboarding.household.ch-08-cadence": {
    text: "Show Hearth when you are usually paid. This is timing only — never an assumed pay or contribution amount.", announce: "none",
  },
  "cadence.open": { text: "Set my earning rhythm", announce: "none" },
  "cadence.title": { text: "Your earning rhythm", announce: "none" },
  "cadence.guide": {
    text: "Pick the rhythm, not a number. Hearth follows the pattern when there is one, and leaves paydays open when there isn't. It never guesses what you earn.", announce: "none",
  },
  "cadence.detail-later": {
    text: "Job, rate, deduction, tip, and landing-account details stay for your Personal setup later.", announce: "none",
  },
  "cadence.save": { text: "Save my earning rhythm", announce: "none" },
  "cadence.saved": { text: "Timing saved. No income or contribution was added.", announce: "polite" },
};

const SLICE_19_CATEGORIES_COPY: Record<string, { text: string; announce: CopyEntry["announce"] }> = {
  "onboarding.household.ch-09-categories": {
    text: "Choose what the household plan should cover on your own device. Your choices stay private until both lists are in.", announce: "none",
  },
  "categories.open": { text: "Choose what the plan covers", announce: "none" },
  "categories.title": { text: "What should our plan cover?", announce: "none" },
  "categories.existing": { text: "Choose from the household list", announce: "none" },
  "categories.suggest": { text: "Suggest another category", announce: "none" },
  "categories.suggest-help": { text: "It stays an idea until both lists are in and someone reviews the merge.", announce: "none" },
  "categories.name": { text: "Category name", announce: "none" },
  "categories.group": { text: "Category group", announce: "none" },
  "categories.add-idea": { text: "Add idea", announce: "none" },
  "categories.remove-idea": { text: "Remove idea", announce: "none" },
  "categories.submit": { text: "Submit my choices", announce: "none" },
  "categories.waiting": { text: "Your choices are in. {name}'s choices stay private until they submit.", announce: "polite" },
  "categories.together": { text: "Our household set", announce: "none" },
  "categories.member-set": { text: "{name}'s choices", announce: "none" },
  "categories.review": { text: "Both lists are here. Review the ideas once, then add the agreed categories to the household list.", announce: "none" },
  "categories.conflict": { text: "The same category arrived in two versions. Choose the version you both want to keep.", announce: "polite" },
  "categories.accept": { text: "Accept our category set", announce: "none" },
  "categories.done": { text: "The combined set is ready. No budget amounts or money moved.", announce: "polite" },
};

const SLICE_20_ESTIMATES_COPY: Record<string, { text: string; announce: CopyEntry["announce"] }> = {
  "onboarding.household.ch-10-estimates": {
    text: "It's okay to guess. This is the first shape, not a promise; Hearth will learn from what actually happens.", announce: "none",
  },
  "estimates.open": { text: "Add my first guesses", announce: "none" },
  "estimates.title": { text: "What might a month look like?", announce: "none" },
  "estimates.guide": {
    text: "Give each category a rough monthly amount. Leave any box blank when you don't have a useful guess yet.", announce: "none",
  },
  "estimates.blank-help": { text: "Blank means not estimated. Enter 0 when you mean $0.00.", announce: "none" },
  "estimates.currency": { text: "Monthly guess (CAD)", announce: "none" },
  "estimates.placeholder": { text: "Leave blank", announce: "none" },
  "estimates.missing": { text: "Not estimated", announce: "none" },
  "estimates.waiting": { text: "Your guesses are in. {name}'s stay private until they submit.", announce: "polite" },
  "estimates.together": { text: "The first guesses", announce: "none" },
  "estimates.member-set": { text: "{name}'s guesses", announce: "none" },
  "estimates.done": {
    text: "Both sets are here. They shape the next proposal; they did not create a budget or move money.", announce: "polite",
  },
  "estimates.categories-first": { text: "Finish the household category set before adding guesses.", announce: "polite" },
  "estimates.changed": { text: "Our category set changed, so take another look at your guesses.", announce: "polite" },
  "estimates.invalid": {
    text: "Use dollars and cents, like 125 or 125.50. Leave a box blank if you don't have a guess.", announce: "polite",
  },
};

const SLICE_24_PLAN_COPY: Record<string, { text: string; announce: CopyEntry["announce"] }> = {
  "onboarding.household.ch-11-plan": { text: "Let's lay out the first month together. Every number will show where it came from before either of you approves it.", announce: "none" },
  "proposal.open": { text: "Review our first plan", announce: "none" },
  "proposal.title": { text: "Our first month, laid out", announce: "none" },
  "proposal.subtitle": { text: "A starting shape from your two guesses, known repeating costs, and only the history Hearth can honestly use.", announce: "none" },
  "proposal.review-pause": { text: "Take your time here. Review the trail under every amount before giving your own yes.", announce: "none" },
  "proposal.guesses": { text: "Your two guesses", announce: "none" },
  "proposal.recurrences": { text: "Known repeating costs", announce: "none" },
  "proposal.recurrence.none": { text: "No repeating cost is assigned here.", announce: "none" },
  "proposal.recurrence.value": { text: "{amount} each · {cadence} · standing date {date}", announce: "none" },
  "proposal.recurrence.month": { text: "This month: {count} × {amount} = {total} ({dates})", announce: "none" },
  "proposal.recurrence.floor": { text: "Repeating-cost floor: {amount}", announce: "none" },
  "proposal.history": { text: "Accepted history", announce: "none" },
  "proposal.history.ready": { text: "{amount} from {weeks} complete weeks", announce: "none" },
  "proposal.history.short": { text: "Not enough complete history yet.", announce: "none" },
  "proposal.history.untied": { text: "No accepted history can be tied here yet.", announce: "none" },
  "proposal.history.empty": { text: "No accepted spending is recorded here yet.", announce: "none" },
  "proposal.basis.both": { text: "Half-up average of both guesses", announce: "none" },
  "proposal.basis.single": { text: "The one available guess", announce: "none" },
  "proposal.basis.runrate": { text: "Raised to accepted monthly history", announce: "none" },
  "proposal.result": { text: "Proposed for the month", announce: "none" },
  "proposal.total": { text: "First-plan total", announce: "none" },
  "proposal.capacity.absent": { text: "You didn't enter a household capacity in this setup, so I'm not comparing this total with one.", announce: "polite" },
  "proposal.edit": { text: "Change my guesses", announce: "none" },
  "proposal.edit.title": { text: "Change my monthly guesses", announce: "none" },
  "proposal.edit.save": { text: "Save a new version", announce: "none" },
  "proposal.edit.cancel": { text: "Keep this version", announce: "none" },
  "proposal.edit.changed": { text: "This version changed. Earlier approvals don't apply; each of you can review and say yes again.", announce: "polite" },
  "proposal.edit.invalid": { text: "Use dollars and cents, like 125 or 125.50. Leave a box blank when you don't have a guess.", announce: "polite" },
  "approve.title": { text: "Two personal approvals", announce: "none" },
  "approve.mine": { text: "Your approval is on this version.", announce: "polite" },
  "approve.recorded": { text: "{name} approved this version.", announce: "polite" },
  "approve.pending": { text: "Not approved yet", announce: "none" },
  "approve.complete": { text: "You both approved this exact version. Nothing changes until one of you adopts it.", announce: "polite" },
  "adopt.self": { text: "Adopt our first plan", announce: "none" },
  "adopt.working": { text: "Adopting this exact version", announce: "polite" },
  "adopt.retry": { text: "Try adoption again", announce: "none" },
  "adopt.failed": { text: "That didn't go through. Nothing changed, and this exact version is still here to try again.", announce: "polite" },
  "adopt.recovery": { text: "The books may have accepted this plan, but this device couldn't save the receipt. Use recovery before trying again.", announce: "polite" },
};

const SLICE_25_READY_COPY: Record<string, { text: string; announce: CopyEntry["announce"] }> = {
  "onboarding.household.ch-12-ready": { text: "Let's prove one ordinary entry will be easy tomorrow, then look over everything we set up.", announce: "none" },
  "ready.title": { text: "Ready for ordinary days", announce: "none" },
  "ready.subtitle": { text: "One small proof, one last look, and each of you gives your own yes.", announce: "none" },
  "ready.open": { text: "Open Books", announce: "none" },
  "ready.accepted": { text: "You've already posted an ordinary entry. That counts.", announce: "polite" },
  "ready.practice.title": { text: "Try it safely in Practice", announce: "none" },
  "ready.practice.explain": { text: "Add a pretend grocery, then correct it. Practice is discarded and never touches your books, reports, streak, or Health.", announce: "none" },
  "ready.practice.add": { text: "Add pretend $45 grocery", announce: "none" },
  "ready.practice.correct": { text: "Correct the pretend entry", announce: "none" },
  "ready.practice.running": { text: "Checking the correction in Practice…", announce: "polite" },
  "ready.practice.done": { text: "Practice balanced, and the pretend row was discarded.", announce: "polite" },
  "ready.complete": { text: "Set up", announce: "none" },
  "ready.pending": { text: "Still needed", announce: "none" },
  "ready.current": { text: "Your Ready approval is recorded on this exact version.", announce: "polite" },
  "ready.books": { text: "Books", announce: "none" },
  "ready.books.tied": { text: "Trial and equation agree", announce: "none" },
  "ready.books.attention": { text: "Books need another look", announce: "polite" },
  "ready.health": { text: "Health", announce: "none" },
  "ready.health.clean": { text: "No integrity findings", announce: "none" },
  "ready.health.findings": { text: "{count} integrity findings", announce: "polite" },
  "ready.failure": { text: "That didn't finish. Nothing was marked complete — try again when you're ready.", announce: "polite" },
  "ready.offline": { text: "You're offline. Practice still works here, but Ready waits until this device can reach the household.", announce: "polite" },
  "ready.finish": { text: "Finish setup", announce: "none" },
  "ready.chapter.01": { text: "Meet Hercules", announce: "none" },
  "ready.chapter.02": { text: "Right household", announce: "none" },
  "ready.chapter.03": { text: "Household Charter", announce: "none" },
  "ready.chapter.04": { text: "Accounts", announce: "none" },
  "ready.chapter.05": { text: "Opening balances", announce: "none" },
  "ready.chapter.06": { text: "Household Fund", announce: "none" },
  "ready.chapter.07": { text: "Regular money", announce: "none" },
  "ready.chapter.08": { text: "Earning rhythms", announce: "none" },
  "ready.chapter.09": { text: "Plan categories", announce: "none" },
  "ready.chapter.10": { text: "First guesses", announce: "none" },
  "ready.chapter.11": { text: "First month", announce: "none" },
  "ready.chapter.12": { text: "Tomorrow's proof", announce: "none" },
  "ready.open-books": { text: "Open ordinary Books", announce: "none" },
};

const SLICE_26_PERSONAL_COPY: Record<string, { text: string; announce: CopyEntry["announce"] }> = {
  "personal.module.label": { text: "Optional · just yours", announce: "none" },
  "personal.module.private": { text: "This guide belongs to you. It never changes the household setup.", announce: "none" },
  "personal.module.why": { text: "Why this showed up", announce: "none" },
  "personal.module.saving": { text: "Saving this guide…", announce: "polite" },
  "personal.module.done": { text: "Got it", announce: "none" },
  "onboarding.personal.pm-01-own-books": { text: "Personal books are your own room. Your accounts and Personal transactions stay out of the household view.", announce: "none" },
  "onboarding.personal.pm-02-shifts": { text: "The Shift room keeps your clock, a careful review before posting, and a streak made only from posted shifts.", announce: "none" },
  "onboarding.personal.pm-03-tips": { text: "The tip oracle waits for four posted shifts before it speaks. Before that, not enough history is the honest answer.", announce: "none" },
  "onboarding.personal.pm-04-own-plan": { text: "Your Personal plan gives your own categories a monthly shape without changing the household plan.", announce: "none" },
  "onboarding.personal.pm-05-office": { text: "Your desk is yours to arrange. Plates are shortcuts into real Hearth rooms, not a second set of books.", announce: "none" },
  "onboarding.personal.pm-06-hercules": { text: "You can ask me about the ledger you chose and tell me what to remember. I still cannot post money for you.", announce: "none" },
  "personal.trigger.own-books": { text: "You posted your first Personal transaction.", announce: "none" },
  "personal.trigger.shifts": { text: "You recorded an earning rhythm built around your work.", announce: "none" },
  "personal.trigger.tips": { text: "You now have enough posted shifts for the oracle to use a real sample.", announce: "none" },
  "personal.trigger.own-plan": { text: "You have three Personal transactions in this month.", announce: "none" },
  "personal.trigger.office": { text: "This is your first desktop visit since the household unlocked.", announce: "none" },
  "personal.trigger.hercules": { text: "The household has been unlocked for a week.", announce: "none" },
  "personal.open.books": { text: "Open Personal Books", announce: "none" },
  "personal.open.shifts": { text: "Open Shifts", announce: "none" },
  "personal.open.tips": { text: "See the tip oracle", announce: "none" },
  "personal.open.plan": { text: "Open Personal Plan", announce: "none" },
  "personal.open.office": { text: "Open my desk", announce: "none" },
};

const SLICE_27_LIFECYCLE_COPY: Record<string, { text: string; announce: CopyEntry["announce"] }> = {
  "onboarding.household.ch-01-meet": { text: "I'm Hercules. I can explain what Hearth sees and prepare the next step, but I never post money or confirm for you.", announce: "none" },
  "lifecycle.new-member.intro": { text: "The household is already set up. I'll give you a short, private catch-up without interrupting anyone else.", announce: "none" },
};

describe("the onboarding copy deck", () => {
  it("carries every Appendix E key, byte-exact", () => {
    for (const [key, expected] of Object.entries(APPENDIX_E)) {
      const entry = ONBOARDING_COPY[key];
      expect(entry, `missing key "${key}"`).toBeTruthy();
      expect(entry!.text).toBe(expected.text);
      expect(entry!.announce).toBe(expected.announce);
    }
  });

  it("has no keys beyond Appendix E and the documented chapter repairs", () => {
    expect(Object.keys(ONBOARDING_COPY).sort())
      .toEqual(Object.keys({ ...APPENDIX_E, ...SLICE_11_REPAIR_COPY, ...SLICE_12_CHARTER_COPY, ...SLICE_13_ACCOUNTS_COPY, ...SLICE_14_OPENING_COPY, ...SLICE_15_FUND_COPY, ...SLICE_16_RECURRENCES_COPY, ...SLICE_17_CADENCE_COPY, ...SLICE_19_CATEGORIES_COPY, ...SLICE_20_ESTIMATES_COPY, ...SLICE_24_PLAN_COPY, ...SLICE_25_READY_COPY, ...SLICE_26_PERSONAL_COPY, ...SLICE_27_LIFECYCLE_COPY }).sort());
    for (const [key, expected] of Object.entries({
      ...SLICE_11_REPAIR_COPY,
      ...SLICE_12_CHARTER_COPY,
      ...SLICE_13_ACCOUNTS_COPY,
      ...SLICE_14_OPENING_COPY,
      ...SLICE_15_FUND_COPY,
      ...SLICE_16_RECURRENCES_COPY,
      ...SLICE_17_CADENCE_COPY,
      ...SLICE_19_CATEGORIES_COPY,
      ...SLICE_20_ESTIMATES_COPY,
      ...SLICE_24_PLAN_COPY,
      ...SLICE_25_READY_COPY,
      ...SLICE_26_PERSONAL_COPY,
      ...SLICE_27_LIFECYCLE_COPY,
    })) {
      expect(ONBOARDING_COPY[key]).toMatchObject(expected);
    }
  });

  it("declares slots that match every {named} placeholder in its own text", () => {
    for (const entry of Object.values(ONBOARDING_COPY)) {
      const placeholders = [...entry.text.matchAll(/\{([a-zA-Z]+)\}/g)].map((match) => match[1]);
      expect(new Set(entry.slots)).toEqual(new Set(placeholders));
    }
  });

  it("resolves every entry through copy() with its slots filled", () => {
    expect(copy("invite.waiting", { name: "Bianca" })).toBe("Waiting for Bianca to say yes on their device.");
    expect(copy("nav.go", { surface: "the Charter" })).toBe("Open the Charter");
    expect(copy("proposal.capacity", { total: "$2,150.00", capacity: "$2,400.00" }))
      .toBe("That's $2,150.00 against the $2,400.00 you said we have.");
    expect(copy("invite.propose")).toBe("Start together");
  });

  it("throws on a missing required slot, in this test environment", () => {
    expect(() => copy("invite.waiting")).toThrow(/missing a required slot/);
    expect(() => copy("proposal.capacity", { total: "$1.00" })).toThrow(/missing a required slot/);
  });

  it("resolves a key with no deck entry to the key itself, rather than throwing or going blank", () => {
    expect(copy("onboarding.household.ch-99-not-written-yet")).toBe("onboarding.household.ch-99-not-written-yet");
  });

  it("allows at most three assertive entries, and exactly the three the manual names", () => {
    const assertiveKeys = Object.values(ONBOARDING_COPY)
      .filter((entry) => entry.announce === "assertive")
      .map((entry) => entry.key)
      .sort();
    expect(assertiveKeys).toEqual(["blocked.conflict", "blocked.identity", "blocked.membership"]);
  });

  it("never reveals a partner's Personal fact in the privacy refusal", () => {
    const text = ONBOARDING_COPY["blocked.privacy"]!.text;
    expect(text.toLowerCase()).not.toContain("your partner");
    expect(text.toLowerCase()).not.toContain("personal");
  });

  it("every registry copyKey and flavorKey resolves through copy() without throwing", () => {
    for (const chapter of ONBOARDING_REGISTRY) {
      expect(() => copy(chapter.copyKey)).not.toThrow();
      for (const flavorKey of chapter.flavorKeys) {
        expect(() => copy(flavorKey)).not.toThrow();
      }
    }
  });
});

describe("flavorFor", () => {
  it("is stable for the same household and chapter, over many calls", () => {
    const first = flavorFor("ch-01-meet", "HH-0001");
    for (let index = 0; index < 1000; index += 1) {
      expect(flavorFor("ch-01-meet", "HH-0001")).toBe(first);
    }
  });

  it("resolves every registered chapter without throwing", () => {
    for (const chapter of ONBOARDING_REGISTRY) {
      expect(() => flavorFor(chapter.id, "HH-0001")).not.toThrow();
      expect(FLAVOR_POOL).toContain(flavorFor(chapter.id, "HH-0001"));
    }
  });

  it("covers every variant in the pool across many household ids", () => {
    const seen = new Set<string>();
    for (let index = 0; index < 500; index += 1) {
      seen.add(flavorFor("ch-01-meet", `HH-${index}`));
    }
    expect(seen).toEqual(new Set(FLAVOR_POOL));
  });

  it("varies by chapter id too, not only household id", () => {
    const perChapter = new Set(ONBOARDING_REGISTRY.map((chapter) => flavorFor(chapter.id, "HH-0001")));
    expect(perChapter.size).toBeGreaterThan(1);
  });

  it("contains no digit and none of the forbidden words, in every variant", () => {
    for (const variant of FLAVOR_POOL) {
      expect(variant).not.toMatch(/[0-9]/);
      expect(variant.toLowerCase()).not.toMatch(/\b(should|need to|must)\b/);
    }
  });

  it("uses no Math.random and seeds from COPY_DECK_VERSION, household id, and chapter id", () => {
    expect(flavorSource).not.toMatch(/Math\.random/);
    expect(flavorSource).toContain("COPY_DECK_VERSION");
    expect(flavorSource).toContain("stableImportHash");
  });
});

describe("onboarding copy fences", () => {
  it("makes zero model calls and imports no provider client", () => {
    for (const source of [copySource, flavorSource]) {
      expect(source).not.toMatch(/from\s+["'][^"']*(?:herculesChat|provider|openai|groq|gemini)[^"']*["']/i);
      expect(source).not.toMatch(/fetch\s*\(/);
    }
  });

  it("cannot post, settle, or move a cent", () => {
    for (const source of [copySource, flavorSource]) {
      expect(source).not.toMatch(/\b(postEntry|postTransfer|commit|commitHousehold)\s*\(/);
    }
  });

  it("composes no member-facing sentence at a call site outside the deck", () => {
    // src/OnboardingChat.tsx landed in onboarding slice 7. This fence checks
    // every Onboarding*.tsx component: no template literal containing ". "
    // and no JSX text ending ".", "?", or "!" — every sentence must come from
    // copy(). Scoped to a single line so an unrelated comment's own full
    // stop, sitting between two genuinely separate template literals or tags
    // elsewhere in the file, can never bridge a false match.
    const srcDir = fileURLToPath(new URL("../src/", import.meta.url));
    const onboardingComponents = readdirSync(srcDir)
      .filter((name) => /^Onboarding.*\.tsx$/.test(name));
    expect(onboardingComponents.length).toBeGreaterThan(0);
    for (const name of onboardingComponents) {
      const source = readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");
      expect(source, `${name} composes a sentence in a template literal`).not.toMatch(/`[^`\n]*\.\s[^`\n]*`/);
      expect(source, `${name} ends JSX text with terminal punctuation instead of using copy()`)
        .not.toMatch(/>[^<{\n]*[.?!]\s*</);
    }
  });
});
