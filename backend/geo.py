from math import radians, sin, cos, asin, sqrt

WALK_MS = 1.39      # 5 km/h in metres per second
DETOUR = 1.3        # streets are not straight
DWELL_S = 120       # 2 minutes per stop
MAX_RADIUS_M = 3000 # cap Overpass search size


def metres(a, b):
    """Distance in metres between (lon, lat) points, using haversine."""
    dlon, dlat = radians(b[0] - a[0]), radians(b[1] - a[1])
    h = sin(dlat / 2) ** 2 + cos(radians(a[1])) * cos(radians(b[1])) * sin(dlon / 2) ** 2
    return 12_742_000 * asin(sqrt(h))


def in_ellipse(p, start, end, budget_s):
    """True if visiting p (and dwelling 2 min) still fits in the budget."""
    walk_s = (metres(start, p) + metres(p, end)) * DETOUR / WALK_MS
    return walk_s + DWELL_S <= budget_s


def midpoint(start, end):
    return ((start[0] + end[0]) / 2, (start[1] + end[1]) / 2)


def search_radius_m(start, end, budget_s):
    """Half the ellipse's long axis in metres, capped at 3 km."""
    max_walk_m = max(budget_s - DWELL_S, 0) * WALK_MS / DETOUR
    r = max(max_walk_m / 2, metres(start, end) / 2)
    return min(r, MAX_RADIUS_M)
