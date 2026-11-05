"""Panzira AI - Main Application Entrypoint

FastAPI service powering:
1. Citizen Report Ingestion & Persistent DB Storage
2. AI / ML Road Hazard Analysis & Multilingual Translation
3. WhatsApp, Permitted Social Media, and SMS/USSD Webhooks
4. Journalist & Editor Verification Workflow with Strict Human Gate
5. Sanitized Public Safety Dashboard Broadcasts
"""

from contextlib import asynccontextmanager
import asyncio
from sqlalchemy import inspect
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database.session import engine as db_engine, Base as DbBase, SessionLocal as DbSessionLocal
from app.database.seed import seed_database
from app.database.migrations import run_migrations
from app.db import engine as legacy_engine, Base as LegacyBase, SessionLocal as LegacySessionLocal

# Modular Newsroom & Public API routers
from app.auth.router import router as auth_router
from app.routers.public import router as public_router
from app.routers.newsroom import router as newsroom_router
from app.routers.briefs import router as briefs_router
from app.integrations.router import router as integrations_router

# Direct Verification & Intake routers (/api/v1)
from app.routers.auth import router as v1_auth_router
from app.routers.reports import router as v1_reports_router
from app.routers.evidence import router as v1_evidence_router
from app.routers.webhooks import router as v1_webhooks_router
from app.routers.newsroom_v1 import router as v1_newsroom_router
from app.routers.public_v1 import router as v1_public_router


async def _scheduled_rss_collection():
    """Process-local collector for the default single-worker deployment."""
    from app.integrations.rss_collector import collect_due_sources
    while True:
        await asyncio.sleep(60)
        await asyncio.to_thread(collect_due_sources)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database tables exist for both model sets and seed baseline data
    DbBase.metadata.create_all(bind=db_engine)
    try:
        if db_engine.dialect.name == "sqlite" and db_engine.url.database:
            inspector = inspect(legacy_engine)
            needs_user_upgrade = inspector.has_table("users") and not {
                "password_hash", "name", "can_view_graphic", "active", "failed_logins", "locked_until"
            }.issubset({c["name"] for c in inspector.get_columns("users")})
            needs_location_upgrade = inspector.has_table("signal_reports") and not {
                "reported_lat", "reported_lng", "gps_reported"
            }.issubset({c["name"] for c in inspector.get_columns("signal_reports")})
            needs_alert_location_upgrade = inspector.has_table("verified_public_alerts") and not {
                "lat", "lng"
            }.issubset({c["name"] for c in inspector.get_columns("verified_public_alerts")})
            if needs_user_upgrade or needs_location_upgrade or needs_alert_location_upgrade:
                run_migrations(db_engine.url.database)
        LegacyBase.metadata.create_all(bind=legacy_engine)
    except Exception:
        pass
    
    db = DbSessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    collector_task = asyncio.create_task(_scheduled_rss_collection())
    yield
    collector_task.cancel()
    try:
        await collector_task
    except asyncio.CancelledError:
        pass


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

# Mount Modular API Routers (/api)
app.include_router(auth_router, prefix="/api")
app.include_router(public_router, prefix="/api")
app.include_router(newsroom_router, prefix="/api")
app.include_router(briefs_router, prefix="/api")
app.include_router(integrations_router, prefix="/api")

# Mount Versioned Verification API Routers (/api/v1)
app.include_router(v1_auth_router)
app.include_router(v1_reports_router)
app.include_router(v1_evidence_router)
# Provider consoles and integration status use the versioned callback paths.
app.include_router(v1_webhooks_router, prefix="/api/v1")
# Keep the original unversioned callbacks working for existing installations.
app.include_router(v1_webhooks_router, include_in_schema=False)
app.include_router(v1_newsroom_router)
app.include_router(v1_public_router)


@app.get("/health", tags=["System"])
def health_check():
    """Health check endpoint for container and process monitoring."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "aiAutoPublishEnabled": False,  # Safety invariant
    }


@app.get("/healthz", tags=["System"])
def healthz_check():
    return {"ok": True, "service": settings.PROJECT_NAME}


@app.get("/", tags=["System"])
def root_index():
    """Root platform information."""
    return {
        "name": settings.PROJECT_NAME,
        "docs": "/docs",
        "version": "1.0.0",
        "workflow": "Received → AI Extracted → Corroboration → Editor Approval → Public Alert",
    }
