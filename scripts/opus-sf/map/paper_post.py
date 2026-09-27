"""Register, check, grade and export a painted-map candidate (lane H2b, H2b-4).

    <venv>/python scripts/opus-sf/map/paper_post.py --base C:/Users/willy/opus-qa/w3/h2b/base \
        --cand C:/Users/willy/opus-qa/w3/h2b/cand/c1.png --out C:/Users/willy/opus-qa/w3/h2b/post/c1 [--export public/opus-bay/map --version v1]

Needs Pillow, numpy, scipy and opencv-python-headless (a scratch venv, never the repo). Inputs: the base render's
land mask (render-base.ts, land-2048.png: far land + the hero seawall land + Angel Island) and a candidate image (any
square size). Steps:

1. Segment the candidate at 2048 px: water = teal pixels (hue 150..215 deg, enough chroma) inside the board; small water
   blobs (lakes, ponds) are filled back into the land, as in the base mask; the cream table outside the board is not
   land.
2. Similarity fit (scale, rotation, shift) of the candidate's coast onto the base coast: minimise a robust chamfer cost
   (Huber on the base coast's distance field) with Powell, coarse (512 px) then fine (2048 px).
3. Check: coast error both ways after the fit (candidate coast -> base coast, base coast -> candidate coast); the
   gate is p95 <= 1.5 % of the width (30.7 px at 2048) in both directions. Crops of the fitted candidate at 4096 go
   to <out>/crops for reading invented text by eye.
4. Grade toward the palette: white-balance the table to #f3ecdf (gains limited to +-8 %), then pull the water and the
   land halfway toward the base render's mean colours in Lab (the painting keeps its own texture).
5. Export (with --export): WebP 1024 / 2048 / 4096 of the fitted, graded paper, named paper-<version>-<w>.webp, plus
   <out>/report.json with every number and the sha256 of each file.
"""
import argparse
import hashlib
import json
import os

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage, optimize

