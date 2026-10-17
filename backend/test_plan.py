import sys, json
from plan import make_plan

a = sys.argv
s = (float(a[1]), float(a[2]))
e = (float(a[3]), float(a[4]))
r = make_plan(s, e, int(a[5]), {})
print(r["stats"], "| solver:", r["solver"], "| route:", r["routeSource"], "|", r["message"])
for i, p in enumerate(r["stops"], 1):
    print(i, p["category"], p["score"], p["name"])
if len(a) > 6 and a[6] == "save":
    json.dump(r, open("data/demo_plan.json", "w"))
    print("saved data/demo_plan.json")
