import httpx
from ors_places import fetch_places_ors
from overpass import fetch_places as fetch_overpass

WIKI = "https://en.wikipedia.org/w/api.php"
UA = {"User-Agent": "GetLostMaps/0.1 (hackathon project; contact: YOUR-REAL-EMAIL)"}
_cache = {}


def fetch_wikipedia(lat, lon, radius):
    params = {"action": "query", "list": "geosearch", "gscoord": f"{lat}|{lon}",
              "gsradius": int(max(10, min(radius, 10000))), "gslimit": 100, "format": "json"}
    r = httpx.get(WIKI, params=params, headers=UA, timeout=15)
    r.raise_for_status()
    out = []
    for g in r.json()["query"]["geosearch"]:
        out.append({"id": f'wiki/{g["pageid"]}', "lonlat": [g["lon"], g["lat"]],
                    "tags": {"name": g["title"], "historic": "yes", "wikipedia": "en:" + g["title"]}})
    return out


def get_places(lat, lon, radius, min_count=10):
    key = (round(lat, 3), round(lon, 3), int(radius // 250))
    if key in _cache:
        return _cache[key]
    best, source = [], "none"
    for name, fn in (("ors", fetch_places_ors), ("overpass", fetch_overpass), ("wikipedia", fetch_wikipedia)):
        try:
            found = fn(lat, lon, radius)
        except Exception as ex:
            print(f"[places] {name} failed: {type(ex).__name__}")
            continue
        print(f"[places] {name}: {len(found)} places")
        if len(found) > len(best):
            best, source = found, name
        if len(found) >= min_count:
            break
    _cache[key] = best
    print(f"[places] using {source} ({len(best)})")
    return best
