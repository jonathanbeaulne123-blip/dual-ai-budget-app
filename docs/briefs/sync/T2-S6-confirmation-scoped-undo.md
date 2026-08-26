# T2-S6 — Confirmation-scoped undo

**Tier:** 2  
**Depends on:** T2-S2, Packet 6 / D-119 supersession  
**Risk:** High

## Goal

Undo/reverse only this member's confirmation ids; never tombstone partner live-pulled rows. Align with D-124 restore rebase rules.

## Allowed scope

- Replace whole-snapshot Dev undo path
- UI copy truth per command classification

## Forbidden

- Whole-household snapshot restore as default undo in dual-use

## Acceptance

- [ ] Two-phone: A undo cannot remove B's concurrent post
- [ ] Reversal journal integrity preserved

## Cursor prompt

```text
Implement T2-S6 from docs/briefs/sync/T2-S6-confirmation-scoped-undo.md.

Replace whole-snapshot undo with confirmation-scoped undo using command receipts. Two-phone tests proving partner rows survive. Update UI copy. Run pnpm test. Handoff with command classification table.
```
