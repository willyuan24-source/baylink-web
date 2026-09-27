"""Blender 5.2 headless cleanup for the wave-4 AI landmark meshes (lane V, W4-V4).

Copied from lane D2's wave-3 docs/opus-bay/kit-jobs/kit_cleanup.py (the D2-15 landmark variant: --grader hero, --gate,
--box) so wave 4 builds on the exact pipeline that shipped the part-1 / part-2a landmarks; grade.py and iou.py next to
this file are the same copies. Wave-4 use (see docs/opus-bay/sf-w4-V.md):
  blender -b -P w4_cleanup.py -- RAW.glb OUT.glb WORKDIR --grader hero --tex 1024 --draco 1 --max-tris 6000
      --height H --concept CONCEPT.png [--mask OUT-mask.webp] [--grade '{json}'] [--flatten F] [--yaw D]

Original notes follow.

Kit additions (lane H2a, 2026-09-26): --box W,H,D scales width (three x) and height (y) exactly and brings the depth
(three z) to D: the depth is first scaled like the width, then, if it is short, only the middle band between the
front --keep-front fraction and the back --keep-back fraction is stretched (piecewise linear along the depth), so the
facade (bays, stoops, cornice) and the rear roof ends keep their shape; if it is long, the whole depth is scaled down.
Grade/IoU scripts are read from this folder (wave 3; the parent folder as a fallback).
Landmark additions (lane D2, wave 3): --grader hero runs grade.py (per-asset hue remaps to brand hex, the part-1
hero pipeline of the rotunda / gate / conservatory) instead of grade_kit.py; --exposure sets the preview exposure;
--gate W,K,Z[,F] widens a gateway in a front screen (see below).

Extends assets-work/creatures/cleanup.py for buildings: weld by bbox fraction, drop tiny islands, flatten the base,
planar-dissolve then collapse, scale to a target height (or fit a box), origin at ground centre, front -> +Z (three),
palette grade + mask via grade.py (system Python, PIL), WebP texture, optional Draco, preview + silhouette renders.

Usage:
  blender -b -P arch_cleanup.py -- IN.glb OUT.glb WORKDIR [--yaw DEG] [--pitch DEG] [--roll DEG]
      [--height U] [--fit W,H,D] [--max-tris N] [--tex 512] [--draco 0|1] [--dissolve 3] [--flatten 0.01]
      [--island 0.003] [--weld 5e-4] [--grade "json opts for grade.py"] [--mask OUT_MASK.webp] [--concept PNG]
      [--probe]   (only render raw orientation probes, no processing)

Blender is Z-up; the glTF exporter writes +Y up. The model's front must face Blender -Y, which becomes three.js +Z.
"""
import bpy, bmesh, sys, math, os, json, subprocess
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
IN, OUT, WORK = os.path.abspath(argv[0]), os.path.abspath(argv[1]), os.path.abspath(argv[2])
os.makedirs(WORK, exist_ok=True)
opts = {"yaw": 0.0, "pitch": 0.0, "roll": 0.0, "height": 0.0, "fit": "", "max_tris": 3000, "tex": 512,
        "draco": 0, "dissolve": 3.0, "flatten": 0.01, "island": 0.003, "weld": 5e-4, "grade": "{}",
        "mask": "", "concept": "", "probe": False, "webp_q": 82, "smooth": 1, "sil": 1, "opening": 0, "sx": 1.0,
        "box": "", "keep_front": 0.3, "keep_back": 0.12, "grader": "kit", "exposure": 0.35, "gate": "", "rebake": 0}
STR = {"fit", "grade", "mask", "concept", "box", "grader", "gate"}
i = 3
while i < len(argv):
    a = argv[i]
    if a == "--probe": opts["probe"] = True; i += 1; continue
    k = a[2:].replace("-", "_"); v = argv[i + 1]
    opts[k] = v if k in STR else float(v)
    i += 2
