"""Build one wave-7 lane-V AI landmark GLB from its SAM raw mesh (W7-V4; the wave-4 pipeline, ../w4/w4_cleanup.py).

python scripts/opus-sf/assets/w7v/build.py NAME [TAG] [--publish]

Reads specs.json (next to this file): raw mesh, concept image, cleanup arguments and the grade options of NAME. Runs
w4_cleanup.py in Blender 5.2 headless into WORK/NAME/TAG (WORK = $OB_W7V_WORK or C:/Users/willy/opus-qa/w7/v/ai),
prints one summary line (triangles, size, bytes, non-manifold %, islands, IoU against the concept, palette ΔE12
before -> after, mask coverage) and, with --publish, copies the GLB (+ mask) to public/opus-bay/models/sf/<file>.
"""
import json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
BLENDER = os.environ.get("OB_BLENDER", r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe")
WORK = os.environ.get("OB_W7V_WORK", r"C:\Users\willy\opus-qa\w7\v\ai")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    name, tag = args[0], (args[1] if len(args) > 1 else "v1")
    spec = json.load(open(os.path.join(HERE, "specs.json"), encoding="utf-8"))[name]
    w = os.path.join(WORK, name, tag)
    os.makedirs(w, exist_ok=True)
    out = os.path.join(w, spec["file"])
    mask = os.path.join(w, spec["file"].replace(".glb", "-mask.webp")) if spec.get("mask") else ""
    raw = os.path.join(WORK, "raw", spec["raw"])
    concept = os.path.join(WORK, "raw", spec["concept"])
    cmd = [BLENDER, "-b", "-P", os.path.join(HERE, "..", "w4", "w4_cleanup.py"), "--", raw, out, w, "--grader", "hero",
           "--tex", str(spec.get("tex", 1024)), "--draco", "1", "--max-tris", str(spec.get("max_tris", 6000)),
           "--exposure", "0", "--concept", concept, "--grade", json.dumps(spec.get("grade", {}))]
    if mask: cmd += ["--mask", mask]
    for k, v in spec.get("args", {}).items(): cmd += [f"--{k}", str(v)]
    log = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    open(os.path.join(w, "log.txt"), "w", encoding="utf-8").write(log.stdout + log.stderr)
    st = json.load(open(os.path.join(w, "stats.json")))
    gp = os.path.join(w, "tex0-grade.json")
    g = json.load(open(gp)) if os.path.exists(gp) else {}
    summary = {"name": name, "tag": tag, "tris": st.get("tris_out"), "size": st.get("size_xyz_three"), "bytes": st.get("bytes"),
               "nm_pct": st.get("non_manifold_pct"), "islands": st.get("islands"), "iou": st.get("iou"),
               "pal": [g.get("palette_before", {}).get("within12"), g.get("palette_after", {}).get("within12")],
               "mask": g.get("mask"), "mask_bytes": os.path.getsize(mask) if mask and os.path.exists(mask) else None}
    json.dump(summary, open(os.path.join(w, "summary.json"), "w"), indent=1)
    print(json.dumps(summary))
    if "--publish" in sys.argv:
        dst = os.path.join(ROOT, "public", "opus-bay", "models", "sf")
        shutil.copy2(out, os.path.join(dst, spec["file"]))
        if mask: shutil.copy2(mask, os.path.join(dst, os.path.basename(mask)))
        print("published", spec["file"])


if __name__ == "__main__":
    main()
