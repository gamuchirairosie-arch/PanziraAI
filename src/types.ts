export type PortalMode = 'newsroom' | 'public' | 'auth' | 'citizen' | 'admin';

export type AuthTab = 'signin' | 'citizen-signup' | 'journalist-apply';

export type UserRole = 'citizen' | 'journalist' | 'editor' | 'admin';

export type LicenseTier = 'safety_only' | 'free_attribution' | 'commercial_pool';

export type AttributionMode = 'full_name' | 'handle' | 'anonymous';

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  handle?: string | null;
  phone?: string | null;
  media_house?: string | null;
  zmc_number?: string | null;
  press_card_url?: string | null;
  verification_status?: 'verified' | 'pending_verification' | 'rejected' | string;
  royalty_balance_usd?: number;
}

export interface JournalistApplicationRecord {
  id: number;
  full_name: string;
  email: string;
  role: string;
  media_house: string | null;
  zmc_number: string | null;
  press_card_url: string | null;
  verification_status: string;
  created_at?: string | null;
}

export interface MediaLicenseSettlementRecord {
  id: string;
  reportRef: string;
  incidentTitle: string;
  newsroom: string;
  licenseTier: 'standard' | 'exclusive' | 'flagged';
  licenseTierLabel: string;
  flatFeeUsd: number;
  contributorShareUsd: number;
  platformShareUsd: number;
  contributorHandle: string;
  paymentStatusLabel: string;
  settlementRef: string;
  createdAt: string;
}

export type NewsroomView =
  | 'monitor'
  | 'inbox'
  | 'verify'
  | 'hotspots'
  | 'fleet'
  | 'briefs'
  | 'sources';

export type PublicView =
  | 'overview'
  | 'map'
  | 'alerts'
  | 'my-reports'
  | 'report';

export type IntakeVisibility = 'public' | 'opt-in';

export type SignalWorkflowStatus =
  | 'lead'
  | 'verifying'
  | 'verified'
  | 'rejected';

export type HazardCategoryKey =
  | 'potholes'
  | 'flooding'
  | 'collisions'
  | 'visibility'
  | 'other';

export interface VerificationChecklist {
  locationAndTime: boolean;
  mediaAndDate: boolean;
  independentSource: boolean;
  hazardStillPresent: boolean;
}

export interface TimelineEvent {
  time: string;
  description: string;
}

export interface DuplicateCandidate {
  id: string;
  sourceLabel: string;
  timestamp: string;
  summary: string;
  quote: string;
  locationNote: string;
}

export interface SignalReport {
  id: string;
  investigationCode: string;
  sourceChannelLabel: string;
  sourceChannelShort: string;
  sourceBadgeColor: 'green' | 'gold' | 'red';
  visibility: IntakeVisibility;
  workflowStatus: SignalWorkflowStatus;
  monitorStatusLabel: string;
  monitorStatusColor: 'green' | 'gold' | 'red';
  inboxStatusLine: string;
  timeShort: string;
  reportedDateTime: string;
  observedIso?: string;
  title: string;
  inboxTitle?: string;
  subtitle: string;
  corridor: string;
  roadArea: string;
  landmark: string;
  categoryKey: HazardCategoryKey;
  categoryLabel: string;
  severityLabel: string;
  isCritical?: boolean;
  originalLanguage: 'English' | 'Shona' | 'Ndebele';
  originalQuote: string;
  draftEnglishTranslation?: string;
  sourceProvenanceNote: string;
  evidenceLink?: string;
  // AI-structured fields (suggestions only)
  aiHazardType: string;
  aiLikelyCorridor: string;
  aiLanguageNote: string;
  aiLocationPrecision: string;
  aiConfidencePercent: number;
  aiConfidenceNote: string;
  aiImageHeading: string;
  aiImageSummary: string;
  aiImageCaveat: string;
  // Media & Graphic Safety
  photoType: 'none' | 'figma-road-damage' | 'graphic-collision-demo' | 'custom-upload';
  customPhotoDataUrl?: string;
  photoFilename?: string;
  photoCaption?: string;
  isGraphicImage: boolean;
  graphicSafetyReason?: string;
  // Pipeline & Verification
  pipelineStage: 1 | 2 | 3 | 4;
  missingItems: string[];
  checklist: VerificationChecklist;
  editorialNotes: string;
  unconfirmedSummary: string;
  duplicateClusterTitle?: string;
  duplicateClusterSummary?: string;
  duplicateCandidates: DuplicateCandidate[];
  timeline: TimelineEvent[];
  isUserSubmitted?: boolean;
  mapCoords: {
    xPct: number;
    yPct: number;
  };
  reportedLat?: number;
  reportedLng?: number;
  gpsReported?: boolean;
  // Sprint 1-3 Rights, Locking & AI Forensics fields
  claimPin?: string | null;
  contributorId?: number | null;
  contributorCredit?: string | null;
  royaltyEarnedUsd?: number;
  licenseTier?: 'safety_only' | 'free_attribution' | 'commercial_pool';
  attributionMode?: 'full_name' | 'handle' | 'anonymous';
  exclusiveLicenseHolder?: string | null;
  exclusiveUntil?: string | null;
  claimedById?: number | null;
  claimedByName?: string | null;
  claimedByMediaHouse?: string | null;
  claimLockedUntil?: string | null;
  aiScanVerdict?: 'pass' | 'flagged_ai_or_screen' | string | null;
  aiScanSummary?: string | null;
  commercialEligible?: boolean;
  humanVisualAiCheck?: boolean;
  aiGeneratedProb?: number | null;
  aiDetectionSource?: string | null;
  screenRecaptureFlag?: boolean;
  exifSummary?: string | null;
  humanVisualAiCheckPassed?: boolean;
  humanVisualCheckedBy?: string | null;
  translationVerified?: boolean;
  translationReviewed?: boolean;
  mediaAccessToken?: string | null;
  downloadUrl?: string | null;
  piiRedacted?: boolean;
}

export interface VerifiedPublicAlert {
  id: string;
  sourceSignalId?: string;
  title: string;
  location: string;
  corridor: string;
  categoryKey: HazardCategoryKey;
  categoryLabel: string;
  severity: 'Moderate severity' | 'Critical severity' | 'High severity';
  isCritical: boolean;
  updatedAgo: string;
  approvedAtIso?: string;
  approvedAtReadable?: string;
  description: string;
  sourceAttribution: string;
  lat?: number | null;
  lng?: number | null;
  desktopPin: {
    xPct: number;
    yPct: number;
    pinAsset: 'pinVerified0' | 'pinVerified1' | 'pinVerified2' | 'pinVerified3';
  };
}

export interface CorridorWatchItem {
  id: 'A5' | 'KHAMI' | 'ESIGODINI';
  rank: string;
  name: string;
  fleetName: string;
  badge: string;
  fleetBadge: string;
  badgeColor: 'red' | 'gold';
  submissionsSummary: string;
  hazardSummary: string;
  patternNote: string;
  fleetConfidenceLine: string;
  fleetRecommendation: string;
  scoreDisplay: string;
  scoreNumeric: number | null;
  confidenceLabel: string;
  positiveFactors: string[];
  negativeFactors: string[];
  whyLocationMobile: string;
  missingMobile: string;
  clusterCount: number;
  apiEndpoint: string;
}

export interface WorkingBriefDraft {
  investigationId: string;
  editorName: string;
  dateLabel: string;
  title: string;
  dek: string;
  lead: string;
  reportedPattern: string;
  reportingPlan: string;
  questionsForAuthorities: string[];
  editorNotes: string;
  lastSavedAt: string | null;
}