# The system Python (numpy, PIL, scipy, rembg) runs grade*.py and iou.py: $OB_PYTHON, else the first python on PATH
# (Blender's own interpreter is not on PATH), else the owner machine's default install. Wave 3 (D2): the helper
# scripts live next to this file (docs/opus-bay/kit-jobs/: grade.py, grade_kit.py, iou.py); the parent folder is
# still searched for the old assets-work/sf layout.
import shutil
PY = os.environ.get("OB_PYTHON") or shutil.which("python") or shutil.which("python3") or r"C:\Python314\python.exe"
_SELF = os.path.dirname(os.path.abspath(__file__))


def helper(name):
    for d in (_SELF, os.path.dirname(_SELF)):
        if os.path.exists(os.path.join(d, name)): return os.path.join(d, name)
    return os.path.join(_SELF, name)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=IN)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in meshes:
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    o.select_set(False)
for o in list(bpy.context.scene.objects):
    if o.type != "MESH":
        bpy.data.objects.remove(o, do_unlink=True)
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
obj.name = os.path.splitext(os.path.basename(OUT))[0]
obj.data.name = obj.name
stats = {"in": IN, "meshes_in": len(meshes)}


def tri_count(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def bbox(o):
    xs = [v.co.x for v in o.data.vertices]; ys = [v.co.y for v in o.data.vertices]; zs = [v.co.z for v in o.data.vertices]
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


def islands_of(bm):
    bm.verts.ensure_lookup_table()
    seen = set(); out = []
    for v in bm.verts:
        if v.index in seen: continue
        stack = [v]; isl = []; seen.add(v.index)
        while stack:
            cur = stack.pop(); isl.append(cur)
            for e in cur.link_edges:
                w = e.other_vert(cur)
                if w.index not in seen:
                    seen.add(w.index); stack.append(w)
        out.append(isl)
    return out


stats["tris_in"] = tri_count(obj); stats["verts_in"] = len(obj.data.vertices)
obj.rotation_mode = "XYZ"
obj.rotation_euler = (math.radians(opts["pitch"]), math.radians(opts["roll"]), math.radians(opts["yaw"]))
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ---- render setup (shared by probe + previews) ----
scn = bpy.context.scene
scn.render.engine = "BLENDER_WORKBENCH"
scn.display.shading.light = "STUDIO"
scn.display.shading.color_type = "TEXTURE"
scn.display.shading.show_shadows = False
scn.display.shading.show_cavity = False
scn.render.image_settings.file_format = "PNG"
scn.view_settings.view_transform = "Standard"  # AgX (the 5.x default) greys out the pastel textures in previews
scn.view_settings.exposure = opts["exposure"]  # kit previews: Workbench studio light renders ~20 % darker than the game's day light
scn.world = bpy.data.worlds.new("w"); scn.world.color = (0.9, 0.87, 0.82)
cam_data = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cam_data)
scn.collection.objects.link(cam); scn.camera = cam
cam_data.type = "ORTHO"


def shoot(path, d, res=512, pad=1.25):
    mn, mx = bbox(obj)
    c = (mn + mx) / 2
    r = max(mx - mn) * 1.2
    scn.render.resolution_x = res; scn.render.resolution_y = res
    cam_data.ortho_scale = r * pad
    d = d.normalized()
    cam.location = c + d * r * 3
    cam_data.clip_end = r * 10
    cam.rotation_euler = (c - cam.location).normalized().to_track_quat("-Z", "Y").to_euler()
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)


VIEWS = {"front": Vector((0, -1, 0.3)), "q34": Vector((0.8, -1, 0.6)), "q34l": Vector((-0.8, -1, 0.6)),
         "side": Vector((1, 0, 0.2)), "back": Vector((0, 1, 0.3)), "top": Vector((0, -0.01, 1))}

if opts["probe"]:
    for name in ("front", "side", "back", "top"):
        shoot(os.path.join(WORK, f"probe-{name}.png"), VIEWS[name], 384)
    mn, mx = bbox(obj)
    print("PROBE_DIMS", tuple(round(x, 3) for x in (mx - mn)), "TRIS", stats["tris_in"])
    sys.exit(0)

