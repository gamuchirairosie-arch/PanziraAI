"""Pydantic Schemas for Signal Reports & Editorial Workflows"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


class VerificationChecklistSchema(BaseModel):
    locationAndTime: bool = False
    mediaAndDate: bool = False
    independentSource: bool = False
    hazardStillPresent: bool = False


class TimelineEventSchema(BaseModel):
    time: str
    description: str


class DuplicateCandidateSchema(BaseModel):
    id: str
    sourceLabel: str
    timestamp: str
    summary: str
    quote: str
    locationNote: str


class MapCoordsSchema(BaseModel):
    xPct: float
    yPct: float


class CitizenReportCreate(BaseModel):
    """Payload for submitting a citizen report via Web, WhatsApp, SMS or Social API."""
    categoryKey: Literal['potholes', 'flooding', 'collisions', 'visibility', 'other'] = 'potholes'
    categoryLabel: str = "Road surface damage"
    roadArea: str = Field(..., min_length=2, max_length=200)
    landmark: str = Field(..., min_length=2, max_length=255)
    description: str = Field(..., min_length=5, max_length=2000)
    reportedDateTime: Optional[str] = None
    observedIso: Optional[str] = None
    evidenceLink: Optional[str] = None
    language: Literal['English', 'Shona', 'Ndebele'] = 'English'
    photoType: Literal['none', 'figma-road-damage', 'graphic-collision-demo', 'custom-upload'] = 'none'
    customPhotoDataUrl: Optional[str] = None
    photoFilename: Optional[str] = None
    containsGraphicContent: Optional[bool] = False
    # Integration provenance fields (when ingested via webhook or social collector)
    sourceChannelLabel: Optional[str] = "Citizen web"
    sourceChannelShort: Optional[str] = "Citizen web (opt-in)"
    sourceProvenanceNote: Optional[str] = None


class SignalReportResponse(BaseModel):
    """Full signal representation for the newsroom / journalist dashboard."""
    id: str
    investigationCode: str
    sourceChannelLabel: str
    sourceChannelShort: str
    sourceBadgeColor: str
    visibility: str
    workflowStatus: str
    monitorStatusLabel: str
    monitorStatusColor: str
    inboxStatusLine: str
    timeShort: str
    reportedDateTime: str
    observedIso: Optional[str] = None
    title: str
    inboxTitle: Optional[str] = None
    subtitle: str
    corridor: str
    roadArea: str
    landmark: str
    categoryKey: str
    categoryLabel: str
    severityLabel: str
    isCritical: bool
    originalLanguage: str
    originalQuote: str
    draftEnglishTranslation: Optional[str] = None
    sourceProvenanceNote: Optional[str] = None
    evidenceLink: Optional[str] = None
    
    # AI Suggestions
    aiHazardType: str
    aiLikelyCorridor: str
    aiLanguageNote: str
    aiLocationPrecision: str
    aiConfidencePercent: int
    aiConfidenceNote: str
    aiImageHeading: str
    aiImageSummary: str
    aiImageCaveat: str
    
    # Media & Graphic Safety
    photoType: str
    customPhotoDataUrl: Optional[str] = None
    photoFilename: Optional[str] = None
    photoCaption: Optional[str] = None
    isGraphicImage: bool
    graphicSafetyReason: Optional[str] = None
    
    # Editorial Verification
    pipelineStage: int
    missingItems: List[str]
    checklist: VerificationChecklistSchema
    editorialNotes: str
    unconfirmedSummary: str
    duplicateClusterTitle: Optional[str] = None
    duplicateClusterSummary: Optional[str] = None
    duplicateCandidates: List[DuplicateCandidateSchema]
    timeline: List[TimelineEventSchema]
    isUserSubmitted: bool
    mapCoords: MapCoordsSchema

    class Config:
        from_attributes = True


class ChecklistToggleRequest(BaseModel):
    field: Literal['locationAndTime', 'mediaAndDate', 'independentSource', 'hazardStillPresent']


class EditorialNotesUpdate(BaseModel):
    notes: str


class EvidenceRequest(BaseModel):
    note: Optional[str] = None


class RejectSignalRequest(BaseModel):
    reason: Optional[str] = None

