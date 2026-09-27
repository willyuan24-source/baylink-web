"""
Lane H2b (H2b-10): pack the eight Mission murals into the panel atlas and the UI singles.

  <venv>/python scripts/opus-sf/murals/murals_post.py --raw C:/Users/willy/opus-qa/w3/h2b/murals/raw --repo C:/Users/willy/wt/h2b

Atlas: 2048 × 1024, 4 × 2 tiles of 512 px in MURALS order (row-major from the top left). Each mural is resized to
TILE_ART px and framed by a GUTTER px border that repeats its own edge pixels, so mipmaps and anisotropic sampling never
bleed a neighbour into a panel (the panel UVs cover the art only: data/murals.ts muralRect). WebP, the quality stepped
down until the file is ≤ ATLAS_TARGET bytes. Singles: 512 px WebP of the whole mural (UI cards). Writes
docs/opus-bay/h2b/murals-report.json (sources, sizes, bytes, sha256).
"""
import argparse, hashlib, io, json, os
import numpy as np
from PIL import Image

TILE, GUTTER = 512, 16
TILE_ART = TILE - 2 * GUTTER
ATLAS_W, ATLAS_H = 2048, 1024
ATLAS_TARGET = 260_000

# id, source file (raw/), Higgsfield job id; MURALS order in data/murals.ts
MURALS = [
    ('sun-hummingbird', 'ab-gpt-sun.png', '76baf3e7-c419-4cb2-adc6-41bb856b162f'),
    ('poppy-hills', 'm-poppies.png', '1602341c-b13c-4261-890d-080b17229fa0'),
    ('fruit-stand', 'm-market-b.png', 'cdc779dd-c2e6-4b92-a9ca-9ca9eb5662d2'),
    ('music-garden', 'm-music.png', '82dacccc-855b-4eac-8318-08c860f244a5'),
    ('pelican-bay', 'ab-gpt-pelican.png', '99ff5d30-d6b9-4fe2-8d2c-bbf04a618d3d'),
    ('flower-cable-car', 'm-cable-a.png', '90fae8d5-f281-465a-a14a-6e200f075f3f'),
    ('night-bay', 'm-night.png', '042154ba-b1f9-47c0-9178-bb444aefb7a2'),
    ('kelp-forest', 'm-ocean.png', '76869d60-f9e9-407b-b299-2e3b7ac79cb5'),
]


def webp(img, q):
    b = io.BytesIO()
    img.save(b, 'WEBP', quality=q, method=6)
    return b.getvalue()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--raw', required=True)
    ap.add_argument('--repo', required=True)
    a = ap.parse_args()
    out = f'{a.repo}/public/opus-bay/murals'
    os.makedirs(out, exist_ok=True)
    atlas = np.zeros((ATLAS_H, ATLAS_W, 3), dtype=np.uint8)
    report = {'atlas': {}, 'murals': []}
    for k, (mid, src, job) in enumerate(MURALS):
        im = Image.open(f'{a.raw}/{src}').convert('RGB')
        w, h = im.size
        s = min(w, h)
        im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
        art = np.asarray(im.resize((TILE_ART, TILE_ART), Image.LANCZOS))
        tile = np.pad(art, ((GUTTER, GUTTER), (GUTTER, GUTTER), (0, 0)), mode='edge')
        col, row = k % 4, k // 4
        atlas[row * TILE:(row + 1) * TILE, col * TILE:(col + 1) * TILE] = tile
        single = webp(im.resize((512, 512), Image.LANCZOS), 82)
        path = f'{out}/{mid}-512.webp'
        open(path, 'wb').write(single)
        report['murals'].append({'id': mid, 'source': src, 'job_id': job, 'tile': [col, row],
                                 'single': {'path': f'public/opus-bay/murals/{mid}-512.webp', 'bytes': len(single), 'sha256': hashlib.sha256(single).hexdigest()}})
    img = Image.fromarray(atlas)
    for q in range(84, 40, -2):
        data = webp(img, q)
        if len(data) <= ATLAS_TARGET:
            break
    open(f'{out}/atlas-v1.webp', 'wb').write(data)
    report['atlas'] = {'path': 'public/opus-bay/murals/atlas-v1.webp', 'size': [ATLAS_W, ATLAS_H], 'tile': TILE, 'gutter': GUTTER, 'quality': q,
                       'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    with open(f'{a.repo}/docs/opus-bay/h2b/murals-report.json', 'w', encoding='utf-8', newline='\n') as f:
        json.dump(report, f, indent=1)
        f.write('\n')
    print(json.dumps(report['atlas']), sum(m['single']['bytes'] for m in report['murals']))


if __name__ == '__main__':
    main()