# ---- wave 4 (lane V): --rebake 1 keeps the raw mesh to re-bake its colour onto fresh UVs after the decimation ----
# (the collapse decimation keeps the SAM UVs, and big merged triangles then stretch across UV charts: diagonal
# roof-tile streaks on side walls; a bake from the raw surface onto a smart-UV-projected low mesh removes them)
high = None
if opts["rebake"]:
    high = obj.copy(); high.data = obj.data.copy(); high.name = "raw_high"
    bpy.context.scene.collection.objects.link(high)
    high.hide_render = True

# ---- weld + islands ----
mn, mx = bbox(obj)
diag = (mx - mn).length
bpy.ops.object.mode_set(mode="EDIT")
bm = bmesh.from_edit_mesh(obj.data)
n0 = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=diag * opts["weld"])
stats["weld"] = [n0, len(bm.verts)]
isl = islands_of(bm)
nf = len(bm.faces)
kill = []
for s in isl:
    faces = {f for v in s for f in v.link_faces}
    if len(faces) < nf * opts["island"]:
        kill.extend(s)
stats["islands_raw"] = len(isl)
if kill and len(kill) < len(bm.verts) * 0.2:
    bmesh.ops.delete(bm, geom=kill, context="VERTS")
bmesh.update_edit_mesh(obj.data)

# ---- flatten the base: cut at min z + flatten * height, cap the hole ----
bm = bmesh.from_edit_mesh(obj.data)
zs = [v.co.z for v in bm.verts]
z0 = min(zs); h = max(zs) - z0
cut = z0 + h * opts["flatten"]
geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
res = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=(0, 0, cut), plane_no=(0, 0, 1), clear_inner=True)
cut_edges = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
before = len(bm.faces)
if cut_edges:
    try:
        filled = bmesh.ops.holes_fill(bm, edges=cut_edges, sides=0)
        bmesh.ops.triangulate(bm, faces=filled["faces"])
    except Exception as ex:  # noqa
        print("FILL_FAIL", ex)
stats["base_cap_faces"] = len(bm.faces) - before
bmesh.update_edit_mesh(obj.data)
bpy.ops.object.mode_set(mode="OBJECT")

