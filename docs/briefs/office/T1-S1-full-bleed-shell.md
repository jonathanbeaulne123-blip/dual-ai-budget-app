# T1-S1 — Full-bleed computer shell

When breakpoint is computer AND tab is Home, `.app.is-office-computer` is full viewport (no `min(900px)`). Room shell: window, shelves, sofa, desk. Desk is full-width wood in the lower half. Nav gold on the desk front edge. Weather stays in the window. CAD never on glass.

```text
Implement T1-S1 from docs/briefs/office/T1-S1-full-bleed-shell.md.

When breakpoint is computer AND tab is Home, .app.is-office-computer is full viewport (no min(900px)). Office.tsx computer branch: render .office-room with layers window, shelves, sofa, desk. Desk is a full-width wood surface in the lower half matching hearth-computer-night-cabin-full-desk.png. Move nav chrome onto the desk front edge on this branch only. Weather stays in the window via OfficeWindow; CAD never on glass.

Forbidden: 12-column grid; glassmorphism; 10px labels; putting this shell on tablet. Tests: computer class present ≥1280 Home; .app max-width 900 still applies to phone/tablet. pnpm test.
```
