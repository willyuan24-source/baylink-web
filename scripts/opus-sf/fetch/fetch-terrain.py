"""Opus Bay SF data acquisition — AWS Open Data Terrain Tiles (terrarium PNG) -> float32 DEM grids.

Downloads z14 tiles over the SF bbox and z11 tiles over the wider Bay, keeps the raw PNGs, decodes
h = R*256 + G + B/256 - 32768 (metres, bathymetry negative), mosaics them in Web Mercator and resamples
(bilinear) to a regular lat/lng grid (cell-centre registration, row 0 = north).

Output per grid: <name>.f32 (little-endian float32, row-major, width*height) + <name>.json header.
Attribution: Terrain Tiles (Mapzen / AWS Open Data, https://registry.opendata.aws/terrain-tiles/);
sources for SF include USGS 3DEP (NED) and, over water, ETOPO1 / GMRT / NOAA bathymetry.
"""
import io, json, math, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'raw'))
URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
UA = 'OpusBay-research/1.0 (BAYLINK diorama prototype)'


def lng2x(lng, z):
    return (lng + 180.0) / 360.0 * 2 ** z


def lat2y(lat, z):
    r = math.radians(lat)
    return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** z


def y2lat(y, z):
    n = math.pi - 2 * math.pi * y / 2 ** z
    return math.degrees(math.atan(math.sinh(n)))


def fetch(z, x, y):
    d = os.path.join(ROOT, 'terrain', f'z{z}')
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, f'{x}_{y}.png')
    if not os.path.exists(p):
        for attempt in range(5):
            try:
                req = urllib.request.Request(URL.format(z=z, x=x, y=y), headers={'User-Agent': UA})
                with urllib.request.urlopen(req, timeout=60) as r:
                    data = r.read()
                with open(p, 'wb') as f:
                    f.write(data)
                break
            except Exception as e:  # noqa
                print('retry', z, x, y, e)
                time.sleep(2 * (attempt + 1))
        else:
            raise RuntimeError(f'failed {z}/{x}/{y}')
    im = np.asarray(Image.open(p).convert('RGB'), dtype=np.float64)
    return (x, y, im[:, :, 0] * 256 + im[:, :, 1] + im[:, :, 2] / 256 - 32768)


def build(name, z, s, w, n, e):
    t0 = time.time()
    x0, x1 = int(lng2x(w, z)), int(lng2x(e, z))
    y0, y1 = int(lat2y(n, z)), int(lat2y(s, z))
    jobs = [(z, x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
    with ThreadPoolExecutor(6) as ex:
        tiles = list(ex.map(lambda a: fetch(*a), jobs))
    W, H = (x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256
    mosaic = np.zeros((H, W), dtype=np.float64)
    for x, y, h in tiles:
        mosaic[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = h
    # regular lat/lng grid at ~native resolution
    dlng = 360.0 / (256 * 2 ** z)
    latc = (s + n) / 2
    dlat = dlng * math.cos(math.radians(latc))
    gw, gh = int(math.ceil((e - w) / dlng)), int(math.ceil((n - s) / dlat))
    lngs = w + (np.arange(gw) + 0.5) * dlng
    lats = n - (np.arange(gh) + 0.5) * dlat
    # mosaic pixel coords (pixel centres at +0.5)
    px = (np.array([lng2x(v, z) for v in lngs]) - x0) * 256 - 0.5
    py = (np.array([lat2y(v, z) for v in lats]) - y0) * 256 - 0.5
    PX, PY = np.meshgrid(px, py)
    ix = np.clip(np.floor(PX).astype(int), 0, W - 2)
    iy = np.clip(np.floor(PY).astype(int), 0, H - 2)
    fx, fy = PX - ix, PY - iy
    g = (mosaic[iy, ix] * (1 - fx) * (1 - fy) + mosaic[iy, ix + 1] * fx * (1 - fy)
         + mosaic[iy + 1, ix] * (1 - fx) * fy + mosaic[iy + 1, ix + 1] * fx * fy).astype('<f4')
    out = os.path.join(ROOT, name + '.f32')
    g.tofile(out)
    hdr = {
        'file': name + '.f32', 'dtype': 'float32', 'byteOrder': 'little', 'layout': 'row-major, row 0 = north',
        'width': gw, 'height': gh, 'units': 'metres above sea level (negative = bathymetry)',
        'registration': 'cell centre: lat = originLat - (row + 0.5) * dLat, lng = originLng + (col + 0.5) * dLng',
        'originLat': n, 'originLng': w, 'dLat': dlat, 'dLng': dlng,
        'bbox': {'south': s, 'west': w, 'north': n, 'east': e},
        'cellSizeMetres': {'x': dlng * 111320 * math.cos(math.radians(latc)), 'y': dlat * 110540},
        'source': {'tiles': URL.replace('{z}', str(z)), 'zoom': z, 'tileX': [x0, x1], 'tileY': [y0, y1],
                   'count': len(jobs), 'decode': 'h = R*256 + G + B/256 - 32768', 'resample': 'bilinear from Web Mercator mosaic'},
        'stats': {'min': float(g.min()), 'max': float(g.max()), 'mean': float(g.mean()),
                  'landCells(h>0.5)': int((g > 0.5).sum()), 'waterCells(h<=0)': int((g <= 0).sum())},
        'license': 'Terrain Tiles on AWS Open Data (Mapzen). Attribution required: see https://github.com/tilezen/joerd/blob/master/docs/attribution.md — '
                   'includes USGS 3DEP/NED (public domain), ETOPO1 (NOAA), GMRT (Lamont-Doherty), SRTM.',
        'created': time.strftime('%Y-%m-%dT%H:%M:%S'),
    }
    with open(os.path.join(ROOT, name + '.json'), 'w') as f:
        json.dump(hdr, f, indent=2)
    print(f'{name}: z{z} tiles x{x0}-{x1} y{y0}-{y1} ({len(jobs)}), grid {gw}x{gh}, '
          f'min {g.min():.1f} max {g.max():.1f}, {time.time() - t0:.1f}s, {os.path.getsize(out) / 1e6:.1f} MB')


if __name__ == '__main__':
    build('dem-sf-z14', 14, 37.700, -122.520, 37.835, -122.350)
    build('dem-bay-z11', 11, 37.45, -122.75, 38.05, -122.10)