# ---- decimate: planar dissolve (keeps walls crisp), then collapse ----
if opts["dissolve"] > 0:
    mod = obj.modifiers.new("dis", "DECIMATE")
    mod.decimate_type = "DISSOLVE"
    mod.angle_limit = math.radians(opts["dissolve"])
    mod.delimit = {"UV", "SEAM", "SHARP"}
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new("tri0", "TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier=mod.name)
    stats["tris_after_dissolve"] = tri_count(obj)
tris = tri_count(obj)
if tris > opts["max_tris"]:
    mod = obj.modifiers.new("dec", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = (opts["max_tris"] * 0.98) / tris
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
mod = obj.modifiers.new("tri", "TRIANGULATE")
bpy.ops.object.modifier_apply(modifier=mod.name)
stats["tris_out"] = tri_count(obj)

if high is not None:
    # Texel transfer in Python (numpy + BVH), no Cycles: Blender 5.2's headless Cycles bake returned an all-black image
    # on this machine. For every texel of the low mesh's new smart-projected UVs: its 3D point on the low surface, a ray
    # along the low face normal (from outside, both ways) or else the nearest point on the raw mesh, the raw triangle's
    # UV there, a bilinear sample of the raw texture.
    import time
    import numpy as np
    from mathutils import Vector as V3
    from mathutils.bvhtree import BVHTree
    t0 = time.time()
    me = obj.data
    buv = me.uv_layers.new(name="bake")
    me.uv_layers.active = buv
    buv.active_render = True
    bpy.ops.object.select_all(action="DESELECT"); obj.select_set(True); bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    # the raw mesh: triangles, their UVs and the base-colour image
    hme = high.data
    hme.calc_loop_triangles()
    hv = np.array([v.co[:] for v in hme.vertices], np.float64)
    huv_l = hme.uv_layers.active.data
    htri = hme.loop_triangles
    hvi = np.array([t.vertices[:] for t in htri], np.int64)
    hli = np.array([t.loops[:] for t in htri], np.int64)
    huv = np.array([d.uv[:] for d in huv_l], np.float64)
    hpoly = np.array([t.polygon_index for t in htri], np.int64)
    src = None
    for slot in high.material_slots:
        m = slot.material
        if m and m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image and any(l.to_socket.name == "Base Color" for l in n.outputs["Color"].links):
                    src = n.image
    sw, sh = src.size
    spx = np.empty(sw * sh * 4, np.float32); src.pixels.foreach_get(spx); spx = spx.reshape(sh, sw, 4)
    tree = BVHTree.FromObject(high, bpy.context.evaluated_depsgraph_get())
    bsz = int(opts["tex"])
    buv = me.uv_layers["bake"]  # re-fetch: the edit-mode round trip rebuilt the layers (an old reference reads stale UVs)
    me.calc_loop_triangles()
    lv = np.array([v.co[:] for v in me.vertices], np.float64)
    luv = np.array([d.uv[:] for d in buv.data], np.float64)
    mn, mx = bbox(obj); dg = (mx - mn).length
    eps = dg * 0.01
    # 1. rasterise the low triangles in the new UV space: texel -> 3D point + face normal (first triangle wins)
    owner = -np.ones((bsz, bsz), np.int64)
    pts_all, nrm_all, pix_all = [], [], []
    for t in me.loop_triangles:
        P = lv[list(t.vertices)]; U = luv[list(t.loops)] * bsz - 0.5
        x0, y0 = np.floor(U.min(0)).astype(int); x1, y1 = np.ceil(U.max(0)).astype(int)
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, bsz - 1), min(y1, bsz - 1)
        if x1 < x0 or y1 < y0: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        a, b, c = U
        den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(den) < 1e-12: continue
        w0 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / den
        w1 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / den
        w2 = 1 - w0 - w1
        inside = (w0 >= -0.03) & (w1 >= -0.03) & (w2 >= -0.03) & (owner[ys, xs] < 0)
        if not inside.any(): continue
        W = np.stack([w0[inside], w1[inside], w2[inside]], 1).clip(0, 1); W /= W.sum(1, keepdims=True)
        owner[ys[inside], xs[inside]] = t.index
        pts_all.append(W @ P); nrm_all.append(np.repeat(np.array(t.normal[:])[None], len(W), 0))
        pix_all.append(np.stack([ys[inside], xs[inside]], 1))
    pts_all = np.concatenate(pts_all); nrm_all = np.concatenate(nrm_all); pix_all = np.concatenate(pix_all)
    # 2. find the raw surface point for every texel (ray along the face normal from outside, then from inside, else nearest)
    n_t = len(pts_all)
    locs = np.zeros((n_t, 3)); tri_i = -np.ones(n_t, np.int64)
    hits = misses = 0
    for k in range(n_t):
        o = V3(pts_all[k]); nv = V3(nrm_all[k])
        loc, _, idx, _ = tree.ray_cast(o + nv * eps, -nv, eps * 2)
        if loc is None: loc, _, idx, _ = tree.ray_cast(o - nv * eps, nv, eps * 2)
        if loc is None:
            loc, _, idx, _ = tree.find_nearest(o); misses += 1
        else:
            hits += 1
        if loc is not None: locs[k] = loc[:]; tri_i[k] = idx
    ok = tri_i >= 0
    # 3. barycentrics on the raw triangle (raw SAM meshes are all triangles: polygon index = loop-triangle index)
    p2t = np.full(len(hme.polygons), -1, np.int64)
    for k, pi in enumerate(hpoly):
        if p2t[pi] < 0: p2t[pi] = k
    ti = p2t[tri_i[ok]]
    A, B, C = hv[hvi[ti, 0]], hv[hvi[ti, 1]], hv[hvi[ti, 2]]
    v0, v1, v2 = B - A, C - A, locs[ok] - A
    d00 = (v0 * v0).sum(1); d01 = (v0 * v1).sum(1); d11 = (v1 * v1).sum(1); d20 = (v2 * v0).sum(1); d21 = (v2 * v1).sum(1)
    dd = np.where(np.abs(d00 * d11 - d01 * d01) < 1e-18, 1e-18, d00 * d11 - d01 * d01)
    bb = (d11 * d20 - d01 * d21) / dd; cc = (d00 * d21 - d01 * d20) / dd
    Wb = np.stack([1 - bb - cc, bb, cc], 1).clip(0, 1); Wb /= np.maximum(Wb.sum(1, keepdims=True), 1e-9)
    uvp = (Wb[:, :, None] * huv[hli[ti]]).sum(1)
    # 4. bilinear sample of the raw base colour
    sx_ = np.mod(uvp[:, 0], 1.0) * (sw - 1); sy_ = np.mod(uvp[:, 1], 1.0) * (sh - 1)
    ix = sx_.astype(int); iy = sy_.astype(int); fx = (sx_ - ix)[:, None]; fy = (sy_ - iy)[:, None]
    ix1 = np.minimum(ix + 1, sw - 1); iy1 = np.minimum(iy + 1, sh - 1)
    col = spx[iy, ix] * (1 - fx) * (1 - fy) + spx[iy, ix1] * fx * (1 - fy) + spx[iy1, ix] * (1 - fx) * fy + spx[iy1, ix1] * fx * fy
    out = np.zeros((bsz, bsz, 4), np.float32); out[..., 3] = 1
    pix = pix_all[ok]
    out[pix[:, 0], pix[:, 1]] = col
    filled = np.zeros((bsz, bsz), bool); filled[pix[:, 0], pix[:, 1]] = True
    # dilate the transferred texels 24 px into the unfilled ones (chart edges the texel-centre raster missed and the
    # gutter), so neither the grade's own gutter nor the mip chain ever sees the black background at a chart edge
    ci = out[..., :3]; f = filled.copy()
    for _ in range(24):
        if f.all(): break
        acc = np.zeros_like(ci); cnt = np.zeros(f.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            fs = np.roll(f, (dy, dx), (0, 1)); cs = np.roll(ci, (dy, dx), (0, 1))
            m = fs & ~f
            acc[m] += cs[m]; cnt[m] += 1
        nw = cnt > 0
        ci[nw] = acc[nw] / cnt[nw][:, None]; f |= nw
    out[..., :3] = ci
    bimg = bpy.data.images.new("baked", bsz, bsz, alpha=False)
    bimg.pixels.foreach_set(out.ravel())
    bimg.pack()
    bmat = bpy.data.materials.new("baked"); bmat.use_nodes = True
    bsdf = next(n for n in bmat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    tnode = bmat.node_tree.nodes.new("ShaderNodeTexImage"); tnode.image = bimg
    bmat.node_tree.links.new(tnode.outputs["Color"], bsdf.inputs["Base Color"])
    me.materials.clear(); me.materials.append(bmat)
    for uvl in [u for u in me.uv_layers if u.name != "bake"]: me.uv_layers.remove(uvl)
    hd = high.data; bpy.data.objects.remove(high, do_unlink=True); bpy.data.meshes.remove(hd)
    obj.select_set(True); bpy.context.view_layer.objects.active = obj
    stats["rebake"] = {"size": bsz, "seconds": round(time.time() - t0, 1), "texels": int(filled.sum()), "ray_hits": hits,
                       "nearest_fallbacks": misses}

# ---- scale + origin at ground centre ----
mn, mx = bbox(obj)
dims = mx - mn
if opts["box"]:
    W, H, D = (float(x) for x in opts["box"].split(","))  # three.js order: width x, height y, depth z
    obj.data.transform(Matrix.Translation(-Vector(((mn.x + mx.x) / 2, mn.y, mn.z))))  # front (min Blender y) at y = 0
    sx, sz = W / dims.x, H / dims.z
    obj.data.transform(Matrix.Diagonal(Vector((sx, sx, sz, 1.0))))
    d0 = dims.y * sx
    stats["depth_before_box"] = round(d0, 3)
    if d0 > D:
        obj.data.transform(Matrix.Diagonal(Vector((1.0, D / d0, 1.0, 1.0))))
        stats["depth_mode"] = f"compressed x{D / d0:.3f}"
    elif d0 < D:
        a, b = d0 * opts["keep_front"], d0 * (1 - opts["keep_back"])
        k = (D - d0 + (b - a)) / (b - a)  # middle band stretch
        for v in obj.data.vertices:
            y = v.co.y
            if y > b: v.co.y = a + (b - a) * k + (y - b)
            elif y > a: v.co.y = a + (y - a) * k
        stats["depth_mode"] = f"middle band {opts['keep_front']:.2f}-{1 - opts['keep_back']:.2f} stretched x{k:.3f}"
    obj.data.update()
    mn, mx = bbox(obj)
    obj.data.transform(Matrix.Translation(-Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))))
    s = 1.0
elif opts["fit"]:
    W, H, D = (float(x) for x in opts["fit"].split(","))  # three.js order: width x, height y, depth z
    s = min(W / dims.x, H / dims.z, D / dims.y)
elif opts["height"]:
    s = opts["height"] / dims.z
else:
    s = 1.0
if not opts["box"]:
    obj.data.transform(Matrix.Translation(-Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))))
    obj.data.transform(Matrix.Scale(s, 4))
