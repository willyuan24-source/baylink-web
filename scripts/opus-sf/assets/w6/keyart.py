"""Wave-6 Halloween key art (lane X, W6-X6): raw PNG -> public/opus-bay/w6/art/key-{wide,tall}-halloween-<w>.webp.

python scripts/opus-sf/assets/w6/keyart.py <wide.png> <tall.png>

The export of the shipped key art (ASSETS-LEDGER: key art WebP q80, wide 1920 / 1280, tall 1080 / 720): centre-crop to
16:9 / 9:16 exactly, then resize. Prints one JSON line per file (bytes, size, sha256) for the ledger.
"""
import hashlib, json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", "public", "opus-bay", "w6", "art"))


def crop(im, aw, ah):
    W, H = im.size
    tw = round(H * aw / ah)
    if tw <= W:
        x0 = (W - tw) // 2
        return im.crop((x0, 0, x0 + tw, H))
    th = round(W * ah / aw)
    y0 = (H - th) // 2
    return im.crop((0, y0, W, y0 + th))


os.makedirs(OUT, exist_ok=True)
for kind, src, ratio, widths in (("wide", sys.argv[1], (16, 9), (1920, 1280)), ("tall", sys.argv[2], (9, 16), (1080, 720))):
    im = crop(Image.open(src).convert("RGB"), *ratio)
    for w in widths:
        h = round(w * ratio[1] / ratio[0])
        out = os.path.join(OUT, f"key-{kind}-halloween-{w}.webp")
        im.resize((w, h), Image.LANCZOS).save(out, "WEBP", quality=80, method=6)
        data = open(out, "rb").read()
        print(json.dumps({"file": f"w6/art/key-{kind}-halloween-{w}.webp", "bytes": len(data), "size": [w, h],
                          "sha256": hashlib.sha256(data).hexdigest()}))
