"""Panzira AI - Main Application Entrypoint

FastAPI service powering:
1. Citizen Report Ingestion & Persistent DB Storage
2. AI / ML Road Hazard Analysis & Multilingual Translation
3. WhatsApp, Permitted Social Media, and SMS/USSD Webhooks
4. Journalist & Editor Verification Workflow with Strict Human Gate
5. Sanitized Public Safety Dashboard Broadcasts
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database.session import engine, Base, SessionLocal
from app.database.seed import seed_database
from app.auth.router import router as auth_router
from app.routers.public import router as public_router
from app.routers.newsroom import router as newsroom_router
from app.routers.briefs import router as briefs_router
from app.integrations.router import router as integrations_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database tables exist and seed baseline data
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield
    # Shutdown logic (if any)


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Backend service for Panzira AI road-safety intelligence platform. "
        "Enforces the core verification workflow: "
        "Received → AI Extracted → Corroboration → Editor Approval → Public Alert. "
        "AI strictly NEVER automatically publishes road-safety warnings."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware for Frontend Communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Modular API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(public_router, prefix=settings.API_V1_STR)
app.include_router(newsroom_router, prefix=settings.API_V1_STR)
app.include_router(briefs_router, prefix=settings.API_V1_STR)
app.include_router(integrations_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["System"])
def health_check():
    """Health check endpoint for container and process monitoring."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "aiAutoPublishEnabled": False,  # Safety invariant
    }


@app.get("/", tags=["System"])
def root_index():
    """Root platform information."""
    return {
        "name": settings.PROJECT_NAME,
        "docs": "/docs",
        "version": "1.0.0",
        "workflow": "Received → AI Extracted → Corroboration → Editor Approval → Public Alert",
    }

