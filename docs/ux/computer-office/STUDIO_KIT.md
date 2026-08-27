# Computer Home studio kit

How we turn the six canon stills into the kitchen. Fictional demo CAD only. Not a runtime for money: Confirm still posts.

Jonathan asked for tools that are **free or one-time**, plus a short list of subscriptions that would actually earn their keep. Official downloads only.

**Install order:** Core first. Extra when a slice needs fire, snow, or a moving object. Do not subscribe on day one.

Prices are USD list as of 2026-08-27, plus tax in CAD. Confirm at checkout.

---

## Core — required to make the stills the UI

These are the measuring stick + paint + kitchen. Without them, objects will not sit on the same desk.

| Tool | Cost | Get it | What it does for Hearth |
|---|---|---|---|
| **Blender 4.5 LTS** | Free | [blender.org/download/lts](https://www.blender.org/download/lts/) | Locked camera, desk plane, depth/Canny, hit-box coordinates, later Cycles renders |
| **fSpy** + Blender importer | Free | [fspy.io](https://fspy.io/) | Match the still’s vanishing lines so the wallet sits on *this* wood, not a new room |
| **Photopea** | Free | [photopea.com](https://www.photopea.com) | Masks, contact shadows, hole in the parchment for live `$412.00` |
| **Krita** | Free | [krita.org](https://krita.org) | Desktop paint-over if Photopea feels small. Same job, offline |
| **Chrome** (or Edge) at 1280 and ~1440 | Free (have) | — | The actual test: “do I sit at this desk?” |
| **Cursor GenerateImage** | Already in Cursor | — | Empty-room plate, then one object inpainted in that camera |
| **This Vite kitchen** | Already in repo | `pnpm dev` | Compositor: plates + HTML hits + Fraunces cents |
| **Cloudflare R2** | $0 at our size (10 GB free) | Cloudflare dashboard you already have | Host 4K plates. Do not git 20MB stills as the runtime |
| **PureRef** | Free to try; ~$7–$15 one-time if you keep it | [pureref.com/download.php](https://www.pureref.com/download.php) | Pin the six stills 1:1. Art bible for every slice |

**This weekend:** Blender, fSpy, Photopea (or Krita), PureRef, Chrome 1280. Cursor and the repo are already there.

---

## Extra — free or one-time, and they will set the room apart

Not required to composite the first empty cabin. These are how fire breathes, snow falls, a wallet opens, a wooden Sill Four looks carved.

### Free

| Tool | Get it | Why it sets us apart |
|---|---|---|
| **DaVinci Resolve** (free) | [blackmagicdesign.com](https://www.blackmagicdesign.com/products/davinciresolve) | Grade plates, cut a 4-second fire/snow WebM into a fireplace/window hole. Adventure-game motion without a 3D room. Fusion is included |
| **ComfyUI** | [github.com/comfyanonymous/ComfyUI](https://github.com/comfyanonymous/ComfyUI) | Local Flux + ControlNet from Blender depth so month-long stills share one camera. Needs a GPU. Skip if Cursor stills stay on-model |
| **Unreal Engine 5** | [unrealengine.com](https://www.unrealengine.com/) | **Authoring only:** Movie Render Queue stills/loops. Not the kitchen URL. Not pixel streaming |
| **Blender Cycles** | inside Blender | Shadow-catcher so a 3D calc or jar lands on the photo desk |
| **ArmorPaint** | [armorpaint.org](https://armorpaint.org) | Paint leather/wood on a mesh without Substance |
| **SuperSplat** | [playcanvas.com/supersplat](https://playcanvas.com/supersplat) | Clean Gaussian splats *if* we ever generate a multi-view room. The stills are not a real capture |
| **Poly Haven** | [polyhaven.com](https://polyhaven.com) | HDRIs and wood/leather scans for 3D proxies |
| **gltf-transform / gltfpack** | npm, free | Shrink any GLB. Still never ship the 7MB Hercules source on Add |
| **three.js 0.185** | already in `package.json` | Later overlay: fire, snow, Hercules in the still’s pose. Not the room |
| **Playwright** | already in repo | Proof at 1280/1440, keyboard, reduced-motion |

### One-time / permanent license

| Tool | List | Platform note | Why it sets us apart |
|---|---|---|---|
| **Affinity Photo 2** | ~$70 once if still sold as perpetual; confirm [affinity.serif.com](https://affinity.serif.com) | Mac/Win | Photoshop-class plates without a Creative Cloud sub. Skip if Photopea/Krita is enough |
| **DaVinci Resolve Studio** | $295 once | Mac/Win/Linux | Fairlight, more codecs, no watermark. Free Resolve is enough to start |
| **EmberGen Indie permanent** | $300 first year, then keep the app; optional $180/yr updates | **Windows or Linux GPU. Not macOS.** | Best dedicated fireplace. If you are on a Mac, use Resolve/generated fire WebM instead |
| **Substance 3D Painter perpetual** | historically ~$200 if Adobe still sells perpetual; else see subscriptions | Mac/Win | Hero leather wallet / wooden calc that must hold up in 3D |
| **Nomad Sculpt** | App Store, typically a one-time iPad buy | iPad | Sculpt a milk carton or lamp in your lap, export to Blender |
| **ZBrush perpetual** | ~$1,199 if Maxon still sells it; they also push a yearly plan | Mac/Win | Hero Hercules sculpt. Too much for Section 2. Blender sculpt covers proxies |

**Buy extra in this order if money is tight:** nothing → Affinity *or* stay on Photopea → EmberGen only if you have a Windows/Linux GPU and the fireplace must loop → skip ZBrush.

---

## Worth considering — subscriptions that would actually help

Do not start these until a slice names the gap. Cancel after the slice if the job is done.

| Service | Rough cost | Genuinely useful when |
|---|---|---|
| **Meshy Pro** or **Tripo** starter | ~$20/mo | A still crop must become a moving GLB (wallet opens, calc key, Fleet milk carton). Free tiers exist with attribution limits — paid owns the asset |
| **Fal.ai** or **Replicate** (pay per image) | cents to ~$0.50 per 4K Flux still | Cursor GenerateImage drifts off the locked camera and you do not want to run ComfyUI |
| **Adobe Substance 3D Texturing** | ~$25/mo | No perpetual Painter, and a hero mesh needs real leather/brass |
| **Adobe Photoshop / Firefly** (Photography or All Apps) | ~$10–90/mo | Generative Fill “add only the wallet on this plate.” Photopea cannot match that inpaint |
| **Protopie Basic** | $25/mo (Free = 2 prototypes) | You want to feel a physical tap (calc key, envelope) before we code it. The live kitchen can also be the prototype |
| **Runway / Kling** | paid credits | Fire, snow, or a cat-ear twitch as video plates. Watch grain match against the still |
| **JangaFX EmberGen monthly** | ~$20/mo indie, converts to permanent after enough months | If $300 up front is the blocker and you are on Windows/Linux |

**Skip as kitchen runtime even if you subscribe:** Spline as the room, Unreal pixel streaming, Figma as the cabin, Mixamo, a second WebGL engine (Babylon, PlayCanvas).

**Already paying, keep using:** Cursor, Cloudflare Workers, this repo.

---

## What “the vision becomes real” actually uses

```text
canon stills  →  fSpy + Blender camera
              →  empty-room plate (Cursor, later ComfyUI if needed)
              →  one object inpainted on that plate
              →  Photopea/Krita/Affinity mask
              →  Vite compositor + live cents
              →  Chrome 1280 / 1440
```

Fire/snow WebM, EmberGen, Meshy, and three.js overlay are how it *stops looking like a screenshot* after the empty room already matches.

---

## Privacy

Never upload household journal, credentials, or Production snapshots to any image or 3D service. Fictional Development numbers only (`$412.00`, milk `$12.50`).
