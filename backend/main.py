import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://get-lost-maps.*\.vercel\.app|http://localhost:5173",
    allow_methods=["*"],
    allow_headers=["*"],
)

ORS_KEY = os.environ.get("ORS_API_KEY")

@app.get("/health")
def health():
    return {"ok": True}
