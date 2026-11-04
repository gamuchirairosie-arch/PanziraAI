"""Channel webhooks. Each handler validates the caller, hands off to the integration module, commits,
and queues AI extraction in the background so the provider gets a fast 200."""
import json

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..integrations import africastalking as at
from ..integrations import messenger as msg
from ..integrations import whatsapp as wa
from ..security import hash_contact, limiter, rate_limit
from .reports import _bg_process

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


# ---------------- WhatsApp Cloud API ----------------
@router.get("/whatsapp")
def wa_verify(hub_mode: str = Query(None, alias="hub.mode"), hub_token: str = Query(None, alias="hub.verify_token"),
              hub_challenge: str = Query(None, alias="hub.challenge")):
    s = get_settings()
    if hub_mode == "subscribe" and s.wa_verify_token and hub_token == s.wa_verify_token:
        return PlainTextResponse(hub_challenge or "")
    raise HTTPException(403, "Verification failed")


@router.post("/whatsapp", dependencies=[Depends(rate_limit("wa_hook", 600, 60))])
async def wa_incoming(request: Request, background: BackgroundTasks, db: Session = Depends(get_db)):
    raw = await request.body()
    wa.verify_signature(raw, request.headers.get("x-hub-signature-256"))
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON")
    created = []
    for m in wa.extract_messages(payload):
        rid = wa.handle_message(db, m)
        if rid:
            created.append(rid)
    db.commit()
    for rid in created:
        background.add_task(_bg_process, rid)
    return {"status": "ok"}


# ---------------- Africa's Talking ----------------
@router.post("/africastalking/ussd", response_class=PlainTextResponse,
             dependencies=[Depends(rate_limit("ussd_hook", 600, 60))])
async def ussd(background: BackgroundTasks, key: str | None = None, sessionId: str = Form(...),
               phoneNumber: str = Form(...), text: str = Form(""), serviceCode: str = Form(""),
               db: Session = Depends(get_db)):
    at.check_webhook_key(key)
    if not limiter.check(f"ussd:{hash_contact(phoneNumber)}", 60, 3600):
        return PlainTextResponse("END Too many requests. Try again later.")
    reply, rid = at.handle_ussd(db, session_id=sessionId, phone=phoneNumber, text=text)
    if rid:
        # confirmation SMS with the reference, so the citizen keeps it after the session ends
        ref = f"PZ-SIG-{rid:04d}"
        msg.send(db, "sms", phoneNumber, f"Panzira: your report {ref} was received. An editor will check it before "
                                         f"anything is published. SMS STATUS {ref} to follow progress.")
    db.commit()
    if rid:
        background.add_task(_bg_process, rid)
    return PlainTextResponse(reply)


@router.post("/africastalking/sms", dependencies=[Depends(rate_limit("sms_hook", 600, 60))])
async def sms(background: BackgroundTasks, key: str | None = None, from_: str = Form(..., alias="from"),
              text: str = Form(""), id: str | None = Form(None), to: str = Form(""), date: str = Form(""),
              db: Session = Depends(get_db)):
    at.check_webhook_key(key)
    reply, rid = at.handle_sms(db, sender=from_, text=text, msg_id=id)
    if reply:
        msg.send(db, "sms", from_, reply)
    db.commit()
    if rid:
        background.add_task(_bg_process, rid)
    return {"status": "ok"}
