"""Wave-5 secret postcards (lane V, W5-V8 / H5-2): raw 4:3 PNG -> public/opus-bay/w5/postcards/<egg id>-1200.webp + -600.webp.

python scripts/opus-sf/assets/w5/postcards.py <egg id>=<raw.png> [...]

The export of every shipped postcard (ASSETS-LEDGER "Postcards: centre-crop to 4:3, then 1200 + 600 WebP q82"; wave 4's
scripts/opus-sf/assets/w4/postcards.py), into lane V's wave-5 folder. Prints one JSON line per file (bytes, size, sha256)
for the ledger and src/opus-bay/data/sf/eggPostcards.ts.
"""
import hashlib, json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", "public", "opus-bay", "w5", "postcards"))


def full43(im):
    W, H = im.size
    tw = round(H * 4 / 3)
    if tw <= W:
        x0 = (W - tw) // 2
        return im.crop((x0, 0, x0 + tw, H))
    th = round(W * 3 / 4)
    y0 = (H - th) // 2
    return im.crop((0, y0, W, y0 + th))


os.makedirs(OUT, exist_ok=True)
for arg in sys.argv[1:]:
    cid, src = arg.split("=", 1)
    im = full43(Image.open(src).convert("RGB"))
    for w, h in ((1200, 900), (600, 450)):
        out = os.path.join(OUT, f"{cid}-{w}.webp")
        im.resize((w, h), Image.LANCZOS).save(out, "WEBP", quality=82, method=6)
        data = open(out, "rb").read()
        print(json.dumps({"file": f"w5/postcards/{cid}-{w}.webp", "bytes": len(data), "size": [w, h],
                          "sha256": hashlib.sha256(data).hexdigest()}))
