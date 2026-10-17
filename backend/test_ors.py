import sys
from geo import midpoint, search_radius_m
from ors_places import fetch_places_ors

s = (float(sys.argv[1]), float(sys.argv[2]))
e = (float(sys.argv[3]), float(sys.argv[4]))
budget = int(sys.argv[5]) * 60 * 0.9
mid = midpoint(s, e)
r = search_radius_m(s, e, budget)
places = fetch_places_ors(mid[1], mid[0], r, report=True)
print(f"radius {round(r)} m -> {len(places)} usable places")
for p in places[:10]:
    t = p["tags"]
    print(" -", t.get("name", "(no name)"), "|", [v for k, v in t.items() if k in ("tourism", "leisure", "amenity", "historic")])
