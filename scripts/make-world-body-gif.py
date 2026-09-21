"""Little Harbour · the walk, as one animated picture.

Takes the frames `capture-world-body-evidence.py` left and writes a GIF of the
walk. Frames are cropped to the stage and scaled down, because the point of the
picture is the person walking, not the pixel count.

  python3 scripts/make-world-body-gif.py docs/evidence/world-body [--label=walk-full] [--width=1440]
"""
import os
import sys

from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "docs/evidence/world-body"
LABEL = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--label=")), "walk-full")
WIDTH = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--width=")), "1440")
SCALE = float(next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--scale=")), "0.5"))
MS = int(next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--ms=")), "700"))

names = sorted(n for n in os.listdir(OUT) if n.startswith(f"{LABEL}-{WIDTH}-") and n.endswith(".png"))
if not names:
    raise SystemExit(f"no frames for {LABEL} at {WIDTH} in {OUT}")

frames = []
for name in names:
    image = Image.open(os.path.join(OUT, name)).convert("RGB")
    frames.append(image.resize((int(image.width * SCALE), int(image.height * SCALE)), Image.LANCZOS))

path = os.path.join(OUT, f"{LABEL}-{WIDTH}.gif")
frames[0].save(path, save_all=True, append_images=frames[1:], duration=MS, loop=0, optimize=True)
print(path, len(frames), "frames", os.path.getsize(path) // 1024, "KB")