if opts["sx"] != 1.0:  # widen only (gates: open the walk-through passage without making the gate taller)
    obj.data.transform(Matrix.Scale(opts["sx"], 4, Vector((1, 0, 0))))
if opts["gate"]:
    # widen a gateway in a front screen only (D2, Legion of Honor): in the band three z >= Z (Blender -y >= Z, feathered
    # over F u), |x| <= W is stretched by K and W < |x| <= the half width is squeezed to fit, so the screen keeps its
    # ends (they meet the side wings) and nothing behind it changes
    W, K, Z, F = (float(x) for x in (opts["gate"].split(",") + ["1.0"])[:4])
    mn, mx = bbox(obj); X1 = max(-mn.x, mx.x)
    for v in obj.data.vertices:
        w = min(1.0, max(0.0, (-v.co.y - (Z - F)) / F))
        if w <= 0: continue
        ax = abs(v.co.x)
        nx = ax * K if ax <= W else W * K + (ax - W) * (X1 - W * K) / (X1 - W)
        v.co.x += (1 if v.co.x >= 0 else -1) * w * (nx - ax)
    obj.data.update()
    stats["gate"] = {"half_width": W, "stretch": K, "z_from": Z, "feather": F}
obj.data.update()
mn, mx = bbox(obj)
stats["size_xyz_three"] = [round((mx - mn).x, 3), round((mx - mn).z, 3), round((mx - mn).y, 3)]

