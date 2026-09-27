"""Cut the tier-1 map sticker sheet into a sprite atlas (lane V, W4-V5).

python scripts/opus-sf/assets/w4/stickers.py SHEET.png [--alt ALT.png --use-alt id1,id2] [--out public/opus-bay/map]
    [--cell 128] [--q 86] [--preview PREVIEW.png]

SHEET = the nano_banana_pro 4k sheet of 16 round stickers in a 4 x 4 grid (prompts.py STICKER_PROMPT, row by row in the
order of STICKER_IDS). Each circle is found as a connected component of "not paper" (colour distance from the paper
median > 18, opened and hole-filled); its centre is the component centroid and its radius is measured on the upper
half only (the soft drop shadow falls below), where the cream rim ends against the paper. The sprite is the circle cut
with an anti-aliased alpha edge 3.2 % inside the rim (no paper, no shadow), scaled to CELL - 4 px and centred in a CELL
square with 2 px of transparent padding, so neighbouring sprites never bleed. Writes stickers-t1.webp (a 4 x 4 atlas,
lossy WebP with alpha) and stickers-t1.json (ids -> rects, sizes, the source jobs, sha256 of the WebP).
"""
import hashlib, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from prompts import STICKER_IDS  # noqa: E402


def arg(k, d=None):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d


def circles(path):
    img = Image.open(path).convert("RGB")
    a = np.asarray(img).astype(np.float32)
    bg = np.median(a[5:60, 5:60].reshape(-1, 3), 0)
    d = np.sqrt(((a - bg) ** 2).sum(-1))
    fg = ndimage.binary_fill_holes(ndimage.binary_opening(d > 18, iterations=3))
    lbl, k = ndimage.label(fg)
    sizes = ndimage.sum(fg, lbl, range(1, k + 1))
    out = []
    for i, s in enumerate(sizes):
        if s < fg.size / 16 * 0.25: continue
        ys, xs = np.where(lbl == i + 1)
        cx, cy = xs.mean(), ys.mean()
        # radius from the upper half: the last row / column where the rim is still off the paper colour
        rs = []
        for ang in np.linspace(np.pi * 1.05, np.pi * 1.95, 25):  # up-left .. up-right (image y grows downward)
            dx, dy = np.cos(ang), np.sin(ang)
            r_edge = 0
            for r in np.arange(300, 520, 0.5):
                x, y = int(round(cx + dx * r)), int(round(cy + dy * r))
                if 0 <= x < a.shape[1] and 0 <= y < a.shape[0] and d[y, x] > 12: r_edge = r
            rs.append(r_edge)
        out.append({"cx": float(cx), "cy": float(cy), "r": float(np.median(rs))})
    out.sort(key=lambda c: (round(c["cy"] / 300), c["cx"]))
    return img, bg, out


def sprite(img, c, size):
    r = c["r"] * 0.968
    x0, y0 = int(c["cx"] - r) - 2, int(c["cy"] - r) - 2
    side = int(2 * r) + 4
    crop = img.crop((x0, y0, x0 + side, y0 + side)).convert("RGBA")
    ss = 4  # supersampled circular alpha
    yy, xx = np.mgrid[0:side * ss, 0:side * ss] / ss
    inside = ((xx - (c["cx"] - x0)) ** 2 + (yy - (c["cy"] - y0)) ** 2) <= r * r
    alpha = inside.reshape(side, ss, side, ss).mean((1, 3))
    arr = np.asarray(crop).copy()
    arr[..., 3] = (alpha * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(arr).resize((size, size), Image.LANCZOS)


def main():
    sheet = sys.argv[1]
    alt, use_alt = arg("--alt"), set(filter(None, (arg("--use-alt", "") or "").split(",")))
    out_dir = arg("--out", os.path.join(HERE, "..", "..", "..", "..", "public", "opus-bay", "map"))
    cell = int(arg("--cell", "128")); q = int(arg("--q", "86"))
    img, _, cs = circles(sheet)
    assert len(cs) == 16, f"found {len(cs)} circles"
    alt_cs = circles(alt) if alt else None
    atlas = Image.new("RGBA", (cell * 4, cell * 4), (0, 0, 0, 0))
    rects, radii = {}, {}
    for k, sid in enumerate(STICKER_IDS):
        src_img, c = (alt_cs[0], alt_cs[2][k]) if (alt_cs and sid in use_alt) else (img, cs[k])
        spr = sprite(src_img, c, cell - 4)
        col, row = k % 4, k // 4
        atlas.alpha_composite(spr, (col * cell + 2, row * cell + 2))
        rects[sid] = {"x": col * cell + 2, "y": row * cell + 2, "w": cell - 4, "h": cell - 4,
                      "src": "alt" if (alt_cs and sid in use_alt) else "main"}
        radii[sid] = round(c["r"], 1)
    os.makedirs(out_dir, exist_ok=True)
    webp = os.path.join(out_dir, "stickers-t1.webp")
    atlas.save(webp, "WEBP", quality=q, method=6, alpha_quality=100)
    sha = hashlib.sha256(open(webp, "rb").read()).hexdigest()
    meta = {"version": 1, "image": "stickers-t1.webp", "size": [cell * 4, cell * 4], "cell": cell, "pad": 2,
            "shape": "circle", "note": "round die-cut stickers (cream rim included, alpha outside the circle); "
            "draw each rect centred on the T1 badge, diameter = the badge diameter + 4 px (plan §4.1, s >= 0.45)",
            "ids": STICKER_IDS, "rects": rects, "sourceRadiusPx": radii, "bytes": os.path.getsize(webp), "sha256": sha}
    json.dump(meta, open(os.path.join(out_dir, "stickers-t1.json"), "w", encoding="utf-8"), indent=1)
    if arg("--preview"):
        pv = Image.new("RGBA", atlas.size, (243, 236, 223, 255)); pv.alpha_composite(atlas)
        pv.convert("RGB").resize((cell * 8, cell * 8), Image.NEAREST).save(arg("--preview"))
    print(json.dumps({"bytes": meta["bytes"], "radii": sorted(set(radii.values()))[:3], "sha256": sha[:12]}))


if __name__ == "__main__":
    main()
