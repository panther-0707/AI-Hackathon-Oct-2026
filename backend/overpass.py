import time
import httpx

CONTACT = "seeker0202@hotmail.com"
HEADERS = {
    "User-Agent": f"GetLostMaps/0.1 (hackathon project; contact: {CONTACT})",
    "Accept": "*/*",
}
MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

CORE = [
    '["tourism"="artwork"]',
    '["leisure"~"park|garden"]',
    '["amenity"="cafe"]',
    '["tourism"="viewpoint"]',
    '["historic"]',
]
EXTRA = [
    '["tourism"~"attraction|museum"]',
    '["amenity"="fountain"]',
    '["leisure"="playground"]',
]


def build_query(lat, lon, radius, tag_filters):
    lines = "\n".join(f"  nwr{t}(around:{int(radius)},{lat},{lon});" for t in tag_filters)
    return f"[out:json][timeout:25];\n(\n{lines}\n);\nout center tags;"


def _post(q, rounds=1):
    last = None
    for attempt in range(rounds):
        for url in MIRRORS:
            try:
                r = httpx.post(url, data={"data": q}, headers=HEADERS, timeout=httpx.Timeout(15, connect=5))
                r.raise_for_status()
                return r.json()
            except Exception as ex:
                last = ex
                print(f"[try {attempt + 1}] {url} -> {type(ex).__name__}")
    raise last


def _run(lat, lon, radius, tag_filters):
    data = _post(build_query(lat, lon, radius, tag_filters))
    places = []
    for el in data.get("elements", []):
        if "lat" in el:
            plon, plat = el["lon"], el["lat"]
        elif "center" in el:
            plon, plat = el["center"]["lon"], el["center"]["lat"]
        else:
            continue
        places.append({"id": f'{el["type"]}/{el["id"]}', "lonlat": [plon, plat], "tags": el.get("tags", {})})
    return places


def fetch_places(lat, lon, radius):
    places = _run(lat, lon, radius, CORE)
    if len(places) < 10:  # sparse area: widen the net
        places = _run(lat, lon, radius, CORE + EXTRA)
    return places
