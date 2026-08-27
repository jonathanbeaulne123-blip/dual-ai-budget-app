# Computer Home studio — setup checklist

For Jonathan. No experience assumed. Tick boxes as you go. If a button name on your screen is different, **stop and send a screenshot** — do not guess.

**Pick your computer once and stick to it:**

- [ ] I am on **Mac**
- [ ] I am on **Windows**

Canon stills live in the repo: `docs/ux/computer-office/hearth-canon-*.jpg`  
Branch: `cursor/computer-office-d151-605a`  
GitHub folder: [docs/ux/computer-office](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/tree/cursor/computer-office-d151-605a/docs/ux/computer-office)

Never put household books, passwords, or Production screenshots in these apps. Fake numbers only (`$412.00`, milk `$12.50`).

When you finish **Parts 0–5**, reply: **studio is installed**.

---

## Part 0 — Make a folder bible

This is where every still, camera file, and plate will live. Do this first so later steps have a place to save.

### Mac

- [ ] Click the **Finder** icon (blue smiling face) in the Dock
- [ ] In the menu bar at the top of the screen, click **Go**
- [ ] Click **Home**. You should see folders like Desktop, Documents, Downloads
- [ ] Click **Documents**
- [ ] Right-click empty space inside Documents (or click **File** in the menu bar)
- [ ] Click **New Folder**
- [ ] Name it exactly: `hearth-office`
- [ ] Double-click `hearth-office` to open it
- [ ] Create these folders inside it, one at a time (right-click → New Folder), with these exact names:
  - [ ] `00-canon`
  - [ ] `01-fspy`
  - [ ] `02-blender`
  - [ ] `03-passes`
  - [ ] `04-comfy`
  - [ ] `05-plates`
  - [ ] `06-masks`
  - [ ] `07-grade`
  - [ ] `08-web`

### Windows

- [ ] Click the **folder** icon on the taskbar, or press the **Windows key** and type `Documents`, then Enter
- [ ] Click **Documents** in the left sidebar if you are not already there
- [ ] Right-click empty space → **New** → **Folder**
- [ ] Name it exactly: `hearth-office`
- [ ] Double-click `hearth-office`
- [ ] Create the same eight folders as the Mac list above

### Put the six stills in `00-canon`

- [ ] Open this page: [computer-office stills on GitHub](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/tree/cursor/computer-office-d151-605a/docs/ux/computer-office)
- [ ] Click `hearth-canon-tracker-sparse.jpg`
- [ ] Click the **Download raw file** button (down-arrow icon, top right of the file view)
- [ ] Save it into `Documents/hearth-office/00-canon`
- [ ] Repeat for:
  - [ ] `hearth-canon-household.jpg`
  - [ ] `hearth-canon-cpa-dense.jpg`
  - [ ] `hearth-canon-play-afterschool.jpg`
  - [ ] `hearth-canon-play-fleet.jpg`
  - [ ] `hearth-canon-play-boards.jpg`
- [ ] You should now see **six** JPG files in `00-canon`

---

## Part 1 — PureRef (the art bible)

We pin the six stills on one board so every later slice is judged against the picture, not memory.

