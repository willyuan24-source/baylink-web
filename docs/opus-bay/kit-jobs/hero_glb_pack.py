"""Hero GLB packing (lane D2, HC-4): smaller district hero GLBs that the plain three.js GLTFLoader still reads.

    python docs/opus-bay/kit-jobs/hero_glb_pack.py public/opus-bay/models/baybay.glb [...] [--out DIR] [--q 86]

The five district heroes (BAYBAY, pelican, sailboat, the two sea lions) are loaded by lane E2's actors/system.ts and
lane F's world/life.ts with a bare GLTFLoader (no DRACOLoader, no meshopt decoder), so Draco is out until those loaders
take one (a request in docs/opus-bay/sf-w3-D2.md). What the bare loader reads, and this script writes:

  * NORMAL      float32 x3 -> int8 x3 normalized (+1 pad byte)         KHR_mesh_quantization
  * TEXCOORD_0  float32 x2 -> uint16 x2 normalized (when inside [0, 1])  KHR_mesh_quantization
  * WEIGHTS_0   float32 x4 -> uint8 x4 normalized, re-summed to 255      (core glTF 2.0)
  * animation rotations  float32 x4 -> int16 x4 normalized              (core glTF 2.0)
  * base colour JPEG / PNG -> WebP (quality --q)                         EXT_texture_webp (required; the city's kit
                                                                         and landmark GLBs already rely on it)

POSITION stays float32: life.ts bakes the node matrix into a clone of the geometry (applyMatrix4), which would clamp a
normalized position attribute, and BAYBAY is skinned. Indices, the scene graph, names, skins and materials are kept.
Every accessor keeps its count; buffer views are re-packed 4-byte aligned. Prints the bytes before / after.
"""
import io
import json
import math
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(p):
    b = Path(p).read_bytes()
    assert b[:4] == b'glTF'
    jl, = struct.unpack('<I', b[12:16])
    j = json.loads(b[20:20 + jl])
    o = 20 + jl
    bl, = struct.unpack('<I', b[o:o + 4])
    return j, b[o + 8:o + 8 + bl]


def accessor(j, bin_, i):
    a = j['accessors'][i]
    bv = j['bufferViews'][a['bufferView']]
    dt, n = CT[a['componentType']], NC[a['type']]
    item = np.dtype(dt).itemsize * n
    stride = bv.get('byteStride') or item
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    raw = np.frombuffer(bin_, dtype=np.uint8, count=stride * (a['count'] - 1) + item, offset=start)
    rows = np.lib.stride_tricks.as_strided(raw, shape=(a['count'], item), strides=(stride, 1))
    return np.frombuffer(rows.copy().tobytes(), dtype=dt).reshape(a['count'], n)


