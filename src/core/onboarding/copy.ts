// The deterministic copy deck. Every member-facing onboarding sentence lives
// here. Appendix E remains byte-exact; explicitly documented repair keys
// may extend it when a later slice introduces a state Appendix E did not
// name. Components never compose those additions at a call site.
// composed at a call site. A component asks copy() for a key; it never
// concatenates, templates, or punctuates a sentence itself (see the fence in
// test/onboarding-copy.test.ts over src/Onboarding*.tsx).
//
// speaker, surface, and scope are not literal columns in Appendix E — that
// table only fixes `key`, `text`, and `announce`. speaker/surface are
// assigned here from this manual's conductor and witness semantics:
// "hercules" is his own written voice on the shell's Hercules line;
// "system" is UI chrome (a
// button label, the turn line, the noticed strip, the return bar) that
// never claims to be Hercules speaking in the first person. `scope` is
// "none" on every entry in this deck — nothing here is a privacy-scoped
// evidence-card string (that's the evidence projector's job, slice 5). The
// field exists on the type so a later slice adding a scoped entry doesn't
// need a shape change.

import type { EvidenceScope } from "./evidence.ts";

export const COPY_DECK_VERSION = 1;

export type CopyEntry = {
  key: string;
  speaker: "hercules" | "system";
  surface: "chat" | "presence" | "status" | "button" | "card";
  scope: EvidenceScope | "none";
  announce: "polite" | "assertive" | "none";
  text: string;
  slots: string[];
};

function entry(row: CopyEntry): [string, CopyEntry] {
  return [row.key, row];
}

