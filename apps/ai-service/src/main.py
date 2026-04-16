from fastapi import FastAPI

from src.routers.horoscope import router as horoscope_router

app = FastAPI(
    title="VivahOS AI Service",
    version="0.1.0",
    description="ML scoring, AI matchmaking, fraud detection",
)

app.include_router(horoscope_router)


@app.get("/health")
def health() -> dict[str, object]:
    return {"success": True, "data": {"status": "ok"}, "error": None, "meta": None}
