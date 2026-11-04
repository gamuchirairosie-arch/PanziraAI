"""Africa's Talking USSD + SMS handling.

USSD: AT posts sessionId, serviceCode, phoneNumber, text ("1*2*Plumtree"). The `text` field carries the whole
path so the handler is stateless. Each response must start with CON (continue) or END and stay under
182 characters (a hard network limit).
SMS: inbound callback with from / to / text / id; outbound via messenger.
"""
from __future__ import annotations

import hmac
import re

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..i18n import STATUS_TEXT, t
from ..intake import (clean_text, create_report, get_consent, record_consent, revoke_consent)
from ..models import ContributorPref, Report
from ..security import Actor, hash_contact, limiter
from . import messenger as msg

USSD_LIMIT = 182
LANGS = {"1": "en", "2": "sn", "3": "nd"}

HAZARDS = ["potholes", "flooding", "collisions", "visibility", "other"]
HAZARD_LABEL = {
    "en": ["Pothole/road damage", "Flooding", "Crash/breakdown", "Lights/visibility", "Other hazard"],
    "sn": ["Gomba/mugwagwa wakaputsika", "Mvura/mafashamo", "Tsaona/mota yakaramba", "Mwenje/kuona", "Chimwe"],
    "nd": ["Umgodi/umgwaqo", "Amanzi/izikhukhula", "Ingozi/imoto yonakele", "Izibani/ukubona", "Okunye"],
}
AREAS = [("A5", "A5 Bulawayo-Plumtree"), ("KHAMI", "Khami Rd/Mzilikazi"), ("ESIGODINI", "A7 Esigodini"),
         ("CBD", "Bulawayo CBD/suburbs")]

U = {
    "en": {
        "menu": "Panzira road reports\n1. Report a hazard\n2. Check a report\n3. Language",
        "type": "What did you see?\n", "area": "Which road or area?\n", "other_area": "Type the road or town name:",
        "landmark": "Nearest landmark or suburb? Type it, or 0 to skip:",
        "confirm": "Send this report?\n{h}\n{a}\n{l}\n1. Send  2. Cancel",
        "thanks": "Thank you. Ref {ref}. An editor checks every report before anything is published.",
        "cancel": "Cancelled. Nothing was sent.", "ref": "Enter your reference (e.g. PZ-SIG-0042):",
        "lang": "Language\n1. English\n2. Shona\n3. Ndebele", "lang_set": "Language set to English.",
        "invalid": "Invalid choice. Please dial again.", "not_found": "Reference not found for this number.",
        "status": "{ref}: {s}",
    },
    "sn": {
        "menu": "Panzira\n1. Ripoti njodzi yemugwagwa\n2. Tarisa ripoti\n3. Mutauro",
        "type": "Makaona chii?\n", "area": "Mugwagwa upi kana nzvimbo?\n", "other_area": "Nyorai zita remugwagwa kana taundi:",
        "landmark": "Panozivikanwa pakatsanangana? Nyorai kana 0 kuramba:",
        "confirm": "Tumira ripoti iyi?\n{h}\n{a}\n{l}\n1. Tumira  2. Rega",
        "thanks": "Tatenda. Nhamba {ref}. Mupepeti anotarisa ripoti dzese tisati tabudisa.",
        "cancel": "Yarega. Hapana chakatumirwa.", "ref": "Nyorai nhamba yeripoti (semuenzaniso PZ-SIG-0042):",
        "lang": "Mutauro\n1. English\n2. Shona\n3. Ndebele", "lang_set": "Mutauro wava chiShona.",
        "invalid": "Sarudzo isiri iyo. Dhayalai zvakare.", "not_found": "Nhamba haina kuwanikwa panhamba iyi.",
        "status": "{ref}: {s}",
    },
    "nd": {
        "menu": "Panzira\n1. Bika ingozi yomgwaqo\n2. Hlola umbiko\n3. Ulimi",
        "type": "Ubone ini?\n", "area": "Umgwaqo muphi noma indawo?\n", "other_area": "Bhala igama lomgwaqo noma idolobha:",
        "landmark": "Indawo eyaziwayo eseduze? Bhala noma 0 ukweqa:",
        "confirm": "Thumela umbiko lo?\n{h}\n{a}\n{l}\n1. Thumela  2. Khansela",
        "thanks": "Siyabonga. Inombolo {ref}. Umhleli ubheka yonke imibiko ngaphambi kokushicilela.",
        "cancel": "Kukhanselwe. Akukho okuthunyelwe.", "ref": "Faka inombolo yombiko (isb. PZ-SIG-0042):",
        "lang": "Ulimi\n1. English\n2. Shona\n3. Ndebele", "lang_set": "Ulimi lushintshelwe esiNdebeleni.",
        "invalid": "Ukukhetha okungalunganga. Shaya futhi.", "not_found": "Inombolo ayitholakalanga kule nombolo.",
        "status": "{ref}: {s}",
    },
}


