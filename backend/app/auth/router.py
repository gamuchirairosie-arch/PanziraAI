"""Authentication API Router

Handles login, token issuance, and profile retrieval.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.database.models import User
from app.db import get_db as get_v1_db
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.auth.security import verify_password, create_access_token
from app.auth.dependencies import get_current_user
from app.security import Actor, admin_only
from app.routers.auth import (
    CitizenRegisterIn,
    JournalistDecisionIn,
    JournalistRegisterIn,
    decide_journalist_application,
    list_journalist_applications,
    register_citizen,
    register_journalist,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate an editor, journalist, citizen, or admin and return a JWT bearer token."""
    user = db.query(User).filter(User.email == credentials.email.lower().strip()).first()
    stored_pw = (user.hashed_password or user.password_hash) if user else None
    if not user or not verify_password(credentials.password, stored_pw):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if (getattr(user, "verification_status", None) or "verified") != "verified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account verification status is '{user.verification_status}'. Admin approval required.",
        )
    if not (user.is_active if user.is_active is not None else user.active):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role, "name": user.full_name or user.name}
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/register/citizen", status_code=201)
def register_citizen_mirror(body: CitizenRegisterIn, request: Request, db: Session = Depends(get_v1_db)):
    return register_citizen(body, request, db)


@router.post("/register/journalist", status_code=201)
def register_journalist_mirror(body: JournalistRegisterIn, request: Request, db: Session = Depends(get_v1_db)):
    return register_journalist(body, request, db)


@router.get("/admin/journalist-applications")
def list_journalist_applications_mirror(
    status: str | None = Query(default="pending_verification"),
    actor: Actor = Depends(admin_only),
    db: Session = Depends(get_v1_db),
):
    return list_journalist_applications(status=status, actor=actor, db=db)


@router.post("/admin/journalist-applications/{user_id}/decide")
def decide_journalist_application_mirror(
    user_id: int,
    body: JournalistDecisionIn,
    request: Request,
    actor: Actor = Depends(admin_only),
    db: Session = Depends(get_v1_db),
):
    return decide_journalist_application(user_id=user_id, body=body, request=request, actor=actor, db=db)


@router.get("/me", response_model=UserResponse)
def get_current_profile(current_user: User = Depends(get_current_user)):
    """Retrieve the profile and permissions of the currently authenticated user."""
    return UserResponse.model_validate(current_user)

