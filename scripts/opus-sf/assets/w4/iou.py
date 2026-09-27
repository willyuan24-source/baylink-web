"""Best-view silhouette IoU of a mesh against its concept image (lane H QA gate).

Usage: python iou.py CONCEPT.png SIL_DIR   (SIL_DIR holds s_<az>_<el>.png white-on-black ortho renders)
Concept mask = rembg (u2net, local) alpha, largest component, holes filled (colour thresholds fail: lit sage walls ~ cream table).
Each mask is cropped to its bbox and scaled to a common height (keeping aspect), centred, then IoU is taken.
Prints the top 3 views and, on the last line, JSON {"best": iou, "az": .., "el": ..}.
"""
import sys, os, json, glob
import numpy as np
from PIL import Image
from scipy import ndimage

CON, SIL = sys.argv[1], sys.argv[2]
N = 160


def lab(rgb):
    c = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def norm(mask):
    ys, xs = np.where(mask)
    m = mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = m.shape
    nw = max(1, round(w * N / h))
    m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((nw, N), Image.BILINEAR)) > 127
    canvas = np.zeros((N, 2 * N), bool)
    x0 = max(0, N - nw // 2)
    canvas[:, x0:x0 + min(nw, 2 * N - x0)] = m[:, :min(nw, 2 * N - x0)]
    return canvas


def rembg_mask(path):
    """u2net (rembg, model cached in ~/.u2net) alpha > 50 %; cached next to the concept as <name>.mask.png."""
    cache = os.path.splitext(path)[0] + ".mask.png"
    if not os.path.exists(cache):
        from rembg import remove
        cut = remove(Image.open(path).convert("RGB").resize((1024, 1024), Image.LANCZOS))
        Image.fromarray(((np.asarray(cut)[..., 3] > 127) * 255).astype(np.uint8)).save(cache)
    m = np.asarray(Image.open(cache).resize((512, 512), Image.NEAREST)) > 127
    lbl, n = ndimage.label(m)
    if n > 1:
        sizes = ndimage.sum(m, lbl, range(1, n + 1)); m = lbl == (1 + int(np.argmax(sizes)))
    return ndimage.binary_fill_holes(m)


fg = rembg_mask(CON)
Image.fromarray((fg * 255).astype(np.uint8)).save(os.path.join(SIL, "_concept_mask.png"))
C = norm(fg)
res = []
for p in glob.glob(os.path.join(SIL, "s_*.png")):
    s = np.asarray(Image.open(p).convert("L")) > 127
    if not s.any(): continue
    S = norm(s)
    iou = (C & S).sum() / max(1, (C | S).sum())
    az, el = os.path.basename(p)[2:-4].split("_")
    res.append((iou, int(az), int(el)))
res.sort(reverse=True)
for r in res[:3]: print("view", r)
b = res[0]
print(json.dumps({"best": round(float(b[0]), 3), "az": b[1], "el": b[2]}))
