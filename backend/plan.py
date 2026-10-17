import math
import httpx
import openrouteservice
from config import get_key
from geo import metres, in_ellipse, midpoint, search_radius_m, WALK_MS, DETOUR, DWELL_S
from overpass import HEADERS as UA
from places import get_places
from scoring import score_places

SAFETY = 0.9
OSRM = "https://routing.openstreetmap.de/routed-foot/route/v1/foot/"
_client = None


def client():
    global _client
    if _client is None:
        key = get_key()
        if key:
            _client = openrouteservice.Client(key=key, timeout=10, retry_over_query_limit=False)
    return _client


def tt(a, b):
    """Rough walking seconds between two points."""
    return metres(a, b) * DETOUR / WALK_MS


def ellipse_polygon(start, end, budget_s, n=64):
    d = metres(start, end)
    L = (budget_s - DWELL_S) * WALK_MS / DETOUR  # max total straight-line distance
    if L <= d * 1.01:
        return None
    a, c = L / 2, d / 2
    b = math.sqrt(a * a - c * c)
    mid = midpoint(start, end)
    kx = 111320 * math.cos(math.radians(mid[1]))
    ky = 111320
    th = math.atan2((end[1] - start[1]) * ky, (end[0] - start[0]) * kx)
    pts = []
    for i in range(n + 1):
        t = 2 * math.pi * i / n
        x, y = a * math.cos(t), b * math.sin(t)
        X = x * math.cos(th) - y * math.sin(th)
        Y = x * math.sin(th) + y * math.cos(th)
        pts.append([mid[0] + X / kx, mid[1] + Y / ky])
    return {"type": "Polygon", "coordinates": [pts]}


def route_line(pts):
    """Returns (geometry, seconds, source). ORS first, then OSRM, then straight lines."""
    c = client()
    if c:
        try:
            r = c.directions(coordinates=[list(p) for p in pts], profile="foot-walking", format="geojson")
            f = r["features"][0]
            return f["geometry"], f["properties"]["summary"]["duration"], "ors"
        except Exception as ex:
            print("[route] ORS directions failed:", type(ex).__name__)
    try:
        coords = ";".join(f"{p[0]},{p[1]}" for p in pts)
        r = httpx.get(OSRM + coords, params={"overview": "full", "geometries": "geojson"}, headers=UA, timeout=10)
        r.raise_for_status()
        j = r.json()["routes"][0]
        return j["geometry"], j["distance"] / WALK_MS, "osrm"
    except Exception as ex:
        print("[route] OSRM failed:", type(ex).__name__)
    secs = sum(tt(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
    return {"type": "LineString", "coordinates": [list(p) for p in pts]}, secs, "straight"


def solve_vroom(start, end, cands, budget):
    jobs = [{"id": i, "location": c["lonlat"], "service": DWELL_S, "priority": c["score"]}
            for i, c in enumerate(cands, 1)]
    vehicles = [{"id": 1, "profile": "foot-walking", "start": list(start), "end": list(end),
                 "time_window": [0, int(budget)]}]
    r = httpx.post("https://api.openrouteservice.org/optimization",
                   json={"jobs": jobs, "vehicles": vehicles},
                   headers={"Authorization": get_key()}, timeout=20)
    r.raise_for_status()
    res = r.json()
    if not res.get("routes"):
        return []
    order = [s["id"] for s in res["routes"][0]["steps"] if s["type"] == "job"]
    return [cands[i - 1] for i in order]


def solve_greedy(start, end, cands, budget):
    def total(r):
        pts = [start] + [p["lonlat"] for p in r] + [end]
        return sum(tt(pts[i], pts[i + 1]) for i in range(len(pts) - 1)) + DWELL_S * len(r)

    route = []
    while True:
        base, best = total(route), None
        used = {p["id"] for p in route}
        for p in cands:
            if p["id"] in used:
                continue
            for i in range(len(route) + 1):
                trial = route[:i] + [p] + route[i:]
                t = total(trial)
                if t <= budget:
                    ratio = p["score"] / max(t - base, 1)
                    if best is None or ratio > best[0]:
                        best = (ratio, trial)
        if best is None:
            return route
        route = best[1]


def make_plan(start, end, minutes, vibes=None):
    minutes = max(10, min(90, int(minutes)))
    budget = minutes * 60 * SAFETY
    start, end = tuple(start), tuple(end)

    boring_geom, boring_s, _ = route_line([start, end])
    ellipse = ellipse_polygon(start, end, budget)
    stops, solver, message = [], "none", None

    if ellipse is None or boring_s + DWELL_S > budget:
        message = "Not enough time for a detour - here's the direct way"
    else:
        mid = midpoint(start, end)
        places = get_places(mid[1], mid[0], search_radius_m(start, end, budget))
        pool = [p for p in places if in_ellipse(p["lonlat"], start, end, budget)]
        cands = score_places(pool, vibes)
        print(f"[plan] {len(places)} places -> {len(pool)} in ellipse -> {len(cands)} candidates")
        if cands:
            try:
                stops, solver = solve_vroom(start, end, cands, budget), "vroom"
            except Exception as ex:
                print("[plan] VROOM failed, using greedy:", type(ex).__name__, str(ex)[:200])
                stops, solver = solve_greedy(start, end, cands, budget * 0.7), "greedy"
        if not stops:
            message = "Nothing worth a detour fits - here's the direct way"

    geom, secs, rsrc = boring_geom, boring_s, "direct"
    while stops:
        g, s_, r_ = route_line([start] + [p["lonlat"] for p in stops] + [end])
        total = s_ + DWELL_S * len(stops)
        if total <= budget:
            geom, secs, rsrc = g, s_, r_
            break
        weakest = min(range(len(stops)), key=lambda i: stops[i]["score"])
        print(f"[plan] real time {round(total / 60)} min is over budget, dropping {stops[weakest]['name']}")
        stops = stops[:weakest] + stops[weakest + 1:]
    if not stops and not message:
        message = "Nothing worth a detour fits - here's the direct way"

    our_min = round((secs + DWELL_S * len(stops)) / 60)
    return {
        "stops": [{"name": p["name"], "category": p["category"], "lonlat": p["lonlat"],
                   "score": p["score"], "fact": "", "photo": p["tags"].get("image", "")} for p in stops],
        "route": geom,
        "boringRoute": boring_geom,
        "ellipse": ellipse,
        "stats": {"boringMin": round(boring_s / 60), "ourMin": our_min, "stops": len(stops),
                  "spareMin": minutes - our_min},
        "solver": solver,
        "routeSource": rsrc,
        "message": message,
    }
