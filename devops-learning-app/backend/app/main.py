from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import settings
from .database import engine
from .routers import auth, labs, modules, progress, quizzes

app = FastAPI(
    title="DevOps Academy API",
    version="1.0.0",
    description="Learning platform API: modules, quizzes, labs, progress, badges.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_V1 = "/api/v1"
app.include_router(auth.router, prefix=API_V1)
app.include_router(modules.router, prefix=API_V1)
app.include_router(quizzes.router, prefix=API_V1)
app.include_router(labs.router, prefix=API_V1)
app.include_router(progress.router, prefix=API_V1)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/readyz")
async def readyz():
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {"status": "ready"}


try:  # optional: Prometheus metrics (the app dogfoods its own monitoring module)
    from prometheus_fastapi_instrumentator import Instrumentator

    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
except ImportError:  # pragma: no cover
    pass
