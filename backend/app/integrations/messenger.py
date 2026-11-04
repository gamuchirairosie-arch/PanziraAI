"""Outbound messages (WhatsApp / SMS). Always logged to the outbox with a hashed recipient.
Swap `messenger` in tests; in dev with no credentials messages are only logged."""
from __future__ import annotations

import logging

import httpx
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Outbox
from ..security import hash_contact

log = logging.getLogger("panzira.messenger")


class Messenger:
    def send(self, db: Session, channel: str, to: str, body: str) -> str:
        s = get_settings()
        status = "logged"
        try:
            if channel == "whatsapp" and s.wa_access_token and s.wa_phone_number_id:
                httpx.post(
                    f"https://graph.facebook.com/{s.meta_graph_version}/{s.wa_phone_number_id}/messages",
                    headers={"Authorization": f"Bearer {s.wa_access_token}"},
                    json={"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": body}},
                    timeout=10,
                ).raise_for_status()
                status = "sent"
            elif channel == "sms" and s.at_api_key:
                host = "api.sandbox.africastalking.com" if s.at_username == "sandbox" else "api.africastalking.com"
                data = {"username": s.at_username, "to": to, "message": body}
                if s.at_sender_id:
                    data["from"] = s.at_sender_id
                httpx.post(f"https://{host}/version1/messaging",
                           headers={"apiKey": s.at_api_key, "Accept": "application/json"},
                           data=data, timeout=10).raise_for_status()
                status = "sent"
        except Exception as exc:  # delivery problems must never break intake
            log.warning("send failed: %s", exc)
            status = "failed"
        db.add(Outbox(channel=channel, to_hash=hash_contact(to), body=body, status=status))
        db.flush()
        return status


messenger: Messenger = Messenger()


def set_messenger(m: Messenger) -> None:
    global messenger
    messenger = m


def send(db: Session, channel: str, to: str, body: str) -> str:
    return messenger.send(db, channel, to, body)
