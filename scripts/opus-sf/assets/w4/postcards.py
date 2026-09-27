"""Wave-4 postcards (lane V, W4-C9 / H-7): raw 4:3 PNG -> public/opus-bay/postcards/<id>-1200.webp + -600.webp.

python scripts/opus-sf/assets/w4/postcards.py id=raw.png [id=raw.png ...]

The export of the 12 shipped SF postcards (C:/Users/willy/opus-qa/assets-work/sf/export_postcards.py, ASSETS-LEDGER
"Postcards: centre-crop to 4:3, then 1200 + 600 WebP q82"), writing into this checkout. Prints one JSON line per file
(bytes, size, sha256) for the ledger and data/sf/w4Postcards.ts.
"""
import hashlib, json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", "public", "opus-bay", "postcards"))


def full43(im):
    W, H = im.size
    tw = round(H * 4 / 3)
    if tw <= W:
        x0 = (W - tw) // 2
        return im.crop((x0, 0, x0 + tw, H))
    th = round(W * 3 / 4)
    y0 = (H - th) // 2
    return im.crop((0, y0, W, y0 + th))


for arg in sys.argv[1:]:
    cid, src = arg.split("=", 1)
    im = full43(Image.open(src).convert("RGB"))
    for w, h in ((1200, 900), (600, 450)):
        out = os.path.join(OUT, f"{cid}-{w}.webp")
        im.resize((w, h), Image.LANCZOS).save(out, "WEBP", quality=82, method=6)
        data = open(out, "rb").read()
        print(json.dumps({"file": f"postcards/{cid}-{w}.webp", "bytes": len(data), "size": [w, h],
                          "sha256": hashlib.sha256(data).hexdigest()}))
