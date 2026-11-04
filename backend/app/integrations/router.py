"""Integrations Router

Exposes webhook and inbound collection endpoints for WhatsApp,
authorized Social Media pages, and low-bandwidth SMS/USSD gateways.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database.session import get_db
from app.schemas.integration import (
    WhatsAppWebhookEntry,
    PublicFeedPost,
    SmsReport,
    UssdReport,
)
from app.schemas.signal import SignalReportResponse
from app.integrations.whatsapp import ingest_whatsapp_message
from app.integrations.social_collector import ingest_public_social_post
from app.integrations.sms_ussd import ingest_sms_report, ingest_ussd_report

router = APIRouter(prefix="/integrations", tags=["Integrations & Webhooks"])


@router.get("/whatsapp/webhook")
def verify_whatsapp_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """
    Standard Meta / WhatsApp Business API webhook verification handshake.
    Validates token before Meta will activate the webhook subscription.
    """
    if hub_mode == "subscribe" and hub_token == settings.WHATSAPP_VERIFY_TOKEN:
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Invalid WhatsApp webhook verification token",
    )


@router.post("/whatsapp/webhook", response_model=SignalReportResponse)
def receive_whatsapp_message(
    payload: WhatsAppWebhookEntry,
    db: Session = Depends(get_db)
):
    """
    Receives citizen-initiated, opt-in WhatsApp submissions.
    Enforces opt-in consent and immediately routes through the ML pipeline.
    """
    try:
        signal = ingest_whatsapp_message(payload, db)
        return SignalReportResponse.model_validate(signal)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/social/public-feed", response_model=SignalReportResponse)
def ingest_social_post(
    post: PublicFeedPost,
    db: Session = Depends(get_db)
):
    """
    Ingests an authorized public civic post (e.g. Bulawayo City Council Facebook page).
    Strictly requires public authorization and saves source provenance.
    """
    try:
        signal = ingest_public_social_post(post, db)
        return SignalReportResponse.model_validate(signal)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/sms/inbound", response_model=SignalReportResponse)
def receive_sms_report(
    sms: SmsReport,
    db: Session = Depends(get_db)
):
    """Receives low-bandwidth SMS messages from mobile network gateways."""
    signal = ingest_sms_report(sms, db)
    return SignalReportResponse.model_validate(signal)


@router.post("/ussd/callback", response_model=SignalReportResponse)
def receive_ussd_report(
    ussd: UssdReport,
    db: Session = Depends(get_db)
):
    """Receives structured USSD (*140#) submissions."""
    signal = ingest_ussd_report(ussd, db)
    return SignalReportResponse.model_validate(signal)

