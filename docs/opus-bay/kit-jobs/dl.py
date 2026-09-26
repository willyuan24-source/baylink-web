"""python dl.py OUT_DIR name=url [name=url ...]  (downloads with urllib; skips existing files)"""
import sys, os, urllib.request
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for arg in sys.argv[2:]:
    name, url = arg.split("=", 1)
    p = os.path.join(out, name)
    if os.path.exists(p) and os.path.getsize(p) > 1000:
        print("skip", name); continue
    import time
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            open(p, "wb").write(data); print(name, len(data)); break
        except Exception as ex:  # noqa
            print("retry", name, attempt, str(ex)[:80]); time.sleep(2 + attempt * 2)
