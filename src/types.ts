export type PortalMode = 'newsroom' | 'public';

export type NewsroomView =
  | 'monitor'
  | 'inbox'
  | 'verify'
  | 'hotspots'
  | 'fleet'
  | 'briefs';

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
