import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  CORRIDOR_WATCHLIST,
  INITIAL_SIGNALS,
  INITIAL_VERIFIED_ALERTS,
  INITIAL_WORKING_BRIEF,
} from '../data/seedData';
import {
  AuthTab,
  AuthUser,
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
import { apiService } from '../services/api';

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
  licenseTier?: 'safety_only' | 'free_attribution' | 'commercial_pool';
  attributionMode?: 'full_name' | 'handle' | 'anonymous';
}

export interface ClaimedReportRecord {
  reference: string;
  title: string;
  statusLabel: string;
  statusTone: 'live' | 'investigating';
  timestamp: string;
  completedStep: 1 | 2 | 3 | 4;
  licenseTier: 'commercial_pool' | 'safety_only' | 'free_attribution';
  attributionMode: 'handle' | 'anonymous' | 'full_name';
  claimPin?: string;
  imageUrl?: string;
}

export interface LastRoyaltyActivity {
  signalId: string;
  mediaHouse: string;
  licenseType: 'standard' | 'exclusive';
  grossUsd: number;
  citizenShareUsd: number;
  headline: string;
  subtitle: string;
  timestamp: string;
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
  royaltyBalanceUsd?: number;
  claimedReports?: ClaimedReportRecord[];
  lastRoyaltyActivity?: LastRoyaltyActivity | null;
}

interface PanziraContextValue {
  // Navigation & Auth
  portal: PortalMode;
  newsroomView: NewsroomView;
  publicView: PublicView;
  authTab: AuthTab;
  setAuthTab: (tab: AuthTab) => void;
  currentUser: AuthUser | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
  authPromptMessage: string | null;
  setAuthPromptMessage: (msg: string | null) => void;
  quickDemoLogin: (persona: 'guest' | 'citizen' | 'journalist' | 'admin') => Promise<void>;
  navigateNewsroom: (view: NewsroomView, signalId?: string) => void;
  navigatePublic: (view: PublicView) => void;
  navigateAuth: (tab?: AuthTab) => void;
  navigateCitizen: () => void;
  navigateAdmin: () => void;
  logoutUser: () => void;
  showToast: (msg: string) => void;

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
  lastSubmittedClaimPin: string | null;
  pendingClaimPrefill: { reference: string; pin: string } | null;
  setPendingClaimPrefill: (val: { reference: string; pin: string } | null) => void;
  royaltyBalanceUsd: number;
  claimedReports: ClaimedReportRecord[];
  lastRoyaltyActivity: LastRoyaltyActivity | null;

  // Editorial & Citizen Actions
  submitCitizenReport: (input: NewCitizenReportInput) => SignalReport;
  claimReportInSession: (input: {
    reference: string;
    claimPin: string;
    licenseTier?: 'commercial_pool' | 'safety_only' | 'free_attribution';
    attributionMode?: 'handle' | 'anonymous' | 'full_name';
    contributorId?: number | null;
    contributorHandle?: string;
  }) => ClaimedReportRecord | null;
  cashOutRoyalties: () => { amountUsd: number; receiptCode: string } | null;
  toggleChecklist: (signalId: string, field: keyof VerificationChecklist) => void;
  updateEditorialNotes: (signalId: string, notes: string) => void;
  requestEvidence: (signalId: string, note?: string) => void;
  rejectSignal: (signalId: string, reason?: string) => void;
  verifySignal: (signalId: string) => boolean;
  claimSignalLock: (signalId: string, simulateOtherJournalist?: boolean) => Promise<void>;
  releaseSignalLock: (signalId: string) => Promise<void>;
  toggleVisualAiCheck: (signalId: string) => Promise<void>;
  toggleTranslationVerified: (signalId: string) => Promise<void>;
  licenseSignalMedia: (
    signalId: string,
    licenseType: 'standard' | 'exclusive',
    mediaHouse?: string
  ) => Promise<void>;
  togglePiiRedaction: (signalId: string) => void;
  simulateChannelIntake: (
    channel: 'ussd' | 'whatsapp' | 'telegram',
    payload: {
      phone?: string;
      corridor: string;
      landmark: string;
      categoryKey: HazardCategoryKey;
      categoryLabel: string;
      description: string;
      language?: 'English' | 'Shona' | 'Ndebele';
      hasPhoto?: boolean;
      flaggedAiDemo?: boolean;
    }
  ) => Promise<SignalReport>;

  // Graphic safety (session-scoped reveal inside newsroom workspace only)
  revealedGraphicIds: Record<string, boolean>;
  toggleGraphicReveal: (signalId: string) => void;

  // Brief actions
  updateBriefField: <K extends keyof WorkingBriefDraft>(
    key: K,
    value: WorkingBriefDraft[K]
  ) => void;
  saveBriefDraft: () => void;
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
      ...seedMatch,
      ...sig,
      sourceChannelLabel: normalizeSentenceCaseLabel(sig.sourceChannelLabel),
      monitorStatusLabel: normalizeSentenceCaseLabel(sig.monitorStatusLabel),
      inboxStatusLine: normalizeSentenceCaseLabel(sig.inboxStatusLine),
      aiImageHeading: fixedImageHeading,
      mapCoords: seedMatch ? seedMatch.mapCoords : sig.mapCoords,
      licenseTier: sig.licenseTier ?? seedMatch?.licenseTier,
      attributionMode: sig.attributionMode ?? seedMatch?.attributionMode,
      claimPin: sig.claimPin ?? seedMatch?.claimPin,
      aiScanVerdict: sig.aiScanVerdict ?? seedMatch?.aiScanVerdict,
      aiScanSummary: sig.aiScanSummary ?? seedMatch?.aiScanSummary,
      exifSummary: sig.exifSummary ?? seedMatch?.exifSummary,
      commercialEligible: sig.commercialEligible ?? seedMatch?.commercialEligible,
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
    royaltyBalanceUsd:
      typeof parsed.royaltyBalanceUsd === 'number' && parsed.royaltyBalanceUsd >= 0
        ? parsed.royaltyBalanceUsd
        : 16.0,
    claimedReports: Array.isArray(parsed.claimedReports) ? parsed.claimedReports : [],
    lastRoyaltyActivity: parsed.lastRoyaltyActivity ?? null,
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
    royaltyBalanceUsd: 16.0,
    claimedReports: [],
    lastRoyaltyActivity: null,
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