# ---- walk-through opening (gates): clear width/height of the central passage, rays front -> back ----
if opts["opening"]:
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    tree = BVHTree.FromObject(obj, dg)
    mn, mx = bbox(obj)
    xs = [mn.x + (mx.x - mn.x) * k / 300 for k in range(301)]
    clear = []
    for x in xs:
        z = 0.02; hit_z = mx.z
        while z < mx.z:
            loc, nrm, idx, dist = tree.ray_cast(Vector((x, mn.y - 1, z)), Vector((0, 1, 0)))
            if loc is not None:
                hit_z = z; break
            z += 0.05
        clear.append(hit_z)
    mid = min(range(len(xs)), key=lambda k: abs(xs[k]))
    need = float(opts["opening"])  # a column counts as open when its clear height >= this
    a = b = mid
    if clear[mid] >= need:
        while a > 0 and clear[a - 1] >= need: a -= 1
        while b < len(xs) - 1 and clear[b + 1] >= need: b += 1
        stats["opening_profile"] = [[round(xs[k], 2), round(clear[k], 2)] for k in range(0, len(xs), 10)]
        stats["opening"] = {"width": round(xs[b] - xs[a], 3), "min_clear_h": round(min(clear[a:b + 1]), 3),
                            "max_clear_h": round(max(clear[a:b + 1]), 3), "need_h": need}
    else:
        stats["opening"] = {"width": 0, "centre_clear_h": round(clear[mid], 3), "need_h": need}

