import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  CORRIDOR_WATCHLIST,
  INITIAL_SIGNALS,
  INITIAL_VERIFIED_ALERTS,
  INITIAL_WORKING_BRIEF,
} from '../data/seedData';
import {
  CorridorWatchItem,
  HazardCategoryKey,
  NewsroomView,
  PortalMode,
  PublicView,
  SignalReport,
  VerificationChecklist,
  VerifiedPublicAlert,
  WorkingBriefDraft,
} from '../types';
import {
  formatHarareDateTime,
  formatHarareShortTime,
  validateObservedDateTime,
} from '../utils/dateTime';
import {
  apiService,
  BackendHealthResult,
  BackendMode,
} from '../services/api';
import {
  commitAfterServerAcknowledgement,
  errorMessage,
  isFourCheckGateComplete,
} from '../services/mutationPolicy';

const STORAGE_KEY = 'panzira_ai_hackathon_demo_v1';

export interface NewCitizenReportInput {
  categoryKey: HazardCategoryKey;
  categoryLabel: string;
  roadArea: string;
  landmark: string;
  description: string;
  reportedDateTime: string;
  observedIso?: string;
  evidenceLink?: string;
  language: 'English' | 'Shona' | 'Ndebele';
  photoType: 'none' | 'figma-road-damage' | 'custom-upload';
  customPhotoDataUrl?: string;
  photoFilename?: string;
  containsGraphicContent?: boolean;
  reportedLat?: number;
  reportedLng?: number;
}

interface PersistedState {
  signals: SignalReport[];
  verifiedAlerts: VerifiedPublicAlert[];
  briefDraft: WorkingBriefDraft;
  baseSignalOffset: number;
  baseVerifiedOffset: number;
  lastEditorialUpdateIso?: string;
  lastEditorialUpdateTime?: string;
  lastEditorialUpdateDateLabel?: string;
}

interface PanziraContextValue {
  // Navigation
  portal: PortalMode;
  newsroomView: NewsroomView;
  publicView: PublicView;
  navigateNewsroom: (view: NewsroomView, signalId?: string) => void;
  navigatePublic: (view: PublicView) => void;

  // Search
  newsroomSearch: string;
  setNewsroomSearch: (q: string) => void;
  publicSearch: string;
  setPublicSearch: (q: string) => void;

  // Data
  signals: SignalReport[];
  verifiedAlerts: VerifiedPublicAlert[];
  corridors: CorridorWatchItem[];
  briefDraft: WorkingBriefDraft;

  // Computed counts & editorial timestamp
  totalSignalsCount: number;
  publicSignalsCount: number;
  optInSignalsCount: number;
  awaitingReviewCount: number;
  approvedAlertsCount: number;
  autoPublishedByAiCount: 0;
  lastEditorialUpdateTime: string;
  lastEditorialUpdateDateLabel: string;

  // Selected items
  selectedMonitorId: string;
  setSelectedMonitorId: (id: string) => void;
  selectedInboxId: string;
  setSelectedInboxId: (id: string) => void;
  selectedVerifyId: string;
  setSelectedVerifyId: (id: string) => void;
  selectedCorridorId: 'A5' | 'KHAMI' | 'ESIGODINI';
  setSelectedCorridorId: (id: 'A5' | 'KHAMI' | 'ESIGODINI') => void;
  lastSubmittedReceiptId: string | null;

  // Runtime truth: server-backed or explicitly local-only
  backendMode: BackendMode;
  backendHealth: BackendHealthResult;

  // Editorial & Citizen Actions
  submitCitizenReport: (input: NewCitizenReportInput) => Promise<SignalReport>;
  toggleChecklist: (signalId: string, field: keyof VerificationChecklist) => Promise<boolean>;
  updateEditorialNotes: (signalId: string, notes: string) => Promise<boolean>;
  requestEvidence: (signalId: string, note?: string) => Promise<boolean>;
  rejectSignal: (signalId: string, reason?: string) => Promise<boolean>;
  verifySignal: (signalId: string) => Promise<boolean>;

  // Graphic safety (session-scoped reveal inside newsroom workspace only)
  revealedGraphicIds: Record<string, boolean>;
  toggleGraphicReveal: (signalId: string) => void;

  // Brief actions
  updateBriefField: <K extends keyof WorkingBriefDraft>(
    key: K,
    value: WorkingBriefDraft[K]
  ) => void;
  saveBriefDraft: () => Promise<boolean>;
  openWorkingBriefForSignal: (signalId: string) => void;

  // Toast / status feedback & demo reset
  toastMessage: string | null;
  dismissToast: () => void;
  resetDemoData: () => void;
}

const PanziraContext = createContext<PanziraContextValue | null>(null);

