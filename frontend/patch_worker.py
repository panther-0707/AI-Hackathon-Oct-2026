p = "src/App.jsx"
s = open(p, encoding="utf-8", errors="replace").read()
if "maplibre-gl-worker.mjs" in s:
    print("already patched")
else:
    old = 'import "./App.css";'
    new = ('import "./App.css";\n'
           'import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";\n\n'
           'maplibregl.setWorkerUrl(workerUrl);')
    assert old in s, "css import line not found"
    s = s.replace(old, new, 1)
    s = s.replace("\ufffd", "-")
    open(p, "w", encoding="utf-8").write(s)
    print("App.jsx patched")
