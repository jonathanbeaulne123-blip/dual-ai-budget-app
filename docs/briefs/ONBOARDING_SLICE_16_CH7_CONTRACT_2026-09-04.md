# Onboarding Slice 16 — Chapter 7 regular money contract

## Completion

Chapter 7 is complete only when the current Household contains at least two
distinct valid active Shared recurrences:

1. one expense is rent or a stable housing equivalent; and
2. at least one other recurrence is valid.

An existing recurrence counts exactly once. A Personal, paused, malformed,
wrong-currency, orphan-account, orphan-category, invalid-split, or invalid
transfer recurrence does not count.

## Authority

- `addRecurrence` and `updateRecurrence` remain the standing-fact commands.
- `postOneRecurrence` and `postDueRecurrences` remain separate money commands.
- Chapter 7 imports neither posting command and never advances a next date.
- Acknowledgement re-projects the live Household and writes only the acting
  member's Personal onboarding progress.

## Evidence

Accepted evidence is household-scoped and cites every qualifying recurrence by
id. Each visible row includes its label, human cadence, CAD amount, and next
date. Personal recurrence data is neither counted nor projected.

## UX

Bianca leads and Jonathan may contribute a regular item without being
mislabelled as the conductor. Hercules routes both people to the existing
Calendar Bills pane. The surface distinguishes a reminder, a standing fact
that anchors the plan, and an actual posted occurrence. During Chapter 7 the
form and confirmation save only a standing fact; due-post buttons, the bulk
post action, the save-and-post option, and the automatic due preview are absent.

After every third qualifying recurrence Hercules offers a calm pause. Extra
recurrences are optional; the household minimum is not.

## Kill criteria

- one recurrence, or two recurrences without a housing anchor, completes;
- a Personal or invalid recurrence counts or appears in Shared evidence;
- an existing recurrence is duplicated to satisfy onboarding;
- the chapter posts an occurrence, changes the journal, or advances a date;
- the onboarding form exposes `Mark paid`, bulk posting, or save-and-post;
- visiting Calendar or rendering evidence acknowledges the chapter;
- Jonathan is trapped in a witness-only state and cannot add a known item.
