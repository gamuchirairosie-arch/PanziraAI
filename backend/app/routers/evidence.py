"""Evidence access. Files are never public. Graphic originals require the can_view_graphic permission and every
reveal is written to the audit trail."""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from .. import audit
from ..db import get_db
from ..models import Evidence, User
from ..security import Actor, client_ip, media_token, newsroom, read_media_token
from ..storage import read_bytes

router = APIRouter(prefix="/api/v1", tags=["evidence"])
_HEADERS = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline", "Content-Security-Policy": "default-src 'none'"}


def _serve(db: Session, ev_id: str, variant: str, token: str) -> Response:
    claims = read_media_token(token)
    if claims["ev"] != ev_id or claims["var"] != variant:
        raise HTTPException(403, "Media link does not match this file")
    user = db.get(User, int(claims["sub"]))
    if not user or not user.active:
        raise HTTPException(403, "Account disabled")
    ev = db.get(Evidence, ev_id)
    if not ev:
        raise HTTPException(404, "Not found")
    if variant == "full":
        # re-check at serve time: a link minted before the image was flagged must stop working
        if ev.is_graphic and not claims.get("rev"):
            raise HTTPException(403, "Restricted image: use the reveal action")
        return Response(read_bytes(ev.path), media_type=ev.mime, headers=_HEADERS)
    return Response(read_bytes(ev.preview_path), media_type="image/jpeg", headers=_HEADERS) if ev.is_graphic \
        else Response(read_bytes(ev.path), media_type=ev.mime, headers=_HEADERS)


@router.get("/evidence/{ev_id}/preview")
def preview(ev_id: str, t: str, db: Session = Depends(get_db)):
    return _serve(db, ev_id, "preview", t)


@router.get("/evidence/{ev_id}/full")
def full(ev_id: str, t: str, db: Session = Depends(get_db)):
    return _serve(db, ev_id, "full", t)


@router.post("/evidence/{ev_id}/reveal")
def reveal(ev_id: str, request: Request, actor: Actor = Depends(newsroom), db: Session = Depends(get_db)):
    ev = db.get(Evidence, ev_id)
    if not ev:
        raise HTTPException(404, "Not found")
    if ev.is_graphic and not actor.can_view_graphic:
        audit.record(db, actor, "graphic_reveal_denied", "evidence", ev.id, ip=client_ip(request))
        db.commit()
        raise HTTPException(403, "You do not have permission to view restricted images")
    audit.record(db, actor, "graphic_reveal" if ev.is_graphic else "evidence_viewed", "evidence", ev.id,
                 ip=client_ip(request))
    db.commit()
    tok = media_token(ev.id, "full", actor.id, minutes=2, reveal=True)
    return {"url": f"/api/v1/evidence/{ev.id}/full?t={tok}", "expiresInSeconds": 120}
