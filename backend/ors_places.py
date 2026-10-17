import httpx
from collections import Counter

KEY = __import__("config").get_key()
URL = "https://api.openrouteservice.org/pois"

# substring of ORS category name -> OSM-style tags (what our scorer will read)
RULES = [
    ("viewpoint", {"tourism": "viewpoint"}),
    ("artwork", {"tourism": "artwork"}),
    ("park", {"leisure": "park"}),
    ("garden", {"leisure": "garden"}),
    ("cafe", {"amenity": "cafe"}),
    ("coffee", {"amenity": "cafe"}),
    ("monument", {"historic": "monument"}),
    ("memorial", {"historic": "memorial"}),
    ("castle", {"historic": "castle"}),
    ("ruins", {"historic": "ruins"}),
    ("archaeolog", {"historic": "archaeological_site"}),
    ("historic", {"historic": "yes"}),
    ("fountain", {"amenity": "fountain"}),
    ("attraction", {"tourism": "attraction"}),
    ("museum", {"tourism": "museum"}),
    ("gallery", {"tourism": "gallery"}),
    ("place_of_worship", {"historic": "church"}),
]


def map_tags(cat_names):
    for needle, tags in RULES:
        for c in cat_names:
            if needle in c:
                return dict(tags)
    return None


def fetch_places_ors(lat, lon, radius, limit=300, report=False):
    buffer_m = int(min(radius, 2000))
    body = {
        "request": "pois",
        "geometry": {"geojson": {"type": "Point", "coordinates": [lon, lat]}, "buffer": buffer_m},
        "limit": limit,
    }
    r = httpx.post(URL, json=body, headers={"Authorization": KEY}, timeout=30)
    r.raise_for_status()
    seen, places, unmapped = set(), [], Counter()
    for f in r.json().get("features", []):
        pr = f["properties"]
        names = [c["category_name"] for c in pr.get("category_ids", {}).values()]
        tags = map_tags(names)
        if tags is None:
            unmapped.update(names)
            continue
        osm = pr.get("osm_tags", {})
        tags.update({k: v for k, v in osm.items() if k in ("name", "wikipedia", "wikidata", "website", "image")})
        pid = f'{pr.get("osm_type")}/{pr.get("osm_id")}'
        if pid in seen:
            continue
        seen.add(pid)
        places.append({"id": pid, "lonlat": f["geometry"]["coordinates"], "tags": tags})
    if report:
        print("Ignored categories:", dict(unmapped.most_common(12)))
    return places