export const ONBOARDING_COPY: Readonly<Record<string, CopyEntry>> = Object.freeze(Object.fromEntries([
  // E.1 Entry and the handshake
  entry({
    key: "invite.offer", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "When you're both ready to set up the household together, I can walk us through it.", slots: [],
  }),
  entry({
    key: "invite.explain", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "This puts both of us in setup mode until we finish or stop. Three sittings, about an hour all in — we can stop between any of them.", slots: [],
  }),
  entry({
    key: "invite.propose", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Start together", slots: [],
  }),
  entry({
    key: "invite.confirm", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Yes, let's start", slots: [],
  }),
  entry({
    key: "invite.waiting", speaker: "hercules", surface: "chat", scope: "none", announce: "polite",
    text: "Waiting for {name} to say yes on their device.", slots: ["name"],
  }),
  entry({
    key: "invite.expired", speaker: "hercules", surface: "chat", scope: "none", announce: "polite",
    text: "That invitation expired. Start it again whenever you're both ready.", slots: [],
  }),

  // E.2 Running a chapter
  entry({
    key: "chapter.turn.conductor", speaker: "hercules", surface: "presence", scope: "none", announce: "none",
    text: "This one's yours.", slots: [],
  }),
  entry({
    key: "chapter.turn.witness", speaker: "hercules", surface: "presence", scope: "none", announce: "none",
    text: "{name} is doing this one — you don't need to type anything.", slots: ["name"],
  }),
  entry({
    key: "nav.go", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Open {surface}", slots: ["surface"],
  }),
  entry({
    key: "nav.return", speaker: "system", surface: "status", scope: "none", announce: "polite",
    text: "Finish here, then open Hercules.", slots: [],
  }),
  entry({
    key: "probe.already", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "Looks like you already handled this.", slots: [],
  }),
  entry({
    key: "notice.completed", speaker: "system", surface: "status", scope: "none", announce: "polite",
    text: "Hercules noticed", slots: [],
  }),
  entry({
    key: "notice.congratulate", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "That's done. Nice.", slots: [],
  }),
  entry({
    key: "continue.next", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Next", slots: [],
  }),
  entry({
    key: "continue.ask", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "Ready for the next one?", slots: [],
  }),
  entry({
    key: "sitting.pause", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "Good place to stop. We'll pick up right here.", slots: [],
  }),
  entry({
    key: "sitting.two.warning", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "This is the long one — bills, balances, the fund. Worth a coffee.", slots: [],
  }),

  // E.3 Waiting, skipping, stopping
  entry({
    key: "waiting.partner", speaker: "hercules", surface: "chat", scope: "none", announce: "polite",
    text: "Waiting on {name}. Nothing's lost — it'll pick up when they're in.", slots: ["name"],
  }),
  entry({
    key: "skip.personal", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Skip this for now", slots: [],
  }),
  entry({
    key: "skip.personal.recorded", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "Skipped. I'll leave it on the list, not in the way.", slots: [],
  }),
  entry({
    key: "stop.offer", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Stop setup for now", slots: [],
  }),
  entry({
    key: "stop.explain", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "This turns Hercules back on for both of us. Nothing gets marked done — we can pick it up whenever.", slots: [],
  }),
  entry({
    key: "stop.recorded", speaker: "hercules", surface: "chat", scope: "none", announce: "polite",
    text: "Setup stopped. Nothing was marked done — we can pick it up whenever.", slots: [],
  }),
  entry({
    key: "stop.resume", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "We were partway through. Want to carry on where we left off?", slots: [],
  }),

  // E.4 Blocked, stale, honest refusals
  entry({
    key: "blocked.identity", speaker: "hercules", surface: "chat", scope: "none", announce: "assertive",
    text: "I can't see both of you in this household yet.", slots: [],
  }),
  entry({
    key: "blocked.membership", speaker: "hercules", surface: "chat", scope: "none", announce: "assertive",
    text: "{name} isn't a member of this household yet.", slots: ["name"],
  }),
  entry({
    key: "blocked.stale", speaker: "hercules", surface: "chat", scope: "none", announce: "polite",
    text: "Something changed underneath this since it was done. Worth another look.", slots: [],
  }),
  entry({
    key: "blocked.conflict", speaker: "hercules", surface: "chat", scope: "none", announce: "assertive",
    text: "Two versions of this disagree. Let's settle which one is right.", slots: [],
  }),
  entry({
    key: "blocked.untied", speaker: "hercules", surface: "chat", scope: "none", announce: "polite",
    text: "These numbers don't tie to the ledger yet. I'd rather show you nothing than show you the wrong thing.", slots: [],
  }),
  entry({
    key: "blocked.privacy", speaker: "hercules", surface: "chat", scope: "none", announce: "polite",
    text: "I can't use that here.", slots: [],
  }),
  entry({
    key: "offline.queued", speaker: "hercules", surface: "chat", scope: "none", announce: "polite",
    text: "Saved here. It'll sync when you're back.", slots: [],
  }),
  entry({
    key: "retry.honest", speaker: "hercules", surface: "chat", scope: "none", announce: "polite",
    text: "That didn't go through. Nothing changed — want to try again?", slots: [],
  }),
  entry({
    key: "blocked.revoked", speaker: "hercules", surface: "chat", scope: "none", announce: "polite",
    text: "Your household access isn't active right now.", slots: [],
  }),
  entry({
    key: "blocked.offline", speaker: "hercules", surface: "chat", scope: "none", announce: "polite",
    text: "You're offline, so I can't finish this check yet. Nothing's lost.", slots: [],
  }),
  entry({
    key: "blocked.scope", speaker: "hercules", surface: "chat", scope: "none", announce: "polite",
    text: "I found more than one household. Open the one you want, then come back here.", slots: [],
  }),
  entry({
    key: "probe.retry", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Try again", slots: [],
  }),
  entry({
    key: "onboarding.household.ch-02-household", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "Let me make sure this is the right household for both of you.", slots: [],
  }),
  entry({
    key: "onboarding.household.ch-03-charter", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "Your Charter puts the household's shared rules in your own words. Write it together, then each sign your own line.", slots: [],
  }),
  entry({
    key: "onboarding.household.ch-04-accounts", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "Tell me which accounts the household actually uses. Add at least one Shared account and choose one Shared credit card for the Fund.", slots: [],
  }),
  entry({
    key: "accounts.open", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Open accounts", slots: [],
  }),
  entry({
    key: "accounts.personal.offer", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "Want to add your own accounts too? They stay in your Personal books, or you can leave them for later.", slots: [],
  }),
  entry({
    key: "accounts.personal.provenance", speaker: "system", surface: "status", scope: "none", announce: "none",
    text: "Visible only in your Personal books.", slots: [],
  }),
  entry({
    key: "onboarding.household.ch-05-opening", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "Bring every Shared account to today with one opening batch. These are balances you already have — not income or spending.", slots: [],
  }),
  entry({
    key: "opening.open", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Enter opening balances", slots: [],
  }),
  entry({
    key: "opening.review", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Review opening entries", slots: [],
  }),
  entry({
    key: "opening.partial", speaker: "hercules", surface: "card", scope: "none", announce: "polite",
    text: "Some Shared accounts are missing from the opening batch. Reverse that batch, then confirm all of them together.", slots: [],
  }),
  entry({
    key: "opening.stale", speaker: "hercules", surface: "card", scope: "none", announce: "polite",
    text: "There are already posted entries in the books, but no accepted opening balance. Review those entries before continuing.", slots: [],
  }),
  entry({
    key: "onboarding.household.ch-06-fund", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "Set up the Household Fund at $0.00, then each of you reviews and approves the same setup.", slots: [],
  }),
  entry({
    key: "fund.open", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Open the Household Fund", slots: [],
  }),
  entry({
    key: "fund.configure", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Set up the Fund at $0.00", slots: [],
  }),
  entry({
    key: "fund.approve", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "I approve this Fund setup", slots: [],
  }),
  entry({
    key: "fund.approval.explain", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "This records your agreement with the setup. It doesn't move money.", slots: [],
  }),
  entry({
    key: "fund.approval.current", speaker: "system", surface: "status", scope: "none", announce: "polite",
    text: "You're approved on this version.", slots: [],
  }),
  entry({
    key: "fund.backing.private", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "The backing account stays in the custodian's Personal books.", slots: [],
  }),
  entry({
    key: "fund.custody-mismatch", speaker: "hercules", surface: "card", scope: "none", announce: "polite",
    text: "Custody moves through the Fund, not the charter.", slots: [],
  }),
  entry({
    key: "onboarding.household.ch-07-recurrences", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "Put the household's rent or equivalent and one other regular item on the calendar as standing facts.", slots: [],
  }),
  entry({
    key: "recurrences.open", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Open regular money", slots: [],
  }),
  entry({
    key: "recurrences.title", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Regular money", slots: [],
  }),
  entry({
    key: "recurrences.count", speaker: "system", surface: "status", scope: "none", announce: "none",
    text: "{count} standing", slots: ["count"],
  }),
  entry({
    key: "recurrences.add-another", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Add another regular item", slots: [],
  }),
  entry({
    key: "recurrences.add", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Add a standing fact", slots: [],
  }),
  entry({
    key: "recurrences.witness-add", speaker: "hercules", surface: "presence", scope: "none", announce: "none",
    text: "{name} is leading this one. You can add a regular item too, if there's one you know.", slots: ["name"],
  }),
  entry({
    key: "recurrences.guide", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "A reminder helps you remember. A standing fact anchors the plan. An actual posted occurrence changes the books. We only need the standing fact here.", slots: [],
  }),
  entry({
    key: "recurrences.minimum", speaker: "system", surface: "status", scope: "none", announce: "polite",
    text: "Add rent or its equivalent, plus one other regular item.", slots: [],
  }),
  entry({
    key: "recurrences.empty", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Add rent or its equivalent first. This list holds standing facts for the plan; nothing here posts an occurrence.", slots: [],
  }),
  entry({
    key: "recurrences.ready", speaker: "system", surface: "status", scope: "none", announce: "polite",
    text: "The two anchors are here. Add more if it helps, or return to Hercules.", slots: [],
  }),
  entry({
    key: "recurrences.pause", speaker: "hercules", surface: "status", scope: "none", announce: "polite",
    text: "Three are plenty for one pass. Good place to pause or carry on.", slots: [],
  }),
  entry({
    key: "recurrences.standing", speaker: "system", surface: "status", scope: "none", announce: "none",
    text: "Standing fact, not a post", slots: [],
  }),
  entry({
    key: "recurrences.form-explain", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "This anchors the plan. It doesn't post an occurrence or move money.", slots: [],
  }),
  entry({
    key: "recurrences.form-add", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Add regular money", slots: [],
  }),
  entry({
    key: "recurrences.form-edit", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Edit regular money", slots: [],
  }),
  entry({
    key: "recurrences.adopt-explain", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Adopt saves a standing fact from accepted history. Marking it paid is a separate step later.", slots: [],
  }),
  entry({
    key: "recurrences.save", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Save standing fact", slots: [],
  }),
  entry({
    key: "onboarding.household.ch-08-cadence", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "Show Hearth when you are usually paid. This is timing only — never an assumed pay or contribution amount.", slots: [],
  }),
  entry({
    key: "cadence.open", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Set my earning rhythm", slots: [],
  }),
  entry({
    key: "cadence.title", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Your earning rhythm", slots: [],
  }),
  entry({
    key: "cadence.guide", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "Pick the rhythm, not a number. Hearth follows the pattern when there is one, and leaves paydays open when there isn't. It never guesses what you earn.", slots: [],
  }),
  entry({
    key: "cadence.detail-later", speaker: "system", surface: "status", scope: "none", announce: "none",
    text: "Job, rate, deduction, tip, and landing-account details stay for your Personal setup later.", slots: [],
  }),
  entry({
    key: "cadence.save", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Save my earning rhythm", slots: [],
  }),
  entry({
    key: "cadence.saved", speaker: "system", surface: "status", scope: "none", announce: "polite",
    text: "Timing saved. No income or contribution was added.", slots: [],
  }),
  entry({
    key: "charter.write", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Write the Charter", slots: [],
  }),
  entry({
    key: "charter.open", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Open the Charter", slots: [],
  }),
  entry({
    key: "charter.review-sign", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Review and sign the Charter", slots: [],
  }),

  // E.5 The budget chapters
  entry({
    key: "onboarding.household.ch-09-categories", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "Choose what the household plan should cover on your own device. Your choices stay private until both lists are in.", slots: [],
  }),
  entry({
    key: "guess.reassure", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "It's okay to guess. This is the first shape, not a promise; Hearth will learn from what actually happens.", slots: [],
  }),
  entry({
    key: "categories.solo", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "Pick what our money should cover. {name} is picking too — we'll put the lists together after.", slots: ["name"],
  }),
  entry({
    key: "categories.open", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Choose what the plan covers", slots: [],
  }),
  entry({
    key: "categories.title", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "What should our plan cover?", slots: [],
  }),
  entry({
    key: "categories.existing", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Choose from the household list", slots: [],
  }),
  entry({
    key: "categories.suggest", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Suggest another category", slots: [],
  }),
  entry({
    key: "categories.suggest-help", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "It stays an idea until both lists are in and someone reviews the merge.", slots: [],
  }),
  entry({
    key: "categories.name", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Category name", slots: [],
  }),
  entry({
    key: "categories.group", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Category group", slots: [],
  }),
  entry({
    key: "categories.add-idea", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Add idea", slots: [],
  }),
  entry({
    key: "categories.remove-idea", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Remove idea", slots: [],
  }),
  entry({
    key: "categories.submit", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Submit my choices", slots: [],
  }),
  entry({
    key: "categories.waiting", speaker: "hercules", surface: "status", scope: "none", announce: "polite",
    text: "Your choices are in. {name}'s choices stay private until they submit.", slots: ["name"],
  }),
  entry({
    key: "categories.together", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Our household set", slots: [],
  }),
  entry({
    key: "categories.member-set", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "{name}'s choices", slots: ["name"],
  }),
  entry({
    key: "categories.review", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "Both lists are here. Review the ideas once, then add the agreed categories to the household list.", slots: [],
  }),
  entry({
    key: "categories.conflict", speaker: "hercules", surface: "card", scope: "none", announce: "polite",
    text: "The same category arrived in two versions. Choose the version you both want to keep.", slots: [],
  }),
  entry({
    key: "categories.accept", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Accept our category set", slots: [],
  }),
  entry({
    key: "categories.done", speaker: "hercules", surface: "status", scope: "none", announce: "polite",
    text: "The combined set is ready. No budget amounts or money moved.", slots: [],
  }),
  entry({
    key: "estimates.submit", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Submit my numbers", slots: [],
  }),
  entry({
    key: "onboarding.household.ch-10-estimates", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "It's okay to guess. This is the first shape, not a promise; Hearth will learn from what actually happens.", slots: [],
  }),
  entry({
    key: "estimates.open", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Add my first guesses", slots: [],
  }),
  entry({
    key: "estimates.title", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "What might a month look like?", slots: [],
  }),
  entry({
    key: "estimates.guide", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "Give each category a rough monthly amount. Leave any box blank when you don't have a useful guess yet.", slots: [],
  }),
  entry({
    key: "estimates.blank-help", speaker: "system", surface: "status", scope: "none", announce: "none",
    text: "Blank means not estimated. Enter 0 when you mean $0.00.", slots: [],
  }),
  entry({
    key: "estimates.currency", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Monthly guess (CAD)", slots: [],
  }),
  entry({
    key: "estimates.placeholder", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Leave blank", slots: [],
  }),
  entry({
    key: "estimates.missing", speaker: "system", surface: "status", scope: "none", announce: "none",
    text: "Not estimated", slots: [],
  }),
  entry({
    key: "estimates.waiting", speaker: "hercules", surface: "status", scope: "none", announce: "polite",
    text: "Your guesses are in. {name}'s stay private until they submit.", slots: ["name"],
  }),
  entry({
    key: "estimates.together", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "The first guesses", slots: [],
  }),
  entry({
    key: "estimates.member-set", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "{name}'s guesses", slots: ["name"],
  }),
  entry({
    key: "estimates.done", speaker: "hercules", surface: "status", scope: "none", announce: "polite",
    text: "Both sets are here. They shape the next proposal; they did not create a budget or move money.", slots: [],
  }),
  entry({
    key: "estimates.categories-first", speaker: "hercules", surface: "status", scope: "none", announce: "polite",
    text: "Finish the household category set before adding guesses.", slots: [],
  }),
  entry({
    key: "estimates.changed", speaker: "hercules", surface: "status", scope: "none", announce: "polite",
    text: "Our category set changed, so take another look at your guesses.", slots: [],
  }),
  entry({
    key: "estimates.invalid", speaker: "system", surface: "status", scope: "none", announce: "polite",
    text: "Use dollars and cents, like 125 or 125.50. Leave a box blank if you don't have a guess.", slots: [],
  }),
  entry({
    key: "runrate.absent", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "I've got nothing to go on yet — no month has gone by. This is built from the two of you and the bills we know about.", slots: [],
  }),
  entry({
    key: "proposal.basis.floor", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "at least the bills assigned here", slots: [],
  }),
  entry({
    key: "proposal.capacity", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "That's {total} against the {capacity} you said we have.", slots: ["total", "capacity"],
  }),
  entry({
    key: "proposal.edit.warn", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "Changing this clears both approvals. We'd each say yes again.", slots: [],
  }),
  entry({
    key: "approve.self", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "I approve this", slots: [],
  }),
  entry({
    key: "approve.waiting", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "Waiting on {name} to approve the same plan.", slots: ["name"],
  }),
  entry({
    key: "adopt.done", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "That's our first month. It's a plan, not a promise.", slots: [],
  }),
  entry({
    key: "onboarding.household.ch-11-plan", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "Let's lay out the first month together. Every number will show where it came from before either of you approves it.", slots: [],
  }),
  entry({
    key: "proposal.open", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Review our first plan", slots: [],
  }),
  entry({
    key: "proposal.title", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Our first month, laid out", slots: [],
  }),
  entry({
    key: "proposal.subtitle", speaker: "hercules", surface: "card", scope: "none", announce: "none",
    text: "A starting shape from your two guesses, known repeating costs, and only the history Hearth can honestly use.", slots: [],
  }),
  entry({
    key: "proposal.review-pause", speaker: "hercules", surface: "status", scope: "none", announce: "none",
    text: "Take your time here. Review the trail under every amount before giving your own yes.", slots: [],
  }),
  entry({
    key: "proposal.guesses", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Your two guesses", slots: [],
  }),
  entry({
    key: "proposal.recurrences", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Known repeating costs", slots: [],
  }),
  entry({
    key: "proposal.recurrence.none", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "No repeating cost is assigned here.", slots: [],
  }),
  entry({
    key: "proposal.recurrence.value", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "{amount} each · {cadence} · standing date {date}", slots: ["amount", "cadence", "date"],
  }),
  entry({
    key: "proposal.recurrence.month", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "This month: {count} × {amount} = {total} ({dates})", slots: ["count", "amount", "total", "dates"],
  }),
  entry({
    key: "proposal.recurrence.floor", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Repeating-cost floor: {amount}", slots: ["amount"],
  }),
  entry({
    key: "proposal.history", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Accepted history", slots: [],
  }),
  entry({
    key: "proposal.history.ready", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "{amount} from {weeks} complete weeks", slots: ["amount", "weeks"],
  }),
  entry({
    key: "proposal.history.short", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Not enough complete history yet.", slots: [],
  }),
  entry({
    key: "proposal.history.untied", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "No accepted history can be tied here yet.", slots: [],
  }),
  entry({
    key: "proposal.history.empty", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "No accepted spending is recorded here yet.", slots: [],
  }),
  entry({
    key: "proposal.basis.both", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Half-up average of both guesses", slots: [],
  }),
  entry({
    key: "proposal.basis.single", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "The one available guess", slots: [],
  }),
  entry({
    key: "proposal.basis.runrate", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Raised to accepted monthly history", slots: [],
  }),
  entry({
    key: "proposal.result", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Proposed for the month", slots: [],
  }),
  entry({
    key: "proposal.total", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "First-plan total", slots: [],
  }),
  entry({
    key: "proposal.capacity.absent", speaker: "hercules", surface: "status", scope: "none", announce: "polite",
    text: "You didn't enter a household capacity in this setup, so I'm not comparing this total with one.", slots: [],
  }),
  entry({
    key: "proposal.edit", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Change my guesses", slots: [],
  }),
  entry({
    key: "proposal.edit.title", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Change my monthly guesses", slots: [],
  }),
  entry({
    key: "proposal.edit.save", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Save a new version", slots: [],
  }),
  entry({
    key: "proposal.edit.cancel", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Keep this version", slots: [],
  }),
  entry({
    key: "proposal.edit.changed", speaker: "hercules", surface: "status", scope: "none", announce: "polite",
    text: "This version changed. Earlier approvals don't apply; each of you can review and say yes again.", slots: [],
  }),
  entry({
    key: "proposal.edit.invalid", speaker: "system", surface: "status", scope: "none", announce: "polite",
    text: "Use dollars and cents, like 125 or 125.50. Leave a box blank when you don't have a guess.", slots: [],
  }),
  entry({
    key: "approve.title", speaker: "system", surface: "card", scope: "none", announce: "none",
    text: "Two personal approvals", slots: [],
  }),
  entry({
    key: "approve.mine", speaker: "system", surface: "status", scope: "none", announce: "polite",
    text: "Your approval is on this version.", slots: [],
  }),
  entry({
    key: "approve.recorded", speaker: "system", surface: "status", scope: "none", announce: "polite",
    text: "{name} approved this version.", slots: ["name"],
  }),
  entry({
    key: "approve.pending", speaker: "system", surface: "status", scope: "none", announce: "none",
    text: "Not approved yet", slots: [],
  }),
  entry({
    key: "approve.complete", speaker: "hercules", surface: "status", scope: "none", announce: "polite",
    text: "You both approved this exact version. Nothing changes until one of you adopts it.", slots: [],
  }),
  entry({
    key: "adopt.self", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Adopt our first plan", slots: [],
  }),
  entry({
    key: "adopt.working", speaker: "system", surface: "status", scope: "none", announce: "polite",
    text: "Adopting this exact version", slots: [],
  }),
  entry({
    key: "adopt.retry", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Try adoption again", slots: [],
  }),
  entry({
    key: "adopt.failed", speaker: "hercules", surface: "status", scope: "none", announce: "polite",
    text: "That didn't go through. Nothing changed, and this exact version is still here to try again.", slots: [],
  }),
  entry({
    key: "adopt.recovery", speaker: "hercules", surface: "status", scope: "none", announce: "polite",
    text: "The books may have accepted this plan, but this device couldn't save the receipt. Use recovery before trying again.", slots: [],
  }),

  // E.6 The finale
  entry({
    key: "ready.checklist", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "Here's everything we set up.", slots: [],
  }),
  entry({
    key: "ready.self", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "I'm ready", slots: [],
  }),
  entry({
    key: "ready.waiting", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "Waiting on {name} to say they're ready.", slots: ["name"],
  }),
  entry({
    key: "unlock.done", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "That's it. Hercules is back to normal for both of us.", slots: [],
  }),
  entry({
    key: "unlock.honest", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "From here it's the ordinary work — the odd receipt, the odd shift. I'll keep the books, but I can't fill them in for you.", slots: [],
  }),
  entry({
    key: "personal.offer", speaker: "hercules", surface: "chat", scope: "none", announce: "none",
    text: "Whenever you want, I can show you the rest of what I do. No rush.", slots: [],
  }),
  entry({
    key: "personal.decline", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Not now", slots: [],
  }),
  entry({
    key: "personal.off", speaker: "system", surface: "button", scope: "none", announce: "none",
    text: "Stop offering these", slots: [],
  }),
]));

