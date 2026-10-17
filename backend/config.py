import os


def get_key():
    k = os.environ.get("ORS_API_KEY")
    if k:
        return k.strip()
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    try:
        for line in open(path, encoding="utf-8-sig"):
            if line.startswith("ORS_API_KEY="):
                return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    return None