def check_webhook_key(key: str | None) -> None:
    s = get_settings()
    if not s.at_webhook_secret:
        if s.env == "prod":
            raise HTTPException(503, "Webhook secret not configured")
        return  # dev convenience
    if not key or not hmac.compare_digest(key, s.at_webhook_secret):
        raise HTTPException(403, "Invalid webhook key")


def _con(s: str) -> str:
    out = "CON " + s
    return out if len(out) <= USSD_LIMIT else out[:USSD_LIMIT]


def _end(s: str) -> str:
    return ("END " + s)[:USSD_LIMIT]


def get_lang(db: Session, phone: str) -> str:
    p = db.get(ContributorPref, hash_contact(phone))
    return p.language if p else "en"


def set_lang(db: Session, phone: str, lang: str) -> None:
    h = hash_contact(phone)
    p = db.get(ContributorPref, h)
    if p:
        p.language = lang
    else:
        db.add(ContributorPref(contributor_hash=h, language=lang))
    db.flush()


def _options(items: list[str]) -> str:
    return "\n".join(f"{i}. {x}" for i, x in enumerate(items, 1))


def handle_ussd(db: Session, *, session_id: str, phone: str, text: str) -> tuple[str, int | None]:
    """Returns (response, report_id_created_or_None)."""
    lang = get_lang(db, phone)
    s = U[lang]
    parts = [p.strip() for p in (text or "").split("*")] if text else []
    if not parts:
        return _con(s["menu"]), None

    top = parts[0]
    if top == "1":
        return _report_flow(db, session_id, phone, lang, parts[1:])
    if top == "2":
        if len(parts) == 1:
            return _con(s["ref"]), None
        ref = parts[1].upper()
        m = re.fullmatch(r"PZ-SIG-(\d{1,6})", ref)
        r = db.get(Report, int(m.group(1))) if m else None
        if not r or r.contributor_hash != hash_contact(phone):
            return _end(s["not_found"]), None
        return _end(s["status"].format(ref=ref, s=STATUS_TEXT[r.status][lang])), None
    if top == "3":
        if len(parts) == 1:
            return _con(s["lang"]), None
        if parts[1] in LANGS:
            set_lang(db, phone, LANGS[parts[1]])
            return _end(U[LANGS[parts[1]]]["lang_set"]), None
    return _end(s["invalid"]), None


def _report_flow(db, session_id, phone, lang, p: list[str]):
    s = U[lang]
    labels = HAZARD_LABEL[lang]
    if not p:
        return _con(s["type"] + _options(labels)), None
    if not (p[0].isdigit() and 1 <= int(p[0]) <= 5):
        return _end(s["invalid"]), None
    hazard_i = int(p[0]) - 1
    if len(p) == 1:
        return _con(s["area"] + _options([a[1] for a in AREAS] + ["Other"])), None
    if not (p[1].isdigit() and 1 <= int(p[1]) <= 5):
        return _end(s["invalid"]), None
    area_i = int(p[1]) - 1
    other = area_i == 4
    idx = 2
    area_text = ""
    if other:
        if len(p) == 2:
            return _con(s["other_area"]), None
        area_text, idx = clean_text(p[2], 40), 3
        if not area_text:
            return _end(s["invalid"]), None
    else:
        area_text = AREAS[area_i][1]
    if len(p) == idx:
        return _con(s["landmark"]), None
    landmark = "" if p[idx] == "0" else clean_text(p[idx], 40)
    if len(p) == idx + 1:
        return _con(s["confirm"].format(h=labels[hazard_i], a=area_text, l=landmark or "-")), None
    choice = p[idx + 1]
    if choice == "2":
        return _end(s["cancel"]), None
    if choice != "1":
        return _end(s["invalid"]), None

    text = f"{HAZARD_LABEL['en'][hazard_i]} on {area_text}" + (f" near {landmark}" if landmark else "")
    r, _, created = create_report(
        db, channel="ussd", text=text, actor=Actor.system("system:ussd"), language=lang,
        category_key=HAZARDS[hazard_i], road_area=area_text, landmark=landmark,
        source_ref=f"ussd:{session_id}", contact=phone, allow_followup=False,
    )
    if not other:
        r.corridor_id = AREAS[area_i][0]
    return _end(s["thanks"].format(ref=r.public_id)), (r.id if created else None)


