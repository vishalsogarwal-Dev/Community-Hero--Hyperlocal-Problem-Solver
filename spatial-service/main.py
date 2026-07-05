from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routers import reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup (PostGIS columns require the extension to be enabled first)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="Community Hero — Spatial Service",
    description="Geospatial API for report creation, duplication checks, and map queries.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reports.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "spatial-service"}
