// Drop into src/api/client.ts. Replaces the localStorage actions in PanziraContext.
// Types come from the existing src/types.ts: the API returns the same shapes.
import type { SignalReport, VerifiedPublicAlert, CorridorWatchItem, WorkingBriefDraft } from '../types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
let token: string | null = sessionStorage.getItem('panzira_token'); // tab-scoped; cleared on close

async function call<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (!(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail ?? `Request failed (${res.status})`); // 403/409 messages are user-readable
  }
  return res.json();
}
const post = <T>(p: string, body?: unknown) => call<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

export const api = {
  // auth
  async login(email: string, password: string) {
    const r = await call<{ accessToken: string; user: { name: string; role: string; canViewGraphic: boolean } }>(
      '/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
    token = r.accessToken; sessionStorage.setItem('panzira_token', token); return r.user;
  },
  logout() { token = null; sessionStorage.removeItem('panzira_token'); },

  // public dashboard (no auth)
  publicAlerts: () => call<VerifiedPublicAlert[]>('/api/v1/public/alerts', {}, false),

  // citizen report (replaces submitCitizenReport); photo is a File, not a data URL
  submitReport(f: {
    description: string; categoryKey?: string; roadArea?: string; landmark?: string; language?: 'English' | 'Shona' | 'Ndebele';
    observedAt?: string; evidenceLink?: string; containsGraphic?: boolean; photo?: File | null;
  }) {
    const fd = new FormData();
    fd.set('description', f.description);
    if (f.categoryKey) fd.set('category_key', f.categoryKey);
    if (f.roadArea) fd.set('road_area', f.roadArea);
    if (f.landmark) fd.set('landmark', f.landmark);
    if (f.language) fd.set('language', f.language);
    if (f.observedAt) fd.set('observed_at', f.observedAt);
    if (f.evidenceLink) fd.set('evidence_link', f.evidenceLink);
    if (f.containsGraphic) fd.set('contains_graphic', 'true');
    if (f.photo) fd.set('photo', f.photo);
    return call<{ id: string; trackingToken: string; status: string }>('/api/v1/reports', { method: 'POST', body: fd }, false);
  },
  // "my reports" view: keep {id, trackingToken} in localStorage and poll this
  trackReport: (id: string, tokenValue: string) =>
    call<{ id: string; status: string; statusText: string; published: boolean }>(
      `/api/v1/reports/track/${id}?token=${encodeURIComponent(tokenValue)}`, {}, false),

  // newsroom (journalist / editor)
  signals: (q?: { status?: string; channel?: string; q?: string }) =>
    call<SignalReport[]>('/api/v1/signals' + (q ? '?' + new URLSearchParams(q as Record<string, string>) : '')),
  signal: (id: string) => call<SignalReport>(`/api/v1/signals/${id}`),
  toggleChecklist: (id: string, item: 'locationAndTime' | 'mediaAndDate' | 'independentSource' | 'hazardStillPresent', value: boolean) =>
    post<SignalReport>(`/api/v1/signals/${id}/checklist`, { item, value }),
  updateNotes: (id: string, notes: string) => call(`/api/v1/signals/${id}/notes`, { method: 'PUT', body: JSON.stringify({ notes }) }),
  requestEvidence: (id: string, note?: string) => post<SignalReport>(`/api/v1/signals/${id}/request-evidence`, { note }),
  rejectSignal: (id: string, note?: string) => post<SignalReport>(`/api/v1/signals/${id}/reject`, { note }),       // editor only
  verifySignal: (id: string) => post<{ signal: SignalReport }>(`/api/v1/signals/${id}/verify`),                    // editor only
  confirmTranslation: (id: string, english: string) => post<SignalReport>(`/api/v1/signals/${id}/translation/review`, { english }),
  editFields: (id: string, f: Partial<{ categoryKey: string; roadArea: string; landmark: string; corridorId: string; lat: number; lng: number }>) =>
    call<SignalReport>(`/api/v1/signals/${id}/fields`, { method: 'PATCH', body: JSON.stringify(f) }),
  revealGraphic: (evidenceId: string) => post<{ url: string }>(`/api/v1/evidence/${evidenceId}/reveal`).then(r => BASE + r.url),
  stats: () => call<Record<string, number | string | null>>('/api/v1/stats'),
  corridors: () => call<CorridorWatchItem[]>('/api/v1/corridors'),

  // briefs
  openBriefForSignal: (id: string) => post<WorkingBriefDraft>(`/api/v1/briefs/from-signal/${id}`),
  saveBrief: (b: WorkingBriefDraft & { version?: number }) =>
    call<WorkingBriefDraft>(`/api/v1/briefs/${b.investigationId}`, { method: 'PUT', body: JSON.stringify({ ...b, baseVersion: b.version }) }),
};

// Image URLs returned in SignalReport.photoPreviewUrl / photoFullUrl are relative and short-lived: prefix with BASE.
export const mediaUrl = (u?: string) => (u ? BASE + u : undefined);
