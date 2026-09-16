# Our Path: next-level evidence set (2026-09-15)

Fictional proof books only. Captured by `node scripts/capture-path-next-level.mjs` (`ONLY=shots`) on branch `slice/path-a11y`, using headless Chromium 1194 with swiftshader WebGL at deviceScaleFactor 1. Local evidence; not merged or deployed. Raw data: `report-shots.json`.

Every capture checks:
- **page errors**: `pageerror` events
- **console errors**: `console` errors, with swiftshader GPU warnings filtered out (none occurred) and the expected three.js "Error creating WebGL context" set aside when WebGL is blocked on purpose
- **overflow**: horizontal overflow, true if `scrollWidth > innerWidth + 1`
- **live**: the host’s `data-live` value

The 15 theme × width shots use the well story, Region level and lantern Warm (Lite quality below 720, Full from 720 up).

| Capture | Page errors | Console errors | Overflow | `data-live` | Marks shown | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| [classic-well-320.png](classic-well-320.png) | 0 | 1 | no (320/320) | true | 8 | console: Failed to load resource: the server responded with a status of 404 (Not Found) (likely /favicon.ico on the proof server; first page of the browser) |
| [classic-well-390.png](classic-well-390.png) | 0 | 0 | no (390/390) | true | 9 |  |
| [classic-well-720.png](classic-well-720.png) | 0 | 0 | no (720/720) | true | 17 |  |
| [classic-well-1100.png](classic-well-1100.png) | 0 | 0 | no (1100/1100) | true | 21 |  |
| [classic-well-1440.png](classic-well-1440.png) | 0 | 0 | no (1440/1440) | true | 23 |  |
| [taylor-well-320.png](taylor-well-320.png) | 0 | 0 | no (320/320) | true | 8 |  |
| [taylor-well-390.png](taylor-well-390.png) | 0 | 0 | no (390/390) | true | 9 |  |
| [taylor-well-720.png](taylor-well-720.png) | 0 | 0 | no (720/720) | true | 17 |  |
| [taylor-well-1100.png](taylor-well-1100.png) | 0 | 0 | no (1100/1100) | true | 21 |  |
| [taylor-well-1440.png](taylor-well-1440.png) | 0 | 0 | no (1440/1440) | true | 23 |  |
| [newfoundland-well-320.png](newfoundland-well-320.png) | 0 | 0 | no (320/320) | true | 8 |  |
| [newfoundland-well-390.png](newfoundland-well-390.png) | 0 | 0 | no (390/390) | true | 9 |  |
| [newfoundland-well-720.png](newfoundland-well-720.png) | 0 | 0 | no (720/720) | true | 17 |  |
| [newfoundland-well-1100.png](newfoundland-well-1100.png) | 0 | 0 | no (1100/1100) | true | 21 |  |
| [newfoundland-well-1440.png](newfoundland-well-1440.png) | 0 | 0 | no (1440/1440) | true | 23 |  |
| [taylor-hard-stop-1100.png](taylor-hard-stop-1100.png) | 0 | 0 | no (1100/1100) | true | 6 | Hard story, Stop level. No month in the hard habitat has the Storm character, so the steepest month card (Jul, Lean · uphill) is open instead. · card: July 2026 · Lean · uphill / How Jul grew |
| [classic-reduced-720.png](classic-reduced-720.png) | 0 | 0 | no (720/720) | true | 17 | Reduced motion (`?motion=reduced` + emulated `prefers-reduced-motion`), Region, Warm. |
| [newfoundland-nowebgl-390.png](newfoundland-nowebgl-390.png) | 0 | 0 | no (390/390) | false | 0 | WebGL blocked in an init script: the flat map (`PathMiniMap`) with Hercules beside the tent button. · expected no-WebGL error ×1 |
| [taylor-outline-390.png](taylor-outline-390.png) | 0 | 0 | no (390/390) | true | 1 | "Everything on the island" expanded and scrolled into view. · 51 outline rows |
| [classic-tent-1100.png](classic-tent-1100.png) | 0 | 0 | no (1100/1100) | true | 3 | The tent open (today’s page stand-in); focus on "Back to the island". · tent open: true; focus: Back to the island |
| [taylor-empty-390.png](taylor-empty-390.png) | 0 | 0 | no (390/390) | true | 1 | Empty household (`catalogHousehold`): still a place to stand. |

Result: 21 captures. All have zero page errors, no horizontal overflow, and the expected `data-live` value (`false` only for the no-WebGL capture). One capture logged one console error, a 404 for a resource, most likely the favicon.

The accessibility pass (axe, keyboard, reachability) is in [../A11Y.md](../A11Y.md).
