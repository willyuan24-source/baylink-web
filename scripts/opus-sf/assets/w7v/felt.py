"""Wave 7 · lane V: the characters' felt detail texture (actors/models.ts) from ledger/w7-V.md batch 1 V11.

python scripts/opus-sf/assets/w7v/felt.py [RAW_DIR]

The generated felt photo has a soft top-to-bottom light gradient: a high-pass (the photo minus a wide blur) keeps only
the fibres, then the tile is made seamless (the image crossfaded with itself shifted half a tile, a pyramid mask), and
the contrast is set so the grey sits at 128 with a spread of about ±40. Writes public/opus-bay/w7v/felt.webp
(256 x 256, grey).
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
RAW = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\willy\opus-qa\w7\v\raw"
OUT = os.path.join(ROOT, "public", "opus-bay", "w7v", "felt.webp")
N = 256

def main():
    im = Image.open(os.path.join(RAW, "t0-felt.png")).convert("L").resize((1024, 1024), Image.LANCZOS)
    a = np.asarray(im, dtype=np.float32)
    lo = np.asarray(im.filter(ImageFilter.GaussianBlur(48)), dtype=np.float32)
    hp = a - lo
    # seamless: crossfade with the half-tile shift under a pyramid mask (1 in the middle, 0 at the edges)
    s = np.roll(np.roll(hp, 512, 0), 512, 1)
    r = np.abs(np.linspace(-1, 1, 1024))
    w = 1 - np.maximum(r[None, :], r[:, None])
    w = np.clip(w * 1.6, 0, 1)
    t = hp * w + s * (1 - w)
    # the crossfade flattens the contrast in the blend band: renormalise locally
    m = np.abs(t); m8 = Image.fromarray(np.clip(m / m.max() * 255, 0, 255).astype(np.uint8))
    sd = np.asarray(m8.filter(ImageFilter.GaussianBlur(40)), dtype=np.float32) + 1.0
    t = t / sd * np.mean(sd)
    t = (t - t.mean()) / (t.std() + 1e-6) * 34 + 128
    out = Image.fromarray(np.clip(t, 0, 255).astype(np.uint8)).resize((N, N), Image.LANCZOS)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    out.save(OUT, "WEBP", quality=85, method=6)
    print(OUT, os.path.getsize(OUT), "bytes")

if __name__ == "__main__":
    main()
