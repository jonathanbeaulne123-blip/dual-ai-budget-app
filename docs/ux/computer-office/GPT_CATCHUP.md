# GPT catch-up — photoreal computer cabin (2026-08-27)

Paste this file (or this folder) into GPT/Codex so it is current. This is a **reconstructed briefing** of the Cursor Cloud Agent thread with Jonathan, plus the living files that thread used. It is **not** a verbatim dump of every tool call. GitHub remains durable canon (D-095). This PR is **not shipped**.

- **People:** Jonathan (product), Bianca (household). Dual Course: books **5**, Hercules/interactables **3**; books win.
- **Repo:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/computer-office-d151-605a`
- **Base:** `main@e7ad717`
- **Head when written:** `436d32c`
- **Draft PR:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/207
- **Agent:** Cursor Grok (Cloud Agent), implementer. Codex/GPT was not in this thread.
- **Do not:** merge, deploy, Production, hosted schema, secrets, restyle phone unless Jonathan unfreezes it.

---

## What GPT must read first (this packet)

1. This file
2. [`AGENTS.md`](../../AGENTS.md) — constitution + **Computer Home studio + handholding**
3. [`docs/COMPUTER_OFFICE.md`](../COMPUTER_OFFICE.md) — D-151/D-152 program
4. [`docs/DECISIONS.md`](../DECISIONS.md) — D-151, **D-152**
5. [`docs/ux/computer-office/README.md`](README.md) — six **canon JPGs**
6. [`docs/ux/computer-office/STUDIO_SETUP_CHECKLIST.md`](STUDIO_SETUP_CHECKLIST.md) — Jonathan’s tick list
7. [`docs/ux/computer-office/STUDIO_PIPELINE.md`](STUDIO_PIPELINE.md) — who owns which job
8. [`docs/ux/computer-office/STUDIO_KIT.md`](STUDIO_KIT.md) — free / one-time / subs
9. [`docs/AI_HANDOFF.md`](../AI_HANDOFF.md) — top sections D-152 then D-151

**Do not plan from** `docs/nostalgia/` or `docs/reference/`.

**Pixel files to open:** `hearth-canon-tracker-sparse.jpg`, `hearth-canon-household.jpg`, `hearth-canon-cpa-dense.jpg`, `hearth-canon-play-afterschool.jpg`, `hearth-canon-play-fleet.jpg`, `hearth-canon-play-boards.jpg`. Earlier `hearth-desk-layout-*.png` are a **superseded** generation.

---

## The one-sentence status

Jonathan rejected the CSS night-cabin as awful and unlike the pictures. Computer Home must become those six photoreal stills **exactly**, as a locked-camera plate compositor, one asset at a time, over the month. Kernel (Commands, Confirm, three-view breakpoint, Play games that never post) can stay. Phone/tablet stay mostly untouched. Empty-room pixels in the app are **locked** until Jonathan replies **studio is installed**. AIs must **handhold** every DCC click — he has no Blender/Comfy experience.

---

## Decisions locked in this thread

| Topic | Decision |
|---|---|
| Pixel target | The six photoreal JPGs, not the CSS cabin, not the older PNGs |
| Phone / tablet | Mostly untouched. If a desktop UX change would port cleanly to mobile, **stop and ask** |
| Confirm / money | Confirm still posts. Games `postedIds: []`. No CAD on weather glass |
| Visual medium | 2.5D plates (empty room + object plates + HTML hits + Fraunces in paper holes). Not Spline-as-room, not Unreal pixel streaming, not more `office-room.css` |
| Studio | Jonathan has Blender, fSpy, Krita, Affinity Photo, DaVinci Resolve, ComfyUI. Glue still: PureRef, fSpy **Blender importer**, ffmpeg, Comfy Manager, Flux later |
| Affinity Designer vs Photo | **Photo** is the plate tool. Designer is not a substitute |
| Comfy starter workflow | **Skip & Install.** Do not pick MiniMax 53 GB video |
| fSpy GitHub Assets | Download OS installer, then separately install the Blender importer zip |
| AI behaviour | Use the studio when visual work warrants it. Asking Jonathan to click those apps = numbered/checkbox steps, exact menus, stop-and-screenshot |
| “Product law” page | Do **not** add a new Product law page for this cabin. Dual Course already lives in `STRATEGY.md` / roadmap §1.1 |
| Hercules coat | Cream Maine Coon (D-061) vs white/ginger in stills — deferred until sofa/cat slice |
| Not shipped | Do not merge #207 as the CSS cabin. Do not call live |

---

## Chronology of this chat (reconstructed)

Times are the Cloud Agent thread on **2026-08-27**, Toronto-adjacent UTC stamps in the log. Earlier the same day, a **previous** pass on this branch implemented D-151 T0–T5 as an HTML/CSS cabin.

### A. Earlier the same day (before the “it’s awful” turn)

Jonathan had locked computer-office mockups and a gated plan (`desktop_room_overhaul`). Cursor implemented on `cursor/computer-office-d151-605a`:

- Three views: phone `<720` `OfficePhone` Draft C; tablet `720–1279` scaled phone; computer `≥1280` cabin
- `src/office-room.css` night cabin (wood, CSS fireplace, cream instrument cards, gold nav)
- Layout v3, auto-size, Play parks calculator, Kitchen Fleet / Sill Four / Pane Boxes with empty `postedIds`
- Draft PR **#207**
- Superdesign CLI **never authenticated** on the Cloud VM; locked PNGs were **Cursor GenerateImage**, not Superdesign canvas
- Verifier caught a dropped `office-phone.css` import; restored in `60e0db7`
- Visual proof existed at 390/768/1280/1440 — and **looked like cream cards on brown wood**

### B. Jonathan: from-the-ground-up rebuild (plan, do not implement pixels)

He attached **six new photoreal first-person cabin JPGs** (wallet, parchment `$412.00`, CAD pad `1250`/`$12.50`, Mail, Play boards, Kitchen Fleet, CPA desk, Household). He said the CSS cabin was **awful**, he does **not** want the old app look, everything can be redesigned, **not today** — use the month. **No kind of. No almost. Exactly the same.** Roadmap only: workable testable sections, Jonathan approves each major decision, **one asset at a time**. Analyze software/services.

Cursor produced a gated month plan (empty room → wood nav → blotter → calc → wallet → …). Recommended **fixed-camera 2.5D plates**, not Unreal streaming.

### C. Expand the studio (Blender, Spline, perfect suite)

Jonathan asked to expand Blender/Spline/etc. into the perfect UI suite and what to download. Cursor’s honest take: **Spline will not make those pictures** (plastic PBR). Use plates; Spline only to prototype then **bake**. Blender is the measuring stick; GenerateImage/Comfy paint; Affinity/Krita masks; R2 hosts 4K; `three.js` already in repo for Hercules Pro / later overlay, never 7MB fur on Add (D-061).

### D. Full animator/UX catalog; Gate 0 includes setup; rest locked

Jonathan: setup that can make anything, then one step at a time to the dot. Gate 0 = product **and** setup choices. Rest of plan locked until he confirms setup ready. Full catalog for him to select. Cursor wrote the catalog (PureRef, fSpy, Maya, Unreal **authoring**, EmberGen, Nuke, Meshy, Protopie, …) with Select/Later/Skip. Default Rec: plates. Unreal/Maya/Nuke as **authoring**, not the PWA.

### E. Q&A on freeze, jargon, cost

Jonathan:

1. Lock stills yes; phone **mostly untouched**; if desktop UX would easily port to mobile, **stop and tell him**
2. “What does this mean” → explained **kernel keep** (don’t rewrite money posting) and **Bundle S vs L**
3. Happy to install whatever; asked **bundle costs**

Cursor: Bundle S ≈ **$0**. Bundle L if you subscribe to everything ≈ **$230–260/mo** — wrong checkout. Sane L: $0–70 this month, $20/mo only when a wallet must open.

### F. Write the docs; no Product law page; free/one-time list

Jonathan: AIs may write living docs if well integrated; **do not add a Product law page**. He can get free and one-time tools. List: **core necessary**, **extras that set us apart**, **worth-considering subs**.

Cursor wrote D-152, copied six JPGs into `docs/ux/computer-office/`, `STUDIO_KIT.md`, retargeted `COMPUTER_OFFICE.md` (CSS cabin is not the look). Dual Course in STRATEGY/roadmap §1.1 **unchanged**.

### G. How do I install fSpy?

Jonathan was on GitHub Releases **fSpy v1.0.3** Assets. Cursor: download OS file (dmg/exe/AppImage), then **separately** the **fSpy-Blender zip**, Install from Disk in Blender, File → Import → fSpy.

### H. Which Comfy starter workflow?

Video tab: MiniMax 53 GB, Seedance credits, Wan 11 GB. Cursor: **Skip & Install.** Hearth needs Flux+ControlNet **stills**, later.

### I. Affinity Designer vs Photo?

**Photo** = plates. Designer = vectors, not a substitute. Universal license only if he wants both.

### J. Suite is up; go crazy with plugins/automations/skills

Jonathan listed: Blender, fSpy, Krita, Resolve, Comfy, Affinity Photo. Asked what is still required for a full UI studio.

Cursor wrote `STUDIO_PIPELINE.md`: job map; **MUST** glue (importer, Node Wrangler, Comfy Manager, ffmpeg, PureRef); STRONG add-ons; LATER crazy list; automations (`camera.json`, Playwright vs canon); skills. Did **not** start the compositor.

### K. Beginner checklist + AIs must handhold

Jonathan: checklist to apply all of this; note tools in project docs; **always use when warranted**; caveat: when asking him to use them, AIs **must** give step-by-step instructions; **no experience, major handholding**.

Cursor: `STUDIO_SETUP_CHECKLIST.md` Parts 0–6; `AGENTS.md` / `CLAUDE.md` / `AI_OPERATING_MODEL.md`; `.cursor/rules/35-office-studio.mdc`; `.claude/rules/office-studio.md`.

### L. This catch-up doc

Jonathan asked for a transcript/context doc so GPT can catch up. This file.

---

## What is on the branch (code vs look)

**Keep (money-safe plumbing):** `COMPUTER_BREAKPOINT = 1280`; tablet → `OfficePhone`; layout v3 + `packComputerDesk`; Play parks pad; Fleet/Four/Panes commands `postedIds: []`; furniture notify skip; Hercules `desktopFly` only at computer width; both `office-phone.css` and `office-room.css` imported.

**Throw away as the look:** cream instrument cards, CSS brick fireplace, any “make the cards more paper-like” pass. `src/office-room.css` is leftover plumbing, not the product face.

**Replace when unlocked:** computer Home renderer → plate compositor + HTML hit overlay. Live `$412.00` and `$12.50` stay journal-true.

---

## Studio Jonathan already has vs glue still to tick

**Has:** Blender, fSpy **app**, Krita, Affinity Photo, DaVinci Resolve, Comfy Desktop (skipped video pack).

**Checklist still to finish** ([`STUDIO_SETUP_CHECKLIST.md`](STUDIO_SETUP_CHECKLIST.md)):

- Folder bible `Documents/hearth-office/00-canon` … `08-web`
- PureRef + six stills
- Blender: Node Wrangler, LoopTools, Extra Objects, Images as Planes, Rigify, **fSpy importer zip**
- `ffmpeg -version`
- Comfy Manager + image custom nodes; Flux+ControlNet can be “tomorrow”

When he sends **studio is installed**, the next household slice is **empty computer Home**: desk, fire, snow, sofa, **no widgets, no old chrome**. One still. Jonathan continue/revert.

---

## Project context the agent used (besides this chat)

| Source | Why |
|---|---|
| `AGENTS.md`, `CLAUDE.md`, `docs/AI_OPERATING_MODEL.md` | Dual Course, no Production, one writer |
| `docs/COMPUTER_OFFICE.md`, `docs/OFFICE.md`, `docs/HEARTH_UI_THEME.md` | Three views, frozen phone |
| `docs/DECISIONS.md` D-048, D-050, D-061, D-079, D-082, D-151, D-152 | Confirm, CAD pad, cream cat source GLB, warmth, three views, stills |
| `docs/STRATEGY.md`, `docs/HEARTH_ROADMAP.md`, `docs/ARCHITECTURE.md` | Living plan; books win |
| `docs/README.md` | Docs index |
| `package.json` | `three@0.185.1` already; Vite/PGlite kitchen |
| `models/README.md` | `hercules.source.glb` is source, not Add |
| `src/Office.tsx`, `office-room.css`, `officeLayout.ts` | What the CSS cabin actually is |
| PR #207 thread / commits listed above | Implementation that Jonathan visually rejected |
| External (for prices/install): blender.org LTS, fspy.io, JangaFX EmberGen, PureRef, Meshy/Tripo, Affinity, Protopie, Cloudflare R2, ComfyUI-Manager, gyan.dev ffmpeg | Studio kit accuracy |

**Not used as the plan:** `docs/nostalgia/`, `docs/reference/`, Apps Script / clasp.

---

## How GPT should talk to Jonathan about tools

He asked for **major handholding**. Do not say “enable Node Wrangler.” Say: open Blender → Mac **Blender → Preferences…** / Windows **Edit → Preferences…** → Add-ons → search `Node Wrangler` → tick the checkbox → you should see it stay ticked. If the screen differs, stop and screenshot.

Never upload household journal or Production data to Comfy/Meshy.

---

## Next owner

**Jonathan:** tick [`STUDIO_SETUP_CHECKLIST.md`](STUDIO_SETUP_CHECKLIST.md), then **studio is installed**.

**GPT/Cursor after that:** Section 2 only — empty Home suite plate, no widgets. Do not restyle phone. Do not merge. Do not treat CSS cabin screenshots on PR #207 as the pixel target.
