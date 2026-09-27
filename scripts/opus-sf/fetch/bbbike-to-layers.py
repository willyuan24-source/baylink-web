"""Fallback / cross-check: build the same layer files as fetch-osm.mjs from the BBBike SanFrancisco
OSM XML extract (raw/bbbike/SanFrancisco.osm.gz, bbox -122.54..-122.32 x 37.54..37.93), stdlib + numpy only.

Writes raw/bbbike-osm-<layer>.json in the Overpass JSON element format:
  way:      {type, id, bounds, geometry:[{lat,lon}], tags}
  relation: {type, id, bounds, members:[{type, ref, role, geometry|lat/lon}], tags}
  node:     {type, id, lat, lon, tags}
  pois:     {type, id, center:{lat,lon}, tags}   (bbox centre, like Overpass `out center`)
Data (c) OpenStreetMap contributors, ODbL 1.0.
"""
import gzip, json, os, re, sys, time
import xml.etree.ElementTree as ET
from array import array
import numpy as np

RAW = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'raw'))
SRC = os.path.join(RAW, 'bbbike', 'SanFrancisco.osm.gz')
SF = (37.700, -122.520, 37.835, -122.350)  # s, w, n, e

t0 = time.time()
nid = array('q'); nlat = array('d'); nlon = array('d')
tagged_nodes = []  # (id, lat, lon, tags)
ways = {}          # id -> (refs np.int64, tags or None)
rels = []          # (id, members[(type, ref, role)], tags)
osm_base = None

ctx = ET.iterparse(gzip.open(SRC, 'rb'), events=('start', 'end'))
cur = None
for ev, el in ctx:
    tag = el.tag
    if ev == 'start':
        if tag in ('node', 'way', 'relation'):
            cur = {'tags': {}, 'refs': [], 'members': []}
        elif tag == 'osm':
            osm_base = el.attrib.get('timestamp')
        continue
    if tag == 'tag' and cur is not None:
        cur['tags'][el.attrib['k']] = el.attrib['v']
    elif tag == 'nd' and cur is not None:
        cur['refs'].append(int(el.attrib['ref']))
    elif tag == 'member' and cur is not None:
        cur['members'].append((el.attrib['type'], int(el.attrib['ref']), el.attrib.get('role', '')))
    elif tag == 'node':
        i = int(el.attrib['id']); la = float(el.attrib['lat']); lo = float(el.attrib['lon'])
        nid.append(i); nlat.append(la); nlon.append(lo)
        if cur['tags']:
            tagged_nodes.append((i, la, lo, cur['tags']))
        cur = None; el.clear()
    elif tag == 'way':
        ways[int(el.attrib['id'])] = (np.array(cur['refs'], dtype=np.int64), cur['tags'] or None)
        cur = None; el.clear()
    elif tag == 'relation':
        rels.append((int(el.attrib['id']), cur['members'], cur['tags']))
        cur = None; el.clear()
print(f'parsed: {len(nid)} nodes ({len(tagged_nodes)} tagged), {len(ways)} ways, {len(rels)} relations, {time.time()-t0:.0f}s', flush=True)

NID = np.frombuffer(nid, dtype=np.int64); order = np.argsort(NID, kind='stable')
NID = NID[order]; NLAT = np.frombuffer(nlat, dtype=np.float64)[order]; NLON = np.frombuffer(nlon, dtype=np.float64)[order]


def coords(refs):
    idx = np.searchsorted(NID, refs)
    idx = np.clip(idx, 0, len(NID) - 1)
    ok = NID[idx] == refs
    return NLAT[idx[ok]], NLON[idx[ok]], bool(ok.all())


def bounds_of(lat, lon):
    return {'minlat': round(float(lat.min()), 7), 'minlon': round(float(lon.min()), 7), 'maxlat': round(float(lat.max()), 7), 'maxlon': round(float(lon.max()), 7)}


def inter(b, box):
    s, w, n, e = box
    return not (b['maxlat'] < s or b['minlat'] > n or b['maxlon'] < w or b['minlon'] > e)


