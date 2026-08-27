# T2-S1 — Desk layout v3 + auto-size

Computer layout schema v: 3: `{ items, autoSize, personality }`. Default = Household seed. `autoSizeVisible(count)`: L if ≤4, M if ≤8, else S. Pack onto the desk rectangle. Soft-migrate v2 wide JSON. Phone/tablet JSON untouched. Calculator cannot hide (Play exception is T4).

```text
Implement T2-S1 from docs/briefs/office/T2-S1-desk-layout-v3.md.

Computer layout schema v: 3. Default computer layout = Household seed. autoSizeVisible(count): L if ≤4, M if ≤8, else S. pack objects onto the desk rectangle. Soft-migrate v2 wide JSON. PINNED_INSTRUMENTS calculator still cannot hide except Play. Tests for autoSize and migration. pnpm test.
```
