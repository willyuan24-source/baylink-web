"""Wave 7 · lane V: the particle atlas (world/fx.ts) from the painted sprites of ledger/w7-V.md batch 1.

python scripts/opus-sf/assets/w7v/fx_atlas.py [RAW_DIR]

RAW_DIR (default C:/Users/willy/opus-qa/w7/v/raw) holds the downloaded sprites (white gouache on black). Writes
public/opus-bay/w7v/fx-atlas.webp: 512 x 512, a 4 x 4 grid of 128 px cells in world/fx.ts's SHAPE order. Per cell
A = coverage (how much of the particle shows) and R = G = B = the paint's shading inside it (the shader tints it with the
particle colour and uses R to keep the brush strokes). The black ground is levelled first (a sprite drawn on dark grey
still fades to 0), each sprite is cropped to its paint and fitted inside the cell with a 4 px margin so bilinear
filtering never bleeds a neighbour in.
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
RAW = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\willy\opus-qa\w7\v\raw"
OUT = os.path.join(ROOT, "public", "opus-bay", "w7v", "fx-atlas.webp")
CELL, GRID, PAD = 128, 4, 4

def level(img):
    """luminance with the ground's level (the 2nd percentile of the border) subtracted and the paint's 99.5th at 1"""
    L = img.convert("L")
    w, h = L.size
    border = [L.getpixel((x, y)) for x in range(0, w, 8) for y in (0, 1, h - 2, h - 1)] + [L.getpixel((x, y)) for y in range(0, h, 8) for x in (0, 1, w - 2, w - 1)]
    border.sort()
    lo = border[int(len(border) * 0.9)] + 6  # the ground plus a little noise
    hist = L.histogram(); total = sum(hist); acc = 0; hi = 255
    for v in range(255, -1, -1):
        acc += hist[v]
        if acc > total * 0.004: hi = v; break
    hi = max(hi, lo + 40)
    return L.point(lambda v: 0 if v <= lo else min(255, int((v - lo) * 255 / (hi - lo))))

def fit(L, box, squash=1.0):
    bb = L.point(lambda v: 255 if v > 10 else 0).getbbox() or (0, 0, L.size[0], L.size[1])
    c = L.crop(bb)
    w, h = c.size
    s = min(box / w, box / (h * squash))
    c = c.resize((max(1, int(w * s)), max(1, int(h * s * squash))), Image.LANCZOS)
    return c

def cell_from(name, solid, squash=1.0, inner=CELL - 2 * PAD, gamma=1.0):
    L = level(Image.open(os.path.join(RAW, name)))
    c = fit(L, inner, squash)
    tile = Image.new("L", (CELL, CELL), 0)
    tile.paste(c, ((CELL - c.size[0]) // 2, (CELL - c.size[1]) // 2))
    if solid:
        # a solid shape: fully covered where painted (soft 1-2 px edge), the strokes in the shading
        cov = tile.point(lambda v: min(255, int(v * 255 / 70)))
        shade = tile
    else:
        cov = tile.point(lambda v: int(255 * (v / 255) ** gamma))
        shade = tile.point(lambda v: min(255, 150 + v // 2))
        # a soft sprite must reach 0 well inside its cell (an ellipse of the sprite's own aspect): no disc edge
        cov = Image.fromarray((np.asarray(cov, dtype=np.float32) * vignette(squash)).astype(np.uint8))
    return shade, cov

def vignette(squash):
    y, x = np.mgrid[0:CELL, 0:CELL].astype(np.float32)
    nx, ny = (x - CELL / 2 + 0.5) / (CELL / 2 - PAD), (y - CELL / 2 + 0.5) / ((CELL / 2 - PAD) * squash)
    r = np.sqrt(nx * nx + ny * ny)
    t = np.clip((r - 0.45) / (0.97 - 0.45), 0, 1)
    return 1 - t * t * (3 - 2 * t)

def proc_dot():
    t = Image.new("L", (CELL, CELL), 0); d = ImageDraw.Draw(t)
    for r in range(58, 0, -1):
        k = 1 - r / 58
        d.ellipse((64 - r, 64 - r, 64 + r, 64 + r), fill=int(255 * min(1, k * 1.6) ** 1.2))
    return Image.new("L", (CELL, CELL), 255), t

def proc_ring():
    t = Image.new("L", (CELL, CELL), 0); d = ImageDraw.Draw(t)
    d.ellipse((14, 14, 114, 114), outline=255, width=9)
    t = t.filter(ImageFilter.GaussianBlur(2.2))
    return Image.new("L", (CELL, CELL), 255), t.point(lambda v: min(255, int(v * 1.5)))

# world/fx.ts SHAPE order (cell k at column k % 4, row k // 4 from the top)
CELLS = [
    ("dot", proc_dot),
    ("ring", proc_ring),
    ("star", lambda: cell_from("s0-star.png", True)),
    ("heart", lambda: cell_from("s5-heart.png", True, inner=108)),
    ("note", lambda: cell_from("s6-note.png", True, inner=104)),
    ("puff", lambda: cell_from("s4-wisp.png", False, gamma=1.15)),
    ("drop", lambda: cell_from("s2-drop.png", True, inner=96)),
    ("confetti", lambda: cell_from("s7-confetti.png", True, inner=100)),
    ("flare", lambda: cell_from("s8-flare.png", False, gamma=1.3)),
    ("leaf", lambda: cell_from("s9-leaf.png", True, inner=96)),
    ("foam", lambda: cell_from("s3-foam.png", True)),
    ("cloud", lambda: cell_from("s1-puff.png", False, gamma=0.9)),
    ("wisp", lambda: cell_from("s4-wisp.png", False, squash=0.42, gamma=1.2)),
]

def main():
    rgb = Image.new("L", (CELL * GRID, CELL * GRID), 0)
    alpha = Image.new("L", (CELL * GRID, CELL * GRID), 0)
    for k, (_name, make) in enumerate(CELLS):
        shade, cov = make()
        x, y = (k % GRID) * CELL, (k // GRID) * CELL
        rgb.paste(shade, (x, y)); alpha.paste(cov, (x, y))
    img = Image.merge("RGBA", (rgb, rgb, rgb, alpha))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT, "WEBP", quality=88, method=6, exact=True)
    print(OUT, os.path.getsize(OUT), "bytes", [n for n, _ in CELLS])

if __name__ == "__main__":
    main()
