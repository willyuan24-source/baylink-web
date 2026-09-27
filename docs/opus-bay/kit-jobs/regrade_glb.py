"""Re-grade the base-colour texture of a published Draco + WebP GLB in place (lane D2, wave 3).

Usage: python regrade_glb.py IN.glb OUT.glb '{"hue": [30, 70], "min_s": 0.15, "sat": 0.55, "val": 1.0}' [--q 82] [--png PREVIEW.png]

Only pixels whose hue (degrees) lies in `hue` and whose saturation is at least `min_s` change: their saturation is
multiplied by `sat` and their value by `val` (the other hues, e.g. terracotta roofs and white walls, stay as graded).
The geometry (Draco) buffer view is kept byte for byte; the image buffer view is replaced (WebP, quality --q) and the
buffer / view lengths are rewritten. Prints the share of changed texels and the mean colour before / after.
"""
import io, json, struct, sys
import numpy as np
from PIL import Image

src, dst, spec = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
q = int(sys.argv[sys.argv.index('--q') + 1]) if '--q' in sys.argv else 82
prev = sys.argv[sys.argv.index('--png') + 1] if '--png' in sys.argv else None

d = open(src, 'rb').read()
jl = struct.unpack('<I', d[12:16])[0]
j = json.loads(d[20:20 + jl])
b0 = 20 + jl + 8
blob = bytearray(d[b0:b0 + struct.unpack('<I', d[20 + jl:24 + jl])[0]])
img_i = j['images'][0]
bv = j['bufferViews'][img_i['bufferView']]
assert img_i['bufferView'] == len(j['bufferViews']) - 1, 'the image must be the last buffer view'
im = Image.open(io.BytesIO(bytes(blob[bv['byteOffset']:bv['byteOffset'] + bv['byteLength']]))).convert('RGB')

hsv = np.asarray(im.convert('HSV')).astype(np.float32)
h = hsv[..., 0] * 360 / 255
lo, hi = spec['hue']
sel = ((h >= lo) & (h <= hi) if lo <= hi else ((h >= lo) | (h <= hi))) & (hsv[..., 1] / 255 >= spec.get('min_s', 0))
before = np.asarray(im)[sel].mean(0)
hsv[..., 1] = np.where(sel, np.clip(hsv[..., 1] * spec.get('sat', 1.0), 0, 255), hsv[..., 1])
hsv[..., 2] = np.where(sel, np.clip(hsv[..., 2] * spec.get('val', 1.0), 0, 255), hsv[..., 2])
out = Image.fromarray(hsv.round().astype(np.uint8), 'HSV').convert('RGB')
after = np.asarray(out)[sel].mean(0)
if prev: out.save(prev)
buf = io.BytesIO(); out.save(buf, 'WEBP', quality=q, method=6); webp = buf.getvalue()

blob = blob[:bv['byteOffset']] + webp
while len(blob) % 4: blob += b'\0'
bv['byteLength'] = len(webp)
j['buffers'][0]['byteLength'] = len(blob)
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(blob), 0x004E4942) + bytes(blob)
open(dst, 'wb').write(glb)
print(json.dumps({'changed': round(float(sel.mean()), 3), 'mean_before': [round(float(x)) for x in before], 'mean_after': [round(float(x)) for x in after], 'bytes': len(glb)}))