# ---------------- SMS ----------------
CATEGORY_WORDS = {
    "potholes": {"pothole", "hole", "road", "gomba", "makomba", "umgodi", "imigodi"},
    "flooding": {"flood", "water", "mvura", "mafashamo", "amanzi", "izikhukhula"},
    "collisions": {"crash", "accident", "breakdown", "tsaona", "ngozi", "ingozi"},
    "visibility": {"dark", "light", "lights", "fog", "mwenje", "izibani"},
    "other": {"hazard", "other", "cattle", "tree"},
}
_REF = re.compile(r"PZ-SIG-(\d{1,6})", re.I)


def parse_sms(text: str) -> dict:
    body = clean_text(text, 480)
    words = body.split()
    if not words:
        return {"command": "help"}
    first = words[0].upper().strip(":,.")
    if first in ("STOP", "UNSUBSCRIBE", "SIMUDZA", "PHUMA"):
        return {"command": "stop"}
    if first in ("YES", "START", "HONGU", "YEBO"):
        return {"command": "yes"}
    if first in ("HELP", "RUMBIDZO", "IMVUME"):
        return {"command": "help"}
    if first == "STATUS":
        m = _REF.search(body)
        return {"command": "status", "ref_id": int(m.group(1)) if m else None}
    cat = next((c for c, ws in CATEGORY_WORDS.items() if first.lower() in ws), None)
    rest = " ".join(words[1:]) if cat else body
    if not rest.strip():
        return {"command": "help"}
    return {"command": "report", "category": cat, "text": body, "body": rest}


def sms_help(lang="en") -> str:
    return ("Panzira: SMS a hazard e.g. 'CRASH Plumtree road Gwanda 2 vehicles'. Keywords: POTHOLE FLOOD CRASH DARK. "
            "STATUS PZ-SIG-0001 to track. YES to allow follow-up, STOP to opt out.")


def handle_sms(db: Session, *, sender: str, text: str, msg_id: str | None) -> tuple[str | None, int | None]:
    """Returns (reply_text, report_id_created_or_None)."""
    lang = get_lang(db, sender)
    cmd = parse_sms(text)
    c = cmd["command"]
    if c == "stop":
        revoke_consent(db, sender, "sms")
        return t("stopped", lang), None
    if c == "yes":
        record_consent(db, sender, "sms", lang, allow_followup=True)
        return t("send_report", lang), None
    if c == "help":
        return sms_help(lang), None
    if c == "status":
        r = db.get(Report, cmd["ref_id"]) if cmd.get("ref_id") else None
        if not r or r.contributor_hash != hash_contact(sender):
            return t("not_found", lang), None
        return f"{r.public_id}: {STATUS_TEXT[r.status][lang]}", None

    if not limiter.check(f"sms:{hash_contact(sender)}", 10, 3600):
        return t("rate", lang), None
    consent = get_consent(db, sender, "sms")
    r, _, created = create_report(
        db, channel="sms", text=cmd["text"], actor=Actor.system("system:sms"), language=None,
        category_key=cmd.get("category"), source_ref=f"sms:{msg_id}" if msg_id else None,
        contact=sender, allow_followup=bool(consent and consent.allow_followup),
    )
    return t("received", lang, ref=r.public_id), (r.id if created else None)