ap = argparse.ArgumentParser()
ap.add_argument('--base', required=True)
ap.add_argument('--cand', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--export', default='')
ap.add_argument('--version', default='v1')
ap.add_argument('--no-grade', action='store_true')
ap.add_argument('--quality', type=int, default=80)
# retouch (after the eye check): a painting may scribble pseudo-letters on big flat roofs and lots. A grey closing
# (max then min, per channel, 9 px) wipes thin dark strokes while larger painted shapes, streets and coasts keep their
# edges; it runs around the base's hero lots and sheds (on land only), and inside listed rectangles (4096 px,
# "x0,y0,x1,y1;…") found by eye
ap.add_argument('--smooth-hero', action='store_true')
ap.add_argument('--declutter', default='')
args = ap.parse_args()
os.makedirs(args.out, exist_ok=True)

W = 2048
GATE = 0.015 * W

base_land = np.asarray(Image.open(os.path.join(args.base, 'land-2048.png')).convert('L'), dtype=np.float32) / 255.0
# the board polygon, 10 px in from its glass rim: the only place land or water is looked for (the rim lines and the
# board's shadow on the table are neither)
BOARD_RAW = np.asarray(Image.open(os.path.join(args.base, 'board-2048.png')).convert('L')) > 127
BOARD = ndimage.binary_erosion(BOARD_RAW, iterations=10)
# coasts are compared only away from the board's edge: where land meets the edge (the county-line cut) is a cut, not
# a coast
INTERIOR = ndimage.binary_erosion(BOARD_RAW, iterations=40)
# nor along the two bridges: a painted deck is wider than the opening removes, and it is not a coast
BRIDGES = np.asarray(Image.open(os.path.join(args.base, 'bridges-2048.png')).convert('L')) > 20
INTERIOR &= ~ndimage.binary_dilation(BRIDGES, iterations=24)
# land is looked for a little beyond the board (a candidate may sit up to ~50 px off before the fit); what that adds
# along the edge is outside INTERIOR and never compared
REGION = ndimage.binary_dilation(BOARD_RAW, iterations=50)
base_rgb = np.asarray(Image.open(os.path.join(args.base, 'base-2048.png')).convert('RGB'), dtype=np.float32) / 255.0
cand_img = Image.open(args.cand).convert('RGB')
cand_full = np.asarray(cand_img, dtype=np.float32) / 255.0
cand = np.asarray(cand_img.resize((W, W), Image.LANCZOS), dtype=np.float32) / 255.0

# the board: where the base is not the table (cream, low chroma) — the base's water or land
TABLE = np.array([0xf3, 0xec, 0xdf], np.float32) / 255.0


def board_mask(rgb):
    d = np.abs(rgb - TABLE).sum(axis=2)
    m = d > 0.08
    m = ndimage.binary_opening(m, iterations=2)
    lab, n = ndimage.label(m)
    if n == 0:
        return m
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    return ndimage.binary_fill_holes(lab == (1 + int(np.argmax(sizes))))


def water_mask(rgb, board, aligned):
    hsv = cv2.cvtColor((rgb * 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    h, s, v = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255
    # teal, down to the pale shore bands a painting lays around the islands (cream land and the table are hue ≈ 40°)
    w = (h >= 150) & (h <= 215) & (s > 0.08) & (v > 0.25)
    w = ndimage.binary_opening(w, iterations=1)
    w = ndimage.binary_closing(w, iterations=2)
    # inside the board, off its rim (the rim's dark line is teal too: it would join the lakes to the ocean). Before the
    # fit that is the candidate's own board; once it is fitted into the base frame, the base's board
    w &= BOARD if aligned else ndimage.binary_erosion(board, iterations=14)
    # keep the open water (the bay and the ocean, one body through the Gate, plus any big part a bridge cuts off); lakes
    # and ponds count as land, like the base mask
    lab, n = ndimage.label(w)
    if n:
        sizes = ndimage.sum(w, lab, range(1, n + 1))
        keep = np.zeros(n + 1, bool)
        keep[1:] = sizes > 0.01 * W * W
        w = keep[lab]
    return w


OPEN = 6  # px at 2048 (≈ 9 u): piers, jetties and bridges go, channels and slips close — both masks alike, so the gate
# measures the coast at the scale a player reads it, not the pier slips


def clean_land(m):
    m = ndimage.binary_opening(m, structure=disk(OPEN))
    m = ndimage.binary_closing(np.pad(m, OPEN + 1), structure=disk(OPEN))[OPEN + 1:-OPEN - 1, OPEN + 1:-OPEN - 1]
    lab, n = ndimage.label(m)
    if n:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        keep = np.zeros(n + 1, bool)
        keep[1:] = sizes > 40  # Alcatraz is ~ 150 px² at 2048
        m = keep[lab]
    return m


def disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]
    return (x * x + y * y) <= r * r


def land_of(rgb, aligned=False):
    b = board_mask(rgb)
    w = water_mask(rgb, b, aligned)
    land = clean_land((REGION if aligned else ndimage.binary_dilation(b, iterations=20)) & ~w)
    return land, b


def coast(mask):
    er = ndimage.binary_erosion(mask, iterations=1)
    return mask & ~er & INTERIOR


base_mask = clean_land((base_land > 0.5) & BOARD)
base_coast = coast(base_mask)
dt_base = ndimage.distance_transform_edt(~base_coast).astype(np.float32)

cand_mask, cand_board = land_of(cand)
cand_coast = coast(cand_mask)
Image.fromarray((cand_mask * 255).astype(np.uint8)).resize((512, 512)).save(os.path.join(args.out, 'cand-land-512.png'))

C = (W - 1) / 2.0


def transform_pts(p, params):
    s, th, tx, ty = params
    c, sn = np.cos(th), np.sin(th)
    x, y = p[:, 0] - C, p[:, 1] - C
    return np.stack([s * (c * x - sn * y) + C + tx, s * (sn * x + c * y) + C + ty], axis=1)


def huber(d, k=6.0, cap=80.0):
    d = np.minimum(d, cap)  # truncated: a painted-away pier or an invented jetty must not pull the whole fit
    return np.where(d < k, 0.5 * d * d, k * (d - 0.5 * k))


def cost(params, pts, dt):
    q = transform_pts(pts, params)
    d = ndimage.map_coordinates(dt, [q[:, 1], q[:, 0]], order=1, mode='nearest')
    return float(np.mean(huber(d)))


ys, xs = np.nonzero(cand_coast)
pts = np.stack([xs, ys], axis=1).astype(np.float32)
rng = np.random.default_rng(1)
sub = pts[rng.choice(len(pts), size=min(len(pts), 20000), replace=False)] if len(pts) else pts
x0 = np.array([1.0, 0.0, 0.0, 0.0])
dt_soft = ndimage.gaussian_filter(dt_base, 12)
res0 = optimize.minimize(cost, x0, args=(sub, dt_soft), method='Powell', options={'xtol': 1e-4, 'ftol': 1e-7, 'maxiter': 4000})
res = optimize.minimize(cost, res0.x, args=(sub, dt_base), method='Powell', options={'xtol': 1e-5, 'ftol': 1e-8, 'maxiter': 4000})
fit = res.x
before = cost(x0, sub, dt_base)


def coast_errors(params):
    # the candidate fitted into the base frame, segmented again there with the base's board (the same rules as the
    # base mask), then both ways: its coast against the base coast, the base coast against its coast
    M = similarity_matrix(params)
    warped_rgb = cv2.warpAffine(cand, M, (W, W), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    warped, _ = land_of(warped_rgb, aligned=True)
    cy, cx = np.nonzero(coast(warped))
    d1 = dt_base[cy, cx]
    dt_c = ndimage.distance_transform_edt(~coast(warped)).astype(np.float32)
    by, bx = np.nonzero(base_coast)
    d2 = dt_c[by, bx]
    return d1, d2, warped, np.stack([cx, cy], axis=1)


def similarity_matrix(params, scale_out=1.0):
    s, th, tx, ty = params
    c, sn = np.cos(th), np.sin(th)
    A = np.array([[s * c, -s * sn], [s * sn, s * c]])
    t = np.array([C + tx, C + ty]) - A @ np.array([C, C])
    M = np.hstack([A, t[:, None]])
    if scale_out != 1.0:
        M = M.copy()
        M[:, 2] *= scale_out
    return M.astype(np.float32)


d_raw1, d_raw2, _, _ = coast_errors(x0)
d1, d2, warped_mask, fitted_pts = coast_errors(fit)
# where the candidate's coast is far from the base coast (after the fit): a diagnostic sheet
diag = np.zeros((W, W, 3), np.uint8)
diag[base_mask] = (60, 60, 60)
q = fitted_pts
far_ = d1 > GATE
diag[q[~far_, 1], q[~far_, 0]] = (80, 200, 80)
diag[q[far_, 1], q[far_, 0]] = (255, 40, 40)
by_, bx_ = np.nonzero(base_coast)
bad2 = d2 > GATE
diag[by_[bad2], bx_[bad2]] = (60, 120, 255)
Image.fromarray(diag).save(os.path.join(args.out, 'coast-diag-2048.png'))
iou = float((warped_mask & base_mask).sum() / max(1, (warped_mask | base_mask).sum()))
report = {
    'cand': args.cand,
    'candSize': list(cand_img.size),
    'fit': {'scale': float(fit[0]), 'rotDeg': float(np.degrees(fit[1])), 'tx': float(fit[2]), 'ty': float(fit[3]), 'costBefore': before, 'costAfter': float(res.fun)},
    'coastPx2048': {
        'raw': {'candToBaseP50': float(np.percentile(d_raw1, 50)), 'candToBaseP95': float(np.percentile(d_raw1, 95)), 'baseToCandP95': float(np.percentile(d_raw2, 95))},
        'fitted': {'candToBaseP50': float(np.percentile(d1, 50)), 'candToBaseP95': float(np.percentile(d1, 95)), 'baseToCandP50': float(np.percentile(d2, 50)), 'baseToCandP95': float(np.percentile(d2, 95))},
    },
    'gatePx': GATE,
    'landIoU': iou,
}
p95 = max(report['coastPx2048']['fitted']['candToBaseP95'], report['coastPx2048']['fitted']['baseToCandP95'])
report['pass'] = bool(p95 <= GATE)
report['p95'] = float(p95)

# fitted candidate at 4096 (the candidate's own pixels, resampled once)
S = 4096
k_in = cand_full.shape[1] / W  # candidate px per 2048 px
M2048 = similarity_matrix(fit)
# map: out(4096) <- 2048 frame (×0.5) <- warp inverse … compose as one affine from candidate px to 4096 px
A = np.vstack([M2048, [0, 0, 1]])
to_cand = np.diag([1 / k_in, 1 / k_in, 1])  # candidate px -> 2048 px
to_out = np.diag([S / W, S / W, 1])
Mfull = (to_out @ A @ to_cand)[:2].astype(np.float32)
fitted = cv2.warpAffine((cand_full * 255).astype(np.uint8), Mfull, (S, S), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
fitted = fitted.astype(np.float32) / 255.0

# overlay for the eye: the base coast (red) on the fitted candidate
ov = cv2.resize(fitted, (W, W), interpolation=cv2.INTER_AREA).copy()
ov[base_coast] = [0.85, 0.1, 0.1]
Image.fromarray((ov * 255).astype(np.uint8)).save(os.path.join(args.out, 'overlay-2048.jpg'), quality=88)


def to_lab(rgb):
    return cv2.cvtColor(rgb.astype(np.float32), cv2.COLOR_RGB2Lab)


def from_lab(lab):
    return np.clip(cv2.cvtColor(lab.astype(np.float32), cv2.COLOR_Lab2RGB), 0, 1)


graded = fitted
if not args.no_grade:
    small = cv2.resize(fitted, (W, W), interpolation=cv2.INTER_AREA)
    board_b = board_mask(base_rgb)
    # the table: well outside the board (its painted shadow and rim excluded), robust median; a gentle, neutral pull
    # (the painting's warm paper stays warm: ±3 %, and the same gain on the three channels' ratio to their mean)
    table = ~ndimage.binary_dilation(BOARD_RAW, iterations=60)
    tmed = np.median(small[table], axis=0) if table.any() else TABLE
    gain = np.clip(TABLE / np.maximum(tmed, 1e-3), 0.97, 1.03)
    report['tableBefore'] = [float(v * 255) for v in tmed]
    graded = np.clip(fitted * gain, 0, 1)
    small = np.clip(small * gain, 0, 1)
    lab_small, lab_base = to_lab(small), to_lab(base_rgb)
    water_b = board_b & ~base_mask
    shift = np.zeros((W, W, 3), np.float32)
    for region in (water_b, base_mask & board_b):
        r = ndimage.binary_erosion(region, iterations=6)
        if not r.any():
            continue
        d = (lab_base[r].mean(axis=0) - lab_small[r].mean(axis=0)) * 0.5
        d[0] *= 0.5  # keep the painting's own lightness mostly
        shift[region] = d
    shift = cv2.GaussianBlur(shift, (0, 0), 12)
    shift_full = cv2.resize(shift, (S, S), interpolation=cv2.INTER_LINEAR)
    graded = from_lab(to_lab(graded) + shift_full)
    report['grade'] = {'tableGain': [float(g) for g in gain]}

g8 = (np.clip(graded, 0, 1) * 255).astype(np.uint8)
retouch = {}
region = np.zeros((S, S), bool)
if args.smooth_hero:
    hero = np.asarray(Image.open(os.path.join(args.base, f'hero-{S}.png')).convert('L')) > 127
    land4 = np.asarray(Image.open(os.path.join(args.base, f'land-{S}.png')).convert('L')) > 127
    region |= ndimage.binary_dilation(hero, iterations=16) & ndimage.binary_erosion(land4, iterations=6)
rects = [tuple(int(v) for v in r.split(',')) for r in args.declutter.split(';') if r.strip()]
for x0, y0, x1, y1 in rects:
    region[y0:y1, x0:x1] = True
if region.any():
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    closed = cv2.morphologyEx(g8, cv2.MORPH_CLOSE, k)
    # feather the region's edge over 4 px so no seam shows
    wgt = cv2.GaussianBlur(region.astype(np.float32), (0, 0), 2.0)[..., None]
    g8 = (g8 * (1 - wgt) + closed * wgt).round().clip(0, 255).astype(np.uint8)
    retouch = {'declutterPx': int(region.sum()), 'rects': rects, 'hero': bool(args.smooth_hero)}
report['retouch'] = retouch
Image.fromarray(g8).resize((1024, 1024), Image.LANCZOS).save(os.path.join(args.out, 'graded-1024.jpg'), quality=88)
# crops for reading invented text / artefacts by eye (4096 px, 768 px squares)
os.makedirs(os.path.join(args.out, 'crops'), exist_ok=True)
for name, (cx, cy) in {
    'downtown': (2250, 1480), 'hero': (2170, 1350), 'gate': (950, 1950), 'ggpark': (1650, 2750), 'twinpeaks': (2270, 2480),
    'angel': (1540, 430), 'islands': (2350, 700), 'south': (2700, 3300), 'table-nw': (400, 400), 'table-se': (3700, 3800),
    'mission': (2600, 2150), 'richmond': (1400, 2300),
}.items():
    x0, y0 = max(0, cx - 384), max(0, cy - 384)
    Image.fromarray(g8[y0:y0 + 768, x0:x0 + 768]).save(os.path.join(args.out, 'crops', f'{name}.jpg'), quality=86)

if args.export:
    os.makedirs(args.export, exist_ok=True)
    files = {}
    for w in (1024, 2048, 4096):
        im = Image.fromarray(g8)
        if w != S:
            im = im.resize((w, w), Image.LANCZOS)
        q = args.quality if w < 4096 else max(60, args.quality - 6)
        path = os.path.join(args.export, f'paper-{args.version}-{w}.webp')
        im.save(path, 'WEBP', quality=q, method=6)
        data = open(path, 'rb').read()
        files[w] = {'path': path, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'quality': q}
    report['export'] = files

with open(os.path.join(args.out, 'report.json'), 'w') as f:
    json.dump(report, f, indent=2)
print(json.dumps({k: report[k] for k in ('fit', 'coastPx2048', 'p95', 'pass', 'landIoU')}, indent=1))
