# Companion integration proof

Use the configured Node runtime from the repository root. All generated output stays in ignored `.artifacts/hercules-slice-6/`; fixtures are synthetic.

- `node scripts/companion/dialogue-rehearsal.mjs`: execute all 24 prompt scripts through the local planner/provider-failure text path, record actual responses and assert no household mutation. Empty catalogue only; human scores and state-specific scenarios are not certified.
- Build with `VITE_HERCULES_DRESSING_ROOM=1`, build the Pro UI, then run `vite preview --host 127.0.0.1 --port 5193 --strictPort`.
- `node scripts/companion/browser-integration.mjs`: fresh actual-App demo, three themes, two views, six widths; help, memory controls and wardrobe launcher, working entry/wardrobe transitions and scoped axe checks. External requests are blocked and chat endpoints return 503.
- `node scripts/companion/invitation-proof.mjs`: desktop caption stacking, hit target, viewport bounds and click-to-help across three themes and three widths.
- `node scripts/companion/browser-access.mjs`: phone help/memory at 200% text, six theme/view cases, keyboard containment and axe.
- `node scripts/companion/wardrobe-access.mjs`: current 3D room at 200% text, swatch selection, keyboard containment, Escape focus restoration (including the phone Drawer after the desktop opener unmounts on resize) and page-error checks.
- Existing `scripts/wardrobe/proof/` runners cover the 3D fitting room, recovery and real-authority synthetic persistence. Their reports remain separately labelled slice 5 when rerun.

The [Bianca packet](../../docs/briefs/HERCULES_BIANCA_ACCEPTANCE.md) is the manual acceptance protocol. No runner grants human acceptance or deployment permission.

For an authorized deployed smoke, set `HEARTH_COMPANION_BASE_URL` on browser-integration, invitation-proof and wardrobe-access. They open a fresh synthetic demo, allow only GETs to the chosen site/local assets, and block model and mutation requests. These runners do not test authenticated household writes.
