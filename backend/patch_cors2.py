src = open("main.py", encoding="utf-8-sig").read()
old = r"https://get-lost-maps.*\.vercel\.app"
new = r"https://(get-lost-maps|ai-hackathon-oct-2026).*\.vercel\.app"
if old in src:
    open("main.py", "w", encoding="utf-8").write(src.replace(old, new))
    print("CORS patched")
else:
    print("pattern not found or already patched")
