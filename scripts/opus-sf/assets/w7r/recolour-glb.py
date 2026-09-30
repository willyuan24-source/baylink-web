# W7-R: recolour the baked WebP texture of a Draco + WebP GLB (bufferView of images[0]) by hue rules, rewrite the GLB.
#   python recolour-glb.py <in.glb> <out.glb> <rule-set> [--preview out.png]
# Rule sets (HSV on 0..1, hue in degrees), each pixel takes the first matching rule:
#   city-hall : sage / teal dome and window panels -> slate grey (the real dome is lead-grey with gold-leaf ribs)
#   grace     : teal roofs -> dark slate; cream stone -> cool light grey concrete
#   windmill  : cream-white tower body -> weathered grey-brown shingle (the brown cap / gallery / wood stay)
import io, json, struct, sys
import numpy as np
from PIL import Image

def rgb_to_hsv(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = a.max(-1); mn = a.min(-1); d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rm = m & (mx == r); gm = m & (mx == g) & ~rm; bm = m & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = ((b - r)[gm] / d[gm]) + 2
    h[bm] = ((r - g)[bm] / d[bm]) + 4
    h = h * 60.0
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return h, s, mx

def hsv_to_rgb(h, s, v):
    c = v * s; hp = (h / 60.0) % 6; x = c * (1 - np.abs(hp % 2 - 1)); z = np.zeros_like(h)
    conds = [(hp < 1), (hp < 2), (hp < 3), (hp < 4), (hp < 5), (hp >= 5)]
    rgbs = [(c, x, z), (x, c, z), (z, c, x), (z, x, c), (x, z, c), (c, z, x)]
    r = np.select(conds, [t[0] for t in rgbs]); g = np.select(conds, [t[1] for t in rgbs]); b = np.select(conds, [t[2] for t in rgbs])
    m = v - c
    return np.stack([r + m, g + m, b + m], -1)

def recolour(img, rule):
    a = np.asarray(img.convert('RGB')).astype(np.float64) / 255.0
    h, s, v = rgb_to_hsv(a)
    h2, s2, v2 = h.copy(), s.copy(), v.copy()
    teal = (h >= 140) & (h <= 205) & (s > 0.12)
    if rule == 'city-hall':
        h2[teal] = 205; s2[teal] = s[teal] * 0.22; v2[teal] = v[teal] * 0.80
    elif rule == 'grace':
        h2[teal] = 210; s2[teal] = s[teal] * 0.15; v2[teal] = v[teal] * 0.70
        cream = ~teal & (h >= 20) & (h <= 75) & (s < 0.30) & (v > 0.55)
        h2[cream] = 45; s2[cream] = s[cream] * 0.28; v2[cream] = v[cream] * 0.90
    elif rule == 'windmill':
        cream = (s < 0.22) & (v > 0.70)
        h2[cream] = 32; s2[cream] = 0.15; v2[cream] = v[cream] * 0.60
        wood = ~cream & (h >= 15) & (h <= 45) & (s > 0.28)
        s2[wood] = s[wood] * 0.75; v2[wood] = v[wood] * 0.66
    else:
        raise SystemExit('unknown rule ' + rule)
    out = hsv_to_rgb(h2, s2, v2)
    return Image.fromarray(np.clip(out * 255.0 + 0.5, 0, 255).astype(np.uint8), 'RGB')

def main():
    src, dst, rule = sys.argv[1:4]
    preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    b = open(src, 'rb').read()
    magic, ver, total = struct.unpack('<III', b[:12])
    jlen, jtype = struct.unpack('<II', b[12:20]); j = json.loads(b[20:20 + jlen])
    off = 20 + jlen; blen, btype = struct.unpack('<II', b[off:off + 8]); binc = b[off + 8:off + 8 + blen]
    ib = j['images'][0]['bufferView']
    views = j['bufferViews']
    chunks = [binc[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in views]
    img = Image.open(io.BytesIO(chunks[ib]))
    new = recolour(img, rule)
    if preview: new.save(preview)
    buf = io.BytesIO(); new.save(buf, 'WEBP', quality=82, method=6); chunks[ib] = buf.getvalue()
    out = b''; pos = 0
    for k, c in enumerate(chunks):
        pad = (-pos) % 4; out += b'\0' * pad; pos += pad
        views[k]['byteOffset'] = pos; views[k]['byteLength'] = len(c); out += c; pos += len(c)
    out += b'\0' * ((-len(out)) % 4)
    j['buffers'][0]['byteLength'] = len(out)
    js = json.dumps(j, separators=(',', ':')).encode('utf8'); js += b' ' * ((-len(js)) % 4)
    glb = struct.pack('<III', magic, ver, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), jtype) + js + struct.pack('<II', len(out), btype) + out
    open(dst, 'wb').write(glb)
    print(dst, len(b), '->', len(glb), 'texture', len(binc[views[ib]['byteOffset']:]) if False else len(chunks[ib]))

main()
