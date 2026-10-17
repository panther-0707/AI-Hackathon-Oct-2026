import math
from collections import Counter
import httpx
import openrouteservice
from config import get_key
from geo import metres, in_ellipse, midpoint, search_radius_m, WALK_MS, DETOUR, DWELL_S
from overpass import HEADERS as UA
from places import get_places
from scoring import score_places

SAFETY = 0.95       # rough first plans and cuts aim this far under the budget; checked walks top up to all of it
MAX_STOPS = 25      # keeps waypoints well inside ORS/OSRM limits
FILL_POOL = 150     # places the filler may draw on to use up spare time
VARIETY = 0.7       # each repeat of a category is worth this much less to the filler
ROUTE_CALLS = 5     # real-routing checks spent fitting the walk to the budget
OSRM = "https://routing.openstreetmap.de/routed-foot/route/v1/foot/"
_client = None


def client():
    global _client
    if _client is None:
        key = get_key()
        if key:
            _client = openrouteservice.Client(key=key, timeout=10, retry_over_query_limit=False)
    return _client


def tt(a, b, k=1.0):
    """Rough walking seconds between two points; k scales it to match the real router."""
    return metres(a, b) * DETOUR / WALK_MS * k


def walk_s(start, end, stops, k=1.0):
    pts = [start] + [p["lonlat"] for p in stops] + [end]
    return sum(tt(pts[i], pts[i + 1], k) for i in range(len(pts) - 1))


def calibrate(real_s, est_s):
    """Real router time over our estimate, clamped so one odd route can't skew everything."""
    return min(max(real_s / est_s, 0.75), 2.0) if est_s > 0 else 1.0


def stop_cost(real_s, est_s, n):
    """Seconds each of n added stops really cost: the dwell, plus whatever the router added per
    waypoint (reaching it from the street, doubling back) beyond our straight-line estimate."""
    return DWELL_S + min(max((real_s - est_s) / n, -60), 300)


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


def solve_greedy(start, end, cands, budget, route=(), k=1.0, stop_s=DWELL_S, used_s=None):
    """Insert stops into route (best value per extra second first) until nothing else fits the budget.
    used_s is how long route really takes, when the router has told us."""
    route = list(route)
    if used_s is None:
        used_s = walk_s(start, end, route, k) + stop_s * len(route)
    spare = budget - used_s
    while len(route) < MAX_STOPS:
        pts = [start] + [p["lonlat"] for p in route] + [end]
        legs = [tt(pts[i], pts[i + 1], k) for i in range(len(pts) - 1)]
        # time each remaining stop can afford: detours cheaper than this all cost the same, so with
        # few stops left the walk wanders further instead of finishing early
        share = spare / (MAX_STOPS - len(route))
        used = {p["id"] for p in route}
        seen = Counter(p["category"] for p in route)
        best = None
        for p in cands:
            if p["id"] in used:
                continue
            value = p["score"] * VARIETY ** seen[p["category"]]
            for i in range(len(route) + 1):
                extra = tt(pts[i], p["lonlat"], k) + tt(p["lonlat"], pts[i + 1], k) - legs[i] + stop_s
                if extra <= spare:
                    key = (value / max(extra, share), extra)
                    if best is None or key > best[0]:
                        best = (key, i, p)
        if best is None:
            break
        (_, extra), i, p = best
        route.insert(i, p)
        spare -= extra
    return route


def worst_stop(start, end, stops, k=1.0, stop_s=DWELL_S):
    """Index of the stop giving the least score per second it adds."""
    pts = [start] + [p["lonlat"] for p in stops] + [end]

    def cost(i):
        a, p, b = pts[i], pts[i + 1], pts[i + 2]
        return tt(a, p, k) + tt(p, b, k) - tt(a, b, k) + stop_s

    return min(range(len(stops)), key=lambda i: stops[i]["score"] / cost(i))


def make_plan(start, end, minutes, vibes=None):
    minutes = max(10, min(120, int(minutes)))
    budget = minutes * 60 * SAFETY  # what rough estimates aim for
    limit = minutes * 60            # what a walk checked by the real router may take
    start, end = tuple(start), tuple(end)

    boring_geom, boring_s, _ = route_line([start, end])
    ellipse = ellipse_polygon(start, end, budget)
    stops, extras, solver, message = [], [], "none", None
    k = calibrate(boring_s, tt(start, end))
    learn_k = tt(start, end) < 300  # round trip or nearly: no direct walk to learn the street factor from

    if ellipse is None or boring_s + DWELL_S > budget:
        message = "Not enough time for a detour - here's the direct way"
    else:
        mid = midpoint(start, end)
        places = get_places(mid[1], mid[0], search_radius_m(start, end, budget))
        pool = [p for p in places if in_ellipse(p["lonlat"], start, end, budget)]
        cands = score_places(pool, vibes)
        extras = score_places(pool, vibes, top_n=FILL_POOL, overflow=True)
        print(f"[plan] {len(places)} places -> {len(pool)} in ellipse -> {len(cands)} candidates (+{len(extras) - len(cands)} for filling)")
        if cands:
            try:
                stops, solver = solve_vroom(start, end, cands, budget), "vroom"
            except Exception as ex:
                print("[plan] VROOM failed, using greedy:", type(ex).__name__, str(ex)[:200])
                solver = "greedy"

    # Fit the walk to the budget using real routing. Every walk checked is the best one that fitted
    # so far plus some stops: learn what those added stops really cost, then top up again if there
    # is time to spare, or go back and add less (or drop the poorest-value stops) if it ran over.
    best = (boring_s, [], boring_geom, boring_s, "direct")  # (total, stops, geom, secs, source)
    dropped, checked, stop_s = set(), None, DWELL_S
    for _ in range(ROUTE_CALLS):
        if checked is not None or not stops:  # VROOM's walk is checked as it is before topping it up
            aim = limit if best[1] else budget  # once a walk is known to fit, an overshoot just reverts to it
            used = best[0] if stops == best[1] else None
            stops = solve_greedy(start, end, [p for p in extras if p["id"] not in dropped], aim, stops, k, stop_s, used)
        if not stops or stops == checked:
            break  # nothing (more) fits
        g, s_, r_ = route_line([start] + [p["lonlat"] for p in stops] + [end])
        if learn_k:  # so learn it from the first real walk instead
            k, learn_k = calibrate(s_, walk_s(start, end, stops)), False
        est = walk_s(start, end, stops, k) - walk_s(start, end, best[1], k)
        checked, stop_s = stops, stop_cost(s_ - best[3], est, len(stops) - len(best[1]))
        total = s_ + DWELL_S * len(stops)
        if total <= limit:
            print(f"[plan] {len(stops)} stops, {round(total / 60)} of {minutes} min")
            if total > best[0]:
                best = (total, stops, g, s_, r_)
            continue
        print(f"[plan] real time {round(total / 60)} min is over budget")
        if best[1]:
            # a top-up overshot: go back to the walk that fitted and retry with the costlier stop estimate
            stops = checked = best[1]
            continue
        while True:  # at least one, then until the recalibrated estimate fits
            worst = worst_stop(start, end, stops, k, stop_s)
            print(f"[plan]   dropping {stops[worst]['name']}")
            dropped.add(stops[worst]["id"])
            stops = stops[:worst] + stops[worst + 1:]
            if not stops or walk_s(start, end, stops, k) + stop_s * len(stops) <= budget:
                break
    _, stops, geom, secs, rsrc = best
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
