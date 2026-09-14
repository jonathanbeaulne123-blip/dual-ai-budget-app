# The Garden Queen — evidence

Chromium (SwiftShader), fictional Development books, Taylor's Scrapbook, the
`composition=queen&chrome=1` proof page.

| File | What it shows |
|---|---|
| `wide-3d.png` | 1100×800, WebGL. Ears, muzzle, whiskers, nose, the tail curled round her base, both front paws, the flower crown, white blooms down one side of her hair and crimson down the other, the clay grain and its white splatter over her terracotta. |
| `phone-3d.png` | 390×844, WebGL. The same reading at phone width; no page scroll. |
| `phone-flat.png` | 390×844 with `getContext` returning null — **no WebGL at all**. Every cat signal and both hair colours survive in the drawn path. |

The thin olive line across her lower left in both 3D frames is on `main` as
well (it predates this change) and is not introduced here.
