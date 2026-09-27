"""Palette grade + palette stats + night/tint mask for an AI-mesh base-colour texture (lane H, whole SF).

Usage: python grade.py RAW.png OUT.png UV.json STATS.json OPTS_JSON [MASK_OUT.webp]

OPTS_JSON keys (all optional):
  sat_max     float  clamp HSV saturation (default 0.5)
  white_lift  float  0..1 strength pulling near-whites to cream #f6ecd9 (default 0.8)
  white_v     float  value threshold of the white lift (default 0.72; lower it when the model greyed the trim)
  warm        float  multiply by a warm cream tint toward #fff6ea (default 0.0)
  lift        float  lift shadows: out = in*(1-lift) + lift (default 0.0)
  remap       list   [{"hue":[h0,h1], "to":"#rrggbb", "min_s":0.08, "max_s", "min_v", "max_v", "contrast":1.0}] hue ranges
                     (degrees) recoloured to a brand hex keeping each texel's lightness ratio (scaled by contrast)
                     add "tint": true to mark that region in the G (tint) mask channel
  glass_to    "#rrggbb" optional colour for night-glass texels (keeps their lightness ratio)
  glass_rule  [db, dg] stencil thresholds B-R >= db and G-R >= dg (default [28, 18], the GTA_SZ values)
  faces       (set by w4_cleanup.py) per-polygon [nz, rel height, rel depth]; a remap with "region": "wall" | "roof" only
              touches texels of faces with |nz| < wall_nz (0.35) or the others (wave 4, lane V: SAM smears roof colour
              onto the unseen side walls)

Texel coverage = the UV polygons rasterised (only covered texels count in the stats); an 8 px gutter is edge-filled
so mips don't bleed (gutter idea: GTA_SZ scripts/make_facade_diversity_atlas.py:51, MIT).
Mask R = night glass by the GTA_SZ stencil (B-R >= 28) & (G-R >= 18) (make_facade_diversity_atlas.py:57, MIT).
"""
import sys, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

RAW, OUT, UVJ, STATS, OPTS = sys.argv[1:6]
MASK = sys.argv[6] if len(sys.argv) > 6 else ""
o = json.loads(OPTS or "{}")

PALETTE = ["#f3ecdf", "#bfdbe6", "#f7e9d2", "#3f8f95", "#79c1bb", "#f4f1e6", "#e7dcc5", "#d9ccb3", "#b98a5a", "#9fbf7a",
           "#6f9a5b", "#557f47", "#e9e0cf", "#7f9c8f", "#d07a55", "#f2c9b1", "#cfe0d0", "#f4e2a8", "#c9d6e8", "#e8c6cf",
           "#b8c0c4", "#ffd9a3", "#e0a94a", "#f6ecd9", "#d8744a", "#2f8f88", "#fbf7ef", "#f3e6cc", "#1f8f8a", "#e8663d",
           "#8c9aa6",
           # wave 4 (lane V): colours the city already ships outside the DESIGN list: the kit's Chinatown red (chinatown-shophouse
           # balconies, the real trim of Holy Virgin Cathedral and the Chinese Pavilion columns), the kit's silver roof grey
           "#b8463c", "#b8c0c4", "#bdb3a2"]


def hex2rgb(h):
    h = h.lstrip("#"); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255


def srgb_to_lab(rgb):
    c = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]], np.float32)
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883], np.float32)
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def rgb_to_hsv(rgb):
    mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn
    h = np.zeros_like(mx)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    nz = d > 1e-6
    hr = nz & (mx == r); hg = nz & (mx == g) & ~hr; hb = nz & ~hr & ~hg
    h[hr] = ((g - b)[hr] / d[hr]) % 6
    h[hg] = (b - r)[hg] / d[hg] + 2
    h[hb] = (r - g)[hb] / d[hb] + 4
    h = h * 60
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return h, s, mx


def hsv_to_rgb(h, s, v):
    h = (h % 360) / 60; i = np.floor(h).astype(int) % 6; f = h - np.floor(h)
    p = v * (1 - s); q = v * (1 - s * f); t = v * (1 - s * (1 - f))
    out = np.zeros(h.shape + (3,), np.float32)
    for k, (a, b, c) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        m = i == k
        out[m] = np.stack([a[m], b[m], c[m]], -1)
    return out


im = Image.open(RAW).convert("RGB")
W, H = im.size
a = np.asarray(im).astype(np.float32) / 255

# coverage mask from UV polygons
cov = Image.new("L", (W, H), 0); d = ImageDraw.Draw(cov)
for poly in json.load(open(UVJ)):
    pts = [(u * W, (1 - v) * H) for u, v in poly]
    if len(pts) >= 3: d.polygon(pts, fill=255)
cov = np.asarray(cov) > 0
covered = max(1, int(cov.sum()))

# wave 4 (lane V): per-texel face normal z from the cleanup's tex0-faces.json ([nz, rel height, rel depth] per polygon,
# same order as the UV polygons), for remaps restricted to a region: "wall" (|nz| < wall_nz, default 0.35) or "roof"
nz_map = None
if o.get("faces"):
    faces = json.load(open(o["faces"]))
    nzi = Image.new("L", (W, H), 128); dn = ImageDraw.Draw(nzi)
    for poly, fz in zip(json.load(open(UVJ)), faces):
        pts = [(u * W, (1 - v) * H) for u, v in poly]
        if len(pts) >= 3: dn.polygon(pts, fill=int(round((max(-1.0, min(1.0, fz[0])) + 1) * 127.5)))
    nz_map = np.asarray(nzi).astype(np.float32) / 127.5 - 1

