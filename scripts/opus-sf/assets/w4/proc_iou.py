"""AI mesh vs lane L's procedural building: absolute silhouette IoU in the shared local frame (lane V, W4-V4 QA gate).

blender -b -P proc_iou.py -- AI.glb PROC.obj OUTDIR [--ground 0.3]

Both models are placed as authored (GLB: origin at the ground centre, front +Z; OBJ: lane L's local frame, cropped to the
building by proc-export.ts), the procedural one is clipped below --ground (its foundation boxes start at −1.2 u under
the site ground), then both are rendered as flat white silhouettes with the SAME orthographic cameras (front from +Z,
side from +X, top, and the two 3/4 views), framed on the union of the two boxes. The IoU of the two masks per view says
whether the AI mesh fills the procedural footprint and height (the swap keeps the procedural walk data and blockers).
Writes OUTDIR/sil-<view>-{ai,proc}.png, OUTDIR/overlay-<view>.png and prints one JSON line.
"""
import bpy, bmesh, sys, os, json, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
AI, PROC, OUT = argv[0], argv[1], argv[2]
ground = float(argv[argv.index("--ground") + 1]) if "--ground" in argv else 0.3
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)


def join_new(before):
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.name not in before]
    for o in bpy.context.scene.objects: o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    if len(objs) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


before = set(o.name for o in bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=AI)
for o in list(bpy.context.scene.objects):
    if o.type != "MESH" and o.name not in before: bpy.data.objects.remove(o, do_unlink=True)
ai = join_new(before)
before = set(o.name for o in bpy.context.scene.objects)
bpy.ops.wm.obj_import(filepath=PROC, forward_axis="NEGATIVE_Z", up_axis="Y")  # three.js axes, like the glTF importer
proc = join_new(before)
bm = bmesh.new(); bm.from_mesh(proc.data)
bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-6, plane_co=(0, 0, ground), plane_no=(0, 0, 1), clear_inner=True)
bm.to_mesh(proc.data); bm.free()
proc.data.transform(__import__("mathutils").Matrix.Translation((0, 0, -ground)))


def bbox(o):
    vs = [o.matrix_world @ v.co for v in o.data.vertices]
    return Vector([min(v[k] for v in vs) for k in range(3)]), Vector([max(v[k] for v in vs) for k in range(3)])


a0, a1 = bbox(ai); p0, p1 = bbox(proc)
u0 = Vector([min(a0[k], p0[k]) for k in range(3)]); u1 = Vector([max(a1[k], p1[k]) for k in range(3)])
c = (u0 + u1) / 2; r = (u1 - u0).length / 2
scn = bpy.context.scene
scn.render.engine = "BLENDER_WORKBENCH"
scn.display.shading.light = "FLAT"; scn.display.shading.color_type = "SINGLE"; scn.display.shading.single_color = (1, 1, 1)
scn.world = bpy.data.worlds.new("w"); scn.world.color = (0, 0, 0)
scn.render.resolution_x = scn.render.resolution_y = 384
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scn.collection.objects.link(cam); scn.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = r * 2.1; cam.data.clip_end = r * 20
# Blender frame: three +Z (front) = Blender -Y; three +X = Blender +X; up = Blender +Z
VIEWS = {"front": Vector((0, -1, 0.0001)), "side": Vector((1, 0, 0.0001)), "top": Vector((0, -0.0001, 1)),
         "q34": Vector((0.8, -1, 0.5)), "q34l": Vector((-0.8, -1, 0.5))}
import numpy as np


def shoot(obj, name):
    for o in (ai, proc): o.hide_render = o is not obj
    scn.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(scn.render.filepath)
    px = np.array(im.pixels[:]).reshape(im.size[1], im.size[0], 4)[..., 0] > 0.5
    bpy.data.images.remove(im)
    return px


res = {}
for v, d in VIEWS.items():
    d = d.normalized()
    cam.location = c + d * r * 4
    cam.rotation_euler = (c - cam.location).normalized().to_track_quat("-Z", "Y").to_euler()
    A = shoot(ai, f"sil-{v}-ai.png"); P = shoot(proc, f"sil-{v}-proc.png")
    res[v] = round(float((A & P).sum() / max(1, (A | P).sum())), 3)
    ov = np.zeros(A.shape + (3,), np.uint8); ov[A & P] = (230, 230, 230); ov[A & ~P] = (230, 90, 60); ov[P & ~A] = (60, 140, 230)
    img = bpy.data.images.new(f"ov-{v}", ov.shape[1], ov.shape[0], alpha=False)
    rgba = np.concatenate([ov.astype(np.float32) / 255, np.ones(ov.shape[:2] + (1,), np.float32)], -1)
    img.pixels.foreach_set(rgba.ravel()); img.filepath_raw = os.path.join(OUT, f"overlay-{v}.png"); img.file_format = "PNG"; img.save()
print("PROC_IOU", json.dumps({"ai_size": [round(x, 2) for x in (a1 - a0)], "proc_size": [round(x, 2) for x in (p1 - p0)], "iou": res}))
