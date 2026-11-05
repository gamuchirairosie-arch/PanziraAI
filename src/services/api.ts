/**
 * Panzira AI - Frontend API Service Client
 * Connects the React UI to the Python FastAPI backend service.
 */

import {
  CorridorWatchItem,
  SignalReport,
  VerificationChecklist,
  VerifiedPublicAlert,
  WorkingBriefDraft,
} from '../types';
import { NewCitizenReportInput } from '../context/PanziraContext';

export type BackendMode = 'demo' | 'server';
export type BackendHealthStatus = 'demo' | 'online' | 'offline' | 'misconfigured';

export interface BackendHealthResult {
  status: BackendHealthStatus;
  message: string;
  checkedUrl?: string;
}

const configuredMode = (import.meta.env.VITE_BACKEND_MODE as string | undefined)?.toLowerCase();
const configuredApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '');
const configuredHealthUrl = (import.meta.env.VITE_HEALTH_URL as string | undefined)?.replace(/\/$/, '');

export const backendRuntime = {
  mode: (configuredMode === 'server' ? 'server' : 'demo') as BackendMode,
  apiBase: configuredApiBase || '',
  healthUrl:
    configuredHealthUrl ||
    (configuredApiBase ? `${configuredApiBase.replace(/\/api$/, '')}/health` : ''),
  configured: configuredMode !== 'server' || Boolean(configuredApiBase),
};

const API_BASE = backendRuntime.apiBase;
const HEALTH_URL = backendRuntime.healthUrl;

export interface NewsSourceRecord {
  id: number;
  name: string;
  feedUrl: string;
  publisherDomain: string;
  basis: string;
  active: boolean;
  pollIntervalMinutes: number;
  lastPolledAt: string | null;
  lastError: string | null;
}

export interface CollectionRunRecord {
  id: number;
  sourceId: number | null;
  source: string;
  startedAt: string;
  finishedAt: string | null;
  fetched: number;
  created: number;
  duplicates: number;
  skipped: number;
  status: string;
  error: string | null;
}

