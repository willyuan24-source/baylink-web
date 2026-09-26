"""SF land mask aligned with raw/dem-sf-z14 grid + world-unit bounds of SF land.

Assembles the SF county boundary (OSM relation 111968, raw/osm-boundary-rel111968-full.json) into rings,
rasterises it on the DEM grid (PIL), and classifies: 0 = outside SF, 1 = SF land (DEM > 0.5 m), 2 = SF water.
Writes raw/sf-landmask-z14.u8 (+ .json header = same grid as dem-sf-z14.json) and prints world bounds using
the Opus Bay projection (district.ts project(), K = 0.14 u/m, rotated 46 deg).
"""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw

RAW = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'raw'))
hdr = json.load(open(os.path.join(RAW, 'dem-sf-z14.json'), encoding='utf8'))
W, H = hdr['width'], hdr['height']
dem = np.fromfile(os.path.join(RAW, 'dem-sf-z14.f32'), '<f4').reshape(H, W)

j = json.load(open(os.path.join(RAW, 'osm-boundary-rel111968-full.json'), encoding='utf8'))
nodes = {e['id']: (e['lat'], e['lon']) for e in j['elements'] if e['type'] == 'node'}
ways = {e['id']: e['nodes'] for e in j['elements'] if e['type'] == 'way'}
rel = [e for e in j['elements'] if e['type'] == 'relation'][0]
outer = [ways[m['ref']] for m in rel['members'] if m['type'] == 'way' and m['role'] == 'outer' and m['ref'] in ways]
# join ways into closed rings
rings = []
pool = [list(w) for w in outer]
while pool:
    ring = pool.pop(0)
    changed = True
    while ring[0] != ring[-1] and changed:
        changed = False
        for i, w in enumerate(pool):
            if w[0] == ring[-1]: ring += w[1:]
            elif w[-1] == ring[-1]: ring += w[::-1][1:]
            elif w[-1] == ring[0]: ring = w[:-1] + ring
            elif w[0] == ring[0]: ring = w[::-1][:-1] + ring
            else: continue
            pool.pop(i); changed = True; break
    rings.append(ring)
print('outer rings:', len(rings), [len(r) for r in rings], 'closed:', [r[0] == r[-1] for r in rings])

img = Image.new('L', (W, H), 0)
d = ImageDraw.Draw(img)
for r in rings:
    pts = []
    for nid in r:
        la, lo = nodes[nid]
        pts.append(((lo - hdr['originLng']) / hdr['dLng'] - 0.5, (hdr['originLat'] - la) / hdr['dLat'] - 0.5))
    d.polygon(pts, fill=1)
inside = np.asarray(img, dtype=np.uint8) == 1
# The county line follows the Marin shore of the Golden Gate: drop Marin cliff cells that fall inside it.
_lat = hdr['originLat'] - (np.arange(H)[:, None] + 0.5) * hdr['dLat']
_lng = hdr['originLng'] + (np.arange(W)[None, :] + 0.5) * hdr['dLng']
inside &= ~((_lat > 37.815) & (_lng < -122.44))
mask = np.zeros((H, W), np.uint8)
mask[inside & (dem > 0.5)] = 1
mask[inside & (dem <= 0.5)] = 2
mask.tofile(os.path.join(RAW, 'sf-landmask-z14.u8'))
mh = dict(hdr); mh.update({'file': 'sf-landmask-z14.u8', 'dtype': 'uint8', 'units': '0 = outside SF boundary (rel 111968), 1 = SF land (DEM > 0.5 m), 2 = SF water (inside boundary)',
                            'note': 'Land test is a DEM threshold, so low fill (piers, some Mission Bay / Hunters Point edges) may read as water; use OSM coastline for exact shorelines.'})
mh.pop('stats', None)
json.dump(mh, open(os.path.join(RAW, 'sf-landmask-z14.json'), 'w'), indent=2)

cell_m2 = hdr['cellSizeMetres']['x'] * hdr['cellSizeMetres']['y']
land = mask == 1
print(f"SF land area (DEM>0.5 inside boundary, within bbox): {land.sum() * cell_m2 / 1e6:.1f} km2; inside-boundary cells in bbox: {inside.sum() * cell_m2 / 1e6:.1f} km2")

# world bounds (district.ts projection)
RAD = math.pi / 180; K = 0.14; ROT = 46 * RAD; LAT0 = 37.802338; LNG0 = -122.40001
MX = 111320 * math.cos(LAT0 * RAD); MZ = 110540; C = math.cos(ROT); S = math.sin(ROT)
rows, cols = np.nonzero(land)
lat = hdr['originLat'] - (rows + 0.5) * hdr['dLat']; lng = hdr['originLng'] + (cols + 0.5) * hdr['dLng']
e = (lng - LNG0) * MX; n = (lat - LAT0) * MZ
x = K * (e * C - n * S); z = K * (-e * S - n * C)
print(f'world bounds of SF land: x {x.min():.0f} .. {x.max():.0f} ({x.max()-x.min():.0f} u), z {z.min():.0f} .. {z.max():.0f} ({z.max()-z.min():.0f} u)')
# mainland only (exclude Treasure Island / YBI / Alcatraz: lng > -122.385 & lat > 37.805, or Alcatraz box)
main = ~(((lng > -122.385) & (lat > 37.803)) | ((lat > 37.822) & (lng > -122.43) & (lng < -122.415)))
print(f'world bounds of SF mainland: x {x[main].min():.0f} .. {x[main].max():.0f}, z {z[main].min():.0f} .. {z[main].max():.0f}')
print(f'lat/lng bounds of SF land: lat {lat.min():.4f}..{lat.max():.4f}, lng {lng.min():.4f}..{lng.max():.4f}')
print('land elevation m: max', float(dem[land].max()), 'mean', round(float(dem[land].mean()), 1), 'p50', float(np.percentile(dem[land], 50)), 'p90', float(np.percentile(dem[land], 90)))
json.dump({'worldBoundsLand': {'minX': float(x.min()), 'maxX': float(x.max()), 'minZ': float(z.min()), 'maxZ': float(z.max())},
           'worldBoundsMainland': {'minX': float(x[main].min()), 'maxX': float(x[main].max()), 'minZ': float(z[main].min()), 'maxZ': float(z[main].max())},
           'landAreaKm2': float(land.sum() * cell_m2 / 1e6), 'elevation': {'max': float(dem[land].max()), 'mean': float(dem[land].mean())}},
          open(os.path.join(RAW, 'sf-bounds-world.json'), 'w'), indent=2)
# preview PNG
prev = np.zeros((H, W, 3), np.uint8)
hl = np.clip(dem / 285.0, 0, 1)
prev[..., 0] = np.where(land, 120 + 120 * hl, np.where(mask == 2, 70, 230)); prev[..., 1] = np.where(land, 150 + 90 * hl, np.where(mask == 2, 140, 225)); prev[..., 2] = np.where(land, 90 + 120 * hl, np.where(mask == 2, 150, 215))
Image.fromarray(prev).resize((W // 2, H // 2)).save(os.path.join(RAW, 'sf-landmask-preview.png'))