const LEGACY_UPPERCASE_MAP: Record<string, string> = {
  'PUBLIC FACEBOOK PAGE': 'Public Facebook page',
  'OPT-IN WHATSAPP': 'Opt-in WhatsApp',
  'INSTAGRAM LINK': 'Instagram link',
  'CITIZEN WEB': 'Citizen web',
  'SUBMITTED PUBLIC LINK': 'Submitted public link',
  'NEEDS CORROBORATION': 'Needs corroboration',
  'AI STRUCTURED': 'AI structured',
  'REVIEW SOURCE': 'Review source',
  VERIFYING: 'Verifying',
  'NEEDS LOCATION': 'Needs location',
  'GRAPHIC RESTRICTED': 'Graphic restricted',
  'UNVERIFIED LEAD': 'Unverified lead',
  'EVIDENCE REQUESTED': 'Evidence requested',
  'VERIFIED · APPROVED': 'Verified · Approved',
  'REJECTED · ARCHIVED': 'Rejected · Archived',
  'READY FOR EDITOR GATE': 'Ready for editor gate',
  VERIFIED: 'Verified',
};

function normalizeSentenceCaseLabel(val: string): string {
  if (!val) return val;
  if (LEGACY_UPPERCASE_MAP[val]) return LEGACY_UPPERCASE_MAP[val];
  return val
    .replace('CITIZEN WEB · ', 'Citizen web · ')
    .replace('OPT-IN WHATSAPP · ', 'Opt-in WhatsApp · ')
    .replace('AUTHORIZED PUBLIC FEED · ', 'Authorized public feed · ')
    .replace('SUBMITTED PUBLIC LINK · ', 'Submitted public link · ')
    .replace(' · UNVERIFIED LEAD', ' · Unverified lead')
    .replace(' · VERIFYING', ' · Verifying')
    .replace(' · VERIFIED', ' · Verified')
    .replace(' · LEAD', ' · Lead')
    .replace(' · GRAPHIC RESTRICTED', ' · Graphic restricted')
    .replace(' · GRAPHIC REVIEW', ' · Graphic review')
    .replace(' · EVIDENCE REQUESTED', ' · Evidence requested')
    .replace(' · REJECTED', ' · Rejected')
    .replace(' · NEEDS LOCATION', ' · Needs location')
    .replace(' · AI STRUCTURED', ' · AI structured');
}

/**
 * Non-destructively normalizes persisted localStorage state while strictly preserving
 * all existing user/QA reports (e.g. PZ-DEMO-0430 and PZ-DEMO-0431), checklists, and statuses.
 */
function hydrateAndNormalizePersistedState(parsed: PersistedState): PersistedState {
  const normalizedSignals = parsed.signals.map((sig) => {
    const fixedImageHeading =
      sig.aiImageHeading === 'No photograph attached (low-bandwidth submission)' ||
      sig.aiImageHeading === 'No photograph attached'
        ? 'Text-only submission (no photo attached)'
        : sig.aiImageHeading;

    // Update seeded baseline map coordinates to match the neutral Bulawayo basemap
    const seedMatch = INITIAL_SIGNALS.find((s) => s.id === sig.id);

    return {
      ...sig,
      sourceChannelLabel: normalizeSentenceCaseLabel(sig.sourceChannelLabel),
      monitorStatusLabel: normalizeSentenceCaseLabel(sig.monitorStatusLabel),
      inboxStatusLine: normalizeSentenceCaseLabel(sig.inboxStatusLine),
      aiImageHeading: fixedImageHeading,
      mapCoords: seedMatch ? seedMatch.mapCoords : sig.mapCoords,
    };
  });

  const normalizedAlerts = parsed.verifiedAlerts.map((alert) => {
    const seedAlert = INITIAL_VERIFIED_ALERTS.find((a) => a.id === alert.id);
    if (seedAlert) {
      return {
        ...alert,
        desktopPin: seedAlert.desktopPin,
      };
    }
    return alert;
  });

  // Derive editorial update time if a prior QA approval occurred before Bug 6 fix
  let derivedTime = parsed.lastEditorialUpdateTime;
  let derivedDateLabel = parsed.lastEditorialUpdateDateLabel;

  if (!derivedTime) {
    const approvedSignals = normalizedSignals.filter((s) => s.workflowStatus === 'verified');
    if (approvedSignals.length > 0) {
      const latestTimeline = approvedSignals[0].timeline[approvedSignals[0].timeline.length - 1];
      const timeMatch = /(\d{2}:\d{2})/.exec(latestTimeline?.time || '');
      if (timeMatch) {
        derivedTime = `${timeMatch[1]} CAT`;
        derivedDateLabel = `Latest approval (${approvedSignals[0].id}) · ${latestTimeline.time}`;
      }
    }
  }

  return {
    ...parsed,
    signals: normalizedSignals,
    verifiedAlerts: normalizedAlerts,
    lastEditorialUpdateTime: derivedTime || '14:20 CAT',
    lastEditorialUpdateDateLabel:
      derivedDateLabel || 'Last editorial desk update (27 Jan 2025) · 0 AI auto-published alerts',
  };
}

function loadInitialPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (
        Array.isArray(parsed.signals) &&
        Array.isArray(parsed.verifiedAlerts) &&
        parsed.briefDraft
      ) {
        return hydrateAndNormalizePersistedState(parsed);
      }
    }
  } catch {
    // Ignore storage read errors in restricted environments
  }
  return {
    signals: INITIAL_SIGNALS,
    verifiedAlerts: INITIAL_VERIFIED_ALERTS,
    briefDraft: INITIAL_WORKING_BRIEF,
    baseSignalOffset: 18,
    baseVerifiedOffset: 6,
    lastEditorialUpdateTime: '14:20 CAT',
    lastEditorialUpdateDateLabel:
      'Last editorial desk update (27 Jan 2025) · 0 AI auto-published alerts',
  };
}

