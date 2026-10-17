src = open("plan.py", encoding="utf-8").read()

# 1) call VROOM over plain HTTP instead of the strict python client
old = "res = client().optimization(jobs=jobs, vehicles=vehicles)"
new = '''r = httpx.post("https://api.openrouteservice.org/optimization",
                   json={"jobs": jobs, "vehicles": vehicles},
                   headers={"Authorization": get_key()}, timeout=20)
    r.raise_for_status()
    res = r.json()'''
if old in src:
    src = src.replace(old, new)
    print("1) VROOM call fixed")

# 2) check the REAL route time, drop the weakest stop until it fits
old = '''    if stops:
        geom, secs, rsrc = route_line([start] + [p["lonlat"] for p in stops] + [end])
    else:
        geom, secs, rsrc = boring_geom, boring_s, "direct"
'''
new = '''    geom, secs, rsrc = boring_geom, boring_s, "direct"
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
'''
if old in src:
    src = src.replace(old, new)
    print("2) real-time check added")

# 3) make the greedy fallback more cautious
old = 'solve_greedy(start, end, cands, budget), "greedy"'
if old in src:
    src = src.replace(old, 'solve_greedy(start, end, cands, budget * 0.7), "greedy"')
    print("3) greedy made cautious")

open("plan.py", "w", encoding="utf-8").write(src)
print("done")
