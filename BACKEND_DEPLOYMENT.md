# Panzira Backend Deployment Plan

## Current finding

The public Vercel site serves the React frontend. Read-only checks on 5 November 2026 returned HTTP 200 for the homepage and HTTP 404 for `/health`, `/api/public/alerts`, and `/api/v1/public/alerts`. The current public URL therefore does not prove that a FastAPI backend is deployed at the same origin.

The frontend now defaults to explicit local demo mode. It sends no backend requests and labels all local changes as browser-only. Server mode must be enabled deliberately.

## Model ownership debt

The backend currently contains two SQLAlchemy model modules: `backend/app/models.py` and `backend/app/database/models.py`. This branch removes exact duplicate attributes inside the latter and adds a static CI regression check, but it does not merge the two model stacks. Consolidation should be a separate migration-backed change after the team confirms which routes and tests own each stack; merging them during the safety fix could change table mappings or migration behavior.

## Separate service design

Deploy `backend/app/main.py` as a separate HTTPS service. Keep the frontend on Vercel and use a durable database for shared newsroom state.

Recommended production components:

1. FastAPI service with one documented start command
2. Managed PostgreSQL rather than SQLite on an ephemeral filesystem
3. Private object storage for evidence files
4. Exact CORS allowlist containing the Vercel origin
5. Platform health probe against `/health`

Suggested start command:

```text
uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port <platform port>
```

## Configuration sequence

Do not put credentials in Vercel `VITE_` variables. Browser variables are public.

1. Create the backend service without attaching production channels.
2. Set backend variables from `backend/.env.example` in the hosting platform secret store.
3. Generate new production values for `SECRET_KEY`, `FIELD_ENCRYPTION_KEY`, and `PHONE_HASH_PEPPER` during the authorized deployment process.
4. Set `DATABASE_URL` to managed PostgreSQL and `CORS_ORIGINS` to the exact frontend origin.
5. Leave WhatsApp, Telegram, SMS, USSD, Meta, and paid translation credentials empty until each integration has an owner and a test plan.
6. Verify `/health`, `/api/public/alerts`, and the authenticated newsroom endpoints on the backend URL.
7. Configure the frontend build with:

```text
VITE_BACKEND_MODE=server
VITE_API_BASE_URL=https://<backend-host>/api
VITE_HEALTH_URL=https://<backend-host>/health
```

8. Rebuild the frontend in a review deployment. Confirm that the status banner reports server mode before testing fictional records.

## Safe acceptance checks

Use fictional reports only. Disable outbound alert destinations during acceptance testing.

- `/health` returns 200 and states that AI auto-publishing is disabled.
- A failed submission leaves the UI unchanged and shows an error.
- A successful submission appears in a second authenticated session.
- Three completed checks still leave approval locked.
- Four completed checks permit an editor request, but the UI shows publication only after the server returns the signal and the public alert list contains the matching alert.
- No Telegram, WhatsApp, SMS, USSD, or public feed receives a test message.

## Rollback

If the server check fails, rebuild the frontend with `VITE_BACKEND_MODE=demo`. The banner will identify browser-only behavior and no backend mutation will be attempted. Do not point the frontend at an unverified service.
