from fastapi import FastAPI

app = FastAPI(title="SoulSync Backend")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/detailed")
async def health_detailed():
    # Detailed checks can be implemented later (Postgres/Redis/Qdrant)
    return {
        "status": "ok",
        "services": {"postgres": "unknown", "redis": "unknown", "qdrant": "unknown"},
    }
