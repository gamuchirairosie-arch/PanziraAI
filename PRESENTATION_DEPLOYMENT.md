# Presentation deployment

This repo includes a Render Blueprint for the FastAPI API at [`render.yaml`](render.yaml). It creates one API worker and a persistent disk for SQLite and evidence uploads. The Vercel frontend remains a separate static deployment.

## Deploy the API

1. Push this commit to the GitHub branch connected to Render.
2. In Render, choose **New > Blueprint**, select this repository, and create the `panzira-api` service. The blueprint uses a paid Starter instance because Render's free web services do not provide persistent disks.
3. Before the first deploy completes, fill the service's unsynced environment values:
   - `FIELD_ENCRYPTION_KEY`: generate locally with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
   - `CORS_ORIGINS`: exact Vercel site origin, e.g. `https://your-project.vercel.app` (no trailing slash).
   - `TELEGRAM_BOT_TOKEN`: BotFather token.
   - `TELEGRAM_WEBHOOK_SECRET`: random 1-256 character value using only letters, digits, `_` and `-`.
   - `TELEGRAM_EDITOR_CHAT_ID`: optional chat ID for new lead notices.
   - `TELEGRAM_ALERT_CHAT_ID`: optional destination for editor-approved alert notices.
4. Wait for Render's health check. The API is ready when `https://<render-service>.onrender.com/health` returns JSON with `"status":"healthy"`.

Keep the generated `SECRET_KEY`, `PHONE_HASH_PEPPER`, and Fernet key stable after launch. Changing them can invalidate sessions or make previously encrypted fields unreadable. The disk holds both the SQLite database and uploaded evidence; keep a backup before replacing the service or disk.

## Connect Vercel

In the Vercel project settings, set `VITE_API_BASE_URL` to the Render service origin (for example `https://panzira-api.onrender.com`) and `VITE_TELEGRAM_BOT_USERNAME` to the bot's username without `@`. Redeploy the frontend so Vite embeds those values. Confirm the frontend loads and the backend's `/health` endpoint is healthy.

## Enable Telegram delivery

Once the API has a public HTTPS URL and its bot token and webhook secret are configured, register the webhook from a secure local shell (never commit the token):

```powershell
$token = Read-Host 'Telegram bot token'
$secret = Read-Host 'Telegram webhook secret'
$url = 'https://<render-service>.onrender.com/api/v1/webhooks/telegram'
$body = @{ url = $url; secret_token = $secret } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setWebhook" -ContentType 'application/json' -Body $body
Remove-Variable token, secret, body
```

Telegram should return `ok: true`. Open the bot, send `/start`, agree to consent, and submit a demo report. Confirm it appears in the newsroom as an unverified lead. The public alert channel receives only editor-approved alerts.

## Presentation fallback

If there is no time to configure Render, present the existing demo mode and describe Telegram as implemented but awaiting the hosted API. A Vercel static site alone cannot accept Telegram webhooks. Do not claim real Telegram submissions are live until the webhook responds successfully and a test report reaches the newsroom.