def pack(p, out, q):
    j, bin_ = read_glb(p)
    before = Path(p).stat().st_size
    new_views, chunks = [], []
    offset = 0

    def add_view(data: bytes, target=None, stride=None):
        nonlocal offset
        pad = (-offset) % 4
        if pad:
            chunks.append(b'\0' * pad)
            offset += pad
        v = {'buffer': 0, 'byteOffset': offset, 'byteLength': len(data)}
        if target:
            v['target'] = target
        if stride:
            v['byteStride'] = stride
        chunks.append(data)
        offset += len(data)
        new_views.append(v)
        return len(new_views) - 1

    replaced = {}  # accessor index -> (new data bytes, componentType, normalized, stride)
    used = set()
    for m in j.get('meshes', []):
        for pr in m['primitives']:
            at = pr['attributes']
            if 'NORMAL' in at:
                n = accessor(j, bin_, at['NORMAL']).astype(np.float64)
                n /= np.maximum(1e-9, np.linalg.norm(n, axis=1, keepdims=True))
                qn = np.clip(np.round(n * 127), -127, 127).astype(np.int8)
                qn = np.concatenate([qn, np.zeros((len(qn), 1), np.int8)], axis=1)
                replaced[at['NORMAL']] = (qn.tobytes(), 5120, True, 4)
                used.add('KHR_mesh_quantization')
            if 'TEXCOORD_0' in at:
                uv = accessor(j, bin_, at['TEXCOORD_0'])
                if uv.min() >= 0 and uv.max() <= 1:
                    quv = np.round(uv.astype(np.float64) * 65535).astype(np.uint16)
                    replaced[at['TEXCOORD_0']] = (quv.tobytes(), 5123, True, 4)
                    used.add('KHR_mesh_quantization')
            if 'WEIGHTS_0' in at:
                w = accessor(j, bin_, at['WEIGHTS_0']).astype(np.float64)
                w /= np.maximum(1e-9, w.sum(axis=1, keepdims=True))
                qw = np.floor(w * 255).astype(np.int32)
                # hand the rounding remainder to the largest weight so each row sums to exactly 255
                rem = 255 - qw.sum(axis=1)
                qw[np.arange(len(qw)), np.argmax(w, axis=1)] += rem
                replaced[at['WEIGHTS_0']] = (qw.astype(np.uint8).tobytes(), 5121, True, 4)
    for an in j.get('animations', []):
        for ch in an['channels']:
            if ch['target'].get('path') != 'rotation':
                continue
            si = an['samplers'][ch['sampler']]['output']
            if si in replaced:
                continue
            r = accessor(j, bin_, si).astype(np.float64)
            replaced[si] = (np.clip(np.round(r * 32767), -32767, 32767).astype(np.int16).tobytes(), 5122, True, None)

    # re-pack: every accessor gets its own tight view (targets kept for vertex / index data)
    view_target = {}
    for m in j.get('meshes', []):
        for pr in m['primitives']:
            for a in pr['attributes'].values():
                view_target[a] = 34962
            if 'indices' in pr:
                view_target[pr['indices']] = 34963
    for i, a in enumerate(j['accessors']):
        if i in replaced:
            data, ct, norm, stride = replaced[i]
            a['componentType'] = ct
            a['normalized'] = norm
            a.pop('min', None)
            a.pop('max', None)
            a['bufferView'] = add_view(data, view_target.get(i), stride)
        else:
            arr = accessor(j, bin_, i)
            a['bufferView'] = add_view(arr.tobytes(), view_target.get(i), None)
        a.pop('byteOffset', None)
    # images -> WebP
    webp = False
    for img in j.get('images', []):
        bv = j['bufferViews'][img['bufferView']]
        src = bin_[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        im = Image.open(io.BytesIO(src))
        im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') and 'A' in im.getbands() else 'RGB')
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=q, method=6)
        img['bufferView'] = add_view(buf.getvalue())
        img['mimeType'] = 'image/webp'
        webp = True
    if webp:
        for t in j.get('textures', []):
            s = t.pop('source')
            t.setdefault('extensions', {})['EXT_texture_webp'] = {'source': s}
        used.add('EXT_texture_webp')
    j['bufferViews'] = new_views
    new_bin = b''.join(chunks)
    new_bin += b'\0' * ((-len(new_bin)) % 4)
    j['buffers'] = [{'byteLength': len(new_bin)}]
    if used:
        j['extensionsUsed'] = sorted(set(j.get('extensionsUsed', [])) | used)
        j['extensionsRequired'] = sorted(set(j.get('extensionsRequired', [])) | used)
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    total = 12 + 8 + len(js) + 8 + len(new_bin)
    glb = struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(new_bin), 0x004E4942) + new_bin
    Path(out).write_bytes(glb)
    print(f'{Path(p).name}: {before} -> {len(glb)} B ({100 * len(glb) / before:.0f} %), {sorted(used)}')
    return before, len(glb)


if __name__ == '__main__':
    args = sys.argv[1:]
    outdir = Path(args[args.index('--out') + 1]) if '--out' in args else None
    q = int(args[args.index('--q') + 1]) if '--q' in args else 86
    files = [a for i, a in enumerate(args) if not a.startswith('--') and (i == 0 or args[i - 1] not in ('--out', '--q'))]
    tb = ta = 0
    for f in files:
        dst = (outdir / Path(f).name) if outdir else Path(f)
        b, a = pack(f, dst, q)
        tb += b
        ta += a
    print(f'total {tb} -> {ta} B ({100 * ta / max(1, tb):.0f} %)')