def geom(lat, lon):
    return [{'lat': round(float(a), 7), 'lon': round(float(o), 7)} for a, o in zip(lat, lon)]


way_cache = {}


def way_el(wid, with_tags=True):
    if wid not in ways:
        return None
    refs, tags = ways[wid]
    lat, lon, complete = coords(refs)
    if len(lat) == 0:
        return None
    el = {'type': 'way', 'id': wid, 'bounds': bounds_of(lat, lon), 'geometry': geom(lat, lon)}
    if not complete:
        el['incomplete'] = True
    if with_tags and tags:
        el['tags'] = tags
    return el


def rel_el(r):
    rid, members, tags = r
    out = []; lats = []; lons = []
    for typ, ref, role in members:
        m = {'type': typ, 'ref': ref, 'role': role}
        if typ == 'way' and ref in ways:
            lat, lon, _ = coords(ways[ref][0])
            if len(lat):
                m['geometry'] = geom(lat, lon); lats.append(lat); lons.append(lon)
        elif typ == 'node':
            i = np.searchsorted(NID, ref)
            if i < len(NID) and NID[i] == ref:
                m['lat'] = float(NLAT[i]); m['lon'] = float(NLON[i]); lats.append(NLAT[i:i+1]); lons.append(NLON[i:i+1])
        out.append(m)
    if not lats:
        return None
    lat = np.concatenate(lats); lon = np.concatenate(lons)
    return {'type': 'relation', 'id': rid, 'bounds': bounds_of(lat, lon), 'members': out, 'tags': tags}


def center_of(el):
    if el['type'] == 'node':
        return {'type': 'node', 'id': el['id'], 'lat': el['lat'], 'lon': el['lon'], 'tags': el['tags']}
    b = el['bounds']
    return {'type': el['type'], 'id': el['id'], 'center': {'lat': round((b['minlat'] + b['maxlat']) / 2, 7), 'lon': round((b['minlon'] + b['maxlon']) / 2, 7)}, 'tags': el.get('tags', {})}


def rx(p):
    return re.compile(p)


RAIL_NODE = rx(r'^(station|halt|tram_stop|stop|subway_entrance|platform)$')
ROUTE = rx(r'^(cable_car|tram|light_rail|subway|train|funicular|monorail)$')
MM = rx(r'^(pier|breakwater|groyne|bridge|quay)$')
POI_MM = rx(r'^(tower|lighthouse|windmill|obelisk|observatory|flagpole|mast|water_tower|crane)$')
POI_AM = rx(r'^(place_of_worship|theatre|cinema|arts_centre|library|marketplace|ferry_terminal|townhall|university|college|fountain|clock)$')
POI_LE = rx(r'^(park|garden|stadium|sports_centre|marina|golf_course|playground|nature_reserve)$')
POI_PL = rx(r'^(neighbourhood|suburb|quarter|locality|island|islet|square)$')
POI_NA = rx(r'^(peak|hill|beach|cape|bay|cliff|rock|spring|saddle)$')


def is_building(t): return 'building' in t or 'building:part' in t
def is_highway(t): return 'highway' in t
def is_rail_way(t): return 'railway' in t
def is_land(t, rel=False):
    if any(k in t for k in ('landuse', 'leisure', 'natural', 'water')):
        return True
    if rel:
        return MM.match(t.get('man_made', '')) is not None and t.get('man_made') in ('pier', 'bridge') or t.get('place') in ('island', 'islet')
    return ('waterway' in t or t.get('amenity') in ('grave_yard', 'parking') or MM.match(t.get('man_made', '')) is not None
            or 'area:highway' in t or t.get('place') in ('island', 'islet'))
def is_poi(t):
    return ('tourism' in t or 'historic' in t or POI_MM.match(t.get('man_made', '')) is not None
            or ('name' in t and (POI_AM.match(t.get('amenity', '')) or POI_LE.match(t.get('leisure', ''))))
            or POI_PL.match(t.get('place', '')) is not None or POI_NA.match(t.get('natural', '')) is not None
            or ('building' in t and 'name' in t and 'height' in t) or ('building' in t and 'wikidata' in t)
            or ('wikidata' in t and 'name' in t))