export interface IntegrationStatusRecord {
  whatsapp: { configured: boolean; webhookPath: string };
  telegram: { configured: boolean; publicAlertsConfigured: boolean; webhookPath: string };
  ussd: { configured: boolean; webhookPath: string };
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = typeof localStorage === 'undefined' ? null : localStorage.getItem('panzira_auth_token');
  }

  getRuntime() {
    return backendRuntime;
  }

  private requireServerConfiguration() {
    if (backendRuntime.mode !== 'server') {
      throw new Error('This action is running in local demo mode and was not sent to a server.');
    }
    if (!backendRuntime.configured || !API_BASE) {
      throw new Error('Server mode requires VITE_API_BASE_URL. No request was sent.');
    }
  }

  setToken(t: string | null) {
    this.token = t;
    if (t) {
      if (typeof localStorage !== 'undefined') localStorage.setItem('panzira_auth_token', t);
    } else {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('panzira_auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private getHeaders(contentType = true): HeadersInit {
    const headers: Record<string, string> = {};
    if (contentType) headers['Content-Type'] = 'application/json';
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  async checkHealth(): Promise<BackendHealthResult> {
    if (backendRuntime.mode === 'demo') {
      return {
        status: 'demo',
        message: 'Local demo mode. Changes stay in this browser and no backend requests are sent.',
      };
    }
    if (!backendRuntime.configured || !HEALTH_URL) {
      return {
        status: 'misconfigured',
        message: 'Server mode is enabled but VITE_API_BASE_URL is missing.',
      };
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(HEALTH_URL, { method: 'GET', signal: controller.signal });
      if (!res.ok) {
        return {
          status: 'offline',
          message: `Backend health check returned HTTP ${res.status}.`,
          checkedUrl: HEALTH_URL,
        };
      }
      return {
        status: 'online',
        message: 'Backend health check succeeded.',
        checkedUrl: HEALTH_URL,
      };
    } catch (error) {
      return {
        status: 'offline',
        message: error instanceof Error ? error.message : 'Backend health check failed.',
        checkedUrl: HEALTH_URL,
      };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  // --- Authentication ---
  async login(email: string, password: string) {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Authentication failed');
    const data = await res.json();
    this.setToken(data.access_token);
    return data;
  }

  // --- Public APIs ---
  async fetchPublicAlerts(): Promise<VerifiedPublicAlert[]> {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE}/public/alerts`);
    if (!res.ok) throw new Error('Failed to load public alerts');
    return res.json();
  }

  async fetchCorridors(): Promise<CorridorWatchItem[]> {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE}/public/corridors`);
    if (!res.ok) throw new Error('Failed to load corridors');
    return res.json();
  }

  async submitCitizenReport(input: NewCitizenReportInput): Promise<SignalReport> {
    this.requireServerConfiguration();
    const payload = {
      categoryKey: input.categoryKey,
      categoryLabel: input.categoryLabel,
      roadArea: input.roadArea,
      landmark: input.landmark,
      description: input.description,
      reportedDateTime: input.reportedDateTime,
      observedIso: input.observedIso,
      evidenceLink: input.evidenceLink,
      language: input.language,
      photoType: input.photoType,
      customPhotoDataUrl: input.customPhotoDataUrl,
      photoFilename: input.photoFilename,
      containsGraphicContent: input.containsGraphicContent,
      reportedLat: input.reportedLat,
      reportedLng: input.reportedLng,
    };

    const res = await fetch(`${API_BASE}/public/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to submit report');
    }
    return res.json();
  }

  // --- Newsroom APIs (Journalist & Editor) ---
  async fetchSignals(): Promise<SignalReport[]> {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE}/newsroom/signals`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load newsroom signals');
    return res.json();
  }

  async toggleChecklist(
    signalId: string,
    field: keyof VerificationChecklist
  ): Promise<SignalReport> {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE}/newsroom/signals/${signalId}/checklist`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ field }),
    });
    if (!res.ok) throw new Error('Failed to toggle checklist');
    return res.json();
  }

  async updateNotes(signalId: string, notes: string): Promise<SignalReport> {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE}/newsroom/signals/${signalId}/notes`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) throw new Error('Failed to update notes');
    return res.json();
  }

  async requestEvidence(signalId: string, note?: string): Promise<SignalReport> {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE}/newsroom/signals/${signalId}/request-evidence`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ note }),
    });
    if (!res.ok) throw new Error('Failed to request evidence');
    return res.json();
  }

  async rejectSignal(signalId: string, reason?: string): Promise<SignalReport> {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE}/newsroom/signals/${signalId}/reject`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error('Failed to reject signal');
    return res.json();
  }

  async verifySignal(signalId: string): Promise<SignalReport> {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE}/newsroom/signals/${signalId}/verify`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Editor gate: all 4 checks required.');
    }
    return res.json();
  }

  // --- Investigative Briefs ---
  async fetchWorkingBrief(): Promise<WorkingBriefDraft> {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE}/newsroom/briefs`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load working brief');
    return res.json();
  }

  async saveWorkingBrief(brief: Partial<WorkingBriefDraft>): Promise<WorkingBriefDraft> {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE}/newsroom/briefs`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(brief),
    });
    if (!res.ok) throw new Error('Failed to save working brief');
    return res.json();
  }

  // --- Audit Trail ---
  async fetchAuditLogs(): Promise<any[]> {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE}/newsroom/audit-logs`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load audit logs');
    return res.json();
  }

  async fetchIntegrationStatus(): Promise<IntegrationStatusRecord> {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE.replace(/\/api$/, '')}/api/v1/integrations/status`, {
      headers: this.getHeaders(false),
    });
    if (!res.ok) throw new Error('Could not load channel configuration status');
    return res.json();
  }

  async fetchNewsSources(): Promise<NewsSourceRecord[]> {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE.replace(/\/api$/, '')}/api/v1/news-sources`, {
      headers: this.getHeaders(false),
    });
    if (!res.ok) throw new Error('Could not load monitored sources');
    return res.json();
  }

  async fetchCollectionRuns(): Promise<CollectionRunRecord[]> {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE.replace(/\/api$/, '')}/api/v1/news-sources/runs`, {
      headers: this.getHeaders(false),
    });
    if (!res.ok) throw new Error('Could not load source collection history');
    return res.json();
  }

  async addNewsSource(input: { name: string; feedUrl: string; basis: string; pollIntervalMinutes: number }): Promise<NewsSourceRecord> {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE.replace(/\/api$/, '')}/api/v1/news-sources`, {
      method: 'POST', headers: this.getHeaders(), body: JSON.stringify(input),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || 'Could not add source');
    }
    return res.json();
  }

  async setNewsSourceActive(id: number, active: boolean): Promise<NewsSourceRecord> {
    this.requireServerConfiguration();
    const res = await fetch(`${API_BASE.replace(/\/api$/, '')}/api/v1/news-sources/${id}`, {
      method: 'PATCH', headers: this.getHeaders(), body: JSON.stringify({ active }),
    });
    if (!res.ok) throw new Error('Could not update source');
    return res.json();
  }

  async collectNewsSources(id?: number): Promise<void> {
    this.requireServerConfiguration();
    const path = id === undefined ? 'news-sources/collect' : `news-sources/${id}/collect`;
    const res = await fetch(`${API_BASE.replace(/\/api$/, '')}/api/v1/${path}`, {
      method: 'POST', headers: this.getHeaders(false),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || 'Could not start collection');
    }
  }
}

export const apiService = new ApiService();
