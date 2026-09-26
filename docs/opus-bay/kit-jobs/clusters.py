"""Colour clusters of a raw SAM texture over UV-covered texels: python clusters.py WORKDIR [k]
Prints fraction, mean hex, mean HSV (deg, s, v) per k-means cluster (numpy only), largest first."""
import sys, json
import numpy as np
from PIL import Image, ImageDraw

wd = sys.argv[1]; K = int(sys.argv[2]) if len(sys.argv) > 2 else 8
im = Image.open(f"{wd}/tex0-raw.png").convert("RGB"); W, H = im.size
a = np.asarray(im).astype(np.float32) / 255
cov = Image.new("L", (W, H), 0); d = ImageDraw.Draw(cov)
for poly in json.load(open(f"{wd}/tex0-uv.json")):
    pts = [(u * W, (1 - v) * H) for u, v in poly]
    if len(pts) >= 3: d.polygon(pts, fill=255)
cov = np.asarray(cov) > 0
X = a[cov]
rng = np.random.default_rng(0)
X = X[rng.choice(len(X), min(len(X), 40000), replace=False)]
C = X[rng.choice(len(X), K, replace=False)]
for _ in range(30):
    lab = ((X[:, None, :] - C[None]) ** 2).sum(-1).argmin(1)
    C = np.stack([X[lab == k].mean(0) if (lab == k).any() else C[k] for k in range(K)])


def hsv(c):
    mx, mn = c.max(), c.min(); dd = mx - mn
    if dd < 1e-6: h = 0
    elif mx == c[0]: h = ((c[1] - c[2]) / dd) % 6
    elif mx == c[1]: h = (c[2] - c[0]) / dd + 2
    else: h = (c[0] - c[1]) / dd + 4
    return round(h * 60), round(dd / mx if mx else 0, 2), round(float(mx), 2)


order = np.argsort([-(lab == k).sum() for k in range(K)])
for k in order:
    f = (lab == k).mean()
    c = C[k]
    print(f"{f:5.2f}  #{''.join(f'{int(x * 255):02x}' for x in c)}  hsv={hsv(c)}")
