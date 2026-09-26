"""Top-down preview in Opus Bay world units (district.ts projection): land mask, buildings by height, current slab, landmarks."""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RAW = os.path.join(ROOT, 'raw')
RAD = math.pi / 180; K = 0.14; C = math.cos(46 * RAD); S = math.sin(46 * RAD); MX = 111320 * math.cos(37.802338 * RAD); MZ = 110540
def proj(lat, lng):
    e = (lng + 122.40001) * MX; n = (lat - 37.802338) * MZ
    return K * (e * C - n * S), K * (-e * S - n * C)
X0, X1, Z0, Z1 = -1100, 1350, -650, 2000
SC = 0.8  # px per u
W, H = int((X1 - X0) * SC), int((Z1 - Z0) * SC)
img = Image.new('RGB', (W, H), (243, 236, 223)); d = ImageDraw.Draw(img)
px = lambda x, z: ((x - X0) * SC, (z - Z0) * SC)
# land / water from DEM grid (sampled)
h = json.load(open(os.path.join(RAW, 'dem-sf-z14.json'), encoding='utf8'))
dem = np.fromfile(os.path.join(RAW, 'dem-sf-z14.f32'), '<f4').reshape(h['height'], h['width'])
mask = np.fromfile(os.path.join(RAW, 'sf-landmask-z14.u8'), 'u1').reshape(h['height'], h['width'])
for r in range(0, h['height'], 2):
    lat = h['originLat'] - (r + 0.5) * h['dLat']
    for c in range(0, h['width'], 2):
        lng = h['originLng'] + (c + 0.5) * h['dLng']
        x, z = proj(lat, lng)
        v = dem[r, c]
        col = (int(150 + 90 * min(1, v / 280)), int(175 + 60 * min(1, v / 280)), int(130 + 90 * min(1, v / 280))) if v > 0.5 else (121, 193, 187) if v > -15 else (63, 143, 149)
        if mask[r, c] == 0 and v > 0.5: col = tuple(int(q * 0.8) for q in col)
        X, Z = px(x, z); d.rectangle([X, Z, X + 2, Z + 2], fill=col)
# buildings
for line in open(os.path.join(RAW, 'bbbike-osm-buildings.json'), encoding='utf8'):
    if not line.startswith('{"type":"way"'): continue
    e = json.loads(line.rstrip().rstrip(','))
    t = e.get('tags', {})
    if 'building' not in t: continue
    pts = [px(*proj(p['lat'], p['lon'])) for p in e['geometry']]
    try: hh = float(t.get('height', 'x'))
    except ValueError: hh = 7
    g = max(0, min(1, (hh - 5) / 60))
    d.polygon(pts, fill=(int(233 - 120 * g), int(224 - 140 * g), int(207 - 100 * g)))
# slab (district.ts:409)
slab = [(-226, -104), (224, -104), (244, -84), (244, 100), (230, 114), (-150, 114), (-246, 44), (-246, -84)]
d.polygon([px(x, z) for x, z in slab], outline=(216, 116, 74), width=3)
lm = json.load(open(os.path.join(ROOT, 'landmarks.json'), encoding='utf8'))
for l in lm['landmarks']:
    X, Z = px(l['world']['x'], l['world']['z'])
    d.ellipse([X - 4, Z - 4, X + 4, Z + 4], fill=(224, 169, 74), outline=(60, 40, 20))
    d.text((X + 6, Z - 6), l['id'], fill=(40, 30, 20))
    for k, p in (l.get('points') or {}).items():
        X, Z = px(p['world']['x'], p['world']['z']); d.ellipse([X - 3, Z - 3, X + 3, Z + 3], fill=(200, 60, 40))
# grid every 256 u
for x in range(-1024, 1350, 256):
    d.line([px(x, Z0), px(x, Z1)], fill=(200, 190, 175), width=1); d.text(px(x + 2, Z0 + 4), f'x={x}', fill=(120, 110, 100))
for z in range(-512, 2000, 256):
    d.line([px(X0, z), px(X1, z)], fill=(200, 190, 175), width=1); d.text(px(X0 + 4, z + 2), f'z={z}', fill=(120, 110, 100))
out = os.path.join(ROOT, 'sf-world-preview.png'); img.save(out); print(out, img.size)
