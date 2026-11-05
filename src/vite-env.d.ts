/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_MODE?: 'demo' | 'server';
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_HEALTH_URL?: string;
  readonly VITE_TELEGRAM_BOT_USERNAME?: string;
  readonly VITE_WHATSAPP_NUMBER?: string;
  readonly VITE_USSD_SERVICE_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

