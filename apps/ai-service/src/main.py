from fastapi import FastAPI

app = FastAPI(
    title="VivahOS AI Service",
    version="0.1.0",
    description="ML scoring, AI matchmaking, fraud detection",
)


@app.get("/health")
def health() -> dict[str, object]:
    return {"success": True, "data": {"status": "ok"}, "error": None, "meta": None}
