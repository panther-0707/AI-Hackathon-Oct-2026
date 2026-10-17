import sys
from geo import midpoint, search_radius_m
from overpass import fetch_places

s = (float(sys.argv[1]), float(sys.argv[2]))
e = (float(sys.argv[3]), float(sys.argv[4]))
minutes = int(sys.argv[5])
budget = minutes * 60 * 0.9
mid = midpoint(s, e)
r = search_radius_m(s, e, budget)
places = fetch_places(mid[1], mid[0], r)
print(f"radius {round(r)} m -> {len(places)} places")
for p in places[:8]:
    print(" -", p["tags"].get("name", "(no name)"), "|", p["id"])
