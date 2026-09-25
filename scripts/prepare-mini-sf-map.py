"""Prepare the compact Mini SF geometry from published DataSF datasets.

This is an offline build step, never a browser request. Install Shapely to rerun:
  python -m pip install shapely
  python scripts/prepare-mini-sf-map.py
Cached downloads live in output/mini-sf-design; --refresh fetches them again.
The runtime data has no Python/Shapely dependency.
"""
from collections import defaultdict
from datetime import date
import json
from pathlib import Path
import sys
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'output/mini-sf-design'
# Also support the isolated builder dependency directory used during development.
sys.path.insert(0, str(CACHE / 'build-deps'))
from shapely.geometry import LineString, Polygon, shape  # noqa: E402

SOURCES = {
    'roads': ('sf-streets-source.json', 'https://data.sf.gov/resource/3psu-pn9h.json?$limit=30000'),
    'shoreline': ('sf-shoreline-source.json', 'https://data.sf.gov/resource/txuc-3kzm.geojson?$limit=100'),
    'neighborhoods': ('sf-neighborhoods-source.json', 'https://data.sf.gov/resource/j2bu-swwd.geojson?$limit=100'),
}


def source(kind):
    filename, url = SOURCES[kind]
    path = CACHE / filename
    if not path.exists() or '--refresh' in sys.argv:
        CACHE.mkdir(parents=True, exist_ok=True)
        data = json.load(urlopen(Request(url, headers={'User-Agent': 'BAYLINK-MiniSF-map-builder/1.0'})))
        path.write_text(json.dumps(data, separators=(',', ':')), encoding='utf-8')
    return json.loads(path.read_text(encoding='utf-8'))


def project(point):
    return [round((point[0] + 122.45) * 880, 2), round((37.77 - point[1]) * 1113, 2)]


def simplified_ring(ring):
    return project_path(Polygon(ring).simplify(.000025, preserve_topology=True).exterior.coords)


def project_path(points):
    result = []
    for point in points:
        p = project(point)
        if not result or p != result[-1]:
            result.append(p)
    return result


def title(name):
    special = {'JFK': 'JFK', 'US': 'US', 'HWY': 'Highway', 'AVE': 'Ave', 'BLVD': 'Blvd', 'DR': 'Dr', 'ST': 'St', 'CT': 'Ct'}
    return ' '.join(special.get(word, word.lower() if word[0].isdigit() else word.title()) for word in name.split())


def main():
    shoreline = source('shoreline')
    land = []
    for feature in shoreline['features']:
        geometry = shape(feature['geometry'])
        for polygon in (geometry.geoms if geometry.geom_type == 'MultiPolygon' else [geometry]):
            center = polygon.representative_point()
            # SF mainland + Alcatraz only; Treasure/Yerba Buena and Farallones are a later world.
            mainland = polygon.area > .005 and center.x > -122.6
            alcatraz = -122.43 < center.x < -122.415 and 37.82 < center.y < 37.835
            if mainland or alcatraz:
                land.append({'name': 'San Francisco' if mainland else 'Alcatraz', 'ring': simplified_ring(polygon.exterior.coords)})

    neighborhoods = []
    for feature in source('neighborhoods')['features']:
        properties = feature['properties']
        name = properties.get('nhood') or properties.get('name') or properties.get('neighborhood')
        if name == 'Treasure Island':
            continue
        geometry = shape(feature['geometry'])
        polygons = list(geometry.geoms) if geometry.geom_type == 'MultiPolygon' else [geometry]
        neighborhoods.append({'name': name, 'rings': [simplified_ring(p.exterior.coords) for p in polygons if p.area > .0000001]})
    neighborhoods.sort(key=lambda x: x['name'])

    # Join consecutive same-name segments before simplifying. This preserves real
    # intersections and bends while avoiding 16,000 independent draw objects.
    grouped = defaultdict(list)
    original_count = 0
    for row in source('roads'):
        layer, name = row.get('layer', ''), row.get('streetname', '').strip()
        code = int(row.get('classcode') or 0)
        if not row.get('active') or not row.get('line') or not name:
            continue
        # Some current island roads use ordinary STREETS / PRIVATE layers, so
        # layer filtering alone leaves roads floating over the unbuilt islands.
        if row.get('analysis_neighborhood') == 'Treasure Island' or row.get('nhood') in ('Treasure Island', 'Yerba Buena Island'):
            continue
        if code in (1, 6) or layer.startswith('PAPER') or layer in ('PSEUDO', 'STREETS_TI', 'STREETS_YBI', 'PRIVATE_PARKING'):
            continue
        path = row['line']['coordinates']
        if any(p[0] > -122.35 or p[0] < -122.52 or p[1] < 37.707 or p[1] > 37.82 for p in path):
            continue
        # Current scene access classification only, not a real-world routing rule.
        # JFK Promenade and pedestrian/private paths stay visible but are not driving roads.
        walk = layer in ('STREETS_PEDESTRI', 'PRIVATE', 'UPROW') or 'STAIR' in name or 'PATH' in name
        if name == 'JOHN F KENNEDY DR' and max(p[0] for p in path) > -122.477:
            walk = True
        if layer in ('PARKS_NPS_PRESIDIO', 'PARKS_NPS_FTMASON') and code == 0:
            walk = True
        points = project_path(path)
        if len(points) < 2:
            continue
        grouped[(title(name), code, int(walk))].append((str(row['cnn']), points))
        original_count += 1

    roads = []
    for (name, code, walk), parts in sorted(grouped.items()):
        ends = defaultdict(list)
        for index, (_, points) in enumerate(parts):
            ends[tuple(points[0])].append(index)
            ends[tuple(points[-1])].append(index)
        unused = set(range(len(parts)))
        while unused:
            start = min(unused)
            unused.remove(start)
            identifier, points = parts[start]
            points = list(points)
            for reverse in (False, True):
                if reverse:
                    points.reverse()
                while len(ends[tuple(points[-1])]) == 2:
                    candidate = next((i for i in ends[tuple(points[-1])] if i in unused), None)
                    if candidate is None:
                        break
                    unused.remove(candidate)
                    _, extension = parts[candidate]
                    if extension[-1] == points[-1]:
                        extension = extension[::-1]
                    points.extend(extension[1:])
            path = [[round(a, 2), round(b, 2)] for a, b in LineString(points).simplify(.025, preserve_topology=True).coords]
            roads.append((identifier, name, code, walk, path))
    names = sorted(set(r[1] for r in roads))
    name_index = {name: i for i, name in enumerate(names)}
    output = {
        'version': 1,
        'preparedOn': date.today().isoformat(),
        'projection': {'origin': [-122.45, 37.77], 'longitudeScale': 880, 'latitudeScale': 1113, 'northIsNegativeZ': True},
        'attribution': 'San Francisco Public Works / DataSF; Open Data Commons PDDL 1.0. Simplified for BAYLINK Mini SF.',
        'sources': {key: value[1] for key, value in SOURCES.items()},
        'originalRoadSegments': original_count,
        'land': land,
        'neighborhoods': neighborhoods,
        'streetNames': names,
        # Tuple schema: source CNN, street-name index, class code, walking-only flag, world polyline.
        'roads': [[identifier, name_index[name], code, walk, path] for identifier, name, code, walk, path in roads],
    }
    target = ROOT / 'src/features/little-bay/sf-geography.json'
    target.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{original_count} official segments -> {len(roads)} joined roads; {len(names)} names; {len(neighborhoods)} neighborhoods; {target.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
