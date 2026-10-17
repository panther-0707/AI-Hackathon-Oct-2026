src = open("main.py", encoding="utf-8").read()
old = r"http://localhost:5173|http://127\.0\.0\.1:5173"
new = r"http://(localhost|127\.0\.0\.1):[0-9]+"
assert old in src, "pattern not found"
open("main.py", "w", encoding="utf-8").write(src.replace(old, new))
print("CORS now allows any local port")