# ---- mesh QA: non-manifold edges, islands ----
bm = bmesh.new(); bm.from_mesh(obj.data)
nm = sum(1 for e in bm.edges if not e.is_manifold)
stats["edges"] = len(bm.edges); stats["non_manifold_edges"] = nm
stats["non_manifold_pct"] = round(100 * nm / max(1, len(bm.edges)), 2)
stats["islands"] = len(islands_of(bm))
stats["verts_out"] = len(bm.verts)
bm.free()

for p in obj.data.polygons:
    p.use_smooth = bool(opts["smooth"])
if opts["smooth"]:
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(40))
    except Exception as ex:  # noqa
        print("AUTOSMOOTH_FAIL", ex)

# ---- materials: matte, base colour only, resize + grade ----
base_imgs = []
for slot in obj.material_slots:
    m = slot.material
    if not m or not m.use_nodes: continue
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type == "BSDF_PRINCIPLED":
            n.inputs["Metallic"].default_value = 0.0
            n.inputs["Roughness"].default_value = 0.9
            for key in ("Metallic", "Roughness", "Normal", "Emission Color", "Alpha"):
                if key in n.inputs:
                    for l in list(n.inputs[key].links):
                        nt.links.remove(l)
    for n in list(nt.nodes):
        if n.type == "TEX_IMAGE":
            used = any(l.to_node.type == "BSDF_PRINCIPLED" and l.to_socket.name == "Base Color" for l in n.outputs["Color"].links)
            if not used:
                nt.nodes.remove(n)
            elif n.image and n.image not in base_imgs:
                base_imgs.append(n.image)
        elif n.type in ("NORMAL_MAP", "SEPARATE_COLOR", "SEPARATE_RGB"):
            nt.nodes.remove(n)
stats["materials"] = [s.material.name for s in obj.material_slots if s.material]
stats["textures"] = []
for k, im in enumerate(base_imgs):
    w, hh = im.size
    stats["textures"].append([im.name, w, hh])
    tex = int(opts["tex"])
    raw_png = os.path.join(WORK, f"tex{k}-raw.png"); graded = os.path.join(WORK, f"tex{k}-graded.png")
    im.scale(tex, int(tex * hh / w))
    im.filepath_raw = raw_png; im.file_format = "PNG"; im.save()
    # UV triangles for texel coverage (grade.py rasterises them)
    uvl = obj.data.uv_layers.active
    uvt = []
    for p in obj.data.polygons:
        uvt.append([[round(uvl.data[li].uv[0], 5), round(uvl.data[li].uv[1], 5)] for li in p.loop_indices])
    uvj = os.path.join(WORK, f"tex{k}-uv.json")
    with open(uvj, "w") as f: json.dump(uvt, f)
    # per-polygon [normal z, relative height of the centre] for the roof / wall regions in grade_kit.py
    zmin = min(v.co.z for v in obj.data.vertices); zh = max(1e-6, max(v.co.z for v in obj.data.vertices) - zmin)
    facej = os.path.join(WORK, f"tex{k}-faces.json")
    with open(facej, "w") as f:
        ymin = min(v.co.y for v in obj.data.vertices); yd = max(1e-6, max(v.co.y for v in obj.data.vertices) - ymin)
        json.dump([[round(p.normal.z, 3), round((p.center.z - zmin) / zh, 3), round((p.center.y - ymin) / yd, 3)]
                   for p in obj.data.polygons], f)
    g = json.loads(opts["grade"] or "{}")
    g["faces"] = facej  # wave 4: grade.py also reads the per-face normals ("region": "wall" | "roof")
    cmd = [PY, helper("grade_kit.py" if opts["grader"] == "kit" else "grade.py"), raw_png, graded, uvj,
           os.path.join(WORK, f"tex{k}-grade.json"), json.dumps(g)]
    if opts["mask"] and k == 0: cmd.append(opts["mask"])
    print("GRADE", subprocess.run(cmd, capture_output=True, text=True).stdout.strip()[-400:])
    if os.path.exists(graded):
        im2 = bpy.data.images.load(graded)
        im2.name = im.name + "_g"
        for slot in obj.material_slots:
            if slot.material and slot.material.use_nodes:
                for n in slot.material.node_tree.nodes:
                    if n.type == "TEX_IMAGE" and n.image == im:
                        n.image = im2
        im2.pack()

