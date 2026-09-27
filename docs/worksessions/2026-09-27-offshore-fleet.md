# Hearth worksession — offshore fleet

- Status: OPEN, local implementation
- Opened: 2026-09-27 (America/Toronto)
- Owner / decision owner: Jonathan
- Assignee: Codex; bounded read-only movement and layout audits
- Repository: dual-ai-budget-app
- Branch: codex/offshore-fleet
- Baseline: 22c95b8b82cb3774f0b5f2aba6f562825aff6b0c (fresh main clone)
- Risk: High — shared movement, dynamic collision, airborne landing and restoration
- Environment impact: local recreational state only

## Outcome and scope

Implement the attached four-craft brief in the actual Horizon runtime: a tandem kayak, tender, fast motorboat and physically reached, walkable moving yacht. The yacht includes connected accommodation, service and operational spaces and stable galley station anchors for a future cooking game.

Budget delta (5): 0; preserve all ledger, identity, scope and Final Confirm owners.
Engagement delta (3): distinct water journeys and an explorable offshore destination.

Current main has no implemented boats or swimming; the boat mode names are placeholders. Its Horizon camera has one orbit perspective and its shared wind is currently constant. Other active checkouts are not this baseline. Keep one runtime movement owner, extend shared geography with dynamic providers, and reuse the existing flight landing query.

## Acceptance

- [ ] Distinct frame-rate-independent handling; gentle contact and low-speed docking.
- [ ] Physical boarding, local seats, secure return craft, swimming/ladders.
- [ ] Rotating/translating deck support exactly once, stairs, walls, airborne arrivals.
- [ ] Full yacht rooms and navigable galley work cycle; three authored material treatments.
- [ ] Identity-scoped atomic fleet/support restore; no invented multiplayer.
- [ ] Focused tests, quick gate, build and actual runtime browser journeys recorded.

No recipe/scoring system, financial changes, schema application or deployment is in scope.

## Evidence and handoff

Implementation and validation in progress. Local checks are distinct from physical-device, live hosted and release acceptance.