  const [portal, setPortal] = useState<PortalMode>('public');
  const [newsroomView, setNewsroomView] = useState<NewsroomView>('inbox');
  const [publicView, setPublicView] = useState<PublicView>('overview');
  const [authTab, setAuthTab] = useState<AuthTab>('signin');
  // Always start as an unauthenticated Guest by default on initial load
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      localStorage.removeItem('panzira_auth_user');
      apiService.setToken(null);
    } catch {
      // Ignore storage errors
    }
    return null;
  });
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('panzira_auth_user', JSON.stringify(currentUser));
      } else {
        localStorage.removeItem('panzira_auth_user');
      }
    } catch {
      // Ignore storage errors
    }
  }, [currentUser]);

  const [newsroomSearch, setNewsroomSearch] = useState('');
  const [publicSearch, setPublicSearch] = useState('');

  const [selectedMonitorId, setSelectedMonitorId] = useState<string>('PZ-SIG-0042');
  const [selectedInboxId, setSelectedInboxId] = useState<string>('PZ-DEMO-0427');
  const [selectedVerifyId, setSelectedVerifyId] = useState<string>('PZ-DEMO-0427');
  const [selectedCorridorId, setSelectedCorridorId] = useState<'A5' | 'KHAMI' | 'ESIGODINI'>('A5');
  const [lastSubmittedReceiptId, setLastSubmittedReceiptId] = useState<string | null>('PZ-DEMO-0427');
  const [lastSubmittedClaimPin, setLastSubmittedClaimPin] = useState<string | null>('4920');
  const [pendingClaimPrefill, setPendingClaimPrefill] = useState<{
    reference: string;
    pin: string;
  } | null>(null);

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
        if (!currentUser || currentUser.role === 'citizen') {
          setAuthPromptMessage(
            'Sign in with an accredited Press or Editorial account to enter the Newsroom (or select a 1-click demo persona below).'
          );
          setAuthTab('signin');
          setPortal('auth');
          window.history.replaceState(null, '', '#signin');
          return;
        }
        setPortal('newsroom');
        setNewsroomView(hash);
      } else if (hash === 'auth' || hash === 'signin') {
        setPortal('auth');
        setAuthTab('signin');
      } else if (hash === 'signup' || hash === 'citizen-signup') {
        setPortal('auth');
        setAuthTab('citizen-signup');
      } else if (hash === 'press-apply' || hash === 'journalist-apply') {
        setPortal('auth');
        setAuthTab('journalist-apply');
      } else if (hash === 'citizen' || hash === 'vault') {
        if (!currentUser) {
          setAuthPromptMessage(
            'Sign in with an accredited Press or Editorial account to enter the Newsroom (or select a 1-click demo persona below).'
          );
          setAuthTab('signin');
          setPortal('auth');
          window.history.replaceState(null, '', '#signin');
          return;
        }
        setPortal('citizen');
      } else if (hash === 'admin') {
        if (!currentUser || currentUser.role !== 'admin') {
          setAuthPromptMessage(
            'Sign in with an accredited Press or Editorial account to enter the Newsroom (or select a 1-click demo persona below).'
          );
          setAuthTab('signin');
          setPortal('auth');
          window.history.replaceState(null, '', '#signin');
          return;
        }
        setPortal('admin');
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
  }, [currentUser]);

  // Live Python Backend Synchronization & Periodic Polling (no forced auto-login)
  useEffect(() => {
    let isMounted = true;
    const syncBackend = async (isInitial = false) => {
      try {
        const isHealthy = await apiService.checkHealth();
        if (!isHealthy || !isMounted) return;

        if (isInitial && apiService.getToken()) {
          apiService
            .fetchCurrentUser()
            .then((u) => {
              if (isMounted) setCurrentUser(u);
            })
            .catch(() => {
              apiService.setToken(null);
              if (isMounted) setCurrentUser(null);
            });
        }

        const hasToken = Boolean(apiService.getToken());
        const [liveSignals, liveAlerts, liveBrief] = await Promise.all([
          hasToken ? apiService.fetchSignals().catch(() => null) : Promise.resolve(null),
          apiService.fetchPublicAlerts().catch(() => null),
          hasToken ? apiService.fetchWorkingBrief().catch(() => null) : Promise.resolve(null),
        ]);

        if (isMounted) {
          setPersisted((prev) => {
            return {
              ...prev,
              signals: liveSignals && liveSignals.length > 0 ? liveSignals : prev.signals,
              verifiedAlerts:
                liveAlerts && liveAlerts.length > 0 ? liveAlerts : prev.verifiedAlerts,
              briefDraft: liveBrief ? liveBrief : prev.briefDraft,
            };
          });
          if (isInitial) {
            showToast('Live Python backend connected (SQLite database active).');
          }
        }
      } catch {
        // Gracefully use local state if backend is offline
      }
    };

    syncBackend(true);
    const interval = setInterval(() => syncBackend(false), 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  const navigateNewsroom = (view: NewsroomView, signalId?: string) => {
    if (!currentUser || currentUser.role === 'citizen') {
      setAuthPromptMessage(
        'Sign in with an accredited Press or Editorial account to enter the Newsroom (or select a 1-click demo persona below).'
      );
      setAuthTab('signin');
      setPortal('auth');
      window.history.replaceState(null, '', '#signin');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setAuthPromptMessage(null);
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
    setAuthPromptMessage(null);
    setPortal('public');
    setPublicView(view);
    window.history.replaceState(null, '', `#${view === 'overview' ? 'public' : view}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateAuth = (tab: AuthTab = 'signin') => {
    setAuthTab(tab);
    setPortal('auth');
    window.history.replaceState(null, '', `#${tab}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateCitizen = () => {
    if (!currentUser) {
      setAuthPromptMessage(
        'Sign in with an accredited Press or Editorial account to enter the Newsroom (or select a 1-click demo persona below).'
      );
      setAuthTab('signin');
      setPortal('auth');
      window.history.replaceState(null, '', '#signin');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setAuthPromptMessage(null);
    setPortal('citizen');
    window.history.replaceState(null, '', '#citizen');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateAdmin = () => {
    if (!currentUser || currentUser.role !== 'admin') {
      setAuthPromptMessage(
        'Sign in with an accredited Press or Editorial account to enter the Newsroom (or select a 1-click demo persona below).'
      );
      setAuthTab('signin');
      setPortal('auth');
      window.history.replaceState(null, '', '#signin');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setAuthPromptMessage(null);
    setPortal('admin');
    window.history.replaceState(null, '', '#admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const logoutUser = () => {
    apiService.setToken(null);
    setCurrentUser(null);
    setAuthPromptMessage(null);
    setPortal('public');
    setPublicView('overview');
    window.history.replaceState(null, '', '#public');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Signed out · Viewing as Guest (Public).');
  };

  const quickDemoLogin = async (persona: 'guest' | 'citizen' | 'journalist' | 'admin') => {
    setAuthPromptMessage(null);
    if (persona === 'guest') {
      apiService.setToken(null);
      setCurrentUser(null);
      setPortal('public');
      setPublicView('overview');
      window.history.replaceState(null, '', '#public');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast('Switched to Guest (Public) view.');
      return;
    }

    const credentialsMap = {
      citizen: {
        email: 'tariro@citizen.co.zw',
        password: 'panzira2026',
        fallbackUser: {
          id: 101,
          email: 'tariro@citizen.co.zw',
          full_name: 'Tariro Moyo',
          role: 'citizen' as const,
          handle: '@TariroOnTheRoad',
          phone: '+263 77 412 8901',
          verification_status: 'verified',
          royalty_balance_usd: 16.0,
        },
      },
      journalist: {
        email: 'nqobile@chronicle.co.zw',
        password: 'panzira2026',
        fallbackUser: {
          id: 102,
          email: 'nqobile@chronicle.co.zw',
          full_name: 'Nqobile Dube',
          role: 'journalist' as const,
          media_house: 'The Chronicle',
          zmc_number: 'ZMC-2026-0418',
          verification_status: 'verified',
        },
      },
      admin: {
        email: 'rudo@panzira.zw',
        password: 'panzira2026',
        fallbackUser: {
          id: 1,
          email: 'rudo@panzira.zw',
          full_name: 'Rudo Moyo',
          role: 'admin' as const,
          media_house: 'Panzira Control Desk',
          verification_status: 'verified',
        },
      },
    };

    const target = credentialsMap[persona];
    const currentPersistedBalance =
      typeof persisted.royaltyBalanceUsd === 'number' ? persisted.royaltyBalanceUsd : 16.0;
    let resolvedUser: AuthUser = {
      ...target.fallbackUser,
      ...(persona === 'citizen' ? { royalty_balance_usd: currentPersistedBalance } : {}),
    };
    try {
      const res = await apiService.login(target.email, target.password);
      const serverBal =
        typeof res.user.royalty_balance_usd === 'number' ? res.user.royalty_balance_usd : undefined;
      const effectiveCitizenBal =
        currentPersistedBalance === 0
          ? 0
          : Math.max(currentPersistedBalance, serverBal ?? 16.0);
      resolvedUser = {
        ...target.fallbackUser,
        ...res.user,
        ...(persona === 'citizen' ? { royalty_balance_usd: effectiveCitizenBal } : {}),
      };
      if (persona === 'citizen' && effectiveCitizenBal > currentPersistedBalance) {
        setPersisted((prev) => ({
          ...prev,
          royaltyBalanceUsd: effectiveCitizenBal,
        }));
      }
    } catch {
      // Fallback to local persona immediately if backend is offline
    }

    setCurrentUser(resolvedUser);
    if (persona === 'citizen') {
      setPortal('citizen');
      window.history.replaceState(null, '', '#citizen');
      showToast('Signed in as Tariro Moyo (@TariroOnTheRoad) → Contributor Rights Vault');
    } else if (persona === 'journalist') {
      setPortal('newsroom');
      setNewsroomView('inbox');
      window.history.replaceState(null, '', '#inbox');
      showToast('Signed in as Nqobile Dube (The Chronicle · ZMC-2026-0418) → Newsroom Inbox');
    } else {
      setPortal('admin');
      window.history.replaceState(null, '', '#admin');
      showToast('Signed in as Rudo Moyo (Panzira Control Desk) → Admin Desk');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitCitizenReport = (input: NewCitizenReportInput): SignalReport => {
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
      claimPin: String(Math.floor(1000 + Math.random() * 9000)),
      licenseTier: input.licenseTier || 'safety_only',
      attributionMode: input.attributionMode || 'anonymous',
      aiScanVerdict: hasPhoto
        ? (input.photoFilename || '').toLowerCase().match(/screenshot|whatsapp|ai|midjourney|synthetic/)
          ? 'flagged_ai_or_screen'
          : 'pass'
        : null,
      aiScanSummary: hasPhoto
        ? (input.photoFilename || '').toLowerCase().match(/screenshot|whatsapp|ai|midjourney|synthetic/)
          ? 'AUTO-SCAN WARNING: SUSPECTED AI-GENERATED OR SCREEN RECAPTURE — COMMERCIAL PAYOUT BLOCKED'
          : 'AUTO-SCAN: AUTHENTIC CAMERA PHOTO • EXIF & MOIRÉ SCREEN CHECK PASSED'
        : null,
      exifSummary: hasPhoto
        ? 'AUTO-SCAN: 98.4% REAL CAMERA • EXIF: MOBILE CAMERA • MOIRÉ SCREEN CHECK: PASS • DUPLICATE HASH: UNIQUE'
        : null,
      commercialEligible:
        hasPhoto &&
        !(input.photoFilename || '').toLowerCase().match(/screenshot|whatsapp|ai|midjourney|synthetic/),
      humanVisualAiCheck: false,
      humanVisualAiCheckPassed: false,
      translationVerified: input.language === 'English',
      translationReviewed: input.language === 'English',
    };

    const generatedPin = newSignal.claimPin || '4920';
    setLastSubmittedClaimPin(generatedPin);

    setPersisted((prev) => ({
      ...prev,
      signals: [newSignal, ...prev.signals],
    }));

    // Asynchronously dispatch to Python ML intake backend
    apiService
      .submitCitizenReport(input)
      .then((serverSig) => {
        const mergedPin = serverSig.claimPin || generatedPin;
        const resolvedId = serverSig.id || newId;
        setLastSubmittedClaimPin(mergedPin);
        setLastSubmittedReceiptId(resolvedId);
        setSelectedMonitorId((prevId) => (prevId === newId ? resolvedId : prevId));
        setSelectedInboxId((prevId) => (prevId === newId ? resolvedId : prevId));
        setSelectedVerifyId((prevId) => (prevId === newId ? resolvedId : prevId));
        setPendingClaimPrefill((prevPre) =>
          prevPre && prevPre.reference.replace(/^#/, '') === newId
            ? { reference: resolvedId, pin: mergedPin }
            : prevPre
        );
        setPersisted((prev) => ({
          ...prev,
          signals: [
            {
              ...newSignal,
              ...serverSig,
              id: resolvedId,
              claimPin: mergedPin,
              licenseTier: serverSig.licenseTier || newSignal.licenseTier,
              attributionMode: serverSig.attributionMode || newSignal.attributionMode,
              aiScanVerdict: serverSig.aiScanVerdict ?? newSignal.aiScanVerdict,
              aiScanSummary: serverSig.aiScanSummary ?? newSignal.aiScanSummary,
              commercialEligible: serverSig.commercialEligible ?? newSignal.commercialEligible,
            },
            ...prev.signals.filter((s) => s.id !== newId && s.id !== resolvedId),
          ],
        }));
      })
      .catch(() => {});

    setLastSubmittedReceiptId(newId);
    setSelectedMonitorId(newId);
    setSelectedInboxId(newId);
    setSelectedVerifyId(newId);
    showToast(`Report ${newId} queued for editorial verification (PIN ${generatedPin} generated).`);
    return newSignal;
  };

  const toggleChecklist = (signalId: string, field: keyof VerificationChecklist) => {
    apiService.toggleChecklist(signalId, field).catch(() => {});
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
          sig.workflowStatus === 'verified'
            ? 4
            : metCount === 4
              ? 4
              : metCount > 0
                ? 3
                : sig.pipelineStage;
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
  };

  const updateEditorialNotes = (signalId: string, notes: string) => {
    apiService.updateNotes(signalId, notes).catch(() => {});
    setPersisted((prev) => ({
      ...prev,
      signals: prev.signals.map((sig) =>
        sig.id === signalId ? { ...sig, editorialNotes: notes } : sig
      ),
    }));
  };

  const requestEvidence = (signalId: string, note?: string) => {
    apiService.requestEvidence(signalId, note).catch(() => {});
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
    showToast(`Follow-up evidence request logged for ${signalId}.`);
  };

  const rejectSignal = (signalId: string, reason?: string) => {
    apiService.rejectSignal(signalId, reason).catch(() => {});
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
    showToast(`Signal ${signalId} archived as uncorroborated / rejected.`);
  };

  const verifySignal = (signalId: string): boolean => {
    const target = persisted.signals.find((s) => s.id === signalId);
    if (!target) return false;
    const allChecked = Object.values(target.checklist).every(Boolean);
    if (!allChecked) {
      showToast(
        'Editor approval gate: Complete all 4 independent verification checks before verifying.'
      );
      return false;
    }
    const hasPhoto = target.photoType !== 'none';
    const visualAiChecked = Boolean(target.humanVisualAiCheck || target.humanVisualAiCheckPassed);
    if (hasPhoto && !visualAiChecked) {
      showToast(
        'Human visual inspection required: Confirm manual inspection for AI artifacts before publishing a report with an image.'
      );
      return false;
    }
    const needsTranslationGate =
      target.originalLanguage === 'Shona' || target.originalLanguage === 'Ndebele';
    const translationChecked = Boolean(
      target.translationVerified || target.translationReviewed
    );
    if (needsTranslationGate && !translationChecked) {
      showToast(
        `5th Verification Gate required: Confirm the ${target.originalLanguage} → English translation before publishing.`
      );
      return false;
    }

    const approvedNow = new Date();
    const readableApproval = formatHarareDateTime(approvedNow);
    const shortApprovalTime = `${formatHarareShortTime(approvedNow)} CAT`;

    apiService.verifySignal(signalId).catch(() => {});

    setPersisted((prev) => {
      const alreadyPublished = prev.verifiedAlerts.some((a) => a.sourceSignalId === signalId);
      const newPublicAlert: VerifiedPublicAlert = {
        id: `PZ-PUB-${signalId}`,
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
        description: `${target.categoryLabel}: Independently corroborated road hazard at ${target.roadArea} (${target.landmark}).${
          target.isGraphicImage
            ? ' Submitted scene imagery withheld under Panzira editorial graphic-safety policy.'
            : ''
        }`,
        sourceAttribution: `Independently corroborated (4/4 editorial checks) · Approved by Rudo Moyo on ${readableApproval}`,
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
        lastEditorialUpdateDateLabel: `Approved ${readableApproval} (${signalId}) · 0 AI auto-published alerts`,
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
                  'Independently verified (4/4 checks) and approved for public alert by Editor Rudo Moyo.',
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
      `Verified & approved by human editor: ${signalId} is now live on the Public Dashboard${
        target.isGraphicImage ? ' (graphic media withheld from public view)' : ''
      }.`
    );
    return true;
  };

  const toggleGraphicReveal = (signalId: string) => {
    setRevealedGraphicIds((prev) => {
      const nextVal = !prev[signalId];
      return { ...prev, [signalId]: nextVal };
    });
  };

  const claimSignalLock = async (signalId: string, simulateOtherJournalist = false) => {
    const now = new Date();
    const lockedUntilIso = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    const stamp = formatHarareDateTime(now);
    const holderId = simulateOtherJournalist ? 999 : currentUser?.id || 1;
    const holderName = simulateOtherJournalist
      ? 'Nkosilathi Ncube'
      : currentUser?.full_name || 'Rudo Moyo';
    const holderMedia = simulateOtherJournalist
      ? 'The Chronicle (Zimpapers)'
      : currentUser?.media_house || 'Panzira Newsroom Desk';

    if (!simulateOtherJournalist) {
      apiService.claimSignalLock(signalId).catch(() => {});
    }

    setPersisted((prev) => ({
      ...prev,
      signals: prev.signals.map((sig) => {
        if (sig.id !== signalId) return sig;
        return {
          ...sig,
          claimedById: holderId,
          claimedByName: holderName,
          claimedByMediaHouse: holderMedia,
          claimLockedUntil: lockedUntilIso,
          timeline: [
            ...sig.timeline,
            {
              time: stamp,
              description: `Signal claimed for 30m anti-collision investigation lock by ${holderName} (${holderMedia}).`,
            },
          ],
        };
      }),
    }));
    showToast(`Locked ${signalId} for 30 minutes (${holderName} · ${holderMedia}).`);
  };

  const releaseSignalLock = async (signalId: string) => {
    const stamp = formatHarareDateTime(new Date());
    apiService.releaseSignalLock(signalId).catch(() => {});
    setPersisted((prev) => ({
      ...prev,
      signals: prev.signals.map((sig) => {
        if (sig.id !== signalId) return sig;
        return {
          ...sig,
          claimedById: null,
          claimedByName: null,
          claimedByMediaHouse: null,
          claimLockedUntil: null,
          timeline: [
            ...sig.timeline,
            {
              time: stamp,
              description: `30-minute investigation lock released by ${currentUser?.full_name || 'Rudo Moyo'}.`,
            },
          ],
        };
      }),
    }));
    showToast(`Released investigation lock on ${signalId}.`);
  };

  const toggleVisualAiCheck = async (signalId: string) => {
    const target = persisted.signals.find((s) => s.id === signalId);
    if (!target) return;
    const nextVal = !(target.humanVisualAiCheck || target.humanVisualAiCheckPassed);
    const stamp = formatHarareDateTime(new Date());

    apiService.setVisualAiCheck(signalId, nextVal).catch(() => {});

    setPersisted((prev) => ({
      ...prev,
      signals: prev.signals.map((sig) => {
        if (sig.id !== signalId) return sig;
        return {
          ...sig,
          humanVisualAiCheck: nextVal,
          humanVisualAiCheckPassed: nextVal,
          humanVisualCheckedBy: nextVal ? currentUser?.full_name || 'Rudo Moyo' : null,
          timeline: [
            ...sig.timeline,
            {
              time: stamp,
              description: nextVal
                ? `Mandatory human visual AI artifact inspection confirmed by ${currentUser?.full_name || 'Rudo Moyo'}.`
                : `Human visual AI inspection unchecked by ${currentUser?.full_name || 'Rudo Moyo'}.`,
            },
          ],
        };
      }),
    }));
    showToast(
      nextVal
        ? `Human visual AI inspection confirmed for ${signalId}.`
        : `Human visual AI inspection cleared for ${signalId}.`
    );
  };

  const toggleTranslationVerified = async (signalId: string) => {
    const target = persisted.signals.find((s) => s.id === signalId);
    if (!target) return;
    const nextVal = !(target.translationVerified || target.translationReviewed);
    const stamp = formatHarareDateTime(new Date());

    if (nextVal && target.draftEnglishTranslation) {
      apiService.reviewSignalTranslation(signalId, target.draftEnglishTranslation).catch(() => {});
    }

    setPersisted((prev) => ({
      ...prev,
      signals: prev.signals.map((sig) => {
        if (sig.id !== signalId) return sig;
        return {
          ...sig,
          translationVerified: nextVal,
          translationReviewed: nextVal,
          timeline: [
            ...sig.timeline,
            {
              time: stamp,
              description: nextVal
                ? `5th Gate: ${sig.originalLanguage} → English translation reviewed and verified accurate by ${currentUser?.full_name || 'Rudo Moyo'}.`
                : `${sig.originalLanguage} translation verification unchecked.`,
            },
          ],
        };
      }),
    }));
    showToast(
      nextVal
        ? `5th Gate verified: ${target.originalLanguage} translation confirmed accurate.`
        : `Translation verification unchecked.`
    );
  };

  const licenseSignalMedia = async (
    signalId: string,
    licenseType: 'standard' | 'exclusive',
    mediaHouse?: string
  ) => {
    const target = persisted.signals.find((s) => s.id === signalId);
    if (!target) return;
    const now = new Date();
    const stamp = formatHarareDateTime(now);
    const house = mediaHouse || currentUser?.media_house || 'The Chronicle (Zimpapers)';
    const gross = licenseType === 'exclusive' ? 15.0 : 5.0;
    const citizenShare = licenseType === 'exclusive' ? 10.5 : 3.5;
    const exclusiveUntilIso =
      licenseType === 'exclusive'
        ? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
        : target.exclusiveUntil || null;
    const fallbackToken = `PZ-CLEAN-${signalId.replace(/[^A-Z0-9]/gi, '')}-${Math.floor(100000 + Math.random() * 900000)}`;

    const applySettlement = (overrides?: {
      exclusiveLicenseHolder?: string | null;
      exclusiveUntil?: string | null;
      mediaAccessToken?: string | null;
      downloadUrl?: string | null;
      contributorBalanceUsd?: number | null;
    }) => {
      const activity: LastRoyaltyActivity = {
        signalId: target.id,
        mediaHouse: house,
        licenseType,
        grossUsd: gross,
        citizenShareUsd: citizenShare,
        headline: `${house} licensed your ${target.roadArea || target.title} photo (#${target.id.replace(/^#/, '')})`,
        subtitle: `${
          licenseType === 'exclusive'
            ? 'Exclusive 24-Hr License ($15.00 Flat Fee)'
            : 'Standard Editorial License ($5.00 Flat Fee)'
        } • Your 70% Share: +$${citizenShare.toFixed(2)} USD credited`,
        timestamp: stamp,
      };

      let computedBalance = (persisted.royaltyBalanceUsd ?? 16.0) + citizenShare;
      setPersisted((prev) => {
        const baseBalance = typeof prev.royaltyBalanceUsd === 'number' ? prev.royaltyBalanceUsd : 16.0;
        const incremented = Number((baseBalance + citizenShare).toFixed(2));
        computedBalance =
          typeof overrides?.contributorBalanceUsd === 'number'
            ? Math.max(incremented, Number(overrides.contributorBalanceUsd.toFixed(2)))
            : incremented;

        return {
          ...prev,
          royaltyBalanceUsd: computedBalance,
          lastRoyaltyActivity: activity,
          signals: prev.signals.map((sig) => {
            if (sig.id !== signalId) return sig;
            return {
              ...sig,
              exclusiveLicenseHolder:
                overrides?.exclusiveLicenseHolder ??
                (licenseType === 'exclusive' ? house : sig.exclusiveLicenseHolder || house),
              exclusiveUntil: overrides?.exclusiveUntil ?? exclusiveUntilIso,
              mediaAccessToken: overrides?.mediaAccessToken || fallbackToken,
              downloadUrl: overrides?.downloadUrl || `#clean-download-${signalId}`,
              royaltyEarnedUsd: Number(((sig.royaltyEarnedUsd || 0) + citizenShare).toFixed(2)),
              timeline: [
                ...sig.timeline,
                {
                  time: stamp,
                  description: `Instant flat-fee ${licenseType === 'exclusive' ? '24h Exclusive ($15.00 USD)' : 'Standard ($5.00 USD)'} license unlocked by ${house}. Contributor credited +$${citizenShare.toFixed(2)} USD.`,
                },
              ],
            };
          }),
        };
      });

      setCurrentUser((prevUser) =>
        prevUser && prevUser.role === 'citizen'
          ? { ...prevUser, royalty_balance_usd: computedBalance }
          : prevUser
      );
    };

    try {
      const res = await apiService.licenseSignalMedia(signalId, licenseType, house);
      applySettlement({
        exclusiveLicenseHolder: res.exclusiveLicenseHolder ?? undefined,
        exclusiveUntil: res.exclusiveUntil ?? undefined,
        mediaAccessToken: res.mediaAccessToken || fallbackToken,
        downloadUrl: res.downloadUrl || `#clean-download-${signalId}`,
        contributorBalanceUsd: res.contributorBalanceUsd ?? undefined,
      });
    } catch {
      applySettlement();
    }

    showToast(
      `Unlocked ${licenseType === 'exclusive' ? '24-Hr Exclusive ($15.00 USD)' : 'Standard ($5.00 USD)'} license — Citizen credited +$${citizenShare.toFixed(2)} USD ($${gross.toFixed(2)} gross).`
    );
  };

  const claimReportInSession: PanziraContextValue['claimReportInSession'] = (input) => {
    const cleanRef = input.reference.trim().replace(/^#/, '').toUpperCase();
    const formattedRef = `#${cleanRef}`;
    const cleanPin = input.claimPin.trim();
    if (!cleanRef || !cleanPin) return null;

    const matchedSig = persisted.signals.find(
      (s) => s.id.replace(/^#/, '').toUpperCase() === cleanRef
    );
    const stamp = formatHarareDateTime(new Date());
    const tier = input.licenseTier || matchedSig?.licenseTier || 'commercial_pool';
    const attribution = input.attributionMode || matchedSig?.attributionMode || 'handle';
    const isVerified = matchedSig?.workflowStatus === 'verified';
    const step: 1 | 2 | 3 | 4 = isVerified
      ? 4
      : matchedSig && Object.values(matchedSig.checklist).filter(Boolean).length >= 2
        ? 3
        : 2;

    const record: ClaimedReportRecord = {
      reference: formattedRef,
      title: matchedSig?.inboxTitle || matchedSig?.title || `Claimed road report · ${formattedRef}`,
      statusLabel: isVerified ? 'Verified public alert live' : 'Newsroom investigating',
      statusTone: isVerified ? 'live' : 'investigating',
      timestamp: matchedSig?.reportedDateTime || `${stamp} · Claimed via PIN`,
      completedStep: step,
      licenseTier: tier,
      attributionMode: attribution,
      claimPin: cleanPin,
      imageUrl: matchedSig?.customPhotoDataUrl,
    };

    setPersisted((prev) => {
      const prevClaims = prev.claimedReports || [];
      const nextClaims = [
        record,
        ...prevClaims.filter((c) => c.reference.replace(/^#/, '').toUpperCase() !== cleanRef),
      ];
      const nextSignals = prev.signals.map((sig) => {
        if (sig.id.replace(/^#/, '').toUpperCase() !== cleanRef) return sig;
        return {
          ...sig,
          isUserSubmitted: true,
          contributorId: input.contributorId ?? sig.contributorId ?? 101,
          contributorCredit: input.contributorHandle || sig.contributorCredit || '@TariroOnTheRoad',
          licenseTier: tier,
          attributionMode: attribution,
          claimPin: cleanPin,
          timeline: [
            ...sig.timeline,
            {
              time: stamp,
              description: `Guest report claimed via 4-digit PIN by ${input.contributorHandle || 'verified citizen'} (${tier}, ${attribution}).`,
            },
          ],
        };
      });
      return {
        ...prev,
        claimedReports: nextClaims,
        signals: nextSignals,
      };
    });

    setPendingClaimPrefill(null);
    return record;
  };

  const cashOutRoyalties: PanziraContextValue['cashOutRoyalties'] = () => {
    const amountUsd =
      typeof persisted.royaltyBalanceUsd === 'number' ? persisted.royaltyBalanceUsd : 16.0;
    if (amountUsd <= 0) return null;
    const receiptCode = `EC-${Math.floor(10000 + Math.random() * 89999)}`;
    setPersisted((prev) => ({
      ...prev,
      royaltyBalanceUsd: 0,
    }));
    setCurrentUser((prevUser) =>
      prevUser && prevUser.role === 'citizen'
        ? { ...prevUser, royalty_balance_usd: 0 }
        : prevUser
    );
    return { amountUsd, receiptCode };
  };

  const togglePiiRedaction = (signalId: string) => {
    const stamp = formatHarareDateTime(new Date());
    setPersisted((prev) => ({
      ...prev,
      signals: prev.signals.map((sig) => {
        if (sig.id !== signalId) return sig;
        const nextRedacted = !sig.piiRedacted;
        return {
          ...sig,
          piiRedacted: nextRedacted,
          timeline: [
            ...sig.timeline,
            {
              time: stamp,
              description: nextRedacted
                ? 'Applied automated face & vehicle number-plate PII redaction mask prior to publication.'
                : 'Removed PII redaction preview mask.',
            },
          ],
        };
      }),
    }));
    showToast(`Toggled PII Redaction (Faces & Number Plates) on ${signalId}.`);
  };

  const simulateChannelIntake = async (
    channel: 'ussd' | 'whatsapp' | 'telegram',
    payload: {
      phone?: string;
      corridor: string;
      landmark: string;
      categoryKey: HazardCategoryKey;
      categoryLabel: string;
      description: string;
      language?: 'English' | 'Shona' | 'Ndebele';
      hasPhoto?: boolean;
      flaggedAiDemo?: boolean;
    }
  ): Promise<SignalReport> => {
    const now = new Date();
    const intakeTimeReadable = formatHarareDateTime(now);
    const tShort = `${formatHarareShortTime(now)} CAT`;
    const existingNums = persisted.signals
      .map((s) => {
        const m = /(\d+)$/.exec(s.id);
        return m ? Number(m[1]) : 0;
      })
      .filter((n) => n >= 427);
    const nextNum = Math.max(435, ...existingNums) + 1;
    const newId =
      channel === 'ussd'
        ? `PZ-USSD-${String(nextNum).padStart(4, '0')}`
        : channel === 'whatsapp'
          ? `PZ-WA-${String(nextNum).padStart(4, '0')}`
          : `PZ-TG-${String(nextNum).padStart(4, '0')}`;
    const invCode = `ROADS-${String(nextNum).padStart(4, '0')}`;
    const lang = payload.language || 'English';
    const hasPhoto = Boolean(payload.hasPhoto && channel !== 'ussd');
    const flaggedAi = Boolean(payload.flaggedAiDemo);
    const channelLabel =
      channel === 'ussd'
        ? 'USSD *140#'
        : channel === 'whatsapp'
          ? 'Opt-in WhatsApp'
          : 'Opt-in Telegram';
    const channelShort =
      channel === 'ussd'
        ? 'USSD *140# opt-in'
        : channel === 'whatsapp'
          ? 'WhatsApp opt-in'
          : 'Telegram opt-in';

    const newSig: SignalReport = {
      id: newId,
      investigationCode: invCode,
      sourceChannelLabel: channelLabel,
      sourceChannelShort: channelShort,
      sourceBadgeColor: flaggedAi ? 'red' : 'green',
      visibility: 'opt-in',
      workflowStatus: 'lead',
      monitorStatusLabel: channel === 'ussd' ? 'USSD structured' : 'AI structured',
      monitorStatusColor: flaggedAi ? 'red' : 'gold',
      inboxStatusLine: `${channelLabel} · Unverified lead`,
      timeShort: tShort,
      reportedDateTime: intakeTimeReadable,
      observedIso: now.toISOString(),
      title: `${payload.categoryLabel} · ${payload.corridor}`,
      inboxTitle: `${payload.categoryLabel} · ${payload.corridor}`,
      subtitle: `${payload.landmark} · ${channelShort}`,
      corridor: payload.corridor,
      roadArea: payload.corridor,
      landmark: payload.landmark,
      categoryKey: payload.categoryKey,
      categoryLabel: payload.categoryLabel,
      severityLabel: payload.categoryKey === 'collisions' ? 'Critical' : 'High',
      isCritical: payload.categoryKey === 'collisions',
      originalLanguage: lang,
      originalQuote: `“${payload.description.trim()}”`,
      draftEnglishTranslation:
        lang !== 'English'
          ? `[AI Draft Translation from ${lang}]: “Road hazard reported along ${payload.corridor} near ${payload.landmark} — vehicles swerving to avoid damage.”`
          : undefined,
      sourceProvenanceNote: `${channelShort} • Received ${intakeTimeReadable} • Sender ${payload.phone || '+263 77 *** 841'} (anonymised hash)`,
      aiHazardType: payload.categoryLabel,
      aiLikelyCorridor: payload.corridor,
      aiLanguageNote:
        lang === 'English'
          ? `English • ${channelShort}`
          : `${lang} → English • draft translation, 5th gate human review needed`,
      aiLocationPrecision: 'Corridor & landmark menu selection · GPS unverified',
      aiConfidencePercent: hasPhoto ? 71 : 58,
      aiConfidenceNote: `${hasPhoto ? 71 : 58}% • awaiting human corroboration`,
      aiImageHeading: hasPhoto ? 'Submitted channel photo' : 'Low-bandwidth text submission (no photo)',
      aiImageSummary: hasPhoto
        ? 'Photo ingested via messaging webhook; screened by automated AI forensics.'
        : 'Submitted via low-data channel without imagery. Corroborate via independent witnesses.',
      aiImageCaveat: 'Automated intake structuring never auto-publishes.',
      photoType: hasPhoto ? 'figma-road-damage' : 'none',
      photoFilename: hasPhoto ? (flaggedAi ? 'whatsapp_screenshot_ai.jpg' : 'camera_capture.jpg') : undefined,
      photoCaption: hasPhoto ? `${channelLabel} upload (${newId})` : undefined,
      isGraphicImage: false,
      pipelineStage: 2,
      missingItems: [
        'Independent confirmation of the hazard',
        'Precise landmark or GPS coordinate check',
      ],
      checklist: {
        locationAndTime: false,
        mediaAndDate: false,
        independentSource: false,
        hazardStillPresent: false,
      },
      editorialNotes: '',
      unconfirmedSummary: `${channelLabel} report of ${payload.categoryLabel.toLowerCase()} on ${payload.corridor} (${payload.landmark}).`,
      duplicateCandidates: [],
      timeline: [
        {
          time: intakeTimeReadable,
          description: `${channelLabel} inbound webhook payload received (${newId}) and queued for human verification.`,
        },
      ],
      isUserSubmitted: true,
      mapCoords: pickCorridorCoords(payload.corridor, persisted.signals.length),
      claimPin: String(Math.floor(1000 + Math.random() * 9000)),
      licenseTier: hasPhoto ? 'commercial_pool' : 'safety_only',
      attributionMode: 'anonymous',
      aiScanVerdict: hasPhoto ? (flaggedAi ? 'flagged_ai_or_screen' : 'pass') : null,
      aiScanSummary: hasPhoto
        ? flaggedAi
          ? 'AUTO-SCAN WARNING: SUSPECTED AI-GENERATED OR SCREEN RECAPTURE — COMMERCIAL PAYOUT BLOCKED'
          : 'AUTO-SCAN: AUTHENTIC CAMERA PHOTO • EXIF & MOIRÉ SCREEN CHECK PASSED'
        : null,
      exifSummary: hasPhoto
        ? flaggedAi
          ? 'AUTO-SCAN: 87.2% AI/SCREEN RECAPTURE • EXIF STRIPPED • MOIRÉ PATTERN DETECTED'
          : 'AUTO-SCAN: 98.4% REAL CAMERA • EXIF: SAMSUNG A54 • MOIRÉ SCREEN CHECK: PASS • DUPLICATE HASH: UNIQUE'
        : null,
      screenRecaptureFlag: flaggedAi,
      commercialEligible: hasPhoto && !flaggedAi,
      humanVisualAiCheck: false,
      humanVisualAiCheckPassed: false,
      translationVerified: lang === 'English',
      translationReviewed: lang === 'English',
    };

    if (channel === 'ussd') {
      apiService
        .simulateUssdCallback({
          session_id: `AT-USSD-${Date.now()}`,
          phone_number: payload.phone || '+263772000140',
          selected_corridor: payload.corridor,
          selected_hazard_type: payload.categoryLabel,
          landmark_text: payload.landmark,
          severity_level: 'High',
        })
        .catch(() => {});
    } else if (channel === 'whatsapp') {
      apiService
        .simulateWhatsAppWebhook({
          from_number: payload.phone || '+263772000999',
          message_body: `${payload.description} (${payload.corridor}, ${payload.landmark})`,
          user_consented_opt_in: true,
        })
        .catch(() => {});
    }

    setPersisted((prev) => ({
      ...prev,
      signals: [newSig, ...prev.signals],
    }));
    setSelectedInboxId(newId);
    setSelectedVerifyId(newId);
    setSelectedMonitorId(newId);
    showToast(`${channelLabel} report ${newId} ingested into Newsroom Inbox.`);
    return newSig;
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

  const saveBriefDraft = () => {
    const stamp = formatHarareDateTime(new Date());
    apiService.saveWorkingBrief(persisted.briefDraft).catch(() => {});
    setPersisted((prev) => ({
      ...prev,
      briefDraft: {
        ...prev.briefDraft,
        lastSavedAt: `Saved ${stamp} (local demo draft)`,
      },
    }));
    showToast('Working investigative brief saved to local newsroom draft.');
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
      royaltyBalanceUsd: 16.0,
      claimedReports: [],
      lastRoyaltyActivity: null,
    });
    setCurrentUser((prevUser) =>
      prevUser && prevUser.role === 'citizen'
        ? { ...prevUser, royalty_balance_usd: 16.0 }
        : prevUser
    );
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
        authTab,
        setAuthTab,
        currentUser,
        setCurrentUser,
        authPromptMessage,
        setAuthPromptMessage,
        quickDemoLogin,
        navigateNewsroom,
        navigatePublic,
        navigateAuth,
        navigateCitizen,
        navigateAdmin,
        logoutUser,
        showToast,
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
        lastSubmittedClaimPin,
        pendingClaimPrefill,
        setPendingClaimPrefill,
        royaltyBalanceUsd:
          typeof persisted.royaltyBalanceUsd === 'number' ? persisted.royaltyBalanceUsd : 16.0,
        claimedReports: persisted.claimedReports || [],
        lastRoyaltyActivity: persisted.lastRoyaltyActivity ?? null,
        submitCitizenReport,
        claimReportInSession,
        cashOutRoyalties,
        toggleChecklist,
        updateEditorialNotes,
        requestEvidence,
        rejectSignal,
        verifySignal,
        claimSignalLock,
        releaseSignalLock,
        toggleVisualAiCheck,
        toggleTranslationVerified,
        licenseSignalMedia,
        togglePiiRedaction,
        simulateChannelIntake,
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