# ---- export ----
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()


def export(path, draco):
    kw = dict(filepath=path, export_format="GLB", use_selection=False, export_apply=True, export_yup=True,
              export_normals=True, export_texcoords=True, export_animations=False, export_skins=False,
              export_morph=False, export_cameras=False, export_lights=False, export_extras=False)
    if "export_image_format" in props: kw["export_image_format"] = "WEBP"
    if "export_image_quality" in props: kw["export_image_quality"] = int(opts["webp_q"])
    if "export_image_add_webp" in props: kw["export_image_add_webp"] = False
    if "export_image_webp_fallback" in props: kw["export_image_webp_fallback"] = False
    if "export_vertex_color" in props: kw["export_vertex_color"] = "NONE"
    if "export_tangents" in props: kw["export_tangents"] = False
    if "export_attributes" in props: kw["export_attributes"] = False
    kw["export_draco_mesh_compression_enable"] = bool(draco)
    if draco:
        kw.update(export_draco_mesh_compression_level=6, export_draco_position_quantization=14,
                  export_draco_normal_quantization=10, export_draco_texcoord_quantization=12)
    bpy.ops.export_scene.gltf(**kw)
    return os.path.getsize(path)


stats["bytes"] = export(OUT, opts["draco"])
alt = os.path.join(WORK, os.path.basename(OUT).replace(".glb", ".draco.glb" if not opts["draco"] else ".plain.glb"))
stats["bytes_alt"] = [os.path.basename(alt), export(alt, not opts["draco"])]

# ---- previews ----
for name, d in VIEWS.items():
    shoot(os.path.join(WORK, f"prev-{name}.png"), d, 512)

# ---- mask QA renders: the mask WebP as the base colour (R = night glass, G = tint region) ----
if opts["mask"] and os.path.exists(opts["mask"]):
    mimg = bpy.data.images.load(os.path.abspath(opts["mask"]))
    for slot in obj.material_slots:
        if slot.material and slot.material.use_nodes:
            for n in slot.material.node_tree.nodes:
                if n.type == "TEX_IMAGE": n.image = mimg
    for name in ("front", "q34"):
        shoot(os.path.join(WORK, f"mask-{name}.png"), VIEWS[name], 512)

# ---- silhouettes for IoU against the concept (flat white on black, ortho, azimuth/elevation sweep) ----
if opts["concept"] and opts["sil"]:
    scn.display.shading.light = "FLAT"; scn.display.shading.color_type = "SINGLE"
    scn.display.shading.single_color = (1, 1, 1); scn.world.color = (0, 0, 0)
    sdir = os.path.join(WORK, "sil"); os.makedirs(sdir, exist_ok=True)
    for az in range(-70, 75, 10):
        for el in (10, 20, 30, 40):
            a, e = math.radians(az), math.radians(el)
            d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
            shoot(os.path.join(sdir, f"s_{az}_{el}.png"), d, 192, 1.1)
    r = subprocess.run([PY, helper("iou.py"), opts["concept"], sdir], capture_output=True, text=True)
    print("IOU", r.stdout.strip()[-300:])
    try:
        stats["iou"] = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception:  # noqa
        stats["iou"] = r.stdout[-300:] + r.stderr[-300:]
with open(os.path.join(WORK, "stats.json"), "w") as f:
    json.dump(stats, f, indent=1)
print("STATS", json.dumps(stats))
