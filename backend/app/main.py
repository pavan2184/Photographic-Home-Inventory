from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import items, upload

app = FastAPI(
    title="Home Inventory API",
    description="AI-powered home inventory management",
    version="0.1.0",
)

if settings.cors_origins == ["*"]:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(upload.router)
app.include_router(items.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
