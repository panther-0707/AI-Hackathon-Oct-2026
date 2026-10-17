src = open("main.py", encoding="utf-8-sig").read()
if "/geocode" in src:
    print("already added")
else:
    add = '''

import httpx
from config import get_key


@app.get("/geocode")
def geocode(q: str, lon: float | None = None, lat: float | None = None):
    q = q.strip()
    if len(q) < 3:
        return {"results": []}
    params = {"api_key": get_key(), "text": q, "size": 6}
    if lon is not None and lat is not None:
        params["focus.point.lon"] = lon
        params["focus.point.lat"] = lat
    try:
        r = httpx.get("https://api.openrouteservice.org/geocode/autocomplete", params=params, timeout=8)
        r.raise_for_status()
    except Exception:
        raise HTTPException(502, "geocoder unavailable")
    results = []
    for f in r.json().get("features", []):
        label = f.get("properties", {}).get("label")
        coords = f.get("geometry", {}).get("coordinates")
        if label and coords:
            results.append({"label": label, "lonlat": coords})
    return {"results": results}
'''
    open("main.py", "w", encoding="utf-8").write(src.rstrip() + "\n" + add)
    print("geocode added")
