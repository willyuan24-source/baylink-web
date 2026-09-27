"""Contact sheet for the AI swap gate (lane V, wave 4 part 2): one row per run of ai-gate.mjs.

python scripts/opus-sf/assets/w4/gate_sheet.py OUT.jpg DIR SITE TAG[:label] [TAG[:label] ...] [--views three,street,far] [--thumb]

Each row: the label, the chosen views (JPEGs <DIR>/<SITE>-<TAG>-<view>.jpg, cropped to the centre 16:10 and scaled to
360 px wide) and, with --thumb, SoloView's 64 px thumbnail at 1:1 and nearest-upscaled 3x (the gate's "readable at
64 px" check).
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = {a.split("=")[0]: (a.split("=", 1)[1] if "=" in a else True) for a in sys.argv[1:] if a.startswith("--")}
out, d, site = args[0], args[1], args[2]
rows = [(t.split(":", 1) + [t])[:2] for t in args[3:]]
views = str(flags.get("--views", "three,street,far")).split(",")
thumb = "--thumb" in flags
W, H = 360, 225
cols = len(views) + (2 if thumb else 0)
sheet = Image.new("RGB", (cols * W, len(rows) * (H + 22)), "#f3ecdf")
dr = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("arial.ttf", 14)
except OSError:
    font = ImageFont.load_default()
for r, (tag, label) in enumerate(rows):
    y = r * (H + 22)
    dr.text((6, y + 3), f"{site} · {label}", fill="#3f3a36", font=font)
    for c, v in enumerate(views):
        p = os.path.join(d, f"{site}-{tag}-{v}.jpg")
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert("RGB")
        iw, ih = im.size
        th = round(iw * 10 / 16)
        if th <= ih:
            im = im.crop((0, (ih - th) // 2, iw, (ih - th) // 2 + th))
        sheet.paste(im.resize((W, H), Image.LANCZOS), (c * W, y + 22))
        dr.text((c * W + 6, y + 24), v, fill="#3f3a36", font=font)
    if thumb:
        p = os.path.join(d, f"{site}-{tag}-thumb64.png")
        if os.path.exists(p):
            t = Image.open(p).convert("RGB")
            x0 = len(views) * W
            sheet.paste(t, (x0 + 20, y + 22 + (H - 64) // 2))
            big = t.resize((192, 192), Image.NEAREST)
            sheet.paste(big, (x0 + 100, y + 22 + (H - 192) // 2))
            dr.text((x0 + 6, y + 24), "64 px (1:1 and x3)", fill="#3f3a36", font=font)
sheet.save(out, quality=88)
print(out, sheet.size)
