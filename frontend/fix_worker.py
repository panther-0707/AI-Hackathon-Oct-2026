import glob, os, shutil

dist = os.path.join("node_modules", "maplibre-gl", "dist")
cands = [f for f in glob.glob(os.path.join(dist, "*worker*.js")) if not f.endswith(".map")]
print("worker files found:", [os.path.basename(c) for c in cands])
if not cands:
    raise SystemExit("No worker file found - paste me: dir node_modules\\maplibre-gl\\dist")
cands.sort(key=lambda f: ("csp" not in f, len(f)))
src = cands[0]
os.makedirs("public", exist_ok=True)
shutil.copy(src, os.path.join("public", "maplibre-worker.js"))
print("copied", os.path.basename(src), "-> public/maplibre-worker.js")

p = os.path.join("src", "App.jsx")
s = open(p, encoding="utf-8").read()
line = 'maplibregl.setWorkerUrl("/maplibre-worker.js");'
if line not in s:
    marker = 'import "./App.css";'
    s = s.replace(marker, marker + "\n\n" + line, 1)
    open(p, "w", encoding="utf-8").write(s)
    print("App.jsx patched")
else:
    print("App.jsx already patched")
