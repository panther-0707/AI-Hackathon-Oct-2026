import httpx
key = open(".env").read().split("=", 1)[1].strip()
body = {"request": "pois",
        "geometry": {"geojson": {"type": "Point", "coordinates": [-3.188, 55.952]}, "buffer": 800},
        "limit": 30}
r = httpx.post("https://api.openrouteservice.org/pois", json=body,
               headers={"Authorization": key}, timeout=30)
print(r.status_code)
print(r.text[:600])
