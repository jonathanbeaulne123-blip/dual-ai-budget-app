# Product questions — Household timezone + Add location (D-126)

**Status:** awaiting Jonathan locks  
**Opened:** 2026-08-25  
**Rule:** Jonathan makes every user-affecting decision. Implementation uses provisional defaults only until you answer.

## Locked by your instruction (already accepted)

| # | Decision | Lock |
|---|---|---|
| L1 | Household civil dates may use any valid IANA timezone (not forced Toronto). | Accepted |
| L2 | App offers location-services options so Add can attach real time + location. | Accepted |
| L3 | Jonathan owns all further user-facing product choices for this feature. | Accepted |

## Still need your answer

Reply with letters (e.g. `Q1 A, Q2 B, …`). Provisional code follows the **bold** option until you change it.

### Q1 — Default timezone for a brand-new household
- **A (provisional):** Detect this phone’s IANA zone; if invalid, `America/Toronto`.
- B: Always start as `America/Toronto`; user must change it in More.
- C: Ask on first-run create (required field).

### Q2 — Who may change the household timezone
- **A (provisional):** Any active member, via More → Clock & place (shared household setting).
- B: Owners only.
- C: Each phone keeps its own display zone; books stay Toronto civil (rejects your L1 intent — listed only to refuse).

### Q3 — Location services default on a fresh phone
- **A (provisional):** Off until the member enables it on this phone.
- B: Prompt once the first time they open Add.
- C: On by default after OS permission.

### Q4 — How location attaches on Add
- **A (provisional):** Explicit control: “Use current time & place” (and clear). Never auto-attach on Post.
- B: When location is enabled, every Confirm auto-stamps coords + now.
- C: Separate toggles for time stamp vs coordinates.

### Q5 — Where location is stored
- **A (provisional):** On the transaction inside the household snapshot (syncs with books when continuity runs). Place text remains editable.
- B: Phone-local only (never in snapshot / never shared with partner).
- C: Snapshot stores place label only; coords stay phone-local.

### Q6 — Model / Hercules disclosure
- **A (provisional):** Strip latitude/longitude/accuracy from every model payload. Human `place` text keeps existing quiet-redaction rules.
- B: Also strip `place` whenever a location stamp exists.
- C: Allow coords in model context when the member opts in.

### Q7 — Office weather after timezone change
- **A (provisional):** Keep Toronto Open-Meteo coords this pass (atmosphere only; not books).
- B: Switch weather to browser geolocation when location is enabled.
- C: Map timezone → a fixed city lat/lng table.

### Q8 — Hosted Supabase `timezone = America/Toronto` CHECK
- **A (provisional):** Ship unapplied SQL `004_household_timezone_iana.sql`; local PGlite accepts any IANA now. You apply hosted ALTER when ready. Until then non-Toronto may fail cloud upsert honestly.
- B: Block shipping until you apply hosted ALTER on Development.
- C: Keep forcing Toronto on any household that is linked/syncing.

---

After you answer, implementation renumbers confirmation into **D-126** and adjusts any provisional UI.
