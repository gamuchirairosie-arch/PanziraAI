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

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  (typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000/api'
    : '/api');

const HEALTH_URL =
  (import.meta.env.VITE_HEALTH_URL as string | undefined) ||
  (typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000/health'
    : '/health');

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('panzira_auth_token');
  }

  setToken(t: string | null) {
    this.token = t;
    if (t) {
      localStorage.setItem('panzira_auth_token', t);
    } else {
      localStorage.removeItem('panzira_auth_token');
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

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(HEALTH_URL, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }

  // --- Authentication ---
  async login(email = 'rudo.moyo@panzira.org', password = 'panzira_editor_2025') {
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
    const res = await fetch(`${API_BASE}/public/alerts`);
    if (!res.ok) throw new Error('Failed to load public alerts');
    return res.json();
  }

  async fetchCorridors(): Promise<CorridorWatchItem[]> {
    const res = await fetch(`${API_BASE}/public/corridors`);
    if (!res.ok) throw new Error('Failed to load corridors');
    return res.json();
  }

  async submitCitizenReport(input: NewCitizenReportInput): Promise<SignalReport> {
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
    const res = await fetch(`${API_BASE}/newsroom/signals/${signalId}/checklist`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ field }),
    });
    if (!res.ok) throw new Error('Failed to toggle checklist');
    return res.json();
  }

  async updateNotes(signalId: string, notes: string): Promise<SignalReport> {
    const res = await fetch(`${API_BASE}/newsroom/signals/${signalId}/notes`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) throw new Error('Failed to update notes');
    return res.json();
  }

  async requestEvidence(signalId: string, note?: string): Promise<SignalReport> {
    const res = await fetch(`${API_BASE}/newsroom/signals/${signalId}/request-evidence`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ note }),
    });
    if (!res.ok) throw new Error('Failed to request evidence');
    return res.json();
  }

  async rejectSignal(signalId: string, reason?: string): Promise<SignalReport> {
    const res = await fetch(`${API_BASE}/newsroom/signals/${signalId}/reject`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error('Failed to reject signal');
    return res.json();
  }

  async verifySignal(signalId: string): Promise<SignalReport> {
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
    const res = await fetch(`${API_BASE}/newsroom/briefs`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load working brief');
    return res.json();
  }

  async saveWorkingBrief(brief: Partial<WorkingBriefDraft>): Promise<WorkingBriefDraft> {
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
    const res = await fetch(`${API_BASE}/newsroom/audit-logs`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load audit logs');
    return res.json();
  }
}

export const apiService = new ApiService();
