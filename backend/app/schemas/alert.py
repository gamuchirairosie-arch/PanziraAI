"""Pydantic Schemas for Verified Public Alerts, Corridors, and Briefs"""

from typing import List, Optional, Literal
from pydantic import BaseModel


class DesktopPinSchema(BaseModel):
    xPct: float
    yPct: float
    pinAsset: Literal['pinVerified0', 'pinVerified1', 'pinVerified2', 'pinVerified3']


class VerifiedPublicAlertResponse(BaseModel):
    """Sanitized public alert representation. NEVER contains sensitive contact info or graphic media."""
    id: str
    sourceSignalId: str
    title: str
    location: str
    corridor: str
    categoryKey: str
    categoryLabel: str
    severity: str
    isCritical: bool
    updatedAgo: str
    approvedAtIso: str
    approvedAtReadable: str
    description: str
    sourceAttribution: str
    desktopPin: DesktopPinSchema

    class Config:
        from_attributes = True


class CorridorWatchResponse(BaseModel):
    id: Literal['A5', 'KHAMI', 'ESIGODINI']
    rank: str
    name: str
    fleetName: str
    badge: str
    fleetBadge: str
    badgeColor: Literal['red', 'gold']
    submissionsSummary: str
    hazardSummary: str
    patternNote: str
    fleetConfidenceLine: str
    fleetRecommendation: str
    scoreDisplay: str
    scoreNumeric: Optional[float] = None
    confidenceLabel: str
    positiveFactors: List[str]
    negativeFactors: List[str]
    whyLocationMobile: str
    missingMobile: str
    clusterCount: int
    apiEndpoint: str

    class Config:
        from_attributes = True


class WorkingBriefDraftSchema(BaseModel):
    investigationId: str
    editorName: str
    dateLabel: str
    title: str
    dek: str
    lead: str
    reportedPattern: str
    reportingPlan: str
    questionsForAuthorities: List[str]
    editorNotes: str
    lastSavedAt: Optional[str] = None

    class Config:
        from_attributes = True


class WorkingBriefUpdate(BaseModel):
    title: Optional[str] = None
    dek: Optional[str] = None
    lead: Optional[str] = None
    reportedPattern: Optional[str] = None
    reportingPlan: Optional[str] = None
    questionsForAuthorities: Optional[List[str]] = None
    editorNotes: Optional[str] = None