function pickCorridorCoords(roadArea: string, existingCount: number): { xPct: number; yPct: number } {
  const lower = roadArea.toLowerCase();
  const jitter = (existingCount % 4) * 2.2;
  if (lower.includes('a5') || lower.includes('plumtree')) {
    return { xPct: 23 + jitter, yPct: 69 - jitter * 0.6 };
  }
  if (lower.includes('khami') || lower.includes('mzilikazi')) {
    return { xPct: 28 + jitter, yPct: 43 + jitter * 0.5 };
  }
  if (lower.includes('lobengula') || lower.includes('12th') || lower.includes('cbd')) {
    return { xPct: 54 + jitter, yPct: 54 - jitter * 0.5 };
  }
  if (lower.includes('esigodini') || lower.includes('a7')) {
    return { xPct: 76 - jitter, yPct: 75 - jitter * 0.5 };
  }
  if (lower.includes('hillside')) {
    return { xPct: 68 + jitter, yPct: 70 - jitter * 0.5 };
  }
  if (lower.includes('north end') || lower.includes('takawira') || lower.includes('a6')) {
    return { xPct: 58 + jitter, yPct: 26 + jitter * 0.5 };
  }
  return { xPct: 49 + jitter, yPct: 50 + jitter * 0.4 };
}

export const PanziraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [persisted, setPersisted] = useState<PersistedState>(loadInitialPersistedState);
  const runtime = apiService.getRuntime();
  const [backendHealth, setBackendHealth] = useState<BackendHealthResult>(
    runtime.mode === 'demo'
      ? {
          status: 'demo',
          message: 'Local demo mode. Changes stay in this browser and are not published.',
        }
      : {
          status: runtime.configured ? 'offline' : 'misconfigured',
          message: runtime.configured
            ? 'Backend connection has not been confirmed yet.'
            : 'Server mode requires VITE_API_BASE_URL.',
        }
  );

  const [portal, setPortal] = useState<PortalMode>('newsroom');
  const [newsroomView, setNewsroomView] = useState<NewsroomView>('monitor');
  const [publicView, setPublicView] = useState<PublicView>('overview');

  const [newsroomSearch, setNewsroomSearch] = useState('');
  const [publicSearch, setPublicSearch] = useState('');

  const [selectedMonitorId, setSelectedMonitorId] = useState<string>('PZ-SIG-0042');
  const [selectedInboxId, setSelectedInboxId] = useState<string>('PZ-DEMO-0427');
  const [selectedVerifyId, setSelectedVerifyId] = useState<string>('PZ-DEMO-0427');
  const [selectedCorridorId, setSelectedCorridorId] = useState<'A5' | 'KHAMI' | 'ESIGODINI'>('A5');
  const [lastSubmittedReceiptId, setLastSubmittedReceiptId] = useState<string | null>('PZ-DEMO-0427');

  // Session-only reveal state inside the newsroom workspace
  const [revealedGraphicIds, setRevealedGraphicIds] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // Ignore quota errors
    }
  }, [persisted]);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (!hash) return;
      if (
        hash === 'monitor' ||
        hash === 'inbox' ||
        hash === 'verify' ||
        hash === 'hotspots' ||
        hash === 'fleet' ||
        hash === 'briefs' ||
        hash === 'sources'
      ) {
        setPortal('newsroom');
        setNewsroomView(hash);
      } else if (hash === 'public' || hash === 'overview') {
        setPortal('public');
        setPublicView('overview');
      } else if (hash === 'map' || hash === 'alerts' || hash === 'my-reports' || hash === 'report') {
        setPortal('public');
        setPublicView(hash);
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  // Server synchronization runs only when server mode is explicitly configured.
  useEffect(() => {
    if (runtime.mode === 'demo') return;

    let isMounted = true;
    const syncBackend = async (isInitial = false) => {
      try {
        const health = await apiService.checkHealth();
        if (!isMounted) return;
        setBackendHealth(health);
        if (health.status !== 'online') return;

        const liveAlerts = await apiService.fetchPublicAlerts();
        const token = apiService.getToken();
        const [liveSignals, liveBrief] = token
          ? await Promise.all([apiService.fetchSignals(), apiService.fetchWorkingBrief()])
          : [null, null];

        if (isMounted) {
          setPersisted((prev) => {
            return {
              ...prev,
              signals: liveSignals ?? prev.signals,
              verifiedAlerts: liveAlerts,
              briefDraft: liveBrief ?? prev.briefDraft,
            };
          });
          if (isInitial) {
            showToast(
              token
                ? 'Backend connection confirmed. Newsroom data was acknowledged by the server.'
                : 'Backend health confirmed. Sign in to load or change newsroom records.'
            );
          }
        }
      } catch (error) {
        if (isMounted) {
          setBackendHealth({
            status: 'offline',
            message: errorMessage(error, 'Backend synchronization failed.'),
            checkedUrl: runtime.healthUrl,
          });
        }
      }
    };

    syncBackend(true);
    const interval = setInterval(() => syncBackend(false), 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [runtime.healthUrl, runtime.mode]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  const navigateNewsroom = (view: NewsroomView, signalId?: string) => {
    setPortal('newsroom');
    setNewsroomView(view);
    if (signalId) {
      if (view === 'monitor') setSelectedMonitorId(signalId);
      if (view === 'inbox') setSelectedInboxId(signalId);
      if (view === 'verify') setSelectedVerifyId(signalId);
    }
    window.history.replaceState(null, '', `#${view}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigatePublic = (view: PublicView) => {
    setPortal('public');
    setPublicView(view);
    window.history.replaceState(null, '', `#${view === 'overview' ? 'public' : view}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitCitizenReport = async (input: NewCitizenReportInput): Promise<SignalReport> => {
    // Defense-in-depth date/time validation & normalization
    const dateCheck = validateObservedDateTime(input.observedIso || input.reportedDateTime);
    const now = new Date();
    const validDate = dateCheck.valid && dateCheck.date ? dateCheck.date : now;
    const normalizedReadable = formatHarareDateTime(validDate);
    const intakeTimeReadable = formatHarareDateTime(now);
    const tShort = `${formatHarareShortTime(now)} CAT`;

    // Ensure unique non-colliding PZ-DEMO-0XXX ID preserving PZ-DEMO-0430, PZ-DEMO-0431, etc.
    const existingDemoNums = persisted.signals
      .map((s) => {
        const m = /^PZ-DEMO-(\d+)$/.exec(s.id);
        return m ? Number(m[1]) : 0;
      })
      .filter((n) => n >= 427);
    const nextNum = Math.max(429, ...existingDemoNums) + 1;
    const newId = `PZ-DEMO-${String(nextNum).padStart(4, '0')}`;
    const invCode = `ROADS-${String(nextNum).padStart(4, '0')}`;

    const hasPhoto = input.photoType !== 'none';
    const isGraphic = Boolean(
      hasPhoto && (input.containsGraphicContent || input.categoryKey === 'collisions')
    );

    const coords = pickCorridorCoords(input.roadArea, persisted.signals.length);

    const newSignal: SignalReport = {
      id: newId,
      investigationCode: invCode,
      sourceChannelLabel: 'Citizen web',
      sourceChannelShort: 'Citizen web (opt-in)',
      sourceBadgeColor: isGraphic ? 'red' : 'green',
      visibility: 'opt-in',
      workflowStatus: 'lead',
      monitorStatusLabel: isGraphic ? 'Graphic restricted' : 'Unverified lead',
      monitorStatusColor: isGraphic ? 'red' : 'gold',
      inboxStatusLine: isGraphic
        ? 'Citizen web · Graphic restricted'
        : 'Citizen web · Unverified lead',
      timeShort: tShort,
      reportedDateTime: normalizedReadable,
      observedIso: validDate.toISOString(),
      title: `${input.categoryLabel} · ${input.roadArea}`,
      inboxTitle: `${input.categoryLabel} · ${input.roadArea}`,
      subtitle: `${input.landmark} · Citizen demo report`,
      corridor: input.roadArea,
      roadArea: input.roadArea,
      landmark: input.landmark,
      categoryKey: input.categoryKey,
      categoryLabel: input.categoryLabel,
      severityLabel:
        input.categoryKey === 'collisions' || input.categoryKey === 'flooding'
          ? 'High'
          : 'Review needed',
      isCritical: input.categoryKey === 'collisions',
      originalLanguage: input.language,
      originalQuote: `“${input.description.trim()}”`,
      draftEnglishTranslation:
        input.language !== 'English'
          ? 'Draft translation queued — requires fluent human editor review before corroboration.'
          : undefined,
      sourceProvenanceNote: `Citizen web opt-in submission • Observed ${normalizedReadable} • Received ${intakeTimeReadable} • contributor identity unconfirmed`,
      evidenceLink: input.evidenceLink?.trim() || undefined,
      aiHazardType: input.categoryLabel,
      aiLikelyCorridor: input.roadArea,
      aiLanguageNote:
        input.language === 'English'
          ? 'English • citizen web submission'
          : `${input.language} → English • human translation check needed`,
      aiLocationPrecision: 'Reporter landmark description · GPS unverified',
      aiConfidencePercent: hasPhoto ? 66 : 52,
      aiConfidenceNote: `${hasPhoto ? 66 : 52}% • insufficient to publish`,
      aiImageHeading: isGraphic
        ? 'Potentially graphic submission — blurred for editorial safety'
        : hasPhoto
          ? `Submitted photo (${input.photoFilename || 'citizen-upload.jpg'})`
          : 'Text-only submission (no photo attached)',
      aiImageSummary: isGraphic
        ? 'Attachment restricted behind newsroom blur gate. Never displayed on the public dashboard.'
        : hasPhoto
          ? 'Uploaded image queued for metadata and landmark corroboration.'
          : 'Submitted without a photograph (low-bandwidth mode). Editors corroborate via independent witnesses or on-site checks.',
      aiImageCaveat:
        'Computer vision and metadata checks cannot establish location or recency without human verification.',
      photoType: input.photoType,
      customPhotoDataUrl: input.customPhotoDataUrl,
      photoFilename: input.photoFilename,
      photoCaption: hasPhoto
        ? `Citizen web upload (${newId}): ${input.photoFilename || 'photo.jpg'}. Capture time and exact coordinates unconfirmed.`
        : undefined,
      isGraphicImage: isGraphic,
      graphicSafetyReason: isGraphic
        ? 'Flagged as collision / potentially distressing imagery on intake. Blurred by default in the newsroom workspace and permanently excluded from public display.'
        : undefined,
      pipelineStage: 2,
      missingItems: [
        'Independent confirmation of the hazard',
        'Precise landmark or GPS coordinate check',
        hasPhoto
          ? 'Image capture date & provenance check'
          : 'Second independent witness or authority check',
      ],
      checklist: {
        locationAndTime: false,
        mediaAndDate: false,
        independentSource: false,
        hazardStillPresent: false,
      },
      editorialNotes: '',
      unconfirmedSummary: `Citizen demo submission reporting ${input.categoryLabel.toLowerCase()} at ${input.roadArea} (${input.landmark}). Pending independent editorial verification.`,
      duplicateCandidates: [],
      timeline: [
        {
          time: intakeTimeReadable,
          description: `Citizen demo report (${newId}, observed ${normalizedReadable}) received via web form. Held off public map pending human verification.`,
        },
      ],
      isUserSubmitted: true,
      mapCoords: coords,
      reportedLat: input.reportedLat,
      reportedLng: input.reportedLng,
      gpsReported: input.reportedLat !== undefined && input.reportedLng !== undefined,
    };

    if (runtime.mode === 'server') {
      try {
        return await commitAfterServerAcknowledgement(
          () => apiService.submitCitizenReport(input),
          (serverSignal) => {
            setPersisted((prev) => ({
              ...prev,
              signals: [
                serverSignal,
                ...prev.signals.filter((signal) => signal.id !== serverSignal.id),
              ],
            }));
            setLastSubmittedReceiptId(serverSignal.id);
            setSelectedMonitorId(serverSignal.id);
            setSelectedInboxId(serverSignal.id);
            setSelectedVerifyId(serverSignal.id);
            showToast(
              `Server acknowledged report ${serverSignal.id}. It is queued for editorial verification and is not public.`
            );
          }
        );
      } catch (error) {
        showToast(
          `Submission failed: ${errorMessage(error, 'the backend did not acknowledge the report')}. Nothing was queued.`
        );
        throw error;
      }
    }

    setPersisted((prev) => ({
      ...prev,
      signals: [newSignal, ...prev.signals],
    }));
    setLastSubmittedReceiptId(newId);
    setSelectedMonitorId(newId);
    setSelectedInboxId(newId);
    setSelectedVerifyId(newId);
    showToast(
      `Demo-only report ${newId} stored in this browser. It was not sent to a server or published.`
    );
    return newSignal;
  };

  const toggleChecklist = async (
    signalId: string,
    field: keyof VerificationChecklist
  ): Promise<boolean> => {
    if (runtime.mode === 'server') {
      try {
        await commitAfterServerAcknowledgement(
          () => apiService.toggleChecklist(signalId, field),
          (serverSignal) => {
            setPersisted((prev) => ({
              ...prev,
              signals: prev.signals.map((signal) =>
                signal.id === signalId ? serverSignal : signal
              ),
            }));
          }
        );
        return true;
      } catch (error) {
        showToast(
          `Checklist change failed: ${errorMessage(error, 'the backend did not acknowledge it')}. The check was not changed.`
        );
        return false;
      }
    }

    setPersisted((prev) => ({
      ...prev,
      signals: prev.signals.map((sig) => {
        if (sig.id !== signalId) return sig;
        const nextChecklist = {
          ...sig.checklist,
          [field]: !sig.checklist[field],
        };
        const metCount = Object.values(nextChecklist).filter(Boolean).length;
        const nextStage: 1 | 2 | 3 | 4 =
          sig.workflowStatus === 'verified' ? 4 : metCount > 0 ? 3 : sig.pipelineStage;
        const nextWorkflow =
          sig.workflowStatus === 'lead' && metCount > 0 ? 'verifying' : sig.workflowStatus;

        return {
          ...sig,
          checklist: nextChecklist,
          pipelineStage: nextStage,
          workflowStatus: nextWorkflow,
          monitorStatusLabel:
            nextWorkflow === 'verified'
              ? 'Verified'
              : metCount === 4
                ? 'Ready for editor gate'
                : sig.monitorStatusLabel,
        };
      }),
    }));
    return true;
  };

  const updateEditorialNotes = async (signalId: string, notes: string): Promise<boolean> => {
    if (runtime.mode === 'server') {
      try {
        await commitAfterServerAcknowledgement(
          () => apiService.updateNotes(signalId, notes),
          (serverSignal) => {
            setPersisted((prev) => ({
              ...prev,
              signals: prev.signals.map((signal) =>
                signal.id === signalId ? serverSignal : signal
              ),
            }));
          }
        );
        showToast(`Server saved editorial notes for ${signalId}.`);
        return true;
      } catch (error) {
        showToast(
          `Notes were not saved: ${errorMessage(error, 'the backend did not acknowledge them')}.`
        );
        return false;
      }
    }

    setPersisted((prev) => ({
      ...prev,
      signals: prev.signals.map((sig) =>
        sig.id === signalId ? { ...sig, editorialNotes: notes } : sig
      ),
    }));
    showToast(`Demo-only notes for ${signalId} stored in this browser.`);
    return true;
  };

  const requestEvidence = async (signalId: string, note?: string): Promise<boolean> => {
    if (runtime.mode === 'server') {
      try {
        await commitAfterServerAcknowledgement(
          () => apiService.requestEvidence(signalId, note),
          (serverSignal) => {
            setPersisted((prev) => ({
              ...prev,
              signals: prev.signals.map((signal) =>
                signal.id === signalId ? serverSignal : signal
              ),
            }));
          }
        );
        showToast(`Server logged the evidence request for ${signalId}.`);
        return true;
      } catch (error) {
        showToast(
          `Evidence request failed: ${errorMessage(error, 'the backend did not acknowledge it')}.`
        );
        return false;
      }
    }

    const stamp = formatHarareDateTime(new Date());
    setPersisted((prev) => ({
      ...prev,
      signals: prev.signals.map((sig) => {
        if (sig.id !== signalId) return sig;
        return {
          ...sig,
          workflowStatus: 'verifying',
          monitorStatusLabel: 'Evidence requested',
          monitorStatusColor: 'gold',
          inboxStatusLine: `${sig.sourceChannelLabel} · Evidence requested`,
          pipelineStage: 3,
          timeline: [
            ...sig.timeline,
            {
              time: stamp,
              description:
                note?.trim() ||
                'Editor Rudo Moyo requested exact landmark, capture timestamp, and independent corroboration.',
            },
          ],
        };
      }),
    }));
    showToast(`Demo-only evidence request for ${signalId} stored in this browser.`);
    return true;
  };

  const rejectSignal = async (signalId: string, reason?: string): Promise<boolean> => {
    if (runtime.mode === 'server') {
      try {
        await commitAfterServerAcknowledgement(
          () => apiService.rejectSignal(signalId, reason),
          (serverSignal) => {
            setPersisted((prev) => ({
              ...prev,
              signals: prev.signals.map((signal) =>
                signal.id === signalId ? serverSignal : signal
              ),
            }));
          }
        );
        showToast(`Server confirmed that ${signalId} was rejected and withheld.`);
        return true;
      } catch (error) {
        showToast(
          `Rejection failed: ${errorMessage(error, 'the backend did not acknowledge it')}. The signal was not changed.`
        );
        return false;
      }
    }

    const stamp = formatHarareDateTime(new Date());
    setPersisted((prev) => ({
      ...prev,
      signals: prev.signals.map((sig) => {
        if (sig.id !== signalId) return sig;
        return {
          ...sig,
          workflowStatus: 'rejected',
          monitorStatusLabel: 'Rejected · Archived',
          monitorStatusColor: 'red',
          inboxStatusLine: `${sig.sourceChannelLabel} · Rejected`,
          timeline: [
            ...sig.timeline,
            {
              time: stamp,
              description:
                reason?.trim() ||
                'Rejected by Editor Rudo Moyo — uncorroborated or insufficient location evidence. Withheld from public map.',
            },
          ],
        };
      }),
    }));
    showToast(`Demo-only rejection for ${signalId} stored in this browser.`);
    return true;
  };

  const verifySignal = async (signalId: string): Promise<boolean> => {
    const target = persisted.signals.find((s) => s.id === signalId);
    if (!target) return false;
    const allChecked = isFourCheckGateComplete(target.checklist);
    if (!allChecked) {
      showToast(
        'Editor approval gate: Complete all 4 independent verification checks before verifying.'
      );
      return false;
    }

    if (runtime.mode === 'server') {
      try {
        await commitAfterServerAcknowledgement(
          async () => {
            const serverSignal = await apiService.verifySignal(signalId);
            const serverAlerts = await apiService.fetchPublicAlerts();
            const publishedAlert = serverAlerts.find(
              (alert) => alert.sourceSignalId === signalId
            );
            if (serverSignal.workflowStatus !== 'verified' || !publishedAlert) {
              throw new Error(
                'The backend response did not confirm both verification and public-alert persistence.'
              );
            }
            return { serverSignal, serverAlerts, publishedAlert };
          },
          ({ serverSignal, serverAlerts, publishedAlert }) => {
            setPersisted((prev) => ({
              ...prev,
              lastEditorialUpdateIso: publishedAlert.approvedAtIso,
              lastEditorialUpdateTime: publishedAlert.approvedAtReadable,
              lastEditorialUpdateDateLabel: `Server-confirmed approval ${publishedAlert.approvedAtReadable} (${signalId}) · 0 AI auto-published alerts`,
              signals: prev.signals.map((signal) =>
                signal.id === signalId ? serverSignal : signal
              ),
              verifiedAlerts: serverAlerts,
            }));
          }
        );
        showToast(
          `Backend confirmed the 4-check editor approval and persisted public alert for ${signalId}.`
        );
        return true;
      } catch (error) {
        showToast(
          `Approval was not confirmed: ${errorMessage(error, 'the backend did not acknowledge publication')}. No local public alert was added. If the request may have reached the server, refresh before retrying.`
        );
        return false;
      }
    }

    const approvedNow = new Date();
    const readableApproval = formatHarareDateTime(approvedNow);
    const shortApprovalTime = `${formatHarareShortTime(approvedNow)} CAT`;

    setPersisted((prev) => {
      const alreadyPublished = prev.verifiedAlerts.some((a) => a.sourceSignalId === signalId);
      const newPublicAlert: VerifiedPublicAlert = {
        id: `PZ-DEMO-PUB-${signalId}`,
        sourceSignalId: signalId,
        title: target.inboxTitle || target.title,
        location: `${target.roadArea}${target.landmark ? ` (${target.landmark})` : ''}`,
        corridor: target.corridor,
        categoryKey: target.categoryKey,
        categoryLabel: target.categoryLabel,
        severity:
          target.isCritical || target.severityLabel === 'Critical'
            ? 'Critical severity'
            : target.severityLabel === 'High'
              ? 'High severity'
              : 'Moderate severity',
        isCritical: Boolean(target.isCritical || target.severityLabel === 'High'),
        updatedAgo: `Approved ${readableApproval}`,
        approvedAtIso: approvedNow.toISOString(),
        approvedAtReadable: readableApproval,
        // Graphic images are strictly withheld from public alerts even after verification
        description: `Demo-only simulated alert. ${target.categoryLabel}: Independently corroborated road hazard at ${target.roadArea} (${target.landmark}).${
          target.isGraphicImage
            ? ' Submitted scene imagery withheld under Panzira editorial graphic-safety policy.'
            : ''
        }`,
        sourceAttribution: `Local demo simulation · 4/4 editorial checks · Simulated approval by Rudo Moyo on ${readableApproval}`,
        lat: target.gpsReported ? target.reportedLat : undefined,
        lng: target.gpsReported ? target.reportedLng : undefined,
        desktopPin: {
          xPct: target.mapCoords.xPct,
          yPct: target.mapCoords.yPct,
          pinAsset:
            target.categoryKey === 'flooding'
              ? 'pinVerified2'
              : target.categoryKey === 'collisions'
                ? 'pinVerified0'
                : 'pinVerified1',
        },
      };

      return {
        ...prev,
        lastEditorialUpdateIso: approvedNow.toISOString(),
        lastEditorialUpdateTime: shortApprovalTime,
        lastEditorialUpdateDateLabel: `Demo-only simulated approval ${readableApproval} (${signalId}) · 0 AI auto-published alerts`,
        signals: prev.signals.map((sig) => {
          if (sig.id !== signalId) return sig;
          return {
            ...sig,
            workflowStatus: 'verified',
            monitorStatusLabel: 'Verified · Approved',
            monitorStatusColor: 'green',
            inboxStatusLine: `${sig.sourceChannelLabel} · Verified`,
            pipelineStage: 4,
            missingItems: [],
            timeline: [
              ...sig.timeline,
              {
                time: readableApproval,
                description:
                  'Demo-only simulation: 4/4 checks completed and a local alert preview created. Nothing was published or sent.',
              },
            ],
          };
        }),
        verifiedAlerts: alreadyPublished
          ? prev.verifiedAlerts
          : [newPublicAlert, ...prev.verifiedAlerts],
      };
    });

    showToast(
      `Demo-only approval simulated for ${signalId}. A browser-local alert preview was created; no server, public feed, or integration was contacted.`
    );
    return true;
  };

  const toggleGraphicReveal = (signalId: string) => {
    setRevealedGraphicIds((prev) => {
      const nextVal = !prev[signalId];
      return { ...prev, [signalId]: nextVal };
    });
  };

  const updateBriefField = <K extends keyof WorkingBriefDraft>(
    key: K,
    value: WorkingBriefDraft[K]
  ) => {
    setPersisted((prev) => ({
      ...prev,
      briefDraft: {
        ...prev.briefDraft,
        [key]: value,
      },
    }));
  };

  const saveBriefDraft = async (): Promise<boolean> => {
    const stamp = formatHarareDateTime(new Date());

    if (runtime.mode === 'server') {
      try {
        await commitAfterServerAcknowledgement(
          () => apiService.saveWorkingBrief(persisted.briefDraft),
          (serverBrief) => {
            setPersisted((prev) => ({ ...prev, briefDraft: serverBrief }));
          }
        );
        showToast('Server acknowledged the investigative brief draft.');
        return true;
      } catch (error) {
        showToast(
          `Brief was not saved: ${errorMessage(error, 'the backend did not acknowledge it')}.`
        );
        return false;
      }
    }

    setPersisted((prev) => ({
      ...prev,
      briefDraft: {
        ...prev.briefDraft,
        lastSavedAt: `Saved ${stamp} (local demo draft)`,
      },
    }));
    showToast('Demo-only brief draft stored in this browser.');
    return true;
  };

  const openWorkingBriefForSignal = (signalId: string) => {
    const sig = persisted.signals.find((s) => s.id === signalId);
    if (sig && sig.id !== 'PZ-DEMO-0427') {
      setPersisted((prev) => ({
        ...prev,
        briefDraft: {
          ...prev.briefDraft,
          investigationId: sig.investigationCode,
          title: `${sig.inboxTitle || sig.title}: verification questions for ${sig.corridor}`,
          dek: `Incoming ${sig.sourceChannelShort} submission (${sig.id}) reports ${sig.categoryLabel.toLowerCase()} near ${sig.landmark}. Location precision and impact claims remain under editorial review.`,
          lead: `A report observed at ${sig.reportedDateTime} describes ${sig.categoryLabel.toLowerCase()} along ${sig.roadArea} [${sig.id}].${
            sig.workflowStatus === 'verified'
              ? ' Core hazard details have been independently verified by the desk.'
              : ' This account is an investigative lead, not an established fact.'
          }`,
          lastSavedAt: null,
        },
      }));
    }
    navigateNewsroom('briefs');
  };

  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setPersisted({
      signals: INITIAL_SIGNALS,
      verifiedAlerts: INITIAL_VERIFIED_ALERTS,
      briefDraft: INITIAL_WORKING_BRIEF,
      baseSignalOffset: 18,
      baseVerifiedOffset: 6,
      lastEditorialUpdateTime: '14:20 CAT',
      lastEditorialUpdateDateLabel:
        'Last editorial desk update (27 Jan 2025) · 0 AI auto-published alerts',
    });
    setRevealedGraphicIds({});
    setSelectedMonitorId('PZ-SIG-0042');
    setSelectedInboxId('PZ-DEMO-0427');
    setSelectedVerifyId('PZ-DEMO-0427');
    setNewsroomSearch('');
    setPublicSearch('');
    showToast('Demo data reset to initial Panzira AI baseline.');
  };

  const counts = useMemo(() => {
    const userAdded = persisted.signals.filter((s) => s.isUserSubmitted).length;
    const totalSignalsCount = 24 + userAdded;
    const publicSignalsCount =
      9 + persisted.signals.filter((s) => s.isUserSubmitted && s.visibility === 'public').length;
    const optInSignalsCount = totalSignalsCount - publicSignalsCount;

    const activeUnverifiedDelta =
      persisted.signals.filter(
        (s) => s.workflowStatus === 'lead' || s.workflowStatus === 'verifying'
      ).length -
      INITIAL_SIGNALS.filter(
        (s) => s.workflowStatus === 'lead' || s.workflowStatus === 'verifying'
      ).length;
    const awaitingReviewCount = Math.max(0, 8 + activeUnverifiedDelta);

    const newlyVerifiedCount =
      persisted.verifiedAlerts.length - INITIAL_VERIFIED_ALERTS.length;
    const approvedAlertsCount = 12 + Math.max(0, newlyVerifiedCount);

    return {
      totalSignalsCount,
      publicSignalsCount,
      optInSignalsCount,
      awaitingReviewCount,
      approvedAlertsCount,
    };
  }, [persisted.signals, persisted.verifiedAlerts]);

  return (
    <PanziraContext.Provider
      value={{
        portal,
        newsroomView,
        publicView,
        navigateNewsroom,
        navigatePublic,
        newsroomSearch,
        setNewsroomSearch,
        publicSearch,
        setPublicSearch,
        signals: persisted.signals,
        verifiedAlerts: persisted.verifiedAlerts,
        corridors: CORRIDOR_WATCHLIST,
        briefDraft: persisted.briefDraft,
        totalSignalsCount: counts.totalSignalsCount,
        publicSignalsCount: counts.publicSignalsCount,
        optInSignalsCount: counts.optInSignalsCount,
        awaitingReviewCount: counts.awaitingReviewCount,
        approvedAlertsCount: counts.approvedAlertsCount,
        autoPublishedByAiCount: 0,
        lastEditorialUpdateTime: persisted.lastEditorialUpdateTime || '14:20 CAT',
        lastEditorialUpdateDateLabel:
          persisted.lastEditorialUpdateDateLabel ||
          'Last editorial desk update (27 Jan 2025) · 0 AI auto-published alerts',
        selectedMonitorId,
        setSelectedMonitorId,
        selectedInboxId,
        setSelectedInboxId,
        selectedVerifyId,
        setSelectedVerifyId,
        selectedCorridorId,
        setSelectedCorridorId,
        lastSubmittedReceiptId,
        backendMode: runtime.mode,
        backendHealth,
        submitCitizenReport,
        toggleChecklist,
        updateEditorialNotes,
        requestEvidence,
        rejectSignal,
        verifySignal,
        revealedGraphicIds,
        toggleGraphicReveal,
        updateBriefField,
        saveBriefDraft,
        openWorkingBriefForSignal,
        toastMessage,
        dismissToast: () => setToastMessage(null),
        resetDemoData,
      }}
    >
      {children}
    </PanziraContext.Provider>
  );
};

export function usePanzira(): PanziraContextValue {
  const ctx = useContext(PanziraContext);
  if (!ctx) throw new Error('usePanzira must be used within PanziraProvider');
  return ctx;
}
