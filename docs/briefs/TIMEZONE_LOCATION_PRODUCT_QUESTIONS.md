# Product questions — Household timezone + Add location (D-126)

**Status:** LOCKED by Jonathan 2026-08-25  
**Rule:** Jonathan makes every user-affecting decision.

## Direction locks


| # | Decision | Lock |
|---|---|---|
| L1 | Any IANA may be used for **phone display**; books civil dates stay Toronto per Q2 C. | Accepted; narrowed by Q2 C |
| L2 | App offers location-services options so Add can attach real time + location. | Accepted |
| L3 | Jonathan owns all further user-facing product choices for this feature. | Accepted |

## Answers


| Q | Choice | Meaning |
|---|---|---|
| Q1 | **A** | New phone display zone defaults to detected device IANA (else `America/Toronto`). |
| Q2 | **C** | Each phone keeps its own **display** zone; **books civil dates stay America/Toronto**. |
| Q3 | **A + B** | Location off by default; prompt once the first time Add opens. |
| Q4 | **C** | Separate toggles for time stamp vs coordinates. |
| Q5 | **A** | Location stored on the transaction in the household snapshot. |
| Q6 | **C** | Coords may reach the Hercules model only when the member opts in. |
| Q7 | **B** | Office weather uses browser geolocation when location is enabled. |
| Q8 | **A → applied** | Hosted `007_household_timezone_iana.sql` (schema id 7) applied 2026-08-25 by Jonathan. |

## Implementation map

- Phone prefs (`hearth:phonePlace:<env>`): display zone, locationAllowed, addPromptSeen, stampTime, stampCoords, shareCoordsWithModel.
- Books posting/`todayKey` for money: `America/Toronto`.
- More → Clock & place: phone clock + location toggles (not a shared household timezone command).
- Add: first-open prompt; Stamp time / Stamp place / Use now.
- Weather: Open-Meteo at browser coords when locationAllowed.
- Hercules: `shareCoordsWithModel` gate on disclosure.