- [ ] Open [https://www.pureref.com/download.php](https://www.pureref.com/download.php)
- [ ] Under **Choose platform**, pick **macOS** or **Windows** to match Part 0
- [ ] For Personal use you can leave the amount at **$0** (or pay $7–$15 if you want to support them)
- [ ] Click **Download**
- [ ] **Mac:** open the `.dmg` → drag **PureRef** into **Applications** → open **Applications** → double-click **PureRef**. If Mac says it cannot be opened: right-click PureRef → **Open** → **Open**
- [ ] **Windows:** run the installer → Next until Finish → open **PureRef** from the Start menu
- [ ] When PureRef opens you get an empty dark board
- [ ] Open Finder/Explorer to `Documents/hearth-office/00-canon`
- [ ] Select all six JPGs (Mac: click the first, Shift-click the last. Windows: Ctrl+A)
- [ ] Drag the six files onto the PureRef board
- [ ] Scroll / pinch so you can see all six
- [ ] Menu: **File → Save Scene As…**
- [ ] Save as `Documents/hearth-office/00-canon/hearth-canon.pur`

Check: opening that `.pur` file shows all six stills.

---

## Part 2 — Blender add-ons (including fSpy importer)

You already installed Blender and the **fSpy app**. Blender cannot see fSpy files until this zip is installed **inside Blender**.

### 2a. Download the importer zip (do not unzip)

- [ ] Open [https://github.com/stuffmatic/fSpy-Blender/releases/latest](https://github.com/stuffmatic/fSpy-Blender/releases/latest)
- [ ] Under **Assets**, click `fSpy-Blender-` then a version number then `.zip`  
  Example name: `fSpy-Blender-1.0.3.zip` (numbers may be higher)
- [ ] **Mac + Safari:** if the zip turns into a folder by itself, that is a problem. Go back, **right-click** the `.zip` link → **Download Linked File**. You need a **.zip file**, not a folder
- [ ] Put the zip in `Downloads` or `Documents/hearth-office/02-blender`
- [ ] Do **not** double-click it to unzip

### 2b. Open Blender Preferences

- [ ] Open **Blender**
- [ ] If a splash screen appears, click off it (click the dark area) so you see a cube in a grid
- [ ] **Mac:** click **Blender** (top-left menu bar, next to the Apple) → **Preferences…**
- [ ] **Windows:** click **Edit** (top menu) → **Preferences…**
- [ ] A Preferences window opens

### 2c. Enable bundled add-ons (already on your disk)

- [ ] In the left column of Preferences, click **Add-ons**
- [ ] At the top, find a search box
- [ ] Type `Node Wrangler`
- [ ] Tick the checkbox to the **left** of **Node Wrangler** so it is on
- [ ] Clear the search box
- [ ] Type `LoopTools` → tick **Mesh: LoopTools**
- [ ] Type `Extra Objects` → tick **Add Mesh: Extra Objects**
- [ ] Type `Images as Planes` → tick **Import-Export: Import Images as Planes**
- [ ] Type `Bool Tool` → tick it if it appears (if it does not, skip; not fatal)
- [ ] Type `Rigify` → tick **Rigging: Rigify**
- [ ] Leave Preferences **open** for the next step

### 2d. Install the fSpy importer from the zip

Blender 4.2 and 4.5 moved the button. Try A, then B.

**Method A (Blender 4.2+):**

- [ ] Still on **Add-ons** in Preferences
- [ ] Look at the **top right** of the Add-ons panel for a small **down-arrow** (▾) or **Install from Disk**
- [ ] Click it → **Install from Disk**
- [ ] In the file window, go to where you saved `fSpy-Blender-….zip`
- [ ] Click the **zip file once** (not a folder inside it)
- [ ] Click **Install from Disk**

**Method B (older layout):**

- [ ] On the Add-ons page, click **Install…** at the top
- [ ] Select the same zip → **Install Add-on**

Then:

- [ ] In the Add-ons search box, type `fSpy`
- [ ] Tick the checkbox **Import-Export: fSpy importer**
- [ ] Close Preferences (X)

### 2e. Check it worked

- [ ] In Blender, click **File** (top left)
- [ ] Point at **Import**
- [ ] You should see **fSpy (.fspy)** in that list
- [ ] If you do **not** see it: stop, screenshot File → Import, send it

You do not need to import a file yet. Seeing the menu item is the win.

---

## Part 3 — ffmpeg (turns Resolve movies into kitchen loops)

This is a small helper program with no pretty window. We only need it installed.

### Mac — easiest if you have Homebrew

- [ ] Open **Terminal**: press **Command + Space**, type `Terminal`, press Enter
- [ ] Type this and press Enter: `brew --version`
- [ ] If you see `Homebrew` and a number:
  - [ ] Type `brew install ffmpeg` and press Enter
  - [ ] Wait until the text stops and you see your name again
- [ ] If it says `command not found`:
  - [ ] Go to [https://evermeet.cx/ffmpeg/](https://evermeet.cx/ffmpeg/)
  - [ ] Download the latest **ffmpeg** `.zip`
  - [ ] Double-click the zip to unzip
  - [ ] You get a file named `ffmpeg` with no extension
  - [ ] In Finder, Go → Home → look for a folder named `bin`. If it does not exist: Go → Home, File → New Folder, name it `bin`
  - [ ] Move `ffmpeg` into `bin`
  - [ ] Back in Terminal, paste this and Enter (this lets the system find it next time):  
    `echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc`

### Windows

- [ ] Press **Windows key**, type `cmd`, press Enter (Command Prompt)
- [ ] Type `winget install Gyan.FFmpeg` and press Enter
- [ ] If it asks **Do you agree**, type `Y` and Enter
- [ ] Close Command Prompt, open a **new** one
- [ ] Alternative if winget fails: open [https://www.gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/) → download **ffmpeg-release-essentials.zip** → unzip → put the `bin` folder somewhere you will remember (for example `C:\ffmpeg\bin`) → search Windows for **Environment Variables** → Edit **Path** → New → paste that `bin` path → OK

### Check ffmpeg

- [ ] Open a **new** Terminal / Command Prompt
- [ ] Type `ffmpeg -version` and press Enter
- [ ] You should see several lines starting with `ffmpeg version`
- [ ] If `not recognized` / `command not found`: stop and send a screenshot of that window

---

## Part 4 — ComfyUI Manager + image nodes (not video)

You already installed **Comfy Desktop** and skipped the 53 GB video pack. Good. Now we add the **Manager** and **image** tools.

### 4a. Open Comfy and find Manager

- [ ] Open **ComfyUI** / **Comfy Desktop**
- [ ] Wait until the graph (grid) appears
- [ ] Look for a **Manager** button. Common places:
  - a button in the **sidebar**
  - **Menu** (top) → **Manager**
  - a **puzzle-piece** or **gear** labelled Manager
- [ ] Click **Manager**
- [ ] If you see **Install Missing Custom Nodes** or a list of nodes, you already have Manager. Go to 4b
- [ ] If there is **no Manager** at all: in Manager instructions from Comfy, use **Terminal** inside the app if it offers **Install ComfyUI-Manager**, or send a screenshot of the whole Comfy window

### 4b. Install these custom nodes (one at a time)

In Manager, open **Custom Nodes Manager** (or **Install Custom Nodes**).

For each name below: search → click **Install** → wait until it says installed. Do not install Video / MiniMax / Wan.

- [ ] Search `ControlNet Auxiliary` → install **ComfyUI's ControlNet Auxiliary Preprocessors** (often listed as `comfyui_controlnet_aux`)
- [ ] Search `rgthree` → install **rgthree-comfy**
- [ ] Search `Custom Scripts` or `pysssss` → install **ComfyUI-Custom-Scripts**
- [ ] Search `Inpaint CropAndStitch` → install **ComfyUI-Inpaint-CropAndStitch**
- [ ] Search `BiRefNet` or `RMBG` → install **one** background-removal pack (either is fine)
- [ ] Search `KJNodes` → install **ComfyUI-KJNodes** if it appears

Then:

- [ ] In Manager, click **Restart** (or close Comfy completely and open it again)
- [ ] Wait for it to come back

### 4c. Flux + ControlNet models (large download — do when you can leave the machine)

This can be **several GB**. It is required for locked-camera stills later, not for ticking “folders + PureRef + Blender” today.

- [ ] In Comfy Manager, open **Model Manager** (or **Install Models**)
- [ ] Search `flux` — pick a **Flux** image model (schnell or dev). Prefer **GGUF** / smaller if the UI shows a size under ~8 GB and your machine is a laptop
- [ ] Search `controlnet flux` or `flux depth` — install a **Flux ControlNet depth** or **canny** model if listed
- [ ] If Model Manager has nothing useful: **stop and send a screenshot**. Do not download random 20 GB files from third-party sites
- [ ] Leave Comfy open until downloads finish
- [ ] Restart Comfy once more

If disk or time is tight: finish Parts 0–3 and 4a–4b tonight, do 4c tomorrow, and say so when you message.

---

## Part 5 — Smoke-open the other apps (30 seconds each)

No project yet. We only prove they launch.

- [ ] Open **fSpy** (the camera app, not Blender). You should see a dark window that can open an image. Quit
- [ ] Open **Krita**. Quit at the start screen
- [ ] Open **Affinity Photo**. Quit
- [ ] Open **DaVinci Resolve**. If it asks to log in, you can skip / use local. Quit
- [ ] Open **Chrome**, make a **new window**, drag the corner until the width feels like a laptop (or use DevTools later — not required tonight)

---

## Part 6 — Done

Copy this and send it (fill the blanks):

```text
studio is installed
Computer: Mac / Windows
PureRef: yes / no
Blender File → Import → fSpy: yes / no
ffmpeg -version: yes / no
Comfy Manager: yes / no
Flux download: done / tomorrow
Stuck on: (describe or “nothing”)
```

---

## If you get stuck (do this, not a random YouTube video)

1. Take a **screenshot** of the whole window
2. Tell me the **Part number** (0–5)
3. Paste any **error text**

I will give the next click. Do not improvise past a red error.