const SLOT_PATTERN = /\{([a-zA-Z]+)\}/g;

function isTestEnvironment(): boolean {
  return import.meta.env.MODE === "test";
}

function fillSlots(entryRow: CopyEntry, slots: Record<string, string>): string | null {
  let missing = false;
  const filled = entryRow.text.replace(SLOT_PATTERN, (_match, slotName: string) => {
    const value = slots[slotName];
    if (value === undefined) {
      missing = true;
      return "";
    }
    return value;
  });
  return missing ? null : filled;
}

/**
 * Look up one copy-deck entry and fill its {named} slots. Two situations
 * never reach a member as an empty string or a half-filled sentence:
 *
 * - The key isn't in the fixed Appendix E deck at all — most often a
 *   chapter's own copyKey/flavorKey before that chapter's slice has written
 *   its script (Part 2 builds those; this module only ships the deck). The
 *   key itself comes back, unconditionally, so a shell rendering it early
 *   shows a visibly-unfinished label instead of crashing.
 * - The key is in the deck but a required slot was left out. In a test run
 *   this throws — a call site missing a slot is a bug worth failing loud on.
 *   Anywhere else the key comes back the same safe way, never an empty
 *   string.
 */
export function copy(key: string, slots: Record<string, string> = {}): string {
  const entryRow = ONBOARDING_COPY[key];
  if (!entryRow) return key;
  const filled = fillSlots(entryRow, slots);
  if (filled !== null) return filled;
  if (isTestEnvironment()) {
    throw new Error(`onboarding copy "${key}" is missing a required slot.`);
  }
  return key;
}
