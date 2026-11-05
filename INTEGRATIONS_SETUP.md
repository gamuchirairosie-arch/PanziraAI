# Panzira channels, news collection, and map setup

This adds integrations to the existing FastAPI/React application. Provider calls need credentials and publicly reachable HTTPS callback URLs before they can receive real messages. The app keeps new material as an unverified newsroom lead; it never publishes an AI-generated alert.

## Local setup

1. Install the backend dependencies from the repository root with `python -m pip install -r requirements.txt`.
2. Copy `backend/.env.example` to `backend/.env`, then set unique `SECRET_KEY`, `FIELD_ENCRYPTION_KEY`, and `PHONE_HASH_PEPPER` values. Keep this file private and out of source control.
3. Set `CORS_ORIGINS` in the backend environment to the exact frontend origins. When the frontend and backend use different hosts, set the frontend build variable `VITE_API_BASE_URL` to the public backend origin (for example `https://api.example.org`; a value ending in `/api` is also accepted).
4. Run `python backend/run.py` and `npm run dev` from the repository root. Open the frontend on `http://localhost:5173`; browser location access works on localhost, or on a deployed HTTPS origin, after the user grants permission.

For callback development, expose the backend through a trusted HTTPS tunnel and configure that temporary public URL in each provider console. A local-only backend cannot receive provider webhooks. Do not use production tokens in a shared tunnel.

## WhatsApp Cloud API

Configure `WA_VERIFY_TOKEN`, `WA_APP_SECRET`, `WA_ACCESS_TOKEN`, and `WA_PHONE_NUMBER_ID` from the Meta app and WhatsApp Business account. Set the Meta webhook callback to `https://<backend-host>/api/v1/webhooks/whatsapp`, subscribe to `messages`, and enter the same verify token. Configure the frontend's `VITE_WHATSAPP_NUMBER` as an international-format number without `+` or punctuation so the citizen button opens a chat. The citizen must start the conversation; the intake asks for consent before storing reports. Text, image, and location messages enter the existing report pipeline. Provider credentials belong only in backend environment variables.

## Telegram Bot API

Create a bot with Telegram's BotFather. Set `TELEGRAM_BOT_TOKEN` and a random `TELEGRAM_WEBHOOK_SECRET` (1–256 characters, using Telegram's supported header-token characters). Set the webhook to `https://<backend-host>/api/v1/webhooks/telegram` with that secret token. Set `VITE_TELEGRAM_BOT_USERNAME` to the bot username (without `@`) for the public report button. `TELEGRAM_EDITOR_CHAT_ID` receives new lead notices; `TELEGRAM_ALERT_CHAT_ID` is the destination for editor-approved public alerts. The bot handles private chats only, requests explicit consent, and supports text, photos, and location pins. Users can send `/stop` to withdraw consent.

Telegram retries are deduplicated by `update_id`; only that numeric identifier is retained before consent, never the unconsented message payload. Reports appear in the journalist inbox as opt-in, unverified leads. Telegram API response failures are recorded in the outbox as failed, while a photo-download failure leaves the text or caption lead available for manual review.

## Deployment reachability

The Vercel frontend is a static deployment and does not run this FastAPI service. A 404 from `<frontend-host>/health` or `<frontend-host>/api/public/alerts` therefore means the frontend build has no reachable backend configured; it is not a Telegram credential failure. Deploy the backend separately with persistent storage, then set `VITE_API_BASE_URL` on the frontend deployment and rebuild it. Confirm `https://<backend-host>/health` and `https://<backend-host>/api/public/alerts` return HTTP 200, and set `CORS_ORIGINS` on the backend to the exact frontend origin.

After the backend is reachable, register `https://<backend-host>/api/v1/webhooks/telegram` with Telegram using the same value as `TELEGRAM_WEBHOOK_SECRET`. A missing or invalid server-side webhook secret returns HTTP 503; a mismatched Telegram secret header returns HTTP 403. Bot credentials, webhook registration, the public HTTPS backend, and the editor or alert chat IDs are external setup and cannot be supplied by application code.

## USSD

The existing Africa's Talking integration receives callbacks at `/api/v1/webhooks/africastalking/ussd`. Configure `AT_USERNAME`, `AT_API_KEY`, and `AT_WEBHOOK_SECRET`, then enter the HTTPS callback URL (including `?key=<AT_WEBHOOK_SECRET>`) in Africa's Talking. Set `VITE_USSD_SERVICE_CODE` to the service code shown to citizens. The provider must provision a live shortcode/service; a frontend link alone cannot create one.

## Zimbabwe RSS collector

Editors can register and pause feeds in the newsroom **Sources** view. The collector permits HTTPS feeds on a curated list of Zimbabwean publisher domains in `backend/app/integrations/rss_collector.py`; it reads publisher RSS/Atom feeds only, follows no redirects, fetches no article pages, and records source attribution and collection runs. Each entry is filtered for road-safety terms and a recognized Zimbabwe location/corridor, then deduplicated through the existing report intake. Add only publisher-provided feed URLs whose terms permit this use. A valid publisher feed URL must be supplied by the newsroom; the app does not guess or crawl feed URLs.

Collection runs every minute in the API process and observes each source's configured interval. Run one API worker while this in-process scheduler is enabled. For multi-worker or horizontally scaled production deployment, move scheduled collection to a single worker/queue with a distributed lock before scaling API workers; otherwise sources may be polled redundantly. Collection is free of paid feed/API dependencies, but publisher terms and hosting/network costs still apply.

## Map and browser location

The heat layer summarizes only geolocated, editor-approved public alerts. Select an incident to view its details. Route alternatives require browser location permission and a chosen destination; routes are filtered to avoid a buffer around mapped incidents when coordinates are available. Routing is a best-effort OpenStreetMap OSRM demonstration service: it does not provide live traffic, verified closures, or guaranteed detours. Confirm route conditions with local authorities. Coordinates are optional and are sent to the routing service only after the citizen requests route guidance. Browser location is optional for reports and requires a secure context (HTTPS, or localhost) plus user permission.

## Verification

Run `npm run build` for the frontend production build. Backend tests use `python -m pytest backend/tests`. Provider delivery requires provider credentials and a reachable HTTPS callback; local unit tests do not prove that Meta, Telegram, Africa's Talking, publisher feeds, or public routing services are configured for production.