pal = srgb_to_lab(np.stack([hex2rgb(h) for h in PALETTE]))


def pal_stats(rgb):
    lab = srgb_to_lab(rgb[cov])
    step = max(1, len(lab) // 60000)
    lab = lab[::step]
    de = np.sqrt(((lab[:, None, :] - pal[None, :, :]) ** 2).sum(-1)).min(1)
    return {"within12": round(float((de <= 12).mean()), 3), "within20": round(float((de <= 20).mean()), 3),
            "median_de": round(float(np.median(de)), 1)}


before = pal_stats(a)
a8 = (a * 255).astype(np.int16)
gb, gg = o.get("glass_rule", [28, 18])  # per-asset override when the mesh model desaturated the glass
glass = ((a8[..., 2] - a8[..., 0]) >= gb) & ((a8[..., 1] - a8[..., 0]) >= gg)  # stencil on the raw texture
tint = np.zeros_like(glass)
h, s, v = rgb_to_hsv(a)
keep = np.zeros(h.shape, np.float32)  # blend weight of remapped texels (excluded from the white lift)


def recolour(rgb, sel, to, hh, vv, contrast=1.0):
    """Texels in `sel` take the hue/sat of `to`; value is rescaled so the region's 70th percentile hits `to`'s value
    (baked shading survives). The selection is closed and feathered 1 px so edges don't speckle."""
    sel = ndimage.binary_closing(sel, iterations=2) & ~glass
    th, ts, tv = rgb_to_hsv(hex2rgb(to)[None, None, :])
    ref_v = np.percentile(vv[sel & cov], 70) if (sel & cov).any() else 1.0
    rel = 1 - contrast * (1 - vv / max(ref_v, 1e-3))  # contrast < 1 flattens baked shading toward the target
    tgt = hsv_to_rgb(np.full_like(hh, th[0, 0]), np.full_like(hh, ts[0, 0]), np.clip(rel * tv[0, 0], 0, 1))
    w = ndimage.gaussian_filter(sel.astype(np.float32), 1.0)
    return rgb * (1 - w[..., None]) + tgt * w[..., None], sel, w


a2 = a.copy()
taken = np.zeros(h.shape, bool)
for rm in o.get("remap", []):
    h0, h1 = rm["hue"]
    sel = ((h >= h0) & (h <= h1)) if h0 <= h1 else ((h >= h0) | (h <= h1))
    sel &= (s >= rm.get("min_s", 0.08)) & ~glass & ~taken  # first remap that claims a texel wins
    if "max_v" in rm: sel &= v <= rm["max_v"]
    if "max_s" in rm: sel &= s <= rm["max_s"]
    if "min_v" in rm: sel &= v >= rm["min_v"]
    if rm.get("region") and nz_map is not None:
        wall = np.abs(nz_map) < float(o.get("wall_nz", 0.35))
        sel &= wall if rm["region"] == "wall" else ~wall
    a2, sel, w = recolour(a2, sel, rm["to"], h, v, rm.get("contrast", 1.0))
    keep = np.maximum(keep, w)
    taken |= sel
    if rm.get("tint"): tint |= sel
if o.get("glass_to") and glass.any():
    a2, _, w = recolour(a2, glass, o["glass_to"], h, v)
    keep = np.maximum(keep, w)
hh, ss, vv = rgb_to_hsv(a2)
sat_c = np.minimum(ss, float(o.get("sat_max", 0.5)))
a2 = hsv_to_rgb(hh, ss * keep + sat_c * (1 - keep), vv)  # remapped texels keep their brand target's saturation
# lift near-whites (trim, cream stone) to brand cream; remapped regions keep their target colour
wl = float(o.get("white_lift", 0.8))
if wl > 0:
    cream = hex2rgb("#f6ecd9")
    hh, ss, vv = rgb_to_hsv(a2)
    wv = float(o.get("white_v", 0.72))  # texels brighter than this (and low-sat) count as white trim / cream stone
    t = np.clip((vv - wv) / 0.2, 0, 1) * np.clip((0.22 - ss) / 0.12, 0, 1) * wl * (1 - keep)
    target = cream[None, None, :] * np.clip(vv / max(wv + 0.24, 0.8), 0, 1.03)[..., None]
    a2 = a2 * (1 - t[..., None]) + target * t[..., None]
lift = float(o.get("lift", 0.0))
if lift > 0: a2 = a2 * (1 - lift) + lift
warm = float(o.get("warm", 0.0))
if warm > 0: a2 = a2 * (1 - warm + warm * hex2rgb("#fff6ea")[None, None, :])
a2 = np.clip(a2, 0, 1)
after = pal_stats(a2)

# gutter: edge-fill 8 px around covered texels (then everything else from the nearest covered texel)
idx = ndimage.distance_transform_edt(~cov, return_distances=False, return_indices=True)
filled = a2[idx[0], idx[1]]
out8 = (filled * 255 + 0.5).astype(np.uint8)
Image.fromarray(out8).save(OUT)

stats = {"size": [W, H], "coverage": round(covered / (W * H), 3), "palette_before": before, "palette_after": after, "opts": o}
if MASK:
    m = np.zeros((H, W, 3), np.uint8)
    m[..., 0] = glass * 255; m[..., 1] = tint * 255
    mi = Image.fromarray(m[idx[0], idx[1]])  # same gutter fill as the texture
    mi.resize((256, 256), Image.BILINEAR).save(MASK, "WEBP", lossless=True)
    stats["mask"] = {"glass_frac": round(float(glass[cov].mean()), 3), "tint_frac": round(float(tint[cov].mean()), 3)}
json.dump(stats, open(STATS, "w"), indent=1)
print(json.dumps(stats))