def is_backdrop_way(t):
    return (t.get('natural') == 'coastline' or (t.get('highway') in ('motorway', 'trunk') and 'bridge' in t) or t.get('man_made') == 'bridge'
            or (t.get('natural') == 'water' and 'name' in t) or t.get('place') in ('island', 'islet'))


layers = {k: [] for k in ('boundary', 'buildings', 'highways', 'railways', 'landcover', 'pois', 'backdrop')}
EXT = (37.54, -122.54, 37.93, -122.32)
for wid, (refs, tags) in ways.items():
    if not tags:
        continue
    wants = []
    if is_building(tags): wants.append(('buildings', SF))
    if is_highway(tags): wants.append(('highways', SF))
    if is_rail_way(tags): wants.append(('railways', SF))
    if is_land(tags): wants.append(('landcover', SF))
    if is_poi(tags): wants.append(('pois', SF))
    if is_backdrop_way(tags): wants.append(('backdrop', EXT))
    if not wants:
        continue
    el = way_el(wid)
    if el is None:
        continue
    for layer, box in wants:
        if inter(el['bounds'], box):
            layers[layer].append(center_of(el) if layer == 'pois' else el)
for i, la, lo, tags in tagged_nodes:
    node = {'type': 'node', 'id': i, 'lat': la, 'lon': lo, 'tags': tags}
    inside = SF[0] <= la <= SF[2] and SF[1] <= lo <= SF[3]
    if inside and (RAIL_NODE.match(tags.get('railway', '')) or (tags.get('public_transport') in ('stop_position', 'platform', 'station') and (tags.get('tram') == 'yes' or tags.get('cable_car') == 'yes'))):
        layers['railways'].append(node)
    if inside and is_poi(tags):
        layers['pois'].append(node)
    if tags.get('place') in ('city', 'town', 'island') or (tags.get('natural') == 'peak' and 'name' in tags):
        layers['backdrop'].append(node)
for r in rels:
    rid, members, tags = r
    if not tags:
        continue
    wants = []
    if tags.get('boundary') == 'administrative' and tags.get('name') in ('San Francisco', 'City and County of San Francisco') and tags.get('admin_level') in ('6', '8'):
        wants.append(('boundary', None))
    if is_building(tags): wants.append(('buildings', SF))
    if ROUTE.match(tags.get('route', '')): wants.append(('railways', SF))
    if is_land(tags, rel=True): wants.append(('landcover', SF))
    if is_poi(tags): wants.append(('pois', SF))
    if (tags.get('natural') == 'water' and 'name' in tags) or tags.get('place') in ('island', 'islet') or (tags.get('boundary') in ('national_park', 'protected_area') and 'name' in tags):
        wants.append(('backdrop', EXT))
    if not wants:
        continue
    el = rel_el(r)
    if el is None:
        continue
    for layer, box in wants:
        if box is None or inter(el['bounds'], box):
            layers[layer].append(center_of(el) if layer == 'pois' else el)

for layer, els in layers.items():
    out = os.path.join(RAW, f'bbbike-osm-{layer}.json')
    with open(out, 'w', encoding='utf8') as f:
        f.write(json.dumps({'generator': 'bbbike-to-layers.py from BBBike SanFrancisco.osm.gz', 'license': 'Data (c) OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright',
                            'osm_base': osm_base, 'job': layer, 'bbox': SF if layer != 'backdrop' else EXT})[:-1] + ',"elements":[\n')
        for k, el in enumerate(els):
            f.write(json.dumps(el, separators=(',', ':'), ensure_ascii=False) + (',\n' if k < len(els) - 1 else '\n'))
        f.write(']}\n')
    print(f'{layer}: {len(els)} elements, {os.path.getsize(out)/1e6:.1f} MB', flush=True)
print(f'done in {time.time()-t0:.0f}s; osm_base {osm_base}')
